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

**§12.17 applies to you and is not optional.** The suite is 172 unit files / 47k lines of test code / 38 e2e specs. During development run `npx vitest run <path>` on the files you touched and their direct consumers, and `npx playwright test <spec>` on the spec you changed. **Never `npm run test` as an iteration loop.** Run the full suite **exactly once**, at the end, as the §9 gate. Never unit and e2e in the same command or concurrently. Do not re-run the full suite after a green run unless a file changed after it. Report the shape of your runs under `TESTS:`.

---

# Brief 66 — the honesty sweep: eight small defects where the app says something misleading, or says nothing where it should

**Defects:** **B-56**, **B-28** with **B-27**, **B-106**, **B-62**, **B-138**, **B-107**, **B-67**, **B-79**.

**Size: medium. No arithmetic moves. If a number a taxpayer would rely on changes value, you have gone outside scope — stop and report.**

**These are not eight unrelated chores.** They are one class: *the app states something it has not done, or stays silent where the reason is the whole point.* B-56 claims a filing that never happened. B-28 renders a refusal as if it were a pending number. B-106 shows `review_required` with no reason attached. B-62 names the wrong tax form. B-138 prints an internal enum to a human. B-107 resolves a regime with no sentence explaining it. B-67 relies on a legal presumption nothing in law makes. B-79 declares a state nothing produces. Fix them as one argument, not eight patches.

**Work in the order below.** It is by harm, not by ease. **If you run out of room, stop cleanly and report what is left undone — an honest partial handoff is worth more than eight half-finished fixes.**

---

## 1. B-56 — success messages claim operations that do not happen *(highest harm; do this first)*

- `src/ui/copy/records.ts:248` says `Declarația … a fost transmisă` over `sendDeclaration`, which is a plain `setData` call (`store.tsx:93`, `:320`). **Nothing is transmitted to anyone.**
- `src/ui/copy/settings.ts:61-62` says `Contul este conectat la platforma e-Factura` while no integration exists anywhere (Q-EFACT-API not started).

A user who believes a declaration was filed **may not file it**. That is the worst defect in this brief by a wide margin, and it is a sentence, not an engine change.

**Required:** the copy must state what actually happened — a record was marked in this app — and must not imply a transmission or a connection that does not exist. If a "marcat ca depus" affordance is the honest shape, say so and keep it visibly about *this app's record*, not about ANAF. **Do not add an integration.** Do not soften into vagueness either: „operațiune efectuată" is as false as „transmisă".

---

## 2. B-28 with B-27 — a refusal rendered as a number that is still arriving

`—` is this app's established marker for „unknown / refused" (`formatBaniOrDash`). The cockpit renders `taxTotal === null ? "—" : formatBaniRON(taxTotal)`, and `taxTotal` is null in **two opposite situations**: the engine has not answered yet (`LOADING_TAX`), and the engine **refused** (a regime a persoană fizică cannot have, a missing rule, a review-required line). A user who sees `—` after a refusal can reasonably believe the number is merely still arriving.

**B-27 is the same defect chain and is included deliberately:** `computeTaxEstimate` is declared `async` with **no I/O behind it**, so a pending state exists that can never resolve. Fixing B-28 without B-27 means distinguishing two states one of which cannot occur.

**Required:** a refusal and a pending computation must be visually and textually distinct, and the refusal must be reachable in a test. If removing the meaningless `async` is the right fix for B-27, do it — but check what awaits it first, and report the call sites you touched.

---

## 3. B-106 — a refusal the user cannot read is not a refusal, it is a dead end

Only **scenario** refusals carry detail into the UI. When the **CASS ladder** refuses — a declared amount disagreeing with the computed one — the user sees `review_required` with **no reason attached**. Pre-existing, but B-88 made it reachable: an art. 85 register now runs the lit. c)–h) ladder for the first time.

**Required:** render the engine's existing ladder-refusal sentence. **The engine already produces it** — this is a rendering gap, not a generation gap. If you find the engine does *not* actually produce a sentence for the ladder path, **stop and report**, because then it is a different and larger defect.

---

## 4. B-62 — the declarations copy names the wrong forms

- `src/ui/copy/records.ts:316` — `Declarația 100 / impozit pe venit`. D100 is actually „**Declarație privind obligațiile de plată la bugetul de stat**" (cod 14.13.01.99/bs), the **quarterly Titlul III return for micro-enterprise income tax**. **A Titlul IV taxpayer never owes it.**
- `src/ui/copy/records.ts:321` — `Declarația 220 / contribuții sociale`. D220 is actually „**Declarație privind venitul estimat / norma de venit**".

A user who picks "D220 / contribuții sociale" for a real contribution document has filed the wrong thing. **Correct the names to the official ones.** Do not invent new form numbers and do not renumber anything.

---

## 5. B-138 — an internal enum printed to a human, and three tests pin it as correct

`src/domain/estimateBasis.ts:1568` interpolates a raw `CapBase` member into a Romanian sentence, so the person reads `Plafonul se calculează pe baza „annual_eur_per_person”`. Same class as B-55, which closed yesterday for the `FiscalBase` family.

**The part you must handle carefully: three tests currently assert the identifier on screen and therefore pin the leak as intended behaviour —**

- `src/pages/Expenses.capBanner.test.tsx:58` — `getByText(/annual_eur_per_person/)`
- `src/domain/estimateBasis.deductibility.test.ts:165` — `expect(set.excluded[0].detail).toContain("annual_eur_per_person")`
- `src/domain/estimateBasis.euroCaps.test.ts:115` — `expect(detail).toContain("annual_eur_per_person")`

**Re-pin all three, and record the re-pin explicitly in your handoff as a re-pin.** Do not let three changed assertions disappear into a green diff. This is the exact failure mode this plan already records for B-99 and B-101: a test written against what the code did rather than what the law asks.

Use the copy layer, keyed by the same code — `fiscalBaseLabels` in `src/ui/copy/thresholds.ts` is the pattern that worked for B-55. **Do not hand-translate a second dictionary.**

---

## 6. B-107 — arendă agricolă resolves to *sistem real* with no sentence saying why

It is carved out of art. 84 alin. (1) and (3) and has its own mechanism: gross on a **cash** basis („încasate", alin. (4)), 20 % fixed **la fiecare plată** (alin. (7)), **10 % withheld at source and final** (alin. (8)–(9)), **no contract registration** (art. 83 alin. (5) excludes arendare), and **CASS that *can* be withheld** (art. 174¹ alin. (3)) — the only Cap. IV rent income where that is true. B-105 deliberately did not build it.

**Required: an explanatory sentence, not a new regime.** The resolution stays as it is; the app must say *why* it resolved that way and what is therefore different about it. **Do not compute arendă agricolă** — that is B-105's territory and is out of scope here.

---

## 7. B-67 — a legal presumption the app makes but does not disclose

D-DATE-1's document-date stand-in has **no legal footing**, and nothing in the app says so. For Titlul IV the document date is a **validity condition** (art. 68 alin. (4) lit. a) „justificate prin documente"), **never the year-determining fact** — the year comes from art. 68 alin. (2) lit. a) „sumele încasate" and alin. (4) lit. b) „al anului în cursul căruia au fost plătite". **No provision presumes document date = money date, and none fills in a blank money date.**

**Required: disclose it.** The behaviour stays; the app must say that the money date was assumed from the document date and that the law decides the year by collection/payment, not by paper. **Do not change which date is used** — that is a user decision, not a defect fix.

---

## 8. B-79 — a declared state that nothing produces and nobody owns

`closed_final` is a declared estimate state that nothing produces. PG-6a confirmed it deliberately: it was not triggered just to make a test pass, and it is still reachable by nobody. Meanwhile PG-4 already knows when a year is closed — the projection carries `closed` and the hero says the figure is final.

**So it is one of two things, and you must decide which and say why:**
- **triggerable today** from data the app already has, or
- **dead vocabulary that should be deleted.**

**Leaving it declared is the one unacceptable outcome** — it invites a later phase to assume it means something. Pick, implement, and write the reason in the register note. Prefer deletion unless you can point to the exact existing data that should drive it.

---

## 9. Only if §1–§8 are green and you still have room: B-78

Dead vocabulary left behind by PG-5b, each with a recorded reason it was not touched. Low value, and deleting dead code can break tests that reference it. **Skip it rather than rush it.**

---

## 10. Hard boundaries

- **No arithmetic changes.** `src/domain/fx/**` off-limits. No change to any calculator's result. B-106, B-107 and B-138 render or explain existing engine output — they must not alter it.
- **Do not touch** `caen_rev3.csv`, the CAEN ingest, `src/data/personas/persona*.ts` figures, or `src/data/migration*` (chain head stays **v21**).
- **The 311.200-lei seed pin must not move.** It is asserted in `src/data/seed.identityHygiene.test.ts:339`.
- **No new integrations, no e-Factura work, no arendă agricolă computation, no new form numbers.**
- **Do not start B-136 (PARKED), B-137, or Step 12.**

---

## 11. Acceptance criteria

1. `npx tsc --noEmit` → 0. `npm run build` → 0. `npm run test` → all pass. `npm run test:e2e` → all pass. **One full-suite run each.**
2. **B-56:** no copy anywhere claims a transmission, a filing at ANAF, or a connection that does not exist. Pin with a test.
3. **B-28/B-27:** a refusal and a pending computation render differently, and the refusal path is reachable in a test.
4. **B-106:** a ladder refusal renders its reason. Assert on the rendered text.
5. **B-62:** D100 and D220 carry their official names.
6. **B-138:** no internal identifier in that sentence, and **the three re-pinned tests are listed by name in your handoff.**
7. **B-107:** the arendă agricolă resolution carries an explanatory sentence.
8. **B-67:** the assumed money date is disclosed where it is used.
9. **B-79:** `closed_final` is either produced by named existing data or deleted, with the reason recorded.
10. Report **newly measured** unit and e2e counts. Do not restate the register's figures.

---

## 12. Boundary list — a hypothesis, not a contract (§12.15)

Expected: `src/ui/copy/records.ts`, `src/ui/copy/settings.ts`, `src/ui/copy/thresholds.ts`, `src/ui/copy/dashboard.ts`, `src/domain/estimateBasis.ts`, `src/domain/thresholds.ts`, `src/domain/insights.ts`, the cockpit/dashboard components, `src/data/types.ts` (only for B-79), plus tests.

**Coordinates in this brief were checked against the tree on 2026-10-15, but a line number is a hypothesis.** If a site has moved or a defect turns out to be larger than described — especially B-106, if the engine genuinely produces no ladder sentence — **report it early rather than expanding silently.**
