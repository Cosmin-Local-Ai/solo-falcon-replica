# Phase 10 — money representation and rounding policy

**STATUS: DONE (2026-10-08) — T1 EXECUTED. Money is integer `Bani` end to end.**

The earlier status on this file was **PARTIAL**: the rounding policy and the single display conversion had
shipped, but T1 — making money an integer number of bani in storage and in the domain — had been deliberately
deferred, with §2 below written as a spec for a worker who had never seen the conversation that produced it.
**That spec has now been executed, and §2 is kept as-written because the gap between what it predicted and what
actually happened is the useful part.** The delta is §3. Register: **B-25 closed**, **B-17 closed**, **B-26 opened and then closed** (§6).

**Measured at the end of the phase (clean tree): `tsc` 0; 48 files / 760 unit tests; build 0; 36 e2e.**

**Corrected 2026-10-08 (brief 13): that sentence describes the runs somebody took, not the suite.** The suite was
intermittently red the whole time. At `d0b0ad7` the Orchestrator measured **1 failed / 759 passed in 1 of 4** full-suite
runs; the same failure reproduces on demand under CPU pressure (§7). "Four checks green" is therefore not a property of
this tree and must not be quoted as one. §7 records the defect, the measured cause and what closed it.

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

## 2. T1 — INTEGER BANI. (register: **B-25**) — *the spec as written before execution; where it and §3
disagree, §3 is what shipped.*

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

### 2.4 The test-literal plan (~200 literals, 20 files, plus e2e)

**Method: a script, not hand edits.** A scripted rewrite produces a reviewable diff; 200 hand edits is where a
real assertion silently becomes "whatever the new output happens to be". After the rewrite, **read the diff of
every test file** and confirm each changed number is a unit conversion, not a re-pointed expectation.

**Read the legend correctly.** The reconnaissance MOVE column is about **value** change, not unit
re-expression. A whole-lei amount marked "no change" still gets ×100 when it is a persisted or domain amount.
Three axes: **(R)** the value changes because of art. 66 · **(I)** the literal is re-expressed as integer bani ·
**(F)** the string is formatter-sensitive.

**Mitigation that keeps the suite readable and the negative controls visible:** introduce a test helper
`lei(n) → Bani` (re-export from `src/domain/money.ts`) and write expectations as `lei(2430)` rather than
`243000`. Then a unit change does not destroy readability, and an unintended *value* change still stands out.

**Assertions whose VALUE legitimately changes — only these, and each must be justified in the commit message by
art. 66:**
`tax.test.ts:206, 415-420, 512-517` · `taxReserve.test.ts:52, 82-85` · `dashboard.test.ts:329, 330` ·
`insights.test.ts:528` · `e2e/dashboard.spec.ts:78, 84, 88, 132, 155, 157`.
The seeded chain moves as: income tax `674,505 → 675` lei, CASS `2 430` unchanged, total `3 104,505 → 3 105` lei,
monthly reserve `1 034,835 → 1 035` lei. So `3.104,51 RON → 3.105,00 RON` and `1.034,84 RON → 1.035,00 RON`.

**Negative controls — these must NOT change value. If one moves, something is broken:**
`24_615`, `2430`, `12_150`, `24_300`, `29_160`, `2_430`, `4_230`, `3_800`, `46.570`, `20.435`, `4860/4861`,
`-29160/-29161`, `-39500/-39501`, `60000→12150 / 97199→12150 / 97200→24300`, `Dashboard.test.tsx:106,152`,
`fiscal.test.ts:414,426`, `e2e/settings.spec.ts:222,233`.

**Bases must never be rounded** (they become integer bani, value-preserving): `6745.05` taxable base → `674505`,
`7494.5` VNA → `749450`, `205.5` deductible expenses → `20550`, and every `thresholds.test.ts` parameter.
`6745.05` must **not** become `6745`. This is the easiest place to over-round.

**Highest-risk rewrite: the threshold band edges.** `thresholds.test.ts:193,201,210,217,226,233` and the tier
ladder at `:385-387` test a ±1 **lei** boundary. Under bani the edge becomes ±100 bani (`lei(4860)` vs
`lei(4861)`). Keep the adjacency explicit; an off-by-one here silently moves a statutory threshold.

**Hardest arithmetic: `projection.test.ts:120-122, 128-130, 148-152`** assert `/17` fractions (`180/17`,
`1962/17`, `2160/17`, `23544/17`). A per-month split of integer bani cannot be exact for every denominator.
Keep the projection in **decimal intermediates**, convert to integer bani only when a month is displayed or
summed, and pin by test that the months still sum to the total. **A projection is not a sum due — art. 66 does
not apply to it. Do not invent rounding there.**

**Fractional persisted round-trips that prove the migration:** `store.save.test.tsx:130` `tva: 142.5 → 14250`
(the only fractional value written and read back) · `snapshots/hashSync.test.ts:77` `revenues: 523456.78 →
52345678` (a hash input, so the digest changes — see §2.3).

**Money TEXT assertions — NO-MOVE. A diff here is a bug, not a refactor:**
`Settings.test.tsx:373 'Valoare invalidă (lei, ≥ 0).'` · `regimes.test.ts:77 not.toMatch(/\d+\s*lei/)` ·
`deadlines.test.ts:186` (title cites `395.000 lei`, no numeric assert) · `thresholds.test.ts:409
not.toMatch(/\d{3}/)` · **`fiscal/fiscal.test.ts:259 toContain('derivata din 291600 x 0.1')`** ·
`ThresholdSection.test.tsx:115` (comment).

**`null`/`undefined` invariants that must survive:** `Settings.test.tsx:332,359` `toBeUndefined()` ×2 and
`e2e/settings.spec.ts:170` `toBeUndefined()`. With money as integers, "no value" collapsing to `0` becomes
invisible — these are the assertions that keep it visible. Do not let a `?? 0` sneak in.

### 2.5 Named hazard — formatter mirrors inside tests

Two formatters are reimplemented **inside test files**. They pin rounding the application does not use, so a
future pass can "fix the app to match the test" and re-introduce the defect:

| file:line | mirror | effect |
|---|---|---|
| `e2e/dashboard.spec.ts:577-579` | `fmtRON = Intl.NumberFormat('ro-RO',{min/max 2}) + ' RON'` | drives **every `RON` cell in that file** — the e2e suite asserts a formatter that is not the app's |
| `src/domain/insights.test.ts:102-107` | `formatLei = Intl.NumberFormat('ro-RO',{min/max 2})` | keeps half-up rounding pinned (`1234.567 → '1.234,57'`) |

**Delete both and replace them with assertions on real app output** — rendered screen text and the actual CSV
bytes. A deleted assertion with nothing in its place is the weakening the hard rule forbids, even when the thing
deleted was itself a defect.

### 2.6 Acceptance for T1

1. `npx tsc --noEmit` → 0. 2. `npm run test` → all files pass, count ≥ baseline. 3. `npm run build` → 0.
4. `npm run test:e2e` → 34 passed. 5. A persisted `142.5` lei value loads as `14250` bani with no report.
6. A stored `674.504` converts to `67450` bani **and is reported**, not swallowed. 7. A stored snapshot's
`inputsHash` is re-derived and its previous digest preserved in `preMigrationInputsHash`. 8. No `Math.round`,
`toFixed` or `Intl.NumberFormat` on money survives anywhere in `src/` except inside `src/domain/money.ts`.
9. Every negative control in §2.4 is unchanged in value.


---

## 3. WHAT ACTUALLY SHIPPED, AND WHERE §2 WAS WRONG

Measured on the final tree, by the person reporting it: `npx tsc --noEmit` **0 errors**; `npm run test` **47 files /
745 tests, all passing on the runs measured** (see §7 — the suite was later proved intermittently red, so this records
an observation, not a guarantee); `npm run build` **exit 0**; `npm run test:e2e` **34 passed**. Baseline before the phase was
44 files / 685 tests and 34 e2e, so the suite grew by 60 tests and none was deleted or weakened.

### 3.1 The §2.8 acceptance list, item by item

| # | Criterion | Result |
|---|---|---|
| 1 | `tsc --noEmit` → 0 | **yes**, repo-wide including tests |
| 2 | `npm run test` all pass, count ≥ baseline | **count yes** (760 ≥ 685); **"all pass" no** — the suite is intermittently red, see §7 |
| 3 | `npm run build` → 0 | **yes** |
| 4 | `npm run test:e2e` → 34 passed | **yes**, 36 (the two extra are §6) |
| 5 | a persisted `142.5` lei loads as `14250` bani with no report | **yes**, pinned in `src/data/migration.money.test.ts` |
| 6 | a stored `674.504` converts to `67450` **and is reported** | **yes**, both halves — produced, survives the write that follows a load, and renders in the shell (§6) |
| 7 | a stored snapshot's `inputsHash` re-derived, previous digest preserved | **yes**, `preMigrationInputsHash` |
| 8 | no `Math.round` / `toFixed` / `Intl.NumberFormat` on money outside `domain/money.ts` | **yes** — the survivors are date arithmetic, byte sizes and one percent, all listed in §3.4 |
| 9 | every §2.4 negative control unchanged in value | **yes**, re-checked by grep and by the passing suite |

### 3.2 Where the spec was right, and it mattered

The brand did exactly what it was designed to do: `Bani + Bani` widens to `number`, so `tsc` found every accumulator
that had been doing `+=` on money. That single language fact is why the conversion is complete rather than mostly
complete. `decimal.js-light`, declared at `package.json:16` and never imported until this phase, now carries every
rate computation through `applyRateDecimal`.

### 3.3 Where the spec was wrong — four things worth recording

1. **`tsc` could not find the write boundary, and the display layer.** §2.1 claimed `§tsc --noEmit is the
   checklist`. It is not. `Bani` is assignable to `number`, so `parseFloat` feeding a money field, `String(rawBani)`
   pre-filled into an `<input>`, and a chart axis handed raw bani all type-checked while rendering wrong numbers.
   Three real bugs were found only by reading: the chart Y-axis printed `12 600` where the user had to read `126`;
   edit forms pre-filled the raw ban count; and the RJIP CSV exported `142,50` lei as `14250,00`.
2. **The cents bridge was not a no-op, it had become a double conversion.** `data/dashboard.ts` multiplied by 100 to
   feed fields named `*Cents`. Once the domain stored bani, a ban *was* a cent, so that bridge scaled every amount by
   10 000. The fields are now `*Bani` and the values pass straight through.
3. **Five formatters, not two.** §2 counted `fmtRON` and `formatLei`. There were also a private
   `Intl.NumberFormat` in `domain/insights.ts`, one in `FinancialChart`'s axis, one in `Documents.tsx`'s totals, and
   one **inside `e2e/dashboard.spec.ts`** mirroring the app so the test could never catch a formatter regression. All
   deleted; `formatBaniRON` / `formatBaniLei` / `formatBaniAxis` / `formatBani` are the only exits.
4. **Test fixtures are payloads, not values.** Wrapping money literals in `lei()` is right for a value handed to a
   domain function and **wrong** for a fixture written to `localStorage` or handed to `migratePersistedData`: the
   chain scales those once on load, so wrapping them converted them twice. This cost more time than the conversion
   itself. The rule is now stated in the migration test as a named helper, `legacyLei`.

### 3.4 The rounding/format calls that survive, and why each is fine

`data/dashboard.ts:60` and `domain/deadlines.ts:110` — `Math.round` on a **day count**. `data/types.ts:290-291` —
`toFixed(1)` on a **byte size**. `domain/insights.ts:119` — `Math.round` on a **percentage**. None is money.

### 3.5 New primitives §2 did not ask for, and the reason each exists

`addBani` / `subBani` / `maxBani` (the brand widens), `sumBani` order-independence, `divBani` (a cash-planning share
at the nearest ban — explicitly **not** art. 66), `allocateBani` (largest-remainder, so projected months sum
*exactly* to the projected subtotal instead of drifting a ban per month), `toBaniNearest` (the only sanctioned way a
fractional-bani intermediate becomes money), `leiInputValue` / `parseLeiInput` (the write boundary: a sub-ban input is
**refused**, never silently rounded), `formatBaniAxis`, `formatBaniRONOrDash`.

### 3.6 What is still open after this phase

- ~~**B-26**~~ — **closed in §6.** It was the one acceptance criterion this phase shipped half-met: the report was
  produced and persisted but `toAppData` dropped it, so the first write after a load erased it and no screen showed it.
- The persisted **key names** still read `salaryIncomeLei` / `cashFloorLei` while the values are bani. Deliberate:
  zod strips unknown keys, so renaming a persisted key would reject every pre-v5 payload and quarantine it. The
  hazard is documented on the field and in `e2e/settings.spec.ts`.
- Nothing pins the "a migration step threw → quarantine with `migration failed:`" path. No payload can currently
  make a step throw, so it is unreachable rather than untested-by-accident; it stays a gap, not a Phase 10 deliverable.

---

## 4. THE FOUR REGISTER ROWS THIS PHASE OWNS — and what actually closed

The brief named four rows. **Three of the four IDs do not point at the defects the brief describes.** I checked
each row in `docs/ai/STATE.md` before touching it rather than writing the closure the brief asked for, because
closing a row that is already closed for an unrelated reason silently rewrites that other defect's history.

| Brief's row | What the brief claims | What the register actually holds | What this phase did |
|---|---|---|---|
| **B-17** | two display paths disagree by a half-cent (674,51 vs 674,50) | **matches** — "no rounding policy anywhere in the fiscal domain; the cent a user sees is decided by IEEE-754", seeded tax 674,505 lei | **CLOSED.** Three causes, all removed: no rule in the domain (`roundArt66` is now the only rounding, with art. 66 quoted above it); two formatters that disagreed (`src/lib/format.ts` deleted, one named `bani → lei` conversion); and a **third** path the brief did not list — `toFixed` in the RJIP CSV export, which after T1 exported raw bani at 100× the truth. `src/domain/money.test.ts:174` pins the previously-disagreeing money to one value, and `src/pages/Documents.rjip.test.ts` pins the exported bytes. |
| **B-18** | float accumulation plus `Math.round` in the chart layer | **does not match** — B-18 is the regime-gate fall-through, **already FIXED in Phase 6** | **B-18 is not this phase's and is left exactly as it was.** The chart-layer defect the brief describes had **no register row at all**, and `Math.round` was never in `FinancialChart.tsx`. What was there — a private `Intl.NumberFormat` (a sixth formatter) and float accumulation in the axis — is fixed under T4, and recorded as part of B-17 rather than as a fake B-18 closure. |
| **B-20** | the `totalDue` type is a lie | **does not match** — B-20 is the `min-base` threshold polarity bug, **already CLOSED in Phase 9** | **B-20 is untouched.** There is no field named `totalDue` anywhere in `src/` (zero matches outside tests). The real total is `total = sumBani([cas, cass, incomeTax])` at `src/domain/tax.ts:332` — computed from already-rounded integer lines, so the defect the brief describes does not exist in current source and there was nothing to fix or cast. |
| **B-16** | a rounding rule asserted with no legal basis | **does not match** — B-16 is fiscal-loss persistence, **PART FIXED in Phase 5**, still open on persisting the record and reading prior-year losses back | **NOT closed by this phase** — persisting losses is not in this brief's tasks. The legal-basis half is handled where it belongs: art. 66 alin. (1) is quoted verbatim above and in the `money.ts` header, with the Titlul V application marked as **our extension by analogy**, not as a Titlul V requirement. |

Two rows the brief does not mention, both real:

- **B-25** — opened by the previous Phase 10 worker as the tracker for the T1 it deliberately deferred. **Closed**
  by executing it. The row's own text is the deferral decision, so closing it is the honest bookkeeping.
- **B-26** — **opened and then closed by this phase** (§6). `convertMoneyToBani` produces one `MoneyPrecisionNotice`
  per field it could not represent exactly, and the report was persisted — but `toAppData` dropped it and no screen
  rendered it, so the first write after a load erased it. Acceptance criterion 6 ("a value that cannot be converted
  must surface, not vanish") was **half-met**. That was filed rather than argued away, and then fixed.

---

## 5. THIS DOCUMENT SUPERSEDES THE FROZEN ARCHIVE

**Where this file and the frozen `docs/ai/steps/*` archive disagree, this file is correct and the archive is not.**
The clearest example: `docs/ai/steps/08_stack_setup.md:32` lists `decimal.js-light ^2.5.1` among the stack as
"exact decimal arithmetic", as if it were in use. It was declared at `package.json:16` and **never imported by a
single line of source** until Phase 10 — `docs/ai/steps/01_real_baseline.md:100` row 18 records the same thing as
"documented but not implemented". The archive is left unedited on purpose: it is a record of what was believed at
the time, and correcting it in place would destroy that. The correction lives here.

---

## 6. B-26 — THE REPORT REACHING A SCREEN (the last open thread, closed)

Criterion 6 has two halves and the first pass shipped one of them. The report existed; nothing read it.

**The fix is one line of plumbing plus one component.** `toAppData` now carries `moneyNotices` into `AppData`.
That placement is the whole point: the save effect writes `JSON.stringify({ ...data, version })`, so anything on
`AppData` round-trips through localStorage, while anything held only on the migration result is gone after the
first mutation. `src/components/MoneyPrecisionNotice.tsx` renders it in the shell under the quarantine banner,
naming the collection, the record id, the field, the stored value **verbatim** and what it became **in lei**
through `formatBaniLei`.

**Carrying the report through the save exposed a second defect the first pass could not have seen.**
`MoneyPrecisionNotice.original` was typed `number`, and the case it exists to report is a value that cannot be
represented — `JSON.stringify` turns `NaN` into `null`, so the moment the report was written back out, the next
load would fail `persistedAppDataSchema` on `original: z.number()` and **quarantine the entire payload the notice
was describing**. The cure would have killed the patient. `original` is now `string`: `JSON.stringify` cannot keep
a non-finite number verbatim anyway, so text is what "exactly as it was stored" always required. Pinned by a test
that stringifies a NaN notice and parses it back through the real schema.

**Copy, and why it does not say „leu".** The banner says *„rotunjită la banul cel mai apropiat (0,01 lei),
jumătate în jos — aceeași direcție pe care o folosește art. 66 alin. (1)"*. „La leul cel mai apropiat" reads better
as Romanian but is false here: this conversion rounds to 0,01 lei, while rounding to a whole leu is art. 66 and
happens only at the three tax lines. A banner that said „leu" would overstate what was done to the user's money by
100× — the same class of error the phase exists to remove. The sentences are built by per-count helpers
(`headline`, `adjustedSentence`, `carriedSentence`) because interpolating a count into Romanian without agreement
produces „1 valoare au fost rotunjite"; a test pins both numbers.

**What is deliberately NOT here.** No dismiss button and no acknowledgement flag: the report states a fact about
stored data, and inventing a persisted "I understand" field to make it stop appearing would be a new state machine
nobody asked for. It goes away on its own once the affected records are re-entered. And the banner never prints a
raw ban count and never renders an unconvertible value as `0,00` — both asserted, because those are the two ways
this component could lie.

**Tests added:** `src/components/MoneyPrecisionNotice.test.tsx` (8), `src/data/store.load.test.tsx` (4 — carried out
of the migration, written back to localStorage, still present on a second load where no migration runs, absent when
nothing had to be decided), `src/App.test.tsx` (2), `src/data/migration.money.test.ts` (1 — the NaN notice JSON
round-trip), `e2e/settings.spec.ts` (2 — the banner on screen, and the saved bytes at version 5).

---

## 7. THE SUITE WAS INTERMITTENTLY RED — what it was, and what it was NOT (brief 13, 2026-10-08)

Phase 10 shipped `MoneyPrecisionNotice` and the `moneyNotices` field that rides through save/load. After that,
`src/pages/Dashboard.test.tsx` began failing at random in the full suite. This section records what was actually
measured, because the first diagnosis of it — including the one written into the brief — was wrong.

**The symptom.** `Dashboard page > shows the computed estimate in the cockpit for a PFA profile on the lawful regime`
(and, in other runs, its sibling `computes the tax estimate for the default PFA regime … (B-14)`) failed with:

```text
Error: expect(element).toHaveTextContent()
Expected element to have text content:  /20\.435/
Received:  Impozit estimat—de pus deoparte
```

**The hypothesis that was tested and disproved.** The brief's prime suspect was shared mutable state — `localStorage`,
the quarantine key, or a seeded payload surviving from a sibling test or sibling file. That is not it, and the
measurement that kills it is simple: **the failure reproduces with `Dashboard.test.tsx` running alone.** Under CPU
pressure, `npx vitest run src/pages/Dashboard.test.tsx` — one file, one worker, nothing else in the process — failed
**3 of 8** runs. Vitest also isolates each file's module graph and gives each its own jsdom, so there is no channel
for the leakage the hypothesis needs. Two more facts point the same way: the received text is the **loading sentinel**
`—`, never another test's figure; and the failing test is not always the same one.

**The cause.** `useLatestTaxEstimate` (`src/data/derived.ts:47-80`) resolves the engine through
`computeTaxEstimate(...).then(setEstimate)` with `estimate` initialised to `null`, so `useDashboardData` hands
`LOADING_TAX` (`src/data/dashboardAdapter.tsx:13`) to the page on the first render. Measured in the test environment:
the cockpit card reads `—` synchronously after `render()`, **still `—` after one microtask**, and `46.570,00 RON` only
after the next **macrotask** — the React scheduler's. The test waited for the wrong thing: `findByText('Impozit
estimat')` waits for the **label**, which is present on the first paint, so it resolved immediately and the one-shot
`toHaveTextContent` that followed raced that macrotask. It lost whenever the machine was busy. Nothing was shared;
the assertion was never waiting for the value it checked.

**The fix, and why it is not the weakening the hard rule forbids.** The assertions are unchanged — same element, same
matcher, same exact figures (`/20\.435/`, `/46\.570/`). What was added is the missing wait for the figure
(`waitFor(() => expect(card).toHaveTextContent(…))` in `src/pages/Dashboard.test.tsx`). It asserts a **specific
figure**, not the absence of the dash; it settles in **2 ms**, so no timeout is widened and none is load-bearing; and
a wrong figure, or one that never arrives, still fails. One assertion in the same file was also **strengthened**: the
B-14 refusal test asserted `—` before anything had resolved, so it passed against the loading sentinel and could not
fail — it now awaits the refusal reason first, so the dash it checks is the refusal marker.

**Evidence, after the fix.** Isolated file under pressure: **10 of 10** green (was 3 failures in 8). Full suite under
`taskset -c 0,1`: **10 of 10** green (it failed 2 in 6 before). Full suite at default concurrency: **10 of 10**, 760
tests each. `tsc` 0, build 0, e2e 36 unchanged.

**What was deliberately NOT fixed here, and is now in the register.** The product keeps its async first paint,
because brief 13 forbade product changes — so the root cause is filed rather than silently absorbed:

- **B-27** — an async boundary with no I/O behind it: `computeTaxEstimate` is `async` but awaits nothing, and the hook
  treats it as deferred work. That is the root cause of this flake; the test fix treats the symptom at the correct
  layer until someone removes the boundary on purpose.
- **B-28** — the cockpit renders the **same** `—` for „still computing" and for „the engine refused to compute", and
  `—` is this app's established refusal marker. A user cannot tell a pending calculation from a refusal. That
  ambiguity is also why one assertion here could be vacuous for as long as it was.

**Two documentation errors corrected in the same pass.** This file claimed four green checks (§head, §3, §3.1 row 2)
as a property of the tree; it was true of the runs measured and false as a claim about the suite — corrected above.
And `docs/ai/STATE.md` did carry a **B-17** row, contrary to the brief's account, but the row was malformed into five
cells in a four-column table, with the strikethrough spanning columns and a duplicated sentence fragment — so the
register rendered B-17's evidence in the wrong column. The row is now four cells, struck through where it should be,
with the fragment removed and the closure evidence intact.
