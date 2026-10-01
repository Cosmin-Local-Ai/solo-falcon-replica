/**
 * PFA/profile domain model — the single source of truth for the PFA profile.
 *
 * The profile owns: profile ID, PFA start year, current tax year, tax regime,
 * main activity (CAEN), salary/pension status, other income flags, social
 * insurance status, VAT/cash thresholds, and the identity/contact data used
 * by the application.
 *
 * Computed tax values (taxable base, CASS, tax due) are NOT stored here —
 * they are derived by the fiscal engine from these inputs.
 */

/** Tax regime for the PFA (impozit pe CIT vs impozit pe venit). */
export type PfaRegime = 'impozit_pe_cit' | 'impozit_pe_venit';

/** Whether the PFA holder has a concurrent salary (impozit pe venit thresholds depend on it). */
export type PfaSalaryStatus = 'da' | 'nu';

/** Whether the PFA holder is a pensioner (affects tax thresholds). */
export type PfaPensionStatus = 'da' | 'nu';

/** Flags for other relevant income sources (plural — a profile can have several). */
export type PfaOtherIncomeFlag =
  | 'imobiliare'    // rental income
  | 'autovehicule'  // vehicle rental
  | 'dividende'
  | 'concesiune'
  | 'alte';

/** CASS (social insurance) status for the profile. */
export type PfaSocialInsuranceStatus = 'obligatoriu' | 'exempt' | 'neplata';

/**
 * Identity/contact data owned by the profile.
 *
 * Mirrors the fields currently held in SettingsState.company/personal so the
 * profile can become the canonical identity source; the Settings page keeps
 * its existing behavior (additive change only, no redesign).
 */
export interface PfaIdentity {
  // personal
  nume: string;
  cnp: string;
  adresa: string;
  telefon: string;
  email: string;
  // company
  denumire: string;
  cui: string;
  formaJuridica: string;
  numarRegComert: string;
  adresaSocietate: string;
  telefonSocietate: string;
  emailSocietate: string;
  contBancar: string;
  banca: string;
}

/**
 * The PFA profile. Persisted as the `profile` collection of AppData behind
 * the existing load/save cycle on the localStorage key `pfa-app-data-v2`.
 */
export interface PfaProfile {
  /** Stable profile ID. */
  id: string;
  /** Year the PFA activity started. */
  pfaStartYear: number;
  /** Current tax year the profile is active for (Romanian fiscal year = calendar year). */
  fiscalYear: number;
  /** Tax regime. */
  regime: PfaRegime;
  /** Main activity code (CAEN). */
  caen: string;
  /** Concurrent salary status. */
  salaryStatus: PfaSalaryStatus;
  /** Pension status. */
  pensionStatus: PfaPensionStatus;
  /** Other relevant income flags. */
  otherIncome: PfaOtherIncomeFlag[];
  /** CASS status. */
  socialInsuranceStatus: PfaSocialInsuranceStatus;
  /** VAT-exempt (scutire de TVA). */
  vatExempt: boolean;
  /** Cash payment floor threshold in lei (limitele de casă). Default 0. */
  cashFloorLei: number;
  /** Identity/contact data used by the application. */
  identity: PfaIdentity;
  /** Last update timestamp (ISO 8601). */
  updatedAt: string;
}
