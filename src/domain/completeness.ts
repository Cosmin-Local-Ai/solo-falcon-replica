/**
 * Data completeness layer (Step 17).
 *
 * Pure, deterministic assessment of how complete an AppData payload is.
 *
 * Invariant: completeness is DERIVED from the actual data present. No
 * fabricated value is produced — the output is a list of concrete, checkable
 * facts (checks) plus deterministic counts, and since PG-1 one percentage that
 * is a division of two amounts this file can name.
 *
 * No AppData is mutated, no store/persistence access, no LLM, no fiscal
 * rules, no internet, no UI.
 */
import type {
  AppData,
  Client,
  CompanyDocument,
  Declaration,
  DocTypeCode,
  DocumentItem,
  Expense,
  Revenue,
  TaxStatement,
} from '../data/types';
import type { PfaProfile } from './models';
import { expenseFiscalDate, inPeriod, revenueFiscalDate } from './aggregation';
import { sumBani, type Bani } from './money';
import { isGapReason, type EstimateCoverageGap } from './estimateBasis';
import { isoCalendarDateProblem } from './date';

/** One concrete, checkable fact about data completeness. */
export interface CompletenessCheck {
  /** Stable, deterministic check identifier. */
  key: string;
  /** Whether the check is satisfied by the actual data. */
  satisfied: boolean;
  /** Deterministic, human-readable explanation of what is present/missing. */
  detail: string;
}

/**
 * PG-1 — the amount-weighted half of completeness.
 *
 * The counts answer "how many kinds of fact are present?". They cannot answer "how much of the money
 * the estimate is supposed to describe actually reached it?", and a profile with one huge uncategorised
 * invoice and three small satisfied checks used to read as more complete than the reverse.
 *
 * Both terms are sums of stored minor units (`Bani`), never floats, and the percentage is FLOORED: an
 * app that cannot measure the last 0.6% must not claim it. The denominator is the amounts the estimate
 * could have consumed — records whose own status and date make them eligible — so a rejected document or
 * a record from another fiscal year does not sit in a denominator nothing can ever satisfy.
 *
 * One caveat stated rather than hidden: a record with no recorded BNR rate has no lei amount, so its
 * amount enters the denominator in the minor units it is written in. That is the only unit the app
 * holds for it, and the alternative — leaving it out of the denominator — is what made the old figure
 * read as complete while a real sum was missing from it.
 */
export interface AmountCoverage {
  /** Recorded amounts the estimate could have consumed, in stored minor units. */
  recordedBani: Bani;
  /** The part of that which reached the estimate. */
  includedBani: Bani;
  /** `included / recorded × 100`, floored. `null` when there is nothing recorded to weigh. */
  percent: number | null;
}

/**
 * Completeness report — concrete facts, deterministic counts, and since PG-1 the amount-weighted
 * coverage of the estimate's own inputs.
 */
export interface CompletenessReport {
  /** The concrete, checkable facts, in a fixed deterministic order. */
  checks: CompletenessCheck[];
  /** How many checks are satisfied (deterministic count only). */
  satisfiedCount: number;
  /** Total number of checks (deterministic count only). */
  totalCount: number;
  /** PG-1 — the share of recorded amount that entered the estimate. */
  coverage: AmountCoverage;
}

/** Fixed order of the company-documents sections (im, cs, tva, facturi). */
const COMPANY_DOC_SECTIONS: DocTypeCode[] = ['im', 'cs', 'tva', 'facturi'];

/** Guard a possibly-missing/nullable array — never crashes on undefined. */
function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Romanian count + noun form. `n === 1` uses the singular noun, otherwise
 * the plural noun. Returns e.g. "1 client prezent" / "3 clienți prezenți".
 */
function ro(n: number, singular: string, plural: string): string {
  return n === 1 ? `1 ${singular}` : `${n} ${plural}`;
}

/** Romanian labels for raw regime keys (never render raw keys). */
const REGIME_LABELS: Record<string, string> = {
  impozit_pe_venit: 'impozit pe venit',
  impozit_pe_cit: 'impozit pe CIT',
};

/**
 * profile present AND carrying the facts onboarding is supposed to collect.
 *
 * Phase 11 widened this from "exists, fiscalYear set, regime set" to include the taxpayer's name and the
 * PFA start date. It is widened here rather than in a new predicate because the hero's „Completează
 * profilul” has to be driven by the same report the completeness card renders — a second completeness
 * model is exactly what this file's header forbids, and two models drift the first time one is fixed.
 *
 * The start date is required here and optional on the schema, and that is not a contradiction: the
 * schema stays permissive so an existing payload is never rejected and quarantined for a key it has never
 * heard of (landmine 3), while completeness reports the missing fact instead of inventing it.
 */
function profileCheck(profile: PfaProfile | null | undefined): CompletenessCheck {
  if (profile == null) {
    return { key: 'profile', satisfied: false, detail: 'profil lipsă' };
  }
  const fiscalYearSet = typeof profile.fiscalYear === 'number' && profile.fiscalYear > 0;
  const regimeSet = typeof profile.regime === 'string' && profile.regime.length > 0;
  const nameSet = typeof profile.identity?.nume === 'string' && profile.identity.nume.trim().length > 0;
  // Absence and a malformed value are the same finding here: neither is a start date the app can use.
  const startDateSet = isoCalendarDateProblem(profile.pfaStartDate ?? '') === null;
  const issues: string[] = [];
  if (!nameSet) issues.push('nume');
  if (!fiscalYearSet) issues.push('an fiscal');
  if (!regimeSet) issues.push('regim');
  if (!startDateSet) issues.push('data începerii activității');
  const detail =
    issues.length === 0
      ? `profil prezent (an fiscal ${profile.fiscalYear}, regim ${REGIME_LABELS[profile.regime] ?? profile.regime})`
      : `profil prezent, dar ${issues.join(' și ')} nesetat`;
  return { key: 'profile', satisfied: issues.length === 0, detail };
}

/** income records present; detail notes how many have status 'inregistrata'. */
function incomeCheck(revenues: Revenue[] | null | undefined): CompletenessCheck {
  const list = asArray(revenues);
  if (list.length === 0) {
    return { key: 'income', satisfied: false, detail: 'nu există înregistrări de venituri' };
  }
  const inregistrata = list.filter(r => r.status === 'inregistrata').length;
  return {
    key: 'income',
    satisfied: true,
    detail: `${ro(list.length, 'înregistrare de venituri prezentă', 'înregistrări de venituri prezente')} (${inregistrata} înregistrate)`,
  };
}

/** expense records present; detail notes how many have status 'inregistrata'. */
function expenseCheck(expenses: Expense[] | null | undefined): CompletenessCheck {
  const list = asArray(expenses);
  if (list.length === 0) {
    return { key: 'expenses', satisfied: false, detail: 'nu există înregistrări de cheltuieli' };
  }
  const inregistrata = list.filter(e => e.status === 'inregistrata').length;
  return {
    key: 'expenses',
    satisfied: true,
    detail: `${ro(list.length, 'înregistrare de cheltuieli prezentă', 'înregistrări de cheltuieli prezente')} (${inregistrata} înregistrate)`,
  };
}

/** client records present. */
function clientCheck(clients: Client[] | null | undefined): CompletenessCheck {
  const list = asArray(clients);
  return {
    key: 'clients',
    satisfied: list.length > 0,
    detail: list.length > 0 ? ro(list.length, 'client prezent', 'clienți prezenți') : 'nu există clienți',
  };
}

/** dashboard documents present. */
function documentCheck(documents: DocumentItem[] | null | undefined): CompletenessCheck {
  const list = asArray(documents);
  return {
    key: 'documents',
    satisfied: list.length > 0,
    detail: list.length > 0 ? ro(list.length, 'document prezent', 'documente prezente') : 'nu există documente',
  };
}

/**
 * company documents present — satisfied when at least one entry exists in ANY
 * of the im/cs/tva/facturi sections (each section guarded individually).
 */
function companyDocumentCheck(
  companyDocs: Record<DocTypeCode, CompanyDocument[]> | null | undefined,
): CompletenessCheck {
  const sections = COMPANY_DOC_SECTIONS
    .map(code => ({ code, count: asArray(companyDocs?.[code]).length }))
    .filter(s => s.count > 0);
  const total = sections.reduce((sum, s) => sum + s.count, 0);
  const detail =
    total > 0
      ? `${ro(total, 'document de firmă prezent', 'documente de firmă prezente')} (${sections
          .map(s => `${s.code}: ${s.count}`)
          .join(', ')})`
      : 'nu există documente de firmă';
  return { key: 'companyDocuments', satisfied: total > 0, detail };
}

/** declarations present. */
function declarationCheck(declarations: Declaration[] | null | undefined): CompletenessCheck {
  const list = asArray(declarations);
  return {
    key: 'declarations',
    satisfied: list.length > 0,
    detail:
      list.length > 0 ? ro(list.length, 'declarație prezentă', 'declarații prezente') : 'nu există declarații',
  };
}

/** tax statements present. */
function statementCheck(statements: TaxStatement[] | null | undefined): CompletenessCheck {
  const list = asArray(statements);
  return {
    key: 'statements',
    satisfied: list.length > 0,
    detail:
      list.length > 0 ? ro(list.length, 'situație de taxe prezentă', 'situații de taxe prezente') : 'nu există situații de taxe',
  };
}

/**
 * PG-1 — the amount-weighted coverage, from the coverage gaps the estimate assembler reported.
 *
 * This does NOT re-classify, re-convert or re-decide anything: the gaps arrive already decided, and
 * this only divides them by the population they were drawn from. The eligibility test is the SAME
 * `inPeriod` the aggregates use, so the denominator cannot drift from the totals the dashboard shows.
 */
function amountCoverage(
  data: AppData,
  gaps: readonly EstimateCoverageGap[],
  asOfDate: string | undefined,
): AmountCoverage {
  const fiscalYear = data.profile?.fiscalYear ?? 0;
  // No as-of date supplied: the whole fiscal year is in scope. Stated as a date rather than as a
  // special case, so `inPeriod` stays the single definition of "in the period".
  const asOf = asOfDate ?? `${fiscalYear}-12-31`;

  const eligible = new Set<string>();
  const amounts: Bani[] = [];
  for (const r of asArray(data.revenues)) {
    // B-71: the revenue half of this denominator must be filtered by the SAME date the estimate filters
    // by. `expenseFiscalDate` was already used below for expenses; the revenue side still read `r.date`,
    // so a revenue documented 20 Dec 2026 and collected 10 Jan 2027 stayed in the 2026 denominator while
    // the estimate correctly left it out of 2026 — the percentage and the figure disagreed about one
    // record. `revenueFiscalDate` is `collected ?? date`, so a record with no money date is unaffected.
    if (r.status !== 'inregistrata' || !inPeriod(revenueFiscalDate(r), asOf, fiscalYear)) continue;
    eligible.add(r.id);
    amounts.push(r.valoareFaraTva.amount);
  }
  for (const e of asArray(data.expenses)) {
    if (e.status !== 'inregistrata' || !inPeriod(expenseFiscalDate(e), asOf, fiscalYear)) continue;
    eligible.add(e.id);
    amounts.push(e.valoareFaraTva.amount);
  }

  const recorded = sumBani(amounts);
  // A gap for a record this population does not contain is not subtracted from a denominator that
  // never counted it; a gap for a record the law settled (`non_deductible`) is not missing coverage.
  const excluded = sumBani(
    gaps.filter(g => isGapReason(g.reason) && eligible.has(g.recordId)).map(g => g.amount),
  );
  const included: Bani = (recorded - excluded) as Bani;
  return {
    recordedBani: recorded,
    includedBani: included,
    percent: recorded === 0 ? null : Math.floor((Number(included) * 100) / Number(recorded)),
  };
}

/**
 * Assess the completeness of an AppData payload.
 *
 * Pure and deterministic: same `data` ⇒ same report. Checks are derived
 * strictly from real AppData fields (profile, revenues, expenses, clients,
 * documents, companyDocs, declarations, statements); every
 * optional/nullable field is guarded. The report carries concrete checkable
 * facts, deterministic counts, and the amount-weighted coverage of the
 * estimate's inputs.
 *
 * PG-1 removed the ninth check, `taxEstimate`. It asked whether a calculation snapshot with status
 * `computed` existed — i.e. whether the estimate RAN — and then counted that as evidence the estimate
 * was complete. A run is not a coverage result: the same profile that dropped an uncategorised expense
 * out of the base still had a computed snapshot, so the check was satisfied by exactly the failure it
 * was supposed to catch. Coverage is now measured directly, from the gaps the assembler reports.
 */
export function assessCompleteness(
  data: AppData,
  gaps: readonly EstimateCoverageGap[] = [],
  asOfDate?: string,
): CompletenessReport {
  const checks = [
    profileCheck(data.profile),
    incomeCheck(data.revenues),
    expenseCheck(data.expenses),
    clientCheck(data.clients),
    documentCheck(data.documents),
    companyDocumentCheck(data.companyDocs),
    declarationCheck(data.declarations),
    statementCheck(data.statements),
  ];
  const satisfiedCount = checks.filter(c => c.satisfied).length;
  return {
    checks,
    satisfiedCount,
    totalCount: checks.length,
    coverage: amountCoverage(data, gaps, asOfDate),
  };
}
