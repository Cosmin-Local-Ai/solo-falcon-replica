# Phase 20 — rule-release immutability (pre-Phase-11 TASK 6)

Brief: `docs/ai/briefs/22_task6_rule_release_immutability.md`.
Previous phase: `docs/ai/phases/19_pension_cass_input_model.md` (TASK 5).
Date: `2026-10-09` (`date +%F`).

---

## 1. The defect, stated exactly

A stored snapshot froze release **metadata**, not the rules that produced it.

| What the record carried | What it was supposed to pin | What actually happened |
|---|---|---|
| `snapshot.ruleRelease` — the release **object** (`snapshot.ts:44`) | which law produced this number | the object carries no arithmetic at all |
| `releaseId: 'PFA_2026_SYSTEM_REAL'` (`release2026.ts:4`) | the identity of a rule set | unchanged across three formula corrections |
| `createdAt: '2026-01-01'` (`release2026.ts:65`) | when the record was made | identical to `effectiveFrom`; never moved |

The Phase 3 (CAS), Phase 4 (CASS) and Phase 5 (2026 income tax) corrections each changed
**formula-bearing parameter values** — `rate`, `min_base`, `tier2_base`, `tier1_cas`, `tier2_cas`,
`max_annual_base`, `base_rate` — and **not one identity field moved**. Two snapshots carrying
`PFA_2026_SYSTEM_REAL` could therefore encode different arithmetic, and nothing in the record said which.

The second half of the defect was upstream of storage: **nothing selected a release.** Every consumer
imported `PFA_2026_RELEASE` / `PFA_2026_SYSTEM_REAL_PACKAGE` by name — 15 production call sites across
three files — so the release was never chosen, and a new rule set would have silently re-bound
calculations that were supposed to be pinned to an old one.

The decision was already recorded: **content-address the rule set; do not redesign the release model.**
This phase adds a content hash and a real lifecycle to what exists.

---

## 2. The hash: exact input and canonicalisation

`src/domain/fiscal/ruleSetDigest.ts`.

```
digest = SHA-256( "pfa-rules-v1" + "|" + canonicalize( sorted( project(rules) ) ) )
```

* **Scheme tag first.** `RULE_SET_SCHEME = 'pfa-rules-v1'` is mixed into the hashed bytes, so a digest
  produced under a different projection can never be compared against one produced under this one.
* **Projection** — the formula-bearing subset of each rule:
  `ruleId`, `taxRegime`, `taxYear`, `effectiveFrom`, `effectiveTo`, `status`, `calculatorId`,
  and `parameters` as `{id, value, unit}` triples.
* **Ordering.** Rules sorted by `ruleId`, parameters sorted by `id`, using plain `<` on strings — **not
  `localeCompare`**, because locale comparison is environment-dependent and an environment-dependent
  digest is not a content address. `selectApplicableRules` may use `localeCompare` for display order;
  a hash may not.
* **Key order** is handled by the already-pinned `canonicalize` (`src/domain/snapshots/serialize.ts`),
  which sorts object keys lexicographically. The rule-set canonicaliser does not reimplement it — the
  digest of the inputs and the digest of the rules share one tested canonicaliser.
* **Digest** is `sha256Hex` (`src/domain/snapshots/hashSync.ts`), the pure-JS SHA-256 already proven
  byte-for-byte identical to `crypto.subtle` by `hashSync.test.ts`. Sync, so it runs on the load path.
* **A rule set must be a set.** Two rules with the same `ruleId` make the bytes order-dependent, so
  `canonicalRuleSet` throws `DuplicateRuleIdError` rather than hashing something ambiguous.

### What is in the hash, and what is deliberately out

| In | Why |
|---|---|
| every `parameters` entry as `{id, value, unit}` | `id` is the lookup key every reader matches by string; `value` is what the formula consumes; `unit` is load-bearing — `paramBani` refuses any unit other than `'lei'` and refuses a non-integer, which is the guard keeping a euro cap out of a bani calculation |
| `ruleId`, `taxRegime`, `calculatorId` | selectors: `tax.ts` resolves CAS/CASS/income-tax by `taxRegime`, and `calculatorRegistry[rule.calculatorId]` picks the formula |
| `taxYear`, `effectiveFrom`, `effectiveTo`, `status` | gates: `selectApplicableRules` filters on all four, so moving any of them changes which arithmetic runs |

| Out | Why |
|---|---|
| `name`, `jurisdiction`, `entityType` | labels; nothing branches on them |
| `sourceAct`, `sourceArticle`, `sourceUrl`, `verifiedAt` | **a hash is not a legal citation.** It pins which parameters were used; the article stays where it is, and a citation-only correction must not become a fake arithmetic revision |
| `version`, `supersededBy` | lifecycle bookkeeping. `version` is a *consequence* of a content change (§6), so hashing it would move the digest for a reason that is not a change in content |

**Judgement call, recorded:** every parameter is hashed, including the text parameters the engine surfaces
(`condition`, `missing_fact`, `conflict`, `note`, `cap_base_article`). A digest that over-pins turns a prose
correction into a new release, which is what a release model is for. A digest that under-pins lets a
changed rule set masquerade as one already recorded. The first is a process cost; the second is the defect
this phase closes. So: over-pin.

### Pinned by tests, not by prose

`src/domain/fiscal/ruleSetDigest.test.ts` (28 tests):

* the 48-rule package rebuilt as fresh literals with keys declared in reverse order → **same digest**;
* the rule array reversed, and rotated → **same digest**; the parameter array reversed → **same digest**;
* `CAS_2026.rate` 25 → 26 → **different digest**;
* a `lei` parameter relabelled `eur` → **different digest** (the unit is not decoration);
* a parameter added or removed → **different digest**;
* each of `taxYear`, `effectiveFrom`, `effectiveTo`, `status`, `calculatorId`, `taxRegime`, `ruleId` →
  **different digest**;
* each of `name`, `jurisdiction`, `entityType`, `sourceAct`, `sourceArticle`, `sourceUrl`, `verifiedAt`,
  `version`, `supersededBy`, and every parameter `label`/`description` → **same digest**;
* duplicate `ruleId` → throws.

---

## 3. Where the digest is stored — the migration decision, made explicitly

**The rule-set digest belongs to the calculation record, not to the input snapshot.**

`inputSnapshot` is the **enumerated subset `{ profile, revenues, expenses }`** that TASK 3 pinned
(`phases/17_tax_reserve_persistence.md` §7), and `inputsHash` is the digest of exactly that. Putting the
rules inside it would have:

1. moved **every stored `inputsHash`**, which is the landmine TASK 3 named — a stored record claiming
   something other than what it contained at calculation time; and
2. category-confused the record: the rules are the **engine that consumed** the inputs, not an input the
   user supplied.

So the digest is a **sibling** of `inputsHash` on `TaxCalculationSnapshot`:

```ts
inputsHash: string;      // SHA-256(canonicalize({ profile, revenues, expenses }))  — unchanged
ruleSetHash?: string | null;   // TASK 6 — SHA-256 of the rules actually applied
```

Two digests, two questions: *what did the user give* and *which law consumed it*. Two snapshots with the
same `inputsHash` and different `ruleSetHash` are the same inputs through different arithmetic — the case
that used to be invisible. `snapshots.test.ts` pins both halves, including that changing a rule moves no
`inputsHash`.

`createCalculationSnapshot` now **requires** `rules: readonly FiscalRule[]` — the effective set the
calculation applied, after the year and effective-date window filtered it. A snapshot that cannot name its
arithmetic can no longer be built.

### Two digests, deliberately at two granularities

| Field | Covers | Purpose |
|---|---|---|
| `RuleRelease.contentHash` | the **full** rule set the release names (all 48) | the release's content address — what makes it immutable and what a revision must change |
| `TaxCalculationSnapshot.ruleSetHash` | the **effective** set actually applied (year + window filtered) | what produced this number, so it can be replayed |

They are not redundant: at `2026-01-01` the effective set excludes the H2 wage rule and the three art. 68
alin. (5) letters that bind from `2026-03-01`, so the snapshot's digest is not the release's digest.

### Migration: data version 8 → 9, chain step `rule-set-digest`

The stored snapshot **shape** changed, so this is a version bump with a named chain step
(`src/data/migration.ts`):

```
DATA_VERSION_RULE_SET_DIGEST = 9
CURRENT_DATA_VERSION = 9
step: pension-facts (8) → rule-set-digest (9)
```

`migrateRuleSetDigestV9` does one thing and refuses one thing:

* **does** add `ruleSetHash: null` to every stored snapshot that lacks the key;
* **refuses** to compute a digest from the current rule set and stamp it onto an old record. The rules
  that produced a pre-v9 snapshot were never content-addressed, and the rule set has since moved three
  times under an unchanged `releaseId` — hashing today's rules would assert that today's arithmetic
  produced a years-old number. `null` is the record admitting it cannot be reproduced. Same discipline
  as the pension-facts step refusing to mint a receipt fact.

Also deliberately untouched by the step:

* **no stored `inputsHash` moves**, and no `preMigrationInputsHash` is written — pinned by
  `store.migration.chain.test.tsx`;
* **the embedded `ruleRelease` is not retrofitted** with `contentHash` / `lifecycle` / `version`. Those
  fields are **optional on the persisted type and declared in the zod schema**, so a pre-v9 embedded
  release parses unchanged and simply carries none. Minting them would describe a release nobody recorded
  at the time the calculation ran.

Why the new fields are optional rather than required: `parseAppData` runs **before** the migration chain,
so a required key would reject old payloads into quarantine instead of migrating them. Declaring them is
what stops zod from silently stripping them on the way back in — pinned in `schema.test.ts`.

---

## 4. `createdAt` is now real, and how it was derived

```ts
effectiveFrom: '2026-01-01'              // when the law bites
createdAt:     '2026-10-09T09:05:44+03:00'  // when this record was last materially made
```

Derivation, reproducible from the repository: `git log` over the three files that define the rule set
(`release2026.ts`, `package2026.ts`, `deductibility2026.ts`). The last commit to change any
formula-bearing content is **`431afaf`** — *TASK 2d, 2026-10-09T09:05:44+03:00* — which changed a
`conflict` parameter's surfaced text (a parameter, so under §2 it is a content change). The last change to
an **arithmetic** parameter was **`1583d9e`** (TASK 2a, `2026-10-09T04:26:16+03:00`, which added the 39
art. 68 rules); before that, the CASS correction `a6d4e77`, the income-tax correction `00ba40a` and the CAS
correction `3a5f216`, all 2026-10-06.

Pinned in `fiscal.test.ts`: `createdAt` matches a full ISO-8601 instant pattern, and
`createdAt !== effectiveFrom`. The old value `'2026-01-01'` fails both.

`createdAt` is **not** in the hash — it is a record-keeping fact about the file, not a parameter.

---

## 5. Lifecycle, enforced in code

`src/domain/fiscal/registry.ts`. One ladder for rules and releases:

```
PROPOSED → VALIDATED → STAGED → SCHEDULED → ACTIVE → SUPERSEDED
```

`assertLifecycleTransition` allows **exactly one step forward**; `SUPERSEDED` is terminal. A release
becomes ACTIVE only through `registry.advance(id, 'ACTIVE')`, so the ladder is a gate, not a comment.

Enforced by `register()`, each with a test that asserts the throw:

1. **No in-place edit.** A `releaseId` already registered, offered with a different rule-set digest →
   `RuleReleaseImmutableError`. *A revision gets a new identity.* This is precisely what happened three
   times before this phase.
2. **A release cannot claim a rule set it does not contain.** `ruleIds` ↔ rules must match in **both**
   directions (previously asserted only by `fiscal.test.ts`; now a runtime gate), every rule's `taxYear`
   must equal the release's, and a declared `contentHash` must equal the digest of the rules actually
   handed in. A release registered without a digest is stored **with** one — the registry never holds a
   release whose digest does not match its rules.
3. **One ACTIVE release per tax year**, and ACTIVE windows may not overlap. This is the boundary the
   brief asked for — "a single active release selected by date" — and nothing more.
4. **Registered rule sets are deep-frozen, in place.** An attempt to mutate an ACTIVE rule's parameter
   throws `TypeError` instead of quietly re-binding old calculations to new law.
5. **Superseded releases stay readable forever.** `rulesOf(releaseId)` returns a superseded release's
   rules, and they remain selectable inside their own window — which is what makes an old snapshot
   replayable.

Separation that makes (5) work: **which rule set is operative** is decided by the *release's* lifecycle
and window; **which rules apply inside a rule set** is decided by the *rule's* own `status` and window.
Superseding a release therefore does not touch its rules' `status`, does not move their digest, and does
not make an old snapshot unreadable.

`activeEntry(taxYear, asOfDate)` answers "which release was in force on this date". A date inside a
superseded release's own window resolves to **that** release — answering with the newer one would re-bind
a past date to a law that was not in force on it. A year with no registered release returns `undefined`,
and the caller must say so: `computeTaxEstimate` now takes `ruleRelease: RuleRelease | null` and refuses
with a message naming the year rather than falling back to a neighbouring year's rules.

---

## 6. Per-rule `version` moves exactly when the content does

The registry keeps `ruleId → { digest, version }` across every registered set and refuses both directions
of the rule:

* identical content re-registered under a bumped version → **throws** ("a version may only move when the
  content moves");
* changed content kept at the same version → **throws** ("changed its formula-bearing content … but its
  version stayed");
* changed content with a higher version → accepted.

So `version` stops being a display number: it cannot diverge from the digest.

**Not backfilled.** All 48 rules stay at `version: 1`. The Phase 3/4/5 corrections *were* material
revisions, but the digests of the superseded rule sets were never recorded, and minting them now to justify
a version bump would be the same fabrication the migration refuses. The history lives in git; the version
ladder starts where the content addressing starts. Recorded here so nobody "fixes" it by bumping numbers.

---

## 7. Every hard-wired call site, and what replaced it

All 15 production sites the Orchestrator's list plus the six more Scout C found in `dashboard.ts`. None
of them names a year any more.

| File | Line (before) | Was | Now |
|---|---|---|---|
| `src/data/dashboard.ts` | 34 | `import { PFA_2026_RELEASE, PFA_2026_SYSTEM_REAL_PACKAGE }` | `import { selectRuleSet }` + `selectApplicableRules` |
| | 122 | `selectEstimateOperands(…, PFA_2026_SYSTEM_REAL_PACKAGE)` | `selectEstimateOperands(…, rules)` from `selectRuleSet(data.profile.fiscalYear, asOfDate)` |
| | 127 | `selectTaxDerived(data, PFA_2026_SYSTEM_REAL_PACKAGE)` — **unfiltered** | `selectTaxDerived(data, selectApplicableRules(rules, { taxYear, asOfDate }))` |
| | 135 | `ruleRelease: PFA_2026_RELEASE` | `ruleRelease: selection ? selection.release : null` |
| | 136 | `rules: PFA_2026_SYSTEM_REAL_PACKAGE` | `rules` |
| | 196 | `computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, …)` | `computeThresholds(selectionRules(data, asOfDate), …)` |
| | 200 | `ruleRelease: PFA_2026_RELEASE.ruleIds[0]` — a **rule id** in a release field | `ruleRelease: selection ? selection.release.releaseId : null` (`ThresholdQuery.ruleRelease` and `FiscalThreshold.ruleRelease` are now `string \| null`) |
| | 213 | `computeDeadlines(PFA_2026_SYSTEM_REAL_PACKAGE, …)` | `computeDeadlines(selectionRules(…), …)` |
| | 333 | `computeDeadlines(PFA_2026_SYSTEM_REAL_PACKAGE, …)` in `buildSnapshot` | same |
| `src/data/derived.ts` | 15 | the import | `selectRuleSet` |
| | 41 | `selectApplicableRules(PFA_2026_SYSTEM_REAL_PACKAGE, …)` | filtered from `selectRuleSet(store.profile.fiscalYear, asOfDate)` |
| | 75 | `selectEstimateOperands(store, asOfDate, PFA_2026_SYSTEM_REAL_PACKAGE)` | one `selection` per run, shared |
| | 86 | `selectApplicableRules(PFA_2026_SYSTEM_REAL_PACKAGE, …)` | same `rules` |
| | 98 | `ruleRelease: PFA_2026_RELEASE` | `selection ? selection.release : null` |
| | 99 | `rules: PFA_2026_SYSTEM_REAL_PACKAGE` | `rules` |
| `src/pages/Expenses.tsx` | 8 | the import | `selectRuleSet` + local `activeRulesFor(fiscalYear, asOfDate)` |
| | 186 | `selectDeductibleExpenses(store, now(), PFA_2026_SYSTEM_REAL_PACKAGE)` | year read from `store.profile.fiscalYear` |
| | 204 | `selectEstimateOperands(store, now(), PFA_2026_SYSTEM_REAL_PACKAGE)` | same |

`Expenses.tsx` was the clearest case: the call sites had **no year and no date in scope at all**, so they
could only ever ask for 2026.

**Drift closed while there:** `dashboard.ts:127` passed the *unfiltered* package to `selectTaxDerived`
while `derived.ts:86` passed the filtered set, so the two paths could report different rule sets from the
same data. Both filter now. `activeRelease` is not rendered anywhere, so no figure moved.

**Policed, not trusted:** `registry.test.ts` scans the production source tree and fails if any file
outside `src/domain/fiscal/` references `PFA_2026_RELEASE` or `PFA_2026_SYSTEM_REAL_PACKAGE` (comments
stripped first), and asserts that `dashboard.ts`, `derived.ts` and `Expenses.tsx` each call
`selectRuleSet(`. A convention is what let 15 sites hard-code the constants.

### Explicitly NOT built

No future-year automation, no per-year rule generation, no fallback release. `selectRuleSet` returns
`undefined` for a year this build has no rules for, and the engines report a missing rule. A profile whose
`fiscalYear` is not 2026 gets the honest refusal — `computeTaxEstimate` now says
*„Niciun set de reguli înregistrat pentru anul fiscal …"* instead of silently running the 2026 rules
against it.

### Known adjacent weakness, recorded not fixed

`src/domain/thresholds.ts` `THRESHOLD_SPECS` still hard-codes rule ids (`CAS_2026`, `CASS_2026`,
`VAT_THRESHOLD_2026`) and `thresholds.ts:740` does `if (!rule) continue;`, so a differently-named release
would **silently drop** the five threshold rows rather than error. Out of scope here (it is a threshold
concern, not a release-identity one) but it is the next thing that should be made loud.

---

## 8. The fixture, in the required order

`src/domain/fiscal/immutability.test.ts` (7 tests):

1. **R1 ACTIVE** — the real 48-rule 2026 package, registered as `R1`.
2. A calculation under R1: venit brut 50.000,00 lei − cheltuieli deductibile 10.000,00 lei = VNA
   40.000,00 lei; CAS 0 (sub 12 SM, art. 148 alin. (1)); CASS 4.000,00 lei; impozit 10 % × 36.000,00 =
   3.600,00 lei; **total 7.600,00 lei**. The snapshot records `ruleSetHash`.
3. **R2 becomes ACTIVE later** — the same 48 rules with **`INCOME_TAX_2026.base_rate` 10 → 11** and that
   rule's `version` bumped. Registered `SCHEDULED`, R1 superseded with `effectiveTo: '2026-06-30'`, then
   R2 advanced to ACTIVE.
4. **An R1 snapshot still reproduces R1's numbers.** `entryByReleaseId('R1')` → digest equals the
   snapshot's `ruleSetHash` → re-running produces **7.600,00 lei** and `expect(replay.lines).toEqual(
   snapshot.calculationLines)` — every line, not just a total that happens to agree.
5. **A new calculation uses R2** → **7.960,00 lei**, 360,00 lei apart, exactly 1 % of 36.000,00 lei.

The fixture is **not vacuous**: the test asserts only one rule differs between the releases, that the two
release digests differ, that the two `ruleSetHash`es differ, and that the two totals differ. It also
asserts the registry **refuses** to register R2's rules under R1's `releaseId` — the historical mistake,
now impossible.

Reading provenance back out: `src/domain/snapshots/ruleProvenance.ts` gives
`snapshotRuleState(snapshot)` → `pinned | drifted | unregistered | unpinned`, and
`resolveSnapshotRules(snapshot)` → the rules or `null`. `unpinned` (a v9-stamped `null`) and
`unregistered` are answers, not errors to be smoothed over.

---

## 9. What did **not** move

* **No seed or e2e money figure changed.** No rule parameter was touched. Deductible 120,00 / 144,00 lei,
  VNA 9.096,00 lei, e2e clock 3.249,00 lei, reserve 1.083,00 lei, tax hero 51.510 lei — all unchanged,
  verified by running the suite, not assumed.
* **No stored `inputsHash` moved**, and no `preMigrationInputsHash` was written.
* **No rule parameter value changed**, so no computed figure can move.
* **No assertion was deleted, no matcher loosened, no timeout widened.** The only re-pinned e2e assertion
  is `e2e/settings.spec.ts` B-26 saved payload `version: 8 → 9`, with the reason written into the test.

---

## 10. Verification (measured, not inherited)

| Command | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npm run test` | **61 files / 1071 tests**, all passing (was 57 / 984: +4 files — `ruleSetDigest.test.ts` +28, `registry.test.ts` +29, `immutability.test.ts` +7, `ruleProvenance.test.ts` +7 — and +16 tests inside existing files: `fiscal.test.ts` +6, `schema.test.ts` +3, `store.migration.chain.test.tsx` +3, `snapshots.test.ts` +3, `store.snapshots.test.tsx` +1) |
| `npm run build` | exit 0 |
| `npm run test:e2e` | **36 / 36** — `e2e/dashboard.spec.ts` 26 + `e2e/settings.spec.ts` 10; no spec added or removed; one assertion re-pinned (8 → 9) |

Every run used the runner's own exit status (`set -o pipefail`, never a piped `grep`).

---

## 11. Deliberate open items

* `thresholds.ts` silent `if (!rule) continue;` on a missing rule id (§7) — should become a loud row.
* `tax.ts` pins the engine's as-of to `${fiscalYear}-01-01`, discarding the real as-of date, so a
  mid-year `effectiveFrom` boundary (the H2 wage rule, the 2026-03-01 art. 68 letters) is not honoured
  inside the engine. `ruleProvenance.engineAsOf` mirrors it deliberately so replay matches calculation;
  if that line changes, the mirror must change with it.
* `RuleRelease.status` (`SAFE_ACTIVATION` / `REVIEW_REQUIRED`) is a **verification** gate and stays
  separate from `lifecycle`. Two fields, two questions; renaming `status` would have broken stored
  payloads for no gain.
* The 2026 release is the only one registered. Nothing in this phase makes adding a 2027 release easy or
  hard — it just makes it a new `releaseId` with a new digest, which is the whole point.

---

## NEXT HANDOFF

**Exact hash input and canonicalisation.**
`sha256Hex( "pfa-rules-v1" + "|" + canonicalize(rules.map(digestRule).sort(by ruleId)) )` where
`digestRule(r) = { ruleId, taxRegime, taxYear, effectiveFrom, effectiveTo, status, calculatorId,
parameters: r.parameters.map(p => ({ id, value, unit })).sort(by id) }`. Keys sorted by the existing
`canonicalize` (`src/domain/snapshots/serialize.ts`); rules and parameters sorted with plain `<` on
strings, never `localeCompare`. Scheme tag `RULE_SET_SCHEME` is inside the hashed bytes. Per-rule digest on
the same scheme: `ruleDigest(rule)`. Excluded: `name`, `jurisdiction`, `entityType`, `sourceAct`,
`sourceArticle`, `sourceUrl`, `verifiedAt`, `version`, `supersededBy`, and parameter `label`/`description`.

**Where the digests live.**
`RuleRelease.contentHash` — digest of the **full** named rule set (the release's content address).
`TaxCalculationSnapshot.ruleSetHash` — digest of the **effective applied** set, a sibling of `inputsHash`,
**never inside `inputSnapshot`**. `createCalculationSnapshot` now requires `rules`.

**Migration decision and version.** Data version **8 → 9**, chain step **`rule-set-digest`**
(`DATA_VERSION_RULE_SET_DIGEST`). It stamps `ruleSetHash: null` on stored snapshots and **fabricates no
digest**. No stored `inputsHash` moves; no embedded `ruleRelease` is retrofitted with `contentHash`,
`lifecycle` or `version`. New persisted fields are optional-but-declared because parse precedes migration
and zod strips undeclared keys.

**De-hard-wired call sites.** `src/data/dashboard.ts` (34, 122, 127, 135, 136, 196, 200, 213, 333),
`src/data/derived.ts` (15, 41, 75, 86, 98, 99), `src/pages/Expenses.tsx` (8, 186, 204) — all now go
through `selectRuleSet(fiscalYear, asOfDate)` from `src/domain/fiscal/registry.ts`, policed by a
source-tree scan in `registry.test.ts`.

**For TASK 9 (provenance).** Every figure the UI presents must be attributable. Use
`snapshotRuleState(snapshot)` and `resolveSnapshotRules(snapshot)` from
`src/domain/snapshots/ruleProvenance.ts`. Four states, and all four must be renderable:
`pinned` → name the release (`snapshot.ruleRelease.releaseId`) and say the digest verified;
`drifted` → the registered rules no longer match the recorded digest — that is an in-place edit and must
be surfaced, never repaired by re-hashing; `unregistered` → the build does not carry that release;
`unpinned` → the record predates content addressing (`ruleSetHash === null`) and the app must say the
rules behind this number cannot be reconstructed. **Do not render a digest as a legal citation** — show
the article (`sourceArticle`/`sourceAct`) alongside it, never instead of it, and never let `sourceUrl`
point at `research/06_2026_fiscal_research.md` or `decisions/09_IMPLEMENTATION_ARCHITECTURE.md`
(pinned by a test in `fiscal.test.ts`). TASK 9 must also expect `FiscalThreshold.ruleRelease` to be
`string | null`.

**For TASK 10 (currency / FX rate store).** A rate store needs the same immutability discipline, and the
same two mistakes to avoid: (a) an identity that is a name plus a date and therefore never moves when the
numbers behind it do, and (b) a consumer that imports the current table instead of selecting one by date.
Concretely: content-address each rate table, record the digest on any figure derived from it, keep
superseded tables readable so an old conversion can be replayed, and make "edit a published rate table in
place" impossible rather than discouraged. `Bani` stays integer — a euro cap stays `unit: 'eur'` and
`paramBani` still refuses it; converting a euro parameter to lei is a **new rule set**, and the digest
will say so.
