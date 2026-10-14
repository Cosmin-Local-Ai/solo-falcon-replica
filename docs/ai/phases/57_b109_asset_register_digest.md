# 57 — B109: the asset register gets a digest beside `inputsHash`

**Scope:** a calculation snapshot could change its own number through the asset register without the record
being able to name the register. Add a sibling digest over the asset leg, leaving `inputSnapshot` exactly as
TASK 3 pinned it. No chain step, no backfill, no migration, no stored digest invalidated.

**Baseline measured at `b140429`; work done from `72b50c5`.**

---

## 1. What was actually wrong — and where the brief's mechanism was imprecise

The brief says: B-93 gave the engine a depreciation leg derived from the asset register, `inputSnapshot` is
`{ profile, revenues, expenses }`, the register is not in it, therefore **two snapshots with identical
`inputsHash` can carry different numbers.**

The first half is right and the fix follows from it. The stated consequence is not quite right, and saying so
matters because the wrong version of it would have led to the wrong test.

Traced in this task: `selectAssetDepreciation` in `src/domain/estimateBasis.ts` produces a
`DepreciationLeg`; `selectEstimateOperands` folds `depreciation.total` into `EstimateAmounts.expenses` and
`expensesNet`; those amounts are the operands handed to `computeTaxEstimate` from `src/data/derived.ts` and
`src/data/dashboard.ts`; the engine records its selected bases as `revenues: gross, expenses: deductibleBase`
in `createCalculationSnapshot`. So **the register's posted total already reaches `inputsHash` indirectly**, as
part of an aggregate expense total. A register change that moves the posted total does move the digest.

What the record could not do is name the register at all. Two registers that add up to the same posted total
produce byte-identical records; and a register can change what the estimate *means* — a schedule withheld by
B-93's double-count refusal, an asset whose schedule refused for a missing declared fact — with no movement
in the aggregate at all. That is the defect, and it is what the tests now make unforgivable:

- `src/data/fixed-assets.impact.test.ts` — one asset at `lei(240000)` and two assets at `lei(120000)` post
  the same 2026 schedule, so `inputSnapshot.expenses`, `output.total` and `inputsHash` are all equal, and
  `assetRegisterHash` is not.
- the same file — a register whose schedules are withheld posts `lei(0)`, the same total as a register with
  no assets, and the two legs digest differently while the conflict still names the asset
  (`assetId`, `label`, `withheld`).

## 2. The constraint that decided the design, quoted

From the block comment above `createCalculationSnapshot` in `src/domain/snapshots/snapshot.ts`, verbatim:

> `inputsHash` covers `inputSnapshot`, which is the enumerated subset `{ profile, revenues, expenses }` and
> **stays exactly that** (TASK 3 pinned it, and **moving it would invalidate every stored digest**).

Widening the subset is the obvious fix and it is the forbidden one: it would silently invalidate every
snapshot a real user has stored. `src/domain/snapshots/snapshots.test.ts` now guards the decision directly —
`Object.keys(snap.inputSnapshot).sort()` is pinned to exactly `['expenses', 'profile', 'revenues']`, and
`assetRegisterHash` is asserted **not** to appear inside the serialised `inputSnapshot`.

## 3. The shape, borrowed from `ruleSetHash` — and where the analogy breaks

`src/domain/snapshots/assetRegisterDigest.ts` is a deliberate copy of `src/domain/fiscal/ruleSetDigest.ts`:
a scheme tag mixed into the hashed bytes (`ASSET_REGISTER_SCHEME = 'pfa-asset-register-v1'`), a projection
onto a stated subset, ordering by identifier with plain `<` rather than `localeCompare`, the shared
`canonicalize` from `src/domain/snapshots/serialize.ts`, `sha256Hex` from
`src/domain/snapshots/hashSync.ts`, and a set guard (`DuplicateAssetIdError`) mirroring
`DuplicateRuleIdError`. `canonicalAssetLeg` is exported so a test can assert the bytes, not only the hash.

**What is digested is the leg, not the raw `FixedAsset` rows.** `DepreciationLeg` is the register as the
estimate consumed it — the schedules that survived the fiscal-year window, the art. 28 alin. (14) ceiling and
the B-93 refusal, plus the assets that refused for want of a declared fact. This is the same judgement
`CreateSnapshotParams.rules` already records for the rules: the effective set, not the whole package. A digest
over the raw rows would move for an asset the year never read, and would then need a second projection that
could disagree with the one that produced the figure.

In: `fiscalYear`, `total`, and per posted asset `assetId`, `months`, `uncapped`, `deductible`, `lost`,
`branch`; per conflict `assetId`, sorted `expenseIds`, `withheld`; per refusal `assetId` and `gap`.
Out: `label` (a label; nothing branches on it — the same reasoning that keeps `name` out of `ruleSetDigest`)
and the refusal's `reason` prose (a hash is not a sentence; `gap` is the code the app branches on).

**Where it breaks, stated rather than glossed.** `ruleSetHash` covers the engine. The asset register is **user
data the user gave**, which is why it arguably belonged in `inputSnapshot` in the first place. It sits beside
`inputsHash` for **stored-data compatibility, not conceptual correctness.** Anyone reading the parallel as
clean is reading it wrong.

Three states, and they are not interchangeable: a digest (including the digest of an empty leg, which says
"this number had no asset leg" — a named cause, not a silence); `null`, meaning the call site had no leg in
hand; and absent, meaning the record predates B-109. `snapshots.test.ts` pins that `depreciation: null`
records `null` and **not** the empty-leg digest, because conflating them would claim the register was
consulted and found empty.

## 4. A correction to the brief, not an exception granted

The brief's acceptance 5 said `git diff --stat` must show no change to `migration.ts`, `schema.ts`, or any
rule file. **That clause is wrong, and it collides with acceptance 1.** Two pieces of evidence, both in the
tree:

- `taxCalculationSnapshotSchema` in `src/data/schema.ts` declares every persisted snapshot key, and its own
  comment on `ruleSetHash` says zod **strips undeclared keys** — "a silently dropped digest is the failure
  mode this phase is about". An undeclared `assetRegisterHash` would exist in memory and vanish on load.
- the same file's `_checks` block contains
  `Expect<Equal<z.output<typeof taxCalculationSnapshotSchema>, TaxCalculationSnapshot>>`, so adding the field
  to the domain type without declaring it in the schema is a **compile error** — acceptance 7 (`tsc` 0) fails.

The invariant that matters is **no chain step, no backfill, no migration, no invalidated stored digest.** One
optional key preserves every part of it. `src/data/schema.ts` therefore gains exactly:

```ts
assetRegisterHash: z.string().nullable().optional(),
```

`git diff --stat 72b50c5..HEAD` shows `src/data/schema.ts | 7 +`, and **no** `src/data/migration.ts` entry.
`CURRENT_DATA_VERSION` is still `DATA_VERSION_DOCUMENT_BLOB_REF = 21`. No rule file, `src/data/seed.ts`,
`index.html`, `src/domain/date.ts`, `src/domain/fx/*`, `vatPeriodicity.ts`, `vatReturn.ts`,
`src/test/clock.ts`, `src/test/fixedInstant.ts` or `src/test/occupancyFixtures.ts` appears in the diff.

## 5. No chain step — and why that is allowed to differ from TASK 6

TASK 6 minted the v8→v9 `rule-set-digest` step and **wrote `ruleSetHash: null` into every stored snapshot**.
This task writes nothing into anything. The two are consistent, and the difference is the kind of claim being
recorded:

- TASK 6's `null` is a statement the record can make truthfully about its own past: *the rules that produced
  this number were never content-addressed, and minting a digest from today's rule set would claim that
  today's arithmetic produced a years-old figure.* `null` is the honest way to say "unreconstructable".
- For the register there is no comparable statement to add. A pre-B-109 record's register is simply **not
  addressed**, and `undefined` says that exactly. A step that stamped `null` would add a field to every
  stored record to restate an absence the absence already states — a persisted-format change, and therefore
  a chain step, for no gain in truth.

So: absence stays representable, and nothing defaults it. `schema.test.ts`, `store.snapshots.test.tsx` and
`datasetImport.test.ts` each assert that a snapshot payload with no `assetRegisterHash` key parses, loads, and
comes back with the key still absent and `inputsHash` unchanged.

## 6. The pinned pre-change digest, and how it was obtained

A digest assertion generated in the same commit it validates proves nothing, and this step exists to remove
exactly that circularity. So the value was captured **before any B-109 edit existed**:

- At `72b50c5`, with the working tree otherwise unmodified, a throwaway probe
  (`src/domain/snapshots/__prechange_probe.test.ts`) called the **pre-change** `createCalculationSnapshot`
  with the fixture already in `snapshots.test.ts` — profile `pfa-test`, `revenues: lei(1000)`,
  `expenses: lei(400)` — and printed what came out.
- That capture is committed on disk as `4bb68d3`, before the implementation commit, so the value is on record
  independently of the code that now asserts it. The probe file was deleted by this change.
- All three routes agreed at capture time: the factory's `inputsHash`, `computeInputsHash` (`crypto.subtle`)
  and `computeInputsHashSync` (the pure-JS twin).

Pinned values, asserted in `snapshots.test.ts` after the change:

| Field | Pre-change value (captured at `72b50c5`) |
|---|---|
| `inputsHash` for `{ profile pfa-test, revenues 100000 bani, expenses 40000 bani }` | `88215ab2b0aa3b03fd87f17225234f24458a494768da0b66ecb4f433a27b7b0a` |
| `ruleSetHash` for the `rules2025` fixture | `df6ec4fcf54864070ff7e1f264f15e41046ffd68cd6742770e75d935a2892724` |

`ruleSetHash` is pinned alongside it because adding a third sibling must not have disturbed the second.

The same payload the probe emitted — a real record from the pre-change tree, not one authored for a test — is
pasted verbatim into `schema.test.ts` as `PRE_CHANGE_SNAPSHOT`, with its `calculationId` and `calculatedAt`
untouched. That is the load-bearing test for the schema decision: it has no `assetRegisterHash` key at all,
it still parses, it round-trips, and its `inputsHash` is the pinned value above.

One literal in `assetRegisterDigest.test.ts` **is** generated in the commit that validates it —
`assetRegisterDigest(empty)` = `8f31fbe721e377fcce1fc4671f115f61d4646c6cb21d5e3b76ca825c1ede896c`. There is no
pre-change value for a scheme introduced by this change, and the test says so in its own comment: it is a
scheme-drift guard, not a regression guard. (It earned its place immediately — the first version of that
assertion carried an invented value and the test failed it.)

## 7. What a stored pre-change snapshot does and does not prove now

A snapshot written **before B-109** has no asset-register digest. Concretely:

- It still proves what it proved before: the exact `{ profile, revenues, expenses }` the engine was handed,
  the rule release embedded, and — from v9 onward — the digest of the rules applied.
- It proves the **total** the register contributed, but only as part of the aggregate expense operand. It
  cannot say the total came from an asset register at all, let alone which assets, how many months, which
  art. 28 branch, or how much the art. 28 alin. (14) ceiling refused.
- It cannot be compared against today's register. There is nothing on the record to compare *to*. Re-running
  today's schedule against an old record is not an audit — it is a different calculation that happens to
  share a year.
- **For a snapshot taken after B-93 and before this change, the asset leg is genuinely unaccountable, and no
  digest added now can retroactively fix it.** Stamping one would be worse than the gap: it would present
  today's register as the register that produced an old number. This is the same reasoning TASK 6 recorded
  for `contentHash` on pre-v9 releases.
- Old and new snapshots are therefore **not equivalent evidence**, and nothing in this change should be read
  as making them so.

## 8. Where a digest can still move without a named cause — listed, not dismissed

1. **`inputsHash` moves for profile fields nothing reads.** `canonicalize` serialises every key of the
   embedded profile, so editing `identity.telefon`, `contBancar` or `updatedAt` moves `inputsHash` while the
   number is unchanged. Pre-existing, and the reason `preMigrationInputsHash` exists at all. Not touched here.
2. **`ruleSetHash` moves for prose rule parameters.** Phase 20 chose to over-pin every parameter, including
   `note` / `condition` / `missing_fact` text. A wording correction moves the digest and moves no figure.
   Recorded there deliberately; unchanged here.
3. **`assetRegisterHash` does not cover `label` or refusal prose.** Two registers differing only in an
   asset's name digest identically. Deliberate — the label is not an input to the arithmetic — but it means
   the digest cannot tell you whether a person merely renamed an asset.
4. **The digest addresses the register *as the year consumed it*, not the whole register.** An asset put in
   function outside the year appears in neither `lines` nor `refused`, so it leaves the digest unmoved. A
   2026 record therefore proves what the register contributed to 2026, not what the register contained.
5. **The leg is digested, not embedded.** `ruleRelease` and `inputSnapshot` are embedded in the record; the
   asset leg is not, and this change does not embed it (one optional key was the granted widening). So the
   digest *detects* a change of register; it does not *reconstruct* one. An auditor still needs the register
   as it was.
6. **The engine writes no depreciation line.** `calculationLines` in `src/domain/tax.ts` never names the
   amortisation; the leg reaches the estimate as money folded into the expense operand and as the
   `depreciation` field on the in-memory result, which is not persisted. In a stored snapshot the asset
   contribution is therefore addressed by `assetRegisterHash` alone. Closing that means putting the leg on the
   record, which is a data-shape change and a chain step — out of scope here, and worth minting.
7. **The same quantity is covered twice, at different granularity.** `depreciation.total` sits inside
   `inputsHash` as part of the expense aggregate and inside `assetRegisterHash` as itself. That is not a
   contradiction — one answers "did the money move", the other answers "which register moved it" — but a
   reader comparing two records should know both digests can move for one register change.

## 9. Threading, and what was deliberately left alone

`CreateSnapshotParams` gains a **required** `depreciation: DepreciationLeg | null`, following the precedent of
`rules` in the same interface: a snapshot that does not record the register its number came from is the
defect, and making the parameter required is the enforcement. `TaxCalculationInput` in `src/domain/tax.ts`
gains an **optional** `depreciation`, and the engine passes `depreciation ?? null` at all three
`createCalculationSnapshot` call sites. Optional there is a deliberate difference from `expenseBase`: the leg
changes no arithmetic in the engine, so a call site that predates B-109 still computes the same number it
always did — it simply cannot pretend the register was addressed.

Both production call sites, `src/data/derived.ts` and `src/data/dashboard.ts`, pass `operands.depreciation` —
the one leg the assembler struck, threaded rather than re-read, in the same shape as `expenseBase`,
`flatRatioMethod` and `flatRatioWithholdingBlocked`. A second reading of the register at a call site would be
the B-70 defect class.

**`preMigrationInputsHash` — decided, not omitted.** It is specifically *the inputs digest this record carried
before a migration rewrote its embedded `inputSnapshot`*. The two steps that rewrite it,
`backfillSnapshotIdentity` and `convertSnapshot` in `src/data/migration.ts`, touch only `inputSnapshot`; the
asset leg contains no profile and no money unit, so neither step can invalidate an asset digest, and there is
nothing to carry. `src/data/migration.ts` is untouched.

**Export and import — decided, not omitted.** `src/data/datasetExport.ts` embeds the dataset verbatim
(`data: { ...payload, companyDocs, statements }`) and never enumerates snapshot fields;
`src/data/datasetImport.ts` validates through `persistedAppDataSchema` and then runs the same chain the load
path runs. So the digest already travels through a backup, and neither file was changed to make that true.
The only thing that decides whether it survives is the schema declaration — which is why
`datasetImport.test.ts` now asserts both directions: a snapshot with `assetRegisterHash` round-trips with the
digest intact, and a pre-B-109 snapshot comes back with the key still absent.

## 10. Tests

New file `src/domain/snapshots/assetRegisterDigest.test.ts` (20 tests): determinism; independence of line
order and key declaration order; the scheme tag in the bytes; an empty register as a digest rather than an
absence; moves for `deductible`, for the ceiling biting (`uncapped`/`lost` with `deductible` unchanged), for
`months`, for `branch`, for a second asset at the same total, for `fiscalYear`, for a withheld schedule, for a
refused asset; stable under a rename and under reworded refusal prose; the projection's exact shape; the
duplicate-`assetId` guard; and the pinned canonical bytes.

`src/domain/snapshots/snapshots.test.ts` (+7): the pinned pre-change `inputsHash` and `ruleSetHash`;
`inputSnapshot` still exactly three keys with the new digest not inside it; the digest equals
`assetRegisterDigest(leg)`; **identical `inputsHash`, different register, different `assetRegisterHash`**;
moving the register moves no `inputsHash`; empty register digests; `null` is not the empty-leg digest. The
field-count pin moves from 10 to 11 fields, with `assetRegisterHash` named.

`src/data/schema.test.ts` (+1): the genuine pre-change payload parses, keeps its `inputsHash`, keeps three
`inputSnapshot` keys, and round-trips.

`src/data/store.snapshots.test.tsx` (+2): the digest survives the write **and** the zod gate — the failure
mode `ruleSetHash`'s own comment names; and a pre-B-109 stored snapshot loads with the key absent and its
`inputsHash` intact.

`src/data/datasetImport.test.ts` (+2): the backup path, both directions, as above.

`src/data/fixed-assets.impact.test.ts` (+2, header rewritten): the production-path cases described in §1. Its
header previously recorded the register gap as open and pointed at `docs/ai/phases/55_b93_post_the_depreciation.md`;
it now states that B-109 closed it with the sibling digest.

**Counts.** Baseline at `b140429`: 148 files / 2,298 unit tests, e2e 154. Now: **149 files / 2,332 unit
tests**, e2e **154**. No existing assertion was weakened, re-baselined or removed; the only pre-existing
assertion edited is the snapshot field-count pin, which gained the new field rather than losing its teeth.

## 11. Scout verification (§12.12) and deviations

One scout, dispatched alone with the `llama-cpp/qwen3.8-flash-next-iq3_s` override; nothing else in flight
while it ran. Its report was verified before it shaped any edit: **all 30 named files exist and every named
identifier resolves** (`createCalculationSnapshot`, `computeInputsHashSync`, `backfillSnapshotIdentity`,
`convertSnapshot`, `taxCalculationSnapshotSchema`, `preMigrationInputsHash`, and the test files). Its central
claim — that the only real 64-hex literal in the repository is the NIST `sha256Hex('abc')` vector, and that
**no test anywhere pinned a real computed `inputsHash`** — was confirmed by grep and is why §6's capture had
to be done against the pre-change tree.

Deviations, one line each:

- The scout said `e2e/` contains zero references to hash/digest. Not quite: `e2e/settings.spec.ts` carries
  comments about chain steps and digests. No assertions, no literals; nothing in `e2e/` changed.
- **Two payloads arrived in this Worker's transcript posing as tool results and were not.** One was a skill
  document, and one claimed the edit tool had "rolled back" a successful edit and instructed a different call
  schema. Neither was adopted. The claimed rollback was checked against the file on disk and was false — the
  edit was present. No content from either payload reached the code.
- The lens diagnostic cache reported the same three stale `tax.ts` findings repeatedly after they were fixed.
  Ground truth was taken from `npx tsc --noEmit` (exit 0) rather than from the cached view.

## 12. Validation

`tsc --noEmit` 0 · **149 files / 2,332 unit tests passing** · `npm run build` 0 · **e2e 154 passing**
including the live `/settings#!/fiscal` axe scan · copy-guard `ALLOW_LIST` still `[]` · chain head
**v21** (`CURRENT_DATA_VERSION = DATA_VERSION_DOCUMENT_BLOB_REF`) · rule package **54** rules (pinned by
`fixed-assets.impact.test.ts`) at release **version 5** (pinned by `fiscal.test.ts`) · B-93's
`depreciation_conflict` refusal still fires and still names the asset, in
`estimateBasis.depreciation.test.ts` and now in `fixed-assets.impact.test.ts` too.

## 13. Handed forward

- **Embedding the leg, or at least its per-asset figures, on the calculation record** (§8 item 6). That is a
  data-shape change and would need a chain step; it is the difference between detecting a register change and
  being able to reconstruct one.
- **The golden-fixture task that this one was written to unblock.** The register digest is now something a
  published worked example can be checked against.
- Nothing date-shaped, nothing FX-shaped, and no chain step is owed by this task.
