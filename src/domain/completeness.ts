/**
 * Data completeness layer (Step 17).
 *
 * Pure, deterministic assessment of how complete an AppData payload is.
 *
 * Invariant: completeness is DERIVED from the actual data present. No
 * percentage, score, or fabricated value is produced — the output is a list
 * of concrete, checkable facts (checks) plus deterministic counts.
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
import type { TaxCalculationSnapshot } from './snapshots/types';

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
 * Completeness report — a list of concrete facts plus deterministic counts.
 * Deliberately NO percentage and NO score: only counts of satisfied checks.
 */
export interface CompletenessReport {
  /** The concrete, checkable facts, in a fixed deterministic order. */
  checks: CompletenessCheck[];
  /** How many checks are satisfied (deterministic count only). */
  satisfiedCount: number;
  /** Total number of checks (deterministic count only). */
  totalCount: number;
}

/** Fixed order of the company-documents sections (im, cs, tva, facturi). */
const COMPANY_DOC_SECTIONS: DocTypeCode[] = ['im', 'cs', 'tva', 'facturi'];

/** Guard a possibly-missing/nullable array — never crashes on undefined. */
function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

/** Deterministic English plural suffix ('record' vs 'records'). */
function plural(n: number): string {
  return n === 1 ? '' : 's';
}

/** profile present and usable: exists, fiscalYear set, regime set. */
function profileCheck(profile: PfaProfile | null | undefined): CompletenessCheck {
  if (profile == null) {
    return { key: 'profile', satisfied: false, detail: 'profile missing' };
  }
  const fiscalYearSet = typeof profile.fiscalYear === 'number' && profile.fiscalYear > 0;
  const regimeSet = typeof profile.regime === 'string' && profile.regime.length > 0;
  const issues: string[] = [];
  if (!fiscalYearSet) issues.push('fiscal year');
  if (!regimeSet) issues.push('regime');
  const detail =
    issues.length === 0
      ? `profile present (fiscal year ${profile.fiscalYear}, regime ${profile.regime})`
      : `profile present but ${issues.join(' and ')} not set`;
  return { key: 'profile', satisfied: issues.length === 0, detail };
}

/** income records present; detail notes how many have status 'inregistrata'. */
function incomeCheck(revenues: Revenue[] | null | undefined): CompletenessCheck {
  const list = asArray(revenues);
  if (list.length === 0) {
    return { key: 'income', satisfied: false, detail: 'no income records' };
  }
  const inregistrata = list.filter(r => r.status === 'inregistrata').length;
  return {
    key: 'income',
    satisfied: true,
    detail: `${list.length} income record${plural(list.length)} present (${inregistrata} inregistrata)`,
  };
}

/** expense records present; detail notes how many have status 'inregistrata'. */
function expenseCheck(expenses: Expense[] | null | undefined): CompletenessCheck {
  const list = asArray(expenses);
  if (list.length === 0) {
    return { key: 'expenses', satisfied: false, detail: 'no expense records' };
  }
  const inregistrata = list.filter(e => e.status === 'inregistrata').length;
  return {
    key: 'expenses',
    satisfied: true,
    detail: `${list.length} expense record${plural(list.length)} present (${inregistrata} inregistrata)`,
  };
}

/** client records present. */
function clientCheck(clients: Client[] | null | undefined): CompletenessCheck {
  const list = asArray(clients);
  return {
    key: 'clients',
    satisfied: list.length > 0,
    detail: list.length > 0 ? `${list.length} client${plural(list.length)} present` : 'no clients',
  };
}

/** dashboard documents present. */
function documentCheck(documents: DocumentItem[] | null | undefined): CompletenessCheck {
  const list = asArray(documents);
  return {
    key: 'documents',
    satisfied: list.length > 0,
    detail: list.length > 0 ? `${list.length} document${plural(list.length)} present` : 'no documents',
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
      ? `${total} company document${plural(total)} present (${sections
          .map(s => `${s.code}: ${s.count}`)
          .join(', ')})`
      : 'no company documents';
  return { key: 'companyDocuments', satisfied: total > 0, detail };
}

/** declarations present. */
function declarationCheck(declarations: Declaration[] | null | undefined): CompletenessCheck {
  const list = asArray(declarations);
  return {
    key: 'declarations',
    satisfied: list.length > 0,
    detail:
      list.length > 0 ? `${list.length} declaration${plural(list.length)} present` : 'no declarations',
  };
}

/** tax statements present. */
function statementCheck(statements: TaxStatement[] | null | undefined): CompletenessCheck {
  const list = asArray(statements);
  return {
    key: 'statements',
    satisfied: list.length > 0,
    detail:
      list.length > 0 ? `${list.length} tax statement${plural(list.length)} present` : 'no tax statements',
  };
}

/**
 * tax estimate available — at least one snapshot with status 'computed'.
 * Handles the seed case of zero snapshots without crashing.
 */
function taxEstimateCheck(snapshots: TaxCalculationSnapshot[] | null | undefined): CompletenessCheck {
  const list = asArray(snapshots);
  const computed = list.filter(s => s.status === 'computed').length;
  let detail: string;
  if (computed > 0) {
    detail = `${computed} computed tax estimate${plural(computed)} available`;
  } else if (list.length > 0) {
    detail = `no computed tax estimate (0 of ${list.length} snapshots computed)`;
  } else {
    detail = 'no tax snapshots';
  }
  return { key: 'taxEstimate', satisfied: computed > 0, detail };
}

/**
 * Assess the completeness of an AppData payload.
 *
 * Pure and deterministic: same `data` ⇒ same report. Checks are derived
 * strictly from real AppData fields (profile, revenues, expenses, clients,
 * documents, companyDocs, declarations, statements, snapshots); every
 * optional/nullable field is guarded. The report carries concrete checkable
 * facts and deterministic counts only — no percentage, no score.
 */
export function assessCompleteness(data: AppData): CompletenessReport {
  const checks = [
    profileCheck(data.profile),
    incomeCheck(data.revenues),
    expenseCheck(data.expenses),
    clientCheck(data.clients),
    documentCheck(data.documents),
    companyDocumentCheck(data.companyDocs),
    declarationCheck(data.declarations),
    statementCheck(data.statements),
    taxEstimateCheck(data.snapshots),
  ];
  const satisfiedCount = checks.filter(c => c.satisfied).length;
  return { checks, satisfiedCount, totalCount: checks.length };
}
