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

**§12.18 — search `docs/ai/research/` before you re-derive a fact.** The corpus already answers most of what a Worker is tempted to argue about. Cite the file; do not re-litigate a settled correction.

---

# Brief 73 — the declaration forms, and two small honesty defects that ride along

**B-98, B-64, B-81, B-143, B-149.**

**B-140 is NOT in this brief.** It was moved to the consolidated chain brief, because retiring or remapping the stored `'2-zile'` e-Factura enum value is a migration decision and four other defects want a chain step. Do not touch it.

---

## B-98 — D300 rd. 33 and rd. 34 are drawn without a value

The lines are present and labelled with why they are empty, which is honest. But **6g's own claim — that the 50 % cut and the pro rata land partly inside rd. 20–28 and partly on rd. 33/34 — is unimplemented arithmetic, not a placeholder to be filled by layout.**

**Corpus first (§12.18):** `research/42_input_vat_deductibility_2026.md`, `research/35_nondeductible_vat_negative_and_citation_corrections.md`, `research/45_cid_2024_1641_vehicle_vat_2027.md`. Read them before you decide what those rows should contain.

**Two distinct things are missing and should not be conflated:** the **art. 305** correction figures (regularisation) and the **art. 300 alin. (14)** adjustment figures. And nothing is allocated across the letters of **rd. 20–28**.

**If the corpus does not establish which figure belongs on which line, report that rather than placing one.** A declaration row filled with a plausible number is worse than an empty row that says why it is empty — the empty row is already honest, and you would be replacing honesty with a guess.

---

## B-64 — a FY2027 obligation the app does not model, and our citation for it was wrong

For FY2027, a PFA **neînregistrată în scopuri de TVA** with cifră de afaceri (art. 310 alin. (2)) **sub 300.000 lei** owes the **CF art. 324 alin. (5) notificare scrisă — form 392B — by 25 februarie 2028**. The suspension is **OUG 115/2023 art. LXII**: *„Aplicarea prevederilor art. 324 alin. (4)-(6) … se suspendă începând cu data de 1 ianuarie 2024 și până la data de 31 decembrie 2026 inclusiv"*, and **no 2026 instrument re-suspending it was found** — which is **absence of evidence, and must be re-checked in ianuarie 2027.**

**Corpus first:** `research/34_declarations_efactura_rjip_and_nondeductible_vat.md` and `research/35_nondeductible_vat_negative_and_citation_corrections.md`. **The register already records three corrections to what we previously wrote about this** — including that **art. 324 alin. (6) is the international bus-ticket notification, not the suspension text**; the suspension is a *modification note*. Read those corrections before touching the code, or you will re-introduce the error we already fixed.

**The modelling question is whether the app should surface an obligation for a year it cannot compute for.** It should, and it should say plainly that the obligation is prospective and that the suspension's expiry has been re-checked to a stated date. **Do not present it as a current-year debt.**

---

## B-81 — the D212 form has no 68³ subsection, and its instructions cite an abrogated order

OPANAF 2736/2025 (MO 1207/29.12.2025) contains no reference to art. 68³ and still instructs the tourist-rental line to use the fișă approved by **OPANAF 398/2021 — abrogated by OPANAF 381/2026**.

**Corpus first:** `research/38_art68x3_cass_and_occupancy_order.md` is the primary one here; also `research/47`, `research/49`, `research/46`.

**The instruction in the register is explicit and it is a trap: do not derive a D212 cell map for 68³ from the current instructions.** The instructions point at an abrogated order. Deriving a cell map from them would encode a form reference that no longer exists.

**The honest deliverable here is very likely a refusal with a reason**, not a subsection. If the successor order has not been found, say so on screen and in the register. **MO Partea I was not swept exhaustively for Dec 2025 – Oct 2026; a successor order is the highest-value next search — report that as a Researcher recommendation rather than going and guessing.**

---

## B-143 — `AttentionState`'s `'not_submitted'` is dead but test-pinned

No producer has existed since the monthly declaration row went away, yet `attention.test.ts:112` pins `surfaceFor('not_submitted') === 'action'` and `dashboard.test.ts:415` still admits it to an allowed-source list.

**This needs a decide-or-delete, not a drive-by removal.** B-79's precedent is the lesson: the obvious trigger field turned out to mean something coarser than the state would have claimed. **Check whether any live fact actually produces "not yet submitted" before deleting it.** If one does, the state is not dead and the test is right — report that instead.

---

## B-149 — the DPI contradiction tag is mis-worded *and* mis-gated

`ui/copy/records.ts:113` reads *„declarație contradictorie — venit nepostat"*, and it is gated on `isDpiIncome` — so an art. 67 record carrying the contradiction shows **no tag at all**, and if it did show one, *„venit nepostat"* would be **false there**, because that income *is* posted and is inside the figure.

**Brief 71 made the contradiction visible on the coverage surface while the register row stayed silent.** **The app now half-reports the same fact, which is worse than either extreme.** Fix the gate and the wording together, or neither.

---

## Boundaries

- **No migration chain step. Chain head stays v21.** B-140, B-145, B-108 and the DPI typed-net retirement are all queued for one consolidated chain brief. If any defect here seems to need a persisted field, **stop and report** — that is the chain brief's decision, and it will be made once, with all four in view.
- **Do not touch `src/domain/fx/**`, `src/domain/tax.ts`'s DPI wiring, or `caen_rev3.csv`.** Brief 72 just landed those.
- **Persona figures are not yours to edit.** Report any movement with old → new → reason.
- The 311.200-lei seed pin at `seed.identityHygiene.test.ts:339`: if it moves, report before touching.
- **Do not re-derive anything the corpus already settled.** §12.18 exists because three defects this week were minted or briefed as open questions that `docs/ai/research/` had already answered.

---

## Acceptance criteria

1. `npx tsc --noEmit` → 0. `npm run build` → 0. Both capped gates → all pass, **once each, backgrounded to a log**.
2. **B-98:** rd. 33/34 carry values derived from the art. 305 and art. 300 alin. (14) rules, **or** a reported statement that the corpus does not establish which figure goes on which line. The empty-row honesty must not be replaced by a guess.
3. **B-64:** the FY2027 392B obligation is surfaced, dated, prospective, and cites the **suspension as corrected** — not art. 324 alin. (6).
4. **B-81:** either a 68³ subsection grounded in a found successor order, **or** an explicit on-screen refusal naming the abrogated citation. **Not** a cell map derived from instructions that point at OPANAF 398/2021.
5. **B-143:** decided or deleted, with the reasoning, and the test that pinned it handled deliberately.
6. **B-149:** the tag appears on the record that actually carries the contradiction, with wording that is true of that record.
7. Report **newly measured** unit and e2e counts.
