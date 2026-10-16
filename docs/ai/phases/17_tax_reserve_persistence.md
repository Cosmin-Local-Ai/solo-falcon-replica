# Phase 17 — TASK 3: the tax reserve is persisted

**Date:** 2026-10-09
**Brief:** `docs/ai/briefs/19_task3_tax_reserve.md`
**Depends on:** TASK 2d (`431afaf`, `docs/ai/phases/16_precap_base.md`) — specifically its §12, "What TASK 3 must not disturb".
**Legal input:** none. No rule, threshold or formula was touched.

---

## 1. What changed, in one sentence

The reserve the app computes is now a **stored fact** — `AppData.reservedAmount: Bani | null` — and both
places that read a reserve read that stored value instead of hardcoding "nothing recorded", so the
„Rezervă fiscală sub țintă" warning can finally be cleared.

Before this task, `data/dashboard.ts` called `createTaxReserveState(null)` **twice** — once in
`getTaxReserve`, once inside `buildSnapshot` — with the comment `// honest "no data recorded"`. It was
honest for the build, and useless for the user: there was no way to record anything, so the warning
was structurally unclearable.

## 2. Where the value lives

| layer | place | shape |
|---|---|---|
| runtime | `AppData.reservedAmount` — `src/data/types.ts:218` | `Bani \| null` (**required**, never `undefined`) |
| payload type | `PersistedAppData.reservedAmount` — `src/data/schema.ts:281` | `Bani \| null \| undefined` (optional: absence is honest) |
| load gate | `persistedAppDataSchema` — `src/data/schema.ts:312` | `bani(nonNegative).nullable().optional()` |
| seed | `src/data/seed.ts:139` | `reservedAmount: null` |
| store write | `StoreValue.setReservedAmount(amount: Bani \| null)` — `src/data/store.tsx:105`, impl `:347` | clamps a negative at 0; `null` passes through |
| store read | `toAppData` — `src/data/store.tsx:131` | `parsed.reservedAmount ?? null` |
| version | `DATA_VERSION_TAX_RESERVE = 7` — `src/data/migration.ts:80`; `CURRENT_DATA_VERSION = 7` `:82` | chain step `tax-reserve` `6 → 7` at `:578` |

**Required on `AppData`, optional on the payload — deliberately.** The runtime object always carries a
`Bani | null`, so no consumer can meet a fourth state (`undefined`) and mistake it for one of the two
real ones. The *payload* may omit the key, because a pre-v7 install genuinely never recorded a reserve.
Absence is resolved in exactly one place — `toAppData` — and it resolves to `null`.

**The zod gate is the trap.** `persistedAppDataSchema` **strips undeclared keys**, so a field added to
the TS type but not to the schema would vanish on the next load with no failing test. The compile-time
`Expect<Equal<z.output<typeof persistedAppDataSchema>, PersistedAppData>>` guard at `schema.ts:475`
makes the two halves move together, and a new test (`keeps a recorded reserve through the parse gate`)
makes the runtime half observable.

**`reservedAmount` is the first money field in this schema allowed to be `null`.** Every other stored
money field is `.optional()` and "omits, never null" (`migration.ts:395-397`). Here `null` is not a
missing value — it is a recorded state — so `.nullable()` is correct, and a **negative** reserve is
rejected outright rather than clamped on the way in: corrupt money quarantines, it does not guess.

## 3. `null` is not `0`, and nothing collapses them

| state | meaning | renders as | arithmetic |
|---|---|---|---|
| `null` | no reserve recorded — the user never entered an amount | `—` + „Nicio sumă înregistrată." | treated as 0 **only inside** `remainingTarget` (`taxReserve.ts:140`) |
| `0` | an explicit, real fact: the user recorded that they set aside nothing | `0,00 RON` | 0 |
| absent from payload | a pre-v7 payload | (resolved to `null` at load) | — |

- The **migration backfills nothing.** `migrateReservedAmountV7` (`migration.ts:522`) is
  `return { ...data, version: DATA_VERSION_TAX_RESERVE };` — the fourth pure schema-widening step in
  the chain, after `payment-dates`, `vat-exceedance-date` and `expense-category`. Writing `0` would
  have manufactured a claim about the user's cash that no legacy field recorded, and would have
  silently cleared the warning for every upgraded install.
- Pinned at four layers: the parse gate (`keeps an explicit null reserve…`, `keeps an explicit 0 lei
  reserve, distinct from null`), the chain (`the tax-reserve step backfills nothing…`, `keeps a reserved
  amount that is already on the payload, unchanged — including an explicit 0`), the store
  (`a payload with no reserve field loads as null, not 0`), and the screen (`renders an unrecorded
  reserve as "no reserve recorded", never as 0,00 lei`).
- The `null` branch of `TaxReserve.tsx` existed but was **untested** before this task: a `?? 0`
  collapse would have passed the whole suite. It is now pinned.

## 4. Both read sites — located, not inherited

The brief warned that the plan's `dashboard.ts:169` / `:263` and phase 15/16's `:199` / `:298` are
historical. Located by Scout A and re-verified against the file:

| site | where it is now | what changed |
|---|---|---|
| **#1** `getTaxReserve` | `src/data/dashboard.ts:212`, state built at `:217`, called from `buildDashboardData` at `:388` | `createTaxReserveState(null)` → `createTaxReserveState(data.reservedAmount)` |
| **#2** `buildSnapshot` | `src/data/dashboard.ts:314`, landing in `snapshot.taxReserve` at `:353-362` | same, in the inline `computeTaxReserve(...)` call |

Both functions already took `data: AppData`, so **no signature changed** — the seam was the hardcoded
`null`, not the plumbing. Fixing only one would have left the bug live, which is exactly the defect the
original brief recorded.

`snapshot.taxReserve.currentReserveBani` (`:361`) keeps its `?? 0`. That aggregate is a numeric
cash-planning figure and the coercion is **arithmetic only** — the same coercion `computeTaxReserve`
already applies to `remainingTarget`. The tri-state is not collapsed anywhere a user reads: the card
renders `TaxReserveRecommendation.reservedAmount`, which stays `null`, and `insights.ts:234-243` reads
only `projectedLiabilityBani` and `gapBani`. Nothing in the repo displays `currentReserveBani`. Making
that aggregate nullable is a TASK 4 question (it owns the warning's semantics), not a persistence one.

## 5. The reserve consumes the estimate; it never recomputes it

Neither site re-derives anything. `buildDashboardData` receives an **already-computed**
`TaxEstimateResult` — from `useLatestTaxEstimate` (`data/derived.ts:64`, the live path) or
`getTaxEstimate` (`data/dashboard.ts:119`, the test-facing twin) — both of which call
`selectEstimateOperands` once and feed `operands.amounts` to `computeTaxEstimate`. The reserve reads
that result's `output.total` and nothing else (`taxReserve.ts:133-135`).

**No new call to `selectEstimateOperands`, `selectProjectionV1` or `applyAnnualDeductibilityCaps` was
added anywhere in the reserve path.** The only new call to the assembler in the whole diff is inside a
*test*, and only to prove the fixture genuinely exercises a ceiling.

Two tests pin the property rather than the number:

- `the reserve consumes the estimate it is handed — it never re-derives one`: the estimate's
  `output.total` is doctored to `9.999,99 lei`, a figure the seed data cannot produce at any date. If
  either site re-derived the estimate it would report `3.249,00 lei`; it reports the handed-in value.
- `on a profile with a struck alin. (6) ceiling the reserve reports the ENGINE total, not a re-derived
  one`: a profile holding a 1.000,00 lei protocol expense at 2026-12-31, where the operative pre-cap
  base is `7.700,00 − 120,00 = 7.580,00 lei`, the protocol ceiling is `floor(7.580,00 × 2 %) = 151,60
  lei`, and the deductible total is `120,00 + 151,60 = 271,60 lei` (hand-derived before running). The
  reserve's liability is asserted `=== est.output.total`. After TASK 2d a reserve that re-struck the
  caps on the post-cap reading would disagree with the dashboard by exactly the two ceilings apart —
  and nothing on screen would say which figure was right.

## 6. The reserve never feeds the tax calculation

Grep over the whole calculation path — `domain/tax.ts`, `domain/estimateBasis.ts`,
`domain/aggregation.ts`, `data/derived.ts`, `domain/snapshots/` — returns **zero** occurrences of
`reservedAmount`. The only consumers are `data/dashboard.ts` (both read sites), `components/TaxReserve.tsx`
and `pages/Dashboard.tsx`. The data flow stays one-way:

```
selectEstimateOperands → computeTaxEstimate → TaxEstimateResult ─┬→ getTaxReserve   → cockpit + card
                                                                 └→ buildSnapshot  → insight (gap)
AppData.reservedAmount ─────────────────────────────────────────┘
```

## 7. Snapshot digests — verified, not assumed

**No stored digest moves.** Evidence, first-hand rather than inherited:

- `createCalculationSnapshot` (`src/domain/snapshots/snapshot.ts:34-39`) builds
  `inputSnapshot: CalculationInput = { profile, revenues, expenses }` — an **explicitly enumerated
  subset**, two aggregate `Bani` numbers plus the profile — and `inputsHash = SHA-256(canonicalize(inputSnapshot))`.
- `canonicalize` (`src/domain/snapshots/serialize.ts:9`) walks only the keys present in the value it is
  given. `AppData` is never passed to it, and nothing in the hashing path spreads or `JSON.stringify`s
  the whole dataset.
- A new top-level `AppData` field therefore cannot reach the digest.
- **Pinned by a new test**: `the tax-reserve step moves no stored digest`
  (`src/data/store.migration.chain.test.tsx`) runs the v6→v7 step over a payload holding a stored
  snapshot and asserts `inputSnapshot` is equal, `inputsHash` is unchanged, `preMigrationInputsHash`
  stays absent, and the digest still verifies against the stored input. No re-hash migration was added
  and none is needed.

## 8. The entry control

`components/TaxReserve.tsx` gains an optional `onRecord?: (amount: Bani | null) => void` prop and a
`ReserveEntry` form wired from `pages/Dashboard.tsx` to `store.setReservedAmount`. Without it the
persisted field would be write-only from the app's point of view and the warning would still be
unclearable.

- Input parses through `parseLeiInput`, so a sub-ban amount (`85.555`) is **refused** with
  „Suma nu este o valoare validă în lei — nimic nu a fost salvat." and nothing is written.
- An **empty field saves nothing** — a blank box is not a claim that the user set aside 0 lei.
- Clearing is a separate, explicit action („Șterge înregistrarea", shown only when something is
  recorded) and writes `null`, never `0`.
- The card stays read-only when no recorder is supplied, which is what the presentational tests render.

## 9. Figures: none moved

Verified, not assumed. The seed carries `reservedAmount: null`, which is exactly what both read sites
hardcoded before, so every derived figure is byte-identical:

| figure | pinned at | value |
|---|---|---|
| deductible YTD / projected @ 2026-10-31 | `data/dashboard.test.ts` | **120,00 / 144,00 lei** — unchanged |
| VNA | `data/dashboard.test.ts` | **9.096,00 lei** — unchanged |
| impozit / total | `data/dashboard.test.ts` | **819,00 / 3.249,00 lei** — unchanged |
| rezervă lunară / rămas | `e2e/dashboard.spec.ts:120,124,195,197` | **1.083,00 / 3.249,00 lei** — unchanged |
| Observații severity counts (2 × Atenție) | `e2e/dashboard.spec.ts:383` | unchanged — the seed records no reserve, so the warning still fires |

**Assertions re-pinned (each replaced, none deleted):**

| file | before | after | why |
|---|---|---|---|
| `store.migration.chain.test.tsx` chain table | 6 pairs, `CURRENT_DATA_VERSION === 6` | 7 pairs incl. `[6, 7]`, `=== 7` | the chain genuinely gained a step |
| `store.migration.chain.test.tsx` × 5 `stepsApplied` arrays | e.g. `['expense-category']` | `['expense-category', 'tax-reserve']` | same |
| `store.save.test.tsx` payload key set | 11 keys | 12 keys, `+ 'reservedAmount'` | the reserve is genuinely part of the serialized dataset (the test's stated intent is "no *store-level* fields", not "no new `AppData` fields") |
| `e2e/settings.spec.ts:419` | `expect(saved.version).toBe(6)` | `toBe(7)` | the chain now runs `money-bani` → `expense-category` → `tax-reserve` |
| one test **name** extended | „…and the TASK 2b expense category as separate steps" | „…and the TASK 3 tax reserve as separate steps" | the name enumerated the steps; the step count changed |

Twelve test fixtures gained `reservedAmount: null` because `AppData.reservedAmount` is required — a
compile-time consequence, not a behaviour change. No assertion was deleted, no matcher loosened, no
timeout widened.

## 10. Tests

| file | before | after | new coverage |
|---|---|---|---|
| `src/data/schema.test.ts` | 33 | **37** | reserve survives the parse gate; explicit `null` stays `null` and is not `0`; explicit `0` stays `0`; a negative reserve is refused |
| `src/data/store.migration.chain.test.tsx` | 23 | **26** | the v6→v7 step backfills nothing and keeps records by id; a reserve already on the payload survives unchanged (including an explicit 0); **no stored digest moves** |
| `src/data/store.taxReserve.test.tsx` | — | **8** *(new file)* | **enter → reload → same value**; explicit 0 survives a reload; clearing writes `null`; a payload with no field loads as `null`; a pre-v7 payload loads as `null`; seed loads as `null`; a negative is clamped; nothing mutates the state uninvited |
| `src/data/dashboard.test.ts` | 37 | **43** | both read sites × {`null`, `0`, recorded, over-reserved}; the two sites cannot disagree; the reserve consumes the estimate it is handed; the engine total on a capped profile |
| `src/components/TaxReserve.test.tsx` | 5 | **13** | the `null` branch renders `—` / „Nicio sumă înregistrată." and never `0,00 RON`; `0` renders as a real amount; the entry control writes integer bani, refuses sub-ban and empty, clears to `null`, and stays read-only without a recorder |

## 11. Files changed

| File | Change |
|---|---|
| `src/data/types.ts` | `AppData.reservedAmount: Bani \| null` (required) with the tri-state contract |
| `src/data/schema.ts` | `PersistedAppData.reservedAmount?`; `persistedAppDataSchema.reservedAmount = bani(nonNegative).nullable().optional()` — the first nullable money field in the gate |
| `src/data/migration.ts` | `DATA_VERSION_TAX_RESERVE = 7`, `CURRENT_DATA_VERSION` bumped, `migrateReservedAmountV7` (backfills nothing), chain entry `tax-reserve` |
| `src/data/store.tsx` | `toAppData` resolves absence to `null`; `StoreValue.setReservedAmount` (clamps negatives, `null` passes through) |
| `src/data/seed.ts` | `reservedAmount: null` |
| `src/data/dashboard.ts` | **both** read sites consume `data.reservedAmount`; doc comments state the consume-don't-recompute rule |
| `src/components/TaxReserve.tsx` | optional `onRecord` + `ReserveEntry` (parse, refuse, clear) |
| `src/pages/Dashboard.tsx` | wires `onRecord={appData.setReservedAmount}` |
| tests | `schema.test.ts` +4, `store.migration.chain.test.tsx` +3, **new** `store.taxReserve.test.tsx` (8), `dashboard.test.ts` +6, `TaxReserve.test.tsx` +8; re-pins in `store.save.test.tsx` and `e2e/settings.spec.ts`; `reservedAmount: null` added to 12 `AppData` fixtures |

## 12. Validation (measured 2026-10-09, every command with `set -o pipefail` and the runner's own exit status)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | exit **0** |
| `npm run test` | **55 files / 889 tests passed** (baseline 54 / 860 → +1 file, +29 tests) |
| `npm run build` | exit **0** (chunk 804,80 kB — was 803 kB; the pre-existing >500 kB warning, unchanged in kind) |
| `npm run test:e2e` | **36 passed** (baseline 36; no e2e test added or removed) |

## 13. Implication for TASK 4 (threshold semantics)

- The warning is now **clearable**: `insights.ts:234-243` fires on `projectedLiabilityBani > 0 &&
  gapBani > 0`, and `gapBani` is `remainingTarget`, which a recorded reserve shrinks. A reserve ≥ the
  liability takes the gap to 0 and the insight disappears — pinned in `dashboard.test.ts`
  (`a reserve larger than the liability leaves a zero target…`).
- TASK 4 owns the warning's **semantics**, and two things it will have to decide are now visible:
  1. `DashboardSnapshot.taxReserve.currentReserveBani` is still a plain `Bani` with a `?? 0` coercion.
     That is defensible while nothing renders it, but if TASK 4 surfaces "how much is reserved" in the
     warning copy, the aggregate must become `Bani | null` or the copy will state `0` for a user who
     recorded nothing.
  2. The insight is binary (gap > 0 → warning). With a persisted reserve the interesting question
     becomes *how far short* the user is, which is exactly the typed `kind` + separate severity work
     TASK 4 carries. `breachMeaningFor` (`thresholds.ts:247`) is unrelated to the reserve and was not
     touched.
- TASK 4 must keep consuming `snapshot.taxReserve` / `DashboardData.reserve` — the same
  consume-don't-recompute rule applies: the gap is derived from the estimate the engine already
  produced, and re-deriving it would reintroduce the TASK 2d ceiling gap.

## 14. Out of scope, and what was not done

- **TASK 10** — no `currency` field, no rate, no FX code. The reserve is RON-only, like every other
  stored amount.
- **TASK 4** — no `kind`, no severity change, `breachMeaningFor` untouched.
- **`tax.ts`** — untouched. No formula, parameter, operand or cap changed; no seed figure moved.
- `addToTaxReserve` (`taxReserve.ts:93`) is still unused in production. The store action sets an
  absolute amount rather than accumulating, because the UI records a state („this is what I have set
  aside"), not a transaction ledger. An incremental reserve ledger is a later product decision, not a
  persistence requirement.
- `projectedQ4LiabilityBani: 0 as Bani` (`dashboard.ts:363`) is still a dead constant with no producer
  and no consumer. Left alone — deleting it is not this task's scope.
