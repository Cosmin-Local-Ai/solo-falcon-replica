import { z } from 'zod';
import { isoCalendarDateProblem } from '../domain/date';
import { parsePfaProfile } from '../domain/schema';
import type { PfaProfile } from '../domain/models';
import type { Bani, Money } from '../domain/money';
import { CURRENCY_CODES } from '../domain/money';
import { fxRateRecordSchema, type FxRateRecord } from '../domain/fx/rates';
import type { MoneyPrecisionNotice } from './migration';
import type { RuleRelease } from '../domain/fiscal/rules';
import { EXPENSE_CATEGORIES, VEHICLE_EXCEPTION_CATEGORIES, VEHICLE_USE_VALUES } from '../domain/fiscal/deductibility';
import type { VehicleYearFacts } from '../domain/fiscal/deductibility';
// PG-6f (B-30) — the VAT fact vocabularies, imported rather than restated, for the same reason as the
// deductibility lists above: the persisted token space and the decision layer must be one spelling.
import {
  VAT_DESTINATION_VALUES,
  VAT_DOCUMENT_KIND_VALUES,
  VAT_EFACTURA_VALUES,
  VAT_SUPPLIER_REGIME_VALUES,
  VAT_VEHICLE_EXCEPTION_VALUES,
  VAT_YES_NO_VALUES,
} from '../domain/fiscal/vat';
import type { ExpenseVatFacts, VatVehicleYearFacts } from '../domain/fiscal/vat';
import type { TaxCalculationSnapshot } from '../domain/snapshots/types';
import type {
  AnnualFiling,
  Client,
  CompanyDocument,
  DocTypeCode,
  DocumentItem,
  Expense,
  OccupancySheet,
  OccupancyStay,
  Revenue,
  SettingsState,
  TaxStatement,
  Vehicle,
  FixedAsset,
  VatReturnRecord,
} from './types';

/**
 * Zod schemas for the persisted application dataset (localStorage).
 *
 * Each collection schema's output type is exactly the existing domain type —
 * verified at compile time by the `Equal` assertions at the bottom of this
 * file. `parseAppData` is the single entry point used by the load path:
 * it returns a validated `PersistedAppData`, or `null` when the stored
 * payload is corrupt (bad JSON, wrong types, invalid numbers, missing
 * required collections, invalid profile / settings / snapshots).
 *
 * Optional collections (`profile`, `snapshots`, and the secondary
 * collections) are tolerated as missing — the load path backfills them.
 * `revenues` and `settings` are the required core of the dataset.
 */

const nonEmptyString = z.string().min(1);
const nonNegative = z.number().min(0);

/**
 * Phase 10: stored money is an integer number of **bani**.
 *
 * The gate deliberately stays **permissive about integrality**: `safeParse` runs *before* the migration
 * chain, so a `v4` payload still holds float lei (`85.5`, `142.5`). An `.int()` here would reject every
 * pre-migration payload and quarantine the user's data instead of converting it. Integer-ness is enforced
 * after migration, in the domain (`domain/money.ts` throws on a non-integer), and asserted by test.
 *
 * The `transform` is a type-level cast, not a runtime conversion. It exists because the
 * `Expect<Equal<z.output<…>, Revenue>>` assertions at the bottom of this file force the zod output and the
 * domain type to be the *same* type, so both sides of the boundary have to move together — that is the
 * drift guard, and it is why this file cannot be left in lei while the domain is in bani.
 */
const bani = (schema: z.ZodNumber = nonNegative) => schema.transform((n) => n as Bani);

/**
 * TASK 10a (B-32): a record's money field is a `Money` — an integer minor-unit count **and** the
 * currency it is counted in.
 *
 * The gate accepts the pre-v10 shape (a bare number) as well, and it deliberately does **not** convert
 * it. Two reasons, both load-bearing:
 *
 * 1. `safeParse` runs **before** the migration chain. If the gate wrapped `674.504` into
 *    `{ amount: 674.504, currency: 'RON' }`, the v4→v5 `money-bani` step would receive an object where
 *    it expects lei, report it as `non-finite`, and the precision notice the user sees would name
 *    `[object Object]` instead of the value that was actually stored.
 * 2. A gate that converts is a gate that decides. The shape change belongs to the named chain step
 *    (`record-currency`), which is where a migration decision is recorded and reviewable.
 *
 * So the `transform` is a **type-level cast and nothing else** — the same device `bani()` uses — and it
 * exists because the `Expect<Equal<…>>` assertions at the bottom of this file force the zod output and
 * the domain type to be the same type. Integer-ness and currency-ness are enforced after migration, in
 * the domain (`requireRon`/`sumMoney` throw), and asserted by test.
 */
const moneyObjectSchema = z.object({
  // `nonNegative`, exactly like the bare-number branch it sits beside in the union. A negative amount is
  // corrupt money whichever shape it arrives in, and `parseAppData` must quarantine it rather than load it
  // — the same rule `bani()` enforces on the pre-v10 number.
  amount: bani(nonNegative),
  currency: z.enum(CURRENCY_CODES),
});
const moneyField = (schema: z.ZodNumber = nonNegative) =>
  z.union([schema, moneyObjectSchema]).transform((v) => {
    // SAFETY: identity at runtime — this cast converts nothing. The union's two branches are exactly the
    // two shapes the field can hold: a pre-v10 bare number (lei or bani, depending on how far the chain has
    // run) and a post-v10 `{ amount, currency }`. `Money` is the type of the payload the chain ends at, and
    // `record-currency` is the only step allowed to move a value between the two. The invariant TypeScript
    // cannot check is that no consumer reads `.currency` off a payload that has not been through the chain:
    // the load path always runs it, and `requireRon` throws rather than misread a bare number as lei.
    return v as unknown as Money;
  });

export const revenueSchema = z.object({
  id: nonEmptyString,
  tip: z.enum(['factura', 'notafactura']),
  nr: z.string(),
  date: z.string(),
  // Phase 9: the fiscal date for a revenue is the date it was COLLECTED (CF art. 68 alin. (2) lit. a).
  // Optional — a legacy payload has only `date`, and no migration invents this value.
  collected: z.string().optional(),
  client: z.string(),
  cui: z.string(),
  valoareFaraTva: moneyField(),
  tva: moneyField(),
  status: z.enum(['inregistrata', 'in-asteptare', 'respinsa']),
  statusDetail: z.string().optional(),
  eFacturaStatus: z.enum(['Acceptată', 'În așteptare', 'Respinsă']).optional(),
});

export const expenseSchema = z.object({
  id: nonEmptyString,
  tip: z.enum(['factura', 'bon-fiscal']),
  nr: z.string(),
  date: z.string(),
  // Phase 9: the fiscal date for an expense is the date it was PAID (CF art. 68 alin. (4) lit. b).
  // Optional — a legacy payload has only `date`, and no migration invents this value.
  paid: z.string().optional(),
  furnizor: z.string(),
  cui: z.string(),
  valoareFaraTva: moneyField(),
  tva: moneyField(),
  status: z.enum(['inregistrata', 'respinsa']),
  statusDetail: z.string().optional(),
  // TASK 2b: the deductibility category (CF art. 68). Declared here as well as on `Expense` because
  // zod STRIPS undeclared keys — an undeclared category would be erased on the next load, which is
  // how the `moneyNotices` report and the identity fields had to be handled (see the notes above).
  // Optional, never nullable, never defaulted: a payload written before v6 has no category, and the
  // v5→v6 step does not invent one. The vocabulary is `EXPENSE_CATEGORIES`, the same list the
  // classifier reads, so the persisted token space and the rule space cannot drift apart.
  category: z.enum(EXPENSE_CATEGORIES).optional(),
  // PG-6c (D-VEH-3): which vehicle this running cost belongs to. Declared because **zod strips
  // undeclared keys** — an undeclared link would be erased on the next load and the expense would
  // silently become unattributed. Optional and never defaulted: the v14→v15 step invents no vehicle and
  // attributes nothing, exactly as v6 did for `category`.
  vehicleId: z.string().optional(),
  // PG-6f (B-30): the per-line input-VAT facts. Declared because **zod strips undeclared keys** — an
  // undeclared block would be erased on the next load and the line would silently fall back to
  // „unresolved”. Every inner field is `.optional()` with no `.default()` anywhere: an absent answer is
  // an unresolved line, and a default would answer a question the person never answered. That is the
  // defect class the retired `vatExempt` boolean used to settle for a whole register at once.
  vatFacts: z
    .object({
      destination: z.enum(VAT_DESTINATION_VALUES).optional(),
      supplierRegime: z.enum(VAT_SUPPLIER_REGIME_VALUES).optional(),
      supplierCashAccounting: z.enum(VAT_YES_NO_VALUES).optional(),
      alcoholOrTobacco: z.enum(VAT_YES_NO_VALUES).optional(),
      forResale: z.enum(VAT_YES_NO_VALUES).optional(),
      documentKind: z.enum(VAT_DOCUMENT_KIND_VALUES).optional(),
      eFactura: z.enum(VAT_EFACTURA_VALUES).optional(),
      buyerVatCodeOnDocument: z.enum(VAT_YES_NO_VALUES).optional(),
      preRegistration: z.enum(VAT_YES_NO_VALUES).optional(),
    })
    .optional(),
});

/**
 * PG-6c (D-VEH-3): one car's declared facts for one fiscal year.
 *
 * Every field is `.optional()` with **no `.default()` anywhere**, and the vocabulary is imported from
 * `domain/fiscal/deductibility.ts` rather than restated here, so the persisted token space and the
 * classifier cannot drift. A default on any of these would be a legal assertion, not a convenience: a
 * `usedByPerson` default would move a car inside or outside art. 68 alin. (5) lit. j), and a
 * `designatedForRunningCosts` default would pick the one car the allowance follows — the exact selection
 * `docs/ai/research/40_vehicle_one_car_limit.md` §1 records that no primary source supports.
 */
export const vehicleYearFactsSchema = z.object({
  fiscalYear: z.number().int().min(1990).max(2100),
  use: z.enum(['exclusive', 'mixed', 'not_used', 'unknown']).optional(),
  exceptionCategory: z.enum(VEHICLE_EXCEPTION_CATEGORIES).optional(),
  usedByPerson: z.enum(['da', 'nu']).optional(),
  designatedForRunningCosts: z.enum(['da', 'nu']).optional(),
});

/**
 * PG-6f: one car's declared VAT facts for one fiscal year (art. 298 alin. (1)-(3), Norme pct. 68).
 *
 * `use` deliberately reuses `VEHICLE_USE_VALUES`: art. 298 alin. (1) and art. 68 alin. (7) lit. k) ask
 * the same factual question („nu sunt utilizate exclusiv …”), and a third spelling of one fact is the
 * B-70 defect class. What differs is the consequence and the evidence rule, and those stay in the two
 * layers. No `.default()` on any field: MTMA and seats decide whether art. 298 alin. (2) puts the vehicle
 * outside the restriction altogether, and a minted number would move a car across that line.
 */
export const vatVehicleYearFactsSchema = z.object({
  fiscalYear: z.number().int().min(1990).max(2100),
  use: z.enum(VEHICLE_USE_VALUES).optional(),
  exceptionCategory: z.enum(VAT_VEHICLE_EXCEPTION_VALUES).optional(),
  massMaxKg: z.number().int().min(0).optional(),
  seats: z.number().int().min(0).optional(),
  logbook: z.enum(VAT_YES_NO_VALUES).optional(),
});

export const vehicleSchema = z.object({
  id: nonEmptyString,
  // The person's own name for the car. Required because an unlabelled car cannot be designated, refused
  // or recognised in a refusal sentence — every place the app names a car names this string.
  label: nonEmptyString,
  plate: z.string().optional(),
  years: z.array(vehicleYearFactsSchema),
  // PG-6f — the car's VAT facts, a SEPARATE array from `years`. Two provisions, two category lists: the
  // income-tax list has five members (`VEHICLE_EXCEPTION_CATEGORIES`), the VAT list six
  // (`VAT_VEHICLE_EXCEPTION_VALUES`, the extra one being art. 298 alin. (3) lit. e). Merging the arrays
  // would make a financial lease — 100 % for VAT, 50 % for income tax — unrepresentable.
  vatYears: z.array(vatVehicleYearFactsSchema).optional(),
});

export const clientSchema = z.object({
  id: nonEmptyString,
  denumire: nonEmptyString,
  cui: z.string(),
  email: z.string().optional(),
  telefon: z.string().optional(),
  oras: z.string().optional(),
});

/**
 * PG-5b: the pre-v11 monthly row, as a STORED payload carries it. This is a storage shape, not an
 * application record — nothing in the app reads one, no page renders one, and no domain function takes
 * one. `Declaration` is gone from `data/types.ts` for that reason.
 *
 * The schema stays, and the key stays declared in `persistedAppDataSchema`, for one reason: **zod strips
 * undeclared keys**. A payload whose `declarations` key were stripped at the load gate would lose its
 * monthly rows before the migration chain ran, and then the `annual-filing` step would not be the thing
 * that dropped them — the gate would. The step is the thing with a documented decision, so the rows have
 * to reach it. They stop there: the v10→v11 step drops them.
 */
export const declarationSchema = z.object({
  id: nonEmptyString,
  an: z.number().int(),
  luna: z.number().int().min(1).max(12),
  venituri: bani(),
  cheltuieli: bani(),
  status: z.enum(['inregistrata', 'in-asteptare', 'transmisa', 'respinsa']),
  dataInregistrare: z.string(),
  dataTrimitere: z.string().optional(),
});

/** The row type is derived from the schema, so there is exactly one definition of a shape nothing uses. */
export type LegacyMonthlyDeclaration = z.output<typeof declarationSchema>;

/**
 * PG-5 (B-34): the annual return. `taxYear` is the year the return DECLARES, so the FY2026 return
 * carries `taxYear: 2026` and a `filedOn` in 2027 — the shape a monthly `{an, luna}` record could not
 * hold, which is the whole of B-34.
 *
 * `status` is deliberately NOT the monthly `DeclStatus`: `depusa` is the only value that says a filing
 * happened, and keeping the two vocabularies apart is what stops a monthly `'inregistrata'` row from
 * being read as proof of a submission.
 */
export const annualFilingSchema = z.object({
  id: nonEmptyString,
  taxYear: z.number().int(),
  form: z.enum(['D212']),
  status: z.enum(['in_pregatire', 'depusa', 'respinsa']),
  filedOn: z.string().optional(),
  reference: z.string().optional(),
});

/**
 * PG-6g — the periodic VAT return (formular 300, OPANAF 174/2026, MO I 105/09.02.2026).
 *
 * `status` is deliberately **not** `FilingStatus` and not the retired monthly `DeclStatus`. The monthly
 * enum values that still exist in the pre-v11 storage shape (`'inregistrata'`, `'in-asteptare'`,
 * `'transmisa'`) must not be expressible on a decont, and `depusa` must remain the only value that says a
 * return exists. Keeping the token spaces apart is what makes that a parse-time fact rather than a comment.
 *
 * The period is keyed as `year` + `periodKind` + `periodIndex` (+ `periodToMonth` for the distinct
 * two-month period art. 322 alin. (7) lit. b) creates), **not** as the retired `{an, luna}` pair. `year`
 * is the year of the PERIOD, so a Q4 2026 decont — due 25 ianuarie 2027 under art. 323 alin. (1) — is
 * keyed to 2026 and its term lives elsewhere.
 *
 * `periodToMonth` is checked against `periodKind` by the store, not by zod: zod cannot express "required
 * exactly when periodKind is partial" without a discriminated union, and a discriminated union here would
 * reject a payload the migration chain must still be able to read. The surface flags the mismatch.
 */
export const vatReturnSchema = z.object({
  id: nonEmptyString,
  // The calendar row this record discharges. Required: a decont record that names no obligation could not
  // be joined to a term, and the term would stay open forever however many times it was filed.
  obligationId: nonEmptyString,
  year: z.number().int(),
  form: z.enum(['300']),
  periodKind: z.enum(['month', 'quarter', 'partial']),
  periodIndex: z.number().int().min(1).max(12),
  periodToMonth: z.number().int().min(1).max(12).optional(),
  status: z.enum(['in_pregatire', 'depusa', 'respinsa']),
  filedOn: z.string().optional(),
  reference: z.string().optional(),
});

/**
 * PG-6h-3 (D-OCC-1) — the occupancy sheet, OPANAF 381/2026.
 *
 * The gate is deliberately **permissive about the guest identifier and about the dates**, and that is a
 * privacy decision rather than laziness. `safeParse` runs before the migration chain and a rejected
 * payload is quarantined: a strict CNP rule here would mean one mistyped digit in a guest's CNP could
 * reject the taxpayer's whole dataset and take their revenues, expenses and filings down with it. The
 * damage would fall on the person trying to read their own records. So the schema checks the shape of the
 * record, and the surface only ever **flags** a suspect identifier — it never blocks it and never
 * discards it.
 *
 * `identifierKind` is the person's own statement about which identifier they recorded. It is not derived
 * from the value's length or charset anywhere.
 */
export const occupancyStaySchema = z.object({
  id: nonEmptyString,
  guestName: z.string(),
  guestIdentifier: z.string(),
  identifierKind: z.enum(['cnp', 'act_de_identitate']),
  firstDay: z.string(),
  lastDay: z.string(),
});

export const occupancySheetSchema = z.object({
  id: nonEmptyString,
  fiscalYear: z.number().int().min(1990).max(2100),
  propertyAddress: z.string(),
  roomLabel: z.string(),
  stays: z.array(occupancyStaySchema),
});

/**
 * PG-6e (B-31, D-FA-1) — the fixed-asset register.
 *
 * Permissive about dates and about the declared amounts for the same reason `occupancyStaySchema` is:
 * `safeParse` runs before the migration chain and a rejected payload is quarantined, so a strict date rule
 * here would let one mistyped digit in a *punerea în funcțiune* date take down the taxpayer's revenues,
 * expenses and filings with it. The shape is checked; the **arithmetic** is what refuses, in
 * `domain/fiscal/depreciation.ts`, and it refuses by naming the gap rather than by rejecting the payload.
 *
 * Every optional field is optional because absence is the honest state, not a gap to be filled: an
 * unanswered *punerea în funcțiune*, duration, method, acquisition, payment state or alin. (21) election
 * makes the schedule refuse. Nothing here defaults one.
 */
export const fixedAssetSchema = z.object({
  id: nonEmptyString,
  label: z.string(),
  entryDate: z.string(),
  putInFunctionDate: z.string().optional(),
  fiscalValue: bani(),
  nonDeductibleVatIncluded: bani().optional(),
  normalLifeMonths: z.number().int().optional(),
  method: z.enum(['liniar', 'degresiv']).optional(),
  subThresholdElection: z.enum(['intreg_la_punere_in_functiune', 'amortizare']).optional(),
  acquisition: z.enum(['cumparare', 'aport', 'productie']).optional(),
  paymentState: z.enum(['achitat', 'in_rate', 'neachitat']).optional(),
  paidOn: z.string().optional(),
  isM1Vehicle: z.boolean().optional(),
  m1ExceptionCategory: z
    .enum([
      'urgenta_paza_curierat',
      'vanzari_achizitii_test_drive_demonstratii',
      'transport_persoane_cu_plata_inclusiv_taxi',
      'servicii_inchiriere_leasing_opercional_scoli_soferi',
    ])
    .optional(),
  disposedOn: z.string().optional(),
  disposalKind: z.enum(['vanzare', 'casare', 'scoatere_din_gestiune']).optional(),
});

export const documentItemSchema = z.object({
  id: nonEmptyString,
  nume: nonEmptyString,
  data: z.string(),
  categoria: z.string(),
});

export const companyDocumentSchema = z.object({
  id: nonEmptyString,
  nume: nonEmptyString,
  tip: z.enum(['factura', 'notafactura', 'bon-fiscal', 'pdf', 'png', 'jpg']),
  content: z.string(),
  marime: z.number().int().min(0),
  data: z.string(),
  dataDepunere: z.string().optional(),
  depunere: z.string().optional(),
  perioada: z.string().optional(),
});

export const taxStatementSchema = z.object({
  id: nonEmptyString,
  tip: z.string(),
  perioada: z.string(),
  depunere: z.enum(['SOLO', 'personală']),
  dataDepunere: z.string().optional(),
  nume: z.string().optional(),
  content: z.string().optional(),
});

export const ruleReleaseSchema = z.object({
  releaseId: nonEmptyString,
  name: z.string(),
  jurisdiction: z.string(),
  entityType: z.string(),
  taxYear: z.number().int(),
  ruleIds: z.array(z.string()),
  status: z.enum(['SAFE_ACTIVATION', 'REVIEW_REQUIRED']),
  effectiveFrom: z.string(),
  // TASK 6. Every one of these is OPTIONAL on the persisted shape, and that is a decision, not an
  // oversight: a release embedded in a snapshot written before data version 9 carries none of them, and
  // the v9 `rule-set-digest` step deliberately does not fill them in. Minting a `contentHash` from today's
  // rule set would claim that today's arithmetic is the arithmetic that produced a years-old number.
  // Absence is the record saying "this release was never content-addressed".
  effectiveTo: z.string().nullable().optional(),
  lifecycle: z.enum(['PROPOSED', 'VALIDATED', 'STAGED', 'SCHEDULED', 'ACTIVE', 'SUPERSEDED']).optional(),
  version: z.number().int().optional(),
  contentHash: z.string().optional(),
  supersededBy: z.string().optional(),
  createdAt: z.string(),
  evidence: z.array(z.string()),
  notes: z.string().optional(),
});

/** The profile field reuses the domain parser, so persisted profiles are
 *  validated exactly like domain-profile input. */
const profileSchema = z.custom<PfaProfile>((value) => parsePfaProfile(value) !== null);

export const taxCalculationSnapshotSchema = z.object({
  calculationId: nonEmptyString,
  taxYear: z.number().int(),
  calculatedAt: z.string(),
  ruleRelease: ruleReleaseSchema,
  inputSnapshot: z.object({
    profile: profileSchema,
    // Money inside a snapshot feeds `inputsHash`, so these are the values whose unit change moves the
    // digest (§2.3 of the phase doc). Left permissive — no `.min(0)`, no `.int()` — for the same reason
    // as above: parse happens before migration.
    revenues: bani(z.number()),
    expenses: bani(z.number()),
  }),
  inputsHash: z.string(),
  // TASK 6: the digest of the rules that produced this record. Declared, because zod strips undeclared
  // keys and a silently dropped digest is the failure mode this phase is about. Nullable-optional so a
  // pre-v9 payload parses (parse runs before migration) and so the v9 step can write `null` — the record
  // stating that its rules cannot be reconstructed — instead of inventing one.
  ruleSetHash: z.string().nullable().optional(),
  // Phase 7: the digest carried before a data migration rewrote the embedded
  // profile. Optional, so snapshots written before AND after Phase 7 both parse.
  preMigrationInputsHash: z.string().optional(),
  calculationLines: z.array(
    z.object({
      label: z.string(),
      value: bani(z.number()),
      // B-19: a line the engine could not ground in an applicable rule. Both fields are optional so
      // snapshots written before this phase still parse — but they must be declared, because zod
      // STRIPS unknown keys by default and would silently erase the marker on load, which is the
      // exact failure mode this phase is about: an unverified figure arriving as a plain fact.
      reviewRequired: z.boolean().optional(),
      reason: z.string().optional(),
    }),
  ),
  output: z.object({ total: bani(z.number()) }),
  status: z.enum(['computed', 'superseded', 'void']),
});

const companyCaenSchema = z.object({ cod: z.string(), descriere: z.string() });

const settingsCompanySchema = z.object({
  denumire: z.string(),
  cui: z.string(),
  numarRegComert: z.string(),
  adresa: z.string(),
  codTvaIntra: z.string().optional(),
  caen: z.array(companyCaenSchema),
  mentiuniFactura: z.string().optional(),
  cnp: z.string().optional(),
  formaJuridica: z.string().optional(),
  codFiscal: z.string().optional(),
  codCAEN: z.string().optional(),
  'regComerț': z.string().optional(),
  telefon: z.string().optional(),
  email: z.string().optional(),
  contBancar: z.string().optional(),
  banca: z.string().optional(),
});

const settingsPersonalSchema = z.object({
  nume: z.string(),
  cnp: z.string(),
  adresa: z.string(),
  telefon: z.string(),
  email: z.string(),
});

const bankAccountSchema = z.object({
  id: nonEmptyString,
  banca: z.string(),
  moneda: z.string(),
});

const eFacturaSchema = z.object({
  trimitere: z.enum(['manual', 'automat']),
  dateContact: z.string(),
});

export const settingsSchema = z.object({
  cotaTva: z.number().int().min(0).max(100),
  company: settingsCompanySchema,
  personal: settingsPersonalSchema,
  bankAccounts: z.array(bankAccountSchema),
  eFactura: eFacturaSchema,
});

/**
 * The persisted (legacy-tolerant) shape of the stored dataset.
 *
 * Required: `revenues` + `settings` (the core of the dataset — a payload
 * missing them is corrupt and must recover to seed data).
 * Optional: `profile` (pre-profile-collection payloads), `snapshots`
 * (pre-snapshot-feature payloads), and the secondary collections, which the
 * load path backfills to empty values.
 *
 * `version` is optional and its ABSENCE is meaningful: a payload with no
 * `version` key is the base of the migration chain (version 0), i.e. a payload
 * written before Phase 7 introduced versioning. It is deliberately not given a
 * zod `.default()`, so the migration can tell "absent" from "explicitly 0" —
 * both map to the same chain entry, and neither is a guess.
 */
export interface PersistedAppData {
  version?: number;
  profile?: PfaProfile;
  revenues: Revenue[];
  expenses?: Expense[];
  clients?: Client[];
  /**
   * The pre-v11 monthly rows, declared so zod cannot strip them before the `annual-filing` step has read
   * them. Zod strips undeclared keys: dropping this line would erase the rows on load, before any
   * migration code saw them, and the step's own decision to drop them would be moot. The v10→v11 step
   * reads this key and **drops** it (PG-5b); nothing downstream of the chain can carry it.
   */
  declarations?: LegacyMonthlyDeclaration[];
  /** PG-5: the annual returns. Absent means none recorded — never backfilled. */
  filings?: AnnualFiling[];
  /**
   * PG-6g: the periodic VAT returns. Declared rather than left off, for the standing reason in this file —
   * **zod strips undeclared keys**, so an undeclared `vatReturns` collection would be erased by the next
   * save-and-load and the taxpayer would lose the only proof they hold that a decont was filed. Absent
   * means none recorded, and the v18→v19 step backfills nothing.
   */
  vatReturns?: VatReturnRecord[];
  /**
   * PG-6h-3: the occupancy sheets. Declared here rather than left off, for the standing reason in this
   * file: **zod strips undeclared keys**, so an undeclared `occupancySheets` would be erased by the next
   * save-and-load and the taxpayer would silently lose the very document they are legally required to
   * keep. Absent means none recorded, and the v13→v14 step backfills nothing.
   */
  occupancySheets?: OccupancySheet[];
  /**
   * PG-6c (D-VEH-3): the vehicles this taxpayer owns or holds in use. Declared here rather than left off,
   * for the standing reason in this file — **zod strips undeclared keys**, so an undeclared `vehicles`
   * collection would be erased by the next save-and-load and every expense pointing at one of its cars
   * would silently lose the attribution the person made. Absent means none recorded, and the v14→v15 step
   * backfills nothing.
   */
  vehicles?: Vehicle[];
  /**
   * PG-6e (D-FA-1): the fixed-asset register. Declared rather than left off, for the standing reason in
   * this file — **zod strips undeclared keys**, so an undeclared `fixedAssets` collection would be erased
   * by the next save-and-load and the taxpayer would lose the register they owe under Normele Titlul IV
   * pct. 7 alin. (8). Absent means none recorded, and the v16→v17 step backfills nothing.
   */
  fixedAssets?: FixedAsset[];
  documents?: DocumentItem[];
  companyDocs?: Record<DocTypeCode, CompanyDocument[]>;
  statements?: TaxStatement[];
  snapshots?: TaxCalculationSnapshot[];
  settings: SettingsState;
  /**
   * TASK 3: the recorded tax reserve, in integer bani. `null` means "no reserve recorded" and `0`
   * means the user recorded an explicit zero — the two are different facts and must not collapse.
   *
   * Optional on the PAYLOAD because absence is honest: a pre-v7 payload never recorded a reserve, and
   * the `tax-reserve` migration step backfills nothing. The load path turns absence into `null`, not
   * into `0`.
   *
   * Declared here rather than left off, because **zod strips undeclared keys**: an undeclared reserve
   * would be erased on the next load, which is the "surface, not vanish" rule failing silently.
   */
  reservedAmount?: Bani | null;
  /**
   * Phase 10: the report produced by the `money-bani` step when a stored value could not be converted to
   * an integer number of bani losslessly. Declared here rather than left on the object because **zod strips
   * undeclared keys**: an undeclared report would be erased on the next load, which is the "surface, not
   * vanish" rule failing silently. Absent means "nothing had to be decided".
   */
  moneyNotices?: MoneyPrecisionNotice[];
  /**
   * TASK 10a: the FX rates this install has recorded. Optional because absence is the honest state for a
   * fresh install and for every payload written before this task — no migration step backfills a rate, and
   * inventing one would be inventing a legal figure.
   *
   * Declared rather than left off, for the standing reason in this file: **zod strips undeclared keys**, so
   * an undeclared `fxRates` would be erased by the next save-and-load and the user would silently lose the
   * rates they entered by hand.
   */
  fxRates?: FxRateRecord[];
}

export const persistedAppDataSchema = z.object({
  // Absent === DATA_VERSION_BASE (see PersistedAppData above). A version higher
  // than the chain's current version is rejected by the load path, not guessed
  // at — see `readStoredVersion` in data/migration.ts.
  version: z.number().int().min(0).optional(),
  profile: profileSchema.optional(),
  revenues: z.array(revenueSchema),
  expenses: z.array(expenseSchema).optional(),
  clients: z.array(clientSchema).optional(),
  // PG-5b: declared, not dropped — see `PersistedAppData.declarations`. The v10→v11 step reads this key
  // and drops it; it stays declared so the step, not the load gate, is what decides.
  declarations: z.array(declarationSchema).optional(),
  filings: z.array(annualFilingSchema).optional(),
  vatReturns: z.array(vatReturnSchema).optional(),
  // PG-6h-3. Permissive on purpose — see `occupancyStaySchema`. A guest's mistyped CNP must not be able
  // to quarantine the taxpayer's whole dataset.
  occupancySheets: z.array(occupancySheetSchema).optional(),
  // PG-6c. Permissive on the year facts by design — see `vehicleYearFactsSchema`.
  vehicles: z.array(vehicleSchema).optional(),
  fixedAssets: z.array(fixedAssetSchema).optional(),
  documents: z.array(documentItemSchema).optional(),
  companyDocs: z
    .record(z.enum(['im', 'cs', 'tva', 'facturi']), z.array(companyDocumentSchema))
    .optional(),
  statements: z.array(taxStatementSchema).optional(),
  snapshots: z.array(taxCalculationSnapshotSchema).optional(),
  settings: settingsSchema,
  // TASK 3. The one money field in this schema that is allowed to be `null`: `null` is the recorded
  // state "no reserve", which is NOT the same as `0` (an explicit zero) and NOT the same as absent
  // (a pre-v7 payload). Absent stays absent through the chain; the load path maps it to `null`.
  // A negative reserve is rejected rather than clamped — corrupt money must quarantine, not guess.
  reservedAmount: bani(nonNegative).nullable().optional(),
  // Phase 10. `converted` is omitted (never null) when the value could not be represented at all.
  moneyNotices: z
    .array(
      z.object({
        collection: z.enum(['revenues', 'expenses', 'declarations', 'profile', 'snapshot']),
        id: z.string(),
        field: z.string(),
        original: z.string(),
        converted: bani(z.number()).optional(),
        reason: z.enum(['sub-ban-precision', 'non-finite']),
      }),
    )
    .optional(),
  // TASK 10a. Declared so the rates a user entered by hand survive a save-and-load instead of being
  // stripped. Absence is a real state — no rate has been fetched or entered — and no migration step
  // backfills one, because a backfilled rate would be a fabricated legal figure.
  fxRates: z.array(fxRateRecordSchema).optional(),
});

/**
 * Parse a raw localStorage payload into a validated `PersistedAppData`.
 * Returns `null` for anything that is not a valid dataset: unparseable
 * JSON, non-object JSON, missing required collections, wrong types,
 * invalid numbers, invalid profile / settings / snapshot entries.
 *
 * `parseAppDataResult` is the form the load path uses — it keeps WHY the payload
 * was rejected so the quarantine record (D-3) can carry a real reason instead of
 * "something was wrong". This wrapper stays because it is the shape the schema
 * tests and callers already use.
 */
export type ParseAppDataResult =
  | { ok: true; data: PersistedAppData }
  | { ok: false; reason: 'unparseable-json' | 'schema-invalid'; detail: string };

export function parseAppDataResult(raw: string): ParseAppDataResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      ok: false,
      reason: 'unparseable-json',
      detail: err instanceof Error ? err.message : String(err),
    };
  }
  const result = persistedAppDataSchema.safeParse(parsed);
  if (result.success) return { ok: true, data: result.data };
  // Bounded on purpose: a payload that fails everywhere would otherwise produce
  // an unreadable wall of text in the banner and in localStorage.
  const detail = result.error.issues
    .slice(0, 12)
    .map(issue => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
  return { ok: false, reason: 'schema-invalid', detail };
}

export function parseAppData(raw: string): PersistedAppData | null {
  const result = parseAppDataResult(raw);
  return result.ok ? result.data : null;
}

// ---------------------------------------------------------------------------
// B-21 — the WRITE-path date validator. This is the schema boundary for input that
// is about to be stored; it is deliberately NOT wired into `persistedAppDataSchema`.
//
// Why not: `persistedAppDataSchema` is the LOAD gate, and its failure mode is
// `store.tsx` → `rejected()` → quarantine the payload and hand back `seedData`. Adding a
// date-shape rule there would mean one legacy record with a bad date destroys every other
// record in the dataset — mass silent data loss, the opposite of what B-21 asks for. The
// precedent is already written down at `domain/schema.ts:43-49`: format validation is kept
// out of the persisted gate precisely because it would itself be a data-loss event.
// So NEW input is refused here, loudly; values ALREADY persisted are reported by
// `domain/aggregation.ts` → `auditFiscalDates` as `review_required`, never rewritten.
// ---------------------------------------------------------------------------

export type RecordKind = 'revenue' | 'expense' | 'filing' | 'vatReturn' | 'companyDocument' | 'statement';

interface DateFieldSpec {
  /** Property name on the record. */
  field: string;
  /** Romanian label, for the message the user sees. */
  label: string;
  /** Absent/undefined is acceptable only when this is false. */
  required: boolean;
}

export interface DateFieldViolation {
  field: string;
  label: string;
  value: string;
  /** Problem code from `domain/date.ts` (`missing`, `not zero-padded`, …). */
  reason: string;
}

/**
 * Every date field a stored record carries, per record kind.
 *
 * `CompanyDocument.perioada` and `TaxStatement.perioada` are deliberately ABSENT: they are
 * free text the user types (`'Q2 2026'`, `'2026-Q2'`), not calendar dates, and validating
 * them as dates would reject data the app is meant to keep. `DocumentItem.data` is written
 * only from `todayISO()`, never from a user field, so it cannot carry a malformed value.
 */
const RECORD_DATE_FIELDS: Record<RecordKind, readonly DateFieldSpec[]> = {
  revenue: [
    { field: 'date', label: 'data', required: true },
    { field: 'collected', label: 'data încasării', required: false },
  ],
  expense: [
    { field: 'date', label: 'data', required: true },
    { field: 'paid', label: 'data plății', required: false },
  ],
  filing: [{ field: 'filedOn', label: 'data depunerii', required: false }],
  vatReturn: [{ field: 'filedOn', label: 'data depunerii', required: false }],
  companyDocument: [
    { field: 'data', label: 'data', required: true },
    { field: 'dataDepunere', label: 'data depunerii', required: false },
  ],
  statement: [{ field: 'dataDepunere', label: 'data depunerii', required: false }],
};

/**
 * Anything this app can write that carries a date field. A union of the real record types
 * (plus their pre-id shapes) rather than a loose bag, so a call site cannot pass the wrong
 * record for the kind it names.
 */
export type DateBearingRecord =
  | Revenue
  | Omit<Revenue, 'id'>
  | Expense
  | Omit<Expense, 'id'>
  | AnnualFiling
  | Omit<AnnualFiling, 'id'>
  | VatReturnRecord
  | Omit<VatReturnRecord, 'id'>
  | CompanyDocument
  | Omit<CompanyDocument, 'id'>
  | TaxStatement
  | Omit<TaxStatement, 'id'>;

/**
 * The date fields of `record` that are not usable ISO calendar dates. Empty array = acceptable.
 * Fields are read structurally because callers hold both `Omit<T,'id'>` and `T`; the kind selects
 * which fields exist, so the only cast is the one from a real record type to a property bag.
 */
export function validateRecordDates(kind: RecordKind, record: DateBearingRecord): DateFieldViolation[] {
  const source = record as Record<string, unknown>;
  const violations: DateFieldViolation[] = [];
  for (const spec of RECORD_DATE_FIELDS[kind]) {
    const raw = source[spec.field];
    if (raw === undefined || raw === null) {
      if (spec.required) violations.push({ field: spec.field, label: spec.label, value: '', reason: 'missing' });
      continue;
    }
    if (typeof raw !== 'string') {
      violations.push({ field: spec.field, label: spec.label, value: String(raw), reason: 'not a string' });
      continue;
    }
    const problem = isoCalendarDateProblem(raw);
    if (problem !== null) violations.push({ field: spec.field, label: spec.label, value: raw, reason: problem });
  }
  return violations;
}

// ---------------------------------------------------------------------------
// Compile-time guarantees: every schema output is exactly the existing
// domain type (no parallel type system).
// ---------------------------------------------------------------------------
type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

// Exported so the assertion is a live part of the module (an unexported type
// alias is reported as unused); it still exists only to fail the build on drift.
export type _checks = [
  Expect<Equal<z.output<typeof revenueSchema>, Revenue>>,
  Expect<Equal<z.output<typeof expenseSchema>, Expense>>,
  Expect<Equal<z.output<typeof clientSchema>, Client>>,
  Expect<Equal<z.output<typeof declarationSchema>, LegacyMonthlyDeclaration>>,
  Expect<Equal<z.output<typeof annualFilingSchema>, AnnualFiling>>,
  Expect<Equal<z.output<typeof vatReturnSchema>, VatReturnRecord>>,
  Expect<Equal<z.output<typeof occupancyStaySchema>, OccupancyStay>>,
  Expect<Equal<z.output<typeof occupancySheetSchema>, OccupancySheet>>,
  Expect<Equal<z.output<typeof vehicleYearFactsSchema>, VehicleYearFacts>>,
  Expect<Equal<z.output<typeof vehicleSchema>, Vehicle>>,
  Expect<Equal<z.output<typeof fixedAssetSchema>, FixedAsset>>,
  Expect<Equal<z.output<typeof documentItemSchema>, DocumentItem>>,
  Expect<Equal<z.output<typeof companyDocumentSchema>, CompanyDocument>>,
  Expect<Equal<z.output<typeof taxStatementSchema>, TaxStatement>>,
  Expect<Equal<z.output<typeof ruleReleaseSchema>, RuleRelease>>,
  Expect<Equal<z.output<typeof taxCalculationSnapshotSchema>, TaxCalculationSnapshot>>,
  Expect<Equal<z.output<typeof settingsSchema>, SettingsState>>,
  Expect<Equal<z.output<typeof persistedAppDataSchema>, PersistedAppData>>,
];
