/**
 * The persisted-data version chain (decision D-2).
 *
 * Contract
 * --------
 * - The storage key never changes: everything lives under `pfa-app-data-v2`
 *   (`store.tsx`). Versioning is a field inside the payload, not a new key, so
 *   an old install is upgraded in place instead of orphaned.
 * - `version` is OPTIONAL in `persistedAppDataSchema`. A payload with no
 *   `version` key is the BASE of the chain (`DATA_VERSION_BASE`): that is
 *   exactly what every payload written before Phase 7 looks like. Absence is
 *   therefore meaningful data, not a missing default — which is why the schema
 *   has no `.default()`.
 * - A payload whose `version` is HIGHER than `CURRENT_DATA_VERSION` is rejected
 *   as unreadable rather than down-migrated or guessed at. That happens when a
 *   newer build wrote the payload and this build opened it; silently dropping
 *   fields the newer build added would be data loss.
 * - Steps run in order, each `from → to`, and the chain is applied to the whole
 *   dataset at once. A step must be idempotent-safe: it may inspect what is
 *   already present and leave it alone.
 *
 * Every step and every field it backfills is documented inline and in
 * `docs/ai/phases/07_identity.md`.
 */
import type { CaenCode, PfaIdentity, PfaProfile } from '../domain/models';
import { computeInputsHashSync } from '../domain/snapshots/hashSync';
import type { TaxCalculationSnapshot } from '../domain/snapshots/types';
import { baniFromLei, lei, money, type Bani, type Money } from '../domain/money';
import type { Expense, Revenue } from './types';
import { localYear, now, toInstantISO } from '../domain/date';
import type { SettingsState } from './types';
import type { PersistedAppData } from './schema';

/** A payload with no `version` key: written before Phase 7 introduced versioning. */
export const DATA_VERSION_BASE = 0;
/** Phase 7 step 1: the `profile` collection is materialized from `settings` (the Phase 6 backfill, made explicit). */
export const DATA_VERSION_PROFILE = 1;
/** Phase 7 step 2: `profile.identity` becomes the one identity store (D-1). */
export const DATA_VERSION_IDENTITY = 2;
/**
 * Phase 9 step 3: records may carry a **collected** date (`Revenue`) / **paid** date (`Expense`)
 * — CF art. 68 alin. (2) lit. a) „sumele încasate" / art. 68 alin. (4) lit. b) „anului în cursul
 * căruia au fost plătite". See `migratePaymentDatesV3` and `docs/ai/phases/09_payment_dates.md`.
 */
export const DATA_VERSION_DATES = 3;
/**
 * Pre-Phase-10 step 4: the profile may carry the date the VAT turnover ceiling was exceeded
 * (`PfaProfile.vatExceedanceDate`). That is the input `VAT_REGISTRATION_DEADLINE_2026` has been
 * missing since Phase 9b — the rule was correct, cited and rule-driven, but no field existed to
 * feed it, so it could only ever resolve `not_applicable`. See `migrateVatExceedanceDateV4`.
 */
export const DATA_VERSION_VAT_DATE = 4;
/**
 * Phase 10 step 5: money stops being a float number of lei and becomes an integer number of **bani**.
 * See `docs/ai/phases/10_money_precision.md` §2.2 — this is the step that touches the user's money, so it
 * is the one step in the chain that must never change a value by accident.
 */
export const DATA_VERSION_MONEY_BANI = 5;
/**
 * TASK 2b step 6: an expense may carry a deductibility **category** (`Expense.category`), the token the
 * CF art. 68 classifier reads. See `migrateExpenseCategoryV6` and `docs/ai/phases/14_expense_deductibility_wiring.md`.
 *
 * This is the third pure schema-widening step in the chain (after `payment-dates` and
 * `vat-exceedance-date`): it backfills NOTHING. An uncategorised expense is legal input — it classifies
 * as `undetermined` and is excluded from the deductible total — so leaving the field absent is both the
 * honest state and the safe one for the user's money.
 */
export const DATA_VERSION_EXPENSE_CATEGORY = 6;
/**
 * TASK 3 step 7: the dataset may carry a recorded tax reserve (`AppData.reservedAmount`, integer bani,
 * `null` = no reserve recorded). See `migrateReservedAmountV7` and
 * `docs/ai/phases/17_tax_reserve_persistence.md`.
 *
 * The fourth pure schema-widening step in the chain (after `payment-dates`, `vat-exceedance-date` and
 * `expense-category`): it backfills NOTHING. A reserve is a fact about money the user has physically
 * set aside, and no legacy field records it — inventing `0` would assert that the user recorded they
 * had set aside nothing, which is a different fact from never having recorded anything, and it would
 * silently clear the „Rezervă fiscală sub țintă” warning the task exists to make clearable.
 */
export const DATA_VERSION_TAX_RESERVE = 7;
/**
 * TASK 5 step 8: the profile may now carry the pension facts that CF art. 174 alin. (7)/(8) and art.
 * 153 alin. (2) actually test — pension sums received per fiscal year, a recorded suspension, the
 * previous-year art. 174 alin. (8) context, and proved foreign sickness/maternity insurance. See
 * `migratePensionFactsV8` and `docs/ai/phases/19_pension_cass_input_model.md`.
 *
 * This is the fifth schema-widening step, and the first of them that RENAMES a key. The rename carries
 * a fact across unchanged; it does not create one. An old `pensionStatus: 'da'` recorded *calitatea de
 * pensionar*, which is what `pensionerStatus` means, so that value travels. What does NOT travel is any
 * inference from it: no legacy field records whether pension sums were received in the income year, so
 * `pensionReceiptYears` stays absent and the art. 174 alin. (7) lit. c) relief becomes undecidable
 * (`unknown` / REVIEW_REQUIRED) for every migrated profile — neither granted nor refused.
 */
export const DATA_VERSION_PENSION_FACTS = 8;
/**
 * TASK 6 step 9: a calculation snapshot now records `ruleSetHash`, the digest of the rules that produced
 * it. See `migrateRuleSetDigestV9` and `docs/ai/phases/20_rule_release_immutability.md` §5.
 *
 * This is a shape change to the STORED SNAPSHOT, so it is a version bump and a named chain step — not a
 * silent widening. What the step refuses to do is the interesting part: it does NOT compute a digest for
 * a snapshot that lacks one. The rules that produced a pre-v9 snapshot were never content-addressed, and
 * the rule set has since moved (the CAS, CASS and income-tax corrections all changed formula-bearing
 * parameters under an unchanged `releaseId`). Hashing today's rules and stamping the result onto an old
 * record would manufacture the one fact the record is supposed to guarantee. The step writes `null`:
 * the record says out loud that its arithmetic cannot be reconstructed.
 *
 * No `inputsHash` moves. `inputSnapshot` is still the enumerated subset `{ profile, revenues, expenses }`
 * that TASK 3 pinned, and the rule digest deliberately sits BESIDE it on the calculation record, never
 * inside it — putting it inside would have re-hashed every stored snapshot and made stored history claim
 * inputs the user never gave.
 */
export const DATA_VERSION_RULE_SET_DIGEST = 9;

/**
 * TASK 10a (B-32): a stored `Revenue`/`Expense` money field becomes a `Money` — the integer minor-unit
 * count **plus** the currency it is counted in. Before this step a record held a bare number and the leu
 * was the only unit the type could name, so a EUR invoice was arithmetically indistinguishable from a lei
 * invoice and was added to lei totals. That was defect B-32, and it was invisible: the app could not
 * represent a foreign amount at all, so it could not mis-treat one loudly either.
 *
 * ## What the step does
 *
 * Wraps each `revenues[].valoareFaraTva|tva` and `expenses[].valoareFaraTva|tva` as
 * `{ amount: <the same number>, currency: 'RON' }`. The number is copied **verbatim** — not rescaled, not
 * rounded, not passed through `baniFromLei`. `baniFromLei` is a unit conversion (lei → bani) and this step
 * is a shape change; conflating the two is how a migration silently edits someone's ledger. Every existing
 * figure is therefore bit-identical, which is what "value-preserving no-op" means here.
 *
 * Existing records are stamped RON because that is what they always were: each one came from a form
 * labelled `(RON)` and was read by an engine that could only add it to lei totals. Stamping RON records
 * what the data is; it is not a default applied to unknown data.
 *
 * ## What the step deliberately does NOT touch
 *
 * - **`declarations[].venituri|cheltuieli` and `profile.cashFloorLei|salaryIncomeLei`.** A Declarația Unică
 *   is filed in lei and a profile cash floor is a leu amount; those stay `Bani`. Widening them would imply
 *   the app can hold a euro filing, and it cannot.
 * - **Anything inside a snapshot — and no `inputsHash` moves.** This is the migration decision TASK 10a had
 *   to make explicitly, and it was made from the canonicalisation rather than from a comment:
 *   `canonicalize` (`domain/snapshots/serialize.ts`) emits every own enumerable key, keys sorted, and the
 *   payload it is fed is `CalculationInput = { profile, revenues: Bani, expenses: Bani }`
 *   (`domain/snapshots/types.ts`) — **aggregate RON totals, not record arrays**. A currency field on a
 *   `Revenue` is therefore unreachable from the digest bytes: a snapshot never stored the record, it stored
 *   the number the record was summed into. Stored digests cannot move, so the step writes no
 *   `preMigrationInputsHash`.
 *
 *   The alternative — putting a currency marker inside `inputSnapshot` so the hash *would* move — is the
 *   forbidden blanket re-hash, and it is already blocked: `snapshots.test.ts:437` pins
 *   `Object.keys(inputSnapshot).sort() === ['expenses','profile','revenues']`. A historical snapshot stays
 *   interpretable for the same reason it was interpretable before: its `revenues`/`expenses` are the
 *   post-conversion lei totals the engine actually consumed, and `ruleSetHash` **beside** the payload (never
 *   inside it) says which rules did the consuming.
 *
 * ## Why the load gate still accepts the old shape
 *
 * `safeParse` runs before the chain, so `persistedAppDataSchema` must parse a pre-v10 payload or every
 * existing install quarantines. It accepts a bare number and converts nothing — see `moneyField` in
 * `schema.ts`. This step is where the shape actually changes.
 */
export const DATA_VERSION_RECORD_CURRENCY = 10;
/**
 * PG-5 (B-34): the dataset can now hold an annual return (`AnnualFiling`).
 *
 * PG-5b changed what this step DOES with the monthly rows a pre-v11 payload carried: it **drops** them.
 * The step keeps its number, its position in the chain and its idempotency — a chain step is never
 * renumbered, reordered or deleted, because a payload in the wild sits at whatever version it was written
 * at and the chain has to be able to walk it from there. Only the behaviour moves.
 *
 * PG-5 preserved the rows byte for byte because they were the only place some facts existed for a real
 * install. `docs/ai/USER_DECISIONS.md` D-USER-1 records that there are no active users and therefore no
 * stored payload to protect, and a PFA în sistem real has no monthly return for the shape to be a record
 * of. Keeping the vocabulary alive cost a second status vocabulary, a legacy bucket in the schema, the
 * store and the types, and B-75 (bare integer `bani` with no currency record) existed only because those
 * rows were kept.
 *
 * What this step still does NOT do is the half that matters: it does not turn a monthly row into an
 * annual filing. A monthly `{an, luna, status: 'inregistrata'}` record is not evidence that a Declarația
 * Unică was filed for that year, and minting one would assert a fact the user never established. So the
 * rows are dropped and `filings` starts empty: absence stays representable, and nothing is invented on
 * the way out.
 */
export const DATA_VERSION_ANNUAL_FILING = 11;
/**
 * PG-6b (B-29): the profile can now record the **declared** activity family — `other` or `cazare`.
 *
 * This step backfills nothing, and that is the whole content of it. No pre-v12 field holds the fact, and
 * defaulting an unanswered profile to `'other'` would assert that the ordinary sistem real rules apply to
 * a person who was never asked — the exact move `research/30` §3 forbids, because OMFP 925/2017 art. 2
 * alin. (4) keys the determination method to the activity description „independent de codurile CAEN
 * menționate cu titlu exemplificativ”. A code is not a statement about how the law taxes this person, and
 * neither is an absent field.
 *
 * So the payload keeps its silence, and the silence is now *reported*: `scenarios.ts
 * activity-family-undeclared` reads the absence and routes it through PG-1's `fact_missing` coverage
 * channel, which makes the estimate `incomplete` instead of quietly complete. That is the difference
 * between an unanswered question and an answered one, and it is the reason this step exists at all — a
 * field added without a version stamp would let a stored payload look identical to one that answered.
 */
export const DATA_VERSION_ACTIVITY_FAMILY = 12;
/**
 * PG-6h-2 (B-82, B-84): the profile can now record the accommodation facts the accommodation *title*
 * turns on — how many short-term-let rooms in which fiscal year, the person's own answer to the CF
 * art. 68^3 alin. (1) tourism-operator gate, and which reading of alin. (3) they choose for their gross.
 *
 * Like v12, this step backfills nothing, and that is its entire content. No pre-v13 field holds any of
 * these facts, and a default would not be a convenience — it would be a legal assertion:
 *
 * - a room count of 1–7 puts the receipts in *cedarea folosinței bunurilor* (art. 83 alin. (2), art. 85);
 *   more than 7 puts them in a activitate independentă under art. 68^3 (art. 83 alin. (4)). **The count is
 *   a category switch, not a threshold**, so a migrated payload that was given a number was given a tax
 *   title it never claimed;
 * - a default commission reading would settle B-80, which two live readings and no primary source leave
 *   open, and the choice moves gross, therefore tax, the CASS base and the CAS threshold;
 * - a default eligibility answer would decide a tourism-law classification the Codul fiscal does not
 *   decide and this app cannot verify.
 *
 * So every payload keeps its silence, and the silence is reported: `scenarios.ts
 * accommodation-gross-undetermined` and `accommodation-title-cedarea-folosintei` read the absence and
 * refuse, rather than picking a title and producing a figure under rules that may not be this person's.
 */
export const DATA_VERSION_ACCOMMODATION_FACTS = 13;
/**
 * PG-6h-3 (D-OCC-1) — the dataset can now hold the occupancy sheet, OPANAF 381/2026.
 *
 * The step's entire content is that it **backfills nothing**, and for this collection that is not a
 * convention but the only safe behaviour. A sheet is a document the taxpayer completed by hand, per room,
 * per year, recording other people's names and identity numbers. A step that opened the collection with a
 * placeholder sheet, or that inferred one from the recorded room count, would mint stays for guests who
 * never existed and put their names on a document the taxpayer is legally required to keep — the worst
 * kind of invented fact this repository has spent the series refusing.
 *
 * Two things the step must also not do, both recorded here because the surrounding files invite them:
 *  - it must not move these records onto the profile. `snapshots/snapshot.ts` hashes the whole profile
 *    into `inputsHash`, so guest data carried there would enter fiscal digest bytes and would survive
 *    deletion inside every stored snapshot;
 *  - it must not derive anything from `accommodationRoomCounts`. The room count is a declared annual fact
 *    that picks a tax title; the fișă is a per-stay document. `docs/ai/phases/38_pg6h2_accommodation_facts.md`
 *    warns that the count must not be used as an occupancy record, and a migration that bridged the two
 *    would be exactly that bridge.
 */
export const DATA_VERSION_OCCUPANCY_SHEET = 14;
/**
 * PG-6c (D-VEH-3) — the dataset can now hold **vehicles**, with facts declared per car and per fiscal
 * year: whether the taxpayer or an associate member personally uses the car, how it is actually used
 * (`exclusive` / `mixed` / `not_used` / `unknown`), which of the five exception categories at art. 68
 * alin. (7) lit. k) is claimed, and which single car the person designates to carry the running-cost
 * allowance under art. 68 alin. (5) lit. j).
 *
 * The step **backfills nothing and attributes nothing**, and for this collection that is not a convention
 * but the whole point. Every one of those fields is a legal assertion:
 *
 * - a default `usedByPerson` would move a car inside or outside lit. j), which is limited by its own words
 *   to „autoturismele folosite de contribuabil sau membru asociat”;
 * - a default `designatedForRunningCosts` would **pick the car**, and `docs/ai/research/40_vehicle_one_car_limit.md` §1
 *   records that no primary source supplies any selection criterion at all — no „most expensive”, no
 *   „first registered”, no free election;
 * - a default `use` of `exclusive` would claim a deduction the taxpayer has not evidenced with documents
 *   and a *foaie de parcurs*, and a default of `not_used` would deny a deduction the law gives at 50 %.
 *
 * The step also does not link any expense to any car. `Expense.vehicleId` is written only by the person;
 * deriving it from a supplier name, from the `category` token or from a seed value is the inference
 * D-VEH-3 forbids. A payload that never named a vehicle ends with **no `vehicles` key at all**, and every
 * `vehicle_related` expense in it keeps behaving exactly as it did before this step: alin. (7) lit. k)’s
 * 50 % default, because there is no per-car fact to consult and no cap to enforce.
 */
export const DATA_VERSION_VEHICLE_FACTS = 15;
/**
 * PG-6d (D-OTH-1, D-OTH-2, D-LEG-1, B-41) — the profile can now record the **amounts** behind CF art.
 * 155 alin. (1) lit. c)-h), per fiscal year, and the old other-income **flags** are gone.
 *
 * Two things happen in this step, and neither invents a fact:
 *
 * 1. `profile.otherIncome` is **deleted**. `docs/ai/research/41_other_income_flags_and_cass_ladder.md` §5
 *    records why the list cannot be kept: it omits three of the six ladder categories, `concesiune` has
 *    **no referent at all** in the Cod fiscal, and `alte` is wider than art. 114 — wide enough to sweep in
 *    art. 61 lit. g) *jocuri de noroc* and lit. h) *transferul proprietăților imobiliare*, which never
 *    attract CASS. A flag that cannot be mapped to a litera cannot be converted into an amount, so there
 *    is nothing to carry forward. D-LEG-1 is the standing decision that retired shapes are deleted rather
 *    than preserved — there are no users, and no backfilling of facts nobody declared.
 * 2. `profile.cassLadderYears` opens **absent**. No pre-v16 field holds any of these amounts, and writing
 *    six zeros would not be a convenience but a legal assertion: art. 170 alin. (4) sums across all six
 *    litera, so a minted zero moves a person between the „no CASS at all” state and a 6 / 12 / 24-SM base.
 *    That is exactly defect B-41, and a migration must not commit it.
 *
 * The step is idempotent-safe: deleting an absent key is a no-op, and it writes the version unconditionally.
 */
export const DATA_VERSION_OTHER_INCOME_LADDER = 16;
/**
 * PG-6e (B-31, D-FA-1) — the dataset can now hold **fixed assets**, with the facts the fiscal depreciation
 * arithmetic needs: the date of entry into the patrimony, *punerea în funcțiune*, the depreciable fiscal
 * value (which per Titlul II norm pct. 28 lit. b) **includes VAT that became non-deductible**), the
 * taxpayer-declared *durata normală de funcționare*, the method, and the art. 28 alin. (21) sub-threshold
 * election that norm pct. 31 says is made at entry into the patrimony.
 *
 * The step **backfills nothing**, and for this collection that is not a convention but the whole point.
 * Every one of those fields is a legal assertion:
 *
 * - a minted `putInFunctionDate` picks the year depreciation starts in — and `research/36` §12.3 records
 *   that the term is **never defined** in fiscal law, so there is no fact the app could derive it from;
 * - a minted `entryDate` picks the art. 28 alin. (2) lit. b) threshold test, which is measured at entry and
 *   not at payment;
 * - a minted `normalLifeMonths` picks both the annual cota and the pct. 27 disposal ceiling, and pct. 27
 *   puts that choice expressly with the taxpayer („stabilită de contribuabil”);
 * - a minted `acquisition` of `cumparare` would decide the contested aport question that §10 records as
 *   unresolved between art. 68 alin. (7) lit. k¹) and art. 7 pct. 44 lit. c);
 * - a minted `subThresholdElection` would choose between two mutually exclusive branches that pct. 31 says
 *   are chosen at entry — an election a migration cannot make after the fact.
 *
 * A payload that never named an asset ends with **no `fixedAssets` key at all**. Nothing downstream
 * invents one: `depreciationSchedule` refuses on the missing facts and names the gap.
 */
export const DATA_VERSION_FIXED_ASSETS = 17;
/**
 * PG-6f (B-30, D-LEG-1) — the profile's `vatExempt` boolean is **dropped**, and the registration states
 * that replace it are opened as absent.
 *
 * This is the second step in the chain that removes stored data, the first being v15→v16's `otherIncome`
 * removal, and it stands on the same user decision: D-LEG-1 („we do not need legacy data. we have no
 * users yet. We should generally clean legacy stuff”). What is NOT done is the conversion a naive reading
 * would reach for — turning `vatExempt: false` into `inregistrat_art316`, or `true` into `scutit_art310`.
 * Neither is a mapping, because the boolean never recorded a registration state. `research/42` §11.2
 * lists the six states the law uses and says outright that the boolean expresses none of them; the seed
 * file said the same thing in its own words since PG-5. Converting it would mint a registration fact
 * nobody declared, and that one fact decides the money measure of every record in the register — the
 * same class of invented legal fact that made PG-2 refuse to backfill a payment date.
 *
 * So the key is dropped and the replacement is **asked**. A payload ends with no `vatRegistration` key at
 * all, and the estimate says it does not know whether this person charges TVA. Idempotent-safe for the
 * same reason v13-v17 are: it removes at most one key and writes a version.
 */
export const DATA_VERSION_INPUT_VAT = 18;
/**
 * PG-6g (B-35 residual, D-VAT-1) — the `vatReturns` collection is opened, and it opens **empty**.
 *
 * This is the collection that records the periodic VAT returns (formular 300, OPANAF 174/2026, MO I
 * 105/09.02.2026) this profile has actually filed. Nothing is backfilled, and nothing could be: a fiscal
 * period existing is not evidence that a return for it was submitted, and the app has never submitted one.
 * Minting a `depusa` row per period would manufacture the exact false proof PG-5b spent a whole step
 * removing — it would let a deadline be marked done from a record nobody made.
 *
 * The profile's periodicity facts are opened absent for the same reason the v18 step opened
 * `vatRegistration` absent. CF art. 322 alin. (3) asks for a figure the taxpayer **preconizes** — a
 * forecast only they can state — and alin. (4) turns on whether they came from the art. 310 exemption, a
 * legal status the register never recorded. A default periodicity would be the app answering a question
 * the taxpayer has not been asked yet, which is what D-VAT-1 exists to stop.
 *
 * Idempotent-safe for the same reason v13-v18 are: it adds at most one key and writes a version.
 */
export const DATA_VERSION_VAT_RETURNS = 19;
/**
 * B-105 — the profile can now hold the facts an ordinary *cedarea folosinței bunurilor* register carries:
 * what kind of tenant pays, what the contract stipulates for the year, the costs legally the owner's that
 * the tenant paid, the two art. 84¹ alin. (8) triggers, and when the contract was concluded.
 *
 * The step **backfills nothing**, and for this family that is not a convention but the only safe
 * behaviour. Each of these fields decides a legal consequence that no stored record evidences:
 *
 *  - a `tenantNature` invented here would move the income between art. 84 and art. 84¹, and with it the
 *    declaration duty — art. 122 alin. (6) lit. a) exempts the taxpayer from the Declarația Unică for the
 *    income where the tax is withheld at source and final, while art. 122 alin. (7) still requires one for
 *    the contributions, because CASS on ordinary rent is not withheld;
 *  - a `contractRentAnnual` invented from the register's collections would replace the accrual measure of
 *    art. 84 alin. (2) („indiferent de momentul încasării”) with the cash measure of art. 85 alin. (2)
 *    („încasate în cursul anului fiscal”) — the same total at 31 December and a different one on every
 *    other day of the year, which is the quietest way this area can be got wrong;
 *  - a `contractDate` invented here would mint a 30-day registration term under art. 83 alin. (5) that
 *    nobody owes.
 *
 * A payload that already carries `leaseFactsYears` keeps it untouched: this step opens a profile field, it
 * does not rewrite one.
 */
export const DATA_VERSION_LEASE_FACTS = 20;
/**
 * PG-11 (phase 29) — a document record may now carry a **pointer** to its bytes instead of the bytes.
 *
 * This is the step the brief calls justified, and it is justified by exactly one thing: **the persisted
 * shape changed.** `CompanyDocument.content` stopped being required and `blobRef` appeared on both document
 * record kinds, because bytes no longer have to live inside a record that travels through `localStorage`.
 *
 * **The step fills nothing in, and it could not if it tried.** The chain is entirely synchronous — every
 * step here is a pure `apply(data) => data`, with not one `async` or `Promise` in this file — and the store
 * the bytes move into is asynchronous. A step that reached for it would either break that contract or be a
 * step that silently does nothing. So the shape change lives here and the **bytes move outside the chain**,
 * after load, in `data/blobRelocation.ts`. Conflating the two is the failure mode this note exists to
 * prevent.
 *
 * Nothing is backfilled, and nothing could be: a record that never had bytes gets no pointer, and a record
 * that has them keeps them inline until a write to the blob store has actually been confirmed. A payload
 * that already carries `blobRef` keys is left untouched, which is what makes re-running the step a no-op
 * rather than a wipe.
 */
export const DATA_VERSION_DOCUMENT_BLOB_REF = 21;
/**
 * B-140 (D-EFACT-1) — the e-Factura sending-deadline preference is retired.
 *
 * **What was wrong, in one sentence:** the app offered a legal deadline as a preference, and the deadline it
 * offered was not the one it cites. `src/ui/copy/settings.ts` read „În decurs de 2 zile de la emitere” while
 * `src/ui/copy/notes.ts` `eFacturaDeadline` quotes OUG 120/2021 art. 10 alin. (7), as amended by OUG 89/2025
 * pct. 2 art. X in force from 01.01.2026: **5 zile lucrătoare**. `docs/ai/research/16` §Q2 confirms the
 * article, the unit and the date the unit flipped back to working days. D-EFACT-1 settled it without a new
 * Researcher pass — the corpus already held the correct citation, so the contradiction was a stale option,
 * not an open legal question.
 *
 * **Why this is a chain step and not a string edit:** the option was backed by a stored enum value, and the
 * two vocabularies this app wrote into that one field never agreed. `seed.ts` wrote `'manual'`; the select
 * wrote `'2-zile'` and `'imediat'`; the persisted enum declared only `'manual'` and `'automat'`. So the load
 * gate **refused** any payload whose owner had touched the dropdown — `store.tsx` → `rejected()` → quarantine
 * plus seed. The on-screen contradiction and the data-loss were the same defect seen from two sides.
 *
 * **Retire, not re-point.** `'2-zile'` / `'imediat'` answer *when* the person transmits; `'manual'` /
 * `'automat'` answer *how*. No correspondence between the two pairs is licensed by anything the person
 * recorded, and mapping `'2-zile'` onto a 5-working-day option would tell the taxpayer they chose a deadline
 * they never chose. So the step **drops the key** and the e-Factura card states, on screen, what the choice
 * was, what the legal term is, and that the app chose nothing in its place. That is the recorded reason, in
 * the place the person will actually read it — the same argument that closed B-106.
 *
 * **What this step drops, stated plainly:** one stored preference that no code ever read. It changed no
 * figure, produced no deadline and sent nothing — B-56 had already established the app has no e-Factura
 * client, so the card labelled the choice „o notă pentru tine”, not a rule the app obeys. Nothing else in
 * `settings.eFactura` moves: `dateContact` is a separate answer and stays exactly where it was.
 *
 * **Read-wide first.** The value is only droppable if the gate lets it in, so `EFACTURA_TRIMITERE_READ_VALUES`
 * in `data/schema.ts` widens the read union to all five tokens the app has ever written, at every version.
 * Brief 67's finding is the reason the ordering is pinned by a test rather than asserted here: a step that
 * runs *after* the data holding the value is gone proves nothing.
 */
export const DATA_VERSION_EFACTURA_DEADLINE = 22;
/**
 * B-108 — an expense may now name the fixed asset it belongs to.
 *
 * **What this step opens, and what it refuses to fill in.** `Expense.assetId` appears on the record. The
 * step writes the version and nothing else.
 *
 * The reason the field exists is a refusal that is currently broader than the truth. There are two routes to
 * the expense side of one capital asset — the schedule the fixed-asset register computes, and a hand-typed
 * `depreciation_business_asset` expense — and art. 68 alin. (4) lit. d) is the provision that connects them.
 * With no link on the expense, `selectAssetDepreciation` cannot tell which asset a typed line covers, so it
 * withholds **every** computed schedule in the register as soon as **one** typed depreciation expense
 * exists. One hand-typed line can therefore silence the schedules of assets it has nothing to do with.
 *
 * **Why nothing is backfilled.** Matching a line to an asset by amount, by date or by supplier is the
 * inference that was already rejected as one art. 68 alin. (4) lit. d) does not license, and that rejection
 * stands. A guessed link would do the opposite of what the field is for: it would narrow the refusal on a
 * fiction, which is worse than a refusal that is honest about being broad. So the person links the expense —
 * the same control, and the same standing, as `vehicleId` — and until they do, the conflict stays
 * register-wide and the coverage row says exactly that.
 *
 * A payload that already carries `assetId` keys is left untouched, which is what makes re-running the step a
 * no-op rather than a wipe.
 */
export const DATA_VERSION_EXPENSE_ASSET_LINK = 23;
/**
 * B-65 (carried from brief 74) — a disposed fixed asset may now record what it brought in.
 *
 * **The half-rule that has been waiting on this field.** Titlul II norm pct. 27 caps the unamortised
 * residual of an M1 taken out of the register at 1.500 lei × the months left of the duration the taxpayer
 * declared. Titlul IV norm pct. 7 lit. o) caps **that same residual a second time**, „la nivelul
 * venitului realizat din înstrăinare” — the proceeds of the disposal. Brief 74 implemented the first cap,
 * surfaced it as a coverage row, and deliberately did not post it, because nothing in the app held the
 * second one. Posting pct. 27's figure without it would over-deduct every time the asset sold for less than
 * it was still worth, which is the ordinary case rather than the exception.
 *
 * **What this step opens, and what it refuses to fill in.** `FixedAsset.disposalProceeds` appears on the
 * record. The step writes the version and nothing else. A sale price is a fact about a transaction: no
 * stored field records it, and deriving one from the fiscal value, from the residual or from the declared
 * duration would invent the very number the norm measures the deduction against. Absence is not zero — it
 * means the second limit exists and cannot be measured, and the app now says that instead of treating the
 * first limit as the answer.
 *
 * **What this step did NOT settle, and what settled it later.** B-153 was open when this step shipped and
 * was closed by brief 80 under **D-DEPR-1**: the schedule now stops in the month the asset leaves the
 * register, so the schedule and `disposalFigure` use one month count. That part was never optional —
 * `research/55` §4 shows pct. 7 lit. o) and art. 28 alin. (17) both derive the disposal figures from the
 * depreciation actually taken, so two counts on one asset is indefensible under any reading. **Which month
 * the schedule stops in is a reading, not a rule**: no stop rule exists in art. 28 alin. (12) lit. a)–n),
 * in Titlul II norms pct. 25–31, or in OMFP 170/2015, and the rejected alternative — stopping the month
 * after — argues from symmetry with the start rule at art. 28 alin. (12) lit. a). The truncation also does
 * **not** trigger the last-year-takes-the-remainder convention: that convention exists so a schedule run to
 * the end of the declared duration sums exactly to the fiscal value, and an asset that leaves early leaves a
 * residual instead. With the proceeds recorded the reported figure is the correct **ceiling** and still not a
 * safe amount to post — that is B-65's standing decision, not a month count.
 */
export const DATA_VERSION_DISPOSAL_PROCEEDS = 24;
/**
 * B-145 — a carried-in fiscal loss can now be persisted.
 *
 * **The gap brief 70 reported and deliberately did not fill.** Brief 70 built the engine side of art. 118
 * alin. (4)-(5) — per-source offset, chronological by age, 5-fiscal-year window, the 70 % cap, and the fact
 * that the offset is not elective („se reportează **și** se compensează”) — and asserted it twelve ways. It
 * then reported rather than closed the persistence gap, because the two halves of the rule want different
 * shapes: **D212 rd.5 asks for one total with no per-year column**, while art. 118 alin. (4)-(5) cannot be
 * applied to a total at all. The window, the per-source rule and the chronological order are each per-loss
 * facts. Brief 70 chose not to invent a persisted ageing schedule from a form field that does not carry one,
 * and that was the right call at the time — but it left the app able to compute the relief and unable to be
 * told about the loss, so `pierderiReportate` stayed `lei(0)` and every later year's tax was overstated by
 * the amount the person had already lost and reported.
 *
 * **What this step opens.** `profile.priorYearFiscalLosses`: one entry per source per loss year, each with
 * the year the loss was *determined* in. That per-year shape is what makes alin. (5) lit. a)'s „reportul se
 * efectuează cronologic, în funcție de veşimea pierderii” expressible, and alin. (4)'s „pentru o perioadă de
 * 5 ani fiscali” checkable.
 *
 * **What this step refuses to fill in, and what the screen says about it.** The step writes the version and
 * nothing else. A carried-in loss is a fact about a return already filed; no stored field records one, and
 * deriving one from a negative result in this register would invent a loss the person never declared. And the
 * honest limit stays on the record: because D212 rd.5 carries no per-year split, **the app can age a declared
 * split but cannot verify one.** The Settings screen states that in those words rather than implying a
 * precision the source form does not have.
 */
export const DATA_VERSION_PRIOR_YEAR_LOSSES = 25;
/**
 * D-DPI-2 (B-152, unblocking B-116) — a ladder category may now record that the person was **asked** and
 * answered **nu am avut**, as a stored fact distinct from nobody having asked.
 *
 * **Why this owes a rung at all.** The art. 170 alin. (4) ladder sums across all six litera of art. 155 alin.
 * (1) lit. c)-h), so it has always refused a partial answer set: one category without an answer makes the sum
 * unknown, not smaller. That refusal was the only thing standing between a silent profile and an undercharged
 * health contribution, and D-DPI-2 keeps it — it narrows the trigger from „not all six are numbers” to „not
 * all six are answered”. Narrowing a refusal that guards money is a change to what the persisted data has to
 * be able to say, so it is a chain step, not a form change.
 *
 * **What this step opens.** `profile.cassLadderYears[].ladderAnswers`: per category, `amount`, `none` or
 * `unknown`. `cassLadderCategoryFacts` in `domain/models.ts` is the single resolver of the three states, and
 * it has no path that turns an absent fact into `none`.
 *
 * **What this step refuses to fill in, and this is the whole content of the step.** It writes the version and
 * nothing else. **Every payload in the world has never seen these six questions**, so every payload must land
 * in `unknown`. A step that backfilled `none` — the obvious-looking default, „they had the section for ten
 * versions and left it empty, so they must have no such income” — would take a person who has never opened
 * the screen and assert on the record that they have no other income, and would then compute a CASS base out
 * of that assertion. That is the single most dangerous line available in this area, and it is why the body of
 * this step is empty. Absence is not evidence of absence; it is the record of a question never asked.
 */
export const DATA_VERSION_LADDER_ANSWERS = 26;
/** The version this build writes. */
export const CURRENT_DATA_VERSION = DATA_VERSION_LADDER_ANSWERS;

export interface MigrationStep {
  readonly from: number;
  readonly to: number;
  /** Stable identifier, recorded in logs/tests. Never reused. */
  readonly name: string;
  /** One-line human description; shown in the "your data was upgraded" state. */
  readonly summary: string;
  apply: (data: PersistedAppData) => PersistedAppData;
}

export interface MigrationOutcome {
  /** The dataset at `CURRENT_DATA_VERSION`, ready for the load path. */
  data: PersistedAppData;
  fromVersion: number;
  toVersion: number;
  migrated: boolean;
  /** Names of the steps that actually ran, in order. */
  stepsApplied: string[];
}

/**
 * A payload written by a NEWER build than this one. The load path treats this as
 * an unreadable payload and quarantines it (D-3) instead of loading a partial,
 * silently-shrunken version of the user's data.
 */
export class UnsupportedDataVersionError extends Error {
  readonly found: number;
  readonly current: number;
  constructor(found: number, current: number) {
    super(`stored data version ${found} is newer than this build understands (${current})`);
    this.name = 'UnsupportedDataVersionError';
    this.found = found;
    this.current = current;
  }
}

/**
 * Backfill a profile for data saved before the `profile` collection existed.
 *
 * This is a migration, not a load-time default: it belongs to step v0→v1 and is
 * the only place legacy `settings.company` / `settings.personal` values are read
 * (acceptance criterion 6 — nothing outside the migration path reads them).
 *
 * `instant` is injectable so tests get a deterministic `pfaStartYear` /
 * `fiscalYear` / `updatedAt`.
 */
export function legacyProfileFromSettings(s: SettingsState, instant: Date = now()): PfaProfile {
  const c = s.company;
  const p = s.personal;
  return {
    id: 'profile-1',
    pfaStartYear: localYear(instant),
    fiscalYear: localYear(instant),
    regime: 'impozit_pe_venit',
    salaryStatus: 'nu',
    // TASK 5: no pension fact is minted here. The legacy `settings` block never recorded a pension
    // status, and minting `pensionerStatus: 'nu'` would assert a checked negative the source never
    // held. Absence is the honest state, and `readPensionerStatus` reports it as `unknown`.
    // PG-6d (D-LEG-1): no `otherIncome: []` either — that flag list is retired outright, and minting an
    // empty one here would assert that somebody was asked about other income and had none.
    socialInsuranceStatus: 'neplata',
    // PG-6f (D-LEG-1): no `vatExempt: false` either. The boolean is retired outright, and the legacy
    // `settings` block never recorded a VAT registration state — minting one here would decide the money
    // measure of every record in the register on a source that holds no such fact.
    cashFloorLei: lei(0),
    identity: absorbCompanyIdentity(
      {
        nume: p.nume,
        cnp: p.cnp,
        adresa: p.adresa,
        telefon: p.telefon,
        email: p.email,
        denumire: c.denumire,
        cui: c.cui,
        formaJuridica: c.formaJuridica ?? '',
        numarRegComert: c.numarRegComert,
        adresaSocietate: c.adresa,
        telefonSocietate: c.telefon ?? '',
        emailSocietate: c.email ?? '',
        contBancar: c.contBancar ?? '',
        banca: c.banca ?? '',
      },
      s,
    ),
    updatedAt: toInstantISO(instant),
  };
}

/**
 * Copy the identity fields that only `settings.company` used to carry into
 * `PfaIdentity`, without overwriting anything already present there.
 *
 * Rule for the whole chain: **backfill only from a real source, never invent a
 * value.** A field with no legacy source stays absent — the schema makes every
 * Phase 7 field optional precisely so "unknown" is representable instead of
 * guessed. (Same principle Phase 6 applied to `pfaStartDate` /
 * `salaryIncomeLei` — see `store.profileBackfill.test.tsx`
 * "leaves the new optional profile fields absent rather than inventing values".)
 */
export function absorbCompanyIdentity(identity: PfaIdentity, settings: SettingsState): PfaIdentity {
  const c = settings.company;
  const next: PfaIdentity = { ...identity };
  if (next.codTvaIntra === undefined && c.codTvaIntra !== undefined) next.codTvaIntra = c.codTvaIntra;
  if (next.mentiuniFactura === undefined && c.mentiuniFactura !== undefined) {
    next.mentiuniFactura = c.mentiuniFactura;
  }
  if (next.caen === undefined || next.caen.length === 0) {
    if (c.caen && c.caen.length > 0) {
      next.caen = c.caen.map((entry): CaenCode => ({ cod: entry.cod, descriere: entry.descriere }));
    } else {
      // `settings.company.codCAEN` is the older scalar alias for the main CAEN code.
      // It is a real legacy source, so it is a legitimate fallback — and dropping it
      // would lose the only CAEN code some payloads carry.
      const alias = c.codCAEN?.trim();
      if (alias) next.caen = [{ cod: alias, descriere: '' }];
    }
  }
  return next;
}

/** Fold the deprecated `PfaProfile.caen` string into `identity.caen`. */
function foldLegacyCaen(identity: PfaIdentity, legacyCaen: string | undefined): PfaIdentity {
  const code = legacyCaen?.trim();
  if (!code) return identity;
  if (identity.caen && identity.caen.length > 0) return identity; // real CAEN entries win
  return { ...identity, caen: [{ cod: code, descriere: '' }] };
}

/**
 * Step v0→v1 — materialize the `profile` collection.
 *
 * This is today's implicit load-time backfill (`profile: parsed.profile ??
 * legacyProfileFromSettings(parsed.settings)`) turned into an explicit chain
 * step, which is what B-12 asked for: the Phase 6 rule stops being a special
 * case hidden in the load path and becomes the first link of a versioned chain.
 *
 * It invents nothing beyond what the pre-Phase-6 rule already invented
 * (`pfaStartYear`/`fiscalYear` from the current year, the default regime) and it
 * deliberately leaves `pfaStartDate` / `salaryIncomeLei` ABSENT — the Phase 6
 * data-loss rule (`phases/06_fiscal_profile.md` §4) is "no default for a field
 * the user never entered".
 */
export function materializeProfileV1(data: PersistedAppData): PersistedAppData {
  if (data.profile) return { ...data, version: DATA_VERSION_PROFILE };
  return { ...data, version: DATA_VERSION_PROFILE, profile: legacyProfileFromSettings(data.settings) };
}

/**
 * Step v1→v2 — identity absorption (D-1).
 *
 * Backfills, on the LIVE profile:
 *   `identity.codTvaIntra`     ← `settings.company.codTvaIntra`
 *   `identity.mentiuniFactura` ← `settings.company.mentiuniFactura`
 *   `identity.caen[]`          ← `settings.company.caen[]`, else the
 *                               `settings.company.codCAEN` alias, else the
 *                               deprecated `profile.caen` string as
 *                               `{cod, descriere: ''}`
 * and removes the deprecated `profile.caen` from the live profile once folded.
 *
 * Backfills, inside every STORED snapshot's embedded profile (F-1):
 *   `identity.caen[]`          ← that snapshot's own embedded `profile.caen` string
 * Only from the snapshot's own bytes: a snapshot is an audit record of a past
 * calculation, so today's `settings.company` must not be written into it.
 * `codTvaIntra` / `mentiuniFactura` have no source inside the snapshot and are
 * left absent rather than invented.
 *
 * Because `canonicalize` serializes every key, adding a key to an embedded
 * profile changes its digest. The step therefore re-derives `inputsHash` and
 * preserves the digest that was recorded at calculation time in
 * `preMigrationInputsHash`. See `docs/ai/phases/07_identity.md` for why this is
 * the only option that keeps the snapshot provenance invariant true.
 */
export function migrateIdentityV2(data: PersistedAppData): PersistedAppData {
  const settings = data.settings;
  // Defensive: v0→v1 guarantees a profile, but a payload that entered the chain
  // at v1 without one must not crash the load path.
  const profile = data.profile ?? legacyProfileFromSettings(settings);

  let identity = absorbCompanyIdentity(profile.identity, settings);
  identity = foldLegacyCaen(identity, profile.caen);
  const nextProfile: PfaProfile = { ...profile, identity };
  delete nextProfile.caen; // folded into identity.caen; the live profile is normalized

  const snapshots = (data.snapshots ?? []).map(backfillSnapshotIdentity);

  return { ...data, version: DATA_VERSION_IDENTITY, profile: nextProfile, snapshots };
}

/**
 * Backfill one stored snapshot's embedded profile. Returns the snapshot
 * untouched when there is nothing to add, so a migration never rewrites a digest
 * it did not actually change.
 */
export function backfillSnapshotIdentity(snapshot: TaxCalculationSnapshot): TaxCalculationSnapshot {
  const embedded = snapshot.inputSnapshot.profile;
  const identity = foldLegacyCaen(embedded.identity, embedded.caen);
  if (identity === embedded.identity) return snapshot; // nothing added ⇒ digest stays

  const nextProfile: PfaProfile = { ...embedded, identity };
  // Same normalization as the live profile: after the fold there must be exactly
  // one CAEN representation, otherwise AC7's "both readable" problem survives
  // inside the snapshot. Only done when the step actually changed the profile —
  // a snapshot with nothing to add keeps its original bytes and its digest.
  delete nextProfile.caen;
  const inputSnapshot = { ...snapshot.inputSnapshot, profile: nextProfile };
  return {
    ...snapshot,
    inputSnapshot,
    inputsHash: computeInputsHashSync(inputSnapshot),
    // Keep the digest recorded at calculation time. If a snapshot somehow
    // already carries one, the oldest is the one worth keeping.
    preMigrationInputsHash: snapshot.preMigrationInputsHash ?? snapshot.inputsHash,
  };
}

/**
 * Phase 9 step 3 (`2 → 3`): the record schema now permits an optional **collected** date on
 * `Revenue` and an optional **paid** date on `Expense`.
 *
 * **It backfills nothing, on purpose.** A legacy payload's single `date` is *interpreted* as the
 * fiscal date by the read-side resolver (`domain/aggregation.ts` `revenueFiscalDate` /
 * `expenseFiscalDate`). Copying `date` into `collected`/`paid` would manufacture a collection or
 * payment event that was never recorded, and would make an unrecorded fact indistinguishable from a
 * recorded one — the same class of error as the F-1 `canonicalize` defect, where a normalisation
 * step silently asserted something the source never said. Absence is the honest state, so absence
 * survives the step. This is the single place a future, *evidenced* backfill would live.
 *
 * The step is idempotent-safe and touches no bytes. It cannot change any `inputSnapshot` digest:
 * `buildInputSnapshot` hashes `profile` plus two aggregate numbers, not the record arrays.
 */
export function migratePaymentDatesV3(data: PersistedAppData): PersistedAppData {
  return { ...data, version: DATA_VERSION_DATES };
}

/**
 * Pre-Phase-10 step 4 (`3 → 4`): the profile may now carry `vatExceedanceDate`, the date the VAT
 * turnover ceiling (CF art. 310 alin. (1)) was exceeded — the input the VAT registration deadline
 * rule (art. 316 alin. (1) lit. b), already wired and cited since Phase 9b) was still missing.
 *
 * **It backfills nothing, on purpose, for the same reason `migratePaymentDatesV3` backfills
 * nothing.** There is no legacy field to read the exceedance date from: `vatExempt` is a boolean
 * regime flag, not an event, and `pfaStartDate` is the registration start, not a ceiling crossing.
 * Deriving a date from any of them would manufacture a fiscal event the user never recorded — and
 * this one has teeth: `VAT_REGISTRATION_DEADLINE_2026` puts a filing obligation on the exact
 * exceedance date (`offset_days = 0`), so an invented date would invent a deadline. Absence stays
 * absence, and the rule keeps emitting nothing until the user supplies the date.
 *
 * The step touches no bytes and cannot change any `inputSnapshot` digest: `buildInputSnapshot`
 * hashes `profile` plus two aggregate numbers — so a profile that gains this field later does
 * change the digest, which is correct: it is a different input to the engine.
 */
export function migrateVatExceedanceDateV4(data: PersistedAppData): PersistedAppData {
  return { ...data, version: DATA_VERSION_VAT_DATE };
}

/**
 * One stored money value whose move to integer bani was not a lossless unit change.
 *
 * The brief's rule is that such a value must **surface, not vanish**. Throwing is the wrong instrument
 * here: a throwing step quarantines the whole payload and the save effect then overwrites the main key
 * with seed data, so the user's money becomes *less* reachable, not more. The conversion therefore
 * completes and records what it had to decide.
 */
export interface MoneyPrecisionNotice {
  collection: 'revenues' | 'expenses' | 'declarations' | 'profile' | 'snapshot';
  /** The record's own id; for a snapshot, its `calculationId`; for the profile, `'profile'`.
   * A record with no id is reported as `'<no id>'` rather than skipped — a missing id is itself a fact. */
  id: string;
  field: string;
  /**
   * The value exactly as it was stored, in lei, as **text**. Kept verbatim so the user can see what changed.
   *
   * It is a string rather than a number on purpose: a non-finite value is the case this field exists to
   * report, and `JSON.stringify` turns `NaN`/`Infinity` into `null`. A numeric `original` would therefore
   * fail `persistedAppDataSchema` on the next load and quarantine the whole payload — the report about a
   * bad value destroying the good data next to it. Text survives the round-trip and stays verbatim.
   */
  original: string;
  /** The bani it became. **Omitted** when the value could not be represented at all — never `0`. */
  converted?: Bani;
  reason: 'sub-ban-precision' | 'non-finite';
}

/**
 * The v4→v5 unit conversion: every stored money field goes from float lei to integer bani.
 *
 * Two things this deliberately is NOT:
 * - It is **not** CF art. 66 rounding. Art. 66 rounds to a whole leu, so applying it here would turn a
 *   stored revenue of `85.5` lei into `86` lei — a silent change to the user's money. Only
 *   `roundArt66` in `domain/money.ts` is allowed to change a *value*, and only at the three tax lines.
 * - It is **not** `Math.round(x * 100)`, the function this phase exists to remove. `baniFromLei` scales
 *   through `Decimal`, so `71.4` becomes exactly `7140` instead of `7140.000000000001`.
 *
 * A value with sub-ban precision (`674.504` lei → `67 450,4` bani) is taken to the nearest ban with
 * **half-DOWN** ties — the same direction art. 66 takes („până la 50 de bani inclusiv”), so migration and
 * domain never disagree — and it is reported. A non-finite value is carried through **unchanged** and
 * reported; it is never replaced by `0`, because a fabricated zero is the failure the previous phase's
 * invariants forbid.
 */
export function convertMoneyToBani(input: PersistedAppData): {
  data: PersistedAppData;
  notices: MoneyPrecisionNotice[];
} {
  const notices: MoneyPrecisionNotice[] = [];

  // The payload arriving here is a v4 payload: its money fields are typed `Bani` only because the load
  // gate casts, and they still hold lei. The brand describes the post-migration world, not this one.
  const convert = (value: number, collection: MoneyPrecisionNotice['collection'], id: string, field: string): Bani => {
    const { bani, exact } = baniFromLei(value);
    if (bani === null) {
      notices.push({ collection, id, field, original: String(value), reason: 'non-finite' });
      return value as Bani; // preserved verbatim — dropped or zeroed would both be worse
    }
    if (!exact) notices.push({ collection, id, field, original: String(value), converted: bani, reason: 'sub-ban-precision' });
    return bani;
  };

  const convertProfile = (profile: PfaProfile, id: string): PfaProfile => {
    const next: PfaProfile = {
      ...profile,
      cashFloorLei: convert(profile.cashFloorLei as number, 'profile', id, 'cashFloorLei'),
    };
    // Omit, never null: no persisted money field is `.nullable()`, so writing `null` would fail
    // `safeParse` on the next load and quarantine the payload. Absence must stay absence.
    if (profile.salaryIncomeLei !== undefined) {
      next.salaryIncomeLei = convert(profile.salaryIncomeLei as number, 'profile', id, 'salaryIncomeLei');
    }
    return next;
  };

  const convertSnapshot = (snapshot: TaxCalculationSnapshot): TaxCalculationSnapshot => {
    const profile = convertProfile(snapshot.inputSnapshot.profile, snapshot.calculationId);
    const revenues = convert(snapshot.inputSnapshot.revenues as number, 'snapshot', snapshot.calculationId, 'inputSnapshot.revenues');
    const expenses = convert(snapshot.inputSnapshot.expenses as number, 'snapshot', snapshot.calculationId, 'inputSnapshot.expenses');
    const inputSnapshot = { ...snapshot.inputSnapshot, profile, revenues, expenses };

    const calculationLines = snapshot.calculationLines.map((line) => ({
      ...line,
      value: convert(line.value as number, 'snapshot', snapshot.calculationId, 'calculationLines.value'),
    }));
    const output = { total: convert(snapshot.output.total as number, 'snapshot', snapshot.calculationId, 'output.total') };

    // `canonicalize` writes a number as `String(value)`, so the unit is baked into the digest's bytes:
    // `7700` and `770000` hash differently. Re-derive, and keep the digest that was recorded at
    // calculation time — same contract as `backfillSnapshotIdentity` above.
    const untouched =
      inputSnapshot.revenues === snapshot.inputSnapshot.revenues &&
      inputSnapshot.expenses === snapshot.inputSnapshot.expenses &&
      inputSnapshot.profile === snapshot.inputSnapshot.profile;
    if (untouched) {
      return { ...snapshot, calculationLines, output };
    }
    return {
      ...snapshot,
      inputSnapshot,
      calculationLines,
      output,
      inputsHash: computeInputsHashSync(inputSnapshot),
      preMigrationInputsHash: snapshot.preMigrationInputsHash ?? snapshot.inputsHash,
    };
  };

  // The two casts below move between a **v4** payload and the types the chain ends at. A v4 record's money
  // field is a bare float in **lei**; `Revenue.valoareFaraTva` is typed `Money` because the load gate casts
  // without converting (`moneyField` in schema.ts), and the value only becomes a `{ amount, currency }`
  // object at the `record-currency` step (v10). Neither cast converts anything at runtime, and both helpers
  // are only ever called from this step, which runs solely at `from: 4` — before the bani unit (created
  // here) and before the `Money` shape (created at v10) exist.
  // SAFETY: reads a pre-migration v4 money field, which is a bare number of lei, not a `Money` object.
  const legacyLei = (value: Money): number => value as unknown as number;
  // SAFETY: writes post-conversion **bani** back into a field that only becomes a `Money` object at v10.
  const asMoneyField = (value: Bani): Money => value as unknown as Money;

  const data: PersistedAppData = {
    ...input,
    version: DATA_VERSION_MONEY_BANI,
    // SAFETY: the four `as unknown as number` casts below read a **v4** payload, whose money fields are bare
    // float lei. `Revenue.valoareFaraTva` is typed `Money` only because the load gate casts without
    // converting (`moneyField` in schema.ts), and the `Bani` brand here describes the post-migration world,
    // not this payload. The invariant TypeScript cannot check: this step only ever runs at `from: 4`, and a
    // v4 payload predates both the bani unit (this step creates it) and the `Money` shape (v10 creates it).
    revenues: input.revenues.map((r: Revenue) => ({
      ...r,
      valoareFaraTva: asMoneyField(convert(legacyLei(r.valoareFaraTva), 'revenues', r.id ?? '<no id>', 'valoareFaraTva')),
      tva: asMoneyField(convert(legacyLei(r.tva), 'revenues', r.id ?? '<no id>', 'tva')),
    })),
    ...(input.expenses
      ? {
          expenses: input.expenses.map((e: Expense) => ({
            ...e,
            valoareFaraTva: asMoneyField(convert(legacyLei(e.valoareFaraTva), 'expenses', e.id ?? '<no id>', 'valoareFaraTva')),
            tva: asMoneyField(convert(legacyLei(e.tva), 'expenses', e.id ?? '<no id>', 'tva')),
          })),
        }
      : {}),
    ...(input.declarations
      ? {
          declarations: input.declarations.map((d) => ({
            ...d,
            venituri: convert(d.venituri as number, 'declarations', d.id ?? '<no id>', 'venituri'),
            cheltuieli: convert(d.cheltuieli as number, 'declarations', d.id ?? '<no id>', 'cheltuieli'),
          })),
        }
      : {}),
    ...(input.profile ? { profile: convertProfile(input.profile, 'profile') } : {}),
    ...(input.snapshots ? { snapshots: input.snapshots.map(convertSnapshot) } : {}),
  };

  return { data, notices };
}

/**
 * Phase 10 step 5 (`4 → 5`): stored money becomes integer bani. See `convertMoneyToBani` and
 * `docs/ai/phases/10_money_precision.md` §2.2.
 *
 * The notices it produces are returned by `convertMoneyToBani`; the chain's signature has no channel for
 * them, so they are carried on the payload under `moneyNotices` (declared in `data/schema.ts`, because
 * zod strips undeclared keys and would erase the report on the next load).
 */
export function migrateMoneyBaniV5(data: PersistedAppData): PersistedAppData {
  const { data: converted, notices } = convertMoneyToBani(data);
  return notices.length ? { ...converted, moneyNotices: notices } : converted;
}

/**
 * TASK 2b step 6 (`5 → 6`): `Expense` may now carry `category`, the token the deductibility classifier
 * reads (`domain/fiscal/deductibility.ts`, CF art. 68).
 *
 * **It backfills nothing, for the third time, and this time the temptation was real.** Every expense in
 * a pre-v6 payload is a real invoice, and it would be easy to guess a category from the supplier name or
 * the amount. That guess would decide the user's tax: an uncategorised expense is EXCLUDED from the
 * deductible total, while a wrongly categorised one enters it. The law supplies no default (research 21,
 * "What the law cannot decide": purpose is a fact about each expense, not a category), so absence is
 * carried forward unchanged and surfaced as a count instead of being repaired.
 *
 * A payload that already carries a category keeps it byte-for-byte — the step neither validates nor
 * rewrites it. Nothing here can quarantine a payload for a missing category: the field is optional in
 * `expenseSchema`, and the load gate runs before the chain.
 *
 * The step touches no bytes and cannot move a stored `inputSnapshot` digest: `buildInputSnapshot` hashes
 * `profile` plus two aggregate numbers, not the expense array.
 */
export function migrateExpenseCategoryV6(data: PersistedAppData): PersistedAppData {
  return { ...data, version: DATA_VERSION_EXPENSE_CATEGORY };
}

/**
 * TASK 3: the v6→v7 step widens the dataset with `reservedAmount` and NOTHING MORE.
 *
 * It backfills nothing, deliberately. `reservedAmount` is tri-state — `null` means „no reserve
 * recorded”, `0` means the user recorded an explicit zero — and the two are different facts. Writing
 * `0` into an old payload would manufacture a claim about the user's cash that no legacy field ever
 * recorded, and it would do so in the one place a reader cannot argue with: a stored number. Absence
 * is carried forward unchanged and the load path (`store.tsx` `toAppData`) reads it as `null`.
 *
 * The step touches no bytes and cannot move a stored `inputSnapshot` digest: `buildInputSnapshot`
 * hashes `profile` plus two aggregate numbers, not the rest of `AppData`, so a new top-level field
 * never reaches `canonicalize`.
 */
export function migrateReservedAmountV7(data: PersistedAppData): PersistedAppData {
  return { ...data, version: DATA_VERSION_TAX_RESERVE };
}

/**
 * TASK 5: the v7→v8 step widens the profile with the pension facts and RENAMES one key.
 *
 * The rename is a carry, not a reinterpretation. `pensionStatus` recorded *calitatea de pensionar*, and
 * `pensionerStatus` is the same fact under a name that says what it is — the CAS key under CF art. 150
 * alin. (1), and nothing else. So the value moves across byte-for-byte and the old key is removed from
 * the live profile, exactly as step v0→v1 folded `profile.caen` into `identity.caen` and deleted it.
 *
 * What the step refuses to do is manufacture the fact the CASS relief actually turns on. CF art. 174
 * alin. (7) lit. c) asks whether the person „a realizat venituri … din pensii, definite conform art. 99”
 * in the income year, and art. 99 alin. (1) defines those as „sume primite ca pensii”. A status answers
 * none of that: a pensioner who received no pension sums that year does not qualify, and someone who
 * was not a pensioner all year but received some does. Writing `pensionReceiptYears: [{ received: 'da' }]`
 * for an old `pensionStatus: 'da'` would have granted a tax relief out of a boolean; writing `received:
 * 'nu'` would have refused one out of the same boolean. Both are legal conclusions the data does not
 * support, so the field stays ABSENT and the reader reports `unknown`.
 *
 * Stored snapshots are untouched, so no `inputsHash` moves: the step edits the live profile only, and
 * `buildInputSnapshot` embeds the profile a calculation was made with, not the current one. Pinned by
 * the digest landmine in `store.migration.chain.test.tsx`.
 */
export function migratePensionFactsV8(data: PersistedAppData): PersistedAppData {
  const stamped = { ...data, version: DATA_VERSION_PENSION_FACTS };
  const profile = data.profile;
  if (!profile || profile.pensionStatus === undefined) return stamped;
  // `pensionStatus` stays declared on `PfaProfile` as a deprecated optional precisely so this step can
  // name it: the value is copied into `pensionerStatus` and the old key is dropped from the live
  // profile, exactly as step v0→v1 folded `profile.caen` into `identity.caen` and deleted it.
  const { pensionStatus, ...rest } = profile;
  return { ...stamped, profile: { ...rest, pensionerStatus: pensionStatus } };
}

/**
 * TASK 6: the v8→v9 step widens every stored calculation snapshot with `ruleSetHash`, and writes `null`
 * into it for a snapshot that predates content-addressing.
 *
 * The honest half of this step is what it does NOT do. It does not call `ruleSetDigest` on the current
 * rule set and stamp the result onto an old record. That would be a guess dressed as a guarantee: the
 * rules have moved three times since those snapshots were written — CAS (Phase 3), CASS (Phase 4) and
 * the 2026 income tax (Phase 5) each changed formula-bearing parameters while `releaseId` and `createdAt`
 * stood still — so today's digest is almost certainly not the digest that produced the stored number.
 * `null` is the record admitting it cannot be reproduced, which is what actually happened.
 *
 * `inputsHash` is untouched, and that is pinned by `store.migration.chain.test.tsx`: the step adds a
 * sibling field on the calculation record and never edits `inputSnapshot`, which is still the enumerated
 * subset `{ profile, revenues, expenses }` TASK 3 fixed. The embedded `ruleRelease` is likewise left
 * exactly as it was written — no `contentHash`, no `lifecycle`, no `version` is minted for it.
 */
export function migrateRuleSetDigestV9(data: PersistedAppData): PersistedAppData {
  const stamped = { ...data, version: DATA_VERSION_RULE_SET_DIGEST };
  const snapshots = data.snapshots;
  if (!snapshots || snapshots.length === 0) return stamped;
  let touched = false;
  const next = snapshots.map((snapshot) => {
    if (snapshot.ruleSetHash !== undefined) return snapshot;
    touched = true;
    return { ...snapshot, ruleSetHash: null };
  });
  return touched ? { ...stamped, snapshots: next } : stamped;
}

/**
 * TASK 10a: the v9→v10 step gives every stored revenue and expense its currency. See the doc comment on
 * `DATA_VERSION_RECORD_CURRENCY` for the decision and for what this step refuses to touch.
 *
 * Idempotent-safe, as the chain contract requires: a field that already carries a currency is left exactly
 * as it is, so re-running the step cannot double-wrap a value or overwrite a currency the user chose.
 */
export function migrateRecordCurrencyV10(data: PersistedAppData): PersistedAppData {
  const stamped = { ...data, version: DATA_VERSION_RECORD_CURRENCY };

  // A pre-v10 money field is a bare number; a post-v10 one is `{ amount, currency }`. The load gate types
  // both as `Money` — a cast, not a conversion — so the discriminator has to be structural.
  const wrap = (value: Money): Money =>
    typeof value === 'number' ? money(value as Bani, 'RON') : value;

  const needsWrap = (record: Revenue | Expense): boolean =>
    typeof record.valoareFaraTva !== 'object' || typeof record.tva !== 'object';

  const anyRevenueChanged = data.revenues.some(needsWrap);
  const anyExpenseChanged = data.expenses?.some(needsWrap) ?? false;
  if (!anyRevenueChanged && !anyExpenseChanged) return stamped;

  return {
    ...stamped,
    revenues: data.revenues.map((r) =>
      needsWrap(r) ? { ...r, valoareFaraTva: wrap(r.valoareFaraTva), tva: wrap(r.tva) } : r,
    ),
    ...(data.expenses
      ? {
          expenses: data.expenses.map((e) =>
            needsWrap(e) ? { ...e, valoareFaraTva: wrap(e.valoareFaraTva), tva: wrap(e.tva) } : e,
          ),
        }
      : {}),
  };
}

/**
 * PG-5 / PG-5b: the v10→v11 step. It opens `filings` empty and drops the monthly rows.
 *
 * Idempotent-safe as the chain contract requires: an existing `filings` array is never replaced, and a
 * second run of the step produces the same payload. Nothing is derived, converted or summarised on the
 * way out — the rows are dropped, so a step that first reinterpreted them would be inventing a fact in
 * order to delete it.
 */
export function migrateAnnualFilingV11(data: PersistedAppData): PersistedAppData {
  // `version`, `declarations` and `legacyDeclarations` are destructured OUT of the payload copy, so the
  // stamp written last cannot be overwritten by the stale version the payload carried. An earlier
  // revision of this step spread `{ ...stamped, ...rest }` and put `version: 10` back on the result,
  // which made the chain abort with "did not set version 11" — loudly, which is the only reason it was
  // caught. The same destructuring is now also the drop: `monthly` is read and discarded, and
  // `legacyDeclarations` — the key PG-5 wrote for one release — is discarded with it, so an install that
  // was upgraded under PG-5 loses nothing it can still read and gains no orphan bucket.
  const {
    version: staleVersion,
    declarations: monthly,
    // Not declared on `PersistedAppData` any more — zod strips it at the gate — but a payload handed to
    // the chain directly can still carry it, and so can a PG-5-era install. It is discarded here too, so
    // the bucket cannot survive a load by being undeclared rather than by being deleted.
    legacyDeclarations: preserved,
    ...rest
  } = data as PersistedAppData & { legacyDeclarations?: unknown };
  void staleVersion;
  void monthly;
  void preserved;

  return {
    ...rest,
    // `filings` is opened empty only so the shape is explicit; the load path treats an absent key
    // identically. An existing array is never replaced.
    filings: rest.filings ?? [],
    version: DATA_VERSION_ANNUAL_FILING,
  };
}

/**
 * PG-6b: the v11→v12 step. It opens `profile.activityFamily` and backfills nothing.
 *
 * Idempotent-safe by construction — it writes the version and touches no value, so a second run produces
 * the same payload. The temptation this step refuses is the harmless-looking one: `activityFamily:
 * profile.activityFamily ?? 'other'`. That single `??` would mint a legal fact for every stored profile,
 * would make the undeclared-family scenario unfireable, and would present an accommodation taxpayer's
 * register under rules the law does not apply to them.
 */
export function migrateActivityFamilyV12(data: PersistedAppData): PersistedAppData {
  return { ...data, version: DATA_VERSION_ACTIVITY_FAMILY };
}

/**
 * PG-6h-2 (B-82, B-84) — the accommodation facts open as absent, and nothing else happens.
 *
 * The forbidden version of this function is `{ ...data, profile: { ...profile, accommodationRoomCounts:
 * [{ fiscalYear: profile.fiscalYear, rooms: 1 }] } }` or `accommodationCommissionReading: 'reading_a'`.
 * Either one mints a legal fact for every stored profile: the room count decides the *title* the income
 * falls under (art. 83 alin. (2) / art. 85 versus art. 83 alin. (4) / art. 68^3), and the commission
 * reading decides what the gross contains. Idempotent-safe for the same reason v12 is: it writes a
 * version and touches no value.
 */
export function migrateAccommodationFactsV13(data: PersistedAppData): PersistedAppData {
  return { ...data, version: DATA_VERSION_ACCOMMODATION_FACTS };
}

/**
 * v13 → v14 (`occupancy-sheet`). Writes a version and touches no value.
 *
 * A payload that never held a sheet ends with **no `occupancySheets` key at all** — not an empty array.
 * Absence is the honest third state and the load path turns it into `[]`; writing `[]` here would put a
 * key in the stored bytes that reads as „sheets were made and none exist”, which is a different claim
 * from „nobody ever made one”. Same discipline as `fxRates` and the v12/v13 steps.
 */
export function migrateOccupancySheetV14(data: PersistedAppData): PersistedAppData {
  return { ...data, version: DATA_VERSION_OCCUPANCY_SHEET };
}

/**
 * v14 → v15 (`vehicle-facts`). Writes a version and touches no value.
 *
 * The forbidden version of this function is `vehicles: []` on every payload (which would turn „no vehicle
 * has ever been declared” into „vehicles were declared and none exist”, and would make every existing
 * `vehicle_related` expense *unattributable* rather than default-capped), and it is equally forbidden to
 * copy a car from one fiscal year’s facts into another or to point an expense at a car. Idempotent-safe
 * for the same reason v13 and v14 are: it writes a version and touches nothing.
 */
export function migrateVehicleFactsV15(data: PersistedAppData): PersistedAppData {
  return { ...data, version: DATA_VERSION_VEHICLE_FACTS };
}

/**
 * v15 → v16 (`other-income-ladder`). Drops the retired `profile.otherIncome` flag list and opens the
 * per-year ladder amounts as absent.
 *
 * This is the one step in the chain that **removes** stored data, and it does so under D-LEG-1 („we do not
 * need legacy data. we have no users yet. We should generally clean legacy stuff”). What it does not do is
 * convert a flag into an amount: a checked `dividende` box records that a source exists, not how much it
 * paid, and art. 170 alin. (4) and art. 174 alin. (7) lit. b) both compare amounts to SM multiples. Any
 * conversion would have to invent one, and inventing an amount here invents a CASS liability — the defect
 * this phase exists to close. So the flags are dropped and the amounts are asked.
 */
export function migrateOtherIncomeLadderV16(data: PersistedAppData): PersistedAppData {
  if (!data.profile) return { ...data, version: DATA_VERSION_OTHER_INCOME_LADDER };
  const { otherIncome: _dropped, ...profile } = data.profile as PfaProfile & { otherIncome?: unknown };
  return { ...data, profile: profile as PfaProfile, version: DATA_VERSION_OTHER_INCOME_LADDER };
}

/**
 * v16 → v17 (`fixed-assets`). Writes a version and touches no value.
 *
 * The forbidden version of this function is `fixedAssets: []` on every payload — that would turn „no asset
 * has ever been declared” into „assets were declared and none exist”, and would put a key in the stored
 * bytes that reads as a completed register. It is equally forbidden to derive an asset from an `Expense`
 * row: a `depreciable_asset_purchase` expense records that money left, not that a depreciable asset entered
 * the patrimony, and art. 68 alin. (7) lit. h) keeps that purchase out of the expense side precisely
 * because the two are different facts. Idempotent-safe for the same reason v13-v16 are: it writes a version
 * and touches nothing.
 */
export function migrateFixedAssetsV17(data: PersistedAppData): PersistedAppData {
  return { ...data, version: DATA_VERSION_FIXED_ASSETS };
}

/**
 * v17 → v18 (`input-vat-registration`). Drops the retired `profile.vatExempt` boolean and opens the
 * registration states as absent. See `DATA_VERSION_INPUT_VAT` for why nothing is converted.
 */
export function migrateInputVatRegistrationV18(data: PersistedAppData): PersistedAppData {
  if (!data.profile) return { ...data, version: DATA_VERSION_INPUT_VAT };
  const { vatExempt: _dropped, ...profile } = data.profile as PfaProfile & { vatExempt?: unknown };
  return { ...data, profile: profile as PfaProfile, version: DATA_VERSION_INPUT_VAT };
}

/**
 * v18 → v19 (`vat-returns`). Opens `vatReturns` as an empty collection. See `DATA_VERSION_VAT_RETURNS`.
 *
 * A payload that already carries the key keeps it untouched: this step **opens** a collection, it does not
 * rewrite one, which is what makes re-running it a no-op rather than a wipe. The forbidden version of this
 * function is a `depusa` row per fiscal period — that would turn „no return has ever been recorded” into
 * „every return was filed”, and would let a deadline be marked done from a record nobody made.
 */
export function migrateVatReturnsV19(data: PersistedAppData): PersistedAppData {
  if (data.vatReturns !== undefined) return { ...data, version: DATA_VERSION_VAT_RETURNS };
  return { ...data, vatReturns: [], version: DATA_VERSION_VAT_RETURNS };
}

/**
 * v19 → v20 (`lease-facts`). Opens `profile.leaseFactsYears` by writing nothing. See
 * `DATA_VERSION_LEASE_FACTS` for the three facts this step refuses to invent.
 *
 * The body is deliberately the version stamp and nothing else. There is no key to open at the top level —
 * these are profile facts, not a collection — and no stored record carries anything from which a tenant's
 * legal nature, a contract's stipulated rent or a contract date could be derived. A payload that already
 * carries the field keeps it untouched, which is what makes re-running the step a no-op rather than a wipe.
 */
export function migrateLeaseFactsV20(data: PersistedAppData): PersistedAppData {
  return { ...data, version: DATA_VERSION_LEASE_FACTS };
}

/**
 * v20 → v21 (`document-blob-ref`). Declares that a document record may carry `blobRef` instead of inline
 * `content`. **The body is the version stamp and nothing else** — see `DATA_VERSION_DOCUMENT_BLOB_REF` for
 * why this step cannot also be the thing that moves the bytes.
 *
 * The forbidden version of this function reaches for the blob store. It would have to be `async`, which
 * `MigrationStep.apply` is not, and a chain runner cannot await it; the honest alternatives are a step that
 * does nothing while pretending to have migrated, or a step that clears `content` before any write has been
 * confirmed. The second one is how this phase would lose a document, and it is the specific catastrophe the
 * brief names.
 */
export function migrateDocumentBlobRefV21(data: PersistedAppData): PersistedAppData {
  return { ...data, version: DATA_VERSION_DOCUMENT_BLOB_REF };
}

/**
 * v21 → v22 (`efactura-deadline`). Drops `settings.eFactura.trimitere`. See
 * `DATA_VERSION_EFACTURA_DEADLINE` for what the value claimed, why nothing maps it onto another value, and
 * why the load gate had to be widened before this step could be the thing that decides.
 *
 * Idempotent-safe for the same reason v13-v21 are: deleting an absent key is a no-op, the payload copy is
 * returned with the version stamped unconditionally, and `dateContact` is carried through untouched — the
 * step retires one key, it does not rebuild the block.
 */
export function migrateEfacturaDeadlineV22(data: PersistedAppData): PersistedAppData {
  const ef = data.settings?.eFactura;
  if (ef === undefined || !('trimitere' in ef)) {
    return { ...data, version: DATA_VERSION_EFACTURA_DEADLINE };
  }
  const { trimitere: _retired, ...eFacturaRest } = ef;
  return {
    ...data,
    version: DATA_VERSION_EFACTURA_DEADLINE,
    settings: { ...data.settings, eFactura: eFacturaRest },
  };
}

/**
 * v22 → v23 (`expense-asset-link`). Opens `Expense.assetId` by writing nothing. See
 * `DATA_VERSION_EXPENSE_ASSET_LINK` for the refusal this field is meant to narrow and for the inference this
 * step refuses to make.
 *
 * The body is deliberately the version stamp and nothing else. There is no stored fact from which an asset
 * link could be derived without guessing — not the amount, not the date, not the supplier, not the category
 * token — and a step that wrote one would narrow the conflict detection on a fiction. A payload that already
 * carries `assetId` keeps it untouched.
 */
export function migrateExpenseAssetLinkV23(data: PersistedAppData): PersistedAppData {
  return { ...data, version: DATA_VERSION_EXPENSE_ASSET_LINK };
}

/**
 * v23 → v24 (`fixed-asset-disposal-proceeds`). Opens `FixedAsset.disposalProceeds` by writing nothing. See
 * `DATA_VERSION_DISPOSAL_PROCEEDS` for the second ceiling the field makes measurable, for the inference this
 * step refuses, and for why the figure stays unposted (B-65) even after B-153 closed the month count.
 *
 * The body is the version stamp and nothing else. A payload that already carries `disposalProceeds` keeps it
 * untouched, which is what makes re-running the step a no-op rather than a wipe.
 */
export function migrateDisposalProceedsV24(data: PersistedAppData): PersistedAppData {
  return { ...data, version: DATA_VERSION_DISPOSAL_PROCEEDS };
}

/**
 * v24 → v25 (`prior-year-fiscal-losses`). Opens `profile.priorYearFiscalLosses` by writing nothing. See
 * `DATA_VERSION_PRIOR_YEAR_LOSSES` for the rule the field makes reachable, for why the entries are per year
 * when the return asks for one total, and for the split the app can age but cannot verify.
 *
 * The body is the version stamp and nothing else. A payload that already carries losses keeps them untouched,
 * which is what makes re-running the step a no-op rather than a wipe.
 */
export function migratePriorYearLossesV25(data: PersistedAppData): PersistedAppData {
  return { ...data, version: DATA_VERSION_PRIOR_YEAR_LOSSES };
}

/**
 * v25 → v26 (`cass-ladder-answers`). Opens `profile.cassLadderYears[].ladderAnswers` by writing nothing. See
 * `DATA_VERSION_LADDER_ANSWERS` for the refusal this narrows, for why the step backfills nothing, and for the
 * default it deliberately does not make.
 *
 * The body is deliberately the version stamp and nothing else. There is no stored fact from which a declared
 * „nu am avut” could be derived: an empty amount box records that nothing was written, which is not a
 * statement that nothing was earned, and reading it as one would undercharge CASS for every taxpayer who has
 * not yet been asked. A payload that already carries `ladderAnswers` keeps it untouched, which is what makes
 * re-running the step a no-op rather than a wipe.
 */
export function migrateCassLadderAnswersV26(data: PersistedAppData): PersistedAppData {
  return { ...data, version: DATA_VERSION_LADDER_ANSWERS };
}

/** The chain, in order. Append new steps at the end; never renumber old ones. */
export const MIGRATION_CHAIN: MigrationStep[] = [
  {
    from: DATA_VERSION_BASE,
    to: DATA_VERSION_PROFILE,
    name: 'profile-materialization',
    summary: 'Profile collection rebuilt from the legacy settings block (the Phase 6 backfill, now explicit).',
    apply: materializeProfileV1,
  },
  {
    from: DATA_VERSION_PROFILE,
    to: DATA_VERSION_IDENTITY,
    name: 'identity-absorption',
    summary:
      'Identity/contact data moved into the profile (company CAEN codes, cod TVA intracomunitar, mentiuni pe factură).',
    apply: migrateIdentityV2,
  },
  {
    from: DATA_VERSION_IDENTITY,
    to: DATA_VERSION_DATES,
    name: 'payment-dates',
    summary:
      'Records may now carry a collected (revenue) / paid (expense) date. Nothing was backfilled: a legacy payload keeps a single date, which is read as the fiscal date.',
    apply: migratePaymentDatesV3,
  },
  {
    from: DATA_VERSION_DATES,
    to: DATA_VERSION_VAT_DATE,
    name: 'vat-exceedance-date',
    summary:
      'Profile may now carry the date the TVA ceiling was exceeded. Nothing was backfilled: no legacy field records that event, and an invented date would invent a filing deadline.',
    apply: migrateVatExceedanceDateV4,
  },
  {
    from: DATA_VERSION_VAT_DATE,
    to: DATA_VERSION_MONEY_BANI,
    name: 'money-bani',
    summary:
      'Banii se stochează acum ca număr întreg de bani (1 leu = 100 de bani), nu ca zecimale de lei. Valorile cu precizie subun ban au fost rotunjite la cel mai apropiat ban (semn +50 în jos) și sunt raportate, nu ascunse.',
    apply: migrateMoneyBaniV5,
  },
  {
    from: DATA_VERSION_MONEY_BANI,
    to: DATA_VERSION_EXPENSE_CATEGORY,
    name: 'expense-category',
    summary:
      'Cheltuielile pot avea acum o categorie de deductibilitate (CF art. 68). Nimic nu a fost completat: o cheltuială fără categorie este exclusă din totalul deductibil și raportată ca neclasificată, nu clasificată prin ghicit.',
    apply: migrateExpenseCategoryV6,
  },
  {
    from: DATA_VERSION_EXPENSE_CATEGORY,
    to: DATA_VERSION_TAX_RESERVE,
    name: 'tax-reserve',
    summary:
      'Datele pot înregistra acum suma pusă deoparte pentru impozit (null = nicio sumă înregistrată). Nimic nu a fost completat: o rezervă de 0 lei este o faptă înregistrată de utilizator, nu o presupunere despre banii lui.',
    apply: migrateReservedAmountV7,
  },
  {
    from: DATA_VERSION_TAX_RESERVE,
    to: DATA_VERSION_PENSION_FACTS,
    name: 'pension-facts',
    summary:
      'Profilul poate consemna acum faptele pensiei pe an fiscal: sume primite ca pensii în an (art. 174 alin. (7) lit. c) din Codul fiscal), suspendarea consemnată, contextul anului precedent (alin. (8)) și asigurarea medicală din alt stat dovedită (art. 153 alin. (2)). „pensionStatus” a fost redenumit în „pensionerStatus”, nu reinterpretat: un vechi „da” nu dovedește nicio sumă încasată în an, deci excepția CASS rămâne nehotărâtă, nici acordată nici refuzată.',
    apply: migratePensionFactsV8,
  },
  {
    from: DATA_VERSION_PENSION_FACTS,
    to: DATA_VERSION_RULE_SET_DIGEST,
    name: 'rule-set-digest',
    summary:
      'Fiecare înregistrare de calcul primește acum „ruleSetHash”: amprenta sha-256 a regulilor care au produs cifra, calculată pe o serializare canonicală (chei sortate, reguli sortate după ruleId, parametri după id). Nimic nu a fost inventat: o înregistrare veche primește „null”, adică „regulile care au produs acest calcul nu mai pot fi reconstruite” — setul de reguli s-a schimbat de trei ori (CAS, CASS, impozit pe venit) sub același „releaseId”, iar o amprentă calculată astăzi ar pretinde că ea a produs un număr vechi. Niciun „inputsHash" stocat nu se mișcă și niciun „ruleRelease" înglobat nu este rescris.',
    apply: migrateRuleSetDigestV9,
  },
  {
    from: DATA_VERSION_RULE_SET_DIGEST,
    to: DATA_VERSION_RECORD_CURRENCY,
    name: 'record-currency',
    summary:
      'Fiecare venit și cheltuială stocată primește moneda în care e scrisă: un număr simplu devine `{ amount, currency: "RON" }`. Nimic nu a fost recalculat — suma rămâne bit cu bit aceeași, se schimbă doar forma. RON pentru că așa au fost mereu aceste înregistrări: au intrat printr-un formular etichetat „(RON)” și un motor care știa să le adune doar în lei. „declarations”, „profile.cashFloorLei” și „profile.salaryIncomeLei” rămân în lei — o Declarația Unică se depune în lei. Niciun „inputsHash" stocat nu se mișcă și nu se scrie niciun „preMigrationInputsHash": amprenta se calculează pe `{ profile, revenues, expenses }`, unde „revenues" și „expenses" sunt totaluri agregate în lei, nu șirul de înregistrări, deci o monedă pusă pe înregistrare nu ajunge niciodată în octetul hash-ului. O înregistrare istorică rămâne la fel de interpretabilă ca înainte.',
    apply: migrateRecordCurrencyV10,
  },
  {
    from: DATA_VERSION_RECORD_CURRENCY,
    to: DATA_VERSION_ANNUAL_FILING,
    name: 'annual-filing',
    summary:
      'Aplicația poate înregistra acum declarația anuală (Declarația Unică 212) pe an fiscal declarat, nu pe lună. Înregistrările lunare vechi au fost eliminate: un PFA în sistem real depune o singură Declarație Unică pe an fiscal (art. 122 alin. (3) din Codul fiscal), deci nu există nicio declarație lunară al cărei record ar fi fost. Niciuna nu a fost transformată în depunere anuală — un rând lunar cu status „inregistrata” nu este dovada că cineva a depus ceva, iar o depunere inventată ar fi o faptă pe care utilizatorul nu a făcut-o. „filings” pornește gol.',
    apply: migrateAnnualFilingV11,
  },
  {
    from: DATA_VERSION_ANNUAL_FILING,
    to: DATA_VERSION_ACTIVITY_FAMILY,
    name: 'activity-family',
    summary:
      'Profilul poate înregistra acum familia de activități declarată de persoana fizică: „altă activitate” sau „prestare de servicii de cazare”. Nimic nu a fost completat în acest pas: niciun câmp vechi conține acest fapt, iar o valoare implicită „altă activitate” ar afirma că regulile obișnuite se aplică unei persoane care nu a fost niciodată întrebată. Codul CAEN nu este un răspuns — OMFP 925/2017 art. 2 alin. (4) leagă metoda de impunere de descrierea activității „independent de codurile CAEN menționate cu titlu exemplificativ”. Un profil fără răspuns rămâne fără răspuns și este raportat ca faptă de profil care lipsește, nu ca profil complet.',
    apply: migrateActivityFamilyV12,
  },
  {
    from: DATA_VERSION_ACTIVITY_FAMILY,
    to: DATA_VERSION_ACCOMMODATION_FACTS,
    name: 'accommodation-facts',
    summary:
      'Profilul poate înregistra acum faptele pe care se decide TITLUL sub care intră veniturile din cazare: câte camere se închiriază pe termen scurt în fiecare an fiscal, răspunsul persoanei la condiția din art. 68^3 alin. (1) (operator economic potrivit legislației turismului) și ce citire a art. 68^3 alin. (3) alege pentru venitul brut. Nimic nu a fost completat în acest pas, și acesta este tot conținutul lui. Numărul de camere nu este o sumă care intră într-o formulă, ci un comutator de categorie: 1–7 camere înseamnă cedarea folosinței bunurilor (art. 83 alin. (2), art. 85), peste 7 camere înseamnă activitate independentă potrivit art. 68^3 (art. 83 alin. (4)). Un număr inventat la migrare ar inventa și un titlu fiscal pe care persoana nu l-a revendicat niciodată. La fel pentru celelalte două: o citire implicită a alin. (3) ar închide o întrebare pe care două lecturi vii și nicio sursă primară nu o hotărăsc, iar un răspuns implicit la alin. (1) ar decide o clasificare din legea turismului pe care Codul fiscal nu o decide. Un profil fără răspuns rămâne fără răspuns, iar aplicația refuză cifra în loc să ghicească titlul.',
    apply: migrateAccommodationFactsV13,
  },
  {
    from: DATA_VERSION_ACCOMMODATION_FACTS,
    to: DATA_VERSION_OCCUPANCY_SHEET,
    name: 'occupancy-sheet',
    summary:
      'Datele pot reține acum fișa de ocupare a capacității de cazare, aprobată prin OPANAF nr. 381 din 24.03.2026 (MO I nr. 250 din 31.03.2026), care abrogă OPANAF nr. 398/2021. Fișa se completează per cameră, per an, și conține date cu caracter personal ale persoanelor cazate. Nimic nu a fost completat în acest pas și nimic nu putea fi completat: fișa este un document pe care persoana îl întocmește de mână, iar o șablonă sau o fișă derivată din numărul de camere ar pune nume și date de identitate ale unor persoane care nu au existat niciodată pe un document pe care contribuabilul are obligația legală să-l păstreze. Colecția rămâne absentă atâta timp cât n-a fost întocmită nicio fișă. Fișa este o obligație de păstrare, nu o declarație: „să completeze și să păstreze”, un exemplar, păstrat de contribuabil — nimic nu se trimite către ANAF, iar aplicația nu construiește nicio cale de trimitere. Datele despre cazați nu intră în niciun calcul: nu sunt sursă de venit, nu sunt număr de camere, nu sunt cifră de ocupare și nu pot ajunge în motorul fiscal.',
    apply: migrateOccupancySheetV14,
  },
  {
    from: DATA_VERSION_OCCUPANCY_SHEET,
    to: DATA_VERSION_VEHICLE_FACTS,
    name: 'vehicle-facts',
    summary:
      'Datele pot înregistra acum vehiculele pe care contribuabilul le deține sau le are în folosință, cu faptele declarate pentru fiecare mașină și pentru fiecare an fiscal: dacă mașina este folosită personal de contribuabil sau de membrul asociat, cum este folosită de fapt (exclusiv în activitate, mixt, deloc, nesigur), care dintre cele cinci categorii de excepție de la art. 68 alin. (7) lit. k) este invocată și care este autoturismul pe care persoana îl desemnează pentru dreptul de deducere a cheltuielilor de funcționare. Nimic nu a fost completat și nicio cheltuială nu a fost atribuită vreunui vehicul în acest pas. Fiecare dintre aceste câmpuri este o afirmație juridică: un `usedByPerson` implicit ar muta o mașină înăuntru sau în afara art. 68 alin. (5) lit. j), care este limitată prin propriile cuvinte la „autoturismele folosite de contribuabil sau membru asociat”; un `designatedForRunningCosts` implicit ar alege el autoturismul, iar niciun text primar nu dă nicio regulă de selecție; o utilizare implicită „exclusiv” ar pretinde o deducere nejustificată prin documente și foaie de parcurs, iar una „deloc" ar refuza o deducere pe care legea o dă la 50 %. Un payload care nu a numit niciodată un vehicul rămâne fără cheia `vehicles`, iar cheltuielile `vehicle_related` din el se comportă exact ca înainte: limitarea de 50 % din alin. (7) lit. k), pentru că nu există nicio faptă per mașină de consultat și nicio limită de aplicat.',
    apply: migrateVehicleFactsV15,
  },
  {
    from: DATA_VERSION_VEHICLE_FACTS,
    to: DATA_VERSION_OTHER_INCOME_LADDER,
    name: 'other-income-ladder',
    summary:
      'Profilul poate înregistra acum SUMELE pe care persoana le-a declarat pentru fiecare dintre cele șase categorii de venituri de la art. 155 alin. (1) lit. c)-h) din Codul fiscal, pe an fiscal: proprietate intelectuală, asocierea cu o persoană juridică, cedarea folosinței bunurilor, activități agricole/silvicultură/piscicultură, investiții și alte surse. Listele de bifă „imobiliare / autovehicule / dividende / concesiune / alte” au fost eliminate, nu botezate altfel: ele omiteau trei dintre cele șase categorii, „concesiune” nu are niciun corespondent în Codul fiscal, iar „alte” este mai larg decât art. 114 — ar fi putut cuprinde jocuri de noroc sau transferul proprietăților imobiliare, care nu atrag niciodată CASS. Nicio bifă nu a fost transformată într-o sumă: o bifă spune că o sursă există, nu cât a plătit, iar art. 170 alin. (4) și art. 174 alin. (7) lit. b) compară sume cu salariile minime. Nici cele șase sume nu au fost completate: șase zerouri inventate ar muta o persoană de la „nu datorează deloc CASS” la o bază de 6, 12 sau 24 de salarii minime — exact defectul pe care acest pas îl închide.',
    apply: migrateOtherIncomeLadderV16,
  },
  {
    from: DATA_VERSION_OTHER_INCOME_LADDER,
    to: DATA_VERSION_FIXED_ASSETS,
    name: 'fixed-assets',
    summary:
      'Datele pot înregistra acum mijloacele fixe din patrimoniul activității, cu faptele de care are nevoie amortizarea fiscală: data intrării în patrimoniu, data punerii în funcțiune, valoarea fiscală de amortizare (care, potrivit pct. 28 lit. b) din normele Titlul II, include și TVA devenită nedeductibilă), durata normală de funcționare stabilită de contribuabil, metoda (liniară sau degresivă) și opțiunea sub prag din art. 28 alin. (21), care potrivit pct. 31 din aceleași norme se exercită la data intrării în patrimoniu. Nimic nu a fost completat: fiecare dintre aceste câmpuri este o afirmație juridică. O dată a punerii în funcțiune inventată alege anul în care începe amortizarea, iar expresia nu este definită nicăieri în legea fiscală. O durată inventată alege cota anuală și plafonul de la scăderea din gestiune, pe care pct. 27 le lasă în mod expres contribuabilului. Un „aport” sau un „cumpărare” inventat decide întrebarea contestată dintre art. 68 alin. (7) lit. k^1) și art. 7 pct. 44 lit. c). O opțiune alin. (21) inventată alege între două căi alternative care, potrivit pct. 31, se aleg la intrarea în patrimoniu și nu pot fi schimbate ulterior. Nicio cheltuială nu a fost transformată în mijloc fix: o cheltuială de achiziție de bun amortizabil înregistrează că a plecat o sumă, nu că a intrat un bun amortizabil în patrimoniu, iar art. 68 alin. (7) lit. h) tocmai de aceea ține achiziția în afara cheltuielilor deductibile. Un payload care nu a numit niciodată un bun rămâne fără cheia `fixedAssets`.',
    apply: migrateFixedAssetsV17,
  },
  {
    from: DATA_VERSION_FIXED_ASSETS,
    to: DATA_VERSION_INPUT_VAT,
    name: 'input-vat-registration',
    summary:
      'Cheia `vatExempt` a profilului a fost ștearsă. Nu a fost convertită în nicio stare de înregistrare: booleanul nu înregistra o astfel de stare, iar research/42 §11.2 arată că cele șase stări pe care legea le folosește (art. 310, art. 316, înregistrare voluntară, plafon depășit, anulare, reinregistrare) nu pot fi citite din el. O conversie ar fi inventat un fapt despre registrul ANAF care decide măsura banilor pentru fiecare înregistrare din registru. Starea de înregistrare este acum o faptă declarată, iar un payload fără ea rămâne fără cheia `vatRegistration`, iar aplicația spune că nu știe dacă persoana facturează TVA.',
    apply: migrateInputVatRegistrationV18,
  },
  {
    from: DATA_VERSION_INPUT_VAT,
    to: DATA_VERSION_VAT_RETURNS,
    name: 'vat-returns',
    summary:
      'Datele pot înregistra acum deconturile periodice de TVA (formular 300, OPANAF nr. 174 din 05.02.2026, MO I nr. 105 din 09.02.2026), câte un record pentru fiecare perioadă fiscală. Colecția se deschide VIDĂ, și acesta este tot conținutul pasului. O perioadă fiscală care există nu este nicio dovadă că decontul pentru ea a fost depus, iar aplicația nu a depus niciodată vreunul: un record `depusa` inventat pentru fiecare lună sau trimestru ar fabrica tocmai dovada falsă pe care pasul v10→v11 a eliminat-o, și ar permite unui termen să fie marcat „Depusă” dintr-un record pe care nimeni nu l-a făcut. La fel rămân absente și faptele din profil pe care se decide art. 322: alin. (3) cere o cifră pe care contribuabilul o PRECONIZEAZĂ — o estimare pe care doar el o poate face — iar alin. (4) se aprinde doar dacă persoana venea de sub scutirea de la art. 310, un statut pe care registrul nu l-a înregistrat niciodată. O perioadă fiscală implicită ar însemna că aplicația a răspuns la o întrebare care nu a fost pusă încă; în schimb aplicația întreabă, spune regula în română și marchează răspunsul ca fiind al persoanei, nu concluzia ei. Un payload care are deja cheia `vatReturns` o păstrează neschimată: acest pas deschide o colecție, nu rescrie una.',
    apply: migrateVatReturnsV19,
  },
  {
    from: DATA_VERSION_VAT_RETURNS,
    to: DATA_VERSION_LEASE_FACTS,
    name: 'lease-facts',
    summary:
      'Profilul poate înregistra acum faptele pe care se decide REGIMUL sub care se impozitează închirierea obișnuită (cedarea folosinței bunurilor): dacă chiriașul este persoană fizică sau entitate cu obligația de a conduce evidență contabilă — faptă care desparte art. 84 de art. 84^1 — chiria prevăzută în contract pentru anul fiscal, cheltuielile care cad în sarcina proprietarului dar sunt efectuate de cealaltă parte, cele două condiții ale art. 84^1 alin. (8) (chirie plătită exclusiv în natură, garanție utilizată pentru plata chiriei) și data încheierii contractului, de la care pornește termenul de 30 de zile de la art. 83 alin. (5). Nimic nu a fost completat în acest pas, și acesta este tot conținutul lui. Un `tenantNature` inventat ar muta venitul între art. 84 și art. 84^1 și, cu el, obligația declarativă: art. 122 alin. (6) lit. a) scutește de declarația unică pentru impozitul pe venit când impozitul se reține la sursă și este final, dar art. 122 alin. (7) cere tot declarația pentru contribuții, pentru că pe chiria obișnuită CASS nu se reține la sursă. O chirie anuală inventată din încasările registrului ar înlocui măsura de la art. 84 alin. (2) („indiferent de momentul încasării”) cu măsura de la art. 85 alin. (2) („încasate în cursul anului fiscal”) — aceeași sumă la 31 decembrie și alta în orice altă zi a anului. O dată a contractului inventată ar naște un termen de înregistrare de 30 de zile pe care nimeni nu îl datorează. Un profil fără aceste fapte rămâne fără ele, iar aplicația refuză cifra în loc să ghicească regimul.',
    apply: migrateLeaseFactsV20,
  },
  {
    from: DATA_VERSION_LEASE_FACTS,
    to: DATA_VERSION_DOCUMENT_BLOB_REF,
    name: 'document-blob-ref',
    summary:
      'Un document poate purta acum `blobRef` — o trimitere la octeții lui, păstrați în afara `localStorage` — în loc de octeții inline. Nimic nu a fost completat în acest pas, și acesta este tot conținutul lui: forma s-a schimbat, datele nu. Octeții sunt mutați de un pas asincron de realocare, dincolo de lanț, după încărcare, și numai după ce scrierea în depozitul de octeți a fost confirmată — acest lanț este în întregime sincron (nicio funcție `async` și niciun `Promise` în `migration.ts`), deci un pas care ar atinge depozitul ar fie să rupă contractul lui, fie să nu facă nimic în tăcere. O înregistrare care nu a avut niciodată octeți rămâne fără trimitere. O înregistrare care îi are rămâne cu ei inline până când scrierea a reușit: realocarea care pierde un document este mai gravă decât lipsa realocării.',
    apply: migrateDocumentBlobRefV21,
  },
  {
    from: DATA_VERSION_DOCUMENT_BLOB_REF,
    to: DATA_VERSION_EFACTURA_DEADLINE,
    name: 'efactura-deadline',
    summary:
      'Preferința „când transmiți factura” a fost retrasă. Ecranul oferea termenul ca pe o alegere și termenul oferit era greșit: „În decurs de 2 zile de la emitere”, în timp ce sursa citată de aplicație — OUG 120/2021 art. 10 alin. (7), modificată de OUG 89/2025 pct. 2 art. X, în vigoare de la 01.01.2026 — spune 5 ZILE LUCRĂTOARE de la data emiterii. Niciun răspuns vechi nu a fost transformat într-un răspuns nou: „2 zile / imediat” răspund la ÎNCÂND, „manual / automat” răspund la CUM, și nicio corespondență între ele nu este susținută de ce a înregistrat persoana. A alege una în locul ei ar pune în gura contribuabilului o frază pe care nu a scris-o niciodată. Cheia ștearsă este singura faptă pierdută de acest pas: nicio sumă, niciun termen și nicio trimitere nu se calculau din ea, iar cardul e-Factura spune pe ecran ce a fost alegerea, care este termenul legal și că aplicația nu a ales nimic în locul tău. „dateContact” rămâne neschimbat. Câmpul a rămas acceptat la citire în toate versiunile, pentru că altfel poarta de încărcare — nu pasul cu motivul înregistrat — ar fi fost cea care distruge valoarea.',
    apply: migrateEfacturaDeadlineV22,
  },
  {
    from: DATA_VERSION_EFACTURA_DEADLINE,
    to: DATA_VERSION_EXPENSE_ASSET_LINK,
    name: 'expense-asset-link',
    summary:
      'O cheltuială poate înregistra acum mijlocul fix căruia îi aparține, prin legătura pe care o face persoana. Nimic nu a fost completat în acest pas și nimic nu putea fi completat: art. 68 alin. (4) lit. d) leagă cele două căi de calcul — planul de amortizare și cheltuiala tastată de mână — dar nu dă nicio regulă prin care o linie tastată să fie atribuită unui bun. O legătură ghicită după sumă, după dată sau după furnizor ar îngusta refuzul pe o ficțiune, ceea ce este mai grav decât un refuz care spune sincer că e larg. Până când legătura există, conflictul rămâne la nivelul registrului, iar aplicația spune asta pe ecran. Un payload care are deja cheia `assetId` o păstrează neschimbată.',
    apply: migrateExpenseAssetLinkV23,
  },
  {
    from: DATA_VERSION_EXPENSE_ASSET_LINK,
    to: DATA_VERSION_DISPOSAL_PROCEEDS,
    name: 'fixed-asset-disposal-proceeds',
    summary:
      'Un bun scos din gestiune poate înregistra acum suma realizată din înstrăinare. Normele Titlul II pct. 27 pun o primă limită valorii neamortizate — 1.500 lei × lunile rămase din durata declarată — iar normele Titlul IV pct. 7 lit. o) pun aceleiași valori a doua limită, „la nivelul venitului realizat din înstrăinare”. Aplicația cunoștea prima și nu avea unde să scrie a doua, de aceea cifra pct. 27 era arătată și nu era postată: fără preț, ea ar fi dedus mai mult decât permite norma ori de câte ori bunul s-a vândut sub valoarea neamortizată. Nimic nu a fost completat în acest pas: prețul este o faptă despre o tranzacție, și niciun câmp stocat nu o înregistrează; derivată din valoarea fiscală sau din residual, ea ar inventa chiar numărul față de care norma măsoară. Cifra este plafonul corect, nu deductibilul final. La momentul acestui pas B-153 rămânea deschis — planul de amortizare continua după luna ieșirii din gestiune, în timp ce figura calculată număra doar lunile folosite; brief 80 a închis acea neconcordanță (D-DEPR-1): planul se oprește acum în luna ieșirii, iar cele două cifre numără aceleași luni.',
    apply: migrateDisposalProceedsV24,
  },
  {
    from: DATA_VERSION_DISPOSAL_PROCEEDS,
    to: DATA_VERSION_PRIOR_YEAR_LOSSES,
    name: 'prior-year-fiscal-losses',
    summary:
      'Pierderea fiscală din anii anteriori poate fi acum păstrată în registru. Normele art. 118 alin. (4) și '
      + '(5) permit ca pierderea determinată în sistem real să se reporte „pentru o perioadă de 5 ani fiscali” '
      + 'și să se compenseze „la nivelul fiecărei surse”, „cronologic, în funcție de veşimea pierderii”, în '
      + 'limit a 70 % din netul aceleiași surse. Motorul aplicației știa deja regula — o implementase și o '
      + 'verificase în cel de-al 70-lea brief — dar nu avea cum să afle pierderea: cifra `pierderiReportate` '
      + 'rămânea zero, iar impozitul din anii următori era mai mare cu suma pe care persoana o declarase deja. '
      + 'Inregistrarea se face pe sursă și pe anul în care pierderea a fost determinată, pentru că cele trei '
      + 'reguli — fereastra de 5 ani, compensarea pe sursă și ordinea cronologică — sunt fapte despre fiecare '
      + 'pierdere în parte și niciuna nu se poate aplica unui total. De cealaltă parte, formularul 212 rd.5 '
      + 'cere un singur total, fără coloană pe ani: aplicația poate ordona corect o împărțire declarată, dar '
      + 'nu o poate verifica pe cea din formular. Ecranul spune acest lucru în acești termeni. Nimic nu a fost '
      + 'completat în acest pas: o pierdere reportată este o faptă despre o declarație deja depusă, iar '
      + 'inventată dintr-un rezultat negativ din acest registru ar fabrica o pierdere care nu a fost declarată.',
    apply: migratePriorYearLossesV25,
  },
  {
    from: DATA_VERSION_PRIOR_YEAR_LOSSES,
    to: DATA_VERSION_LADDER_ANSWERS,
    name: 'cass-ladder-answers',
    summary:
      'O categorie din scara de la art. 170 alin. (4) poate înregistra acum că persoana a fost ÎNTREBATĂ și a '
      + 'răspuns „nu am avut”, ca faptă deosebită de faptul că nimeni nu a întrebat-o. Scara a refuzat până '
      + 'acum orice set parțial, pentru că art. 170 alin. (4) cumulează „veniturile prevăzute la art. 155 alin. '
      + '(1) lit. c)-h)” — peste TOATE șase — și o categorie fără răspuns face suma necunoscută, nu mai mică. '
      + 'Refuzul rămâne; ceea ce s-a îngustat este declanșatorul lui: de la „nu toate șase sunt numere” la „nu '
      + 'toate șase au un răspuns”. Nimic nu a fost completat în acest pas, și acesta este tocmai conținutul '
      + 'lui: fiecare registru existent este într-o stare în care cele șase întrebări nu au fost puse niciodată, '
      + 'deci toate trebuie să rămână pe „nu se știe”. Un pas care ar fi completat „nu am avut” ar fi luat o '
      + 'persoană care nu a văzut niciodată ecranul și ar fi afirmat în registru că nu are alte venituri, iar '
      + 'apoi ar fi calculat baza CASS pe afirmația aceea — subevaluând contribuția la sănătate a cuiva care nu '
      + 'a fost întrebat. O căsuță goală înregistrează că nu s-a scris nimic, nu că nu s-a câștigat nimic. Un '
      + 'payload care are deja cheia `ladderAnswers` o păstrează neschimbată.',
    apply: migrateCassLadderAnswersV26,
  },
];

/** Version a payload declares, with absence meaning the base of the chain. */
export function readStoredVersion(parsed: PersistedAppData): number {
  return parsed.version ?? DATA_VERSION_BASE;
}

/**
 * Run the chain. Throws `UnsupportedDataVersionError` for a payload from a newer
 * build; the load path turns that into a quarantine (D-3).
 */
export function migratePersistedData(parsed: PersistedAppData): MigrationOutcome {
  const fromVersion = readStoredVersion(parsed);
  if (fromVersion > CURRENT_DATA_VERSION) {
    throw new UnsupportedDataVersionError(fromVersion, CURRENT_DATA_VERSION);
  }

  let data = parsed;
  const stepsApplied: string[] = [];
  for (const step of MIGRATION_CHAIN) {
    if (step.from !== readVersion(data)) continue;
    data = step.apply(data);
    stepsApplied.push(step.name);
    if (readVersion(data) !== step.to) {
      // A step that does not bump the version would silently loop the chain or
      // leave the payload permanently "behind". Fail loudly instead.
      throw new Error(
        `migration step '${step.name}' did not set version ${step.to} (got ${readVersion(data)})`,
      );
    }
  }

  return {
    data,
    fromVersion,
    toVersion: CURRENT_DATA_VERSION,
    migrated: stepsApplied.length > 0,
    stepsApplied,
  };
}

function readVersion(data: PersistedAppData): number {
  return data.version ?? DATA_VERSION_BASE;
}
