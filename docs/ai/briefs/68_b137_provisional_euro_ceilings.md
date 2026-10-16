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
4. **OVERRIDE — Scouts run SEQUENTIALLY.** One at a time, waiting for each report. Standing user decision (2026-10-10); the roadmap's parallel-Scout permission is not adopted.
5. Each Scout inspects the smallest relevant territory and returns a compact report.
6. If the Worker finds missing local information, it spawns another narrow Scout — it does not search broadly.
6a. **UNDER NO CIRCUMSTANCES does the Worker do any work while a Scout is running.** After dispatching a Scout, **stop and end the turn.** No side-quests, no "meanwhile I'll read this", no drafting, no edits, no repository searching while waiting. Strict sequence: **dispatch one Scout → stop → receive report → read only the files you will actually edit → edit → dispatch the next Scout if needed → stop → …** If work was already started in parallel with a Scout, stop, discard that parallel searching, and wait. The failure mode this prevents: the Scout's report arrives after the Worker has already searched the repository itself, which wastes the Scout, burns the Worker's context, and defeats §12.9 entirely.
7. One Worker = one coherent, tightly scoped job.
8. Do NOT spawn a post-Worker Scout verification pass. The Worker self-validates instead.
9. Self-validate: npx tsc --noEmit, npm run build, npm run test, npm run test:e2e.
10. Do not start future phases. Stop when this phase's acceptance criteria are met.

**Scout infrastructure — known defect.** The scout profile's default model produces no output. **Use the explicit override `llama-cpp/qwen3.8-flash-next-iq3_s` from the start.** If it fails too, STOP and report a BLOCKER.

**Engine instability — known.** 262k context, ~390 MiB free, one slot, SIGKILLed under load. If killed, **on-disk work survives** — resume and continue. Checkpoint early and often.

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

---

# Brief 68 — B-137: a euro ceiling that refuses to strike in the year the user is actually in

**Defect: B-137. Decision already made — D-FX-6 in `docs/ai/USER_DECISIONS.md`. You are implementing a settled decision, not reopening it.**

**You are the only Worker running, and this is the only brief permitted inside `src/domain/fx/**`.**

---

## 1. The problem, in one paragraph

Art. 68 alin. (5) states its deductibility ceilings **in euro**. `CAP_CEILING_BASIS = 'payment_year_annual_average'` converts them at the BNR annual average of the payment year (HG 1/2016 Titlul IV, Cap. II, Secț. a 2-a, pct. 7 alin. (6)). **BNR publishes that series (`CURSA_EURM`) only after the year closes** — there is no 2026 value. So for the current year the app refuses: persona 11's 400-euro private-pension ceiling reports `cap_unresolved` instead of a number, and every other euro ceiling in FY2026 does the same.

The rival reading — CF art. 9 alin. (3) lit. b) + alin. (4), the **daily rate on the payment date** — is already computed and reported alongside as `CAP_CEILING_ALTERNATIVE_BASIS` / `capCeilingAtPaymentDate()`. **That stays as it is.**

---

## 2. What D-FX-6 decided

**The annual average stays the single primary basis.** For a year whose average is not yet published, the app uses the **existing provisional → final lifecycle** rather than refusing, and rather than presenting two rival readings for the user to choose between.

**The hard constraint, and it is the trap in this brief:** the app must **never compute the annual average from daily rates.** BNR's own stated method is the arithmetic mean of the twelve **monthly** averages; a mean of daily rates is a different number. `capCeiling.ts` already refuses this and `research/23` §Q2 records why. **A provisional annual average is entered by a person, or obtained as BNR's own figure — never derived.** `provider.ts` already treats a human copying the printed figure as the normal route for `annual_average`. Do not weaken that refusal. If anything, strengthen it and pin it.

---

## 3. The information note — required by the user, part of the decision, not polish

Wherever a provisional ceiling figure appears, a visible note in plain Romanian must answer **all five**:

1. the ceiling is stated in **euro**, and the app had to turn it into lei;
2. the rule used is the **BNR average for the year of payment**, and **BNR publishes that only after the year closes**, so for an open year the figure is **`provizoriu`**;
3. **a second rule in force names a different rate** — the daily rate on the payment date, CF art. 9 alin. (3) lit. b) + alin. (4) — and no primary text reconciles them; the app applies one and says so rather than hiding the other;
4. the figure **is replaced once BNR publishes**, and the return for that year is filed **after** publication, so a provisional number never reaches ANAF;
5. **where the number came from** — who entered it and when.

**Point 4 is what makes this low-risk, and it belongs next to the badge:** the FY2026 return is filed in 2027, after BNR publishes the 2026 average. A provisional figure is a **planning aid during the year**, not what reaches ANAF. Say that, because it is the difference between alarming a user and informing one.

**The note is not a tooltip for a lawyer.** It must be readable by someone who has never heard of pct. 7 alin. (6).

---

## 4. Persona 11's refusal stays legible

Persona 11's ten contribution rows are currently `cap_unresolved`, and that refusal is **good evidence** — the Worker who wrote it refused to deduct at a guessed rate and refused to silently zero it.

**When those rows become strikable, they must say *why* they became strikable.** Do not let the honest refusal vanish into a green diff. If a row stays unresolved under some condition, keep the reason on screen.

---

## 5. Boundaries

- **`src/domain/fx/**` is yours for this brief.** Touch nothing there that changes conversion of *records* — this is about **ceiling** conversion.
- **No new legal claim.** Do not decide which of the two readings is right; D-FX-6 kept the annual average primary and kept the alternative visible. Do not add a third basis.
- **Do not invent a 2026 annual average, and do not derive one.** If the only way to produce a number is to compute it from dailies, **stop and report a BLOCKER** — that would be the exact thing BNR's methodology forbids.
- **The 311.200-lei seed pin at `src/data/seed.identityHygiene.test.ts:339` must not move.** If making euro ceilings strikable changes the seed estimate, **that is a finding, not a re-pin** — report it before touching the pin.
- No changes to `caen_rev3.csv`, the CAEN ingest, persona **figures**, or `src/data/migration*` unless a rate record genuinely needs a new persisted shape — and if it does, **stop and report first.**
- Do not touch **B-140** (e-Factura), **B-136** (PARKED), or Step 12.

---

## 6. Acceptance criteria

1. `npx tsc --noEmit` → 0. `npm run build` → 0. Both capped full-suite commands → all pass, **once each**.
2. **A euro ceiling in an open year produces a lei figure**, badged `provizoriu`, with provenance (who entered the rate, when).
3. **The five-point note renders** wherever that figure appears. Assert on the rendered text, not on a class name.
4. **A test proving the app refuses to derive an annual average from daily rates** — and that the refusal still exists after your change.
5. **A test proving the provisional figure is replaced when a final one arrives**, through the existing lifecycle, with the badge gone.
6. **Persona 11's contribution rows** either strike with a stated reason, or stay unresolved with their reason still on screen. Report which.
7. **The 311.200 pin is unchanged**, or its movement is reported as a finding before any re-pin.
8. Report **newly measured** unit and e2e counts.

---

## 7. Boundary list — a hypothesis, not a contract (§12.15)

Expected: `src/domain/fx/capCeiling.ts`, `rates.ts`, `provider.ts`, `convert.ts`, `src/ui/copy/**`, the ceiling-rendering components, persona 11's presentation (not its figures), plus tests.

**If the provisional → final lifecycle turns out not to support an *entered* annual average — e.g. it only handles fetched rates — report that rather than bolting on a second mechanism.** There is already one lifecycle; a parallel one is how this codebase acquires its next B-116.
