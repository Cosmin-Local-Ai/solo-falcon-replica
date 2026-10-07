// Step 14 — derived-state boundary (pure: no React, DOM, localStorage, or store imports).
//
// Composes the existing selectors (aggregation, projection) into one derived
// financial view with per-record provenance, and adds a structural tax-input
// selector: profile tax inputs + ACTIVE rule release → REVIEW_REQUIRED sentinel.
// No tax formula is implemented here — this is the dependency path future tax
// calculations will use.

import type { AppData } from '../data/types';
import { selectMonthly, selectYtd, inPeriod, revenueFiscalDate, expenseFiscalDate, type MonthlyTotals, type YtdTotals } from './aggregation';
import { selectProjectionV1, type ProjectionV1 } from './projection';
import type { FiscalRule } from './fiscal/rules';
import { sumBani, type Bani } from './money';
import type {
  PfaOtherIncomeFlag,
  PfaPensionStatus,
  PfaProfile,
  PfaRegime,
  PfaSalaryStatus,
  PfaSocialInsuranceStatus,
} from './models';

// ── Financial derived view ────────────────────────────────────────────────

/** Per-record provenance line. `counted` mirrors the aggregation counting rule
 *  (status 'inregistrata' && date within the fiscal period up to asOfDate). */
export interface RecordLine {
  id: string;
  date: string;
  total: number;
  status: string;
  counted: boolean;
  /** Document-link state: expenses/revenues are documents (tip + nr). */
  document: { tip: string; nr: string };
}

export interface FinancialDerivedView {
  fiscalYear: number;
  asOfDate: string;
  ytd: YtdTotals;
  monthly: Map<string, MonthlyTotals>;
  projection: ProjectionV1;
  lines: {
    revenues: RecordLine[];
    expenses: RecordLine[];
  };
}

type HasRecordFields = {
  id: string;
  date: string;
  status: string;
  valoareFaraTva: Bani;
  tva: Bani;
  tip: string;
  nr: string;
};

function toLines<T extends HasRecordFields>(
  records: T[],
  asOfDate: string,
  fiscalYear: number,
  fiscalDate: (r: T) => string,
): RecordLine[] {
  return records.map(r => {
    // The date shown and the date that decide `counted` are the SAME date: the fiscal date
    // (collected / paid, falling back to the legacy `date`) — CF art. 68 alin. (2) lit. a) and
    // alin. (4) lit. b). A line must never display a date that is not the one that made it count.
    const date = fiscalDate(r);
    return {
      id: r.id,
      date,
      total: sumBani([r.valoareFaraTva, r.tva]),
      status: r.status,
      counted: r.status === 'inregistrata' && inPeriod(date, asOfDate, fiscalYear),
      document: { tip: r.tip, nr: r.nr },
    };
  });
}

/** Single derived financial view for the whole app state.
 *  Recomputes (via the reactive store) whenever any source data changes. */
export function selectFinancialDerived(data: AppData, asOfDate: string): FinancialDerivedView {
  const fiscalYear = data.profile.fiscalYear;
  return {
    fiscalYear,
    asOfDate,
    ytd: selectYtd(data, asOfDate),
    monthly: selectMonthly(data, asOfDate),
    projection: selectProjectionV1(data, asOfDate),
    lines: {
      revenues: toLines(data.revenues, asOfDate, fiscalYear, revenueFiscalDate),
      expenses: toLines(data.expenses, asOfDate, fiscalYear, expenseFiscalDate),
    },
  };
}

// ── Structural tax-input selector (no formula) ─────────────────────────────

/** The profile tax inputs that future tax calculations consume. */
export interface TaxInputsReference {
  regime: PfaRegime;
  salaryStatus: PfaSalaryStatus;
  /** CF art. 174 alin. (7) lit. a) input — salary income realised in `fiscalYear`, in lei.
   * `null` means "not recorded" (a payload written before Phase 6); `undefined` would make
   * the canonical key unstable. CASS only — never an input to CAS (CF art. 150 alin. (2)). */
  salaryIncomeLei: Bani | null;
  pensionStatus: PfaPensionStatus;
  otherIncome: PfaOtherIncomeFlag[];
  socialInsuranceStatus: PfaSocialInsuranceStatus;
  vatExempt: boolean;
  cashFloorLei: Bani;
  fiscalYear: number;
  /** Exact PFA start date (ISO `YYYY-MM-DD`) or null. Read by the engine only for CF art. 118 alin. (3). */
  pfaStartDate: string | null;
  /** Deterministic reference key (canonical JSON) for the input set — provenance, not a formula hash. */
  inputsKey: string;
}

export interface TaxDerivedView {
  /** Structural sentinel — Step 14 establishes the dependency path only. */
  status: 'REVIEW_REQUIRED';
  fiscalYear: number;
  inputs: TaxInputsReference;
  /** The ACTIVE fiscal rule release for the profile fiscal year. */
  activeRelease: {
    ruleIds: string[];
    ruleCount: number;
  };
}

/** Canonical JSON with sorted object keys — deterministic reference key. */
function canonicalKey(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalKey).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalKey(v)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Structural tax-input selector: consumes profile tax inputs + the ACTIVE
 *  rule release (passed explicitly so a release change changes the output).
 *  Returns the REVIEW_REQUIRED sentinel — no tax formula is implemented. */
export function selectTaxDerived(data: AppData, activeRules: FiscalRule[]): TaxDerivedView {
  const profile: PfaProfile = data.profile;
  const inputs: Omit<TaxInputsReference, 'inputsKey'> = {
    regime: profile.regime,
    salaryStatus: profile.salaryStatus,
    salaryIncomeLei: profile.salaryIncomeLei ?? null,
    pensionStatus: profile.pensionStatus,
    otherIncome: [...profile.otherIncome].sort(),
    socialInsuranceStatus: profile.socialInsuranceStatus,
    vatExempt: profile.vatExempt,
    cashFloorLei: profile.cashFloorLei,
    fiscalYear: profile.fiscalYear,
    pfaStartDate: profile.pfaStartDate ?? null,
  };
  return {
    status: 'REVIEW_REQUIRED',
    fiscalYear: profile.fiscalYear,
    inputs: { ...inputs, inputsKey: canonicalKey(inputs) },
    activeRelease: {
      ruleIds: activeRules.map(r => r.ruleId).sort(),
      ruleCount: activeRules.length,
    },
  };
}
