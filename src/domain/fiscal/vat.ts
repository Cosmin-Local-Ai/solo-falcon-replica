/**
 * PG-6f (B-30, B-87) — **input VAT**: who may deduct it, how much of it, and which questions this app
 * is not allowed to answer.
 *
 * The defect this module replaces was two lines in `domain/tax.ts`:
 *
 *     const sistemRealGross = inputs.vatExempt ? revenues : revenuesNet;
 *     const sistemRealExpenseBase = inputs.vatExempt ? expenses : expensesNet;
 *
 * One profile boolean asserted, for every expense in the register, that a non-exempt PFA deducts every
 * leu of input VAT and an exempt one deducts none. Both halves are wrong. The right is **registration-
 * gated** (art. 301 alin. (1) gives it to „persoaná impozabilă înregistrată în scopuri de TVA, conform
 * art. 316", and art. 310 alin. (10) lit. a) expressly denies it to the small-business exemption), and
 * then cut back by switches that are decided **per line**: the supplier's own status, the vehicle
 * restriction, the destination of the purchase, the document, and whether the VAT la încasare deferral
 * has run out yet. `docs/ai/research/42_input_vat_deductibility_2026.md` §6 is the table this file is
 * built from, and each row below cites it.
 *
 * ## What is deliberately NOT in this file, and why
 *
 * - **art. 310².** `research/42` §11.1 corrects an earlier note: art. 310¹ and 310² are **cross-border**
 *   SME regimes for persons established in other Member States, keyed on the „EX" suffix. **A Romanian
 *   PFA is always under art. 310, never art. 310².** There is no member of any union here that could be
 *   mistaken for it.
 * - **art. 298 alin. (4¹)** — the 50 % restriction on residential buildings. Inserted by OUG 115/2023 but
 *   conditional on a derogation Romania has **not** obtained; in the 2026 consolidation it is still a
 *   future-effect note (`research/42` §10 gap 4). It is switched off, and the switch is not modelled.
 * - **The strict e-Factura view.** That a domestic B2B invoice never transmitted through RO e-Factura
 *   destroys the deduction is an **interpretation with no ANAF act behind it** (`research/42` §5, §10 gap
 *   3). Such lines are therefore **excluded from the claimable total and listed separately** — they are
 *   never marked non-deductible, and never silently added.
 * - **Norme pct. 90 alin. (1)** for registration dates — stale, and it contradicts art. 316 alin. (1¹),
 *   which fixes the effective date **in law** (OG 22/2025). `registrationEffectiveDate` implements the
 *   law's letters, not the norm's „prima zi a lunii următoare".
 * - **The income-tax five-category vehicle list.** That list lives in `fiscal/deductibility.ts
 *   VEHICLE_EXCEPTION_CATEGORIES` (art. 68 alin. (7) lit. k) points 1-5). The VAT list below has **six**
 *   members, the extra one being art. 298 alin. (3) lit. e) — `research/42` §3. They are two provisions
 *   and two unions, and nothing maps one onto the other.
 * - **`VehicleCapStatus`.** PG-6c's one-car selection is art. 68 alin. (5) lit. j). The 50 % here is art.
 *   298 alin. (1). Different provision, different evidence rule, no reuse.
 * - **The Titlul II ordering rule** (Norme pct. 16 alin. (3)) is quoted below as the corporate-only text
 *   that it is, per D-VAT-2, and is never applied to a PFA as if it governed Titlul IV.
 */
import { addBani, isRon, lei, sumBani, type Bani, type Money } from '../money';
import { applyRateDecimal } from '../money';
import Decimal from 'decimal.js-light';

// ── 1. Registration: the switch that decides whether a right exists at all ─────────
//
// `research/42` §11.2: „`vatExempt` expresses none of them". These are the states the law actually
// uses. Each is a **declared** fact — the app never derives registration from the turnover it already
// holds, because art. 310 alin. (2) measures the plafon on a restricted definition of turnover
// („operațiuni … cu locul în România") that this app does not compute.

export type VatRegistrationStatus =
  /** In the small-business exemption. Plafon 395.000 lei, „nu depășește" — exactly 395.000 is still
   *  exempt. art. 310 alin. (10) lit. a): „nu are dreptul la deducerea taxei". */
  | 'scutit_art310'
  /** Registered under art. 316 with no more to say about how it got there. art. 301 alin. (1). */
  | 'inregistrat_art316'
  /** Registered below the plafon. art. 316 alin. (1) lit. a) pct. 2 / lit. c); effective at
   *  „data solicitării" per alin. (1¹) lit. c). */
  | 'inregistrare_voluntara'
  /** Crossed the plafon. art. 316 alin. (1) lit. b) („cel târziu la data depășirii plafonului"); the
   *  effective date is the exceedance date itself, alin. (1¹) lit. b). The profile's existing
   *  `vatExceedanceDate` IS that date — it is not duplicated here. */
  | 'plafon_depasit'
  /** Code removed from the registru. art. 316 alin. (11); Norme pct. 11 alin. (6): such a person
   *  „nu beneficiază, în perioada respectivă, de dreptul de deducere", while still owing collected VAT. */
  | 'inregistrare_anulata'
  /** Back in the system after an annulment. art. 316 alin. (12), (14): deduction runs from the
   *  re-registration decision, with no fallback to art. 310 before that date. */
  | 'reinregistrat';

export const VAT_REGISTRATION_VALUES: readonly VatRegistrationStatus[] = [
  'scutit_art310',
  'inregistrat_art316',
  'inregistrare_voluntara',
  'plafon_depasit',
  'inregistrare_anulata',
  'reinregistrat',
];

/**
 * The declared registration fact.
 *
 * `effectiveFrom` is the date the state produces its effects, i.e. the answer to art. 316 alin. (1¹).
 * It is optional because the person may know the state and not the date; the app then says the date is
 * missing rather than choosing one — see `registrationEffectiveDate`.
 *
 * `cashAccounting` is **orthogonal, not a status**: TVA la încasare (art. 282 alin. (3)-(8)) is a
 * scheme a registered person may be in, including from the moment it registers (alin. (4)), and it
 * defers the deduction in both directions. It is not a sixth registration state and it never appears
 * in `VatRegistrationStatus`.
 */
export interface VatRegistration {
  status: VatRegistrationStatus;
  effectiveFrom?: string;
  cashAccounting?: VatYesNo;
}

/** The two declared answers. Absence is not a member: „never asked" is a third state. */
export type VatYesNo = 'da' | 'nu';
export const VAT_YES_NO_VALUES: readonly VatYesNo[] = ['da', 'nu'];

/** Does this state mean the person charges TVA on their own deliveries? Decides the revenue measure. */
export function registrationChargesVat(status: VatRegistrationStatus): boolean {
  return status !== 'scutit_art310';
}

/**
 * Does this state carry a right to deduct input VAT?
 *
 * `scutit_art310` — no, by art. 310 alin. (10) lit. a).
 * `inregistrare_anulata` — no for the annulled period, by Norme pct. 11 alin. (6).
 * Everything else — yes, art. 301 alin. (1) with art. 297 alin. (1) (the right arises at exigibility).
 */
export function registrationHasDeductionRight(status: VatRegistrationStatus): boolean {
  return status !== 'scutit_art310' && status !== 'inregistrare_anulata';
}

/**
 * The effective date of a registration state, per the letters of art. 316 alin. (1¹) as inserted by
 * OG 22/2025 — **in law, not in the normele**.
 *
 * Norme Titlul VII pct. 90 alin. (1) still says registration is valid from „prima zi a lunii următoare
 * celei în care persoana … solicită înregistrarea" and from „data comunicării certificatului". That text
 * was never updated and contradicts the article (`research/42` §11.2). It is **not** implemented here,
 * and the reason is recorded rather than left as an omission.
 *
 * `vatExceedanceDate` is the profile's existing field (v3→v4, edited in Settings). For
 * `plafon_depasit` it is the answer, and no second date field is introduced for the same event.
 */
export function registrationEffectiveDate(
  registration: VatRegistration | null | undefined,
  vatExceedanceDate?: string,
): { date: string; basis: string } | null {
  if (!registration) return null;
  switch (registration.status) {
    case 'plafon_depasit':
      return dateOf(
        registration.effectiveFrom ?? vatExceedanceDate,
        'art. 316 alin. (1¹) lit. b) — data depășirii plafonului',
      );
    case 'inregistrare_voluntara':
      return dateOf(registration.effectiveFrom, 'art. 316 alin. (1¹) lit. c) — data solicitării');
    case 'inregistrat_art316':
      return dateOf(registration.effectiveFrom, 'art. 316 alin. (1¹) — data înregistrării');
    case 'reinregistrat':
      return dateOf(registration.effectiveFrom, 'art. 316 alin. (12), (14) — data deciziei de reinregistrare');
    case 'inregistrare_anulata':
      return dateOf(registration.effectiveFrom, 'art. 316 alin. (11), (15) — data anulării');
    case 'scutit_art310':
      // The exemption has no registration date to compute; it is the state art. 310 alin. (1) puts the
      // person in while the plafon is not exceeded.
      return null;
  }
}

function dateOf(date: string | undefined, basis: string): { date: string; basis: string } | null {
  return date ? { date, basis } : null;
}

// ── 2. The per-line facts the switches read ───────────────────────────────────────

/**
 * What the purchase is destined for. art. 297 alin. (4) grants the right for achiziții „destinate
 * utilizării" in taxable operations (lit. a)), operations with the right to deduct (lit. c)); art. 300
 * alin. (3)-(5) then splits exclusive deductible use, exclusive non-deductible use and unknown
 * destination.
 */
export type VatDestination =
  | 'taxabila'
  | 'scutita_cu_drept'
  | 'scutita_fara_drept'
  | 'mixta'
  | 'nedeclarata';
export const VAT_DESTINATION_VALUES: readonly VatDestination[] = [
  'taxabila',
  'scutita_cu_drept',
  'scutita_fara_drept',
  'mixta',
  'nedeclarata',
];

/**
 * The supplier's own standing on the date of the purchase.
 *
 * `scutit_art310` is a hard zero at any rate: art. 310 alin. (10) lit. b) forbids the issuer from
 * mentioning TVA at all, and Norme pct. 83 alin. (15) closes the loop — the issuer „este obligată să
 * storneze facturile emise", and „Beneficiarii … nu au dreptul de deducere sau de rambursare a taxei
 * aplicate în mod eronat" (`research/42` §11.5). There is no statutory „TVA neaplicabilă" formula; that
 * wording is practice only.
 *
 * `cod_anulat` is art. 11 alin. (7)-(9): no deduction where the supplier's code was annulled or
 * inactive at the date, with exceptions the app cannot evaluate without ANAF's register.
 */
export type VatSupplierRegime = 'inregistrat' | 'scutit_art310' | 'cod_anulat' | 'nedeclarat';
export const VAT_SUPPLIER_REGIME_VALUES: readonly VatSupplierRegime[] = [
  'inregistrat',
  'scutit_art310',
  'cod_anulat',
  'nedeclarat',
];

/**
 * The document condition. art. 299 alin. (1) lit. a) requires „o factură emisă în conformitate cu
 * prevederile art. 319", and art. 319 alin. (1¹) says that for operations between Romanian taxable
 * persons only what satisfies OUG 120/2021 counts as a factură.
 *
 * `in_e_factura` — the line is in RO e-Factura, condition met.
 * `nu_in_e_factura` — a domestic B2B line with nothing in RO e-Factura. **Not encoded as a bar.** The
 * line is parked as unresolved, because whether the deduction survives is unsettled and art. 301 alin.
 * (2) revives it once a compliant e-Factura exists, within prescription.
 * `simplificata_100_400_eur` — art. 319 alin. (13) lit. a) makes the 100-400 euro band depend on an
 * individual MF order; `research/42` §10 gap 3 found no such general order in force. Unresolved.
 * `simplificata_sub_100_eur` — art. 319 alin. (12) lit. a) plus alin. (21) lit. f): supports deduction
 * **only with the buyer's VAT code on it** (Norme pct. 69 alin. (3), (6)).
 * `vamal_sau_autofactura` — import / AIC / reverse charge, justified by the customs declaration or the
 * self-invoice (art. 299 alin. (1) lit. c)-f)), not by e-Factura. The e-Factura condition does not bite.
 */
export type VatDocumentKind =
  | 'factura'
  | 'simplificata_sub_100_eur'
  | 'simplificata_100_400_eur'
  | 'vamal_sau_autofactura'
  | 'nedeclarat';
export const VAT_DOCUMENT_KIND_VALUES: readonly VatDocumentKind[] = [
  'factura',
  'simplificata_sub_100_eur',
  'simplificata_100_400_eur',
  'vamal_sau_autofactura',
  'nedeclarat',
];

/** Whether the line actually travelled through RO e-Factura. Only asked of a domestic B2B invoice. */
export type VatEFacturaFact = 'da' | 'nu' | 'nedeclarat';
export const VAT_EFACTURA_VALUES: readonly VatEFacturaFact[] = ['da', 'nu', 'nedeclarat'];

/**
 * The facts a person declares about ONE expense line, for the VAT decision only.
 *
 * Every field is optional and nothing anywhere defaults it. Absence is not "no": it makes the line's
 * VAT outcome **unresolved**, which keeps it out of the claimable total and lists it — the shape D-VAT-3
 * chose, and the opposite of the `vatExempt` habit of answering a question nobody asked.
 *
 * `preRegistration` records that the purchase happened before the registration date. That is not a gap:
 * a PFA crossing the plafon recovers it by the **positive adjustment** at Norme pct. 83 alin. (11)-(12),
 * recorded in the first D300 after registration — the Norme for art. 297 expressly route the art. 310
 * case away from the general art. 297 alin. (6) rule. And alin. (13): such an invoice „nu trebuie să
 * conțină mențiunea referitoare la codul de înregistrare în scopuri de TVA", so a missing buyer code
 * must never reject the line. The paragraph number is **not** hard-coded anywhere: consolidations
 * disagree (pct. 66 vs 67, alin. (14) vs (16)) — `research/42` §11.4.
 */
export interface ExpenseVatFacts {
  destination?: VatDestination;
  supplierRegime?: VatSupplierRegime;
  /** art. 297 alin. (2): the SUPPLIER is in TVA la încasare. art. 319 alin. (20) lit. p) is the mention
   *  that signals it on the incoming document. */
  supplierCashAccounting?: VatYesNo;
  /** art. 297 alin. (7) lit. b): alcohol and tobacco are never deductible **unless for resale**. */
  alcoholOrTobacco?: VatYesNo;
  forResale?: VatYesNo;
  documentKind?: VatDocumentKind;
  eFactura?: VatEFacturaFact;
  /**
   * Is the buyer's VAT code printed on this document? art. 319 alin. (21) lit. f) (OUG 138/2024) makes
   * it a statutory minimum on simplified invoices, and Norme pct. 69 alin. (3), (6) let a fiscal receipt
   * or simplified invoice justify deduction **only** with the code on it.
   *
   * It is **not** required on a pre-registration invoice: Norme pct. 83 alin. (13) says such a document
   * „nu trebuie să conțină mențiunea referitoare la codul de înregistrare în scopuri de TVA”. Rejecting
   * those lines for a missing code is itself a defect, so this field is never consulted when
   * `preRegistration` is `da`.
   */
  buyerVatCodeOnDocument?: VatYesNo;
  preRegistration?: VatYesNo;
}

// ── 3. The vehicle restriction — art. 298, and its SIX categories ─────────────────
//
// art. 298 alin. (1): „Prin excepție de la prevederile art. 297 se limitează la **50 %** dreptul de
// deducere … în cazul în care vehiculele nu sunt utilizate exclusiv în scopul activității economice."
// The restriction covers vehicles „aflate în proprietatea sau în **folosința** persoanei impozabile", so
// leased and rented-in cars are inside it.
//
// The evidence shape is **inverted** from the income-tax rule and this is the part most likely to be
// got backwards: Norme pct. 68 alin. (4) — „Persoana impozabilă care aplică deducerea limitată de 50 %
// **nu trebuie** să facă dovada utilizării vehiculului … cu ajutorul foii de parcurs". The 50 % branch
// needs no logbook; **full** deduction does.

/**
 * The six categories of art. 298 alin. (3) a)-f) where the restriction does not cut the deduction.
 *
 * This is **not** the income-tax list. `fiscal/deductibility.ts VEHICLE_EXCEPTION_CATEGORIES` has five,
 * because art. 68 alin. (7) lit. k) merges rental into its category 4 and has no „leasing financiar ori
 * operațional" wording at all. The extra member here is lit. e). `research/42` §3 works the consequence
 * out: a financial or operating lease is **100 % for VAT and 50 % for income tax**, and the two lists
 * must never be collapsed into one.
 */
export type VatVehicleExceptionCategory =
  | 'urgenta_paza_curierat'
  | 'agent_vanzari_achizitii'
  | 'transport_persoane_cu_plata'
  | 'servicii_plata_incl_scoli_soferi'
  /** art. 298 alin. (3) lit. e) — „vehiculele utilizate pentru închiriere sau a căror folosință este
   *  transmisă în cadrul unui contract de leasing financiar ori operațional". VAT-only. */
  | 'inchiriere_sau_leasing'
  /** art. 298 alin. (3) lit. f) — „vehicule utilizate ca mărfuri în scop comercial". */
  | 'marfuri_in_scop_comercial';

export const VAT_VEHICLE_EXCEPTION_VALUES: readonly VatVehicleExceptionCategory[] = [
  'urgenta_paza_curierat',
  'agent_vanzari_achizitii',
  'transport_persoane_cu_plata',
  'servicii_plata_incl_scoli_soferi',
  'inchiriere_sau_leasing',
  'marfuri_in_scop_comercial',
];

/**
 * The category that exists for VAT and not for income tax, named as a value so a test can assert the
 * two lists are not one list.
 */
export const VAT_ONLY_VEHICLE_EXCEPTION: VatVehicleExceptionCategory = 'inchiriere_sau_leasing';

/**
 * art. 298 alin. (2): the restriction „nu se aplică vehiculelor … având o masă totală maximă autorizată
 * care depășește 3.500 kg sau mai mult de 9 scaune, inclusiv scaunul șoferului". A second, separate
 * 100 % route — not a bigger version of the 50 % one.
 */
export const VAT_VEHICLE_MASS_KG_LIMIT = 3500;
export const VAT_VEHICLE_SEATS_LIMIT = 9;

/**
 * The vehicle's VAT facts, declared per fiscal year, alongside — never merged with — the income-tax
 * `VehicleYearFacts` in `fiscal/deductibility.ts`.
 *
 * `use` reuses the income-tax `VehicleUseFact` vocabulary on purpose: art. 298 alin. (1) and art. 68
 * alin. (7) lit. k) ask the **same factual question** („nu sunt utilizate exclusiv …"), and a third
 * spelling of one fact is the B-70 defect class. What differs is the consequence and the evidence rule,
 * and those live in the two layers separately.
 *
 * `not_used` is **not** `mixed`. A vehicle not used for the activity at all falls under art. 300 alin.
 * (4) — „nu se deduce" — which is zero, not 50 %.
 */
export interface VatVehicleYearFacts {
  fiscalYear: number;
  /** Reuses `VehicleUseFact` — see `fiscal/deductibility.ts`. */
  use?: 'exclusive' | 'mixed' | 'not_used' | 'unknown';
  exceptionCategory?: VatVehicleExceptionCategory;
  /** MTMA in kilograms; above `VAT_VEHICLE_MASS_KG_LIMIT` the restriction does not apply at all. */
  massMaxKg?: number;
  /** Seats including the driver. */
  seats?: number;
  /** A *foaie de parcurs* exists. Required for FULL VAT deduction, expressly NOT for the 50 % branch. */
  logbook?: VatYesNo;
}

// ── 4. The decision ───────────────────────────────────────────────────────────────

/**
 * Why a line's VAT is **decidedly not claimable**. Each carries its own provision, and none of them is
 * "the profile boolean said so".
 */
export type InputVatZeroReason =
  /** §6 row 1 — art. 310 alin. (10) lit. a), art. 301 alin. (1). */
  | 'fara_drept_nicio_inregistrare'
  /** Norme pct. 11 alin. (6) — the code was annulled for the period. */
  | 'cod_anulat_perioada'
  /** §6 row 22 — art. 11 alin. (7)-(9): the supplier's code was annulled or inactive at the date. */
  | 'furnizor_cod_anulat'
  /** §6 row 23 — art. 310 alin. (10) lit. b) + Norme pct. 83 alin. (15): the supplier may not even
   *  invoice VAT; the remedy is stornare, not deduction. */
  | 'furnizor_art310'
  /** §6 row 3 — art. 300 alin. (4): the purchase serves an operation without the right to deduct. */
  | 'destinatie_fara_drept'
  /** §6 row 18 — art. 297 alin. (7) lit. b): alcohol and tobacco not for resale. */
  | 'alcool_tutun_fara_revanzare'
  /** art. 300 alin. (4) applied to a vehicle not used for the activity at all. Zero, not 50 %. */
  | 'vehicul_neutilizat';

/**
 * Why a line is **parked** rather than answered. These are excluded from the claimable total and listed
 * separately — never added, never dropped, and never reported as non-deductible.
 */
export type InputVatUnresolvedReason =
  /** §6 row 14 — a domestic B2B line with nothing in RO e-Factura. The strict view is not encoded. */
  | 'document_fara_e_factura'
  /** The document type was never declared, so art. 299 alin. (1) lit. a) cannot be evaluated. */
  | 'document_nedeclarat'
  /** §6 row 16 — art. 319 alin. (13) lit. a) needs an individual MF order that was not found in force. */
  | 'document_simplificata_100_400_eur'
  /** A simplified invoice under 100 euro without the buyer's VAT code (art. 319 alin. (21) lit. f)). */
  | 'document_simplificata_fara_cod_cumparator'
  /** §6 row 5 — art. 300 alin. (5)-(14). There is **no de-minimis** in Romanian art. 300, so an
   *  undeclared pro rata cannot be assumed to be 100 %. */
  | 'pro_rata_nedeclarat'
  /** The destination of the purchase was never declared. */
  | 'destinatie_nedeclarata'
  /** The supplier's standing was never declared, so art. 11 alin. (7)-(9) and art. 310 alin. (10)
   *  lit. b) cannot be evaluated. */
  | 'furnizor_nedeclarat'
  /** The record is not written in lei and no recorded rate converted it. Reported by the ledger
   *  disclosure; it is not re-walked here. */
  | 'record_neconvertit';

/**
 * Why the right has not arisen **yet**. TVA la încasare defers in both directions and both are
 * payment-conditioned, not invoice-conditioned:
 *  - art. 297 alin. (3) — the PFA's own scheme: „Dreptul de deducere … este amânat până în momentul în
 *    care taxa … a fost plătită furnizorului/prestatorului său";
 *  - art. 297 alin. (2) — the SUPPLIER's scheme: VAT bought from a cash-accounting person is deferred
 *    until that supplier is paid.
 * Forgetting the supplier side overstates the claim, which is why both are keyed on `Expense.paid`.
 * The carve-outs are AIC, import and reverse charge — those are not payment-conditioned.
 */
export type InputVatDeferredReason =
  | 'plata_ammnata_regim_propriu'
  | 'plata_ammnata_furnizor';

export interface InputVatLine {
  id: string;
  /** The VAT on the line, in lei (bani), after the ledger's single conversion pass. */
  tvaBani: Bani;
  outcome:
    | { kind: 'claimable'; fraction: number; rule: string }
    | { kind: 'zero'; reason: InputVatZeroReason; rule: string }
    | { kind: 'unresolved'; reason: InputVatUnresolvedReason }
    | { kind: 'deferred'; reason: InputVatDeferredReason };
  /** True when the line is a vehicle line, so a surface can show which 50 % it is looking at. */
  vehicle: boolean;
  /** True when the purchase predates the registration date and reaches the claim by adjustment. */
  preRegistrationAdjustment: boolean;
}

export interface InputVatDecision {
  fiscalYear: number;
  asOfDate: string;
  /** The registration state the decision ran on, or null when the person never declared one. */
  registration: VatRegistration | null;
  /** False when no registration fact exists at all — the state in which nothing may be claimed. */
  registrationDeclared: boolean;
  lines: InputVatLine[];
  /**
   * D-VAT-3 — the claimable total for the period. **Not one D300 line**: `research/42` §7 records that
   * it lands on rd. 30 „TOTAL TAXĂ DEDUCTIBILĂ" plus the corrections on rd. 33/34, because the 50 % cut
   * and the pro rata fall partly inside rd. 20-28 and partly outside it. 6g owns the form.
   */
  claimableTotal: Bani;
  /** VAT decided non-recoverable on lines that entered the expense base — the B-87 amount, per line. */
  nonRecoverableTotal: Bani;
  unresolved: InputVatLine[];
  deferred: InputVatLine[];
  zero: InputVatLine[];
}

/**
 * The Titlul II text, quoted because it is the only ordering rule that exists anywhere — and labelled
 * for what it is: a rule for corporate tax, not for Titlul IV. D-VAT-2 requires it to be shown as the
 * corporate-only text, never applied to a PFA as if it governed this register.
 */
export const TITLUL_II_VAT_ORDERING_RULE = {
  citation: 'Normele metodologice de aplicare a Titlului II — pct. 16 alin. (3)',
  quote:
    'Pct. 16 alin. (3) din normele Titlului II: limita de deductibilitate se aplică după limitarea '
    + 'deductibilității taxei pe valoarea adăugată și peste taxa nedeductibilă (exemplul din normă: '
    + '2.000 + 240 = 2.240, deductibil 1.120).',
  scope:
    'Este o regulă pentru impozitul pe profit, deci pentru Titlul II. Nu există nicio regulă echivalentă '
    + 'pentru un PFA în Titlul IV: research/35 §1.5 și research/42 §10 gap 2 au căutat textul și nu '
    + 'există. Aplicația nu alege niciuna dintre cele două ordini.',
} as const;

/** A lei amount from a record already normalised to lei. A non-lei amount returns null, and the caller
 *  lists it rather than reading it as lei. */
function leiOf(amount: Money): Bani | null {
  return isRon(amount) ? amount.amount : null;
}

/**
 * A statutory percentage cut on a claim is **floored**, never rounded up: the app must not round a
 * taxpayer into claiming more than the law gives. `roundArt66` is deliberately not used — CF art. 66
 * alin. (1) rounds the sums that are DUE, and a claimable amount is not a sum due.
 */
function floorPercent(amountBani: Bani, percent: number): Bani {
  return applyRateDecimal(amountBani, percent).toDecimalPlaces(0, Decimal.ROUND_FLOOR).toNumber() as Bani;
}

export interface InputVatExpenseRecord {
  id: string;
  /** The document date, ISO. */
  date: string;
  /** The payment date, when one was recorded. The deferral switches read this, not `date`. */
  paid?: string;
  /** A domestic B2B line is one invoiced from another taxable person; `cui` is the recorded fact. */
  supplierCui?: string;
  tip: 'factura' | 'bon-fiscal';
  tva: Money;
  vatFacts?: ExpenseVatFacts;
  vehicleId?: string;
}

export interface InputVatVehicleRecord {
  id: string;
  years?: readonly VatVehicleYearFacts[];
}

export interface VatProRataYear {
  fiscalYear: number;
  /** The declared pro rata, a whole percent 0-100. art. 300 alin. (8) rounds the definitive one UP. */
  percent: number;
}

export interface InputVatInput {
  expenses: readonly InputVatExpenseRecord[];
  vehicles?: readonly InputVatVehicleRecord[];
  registration?: VatRegistration;
  /** The profile's existing exceedance date — the art. 316 alin. (1¹) lit. b) answer. */
  vatExceedanceDate?: string;
  proRataYears?: readonly VatProRataYear[];
  fiscalYear: number;
  asOfDate: string;
}

export function vehicleYearVatFacts(
  vehicles: readonly InputVatVehicleRecord[] | undefined,
  vehicleId: string | undefined,
  fiscalYear: number,
): VatVehicleYearFacts | null {
  if (!vehicleId || !vehicles) return null;
  const vehicle = vehicles.find((v) => v.id === vehicleId);
  if (!vehicle?.years) return null;
  return vehicle.years.find((y) => y.fiscalYear === fiscalYear) ?? null;
}

/**
 * Decide, for one expense line, whether its input VAT may be claimed in this period.
 *
 * The order is the order of who decides, and it matters: registration answers whether a right exists
 * at all, the supplier answers whether this invoice can ever support it, the goods and the destination
 * answer whether this purchase is inside the right, the vehicle rule cuts the amount, the document
 * answers whether it can be exercised now, and payment answers whether it has arisen yet.
 */
export function decideInputVat(input: InputVatInput): InputVatDecision {
  const { expenses, fiscalYear, asOfDate } = input;
  const registration = input.registration ?? null;
  const effective = registrationEffectiveDate(registration, input.vatExceedanceDate);
  const proRata = input.proRataYears?.find((p) => p.fiscalYear === fiscalYear);

  const lines: InputVatLine[] = [];

  for (const e of expenses) {
    const tvaBani = leiOf(e.tva);
    if (tvaBani === null) {
      lines.push({ id: e.id, tvaBani: lei(0), outcome: { kind: 'unresolved', reason: 'record_neconvertit' }, vehicle: false, preRegistrationAdjustment: false });
      continue;
    }

    const facts = e.vatFacts ?? {};
    const vehicleFacts = vehicleYearVatFacts(input.vehicles, e.vehicleId, fiscalYear);
    const isVehicle = vehicleFacts !== null;
    const preRegistration =
      facts.preRegistration === 'da' ||
      (effective !== null && e.date < effective.date);

    // 1. Registration. §6 row 1: no right at all in the art. 310 regime.
    if (registration === null) {
      lines.push({ id: e.id, tvaBani, outcome: { kind: 'unresolved', reason: 'destinatie_nedeclarata' }, vehicle: isVehicle, preRegistrationAdjustment: false });
      continue;
    }
    if (registration.status === 'scutit_art310') {
      lines.push({ id: e.id, tvaBani, outcome: { kind: 'zero', reason: 'fara_drept_nicio_inregistrare', rule: 'art. 310 alin. (10) lit. a)' }, vehicle: isVehicle, preRegistrationAdjustment: false });
      continue;
    }
    if (registration.status === 'inregistrare_anulata') {
      lines.push({ id: e.id, tvaBani, outcome: { kind: 'zero', reason: 'cod_anulat_perioada', rule: 'Norme pct. 11 alin. (6)' }, vehicle: isVehicle, preRegistrationAdjustment: false });
      continue;
    }

    // 2. The supplier. §6 rows 22 and 23.
    if (facts.supplierRegime === 'scutit_art310') {
      lines.push({ id: e.id, tvaBani, outcome: { kind: 'zero', reason: 'furnizor_art310', rule: 'art. 310 alin. (10) lit. b); Norme pct. 83 alin. (15)' }, vehicle: isVehicle, preRegistrationAdjustment: false });
      continue;
    }
    if (facts.supplierRegime === 'cod_anulat') {
      lines.push({ id: e.id, tvaBani, outcome: { kind: 'zero', reason: 'furnizor_cod_anulat', rule: 'art. 11 alin. (7)-(9)' }, vehicle: isVehicle, preRegistrationAdjustment: false });
      continue;
    }
    if (facts.supplierRegime === undefined || facts.supplierRegime === 'nedeclarat') {
      lines.push({ id: e.id, tvaBani, outcome: { kind: 'unresolved', reason: 'furnizor_nedeclarat' }, vehicle: isVehicle, preRegistrationAdjustment: false });
      continue;
    }

    // 3. Absolute bars on the goods. §6 row 18.
    if (facts.alcoholOrTobacco === 'da') {
      if (facts.forResale === 'da') {
        // Resale is the carve-out; the bar does not bite. Falls through to the destination test.
      } else if (facts.forResale === undefined) {
        lines.push({ id: e.id, tvaBani, outcome: { kind: 'unresolved', reason: 'destinatie_nedeclarata' }, vehicle: isVehicle, preRegistrationAdjustment: false });
        continue;
      } else {
        lines.push({ id: e.id, tvaBani, outcome: { kind: 'zero', reason: 'alcool_tutun_fara_revanzare', rule: 'art. 297 alin. (7) lit. b)' }, vehicle: isVehicle, preRegistrationAdjustment: false });
        continue;
      }
    }

    // 4. Destination. §6 rows 2, 3, 4, 5.
    const destination = facts.destination ?? 'nedeclarata';
    if (destination === 'nedeclarata') {
      lines.push({ id: e.id, tvaBani, outcome: { kind: 'unresolved', reason: 'destinatie_nedeclarata' }, vehicle: isVehicle, preRegistrationAdjustment: false });
      continue;
    }
    if (destination === 'scutita_fara_drept') {
      lines.push({ id: e.id, tvaBani, outcome: { kind: 'zero', reason: 'destinatie_fara_drept', rule: 'art. 300 alin. (4)' }, vehicle: isVehicle, preRegistrationAdjustment: false });
      continue;
    }

    // 5. The vehicle restriction. §6 rows 7, 8, 9, 10.
    let fraction = 1;
    let rule = 'art. 297 alin. (4) lit. a); art. 300 alin. (3)';
    if (vehicleFacts !== null) {
      const outsideBySize =
        (vehicleFacts.massMaxKg !== undefined && vehicleFacts.massMaxKg > VAT_VEHICLE_MASS_KG_LIMIT) ||
        (vehicleFacts.seats !== undefined && vehicleFacts.seats > VAT_VEHICLE_SEATS_LIMIT);
      if (outsideBySize) {
        // §6 row 9 — alin. (2): a second, separate 100 % route. The restriction does not apply at all.
        rule = 'art. 298 alin. (2)';
      } else if (vehicleFacts.exceptionCategory !== undefined) {
        // §6 row 10 — alin. (3) a)-f). For b)-f) personal use is „considerată neglijabilă" absent an
        // abusive practice (Norme pct. 68 alin. (5)); for lit. a) exclusive use is mandatory.
        rule = 'art. 298 alin. (3)';
      } else if (vehicleFacts.use === 'not_used') {
        // `not_used` is not `mixed`. art. 300 alin. (4): „nu se deduce" — zero, not 50 %.
        lines.push({ id: e.id, tvaBani, outcome: { kind: 'zero', reason: 'vehicul_neutilizat', rule: 'art. 300 alin. (4)' }, vehicle: true, preRegistrationAdjustment: preRegistration });
        continue;
      } else if (vehicleFacts.use === 'exclusive' && vehicleFacts.logbook === 'da') {
        // §6 row 8 — full deduction needs the *foaie de parcurs*; four minimum fields (Norme pct. 68 alin. (2)).
        rule = 'art. 298 alin. (4); Norme pct. 68 alin. (2)';
      } else if (vehicleFacts.use === 'exclusive' && vehicleFacts.logbook !== 'da') {
        // Exclusive use claimed without the logbook: full deduction is the thing that must be evidenced,
        // so the unevidenced case falls to the statutory 50 % — and the 50 % branch needs no logbook
        // (Norme pct. 68 alin. (4)), so this is a settled 50 %, not an unresolved line.
        fraction = 0.5;
        rule = 'art. 298 alin. (1); Norme pct. 68 alin. (4)';
      } else {
        // §6 row 7 — `mixed`, `unknown` or no use fact at all: „nu sunt utilizate exclusiv în scopul
        // activității economice" is satisfied, the 50 % cut applies, and no *foaie de parcurs* is needed.
        fraction = 0.5;
        rule = 'art. 298 alin. (1); Norme pct. 68 alin. (4)';
      }
    }

    // 6. Mixed destination: the pro rata. §6 row 5. No de-minimis exists in Romanian art. 300.
    if (destination === 'mixta') {
      if (proRata === undefined) {
        lines.push({ id: e.id, tvaBani, outcome: { kind: 'unresolved', reason: 'pro_rata_nedeclarat' }, vehicle: isVehicle, preRegistrationAdjustment: preRegistration });
        continue;
      }
      fraction = Math.min(fraction, proRata.percent / 100);
      rule = 'art. 300 alin. (5)-(14)';
    }

    // 7. The document. §6 rows 14, 15, 16, 17. Never the strict view as a rule.
    const documentKind = facts.documentKind ?? 'nedeclarat';
    if (documentKind === 'nedeclarat') {
      lines.push({ id: e.id, tvaBani, outcome: { kind: 'unresolved', reason: 'document_nedeclarat' }, vehicle: isVehicle, preRegistrationAdjustment: preRegistration });
      continue;
    }
    if (documentKind === 'simplificata_100_400_eur') {
      lines.push({ id: e.id, tvaBani, outcome: { kind: 'unresolved', reason: 'document_simplificata_100_400_eur' }, vehicle: isVehicle, preRegistrationAdjustment: preRegistration });
      continue;
    }
    if (documentKind === 'factura') {
      const domesticB2B = e.tip === 'factura' && (e.supplierCui ?? '').trim() !== '';
      if (domesticB2B && facts.eFactura !== 'da') {
        lines.push({
          id: e.id,
          tvaBani,
          outcome: {
            kind: 'unresolved',
            reason: facts.eFactura === 'nu' ? 'document_fara_e_factura' : 'document_nedeclarat',
          },
          vehicle: isVehicle,
          preRegistrationAdjustment: preRegistration,
        });
        continue;
      }
    }
    if (
      documentKind === 'simplificata_sub_100_eur' &&
      facts.preRegistration !== 'da' &&
      facts.buyerVatCodeOnDocument !== 'da'
    ) {
      // §6 row 15 — a fiscal receipt or simplified invoice up to 100 euro supports deduction only with
      // the buyer's VAT code on it. Without the code the condition is unmet; with no answer at all the
      // app does not assume either way, it parks the line.
      lines.push({ id: e.id, tvaBani, outcome: { kind: 'unresolved', reason: 'document_simplificata_fara_cod_cumparator' }, vehicle: isVehicle, preRegistrationAdjustment: preRegistration });
      continue;
    }

    // 8. TVA la încasare — the deferral, in both directions. Keyed on the payment date.
    const notImportOrReverseCharge = documentKind !== 'vamal_sau_autofactura';
    if (notImportOrReverseCharge) {
      const unpaid = e.paid === undefined || e.paid === '' || e.paid > asOfDate;
      if (unpaid && registration.cashAccounting === 'da') {
        lines.push({ id: e.id, tvaBani, outcome: { kind: 'deferred', reason: 'plata_ammnata_regim_propriu' }, vehicle: isVehicle, preRegistrationAdjustment: preRegistration });
        continue;
      }
      if (unpaid && facts.supplierCashAccounting === 'da') {
        lines.push({ id: e.id, tvaBani, outcome: { kind: 'deferred', reason: 'plata_ammnata_furnizor' }, vehicle: isVehicle, preRegistrationAdjustment: preRegistration });
        continue;
      }
    }

    lines.push({
      id: e.id,
      tvaBani,
      outcome: { kind: 'claimable', fraction, rule },
      vehicle: isVehicle,
      preRegistrationAdjustment: preRegistration,
    });
  }

  const claimable = lines
    .filter((l) => l.outcome.kind === 'claimable')
    .reduce((acc, l) => addBani(acc, floorPercent(l.tvaBani, (l.outcome as { fraction: number }).fraction * 100)), lei(0));

  const nonRecoverable = lines
    .filter((l) => l.outcome.kind === 'zero')
    .reduce((acc, l) => addBani(acc, l.tvaBani), lei(0));

  return {
    fiscalYear,
    asOfDate,
    registration,
    registrationDeclared: registration !== null,
    lines,
    claimableTotal: claimable,
    nonRecoverableTotal: nonRecoverable,
    unresolved: lines.filter((l) => l.outcome.kind === 'unresolved'),
    deferred: lines.filter((l) => l.outcome.kind === 'deferred'),
    zero: lines.filter((l) => l.outcome.kind === 'zero'),
  };
}

/**
 * The two candidate expense bases, computed over the records that actually reached the deductible set.
 *
 * `capped` is the income-tax half-count (art. 68 alin. (7) lit. k) at 50 %). Where such a line also
 * carries VAT the taxpayer could not claim back, the ordering changes the figure and D-VAT-2 says the
 * app computes neither. Where no line is both capped and VAT-burdened, the two totals are equal and the
 * engine runs on that number.
 *
 * A line whose VAT outcome is **unresolved** contributes no VAT to either base. Adding an amount whose
 * recoverability the app has not decided would mint a cost the person may in fact have recovered; the
 * line itself still enters both bases at its net, so it is never dropped.
 */
/**
 * The two candidate expense bases D-VAT-2 keeps apart, plus the flag that says whether the choice can
 * change the figure at all. Named as a type so the engine's operand and the assembler's output cannot
 * drift into two spellings of one idea.
 */
export interface ExpenseBaseWithVat {
  /** A half-count rule measured on the VAT-exclusive amount. */
  netFirst: Bani;
  /** The same rule measured over the amount including the VAT that could not be claimed back. */
  grossFirst: Bani;
  /** True when the two differ — i.e. a half-count rule met non-recoverable VAT. Compute neither. */
  divergent: boolean;
}

/**
 * The two candidate expense bases, expressed as what the VAT decision **adds** to the expense measure the
 * assembler already struck, so the adjustment composes with the annual-ceiling pass instead of replacing it.
 *
 * `capped` is the income-tax half-count (art. 68 alin. (7) lit. k) at 50 %). Where such a line also
 * carries VAT the taxpayer could not claim back, the ordering changes the figure and D-VAT-2 says the app
 * computes neither. Where no line is both capped and VAT-burdened, the two totals are equal and the engine
 * runs on that number.
 *
 * The records handed in are the ones that reached the deductible set **after** the per-expense cap, which
 * is what makes reading B come out right without re-deriving any percentage here: a capped line's `tva`
 * is already the capped amount, so adding it is exactly the Titlul II worked example — 50 % of (1.000 +
 * 190) = 595, reached here as 500 + 95.
 *
 * A line whose VAT outcome is **unresolved** contributes nothing to either base. Adding an amount whose
 * recoverability the app has not decided would mint a cost the person may in fact have recovered; the
 * line itself still enters both bases at its net, so it is never dropped.
 */
export function applyVatToExpenseBase(
  decision: InputVatDecision,
  expenseMeasure: Bani,
  deductible: readonly { id: string; tva: Bani; capped: boolean }[],
): ExpenseBaseWithVat {
  const decidedZero = new Set<string>();
  for (const line of decision.lines) {
    if (line.outcome.kind === 'zero') decidedZero.add(line.id);
  }
  let addedUncapped = lei(0);
  let addedCapped = lei(0);
  for (const record of deductible) {
    if (!decidedZero.has(record.id)) continue;
    if (record.capped) addedCapped = addBani(addedCapped, record.tva);
    else addedUncapped = addBani(addedUncapped, record.tva);
  }
  const netFirst = addBani(expenseMeasure, addedUncapped);
  const grossFirst = addBani(netFirst, addedCapped);
  return { netFirst, grossFirst, divergent: netFirst !== grossFirst };
}

/**
 * The clawback question, §6 rows 20 and 21.
 *
 * art. 305 alin. (2) adjusts a capital good over 5 years (movables) or 20 (immovables) when its
 * destination changes — but alin. (4) lit. a) pct. 1 excepts „bunurilor a căror achiziție face obiectul
 * limitării la 50 % … potrivit prevederilor art. 298". **A vehicle already under the 50 % VAT limit is
 * not clawed back when it moves to personal use.** That exception is the whole reason this function
 * exists: without it the app would invent an adjustment the law withholds.
 */
export function capitalGoodClawback(input: {
  isCapitalGood: boolean;
  immovable: boolean;
  alreadyUnderFiftyPercentArt298: boolean;
}): { years: number; annualShare: Decimal } | null {
  if (!input.isCapitalGood) return null;
  if (input.alreadyUnderFiftyPercentArt298) return null;
  const years = input.immovable ? 20 : 5;
  return { years, annualShare: new Decimal(1).div(years) };
}

/** Sum of a list of lei amounts. Kept here so no surface re-adds `Bani` with `+`. */
export function sumVatBani(values: readonly Bani[]): Bani {
  return sumBani(values);
}
