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

/**
 * Tax regime recorded on the profile.
 *
 * Phase 6 decision (see `docs/ai/phases/06_fiscal_profile.md` §3): this union is
 * what the app can *read*, not what it can *offer*. Only `impozit_pe_venit` is a
 * regime a PFA can hold and the engine can compute in 2026.
 *
 * - `impozit_pe_venit` — CF art. 123 alin. (1) + art. 118, Titlul IV sistem real.
 *   The only computable regime (see `domain/regimes.ts`).
 * - `impozit_pe_cit` — **not selectable, never offered in the UI.** A PFA cannot be
 *   a Titlul II (impozit pe profit) taxpayer in 2026: CF art. 13 alin. (1), art. 14
 *   and art. 15 each confine Titlul II to persoane juridice, and the option vehicle
 *   (CF art. 120) is Abrogat (OUG 128/2024 pct. 11 Art. I, MO 1125/11.11.2024, eff.
 *   01.01.2025). Kept in the union only so a legacy or foreign payload still parses
 *   and can be refused as a data-integrity failure instead of silently discarded.
 * - `norma_venit` — **boundary only, not selectable, not computable.** The 2026 rule
 *   package contains no norm-of-income rule and the app holds no norm values; the
 *   engine refuses it as REVIEW_REQUIRED. No norm value is invented anywhere.
 */
export type PfaRegime = 'impozit_pe_venit' | 'impozit_pe_cit' | 'norma_venit';

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
 * One CAEN classification code with its description.
 *
 * Phase 7 (D-1) makes this the single CAEN model. It replaces the two older
 * shapes: `PfaProfile.caen: string` (code only, no description) and
 * `SettingsState.company.caen: CompanyCaen[]` (a duplicate store no UI wrote).
 * The domain owns the type so `data/types.ts` does not become a source of
 * domain models.
 */
export interface CaenCode {
  /** CAEN code, e.g. '6201'. */
  cod: string;
  /** Human-readable classification, e.g. 'Activități de programare computerizate'. */
  descriere: string;
}

/**
 * Identity/contact data owned by the profile.
 *
 * Phase 7 (D-1) makes this the ONE canonical identity store: the fields that
 * previously lived only in `SettingsState.company` / `SettingsState.personal`
 * are absorbed here, and those settings blocks retire from the UI and from all
 * writes while staying parseable (frozen legacy data, read only by the
 * migration chain).
 *
 * The Phase 7 additions are OPTIONAL on purpose. `pfaIdentitySchema` gates the
 * live profile *and* the embedded profile of every stored calculation snapshot
 * (`data/schema.ts` `taxCalculationSnapshotSchema.inputSnapshot.profile`), so a
 * REQUIRED new identity field would invalidate every payload written before
 * Phase 7 — see the data-loss note on `pfaProfileSchema` and
 * `docs/ai/phases/07_identity.md`.
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
  /**
   * VAT registration code in intra-community trade (cod TVA intracomunitar).
   * Absorbed from `settings.company.codTvaIntra` by migration step v0→v1.
   */
  codTvaIntra?: string;
  /**
   * Activity classifications (CAEN). Absorbed from `settings.company.caen` by
   * migration step v0→v1, which also folds the old `PfaProfile.caen` string in.
   * The engine reads CAEN nowhere today — no CAEN-keyed rule is citable, so this
   * is descriptive data, not a fiscal input (and it is deliberately NOT part of
   * `inputsKey`, see `docs/ai/phases/07_identity.md`).
   */
  caen?: CaenCode[];
  /** Free text printed on invoices (menițiuni pe factură). Absorbed from `settings.company.mentiuniFactura`. */
  mentiuniFactura?: string;
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
  /**
   * Exact PFA start date (ISO `YYYY-MM-DD`), optional so payloads written before
   * Phase 6 keep validating. Read by the engine only to surface CF art. 118 alin.
   * (3) — „Veniturile din categoriile prevăzute la art. 61 lit. a) … ce se realizează
   * într-o fracțiune de an … se consideră venit anual.” Deadline/date semantics
   * remain Phase 9.
   */
  pfaStartDate?: string;
  /** Current tax year the profile is active for (Romanian fiscal year = calendar year). */
  fiscalYear: number;
  /** Tax regime. */
  regime: PfaRegime;
  /**
   * @deprecated Phase 7 (D-1): the CAEN model is `identity.caen: CaenCode[]`.
   * This field is kept OPTIONAL so payloads written before Phase 7 keep
   * validating (a required-or-removed field would invalidate every stored
   * snapshot's embedded profile too); migration step v0→v1 folds its value into
   * `identity.caen`. No application code reads or writes it any more — the only
   * remaining readers are the migration and its tests.
   */
  caen?: string;
  /** Concurrent salary status. */
  salaryStatus: PfaSalaryStatus;
  /**
   * Salary and assimilated income actually realised in `fiscalYear`, in lei (CF art.
   * 155 alin. (1) lit. a) / art. 76). Optional so payloads written before Phase 6 keep
   * validating — see the data-loss note in `docs/ai/phases/06_fiscal_profile.md` §2.
   *
   * This is the input CF art. 174 alin. (7) lit. a) needs: the art. 174 alin. (6)
   * top-up to 6 SM „nu se datorează” when salary income in that fiscal year is „cel
   * puțin egal cu 6 salarii minime brute”. Without it the CASS branch for a salaried
   * PFA cannot be decided and `calcCass` returns REVIEW_REQUIRED.
   *
   * CASS ONLY. It must never reach `calcCas`: CF art. 150 alin. (2) exempts salary
   * earners only for art. 137 alin. (1) lit. b^1), not lit. b).
   */
  salaryIncomeLei?: number;
  /** Pension status. */
  pensionStatus: PfaPensionStatus;
  /** Other relevant income flags. */
  otherIncome: PfaOtherIncomeFlag[];
  /** CASS status. */
  socialInsuranceStatus: PfaSocialInsuranceStatus;
  /** VAT-exempt (scutire de TVA). */
  vatExempt: boolean;
  /**
   * The date the VAT turnover ceiling (CF art. 310 alin. (1)) was actually exceeded, ISO
   * `YYYY-MM-DD`. Optional on purpose — see the data-loss note on `pfaProfileSchema`: a
   * required field here would invalidate every payload written before this phase.
   *
   * This is the missing input for `VAT_REGISTRATION_DEADLINE_2026`. The rule has been correct,
   * cited and rule-driven since Phase 9b (`domain/deadlines.ts` `EVENT_DATE.vat_exceedance`,
   * `offset_days = 0`), but nothing in the app ever recorded the exceedance date, so the rule
   * resolved to `date: null, status: 'not_applicable'` and the deadline never appeared. The
   * silence when this field is absent is CORRECT — the engine has no source for the date and
   * must not invent one — so this field is what turns a structural silence into an answer.
   *
   * It is the exceedance date, not the registration date and not the month: Phase 9b split
   * `pfaStartDate` / `vatExceedanceMonth` deliberately and that split stands.
   */
  vatExceedanceDate?: string;
  /** Cash payment floor threshold in lei (limitele de casă). Default 0. */
  cashFloorLei: number;
  /** Identity/contact data used by the application. */
  identity: PfaIdentity;
  /** Last update timestamp (ISO 8601). */
  updatedAt: string;
}
