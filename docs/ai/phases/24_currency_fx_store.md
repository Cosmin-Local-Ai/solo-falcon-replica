# Phase 24 — TASK 10a: currency on the money record, and the FX rate store

Date: **2026-10-09** (`date +%F`). Brief: `docs/ai/briefs/26_task10a_currency_fx_store.md`.
Authority: `docs/ai/research/23_fx_conversion_and_bnr_rates_2026.md` — read in full; everything below is a
summary of it, and where this doc states a citation it restates the research, not a re-reading.
Commits: `84dda5b` (money + migration), `8732e3f` (FX store + fetcher + conversion), `b54d756` (the record on
screen).

Baseline inherited: `3d42c4c` — `tsc` 0 · `64 files / 1149 tests` · `build` 0 · **`e2e` 37**.
Final: `tsc` 0 · **`72 files / 1271 tests`** (+122) · `build` 0 · **`e2e` 37**. **No money figure moved.**

---

## 1. The money type — exact shape

`src/domain/money.ts`. `Bani` (`number & { readonly __brand: 'bani' }`) is unchanged and remains the unit of
RON arithmetic. On top of it:

```ts
export const CURRENCY_CODES = ['RON', 'EUR', 'USD', 'GBP', 'HUF'] as const;
export type CurrencyCode = (typeof CURRENCY_CODES)[number];
export const MINOR_UNITS_PER_MAJOR: Record<CurrencyCode, 100> = { RON: 100, EUR: 100, USD: 100, GBP: 100, HUF: 100 };

export interface Money<C extends CurrencyCode = CurrencyCode> {
  amount: Bani;      // integer minor units: bani for RON, cents for EUR/USD
  currency: C;
}
export type RonMoney = Money<'RON'>;
```

Constructors `money(amount, currency)`, `ron(major)`, `eur(major)`; predicates `isRon`, `isCurrencyCode`;
arithmetic `addMoney`, `subMoney`, `sumMoney`, `maxMoney`; the boundary `requireRon(amount, context?): Bani`;
formatting `formatMoney` (`1.234,56 EUR`, built on `formatBani`, no `Intl`); entry `moneyInputValue` /
`parseMoneyInput(text, currency)`; `ENTRY_CURRENCIES = ['RON','EUR','USD']` is the vocabulary a form offers.

**How cross-currency arithmetic becomes a type error.** The signature is the enforcement:

```ts
export function addMoney<A extends CurrencyCode, B extends A>(a: Money<A>, b: Money<B>): Money<A>
```

`addMoney(ron(100), eur(100))` does not type-check, because `'EUR'` does not extend `'RON'`. Pinned in
`src/domain/money.currency.test.ts` with `@ts-expect-error` on `addMoney`, `subMoney` and `maxMoney`. An
unused `@ts-expect-error` is itself a `tsc` error, so if the signature ever loosens the **build fails** — the
guarantee cannot quietly decay into a comment. A runtime `MixedCurrencyError` sits behind each one as well,
for callers arriving from untyped JSON.

`requireRon` is the explicit boundary the brief asks for. It **asserts, it does not convert**: a
`Money<'EUR'>` reaching it throws naming the currency and pointing at `convertToRon`. Converting there would
mean picking a rate, and picking a rate is a legal decision the money layer is not entitled to make. That
silent read — a EUR number consumed as lei — **is defect B-32**, and it is now structurally unavailable.

**Records.** `Revenue.valoareFaraTva` / `.tva` and `Expense.valoareFaraTva` / `.tva` are `Money`
(`src/data/types.ts:12`, `:39`). `Declaration.venituri` / `.cheltuieli` and `PfaProfile.cashFloorLei` stay
`Bani`: they are RON aggregates of the ledger, not records a foreign invoice produced.

**Non-RON records are excluded, never converted.** `estimateBasis.ts` gained `ExcludedReason`
`'foreign_currency'` and `DeductibleExpenseCounts.foreignCurrency`, with a `detail` naming the missing datum
(the rate, and the basis it would need). `aggregation.ts` gained `selectUnconvertedRecords` and
`recordTotal` returns `null` for a non-RON record; `YtdTotals` deliberately keeps its old shape.
`Documents.tsx` skips non-RON records in the RJIP export and says how many. **No euro cap was wired** — that
is TASK 10b.

---

## 2. The migration, and the `inputsHash` decision (the landmine)

Data version **9 → 10**. Chain step **`record-currency`** (`from: 9, to: 10`), `migrateRecordCurrencyV10` in
`src/data/migration.ts`. It wraps each bare number as `{ amount, currency: 'RON' }`, is idempotent, touches
only `revenues[]` and `expenses[]`, and returns the payload unchanged when nothing needs wrapping.

### What `inputsHash` actually normalises — read, not inferred

`canonicalize` (`src/domain/snapshots/serialize.ts`) walks the value it is handed: `null`/`undefined` →
`'null'`; a finite number → `String(value)`; a string → `JSON.stringify`; an array → recurse; an object →
`Object.keys(value).sort()` and **every own enumerable key** emitted. No allow-list, no stripping.

What it is handed is `inputSnapshot`, and `CalculationInput` (`src/domain/snapshots/types.ts`) is:

```ts
{ profile: PfaProfile; revenues: Bani; expenses: Bani }
```

**`revenues` and `expenses` are aggregate lei totals, not `Revenue[]` / `Expense[]`.** `ruleSetHash` is a
**sibling** field on `TaxCalculationSnapshot`, never inside `inputSnapshot` — pinned by
`snapshots.test.ts:437` (`Object.keys(snap.inputSnapshot).sort() === ['expenses','profile','revenues']`).

### The decision, written down

**The normalisation is pinned; no stored `inputsHash` moves.** A currency stamped on a `Revenue`/`Expense` is
**not reachable from the digest bytes**, because the snapshot stores the post-aggregation RON totals the
engine consumed, not the records. Therefore:

- **no re-hash**, and **no `preMigrationInputsHash` written by this step** — that field exists for steps that
  legitimately re-derive a digest because the hashed bytes changed (`money-bani`, `profile-materialization`);
  writing it here would assert that this step changed the bytes, and it did not;
- the step follows `migrateRuleSetDigestV9`'s precedent: change stored shape, stamp metadata, fabricate
  nothing;
- **the two ways this task could have moved a digest were avoided on purpose**: adding a field to
  `PfaProfile` (which `canonicalize` emits) and adding a key to `inputSnapshot` (already forbidden by
  `snapshots.test.ts:437`).

**How a historical snapshot stays interpretable.** Its `inputSnapshot.revenues` / `.expenses` remain bare
numbers — asserted, not explained, in `src/data/migration.currency.test.ts`. The digest in the record still
verifies against the inputs in the record (`computeInputsHashSync(snapshot.inputSnapshot)`), and
`ruleSetHash` beside it says which rules produced it. Nothing about a past calculation had to be
reconstructed, because nothing about it changed.

Proof, in `src/data/migration.currency.test.ts` (19 tests): amounts bit-identical before/after; RON stamped;
idempotent; already-stamped records returned by identity; snapshot `inputsHash`, `inputSnapshot`,
`calculationLines`, `output`, `ruleSetHash` all unchanged; `preMigrationInputsHash` absent; `inputSnapshot`
keys still exactly the three; profile key-set unchanged; declarations and `reservedAmount` untouched; a v9
payload needs exactly one step; a v10 payload runs none; a payload with no `expenses` key does not gain one.

### Fixture discipline (the trap Phase 10 §3.3(4) records)

**Fixtures are payloads, not values.** A fixture written to `localStorage` at `version < 10` must carry the
shape that arrives, so `src/data/types.ts` gained `LegacyRevenue`, `LegacyExpense` and `LegacyAppData` —
migration-test-only, documented as never-for-production. Typing those fixtures `Revenue` would have forced
them into the post-v10 object form and the chain would have had nothing left to migrate.

Two **production** bugs surfaced while adapting tests, and both were fixed in the code, not in the assertion:

1. `src/data/schema.ts` — the money object branch used `bani(z.number())`, so a **negative** amount inside
   `{ amount, currency }` loaded instead of quarantining. Now `bani(nonNegative)`, the same rule the
   bare-number branch enforces.
2. `src/App.test.tsx` — a raw v4 fixture spread the seed and handed the `money-bani` step an object, which it
   reported as `[object Object]` and turned into a second notice, which flipped the banner to its plural
   wording and failed an unrelated assertion. The fixture now unwraps to a bare number.

### The load gate converts nothing

`moneyField()` is `z.union([nonNegative, moneyObjectSchema]).transform(v => v as unknown as Money)` — an
identity cast, with a `// SAFETY:` line saying so. A number stays a number, so the v4→v5 `money-bani` step
still sees the bytes it expects. Converting at the gate would have made the migration step see objects and
report every amount as unconvertible.

---

## 3. The FX rate store — schema

`src/domain/fx/rates.ts`:

```ts
export type RateKind = 'daily_reference' | 'annual_average';
export type RateEntryMode = 'fetched' | 'manual';

export interface FxRateRecord {
  currency: Exclude<CurrencyCode, 'RON'>;
  rate: string;          // the printed decimal — "5.3470", never a double
  rateKind: RateKind;
  rateDate?: string;     // YYYY-MM-DD, present iff daily_reference
  rateYear?: number;     // present iff annual_average
  seriesCode: string;
  sourceUrl: string;
  fetchedAt: string;
  provisional: boolean;
  carriedFrom?: string;  // set only by the app's carry-forward policy
  entryMode: RateEntryMode;
}
```

`checkRateRecord` / `validateRateRecord` refuse: a daily rate with no date; an average with no year; either
kind carrying the other's anchor; a non-positive or comma-decimal rate; an empty `sourceUrl`, `seriesCode` or
`fetchedAt`; `RON` as a source currency; `carriedFrom` on an annual average.

**Why `rate` is a string.** BNR prints four decimals. A `number` cannot hold `5.3470` exactly, and a rate
that drifts in the last decimal is Phase 10's B-17 half-cent disagreement reappearing inside a conversion.
Arithmetic goes through `decimal.js-light` via the string.

**Why provenance is required, not optional.** BNR's terms require **indicarea sursei** on redistribution, and
BNR states its list „nu implică obligativitatea utilizării … în înregistrări contabile". A conversion the
user cannot trace to a dated, sourced rate is a conversion they cannot defend.

**What the schema cannot express, on purpose.** There is no `dailyRates`, no `monthlyAverages`, no field an
annual average could be computed *into*. Asserted:
`Object.keys(fxRateRecordSchema.shape)` is exactly the eleven fields above.

**Series codes are labelled by what was verified.** `SERIES_CODE_STATUS` marks `CURSZ_EUR` and `CURSA_EURM`
`verified` (read off the BNR series page in research 23) and **everything else `unverified`** — including any
USD annual-average code, which is pattern-derived and must never be asserted. `cubeRecords` suffixes a
non-EUR code `-PATTERN` (e.g. `CURSZ_USD-PATTERN`): deliberate ugliness, because a code that looks official
and was never read from the page is exactly the kind of figure this repo refuses to state.

**Persistence.** `fxRates?: FxRateRecord[]` on `AppData` and `PersistedAppData` + `persistedAppDataSchema`.
Declared rather than left off, for the standing reason in that file: **zod strips undeclared keys**, so an
undeclared `fxRates` would be erased by the next save-and-load and the user would silently lose rates they
typed by hand. **No migration step backfills it** — a backfilled rate would be a fabricated legal figure.
`toAppData` carries it as `undefined` when absent, not `[]`: an empty array written back would read as „rates
were fetched and none existed", which is a different fact.

---

## 4. The fetcher boundary — its name, and what it guarantees

**The boundary is `FxRateProvider`** (`src/domain/fx/provider.ts`):

```ts
export interface FxRateProvider {
  dailyRate(currency: RateCurrency, date: string): FxRateRecord | null;
  annualAverage(currency: RateCurrency, year: number): FxRateRecord | null;
}
```

Two reads, **synchronous**, no promises, no side effects. That is not a convenience: a rate is a fact about a
day that has already happened, so making the read synchronous removes *by type* the temptation to re-fetch on
every call — the behaviour the brief rules out („cache it, never re-derive on read"). Getting rates *in* is a
separate, explicit, asynchronous act: `loadDailyRates(store, { fetchText, … })`, or a human typing one.
**Fetch is a deliberate write; read is a pure lookup.**

Implementations: `RateStore` (the cache, and the default provider), `fixtureRateProvider(records)` (the seam
every test uses), `manualAnnualAverage(...)` (manual entry — the *normal* path for an annual average, because
research 23 gap 4 records no working machine-readable export and the „Serii anuale" table is JS-rendered).
`readDailyRate(store, currency, date)` is the read path that applies the carry-forward **visibly**, so a bare
lookup never substitutes silently.

**The cache test is the rule, stated as a count**: inject a `vi.fn()` fetch, `loadDailyRates` once, read 25
times, assert the fetch call count is **still 1**.

**No test performs a network call.** `fetchBnrXml(fetchText, …)` takes an injected `FetchText`; the URL tests
assert *which endpoint was asked for* against a fake that returns a fixture.

**Endpoints.** `curs.bnr.ro` only — `nbrfxrates.xml`, `nbrfxrates10days.xml`,
`files/xml/years/nbrfxrates<YEAR>.xml`, XSD at `curs.bnr.ro/xsd/nbrfxrates.xsd`. `www.bnr.ro/nbrfxrates.xml`
is **dead since 6 August 2026** (BNR notice of 04.08.2026: „exclusiv prin subdomeniul curs.bnr.ro"), so it is
not a slower mirror and not a fallback — a client pointing there is broken. Asserted in `bnrXml.test.ts`.

**„XSD-validated", stated honestly.** There is no XSD processor in the dependency set (runtime deps: react,
react-router-dom, recharts, zod, decimal.js-light), and adding one to a browser bundle to validate a ~200-line
document is the wrong trade. What is implemented is a **structural validator enforcing the elements and
attributes the XSD requires of the documents BNR actually serves**: `Cursor` root, `Cube` with a `date`,
`Rate` with a `currency` and a decimal body. It reports **every** drift at once, because BNR warns the page
may change without notice („pagina se poate modifica fără avizare prealabilă"), so the failure mode to design
for is a silently changed document. It is **not** a full XSD conformance proof and is not described as one on
screen. The validator is the seam if strict conformance is ever needed.

One thing deliberately not handled: some historical BNR series quoted 100 units of a currency. No multiplier
is applied, because none was verified from a primary source, and inventing one is how a rate ends up wrong by
two orders of magnitude. EUR and USD are quoted per 1 unit in the current XML.

---

## 5. The basis rules, with their citations

`src/domain/fx/convert.ts`. The anchor is a **discriminated union**, so the basis cannot be omitted and
cannot be paired with the wrong anchor:

```ts
export type ConversionAnchor =
  | { basis: 'payment_date_daily'; onDate: string }
  | { basis: 'payment_year_annual_average'; paymentYear: number }
  | { basis: 'income_realisation_year_annual_average'; incomeRealisationYear: number };
```

| Basis | Rate | Citation (as recorded in `BASIS_CITATIONS`) |
|---|---|---|
| `payment_date_daily` | BNR **daily reference rate on the date the sum is received / paid** | CF art. 9 alin. (3) lit. b) + alin. (4); art. 68 alin. (2) lit. a) („sumele încasate") |
| `payment_year_annual_average` | BNR **average for the year of payment** | HG 1/2016, Titlul IV, Cap. II, pct. 7 alin. (6): „cursul mediu comunicat de Banca Națională a României pentru anul în care s-a efectuat plata" |
| `income_realisation_year_annual_average` | BNR average for the **year of income realisation** | „anului de realizare a venitului" — ANAF Cluj 22.04.2026; instrucțiuni OPANAF 2.736/2025 (the 25.000 EUR sistem-real threshold) |

**A call site that omits the basis does not compile**, pinned by four `@ts-expect-error` cases in
`convert.test.ts`: no anchor at all; an anchor with no discriminant; a year paired with the daily basis; a
payment year paired with the income-realisation basis.

**The last two anchor to different years, and that is the point.** Tested: a 2026 payment of 2025 income
converts at the 2026 average under `payment_year_annual_average` and at the 2025 average under
`income_realisation_year_annual_average`, and the two results differ. One function taking „a year" would be
right for one rule and silently wrong for the other.

**There is deliberately no default basis.** Choosing one *would be* resolving the hierarchy conflict below.
A runtime `default:` in the switch throws `RangeError('unknown conversion basis …')` for a value arriving
from untyped JSON, rather than returning `undefined` and letting a conversion silently produce nothing.

**A missing rate is a refusal.** `no_rate` naming the currency, the anchor and why — and the annual-average
refusal says the average is not computable from daily rates. Nothing averages, interpolates, or reaches for a
nearby year. Asserted against an empty `RateStore` for all three bases.

**Never compute an annual average.** BNR's printed methodology is the average of the 12 monthly averages,
each itself an average of daily rates; a mean of daily rates is a **different number**. There is no averaging
function anywhere in `src/domain/fx/`. **No FY2026 annual average exists** — `manualAnnualAverage` derives
`provisional` from the year rather than trusting the entrant to remember, and `convertToRon` carries the flag
out so a 2026 figure cannot read as final.

**Rounding — a labelled app decision.** `ROUNDING_CHOICE`: the product of an amount and a rate rounds to the
**nearest ban, half-up**, because the money unit is the ban. `roundArt66` (CF art. 66 alin. (1), whole leu)
is **not** applied to that intermediate product: whether art. 66 reaches a conversion product is not
established by any text read for this task, and applying it there would move every converted amount by up to
0,50 lei on an unverified reading — and would turn a 5-bani conversion into 0 lei. art. 66 stays exactly where
it was, on the tax due. Tested both directions. This is deliberately a **different note** from Phase 10's
`notes.roundingDirection` (which describes the lei→bani *storage* conversion, half-down); the two are
distinguished on screen in `notes.fxRoundingAtConversion` so they cannot be read as contradicting.

---

## 6. The hierarchy conflict — unresolved, both readings on record

`CONVERSION_HIERARCHY_CONFLICT` (`src/domain/fx/convert.ts`), `status: 'unresolved'`:

- **`annual-average-payment-year`** — HG 1/2016, Titlul IV, Cap. II, pct. 7 alin. (6). In force in the
  official text; restated with that citation by ANAF Brașov and ANAF București in their PFA brochures.
- **`daily-rate-on-receipt`** — CF art. 9 alin. (3) lit. b) + alin. (4). alin. (4) admits only methods
  „prevăzute expres în **prezentul cod**", which on a strict reading does not admit a rule sitting in a 2016
  methodology norm.

No primary text reconciles them. The app applies the basis the caller names, shows both readings
(`notes.fxConversionConflict`, rendered even when no rate is recorded), and **does not choose**. The applied
reading is always visible on the result (`result.basis`, `result.rate`).

## 7. The carry-forward — app policy by analogy, named as such

`src/domain/fx/carryForward.ts`. BNR publishes on banking days only („imediat după ora 13:00, în fiecare zi
bancară"); the daily series page showed `08.10, 07.10, 06.10, 05.10, 02.10` for October 2026 with **no rows
for 3–4 October**. A Saturday payment has no rate keyed to it.

There **is** a carry-forward rule in the Codul fiscal — and it is quoted because it is the model:
„În cazul în care la data de referință nu există curs de schimb publicat de Banca Națională a României, se
utilizează cursul de schimb publicat în prima zi bancară anterioară datei de referință." It appears at
**art. 68^3 alin. (4)** and, in the same words, **art. 85 alin. (4)** — **exactly twice in the whole code,
both inside the CASS articles**. It does **not** appear in Titlul IV or in art. 9 alin. (3) lit. b) / alin.
(4), and alin. (4) narrows rather than closes the gap: only methods „prevăzute expres în prezentul cod".

So the substitution is **an app policy adopted by analogy, not a statutory rule the app can cite**. It is
applied (refusing to convert a Saturday payment is worse than converting at a clearly-labelled rate); the
record carries `carriedFrom` with the date actually used; `convertToRon` returns `carriedForward: true`; and
the UI renders it through `InterpretationNote` with the analogy named and the two articles cited as the
source of the *reasoning*, never as the rule. Tests use the real October 2026 banking pattern, and assert
`substituted === false` for an exact-date row — a conversion that needed no substitution must not be flagged,
or the flag stops meaning anything. `stampCarriedFrom` does not mutate the stored record: the same row may
answer a Tuesday exactly and a Saturday by substitution.

---

## 8. The surface

`src/components/ui/FxRateProvenance.tsx`, on the Settings **fiscal** tab as a read-only card. Provenance is
rendered on the face of the card, not behind a disclosure. `rateKind` / `entryMode` render through copy
labels — the exact defect TASK 7's guard was written for. The test asserts this **on the cells**, not by
substring, because the Romanian label for a manual entry is „introdus manual" and legitimately contains the
word.

Copy: `src/ui/copy/fx.ts` (labels, columns, badges, the carried-from sentence) and five new notes in
`copy/notes.ts` (`fxCarryForward`, `fxConversionConflict`, `fxProvisionalAnnual`, `fxAnnualNotComputable`,
`fxRoundingAtConversion`). `copy.guard.test.ts` stays green with an **empty allow-list**.

**What is deliberately *not* in the copy layer:** `BASIS_LABELS`, `BASIS_CITATIONS` and
`CONVERSION_HIERARCHY_CONFLICT` stay in `src/domain/fx/convert.ts`. They are the names of the rules, and
`src/domain/**` must not import from `src/ui/copy/**` — a domain module that needed the UI layer to say which
statute it applied would not be testable on its own.

**Not built here, on purpose:** the rate entry form and the provisional → final lifecycle are TASK 10b's.
10a establishes that a rate is never shown as a bare number, and that the schema can express provisional.

---

## 9. What TASK 10b may build on — and must not re-derive

Available, tested, and not to be reinvented:

- `Money<C>` + `requireRon` + `addMoney`'s compile-time mixing rule. **Do not** reintroduce a currency field
  bolted onto a `Bani`.
- `FxRateRecord` + `validateRateRecord` + `fxRates` on `AppData`/`PersistedAppData`. The provisional → final
  path is `RateStore.replace` keyed by `rateKey` (currency, kind, date-or-year).
- `FxRateProvider` — the boundary. A cap calculator must take a provider, never call `fetchBnrXml`.
- `convertToRon(amount, anchor, provider)` returning `{ ron, rate, basis, carriedForward, provisional }`.
  **The three bases and their citations are settled inputs; do not re-derive them.**
- `CONVERSION_HIERARCHY_CONFLICT` — render it; do not resolve it. 10b computes the seven euro caps at
  `payment_year_annual_average` and must keep both readings visible.
- `carryForward` + `notes.fxCarryForward` — reuse; do not restate the analogy.
- `ExcludedReason: 'foreign_currency'` already excludes non-RON records with a named missing datum. 10b's job
  is to make those records convertible, not to delete the exclusion.
- `SERIES_CODE_STATUS` / the `-PATTERN` suffix: if 10b captures a real USD annual-average code, replace the
  pattern label with the captured one and move it to `verified`.

10b must **not**: compute an annual average; invent a FY2026 average; pick a side of the hierarchy conflict;
apply art. 66 whole-leu rounding to a conversion product without labelling the choice; re-hash any stored
snapshot.

---

## 10. Validation, and every re-pin

`tsc` 0 · **`72 files / 1271 tests`** (+122: 12 currency, 14 rates, 11 carry-forward, 13 XML, 21 provider,
23 convert, 19 migration, 9 component) · `build` 0 · **`e2e` 37 passed**, same figures throughout:
deductible 120,00 / 144,00 lei, VNA 9.096,00, impozit 819,00, total 3.249,00, reserve 1.083,00, year-end
3.112,00, hero 51.510 lei.

**Assertion adaptations, all of one kind.** `expect(x.valoareFaraTva).toBe(lei(N))` →
`expect(x.valoareFaraTva).toEqual(ron(N))`, on a field whose value type changed: `toBe` is identity and a
value type must be compared structurally. **Every N is unchanged**, and `toEqual` now also asserts the
currency — a strengthening, not a loosening. No assertion was deleted, no matcher loosened, no timeout
widened. Fixture helpers in `aggregation.test.ts`, `projection.test.ts` and `estimateBasis.test.ts` still
take `Bani` and wrap once internally, so their call sites and pinned figures did not move at all.

**Version re-pin, old → new:** `e2e/settings.spec.ts:426` `saved.version` **9 → 10**, because the chain gained
the `record-currency` step. The same precedent is already written in that test (8 → 9 for TASK 6). What that
test exists for is untouched: one notice, `original` the verbatim `674.504`, `converted` still `67450` bani.
`stepsApplied` arrays in `store.migration.chain.test.tsx` and `store.taxReserve.test.tsx` gained
`'record-currency'`; the `[from, to]` chain list gained `[9, 10]`; `CURRENT_DATA_VERSION` now pins to
`DATA_VERSION_RECORD_CURRENCY`.

**Defects.** B-32 **closed** by this task. B-33 **partially closed**: the schema can now express
provisional → final and a current-year average is provisional by construction; the lifecycle that *consumes*
it belongs to TASK 10b.
