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

**Neither gate may be a bare foreground command — a multi-minute foreground call kills your own connection.** Run each in the background to a log, then read the log once:

```
npx vitest run --pool=threads --poolOptions.threads.maxThreads=2 > /tmp/unit.log 2>&1 &
tail -n 30 /tmp/unit.log
```

Same shape for `npx playwright test --workers=2 > /tmp/e2e.log 2>&1 &`. **One gate at a time.** If the log is incomplete, wait once and re-read — never re-run the suite, never start the second gate while the first is writing.

**§12.18 — search `docs/ai/research/` before you re-derive a fact.** Cite the file; do not re-litigate a settled correction.

**§12.19 — when you close a register row, rewrite its first sentence.** A refuted claim left as the headline booby-traps the next briefing pass.

---

# Brief 76 — the migration chain moves off v21: four persisted facts, decided together

**B-140, B-108, B-145, and the `FixedAsset.disposalProceeds` blocker from brief 74.**

**This is the brief that breaks the chain head away from v21. It has been held open deliberately while four other briefs ran, so that the chain steps could be decided once, with all of them in view.** Read the whole brief before writing any migration step: **the order of the steps is itself a decision, and a wrong order is a data-loss.**

---

## 0. The rule that governs everything here

The migration chain is append-only. **You may add steps after v21. You may not renumber, reorder or rewrite an existing step** — a shipped step records what past installs already ran, and brief 67 established this when it refused to insert a step before v11 for exactly that reason.

**Read-wide, write-narrow (§0 of the plan).** A field may be *read* from stored data more widely than the app will *write* it. Deleting a value from the read vocabulary turns „a record nobody can make any more" into „a payload we refuse to open". **That is the failure mode to avoid in this brief more than any other.**

---

## 1. B-140 — the e-Factura deadline that is wrong on screen

**Decision already taken — D-EFACT-1: it is 5 working days, and no Researcher pass is needed.** `src/ui/copy/settings.ts:78` offers *„În decurs de 2 zile de la emitere"* while the app's own cited source says **5 working days** — OUG 120/2021 art. 10 alin. (7) as amended by OUG 89/2025. **The app contradicts itself about a legal deadline.**

**Why it is in this brief and not a copy fix:** the option is backed by a **stored enum value** (`'2-zile'`). Correcting it moves persisted data.

**Retire or remap the value with a recorded reason. Do not silently re-point the label** — a user who chose „2 zile" chose something specific, and the migration should say what happened to that choice. **A step that quietly rewrites a user's stored selection is indistinguishable from the app having never asked.**

---

## 2. B-108 — `Expense.assetId`

`Expense` carries `vehicleId` but no `assetId`, so a depreciation conflict can only be detected register-wide, never per asset. **The consequence today is that one hand-typed expense can withhold depreciation schedules from unrelated assets — the refusal is broader than the truth.**

Matching a hand-recorded expense to an asset by amount or date was **rejected as an inference art. 68 alin. (4) lit. d) does not license.** That rejection stands.

**So the step must add the field and fill in nothing.** A person links the expense; until they do, the conflict stays register-wide and says so. **Do not guess links. Do not backfill by amount or date.** If the app can narrow a link from a fact the person already stated — not inferred — say which fact and report it; otherwise leave it empty.

---

## 3. B-145 — a carried-in fiscal loss the engine can use and no screen can collect

Brief 70 built `priorYearLosses` at the `computeTaxEstimate` boundary and asserted it twelve ways. It is **in-memory only**, so the app can compute the relief and cannot be told about the loss.

**Art. 118 alin. (4)–(5), as `research/52` settled it:** **5 ani fiscali**, **70 % of the net of that same source**, **per source**, **chronologically by age**, **not elective**. D212 rd.5 asks for **one total with no per-year column.**

**That last fact is the design tension and you must not resolve it silently.** A persisted per-year list lets the app age losses correctly; the return does not carry that data, so **the app cannot verify a taxpayer's split either way.** Brief 70 chose: accept optional per-year entries, apply the window to each, and let a caller holding only the aggregate pass one entry with the oldest year it can stand behind.

**Decide what the screen collects, and state plainly what the app then cannot check.** A field that implies more precision than the source document carries is a honesty problem, not a completeness win.

---

## 4. `FixedAsset.disposalProceeds` — the field brief 74 stopped for

Titlul IV norm **pct. 7 alin. (5) lit. o)** caps the same residual a second time at *„nivelul venitului realizat din înstrăinare"*. **Nothing in the app holds the proceeds**, so posting pct. 27's figure would **over-deduct whenever an asset sold below its unamortised value.**

Brief 74 implemented the pct. 27 **cap** and surfaced it as a coverage row, and deliberately **did not post it.** That is the correct half-done state and it is waiting on this field.

**Also still open from brief 74: B-153** — the schedule keeps amortising past the disposal month while `disposalFigure` counts only the months used. **Two halves of one rule, two month counts.** Truncating the schedule changes a posted figure and interacts with the last-year-takes-the-remainder rule. **If you add `disposalProceeds` without settling B-153, say explicitly that the two month counts still disagree** — do not let the new field imply the schedule is right.

---

## 5. What is deliberately NOT here

- **The DPI typed-net retirement.** D-DPI-1 chose to retire it, **but B-152 blocks it:** the computed path feeds the CAS cumul and the art. 151 alin. (6) withholding source and **does not feed the art. 170 alin. (4) CASS ladder**, because `calcCassLadder` refuses a partial six-category answer set and one computed DPI amount cannot answer the other five. **Inventing five zeros is exactly what that refusal exists to prevent.** Retiring the typed net now would strand precisely the taxpayers it was meant to protect. **Do not retire it. Do not build a partial ladder.** This needs an orchestrator/user decision first.
- **art. 28 alin. (12) lit. i1), the 50 % head-office depreciation cap.** §12.18 caught this: `research/38` records that **`lit. i1)` and `sediu social` both score 0 hits in 624 pages of norms.** **The corpus does not support the rule.** That is a Researcher task, not a Worker guess. **Do not encode it.**
- **Any change to an existing migration step.** Append only.

---

## 6. Boundaries

- **Chain head is v21 today.** Every step you add must be justified by one of the four items above — not by convenience.
- **The 311.200-lei seed pin at `src/data/seed.identityHygiene.test.ts:339` and every persona hero must not move** unless a step genuinely changes a computed figure, in which case report old → new → reason **before** re-pinning.
- **Do not touch `src/domain/fx/**`, `caen_rev3.csv`, or the rule package's digests.**
- **A migration step must be tested against a real pre-step payload**, not only against the current schema: load an older payload, run the chain, assert what was kept, what was added, and that nothing else was lost. Brief 67's `stored-status.transmisa.test.ts` is the house pattern to copy.
- **A step that drops data must say so in the register and in the test.** Brief 67's finding — that a v22 step would have run *after* the data holding the value was gone — is the kind of thing that only a test catches.

---

## 7. Acceptance criteria

1. `npx tsc --noEmit` → 0. `npm run build` → 0. Both capped gates → all pass, **once each, backgrounded to a log**.
2. **The new chain head is stated**, with one step per persisted change and a written reason for the ordering.
3. **B-140:** the stored `'2-zile'` value is retired or remapped with a recorded reason; a pre-migration payload carrying it still opens; the on-screen contradiction is gone.
4. **B-108:** `assetId` exists, is **not backfilled**, and a linked expense narrows the conflict detection while an unlinked one still says it is register-wide.
5. **B-145:** a screen collects a carried-in loss, and the copy states what the app cannot verify about it.
6. **`disposalProceeds` exists and pct. 27 is now posted correctly** — or a reported reason it is still not posted.
7. **Every step has a test against a real pre-step payload.**
8. **B-153's status stated**: does the schedule still amortise past disposal?
9. Report **newly measured** unit and e2e counts.

---

## 8. If this is too much for one pass

**Stop and report rather than doing half of it quietly.** A partially-applied migration is the worst state this tree can be in: worse than v21, because the schema has moved and the data has not. **Land complete steps or none.**
