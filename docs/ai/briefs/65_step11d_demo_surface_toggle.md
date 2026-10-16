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

---

# Brief 65 — Step 11 / Part D: the demo surface, the demo ↔ real toggle, and three small honesty defects

**Defects closed:** **B-132** (personas have no surface in the app), **B-134** (no way to tell demo data from the user's own, and no way to switch), **B-111** (the CNP guard the persona identity test itself trusts implements the CUI rule), **B-74** (`thresholdLabel` falls back to a generic string), **B-55** (an internal identifier reaches a Romanian sentence).

**Size: medium. No arithmetic moves. If arithmetic moves, you have gone outside scope — stop and report.**

---

## 0. Read this first: the routing is already done. Do not rebuild it.

`routePersonaForCaen(cod)` in `src/data/personas/index.ts` already answers *"for a CAEN with no exact persona, give me the closest one"*. B-128 closed that on 2026-10-15 and B-131 closed the coverage gap behind it. Measured distribution across the 651 clase: **clasă 50 · grupă 50 · diviziune 132 · secțiune 379 routed, 40 unreachable** (611 routed).

It returns `{ cod, matchLevel, matchedOn, candidates, tie, reason }`. A code absent from the nomenclator gets `matchLevel: 'none'` and deliberately **no** sample. A tie returns **all** candidates with `tie: true` and the note *„…se afișează toate, nu se alege unul."*

**Your job is the half that does not exist: the screen.** Today no component or page imports `PERSONAS` or any routing function. Personas reach a browser only through `e2e/persona-harness.ts` writing into localStorage. A real user cannot pick a persona, cannot see which level matched, and cannot see the labelled sample.

---

## 1. B-132 — give the personas a surface

**The match level is the product, not decoration.** Part B shipped a **lineage walk**, not the affinity-table scoring brief 64 specified (see the note in `PHASE_PLAN_11_34.md` §11b, added 2026-10-15). The consequence: **379 of 611 routed clase match on bare secțiune ancestry** — the coarsest, weakest key, and the one B-136 proves is contested between two official sources.

Therefore:

- **A secțiune-level match must not look the same as a clasă-level match.** Different visual weight and different wording. *„persona demonstrativă recomandată"* for a clasă match; something honest like *„apropiată doar la nivel de secțiune"* for a secțiune match. Do not invent a confidence percentage — the app has no basis for one.
- **Render `matchedOn`** so the user can see *what* matched (a clasă code, a grupă, a diviziune, a secțiune letter).
- **Render ties as all candidates.** Never silently pick one. A person holding both 5520 and 6820 genuinely is both an accommodation host and a landlord.
- **Render the no-route reason verbatim** from `caenNoRouteReason` / the `reason` field. The 40 unreachable clase must say exactly why they are unreachable.
- **The labelled sample stays labelled.** `sample` is a different kind of object from `candidates`, not a fifth rung of the ladder — keep it that way.

**⛔ Where the badge must NOT go.** The only CAEN surface today is the user's own fiscal CAEN field in Settings. **A demo-persona badge there reads as a recommendation about their real activity.** The persona surface is its own place. Do not bolt it onto the Settings field.

**⛔ Not a persona gallery.** The user rejected a gallery as bloat. The routing decides which demo applies; the surface shows that decision and lets the user act on it. Fifteen browsable cards is out of scope.

---

## 2. B-134 — the demo ↔ real toggle

This is the missing half of the routing decision: **if the app sends a person to the closest demo persona, there must be an obvious way back to their own numbers.**

It is also an honesty requirement, not a convenience. A demo that renders identically to a real tax position is the same defect class as `engaged: true` sitting beside a measured 0 — that is B-129/B-130, already fixed, and the pattern is the standing warning of this project.

Requirements:

- **A visible, persistent control** that switches between the user's own data and a demo profile. Not a hidden flag, not a URL-only route, not localStorage-only.
- **While a demo is active, every screen showing demo-derived numbers must say so**, in a way a first-time user cannot miss. A badge in the shell is acceptable; a badge that scrolls out of view is not.
- **Switching must be reversible and lossless for the user's own data.** The user's records must never be overwritten, merged with, or shadowed by demo records. If the store cannot hold both without a data-shape change, **STOP and report a BLOCKER** — do not improvise a merge.
- **State must survive reload** and must be visible immediately after reload, so a user never mistakes a leftover demo for their own year.
- **Do not touch the migration chain** (`src/data/migrations*`). If the toggle needs a persisted field, it belongs in app state, not in a new `MigrationStep`, unless you stop and report first.

---

## 3. B-111 — the CNP guard is wrong, and the persona suite trusts it

`src/test/occupancyFixtures.ts:96` `cnpCheckDigitValid` computes `sum % 11 === 10 ? 1 : sum % 11` — **that is the CUI rule.** The canonical CNP control digit is **`(sum % 11) * 10 % 11`**.

This is not academic: **`src/data/personas.test.ts:32,181` imports this exact helper** to prove the fifteen invented persona identities are not real people, and `src/data/seed.identityHygiene.test.ts` and `src/data/occupancy.privacy.test.tsx` trust it too. Under the canonical rule the guard can call a real-looking CNP fake.

- Fix the algorithm to the canonical form.
- **Then re-run every identity-hygiene assertion and report what changes.** Some fixtures were chosen to fail the *wrong* rule; they may pass the right one, or the reverse. Do not adjust fixtures to make tests green without saying which ones moved and why.
- The seed fixture is fake on **structure** (month 45, day 67), not arithmetic — that distinction is already documented and must survive.
- **A fixture that turns out to be a valid, real-shaped CNP must be changed, not excused.** B-110 already caught two fixture CUIs that satisfied real control-digit keys.

---

## 4. B-74 and B-55 — two strings that hide what they mean

Same honesty class as the toggle, small and isolated. Take them only after §1–§3 are green.

**B-74** — `thresholdLabel` in `src/domain/insights.ts:109` falls back to a generic string for unknown threshold keys. A new threshold key would render as a plausible label instead of surfacing. Same silent-generic class PG-5 pinned away for the deadline and completeness families. **Fix + pin with a test that an unknown key cannot render as a plausible label.**

**B-55** — `thresholds.ts:834` builds `Baza „${spec.requiredFiscalBase}” nu a fost furnizată`, printing `net-income` / `revenue-excl-vat` to a human. `ThresholdSection.tsx:92` keeps the same leak path for `affectedDomain`. The copy guard cannot catch this — it scans `components/**` and `pages/**`, and these sentences are produced in `domain/`. **Route the identifier through the existing copy layer, do not hand-translate a second dictionary.** If the copy layer has no slot for it, add one keyed by the same code and say so.

---

## 5. Hard boundaries

- **No engine arithmetic changes.** `src/domain/fx/**` is off-limits. `src/domain/fiscal/**` is off-limits except the two string sites named in §4.
- **Do not change persona figures.** The fifteen personas' twelve-month data is pinned by e2e. If a persona test goes red, the surface is wrong, not the persona — unless §3 (CNP) explains it.
- **The 311.200-lei seed pin must not move.**
- **Do not touch `caen_rev3.csv` or the CAEN ingest.** B-136 is **PARKED by user decision**; the contested secțiune lettering is not yours to fix. Render whatever the data says.
- **Do not start B-137** (the euro-cap provisional conversion, D-FX-6). Different phase.
- **Do not add a persona gallery, a persona editor, or a CAEN browser.**

---

## 6. Acceptance criteria

1. `npx tsc --noEmit` → 0. `npm run build` → 0. `npm run test` → all pass. `npm run test:e2e` → all pass.
2. **At least one e2e spec that a real user could follow**: open the app, reach the persona surface, see which level matched, switch to demo, see the demo badge, switch back, see their own numbers.
3. **A test proving a secțiune-level match renders differently from a clasă-level match** — not a colour-only difference; assert on the rendered text.
4. **A test proving a tie renders every candidate** and does not silently choose.
5. **A test proving the demo state is visible after a reload.**
6. **A test proving the user's own records are unchanged by activating and deactivating a demo.**
7. **B-111:** the canonical CNP formula, plus a report of every fixture whose validity changed.
8. **B-74:** an unknown threshold key cannot render as a plausible label.
9. **B-55:** no internal identifier appears in any rendered Romanian sentence on the threshold surface; extend the copy guard if it can now see the new site.
10. Report the **new measured** unit and e2e counts. Do not restate the old ones.

---

## 7. Boundary list — a hypothesis, not a contract (§12.15)

Expected: `src/data/personas/index.ts`, `src/components/**`, `src/pages/**`, `src/App.tsx`, `src/data/store.tsx`, `src/test/occupancyFixtures.ts`, `src/domain/insights.ts`, `src/domain/fiscal/thresholds.ts`, `src/components/ThresholdSection.tsx`, copy layer, plus tests.

**If you find the toggle genuinely requires a store data-shape change, or that the persona surface genuinely needs a new route, stop and report rather than expanding silently.** A challenged boundary reported early is worth more than a completed brief that quietly grew.
