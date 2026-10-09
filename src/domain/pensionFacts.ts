/**
 * TASK 5 — the pension / CASS-exception fact readers.
 *
 * One home for the question "what does the profile actually record about pensions, for THIS fiscal
 * year, and what may the app conclude from it". Both read paths (the engine, through
 * `TaxInputsReference`, and the threshold layer, through the raw `PfaProfile`) go through these
 * functions, so the two can never disagree about which fact a provision keys on.
 *
 * The legal basis is `docs/ai/research/25_pension_cass_exception_2026.md`. Its closing sections name
 * the four levers a single `pensionStatus` boolean used to conflate:
 *
 * | Provision              | Keys on                                            | Switches off |
 * |------------------------|----------------------------------------------------|--------------|
 * | art. 174 alin. (7) lit. c) | pension sums RECEIVED in the fiscal year, any amount | only the art. 174 alin. (6) top-up |
 * | art. 174 alin. (8)     | art. 154 alin. (1) lit. a)/b)/e)/f) or an art. 180 alin. (1) option, in the PREVIOUS year | the same top-up |
 * | art. 150 alin. (1)     | *calitatea de pensionar*                            | CAS entirely |
 * | art. 153 alin. (2)     | foreign sickness/maternity insurance, held AND proved | CASS taxpayer quality entirely |
 *
 * Every reader returns a `FactState`. `unknown` is a real answer, produced whenever the profile does
 * not hold the fact the provision tests — it is never collapsed into `nu`, because absence of a fact
 * is not evidence that the fact is false.
 */
import type {
  CassPreviousYearContext,
  FactState,
  ForeignSicknessInsurance,
  PensionReceiptYear,
  PensionSuspensionYear,
  PfaPensionStatus,
} from './models';

/**
 * The fields these readers need. `PfaProfile` (optional fields) and `TaxInputsReference` (`| null`
 * fields) both satisfy it structurally, which is what keeps the engine path and the threshold path
 * reading the same facts off different carriers.
 */
export interface PensionFactFields {
  pensionerStatus?: PfaPensionStatus | null;
  pensionReceiptYears?: readonly PensionReceiptYear[] | null;
  pensionSuspensionYears?: readonly PensionSuspensionYear[] | null;
  cassPreviousYearContext?: CassPreviousYearContext | null;
  foreignSicknessInsurance?: ForeignSicknessInsurance | null;
}

/**
 * Surfaced wherever a pension suspension is recorded for the year, so the fact is visible WITHOUT a
 * legal consequence being attached to it. Research 25 gap 1: no Cod fiscal, HG 1/2016 or OPANAF
 * provision addresses suspension for art. 174 alin. (7) — the app records and stops.
 */
export const PENSION_SUSPENSION_NOTE =
  'Pensia a fost suspendată în lunile consemnate pentru acest an fiscal. Fapta este înregistrată, iar '
  + 'efectul ei juridic nu este stabilit: nicio prevedere verificată (Cod fiscal, HG 1/2016, OPANAF '
  + '2.736/2025) nu reglementează suspendarea în legătură cu art. 174 alin. (7) din Codul fiscal. '
  + 'Aplicația nu trage nicio concluzie din aceste luni.';

/**
 * Produced when the profile records *calitatea de pensionar* but does not record whether pension sums
 * were received in the year — exactly the state every payload written before TASK 5 lands in after
 * migration. The relief may then be neither granted nor refused: art. 174 alin. (7) lit. c) tests the
 * receipt („sume primite ca pensii", art. 99 alin. (1)), and a status is not that fact.
 */
export const PENSION_RECEIPT_GAP_NOTE =
  'Profilul consemnează calitatea de pensionar, dar nu conține fapta „sume primite ca pensii” pentru '
  + 'acest an fiscal. art. 174 alin. (7) lit. c) din Codul fiscal nu se decide pe statut, ci pe '
  + 'încasarea din anul fiscal (art. 99 alin. (1)), iar alin. (8) nu extinde excepția la pensionari. '
  + 'Excepția nu poate fi nici acordată, nici refuzată pe baza statutului.';

/**
 * CF art. 150 alin. (1) — *calitatea de pensionar*. This is the CAS key, and the only place a pension
 * STATUS is the right key in this area of the code.
 *
 * Absence is reported as `unknown`; the caller decides what an unrecorded status means. For CAS the
 * exemption is an exception to an obligation that exists by default, so only a recorded `da` switches
 * anything off — see `calcCas` and `applicabilityFor`.
 */
export function readPensionerStatus(fields: PensionFactFields): FactState {
  const status = fields.pensionerStatus;
  return status === 'da' || status === 'nu' ? status : 'unknown';
}

/**
 * CF art. 174 alin. (7) lit. c) — were pension sums received in `fiscalYear`?
 *
 * Year-scoped on purpose: a receipt recorded for another year says nothing about this one, and a
 * person who was not a pensioner all year but received pension sums in it DOES qualify, while a
 * pensioner who received none does not.
 *
 * No amount is consulted anywhere in this function. lit. c) carries no monetary qualifier; lit. a) and
 * lit. b) do, and they are evaluated where their own amounts live.
 */
export function readPensionSumsReceived(fields: PensionFactFields, fiscalYear: number): FactState {
  const entry = (fields.pensionReceiptYears ?? []).find((r) => r.fiscalYear === fiscalYear);
  return entry === undefined ? 'unknown' : entry.received;
}

/** The suspension record for one fiscal year, if the profile holds one. */
export function readPensionSuspension(
  fields: PensionFactFields,
  fiscalYear: number,
): PensionSuspensionYear | undefined {
  return (fields.pensionSuspensionYears ?? []).find((s) => s.fiscalYear === fiscalYear);
}

/**
 * CF art. 174 alin. (8) lit. a) — was the person in an art. 154 alin. (1) lit. a)/b)/e)/f) category in
 * the PREVIOUS year?
 *
 * The year is checked, not assumed: a record attributed to any year other than `fiscalYear` − 1 is not
 * the fact alin. (8) asks for, so it yields `unknown` rather than an answer. Pensioners are NOT in that
 * list, so this can never be derived from `pensionerStatus`.
 */
export function readPreviousYearExceptedCategory(
  fields: PensionFactFields,
  fiscalYear: number,
): FactState {
  const ctx = fields.cassPreviousYearContext;
  if (!ctx || ctx.previousFiscalYear !== fiscalYear - 1) return 'unknown';
  return ctx.inExceptedCategory ?? 'unknown';
}

/** CF art. 174 alin. (8) lit. b) — an art. 180 alin. (1) option exercised in the PREVIOUS year. */
export function readPreviousYearArt180Option(fields: PensionFactFields, fiscalYear: number): FactState {
  const ctx = fields.cassPreviousYearContext;
  if (!ctx || ctx.previousFiscalYear !== fiscalYear - 1) return 'unknown';
  return ctx.optedUnderArt180Alin1 ?? 'unknown';
}

/**
 * CF art. 153 alin. (2) — foreign sickness/maternity insurance, held AND proved.
 *
 * `da` requires both halves, because the article does: the insurance must exist and its validity must
 * be „dovedită”. Holding it without proving it is not the exemption, and it is reported as `unknown`
 * (the proof may exist and simply not be recorded) rather than as `nu`.
 */
export function readForeignSicknessInsuranceProved(
  fields: PensionFactFields,
  fiscalYear: number,
): FactState {
  const fsi = fields.foreignSicknessInsurance;
  if (!fsi || fsi.fiscalYear !== fiscalYear) return 'unknown';
  if (fsi.held === 'nu' || fsi.proved === 'nu') return 'nu';
  if (fsi.held === 'da' && fsi.proved === 'da') return 'da';
  return 'unknown';
}

/** Everything the art. 174 alin. (6) top-up decision needs to know about pensions, for one year. */
export interface CassExceptionFacts {
  /** art. 174 alin. (7) lit. c) — pension sums received in the fiscal year. */
  pensionSumsReceived: FactState;
  /** art. 174 alin. (8) lit. a) — an art. 154 alin. (1) lit. a)/b)/e)/f) category, previous year. */
  previousYearExceptedCategory: FactState;
  /** art. 174 alin. (8) lit. b) — an art. 180 alin. (1) option, previous year. */
  previousYearArt180Option: FactState;
  /** art. 153 alin. (2) — foreign sickness/maternity insurance, held and proved. */
  foreignSicknessInsuranceProved: FactState;
  /** Non-null when a suspension is recorded for the year: a fact, with no consequence attached. */
  suspensionNote: string | null;
  /** Non-null when pensioner status is recorded but the year's receipt fact is missing. */
  receiptGapNote: string | null;
}

/**
 * Read the whole pension side of the art. 174 alin. (6) decision for one fiscal year.
 *
 * The two `*Note` fields are how a withheld conclusion travels with the facts instead of being
 * decided away: the caller renders them, and nothing in this module turns either one into a verdict.
 */
export function readCassExceptionFacts(fields: PensionFactFields, fiscalYear: number): CassExceptionFacts {
  const pensionSumsReceived = readPensionSumsReceived(fields, fiscalYear);
  const suspension = readPensionSuspension(fields, fiscalYear);
  return {
    pensionSumsReceived,
    previousYearExceptedCategory: readPreviousYearExceptedCategory(fields, fiscalYear),
    previousYearArt180Option: readPreviousYearArt180Option(fields, fiscalYear),
    foreignSicknessInsuranceProved: readForeignSicknessInsuranceProved(fields, fiscalYear),
    suspensionNote: suspension && suspension.months.length > 0 ? PENSION_SUSPENSION_NOTE : null,
    // The gap is specifically "a pensioner, and no answer at all for this year". A recorded `nu` is an
    // answer — the person did not receive pension sums — and needs no withheld-conclusion note.
    receiptGapNote:
      readPensionerStatus(fields) === 'da' && pensionSumsReceived === 'unknown' ? PENSION_RECEIPT_GAP_NOTE : null,
  };
}
