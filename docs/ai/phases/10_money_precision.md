# Phase 10 — money representation and rounding policy

**STATUS: PARTIAL — T1 WAS NOT EXECUTED.**

What shipped: the rounding policy (CF art. 66 alin. (1)) and the single display conversion, in
`src/domain/money.ts`, plus the B-17 formatter collapse, `totalDue`, and the view-layer money arithmetic.

What did **not** ship: **T1 — making money an integer number of bani in storage and in the domain.** Money is
still persisted and computed as **float lei**. The conversion is fully designed and specified in **§2 below,
which is written to be executed by a Worker who has never seen the conversation that produced it.** It is
tracked in the defect register as **B-25** (`docs/ai/STATE.md`). Do not read this phase as finished.

Why the split: the trade-off was requested by the Worker and accepted by the orchestrator explicitly. Option
(c) — persist in bani but keep the domain in lei behind a conversion boundary — was rejected outright, because
a permanent lei↔bani boundary is exactly the drift mechanism this phase exists to remove. Option (a) — convert
everything in one pass — was rejected because a red or half-converted tree at the end of the largest phase in
the plan is worse than a green tree with one task deferred and specified.

---

## 1. The invariant that makes T1 safe — keep it

Two operations, deliberately separate, and **only one of them rounds**:

| | | |
|---|---|---|
| **`roundArt66(Decimal \| number) → Bani`** | the **only** place money rounds | takes the **UNROUNDED** `Decimal` sum |
| **`formatBani(Bani) → string`** | the **only** place bani becomes a displayed number | performs **NO rounding at all** |

**Rounding happens in one named place; display never rounds.** This is the load-bearing property. Because
`formatBani` is built from integer arithmetic (`Math.floor(m/100)`, `m % 100`, `.`/`,` grouping), there is no
formatter rounding policy left anywhere in the app — so when T1 makes the numbers integers, nothing about
rendering can drift again. The B-17 defect was possible precisely because rendering *did* round, in five
different ways.

**Order matters, and it is a correctness bug if you get it wrong.** `roundArt66` must receive the unrounded
sum. The seeded income tax is `674,505` lei = `67 450,5` bani: the fracţiune is **50,5 bani**, which exceeds
50, so the law majors it → **675 lei**. If you first truncate to `67 450` bani and *then* apply art. 66, the
fracţiune is exactly 50 and you get **674 lei** — a different tax. Pinned by test in `src/domain/money.test.ts`.

`roundArt66` also **rejects a plain float** (`TypeError`) rather than rounding it, and `formatBani`, `sumBani`
and `applyRateDecimal` do the same. That rejection is the enforcement mechanism: when T1 lands, every place
that still holds a float-lei number will fail loudly instead of quietly displaying a rounded value.

### The law, verbatim, with the extension marked

> „Sumele sunt calculate prin rotunjire **la un leu**, prin neglijarea fracțiunilor de până la 50 de bani
**inclusiv** și majorarea la leu a fracțiunilor ce depășesc 50 de bani."
> — Codul fiscal (Legea nr. 227/2015), Titlul IV, Capitolul I, consolidated text, Portal Legislativ doc
**312601**. **CONFIRMED** — verbatim from primary consolidated text. Amendment note as printed in that
consolidation: art. 66 din Capitolul I, Titlul IV a fost modificat de Punctul 29, Articolul I din LEGEA nr. 296
din 18 decembrie 2020, MO nr. 1269 din 21 decembrie 2020.

* It rounds to a **LEU**, not to a ban. `Intl.NumberFormat` and `toFixed(2)` are both wrong here — both round
  to bani.
* The tie is **half-DOWN** („inclusiv"). `Math.round` is wrong at that boundary.
* It is **per-sum**, and sits in Titlul IV Capitolul I, so it governs the *stabilirea* of the sums.

**EXTENSION — not settled law.** Art. 66 is a Titlul IV (income tax) rule. **No rounding provision was found
for CAS/CASS**: a case-insensitive search of the consolidated Codul fiscal returned **0 hits** for `rotunj` in
Titlul V, and 0 hits for `zecimale` / `sute de bani` / `prin lipsire`. Applying art. 66 to the CAS and CASS
lines is **an extension we chose**. Its extension to the amount *entered on DU 212* is likewise an inference:
the ANAF instructions for the 2026 model (Ordinul ANAF nr. 2.736/2025, doc 305848) contain **no rounding
sentence at all** (`rotunj` → 0, `zecimale` → 0); the only format language is „se înscrie suma (**în lei**)".
Source: `docs/ai/research/20_cf_art66_rounding_and_art154_cass_exemption_2026.md`.

**Where rounding does NOT apply:** bases, thresholds, rule parameters, transaction amounts, ratios, projections.
Rounding a *base* changes the base and therefore the tax; art. 66 rounds calculated sums. A projection is not a
sum due. This boundary is an inference about where the line falls and is marked as such in the code.

---

## 2. T1 — INTEGER BANI. **SPEC, NOT EXECUTED.** (register: **B-25**)

Target: money that is **persisted, aggregated and displayed** is an integer number of **bani** (`Bani` from
`src/domain/money.ts`). Money mid-calculation (a rate applied to a base) is a `decimal.js-light` value,
converted back to `Bani` at exactly one place, through `roundArt66`.

### 2.1 File-by-file change list

Every site below was enumerated by read-only reconnaissance on HEAD `f6d7cd8`; line numbers are from that
commit and will have moved. **`tsc --noEmit` is the checklist** — the `Bani` brand makes every missed site a
compile error, which is why the brand exists.

**Root types — the fields that change type** (`src/data/types.ts`)
`Revenue.valoareFaraTva`, `Revenue.tva` · `Expense.valoareFaraTva`, `Expense.tva` ·
`Declaration.venituri`, `Declaration.cheltuieli` · `AppData.settings.cotaTva` is a **percent, NOT money — do not
change it** · `CompanyDocument.marime` is **bytes, not money**. Also in this file: `fmtRON` (`:186-188`) and
`total = (r) => r.valoareFaraTva + r.tva` (`:196`) — `total()` must become `sumBani([r.valoareFaraTva, r.tva])`,
and `fmtRON` must be deleted in favour of `formatBaniRON`.

**Persistence** — `src/data/schema.ts`: `nonNegative` (`:36,48,49,65,66`) for revenue/expense amounts,
`:84,85` declarations, `:145,146` `inputSnapshot.revenues/expenses`, `:155` `calculationLines[].value`,
`:164` `output.total`; `src/domain/schema.ts`: `:82` `profile.cashFloorLei` (required), `:71`
`profile.salaryIncomeLei` (optional). **See §2.4 — do NOT add `.int()` to the load gate.**
The `Equal<z.output<…>, Revenue|Expense|…>` assertions at `schema.ts:411-424` force the zod output and the TS
types to stay identical, so both must change together.

**Seed** — `src/data/seed.ts:38-46,51-55,96-100`. Fractional values that must become exact bani:
`tva: 25.2 → 2520`, `valoareFaraTva: 85.5 → 8550`, `tva: 17.96 → 1796`, `tva: 71.4 → 7140`. Write them with
`lei(…)` where the lei value is a whole number of bani.

**Rule store** — `src/domain/fiscal/package2026.ts`, every `unit:'lei'` entry: `:32` reference 4050 · `:58`
monthly 4050 · `:73` monthly 4325 · `:89` min_base 48600 · `:90` tier2_base 97200 · `:91` tier1_cas 12150 ·
`:92` tier2_cas 24300 · `:124` min_base 24300 · `:125` max_annual_base 291600 · `:224` threshold 395000.
**NOT money — leave as integers:** `:88` rate 25, `:123` rate 10, `:174` base_rate 10 (integer PERCENT).
`tier1_cas`/`tier2_cas` (declared) and `floorCass`/`ceilingCass` (derived at `calculators.ts:192-193`) are the
**same figures** — the "one figure, one source" rule at `package2026.ts:126-135` means they must convert
together or a threshold and its contribution will disagree.

**Calculators** — `src/domain/fiscal/calculators.ts`: `:28` `CalculatorInput.base` (VNA; selects the CAS floor
and *is* the CASS base) · `:66` `salaryIncomeLei` · `:76` `chosenBase` · `:7-9` `CalculatorResult.value` ·
`:19` `nonDeductible` · `:95-104` `calcWageReference` · `:324` `calcVatThreshold`. The float generator is
`paramNumber(…)/100` (`:113,188,301`) followed by `* rate` (`:147,192,193,212,241,264,285,306`). Replace with
`applyRateDecimal(baseBani, ratePercent)` and round **once**, at the line boundary, with `roundArt66`.
`paramNumber` is the single funnel — make it unit-aware there rather than at each call site. Comparisons at
`:131,143,196,207,236,283,306` are integer-safe once the operands are bani.

**Engine** — `src/domain/tax.ts`: `:18-23` `revenues/expenses/revenuesNet/expensesNet` · `:31`
`FiscalLossCarryForward.amount` · `:48,50,57` `TaxAmountBases.venitulBrut/cheltuieliDeductibile/venitulNetDinActivitate`
· locals `net`, `gross`, `deductibleBase`, `:247` `casDeductibila`, `:248` `cassDeductibila`, `:255`
`deduceriCalculat`, `:256` `plafonDeduceri`, `:257` `deduceriRetinute`, `:262` `taxable`, `:279` `total`.
Arithmetic at `:237,243-244,247,248,255,256,257,260,262,271,279`. **The three lines that art. 66 rounds are the
income tax, CAS and CASS amounts owed** — everything else stays exact. `:96-99` `Number.isFinite` guards stay.

**Aggregation** — `src/domain/aggregation.ts`: `:29-36` `YtdTotals.revenue/expenses/net/revenueNet/expenseNet` ·
`:40-43` `MonthlyTotals` · `:59-60` `Threshold.current/limit` · `:90` `recordTotal` · **the `+=` accumulation at
`:224,225,231,232`** and `:249` `entry[field] += amount` — these become `sumBani(...)` or an integer accumulator.
`:236,250` are `revenue − expenses`, integer-safe. **NOT money:** `:62` `ratio`, `:86` `coverageMonths`.

**Already-integer trap:** `aggregation.ts:82-87` `taxReserve.*Cents` are **already integer cents**. Do not
double-convert. Delete the lei→cents bridge at `src/data/dashboard.ts:299-302` (`* 100`) and the divide-back at
`src/domain/insights.ts:43-44` (`cents / 100`) — that bridge is the drift mechanism, not a feature.

**Everything else that carries money:** `src/domain/thresholds.ts` `:53-57` input map, `:64-66`
`currentValue/thresholdValue/distance`, `:75` `warningDistance`, `:359-360` `current/limit`, arithmetic
`:209-210` (**NOT** `:364` `ratio`) · `src/domain/taxReserve.ts` `:32,58,60` `reservedAmount`,
`estimatedTaxLiability`, `remainingTarget`, `recommendedMonthlyReserve`, arithmetic `:75,86,133` ·
`src/domain/projection.ts` `:27-35`, and the float division/multiplication at `:67`
(`runRate.revenuePerMonth = ytd.revenue / denom`) and `:73` (`annualProjected.revenue = … * 12`) ·
`src/domain/derived.ts` `:29,52-53,106,111` · `src/data/dashboard.ts` (the snapshot/summary assembly) ·
`src/domain/insights.ts` · `src/domain/models.ts` `:173` `salaryIncomeLei?`, `:199` `cashFloorLei` ·
`src/domain/snapshots/types.ts` `:23-25` `CalculationInput.revenues/expenses`, `:30` `CalculationLine.value`,
`:42` `CalculationOutput.total`.

**Display call sites** — `fmtRON` has 22 call sites: `FinancialSummary.tsx:25,26,29`;
`FinancialChart.tsx:91,237,264,267,270`; `TaxReserve.tsx:25,29,30,44,50`; `Revenues.tsx:219,220,221`;
`Declarations.tsx:170,171,172`; `Dashboard.tsx:80,83,86,87,104,107`; `Expenses.tsx:208,209,210,226`;
`EFactura.tsx:79`. `formatLei` (`lib/format.ts`) at `dashboard/ThresholdSection.tsx:96,99,102`. Private
`formatLei` in `insights.ts:38` used at `:247,:280`. All of these take `Bani` after T1.

**Explicitly NOT money — do not touch:** `deadlines.ts:110` `Math.round` (a day count) · `dashboard.ts:59`
`Math.round` (a day count) · `data/types.ts:264-265` `toFixed(1)` (file sizes in MB/KB) · `insights.ts:125`
`Math.round(t.ratio * 100)` (a **percentage** — it must not be routed through the money rounder, and must not be
mislabelled as money) · `tax.ts:32` `years: 5`, `:33` `capPercent: 70`, `:295` `offset_days: 0` ·
`projection.test.ts:119` `8.5` (months).

### 2.2 The v4→v5 migration step

`CURRENT_DATA_VERSION` is **4** (`src/data/migration.ts:52`, `= DATA_VERSION_VAT_DATE`). Existing constants:
`DATA_VERSION_BASE=0` `:33`, `PROFILE=1` `:35`, `IDENTITY=2` `:37`, `DATES=3` `:43`, `VAT_DATE=4` `:50`.
Chain at `:305-337`; runner `migratePersistedData` at `:348-377`. Storage key never changes:
`STORAGE_KEY = 'pfa-app-data-v2'` (`store.tsx:31`).

**Add:** `const DATA_VERSION_MONEY_BANI = 5`, set `CURRENT_DATA_VERSION = DATA_VERSION_MONEY_BANI`, and
**append one step at the end of `MIGRATION_CHAIN`** with `from: 4`, `to: 5`, and a unique never-reused name
(`money-bani`). The runner throws unless `readVersion(data) === step.to` after `apply` (`:362-365`), so the step
**must** return `version: 5`. Never reorder the chain, never reuse a name.

**What it converts:** `revenues[].valoareFaraTva|tva`, `expenses[].valoareFaraTva|tva`,
`declarations[].venituri|cheltuieli`, `profile.cashFloorLei`, `profile.salaryIncomeLei`, and inside every
snapshot `inputSnapshot.revenues|expenses`, `calculationLines[].value`, `output.total`, plus the embedded
`profile.*`.

**How:** through **`baniFromLei`** in `src/domain/money.ts` — never `Math.round(x * 100)`. `Decimal(value)` is
built from the number's shortest decimal representation, so `× 100` is exact for any value with at most two
decimals; `71.4 * 100` is `7140.000000000001` in float but `baniFromLei(71.4)` is exactly `7140` with
`exact: true`.

**It must NOT use `roundArt66`.** Art. 66 rounds to a whole leu; applying it to a *stored* value would turn a
stored revenue of `85.5` lei into `86` lei — a silent change to the user's money. Unit conversion and policy
rounding are different operations; only one of them is allowed to change a number's value.

**A value that cannot convert cleanly — the rule.** A stored value with **sub-ban precision** (e.g. a snapshot
`calculationLines[].value` of `674.504` lei, or `674.505` → `67 450,5` bani) is taken to the **nearest ban with
half-DOWN ties** (`ROUND_HALF_DOWN`, matching art. 66's „inclusiv" direction), and `baniFromLei` returns
`exact: false`. The step **must record every such value** — record identity, field, original value, converted
value — and surface it to the user as a `review_required` report, exactly like the CASS-exemption surfacing.
Rationale: the conversion is unavoidable (an integer number of bani cannot hold a third decimal), so it is
permitted — but it is a decision about the user's money, and the brief's rule is that such a value must
**surface, not vanish**. Half-DOWN is stated rather than incidental, so the same input always converts the same
way and migration and domain never disagree.

**A non-finite value** (`NaN`, `±Infinity`) converts to `bani: null`. It must be **carried forward visibly** —
surfaced as `review_required` — and **never replaced by `0`**. Replacing it with 0 would be the fabricated zero
the previous phase's invariants forbid.

**Never write `null` into an optional money field — omit the key.** No persisted field anywhere is
`.nullable()`; `.optional()` accepts a missing key but **rejects `null`** with `invalid_type`, which fails
`persistedAppDataSchema.safeParse` and quarantines the whole payload. This is also what preserves the explicit
`null`/`undefined` distinction on fiscal inputs that keeps "no value" from becoming `0 lei`. `cashFloorLei` is
required and must always be present as a number.

**Why the step must not throw.** `MigrationStep.apply` is synchronous with **no Result channel** — the only
failure mode is `throw`. A throwing step produces `rejected(raw, 'schema-invalid', 'migration failed: <msg>')`
(`store.tsx:169-177`), which copies the raw string to `pfa-app-data-v2:quarantine` and then returns
`{ data: seedData, dataOrigin: 'quarantined' }` — and the **save effect then overwrites the main key with seed
data** (`store.tsx:186-197`). The original bytes survive only in the sibling quarantine key, and if *that* write
fails under quota the data is genuinely lost (`quarantine.ts:96-100`, `store.tsx:141-147`). So throwing on an
unconvertible value would be the "vanish" the brief forbids. Convert what you can, report the rest.

**Gap to close in the same commit:** nothing currently pins the "step threw → quarantine with reason
`schema-invalid`, detail `migration failed:`" path (`store.load.test.tsx:196-273` covers seed/persisted/
quarantined but not this). Add that test — `money-bani` is the first step plausibly capable of hitting it.

### 2.3 The snapshot / hash hazard — the part most likely to be missed

Money values feed the **input hash**, so changing their numeric type changes the hash of every snapshot.

How it works: `canonicalize` (`src/domain/snapshots/serialize.ts:9-30`) is the only serialiser feeding both
digests. Numbers are emitted as `Number.isFinite(value) ? String(value) : 'null'` (`:14-17`) — so `1000.5` →
`"1000.5"`, and float noise is **digest-visible** (`0.1 + 0.2` → `"0.30000000000000004"`). `JSON.stringify`
never serialises a number in the hashed payload. Key order is `Object.keys(value).sort()`. Both entry points
hash identical bytes: `hash.ts:10` (async, at snapshot creation) and `hashSync.ts:110` (used by the migration).

**The hashed payload is `{ profile, revenues, expenses }` only** (`snapshots/types.ts:20-27`). `calculationLines`
and `output` are **not** hashed. Money enters via `revenues`/`expenses` (assembled `snapshot.ts:33-34`, hashed
`:40`; production source `tax.ts:282,299`) and via embedded `profile.cashFloorLei` / `salaryIncomeLei`.

**What actually happens to already-stored snapshots.** Digests are persisted (`schema.ts:148 inputsHash`,
`:151 preMigrationInputsHash`) and written by `store.tsx:192`, **but no real digest exists today**:
`addSnapshot` has **no production caller** (declared `store.tsx:95`, implemented `:316`, called only from
`store.snapshots.test.tsx:98,101`) and `seed.ts:86` ships `snapshots: []`. **The load path never re-hashes** —
proved by `store.migration.chain.test.tsx:419-420` and by a bogus `'abc123'` surviving load at
`store.load.test.tsx:99`. So the hazard is **latent, not live** — and it must still be handled, because the
schema and the existing pattern make it the contract, and the first caller of `addSnapshot` turns it into a live
data-loss-of-provenance bug.

**Therefore the `money-bani` step must, for every stored snapshot:**
1. convert `inputSnapshot.revenues/expenses` to bani;
2. re-derive `inputsHash = computeInputsHashSync(nextInputSnapshot)`;
3. preserve the old digest: `preMigrationInputsHash = snapshot.preMigrationInputsHash ?? snapshot.inputsHash`.
Follow the existing pattern in `backfillSnapshotIdentity` (`migration.ts:242-270`, re-derivation at `:252-261`),
including its guard at `:249` that leaves the digest untouched when nothing changed.

**Do NOT add a `unit`/`currency` field to the hashed payload.** `canonicalize` emits every own key, so a marker
field would change digest bytes for no benefit. The unit lives in the *type*, not the payload. Keep the key
names `revenues`/`expenses` so the step converts values, not keys.

**Do NOT tighten the load gate to `.int()`.** Parse happens **before** migration, so `.int()` on
`persistedAppDataSchema` money fields would reject every pre-migration float payload and quarantine the user's
data. The load gate stays permissive (`z.number()`); integer-ness is enforced **after** migration, in the domain,
and asserted by test.

**Convert to whole bani before `buildInputSnapshot`** so digests are stable and carry no float noise.

**Leave `derived.ts:132-142` `canonicalKey` / `inputsKey` alone** — it is a separate runtime key that *does* use
`JSON.stringify` for primitives. Do not unify it with `inputsHash`.

**Test that must be deliberately re-scoped, in the same commit, with the reason written down:**
`src/data/store.migration.chain.test.tsx:265-292` asserts the fiscal inputs inside a snapshot stay
**byte-identical** across migration. That test forbids exactly what T1 does, by design. Re-express it as
*value-preserving* (`bani = lei × 100`) rather than *digit-identical*, keep `preMigrationInputsHash` pointing at
the pre-change digest, and say why. Also `:345-359` pins fiscal keys inside a snapshot byte-identical — same
treatment. And `:163-172` pins the exact `[from,to]` list and `CURRENT_DATA_VERSION === DATA_VERSION_VAT_DATE`;
`:184-199,203-212,214-223,381-396` pin `stepsApplied` to an exact array of the four step names. All five must be
updated to include `money-bani` / version 5.
