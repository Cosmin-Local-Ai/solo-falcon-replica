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

/** profile present and usable: exists, fiscalYear set, regime set. */
function profileCheck(profile: PfaProfile | null | undefined): CompletenessCheck {
  if (profile == null) {
    return { key: 'profile', satisfied: false, detail: 'profil lipsă' };
  }
  const fiscalYearSet = typeof profile.fiscalYear === 'number' && profile.fiscalYear > 0;
  const regimeSet = typeof profile.regime === 'string' && profile.regime.length > 0;
  const issues: string[] = [];
  if (!fiscalYearSet) issues.push('an fiscal');
  if (!regimeSet) issues.push('regim');
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
 * tax estimate available — at least one snapshot with status 'computed'.
 * Handles the seed case of zero snapshots without crashing.
 */
function taxEstimateCheck(snapshots: TaxCalculationSnapshot[] | null | undefined): CompletenessCheck {
  const list = asArray(snapshots);
  const computed = list.filter(s => s.status === 'computed').length;
  let detail: string;
  if (computed > 0) {
    detail = ro(computed, 'estimare de taxe calculată disponibilă', 'estimări de taxe calculate disponibile');
  } else if (list.length > 0) {
    detail = `nicio estimare de taxe calculată (0 din ${list.length} instantanee calculate)`;
  } else {
    detail = 'nu există instantanee de taxe';
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
