## GLOBAL CONTRACT — APPLY TO EVERY PROMPT

You are the LEAD ORCHESTRATOR for this step only.

The project AI ecosystem is:
- SCOUT = local repository inspection only; read-only; NEVER modifies files
- RESEARCHER = internet research only; primary/official sources only
- WORKER = implementation, focused testing, documentation, self-validation
- ORCHESTRATOR = coordination, sequencing, synthesis, handoff

Worker rules
1. Never run more than ONE Worker at a time. Workers are sequential.
2. The Orchestrator spawns the Worker and MUST give it the complete phase list, not a partial one.
3. The Worker MUST spawn the Scouts it needs before modifying anything, and MUST use their reports rather than broadly searching the repository itself.
4. **OVERRIDE — Scouts run SEQUENTIALLY.** One at a time, waiting for each report. Standing user decision (2026-10-10).
5. Each Scout inspects the smallest relevant territory and returns a compact report.
6. If the Worker finds missing local information, it spawns another narrow Scout — it does not search broadly.
6a. **UNDER NO CIRCUMSTANCES does the Worker do any work while a Scout is running.** Dispatch → **stop** → receive → read only the files you will edit → edit.
7. One Worker = one coherent, tightly scoped job.
8. Do NOT spawn a post-Worker Scout verification pass. The Worker self-validates instead.
9. Self-validate: npx tsc --noEmit, npm run build, the two capped suite commands in §12.17.
10. Do not start future phases. Stop when this phase's acceptance criteria are met.

**Scout infrastructure — known defect.** Use the explicit override `llama-cpp/qwen3.8-flash-next-iq3_s` from the start. If it fails, STOP and report a BLOCKER.

**Engine instability — known.** 262k context, ~390 MiB free, one slot, SIGKILLed under load. On-disk work survives; resume and continue. Checkpoint early and often.

Worker handoff format (mandatory)
```
COMPLETED:
FILES CHANGED:
TESTS:
VALIDATION:
DECISIONS:
BLOCKERS:
NEXT HANDOFF:
```

**§12.17 — the commands are mandatory, not the intention.** During development use `npx vitest run <path>` and `npx playwright test <spec>`. **Never `npm run test` as an iteration loop.** The full-suite gate is exactly these two commands, **once each, never concurrently**:

```
npx vitest run --pool=threads --poolOptions.threads.maxThreads=2
npx playwright test --workers=2
```

`npm run test` and `npm run test:e2e` use the default full-parallel pool and exhaust the user's machine. Slower is the point.

**Neither gate may be a bare foreground command — a multi-minute foreground call kills your own connection, and a Worker was lost to `Connection error` twice on exactly this.** Run each in the background to a log, then read the log once:

```
npx vitest run --pool=threads --poolOptions.threads.maxThreads=2 > /tmp/unit.log 2>&1 &
tail -n 30 /tmp/unit.log
```

Same shape for `npx playwright test --workers=2 > /tmp/e2e.log 2>&1 &`. **One gate at a time.** If the log is incomplete, wait once and re-read — never re-run the suite, never start the second gate while the first is writing.

---

# Brief 71 — DPI income: one defect you fix, one fork you report and do **not** decide

**B-117 is yours to fix. B-116 is yours to investigate and report — the decision is the user's (D-DPI-1 in `docs/ai/USER_DECISIONS.md`).**

**This is a deliberately asymmetric brief.** Most of this plan asks you to implement. Here, half the job is to produce a decision the user can make. **A handoff that quietly picks a winner is a failed handoff**, even if the pick is good.

---

## B-116 — the app holds DPI income two ways, and only one can survive

| | Representation | Where it came from |
|---|---|---|
| **(1)** | Hand-typed `CassLadderYear.proprietateIntelectuala` **net**, entered on Settings | Pre-B-112; currently the **only** way a user can report DPI CASS at all |
| **(2)** | Recorded DPI documents → gross → 40 % quota → net | B-112 |

**B-112 stage 1 implemented a REFUSAL when both are present for the same year — not a precedence** — following the `depreciation_conflict` precedent: no summing, no silently-larger, no quiet preference. That refusal is correct behaviour under an unresolved fork and is **not** something to fix here.

**The register already records the intent:** retire the hand-typed ladder DPI net **once records can compute it — not before**, because removing it first would leave users unable to report DPI CASS at all.

### What to report

For **each** representation:

1. **What it can express that the other cannot.** A hand-typed net can carry a figure the app cannot derive — a different quota, a split, an amount from a year the app has no documents for. Records can carry provenance, per-document dates, and the coverage surface. **Say which of these actually matters here, not which sounds better.**
2. **What retiring it costs.** Retiring the hand-typed net is a **data-shape decision and may owe a chain step** off v21. Retiring records means deleting documents a person entered. Enumerate the persisted keys, the migrations, and the tests that would have to move.
3. **Which is closer to the statute.** Art. 154 alin. (1) lit. h) / art. 170 alin. (4) compute CASS on income **after the deductible quota** — the quota is a statutory percentage of gross, not a number the taxpayer types. **If one representation encodes the quota and the other lets a person override it, say so plainly**, because that is the strongest single argument in the comparison.
4. **What the user would lose in the UI** under each retirement. A person with DPI income and no recorded documents is not hypothetical.

**Do not implement either retirement. Do not build a precedence rule. Do not "temporarily" prefer one.** The refusal stays exactly as it is until the user decides.

---

## B-117 — an art. 67 record carrying a DPI contract type produces no coverage row

The contradiction is **named** by `dpiRecordConflict` and the form refuses to store the pair, but `dpiCoverageGaps` walks only DPI ids, so the contradiction is **invisible to the coverage surface**. Catching it would need a second register walk.

**Severity is low — the form already blocks the pair.** The defect is that the coverage surface is silent about a stored contradiction. **A contradiction that can only exist in imported or hand-edited data is still a contradiction the person should be told about.**

**Fix it inside whichever representation currently serves it** — do not wait for B-116. The fork must not block the smaller defect.

**Watch for the B-143 lesson:** a coverage row with no producer is how `not_submitted` ended up dead-but-test-pinned. **Before you add a path that emits a new coverage row, confirm a live fact can actually produce it**, and pin that.

---

## Boundaries

- **No persisted-shape changes. No migration chain step.** If B-117 genuinely needs one, **stop and report** — that is a chain decision.
- **Do not touch the B-112 stage-1 refusal.** It is the honest state of an unresolved fork.
- **Persona figures are not yours to edit.** Report any movement with old → new → reason.
- The 311.200-lei seed pin at `src/data/seed.identityHygiene.test.ts:339`: if it moves, report before touching.
- **Do not touch B-145 or B-146** — both are minted and queued, and B-145 in particular is a chain step that must not be smuggled in here.
- No `caen_rev3.csv`, no CAEN ingest, no `src/domain/fx/**`.

---

## Acceptance criteria

1. `npx tsc --noEmit` → 0. `npm run build` → 0. Both capped gates → all pass, **once each, backgrounded to a log**.
2. **B-117:** an art. 67 record carrying a DPI contract type produces a coverage row, and a test proves it. Confirm and pin that a live fact can produce the case.
3. **B-116:** a written comparison covering all four points above, **with a recommendation clearly labelled as a recommendation**, and **no code change made in service of it**.
4. **The B-112 refusal still behaves identically** — say so explicitly.
5. Report **newly measured** unit and e2e counts.

---

## What a good handoff looks like here

The user should be able to read your `DECISIONS:` section and answer *"retire the typed net"* or *"retire the records"* **without having to investigate anything themselves.** If they would have to open a file to choose, the report is incomplete.
