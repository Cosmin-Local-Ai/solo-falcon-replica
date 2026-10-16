import type { PfaProfile } from '../domain/models';
import type { ExpenseCategory, VehicleYearFacts } from '../domain/fiscal/deductibility';
// B-112 stage 1 — the DPI income-category vocabularies come from the layer that reads them, for the same
// standing reason (B-70): a vocabulary spelled twice drifts.
import type { DpiContractType, DpiExcludedKind, IncomeCategory } from '../domain/dpi';
// PG-6f (B-30) — the VAT fact vocabularies come from the layer that reads them, for the standing reason
// in this repository: a vocabulary spelled twice drifts (B-70).
import type { ExpenseVatFacts, VatVehicleYearFacts } from '../domain/fiscal/vat';
import type { FixedAssetFacts } from '../domain/fiscal/depreciation';
import type { TaxCalculationSnapshot } from '../domain/snapshots/types';
import type { MoneyPrecisionNotice } from './migration';
import { localDateISO, now } from '../domain/date';
import { sumMoney, type Bani, type CurrencyCode, type Money } from '../domain/money';
import type { FxRateRecord } from '../domain/fx/rates';
import type { LegacyMonthlyDeclaration } from './schema';

// ── Venituri ──────────────────────────────────────────────
export type RevenueStatus = 'inregistrata' | 'in-asteptare' | 'respinsa';
export type EFacturaStatus = 'Acceptată' | 'În așteptare' | 'Respinsă';

export interface Revenue {
  id: string;
  tip: 'factura' | 'notafactura';
  nr: string;
  date: string;
  /**
   * The date the amount was actually **collected** — the date that attributes this revenue to a
   * fiscal year. CF art. 68 alin. (2) lit. a) measures venit brut by „sumele încasate" (amounts
   * collected), so collection is the fiscally load-bearing date.
   *
   * Three states, and the difference between the last two is the whole of B-159:
   *
   * - a **date** — the money came in that day, and that day decides the fiscal year;
   * - **`null`** — the person declared that the money has NOT come in. CF art. 68 alin. (2) lit. a)
   *   measures venit brut by „sumele încasate”, so a declared-uncollected sum is not in the base at all
   *   (`domain/aggregation.ts` `revenueFiscalDate` resolves it to no fiscal date). `docs/ai/research/37`
   *   §5 sentence 3 is the sentence this state exists to make true;
   * - **absent** — a payload written before Phase 9 recorded a single `date`, and that date is read as
   *   the fiscal date. The v2→v3 migration deliberately does **not** invent a collection event, and
   *   reading absence as „never collected” would delete the whole seed register from the base, so
   *   absence is NOT a declaration of non-collection. It is disclosed instead (B-67, B-38).
   *
   * The invoice issue date is not a timing gate.
   */
  collected?: string | null;
  client: string;
  cui: string;
  /**
   * Integer **bani** (Phase 10). A persisted lei value became bani through the `money-bani` migration step.
   *
   * TASK 10a (B-32): the amount now carries its **currency**. `Money` is `{ amount: Bani, currency }`, so a
   * EUR invoice is no longer arithmetically indistinguishable from a lei invoice. The stored figure itself
   * did not move — the `record-currency` step wrapped every existing number as `{ amount: <same number>,
   * currency: 'RON' }`, which is value-preserving by construction. See `docs/ai/phases/24_currency_fx_store.md`.
   */
  valoareFaraTva: Money;
  tva: Money;
  status: RevenueStatus;
  statusDetail?: string;
  eFacturaStatus?: EFacturaStatus;
  /**
   * B-112 — which income category this receipt is: art. 67 activitate independentă, or art. 70 drepturi de
   * proprietate intelectuală.
   *
   * `tip` is a **document type** (`factura` | `notafactura`), not an income category, and the app used to
   * have nothing else. That is the whole of B-112: with no category on the record the engine could not
   * represent DPI income, so an entire income category was silently absent from the CAS cumulation of
   * art. 148 alin. (3) — ANAF's Exemplul 3 pays CAS of 24.300 lei on it and the engine produced 12.150.
   *
   * Optional, never defaulted in storage. Absent reads as `DEFAULT_INCOME_CATEGORY`
   * (`domain/dpi.ts`), which is a statement about history — a payload written before B-112 could only hold
   * activitate-independentă receipts — not a guess about this record. No chain step backfills it, because a
   * backfill would mint a legal classification nobody recorded.
   *
   * The category is an INPUT and never an inference. DPI vs activitate independentă turns on the object of
   * the contract under Legea 8/1996, and ÎCCJ dec. nr. 1793 din 23 martie 2021 refused DPI characterisation
   * for contracts merely labelled as such. The taxpayer holding a PFA settles nothing: neither art. 70 nor
   * art. 72 carves out PFA holders, and ANAF's own Exemplul 3 is one taxpayer holding both categories.
   */
  incomeCategory?: IncomeCategory;
  /**
   * B-112 — the object of the contract, as the person declares it: a *cesiune / licență* of patrimonial
   * copyright (Legea 8/1996 art. 40 → DPI) or a *contract de comandă / antrepriză* (art. 47 L. 8/1996,
   * art. 185¹ C. civ. → activitate independentă).
   *
   * It is a second answer to the same question the category answers, and that is deliberate: the pair is
   * checkable. Where the two disagree, `domain/dpi.ts dpiRecordConflict` reports the contradiction and the
   * app declines to post the income — it does not pick a winner between two facts the person recorded.
   */
  dpiContractType?: DpiContractType;
  /**
   * B-112 — the art. 72 alin. (3) / art. 72¹ alin. (2) exclusion set: *moștenitori*, *drept de suită*,
   * *remunerație compensatorie pentru copia privată*.
   *
   * **One stored flag, two consequences**, both read from the single predicate `isDpiArt72Alin3Excluded`:
   * the sum gets **no 40 % forfetară quota** (art. 72 alin. (2)-(3), art. 72¹ alin. (1)-(2)) and it is
   * **outside CAS** (art. 137 alin. (1) lit. b¹) excludes „veniturile prevăzute la art. 72 alin. (3)”).
   * Two predicates would be two chances to get one legal fact wrong.
   */
  dpiExcludedKind?: DpiExcludedKind;
}

// ── Cheltuieli ────────────────────────────────────────────
export type ExpenseStatus = 'inregistrata' | 'respinsa';

/**
 * The status codes the record registers share — the vocabulary the tab lists, the status selects and
 * `statusBadge` are all keyed by.
 *
 * PG-5b removed `DeclStatus`, which used to own this union: the four words came from the monthly row.
 * The registers still use them, so the union now says so directly instead of borrowing its shape from a
 * record type that no longer exists.
 *
 * **B-141 (brief 67) — `transmisa` is the union's one legacy member, and the decision is read-wide /
 * write-narrow, not deletion.** It is not producible: `revenueSchema` enumerates three words and
 * `expenseSchema` two, neither list contains it, no status select offers it, no seed row or demo persona
 * carries it, and the only stored key that ever could hold it — `declarations[]` — is dropped whole by
 * the v10→v11 `annual-filing` step. It stays **readable** because that is the half a user's bytes depend
 * on: `declarationSchema` still accepts it so a pre-v11 payload passes the one load gate instead of
 * being refused there, and the named chain step — not the gate — is what drops the row. Removing the
 * word from the read vocabulary would turn „a record nobody can make any more” into „a payload we refuse
 * to open”, which on a local-first app is data loss. Same rule as `impozit_pe_cit` in `PFA_REGIME_VALUES`.
 * Pinned by `stored-status.transmisa.test.ts`; what did move is `statusBadge` below.
 */
export type StoredStatusCode = RevenueStatus | ExpenseStatus | 'transmisa';

export interface Expense {
  id: string;
  tip: 'factura' | 'bon-fiscal';
  nr: string;
  date: string;
  /**
   * The date the expense was actually **paid** — the date that attributes it to a fiscal year.
   * CF art. 68 alin. (4) lit. b) requires expenses be „cuprinse în cheltuielile exercițiului
   * financiar al anului în cursul căruia au fost plătite", i.e. the year of PAYMENT. The consequence
   * is attribution, not punishment: a late-paid expense is not disallowed, it falls into the payment year.
   *
   * Three states — the same three as `Revenue.collected`, and B-159 is about the middle one:
   *
   * - a **date** — paid that day, and that day decides the year;
   * - **`null`** — the person declared the money has NOT gone out. Art. 68 alin. (4) lit. b) is a
   *   condition, not a deadline (`docs/ai/research/37` §3.3), so a never-paid expense is permanently
   *   non-deductible. Before B-159 the app could not say this at all: the only way to record an unpaid
   *   expense was `inregistrata` with an empty `paid`, and the engine deducted it in the document's year;
   * - **absent** — the legacy single-date reading, disclosed rather than corrected (B-67, B-38).
   *
   * Never invented by a migration. Art. 68 alin. (4) lit. a) only requires the expense be
   * „justificate prin documente" — the invoice is the justificativ, its issue date is not a gate.
   */
  paid?: string | null;
  furnizor: string;
  cui: string;
  /** Integer **bani** (Phase 10). TASK 10a: carries its currency — see `Revenue.valoareFaraTva`. */
  valoareFaraTva: Money;
  tva: Money;
  status: ExpenseStatus;
  statusDetail?: string;
  /**
   * TASK 2b — the token the deductibility classifier reads (`domain/fiscal/deductibility.ts`, CF art. 68).
   *
   * **Optional by design, and never invented by a migration.** Absence is legal input, not a defect: an
   * uncategorised expense classifies as `undetermined`, is EXCLUDED from the deductible total, and is
   * surfaced as a count with one action. That is the safe target for data written before this field
   * existed — the v5→v6 step widens the schema and backfills nothing, exactly as `paid` (v2→v3) and
   * `vatExceedanceDate` (v3→v4) did.
   *
   * The vocabulary is `EXPENSE_CATEGORIES`. A token outside it is not deductible by silence:
   * `classifyExpenseDeductibility` answers `undetermined` with `rule: null`, because art. 68 alin. (7)
   * lit. l) is an open clause and an uncited category may never be treated as deductible.
   */
  category?: ExpenseCategory;
  /**
   * PG-6c (D-VEH-3) — the vehicle this expense belongs to, by id.
   *
   * **Optional, and never invented by a migration or by the app.** It is the only honest way to connect a
   * running cost to a car: `category` is a cost-type token and is not a vehicle identity, and `research/40`
   * §1 forbids deriving the link from anything else — not a supplier name, not a CAEN code, not a seed
   * value. A cost the person has not attributed stays unattributed and is reported as such.
   *
   * An id that no longer names a vehicle (the car was deleted) is treated the same way, not repaired.
   */
  vehicleId?: string;
  /**
   * B-108 — the fixed asset this expense belongs to, by id.
   *
   * The register has two routes to the expense side of one capital asset: the depreciation schedule the
   * fixed-asset record computes, and a hand-typed `depreciation_business_asset` expense. art. 68 alin. (4)
   * lit. d) lets the taxpayer use the Titlul II amortisation rules for an asset whose cost was recorded as
   * an expense, but it does not license deciding **which** asset a typed line covers. So until this field
   * existed the collision could only be detected register-wide, and the refusal was broader than the truth:
   * one typed expense withheld the computed schedules of every unrelated asset in the register.
   *
   * **Optional, and never invented by a migration or by the app.** The v22→v23 step opens the field and
   * fills in nothing — matching a line to an asset by amount, by date or by supplier is the inference that
   * was already rejected, and it stays rejected. The person links the expense, in the same control that
   * links a running cost to a car (`vehicleId` above), and until they do the conflict stays register-wide
   * and says so.
   *
   * An id that no longer names an asset (the asset was deleted) is not repaired and does not withhold any
   * schedule — there is no schedule left to withhold — but it is reported, because a link the person made
   * that points at nothing is a fact about the record, not a defect to paper over.
   */
  assetId?: string;
  /**
   * PG-6f (B-30) — the facts this line's **input VAT** decision needs, declared by the person.
   *
   * They live on the record and not on the profile because every one of the switches art. 297-300 asks
   * about is a property of the purchase: what it was bought for, who sold it, what document proves it and
   * whether it has been paid. The vocabulary is `domain/fiscal/vat.ts ExpenseVatFacts` — the layer that
   * reads it — so the stored shape and the decision cannot drift into two spellings.
   *
   * **Optional, and no field inside it has a default.** Absence is not „no": it makes the line's VAT
   * outcome *unresolved*, which keeps it out of the claimable total and lists it separately (D-VAT-3),
   * instead of answering a question nobody was asked. That is the exact defect the retired `vatExempt`
   * boolean used to answer for the whole register at once.
   */
  vatFacts?: ExpenseVatFacts;
}

// ── Vehicule (PG-6c, D-VEH-3) ────────────────────────────
/**
 * A vehicle the taxpayer owns or holds in use, with its facts declared **per fiscal year**.
 *
 * The entity exists for one distinction and nothing else. art. 68 alin. (5) lit. j) caps deductible
 * running costs at „cel mult un singur autoturism aferent **fiecărei persoane**”, but its own words limit
 * it to „autoturismele **folosite de contribuabil** sau membru asociat”. A car used only for the activity,
 * only by employees, or only inside one of the five exception categories is therefore **outside** the cap
 * and keeps the general rule of alin. (4) + alin. (7) lit. k) — 100 % on evidenced exclusive use, 50 %
 * otherwise — while a car the taxpayer personally uses is inside it. Two identical cars can sit on
 * opposite sides of that line, which is exactly what a single per-register fact could not express
 * (`docs/ai/research/40_vehicle_one_car_limit.md` §4; D-VEH-3).
 *
 * The per-year facts themselves are `VehicleYearFacts`, declared in `domain/fiscal/deductibility.ts` —
 * the layer that reads them — so the stored shape and the classifier vocabulary are one spelling.
 *
 * **Leased and rented-in cars belong here too.** alin. (7) lit. k) covers vehicles „aflate în **proprietate
 * sau în folosință**”; there is no income-tax carve-out for a leasing company's fleet (the six-category
 * list at TVA art. 298 alin. (3) has no Titlul IV equivalent — the income-tax list has five).
 *
 * **What this entity is not.** It carries no depreciation data and no asset-register fields: lit. k)
 * expressly excludes amortisation from the running-cost rules, and the art. 28 alin. (14) M1 ceiling of
 * 1.500 lei/lună is stated **per vehicle** („pentru fiecare”) and belongs to the fixed-asset phase, not
 * here. `label` is whatever the person uses to recognise the car; nothing reads it.
 */
export interface Vehicle {
  id: string;
  /** The person's own name for the car — an identity they recognise, not a code. */
  label: string;
  /** Optional: the registration number, so the person can tell two identical cars apart. */
  plate?: string;
  /** Declared facts, one per fiscal year. Absence of a year entry means that year was never answered. */
  years: VehicleYearFacts[];
  /**
   * PG-6f — the same car's **VAT** facts, per fiscal year, kept in a separate array on purpose.
   *
   * The two arrays are two provisions and must never be merged. `years` is art. 68 alin. (4)/(5) lit. j)
   * /(7) lit. k) — **five** exception categories, and full income-tax deductibility is the thing that must
   * be evidenced with a *foaie de parcurs*. `vatYears` is art. 298 alin. (1)-(3) — **six** categories, the
   * extra one being lit. e) „închiriere sau … leasing financiar ori operațional” — and the evidence shape
   * is inverted: the 50 % VAT branch needs **no** logbook (Norme pct. 68 alin. (4)), full VAT deduction
   * does. `research/42` §3 works out the consequence: a financial or operating lease is 100 % for VAT and
   * 50 % for income tax. One array holding both would make that unrepresentable, which is the same reason
   * `Vehicle` and `FixedAsset` are separate records.
   *
   * Optional, no defaults, and the v17→v18 step backfills none of it.
   */
  vatYears?: VatVehicleYearFacts[];
}

/**
 * PG-6e (B-31, D-FA-1) — one fixed asset in the register, with the facts the depreciation arithmetic needs.
 *
 * **What this entity is, and what `Vehicle` is not.** The two are deliberately separate records. A car can
 * appear in both: `Vehicle` carries the running-cost facts art. 68 alin. (7) lit. k) and alin. (5) lit. j)
 * read, and `FixedAsset` carries the amortisation facts art. 28 reads. Nothing links them, and nothing may
 * infer one from the other — art. 68 alin. (7) lit. k) closes with „Cheltuielile care intră sub incidența
 * acestor prevederi **nu includ cheltuielile privind amortizarea**”, and art. 28 alin. (14) caps amortisation
 * **per vehicle** („pentru fiecare”) with no one-car limit at all. A car can therefore be depreciated while
 * another car carries its running costs, and a single record holding both would have made that impossible
 * to express.
 *
 * The fact vocabulary itself lives in `domain/fiscal/depreciation.ts` — the layer that reads it — for the
 * standing reason in this repository: a vocabulary spelled twice drifts. This record adds only an `id`.
 *
 * **No field here has a default, and the v16→v17 chain step backfills none of them.** Each one is a legal
 * assertion: a minted *punerea în funcțiune* date picks the year depreciation starts in; a minted duration
 * picks the pct. 27 disposal ceiling; a minted acquisition of `cumparare` decides the contested aport
 * question; a minted election under alin. (21) chooses between two mutually exclusive branches that pct. 31
 * says must be chosen at entry into the patrimony.
 */
export interface FixedAsset extends FixedAssetFacts {
  id: string;
}

// ── Pre-v10 record shapes (migration tests only) ────────────────────────────
/**
 * A `Revenue` / `Expense` in the shape a **pre-v10** payload stored it: money as a bare number, with no
 * currency anywhere on the field.
 *
 * These exist for the migration tests, and only for them. A fixture that feeds `localStorage` a payload at
 * `version < 10` is showing what the chain must convert, so it must be typed as the OLD shape — typing it
 * `Revenue` would force the fixture into the post-v10 object form and the chain would have nothing left to
 * migrate, which is exactly the "fixtures are payloads, not values" trap `docs/ai/phases/10_money_precision.md`
 * §3.3(4) records. The `Bani` here is the pre-v10 reality: a number the load gate casts and the chain
 * converts. Never use these types in production code.
 */
export type LegacyRevenue = Omit<Revenue, 'valoareFaraTva' | 'tva'> & { valoareFaraTva: Bani; tva: Bani };
export type LegacyExpense = Omit<Expense, 'valoareFaraTva' | 'tva'> & { valoareFaraTva: Bani; tva: Bani };

/**
 * A whole dataset in the pre-v10 shape. The migration tests build one of these, hand it to `localStorage`
 * at a `version` below 10, and assert what the chain produces — so the fixture must be typed as the shape
 * that arrives, not the shape that leaves.
 */
export type LegacyAppData = Omit<
  AppData,
  'revenues' | 'expenses' | 'filings' | 'occupancySheets' | 'vehicles' | 'fixedAssets' | 'vatReturns'
> & {
  revenues: LegacyRevenue[];
  expenses: LegacyExpense[];
  /**
   * The pre-v11 monthly rows. A legacy fixture carries them under this key precisely because that is
   * what an old payload looks like; the `annual-filing` step is what **drops** them (PG-5b). Optional,
   * because most legacy fixtures never had any. Typed with the storage shape from `data/schema.ts`, not
   * with an application record type — there is no longer such a thing.
   */
  declarations?: LegacyMonthlyDeclaration[];
  /**
   * PG-6h-3: omitted rather than re-declared, because a pre-v14 payload has no such key and a legacy
   * fixture must look like the payload it claims to be. Leaving it in the `Omit` list would force every
   * migration fixture to carry occupancy sheets that could not exist at the version being tested — and
   * would quietly defeat the one thing the v13→v14 step has to prove, that it backfills nothing.
   */
};

// ── Clienți ───────────────────────────────────────────────
export interface Client {
  id: string;
  denumire: string;
  cui: string;
  email?: string;
  telefon?: string;
  oras?: string;
}

// ── Declarație unică anuală (PG-5) ────────────────────────
/**
 * PG-5b: the monthly `Declaration` record type is gone, and with it `DeclStatus` and `declarationNet`.
 *
 * It was never a filing — a monthly row recorded that a row had been registered in this app, and a PFA
 * în sistem real owes ONE Declarația Unică 212 per fiscal year (CF art. 122 alin. (3)), so there was no
 * monthly return for it to be a record of. PG-5 kept the rows readable for one release out of caution
 * about stored data; D-USER-1 records that there is no stored data to protect, so the shape is deleted
 * rather than preserved. What survives is the separation it enforced: `FilingStatus` below is the only
 * vocabulary that can say a return exists, and `isFiledFiling` is the only test that says one was filed.
 *
 * The pre-v11 payload key still parses — see `declarationSchema` in `data/schema.ts` — because the
 * migration chain has to be able to read it in order to drop it.
 */
/** The only annual return this application models. */
export type FilingForm = 'D212';

/**
 * The state of the annual return, as the app is allowed to know it.
 *
 * `depusa` is the only status that says a filing happened, and it is the only one a deadline may be
 * marked done from. `in_pregatire` says the return is being prepared — a fact about the app's own
 * record, not about ANAF. `respinsa` says a submission was made and rejected: a rejected return is
 * not a filed one, so it does not discharge the obligation either.
 */
export type FilingStatus = 'in_pregatire' | 'depusa' | 'respinsa';

export interface AnnualFiling {
  id: string;
  /** The fiscal year the return DECLARES — not the year it was filed. FY2026 is filed in 2027. */
  taxYear: number;
  form: FilingForm;
  status: FilingStatus;
  /** The date the return was actually filed. Meaningful only with `depusa`; absent means not recorded. */
  filedOn?: string;
  /** The registration number or proof reference the tax office gave, when the user recorded one. */
  reference?: string;
}

/**
 * The ONE test that says "this record proves a filing happened".
 *
 * Landmine: a monthly row with `status: 'inregistrata'` must never pass for this, which is why the
 * function takes an `AnnualFiling` and nothing else. PG-5b removed the monthly record type, so what used
 * to be a comment is now enforced by the compiler: there is nothing left shaped like a monthly row to
 * hand to it.
 */
export const isFiledFiling = (f: Pick<AnnualFiling, 'status'>): boolean => f.status === 'depusa';

// ── Decontul periodic de TVA (PG-6g) ────────────────────────────────────
/**
 * PG-6g — the record of a **periodic** VAT return (formular 300, OPANAF 174/2026, MO I 105/09.02.2026).
 *
 * **Why this is a second record type and not `AnnualFiling` with a different `form`.** `AnnualFiling` is
 * keyed by `taxYear`, the year the return *declares*. A decont is keyed by a **fiscal period** — a month, a
 * quarter, or the distinct two-month period art. 322 alin. (7) lit. b) creates — and that period can start
 * and end inside one year while its term falls in the next. Forcing a Q4 2026 decont into `{taxYear}` would
 * lose which quarter it was, and forcing it into the retired monthly `{an, luna}` shape would resurrect
 * exactly the record type PG-5b deleted, which this brief forbids.
 *
 * **The status vocabulary is deliberately its own.** It mirrors `FilingStatus`'s discipline — only `depusa`
 * says a return exists — but it is a separate union, so the monthly enum values that still live in the
 * storage shape (`'inregistrata'`, `'in-asteptare'`, `'transmisa'`) can never be handed to a decont, and a
 * decont's status can never be read as proof of a D212. `isFiledVatReturn` is the only test that says one
 * was filed, exactly as `isFiledFiling` is for the annual return.
 *
 * **Absent means none recorded.** Nothing here is backfilled: no period implies a filing, and the v18→v19
 * chain step opens the collection empty.
 */
export type VatReturnStatus = 'in_pregatire' | 'depusa' | 'respinsa';

/** The only periodic return form this application models for a registered PFA. */
export type VatReturnForm = '300';

export interface VatReturnRecord {
  id: string;
  /**
   * The calendar row this record discharges — the `VatObligation.id` the art. 322/323 calendar generated.
   *
   * The join cannot be on `id`: the store mints that, and a decont has to be matched to the *period* it
   * covers. Nor can it be on the year: a Q4 2026 decont is due 25 ianuarie 2027, so the term and the period
   * sit in different calendar years. One field naming the obligation is the only join that survives both.
   */
  obligationId: string;
  /** The year the PERIOD belongs to — not the year the term falls in. A Q4 2026 decont has `year: 2026`. */
  year: number;
  form: VatReturnForm;
  /** `month` | `quarter` | `partial`, mirroring `VatFiscalPeriod` in `domain/fiscal/vatReturn.ts`. */
  periodKind: 'month' | 'quarter' | 'partial';
  /** 1-12 for `month`; 1-4 for `quarter`; the first month of the span for `partial`. */
  periodIndex: number;
  /** Only set for `partial` — the last month of the distinct period (art. 322 alin. (7) lit. b)). */
  periodToMonth?: number;
  status: VatReturnStatus;
  /** The date the return was actually filed. Meaningful only with `depusa`; absent means not recorded. */
  filedOn?: string;
  /** The registration number or proof reference the tax office gave, when the user recorded one. */
  reference?: string;
}

/**
 * The ONE test that says "this record proves a VAT return was filed".
 *
 * It takes a `VatReturnRecord` and nothing else, for the same reason `isFiledFiling` takes an
 * `AnnualFiling`: a monthly row's `'inregistrata'` must never pass for proof of a submission, and an annual
 * D212 filing does not discharge a decont either.
 */
export const isFiledVatReturn = (r: Pick<VatReturnRecord, 'status'>): boolean => r.status === 'depusa';

// ── Fișa de ocupare a capacității de cazare (PG-6h-3) ────
/**
 * OPANAF nr. 381 din 24.03.2026, MO I nr. 250 din 31.03.2026 — „Fișa de ocupare a capacității de
 * cazare", approved under CF art. 68^3 alin. (8) and art. 85 alin. (8)-(9). It abrogates OPANAF 398/2021;
 * ANAF's own D212 instructions (OPANAF 2736/2025) still point at the abrogated order, so every sentence
 * in this app that names a fișă names **381/2026**.
 *
 * **It is a retention obligation, not a filing.** The order's wording is „să completeze și să
 * păstreze", and its Annex 3: „Se întocmește **un exemplar**, de către contribuabil. **Se păstrează de
 * către contribuabil.**" Nothing here is submitted, so there is no submission path, no upload and no
 * deadline in this module — the only deadline is the taxpayer's own duty to keep the sheet.
 *
 * **This is the first data in this application about people who are not the user.** D-OCC-1 accepted
 * that, and its consequences are the constraints on everything below: local storage only, no network
 * path, no export default, real deletion, and no guest field that any calculation can read. The shape
 * of that guarantee is decided by WHERE these records live, not by how carefully they are read — see
 * `occupancySheets` on `AppData` for why they are not on the profile.
 */
/**
 * Which identifier the taxpayer recorded for the guest. The order asks for the CNP „sau, după caz,
 * seria și numărul actului de identitate" for a guest who has no CNP, so the form has two answers and
 * the app records which one was given.
 *
 * This is the person's own statement. It is **never inferred from the shape of the value** — a value
 * that looks like 13 digits is not evidence of a CNP, and inferring one would be the same class of
 * mistake as answering a fiscal question from a CAEN code.
 */
export type GuestIdentifierKind = 'cnp' | 'act_de_identitate';

/**
 * One stay in one room: who stayed, on which identifier, from which day to which day.
 *
 * Every field is recorded by the taxpayer and reproduced as recorded. `guestIdentifier` is deliberately
 * a plain string with no checksum and no charset rule: a CNP has a check digit, but the app records what
 * the taxpayer recorded, so a suspect value may be **flagged** and must never block the stay or reject
 * the stored payload.
 */
export interface OccupancyStay {
  id: string;
  /** Secțiunea II — numele guest-ului, as the taxpayer wrote it. */
  guestName: string;
  /** Secțiunea II — CNP, or the ID series and number where there is no CNP. */
  guestIdentifier: string;
  /** Which of the two the person recorded. Never derived from `guestIdentifier`. */
  identifierKind: GuestIdentifierKind;
  /** Secțiunea II — first day of the stay, ISO calendar date. */
  firstDay: string;
  /** Secțiunea II — last day of the stay, ISO calendar date. */
  lastDay: string;
}

/**
 * One form, per room, per year — the order's own granularity. Not per stay (stays are rows inside it)
 * and not per property (Secțiunea I is repeated on every room's form).
 */
export interface OccupancySheet {
  id: string;
  /** „Anul" — four digits. The sheet is scoped to one calendar year, which is also the year the
   * 30-day ceiling in the order's definition of a short-term let is measured over. */
  fiscalYear: number;
  /** Secțiunea I — adresa imobilului. */
  propertyAddress: string;
  /** Secțiunea II — which room or amenaged space this form covers. */
  roomLabel: string;
  stays: OccupancyStay[];
}

/**
 * The order's definition of a short-term let, and the two rules the sheet's dates are read under:
 * „închirierea neîntreruptă a unei camere aceleiași persoane, pentru perioade de **maximum 30 de zile**,
 * într-un an calendaristic", and „Închirierea/ocuparea … pentru o fracție de zi, se consideră
 * închiriere/ocupare pentru o zi."
 *
 * The ceiling is a **definitional flag, not a figure**. It says only that a stay longer than the order's
 * own definition may not be a short-term let under it. It is not an occupancy statistic, not a night
 * count for revenue, and nothing outside the sheet's own row reads it.
 */
export const SHORT_TERM_LET_MAX_DAYS = 30;

/**
 * True when one stay spans more days than the order's definition of a short-term let allows.
 *
 * A fraction of a day counts as a day, so a stay from the 3rd to the 4th is two days. Dates are
 * compared as calendar days; a malformed date returns `false` rather than throwing, because a suspect
 * value must never turn into a crash on a page that shows a person their own retained document.
 */
export const occupancyStayExceedsShortTermCeiling = (stay: Pick<OccupancyStay, 'firstDay' | 'lastDay'>): boolean => {
  const first = Date.parse(`${stay.firstDay}T00:00:00Z`);
  const last = Date.parse(`${stay.lastDay}T00:00:00Z`);
  if (!Number.isFinite(first) || !Number.isFinite(last)) return false;
  const days = Math.round((last - first) / 86_400_000) + 1;
  return days > SHORT_TERM_LET_MAX_DAYS;
};

/**
 * A CNP-shaped value: 13 digits. Used only to **flag** a suspect identifier — never to reject a record,
 * never to block a save, and never to decide anything.
 *
 * The check digit is deliberately not verified. The app records what the taxpayer recorded; refusing a
 * stay because a CNP looks wrong would put the app in the position of correcting a document it has no
 * authority to correct.
 */
export const isCnpShaped = (value: string): boolean => /^[0-9]{13}$/.test(value.trim());

// ── Documente (dashboard) ─────────────────────────────────
export interface DocumentItem {
  id: string;
  nume: string;
  data: string;
  categoria: string;
}

// ── Documente ale firmei ──────────────────────────────────
export type DocTypeCode = 'im' | 'cs' | 'tva' | 'facturi';

export interface CompanyDocument {
  id: string;
  nume: string;
  tip: 'factura' | 'notafactura' | 'bon-fiscal' | 'pdf' | 'png' | 'jpg';
  /**
   * PG-11 (phase 29): the bytes, **inline**. Optional now, and the two empty states are different facts:
   *  - `content` present — the bytes are in the record, which is what every payload written before
   *    PG-11 looks like, and what a record keeps if the blob store rejected the write;
   *  - `blobRef` present, `content` absent — the bytes live in the blob store and this record points at
   *    them;
   *  - neither — the record describes a document with no bytes attached, which is what an upload that
   *    never completed leaves behind.
   *
   * Nothing may treat "no `content`" as "no document": the row still exists, still counts, and its bytes
   * are read back through `resolveBlobContent`.
   */
  content?: string;
  /** PG-11: the blob store key holding this document's bytes. Never generated independently of the
   *  record — see `documentBlobId` in `data/blobStore.ts`, and why a derived id is what makes a
   *  relocation idempotent. */
  blobRef?: string;
  marime: number;
  data: string;
  dataDepunere?: string;
  depunere?: string;
  perioada?: string;
}

// ── Declarații fiscale depuse ────────────────────────────
export interface TaxStatement {
  id: string;
  tip: string;
  perioada: string;
  depunere: 'SOLO' | 'personală';
  dataDepunere?: string;
  nume?: string;
  /** PG-11: same three states as `CompanyDocument.content`. */
  content?: string;
  /** PG-11: the blob store key holding this statement's bytes. See `statementBlobId`. */
  blobRef?: string;
}

// ── Setări ────────────────────────────────────────────────
export interface CompanyCaen {
  cod: string;
  descriere: string;
}

export interface BankAccount {
  id: string;
  banca: string;
  moneda: string;
}

export interface SettingsState {
  cotaTva: number;
  company: {
    denumire: string;
    cui: string;
    numarRegComert: string;
    adresa: string;
    codTvaIntra?: string;
    caen: CompanyCaen[];
    mentiuniFactura?: string;
    cnp?: string;
    formaJuridica?: string;
    codFiscal?: string;
    codCAEN?: string;
    regComerț?: string;
    telefon?: string;
    email?: string;
    contBancar?: string;
    banca?: string;
  };
  personal: {
    nume: string;
    cnp: string;
    adresa: string;
    telefon: string;
    email: string;
  };
  bankAccounts: BankAccount[];
  eFactura: {
    /**
     * B-140 (D-EFACT-1) — **retired from the write vocabulary; still readable.**
     *
     * The screen used to offer a sending deadline, and the option it offered was wrong: it read „În decurs
     * de 2 zile de la emitere” while the app's own cited source — OUG 120/2021 art. 10 alin. (7) as amended
     * by OUG 89/2025, in force from 01.01.2026 — states **5 zile lucrătoare**. `docs/ai/research/16` §Q2
     * confirms the article and the unit, and records that the unit flipped from calendar days back to
     * working days on 01.01.2026. The card now states the deadline as a cited fact instead of offering it as
     * a preference, because the date-limit of a legal deadline is not something a person can choose.
     *
     * **Why the key stays on the type and in the schema.** This is read-wide / write-narrow, the same shape
     * B-141 pinned for `transmisa`. zod strips undeclared keys, so deleting the declaration would make the
     * LOAD GATE the thing that destroys the value — and before this step the gate did worse: it *refused*
     * the payload. The select wrote `'2-zile'` and `'imediat'` while the enum declared only `'manual'` and
     * `'automat'`, so a person who touched that dropdown quarantined their own dataset. The union below is
     * therefore the union of **both** vocabularies this app has ever written, and the named
     * `efactura-deadline` step is what drops the key, with a recorded reason.
     *
     * **Nothing maps one vocabulary onto the other.** `'manual'` / `'automat'` answer *how* the invoice gets
     * into e-Factura; `'2-zile'` / `'imediat'` answer *when*. Picking a correspondence would put a sentence
     * in the person's mouth that they never wrote, so the step retires the key rather than re-pointing it,
     * and the e-Factura card says on screen what happened to the choice.
     *
     * Optional, and no code writes it any more.
     */
    trimitere?: 'manual' | 'automat' | '2-zile' | 'imediat' | '5-zile-lucratoare';
    dateContact: string;
  };
}

// ── Toasts ────────────────────────────────────────────────
export type ToastKind = 'success' | 'info' | 'error';

export interface Toast {
  id: string;
  kind: ToastKind;
  text: string;
}

// ── App data ──────────────────────────────────────────────
export interface AppData {
  profile: PfaProfile;
  revenues: Revenue[];
  expenses: Expense[];
  clients: Client[];
  /**
   * PG-5 (B-34): the annual returns this profile has filed or is preparing.
   *
   * This is the record a deadline can be marked done from. It is empty until the user records a
   * filing — the migration step never mints one, because minting one would assert a filing that
   * nobody made.
   */
  filings: AnnualFiling[];
  /**
   * PG-6g — the periodic VAT returns (formular 300) this profile has filed or is preparing, one record per
   * fiscal period.
   *
   * Required on `AppData` and optional on `PersistedAppData`, exactly like `filings`: **absent means none
   * recorded**, and the v18→v19 step opens it as `[]` without minting anything. A calendar row is not a
   * filing — the calendar says an obligation exists, this collection says the person recorded discharging
   * it, and only the second one can mark a term done.
   */
  vatReturns: VatReturnRecord[];
  /**
   * PG-6h-3 (D-OCC-1): the occupancy sheets this taxpayer keeps, per room, per year.
   *
   * **Why this is a top-level collection and not a field on `profile`.** That choice is the whole privacy
   * guarantee, and it is forced by the tree rather than chosen for tidiness. `snapshots/snapshot.ts`
   * builds `inputSnapshot` as `{ profile, revenues, expenses }` and `snapshots/serialize.ts`
   * `canonicalize` emits **every own key** of what it is handed, so a guest name or CNP carried on the
   * profile would (a) enter the bytes of every stored `inputsHash`, (b) move a fiscal digest when a
   * guest's stay changed, and (c) survive deletion of the sheet, because each stored snapshot keeps its
   * own copy of the profile — which would break acceptance 5 outright. On `AppData` the collection is
   * outside the engine's operand type by construction: `CalculationInput` cannot reach it, so "the engine
   * must not read this data" is a structural fact here, not a discipline someone has to keep.
   *
   * Optional, and absence is the honest state: the v13→v14 chain step backfills nothing, because a sheet
   * the taxpayer never made cannot be minted by a migration. The load path resolves absence to `[]`.
   */
  occupancySheets: OccupancySheet[];
  /**
   * PG-6c (D-VEH-3): the vehicles this taxpayer owns or holds in use, with per-year declared facts.
   *
   * A top-level collection rather than a field on `profile`, for the reason `occupancySheets` above
   * records: `snapshots/snapshot.ts` hashes `{ profile, revenues, expenses }`, so a collection placed on
   * the profile would enter every stored `inputsHash`. For vehicles the direction of that consequence is
   * the opposite of the occupancy one — a car's use fact *does* change the estimate, so it arguably should
   * be in the digest — and the finding is recorded in `docs/ai/phases/41_pg6c_vehicle_facts.md` rather
   * than fixed here, because the snapshot layer is not this task's to redraw.
   *
   * Required on the loaded object, never on the payload: the load path resolves an absent key to `[]`, and
   * the v14→v15 step backfills nothing, because a car the taxpayer never had cannot be minted by a migration.
   */
  vehicles: Vehicle[];
  /**
   * PG-6e (B-31, D-FA-1): the fixed assets this taxpayer holds in the business patrimony.
   *
   * On `AppData` and never on `profile`, for the reason `occupancySheets` above records: `snapshots/
   * snapshot.ts` hashes `{ profile, revenues, expenses }` and `snapshots/serialize.ts` emits every own key
   * of what it is handed, so an asset carried on the profile would enter every stored `inputsHash`, move a
   * fiscal digest when an unrelated fact changed, and survive the asset's own deletion. Acceptance 9 of
   * this phase is exactly that proof — `inputsHash` byte-identical with an asset present.
   *
   * Required on the loaded object, never on the payload: the load path resolves an absent key to `[]`, and
   * the v16→v17 step backfills nothing, because an asset nobody acquired cannot be minted by a migration.
   */
  fixedAssets: FixedAsset[];
  documents: DocumentItem[];
  companyDocs: Record<DocTypeCode, CompanyDocument[]>;
  statements: TaxStatement[];
  snapshots: TaxCalculationSnapshot[];
  settings: SettingsState;
  /**
   * TASK 3: the cash the user has actually set aside for this year's taxes, in integer **bani**.
   *
   * Tri-state, and the two empty states are NOT the same fact:
   * - `null` — **no reserve recorded**. The user has never entered an amount; it renders as
   *   „Nicio sumă înregistrată”, never as `0,00 lei`;
   * - `0` — an explicit, real fact: the user recorded that they have set aside nothing.
   *
   * Required on the runtime object (never `undefined`) so a consumer cannot mistake „absent from an
   * old payload” for a fourth state: the load path normalises an absent stored field to `null`, and
   * the migration chain backfills nothing — the v6→v7 step invents no money.
   *
   * Strictly DOWNSTREAM of the estimate: nothing in the tax calculation may read this field.
   */
  reservedAmount: Bani | null;
  /**
   * Phase 10 (B-26): the report the `money-bani` step produced when a stored value could not be
   * reproduced exactly as an integer number of bani. It lives on the **loaded dataset**, not only on the
   * migration result, because the save effect spreads this object back into localStorage — a report that
   * lived only in the migration result was erased by the first write after a load, which is the
   * "surface, not vanish" rule failing silently. `undefined` means "nothing had to be decided", and
   * `JSON.stringify` drops the key rather than writing an empty array.
   */
  moneyNotices?: MoneyPrecisionNotice[];
  /**
   * TASK 10a: the FX rates this install holds — fetched from BNR or entered by hand, each with its
   * provenance.
   *
   * Optional, and absence is meaningful: it means **no rate has been recorded**, which is the state of every
   * payload written before this task and of a fresh install. The migration chain backfills nothing here, on
   * the same principle the `tax-reserve` and `expense-category` steps follow — a rate is a fact about a
   * published number, and a step that manufactured one would be manufacturing a legal figure.
   *
   * Reads of this collection never fetch. A rate is a fact about the past: once recorded it is cached, and
   * `src/domain/fx/provider.ts` is the only place new records arrive.
   */
  fxRates?: FxRateRecord[];
}

// ── Formatare ─────────────────────────────────────────────
// Money formatting lives in exactly one place: `src/domain/money.ts` (`formatBani*`).
// There is deliberately no formatter here — a second `Intl` instance is what let the B-17
// half-cent disagreement happen (round-half-even here vs round-half-up in `toFixed`).

export const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
};

/**
 * Phase 10: money is an integer number of bani, so a record total is an exact integer sum —
 * `sumBani` throws rather than let a float accumulate here (`aggregation.ts` was the float origin).
 *
 * TASK 10a: the two addends are now `Money`, so the sum is guarded by `sumMoney` — a record whose
 * `valoareFaraTva` is EUR and whose `tva` is RON is a corrupt record, and it throws instead of
 * producing a total in an unnamed unit.
 */
export const total = (r: Revenue | Expense) => sumMoney([r.valoareFaraTva, r.tva], r.valoareFaraTva.currency);

/**
 * Sum of record totals for a list of records, **grouped by currency**.
 *
 * This lives here rather than in a `rows.reduce(...)` inside a component: accumulating money in the view
 * layer is how float drift reappears, and `reduce((s, e) => s + total(e), 0)` also drops the `Bani` brand
 * and starts from an unbranded `0`. `sumMoney` rejects a mixed-currency sum instead of absorbing one.
 *
 * TASK 10a: it returns one entry per currency rather than one number, because a register that holds both
 * a lei invoice and a euro invoice has **two** totals, and adding them would invent a figure in a unit
 * neither record was written in. The order is by currency code, so the same rows always render the same
 * subtotals in the same order.
 */
export const sumTotalsByCurrency = (rows: readonly (Revenue | Expense)[]): Money[] => {
  const byCurrency = new Map<CurrencyCode, Money[]>();
  for (const row of rows) {
    const bucket = byCurrency.get(row.valoareFaraTva.currency);
    const amount = total(row);
    if (bucket) bucket.push(amount);
    else byCurrency.set(row.valoareFaraTva.currency, [amount]);
  }
  return [...byCurrency.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([currency, amounts]) => sumMoney(amounts, currency));
};

/**
 * Declared net for one month, floored at zero — the figure the monthly declarations table used to show.
 *
 * PG-5b removed it with the record type: there is no monthly row left to subtract, and an annual return
 * carries no `venituri` / `cheltuieli` fields of its own — the figures it declares come from the
 * registers, not from a number typed into the filing.
 */

// ── Statusuri ─────────────────────────────────────────────
// The Romanian words for these statuses used to be spelled three times here — `REV_STATUS_LABEL`,
// `EXP_STATUS_LABEL`, `DECL_STATUS_LABEL` — with 'Înregistrată' and 'Respinsă' identical in all three.
// They are gone: `copy.recordStatus.revenueLabels / expenseLabels / declarationLabels` is the one place,
// and the status codes stay here as data only. `statusBadge` below keeps the code→colour mapping,
// which is presentation logic, not language.

export type BadgeKind = 'badge-neutral' | 'badge-info' | 'badge-success' | 'badge-warning' | 'badge-danger';

/**
 * The colour a stored status code wears, **total over `StoredStatusCode`**: `satisfies` makes a new
 * status a compile error here rather than a badge that quietly falls through to a default. The parameter
 * is the read-wide union, not `string`, so the union has a consumer and the map cannot drift from it.
 *
 * **B-141:** `transmisa` used to map to `badge-success`. This app transmits nothing to anyone — the
 * sentence that claimed it was deleted in brief 66 (B-56) — so green asserted an external system had
 * accepted something, and it painted that assertion for a status no producer can create. It now wears
 * `badge-neutral`: the word remains readable (see the `StoredStatusCode` note) and stops rendering as an
 * achievement. `badge-success` is not reachable from this map at all.
 */
const STATUS_BADGE = {
  'in-asteptare': 'badge-warning',
  respinsa: 'badge-danger',
  inregistrata: 'badge-neutral',
  // Legacy and readable, never a success: see `StoredStatusCode`.
  transmisa: 'badge-neutral',
} satisfies Record<StoredStatusCode, BadgeKind>;

export const statusBadge = (status: StoredStatusCode): BadgeKind => STATUS_BADGE[status];

// ── Secțiuni documente ────────────────────────────────────
/**
 * A document section is a code, an icon and whether it takes several files. The Romanian words that
 * name a section are not here — they live in `copy.documents.sections`, keyed by the same code. This
 * file is the data shape; it used to carry the labels too, which put UI wording below the data layer
 * where no language test could reach it.
 */
export interface DocSection {
  code: DocTypeCode;
  icon: string;
  allowMultiple: boolean;
}

export const DOC_SECTIONS: DocSection[] = [
  { code: 'im', icon: '📋', allowMultiple: false },
  { code: 'cs', icon: '🏥', allowMultiple: false },
  { code: 'tva', icon: '🧾', allowMultiple: false },
  { code: 'facturi', icon: '📄', allowMultiple: true },
];

export const DOC_SECTION_MAP: Record<DocTypeCode, DocSection> = Object.fromEntries(
  DOC_SECTIONS.map(s => [s.code, s])
) as Record<DocTypeCode, DocSection>;

// ── Utilitare fișiere ─────────────────────────────────────
export const MAX_DOC_BYTES = 5 * 1024 * 1024;

export const docTipFromName = (name: string): CompanyDocument['tip'] => {
  const n = name.toLowerCase();
  if (n.endsWith('.pdf')) return 'pdf';
  if (n.endsWith('.png')) return 'png';
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'jpg';
  if (n.includes('bon')) return 'bon-fiscal';
  if (n.includes('nota')) return 'notafactura';
  return 'factura';
};

export const formatBytes = (bytes: number) => {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
};

export const todayISO = (instant: Date = now()) => localDateISO(instant);

export const downloadDataUrl = (content: string, name: string) => {
  const a = document.createElement('a');
  a.href = content;
  a.download = name;
  a.click();
};

export const downloadText = (text: string, name: string) => {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
};
