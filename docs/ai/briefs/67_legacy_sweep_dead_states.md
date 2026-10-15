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

**§12.17 applies to you and is not optional.** The suite is 175 unit files / ~2 900 tests / 38 e2e specs. During development run `npx vitest run <path>` on the files you touched and their direct consumers, and `npx playwright test <spec>` on the spec you changed. **Never `npm run test` as an iteration loop.** Run the full suite **exactly once**, at the end, as the §9 gate — unit and e2e never in the same command or concurrently. Report the shape of your runs under `TESTS:`.

---

# Brief 67 — the legacy sweep: dead states, dead vocabulary, and the third identifier leak

**Defects:** **B-141**, **B-78**, **B-139**.

**Size: medium-small. This brief is deliberately narrow, and the discipline it requires is *restraint*.**

---

## 0. Read this before you delete anything

The user asked to remove `impozit_pe_cit` and "any legacy shit thats just not valid." **That request was checked against the tree and the headline item is wrong, and the reason matters for everything you are about to do.**

`impozit_pe_cit` is **not** cruft — it is the guard. It is `selectable: false, computable: false`, it lives in `PFA_REGIME_VALUES`, which the code documents as *"every regime value the app accepts on READ. Wider than what it offers on WRITE"*, and `regimeRefusalReason` refuses it as a **data-integrity failure** citing CF art. 13/14/15 and the abrogation of the old art. 120 option by OUG 128/2024 pct. 11 Art. I from 01.01.2025. Four tests pin that it is never offered (B-9) and that it is refused with the provisions quoted (B-14).

**Deleting it would make the app accept a stored profile carrying a regime a PFA cannot have.** A real user with an old payload would either be silently mis-classified or have their whole payload rejected at parse — which is data loss.

**The rule for this whole brief: read-wide, write-narrow.** A value that is no longer valid must stop being *producible*, while remaining *readable* so existing data still loads. That is the established pattern in this codebase and it is the correct one for a local-first app whose users' data cannot be re-fetched.

**So: for every dead thing you find, decide which of these it is, and say which you chose:**
- **Producible and valid** — leave it.
- **No longer producible, but existing users may hold it** — stop it on WRITE, keep it on READ, normalise or annotate. **This is the default.**
- **Genuinely unreachable and never persisted** — delete it.

**Do not delete a persisted enum member because it looks dead.** Prove it cannot appear in a stored payload first, and show the evidence.

---

## 1. B-141 — `'transmisa'`: a status nothing produces, still badged green

`StoredStatusCode` still carries `'transmisa'`:
- `src/data/types.ts:107` — in the union
- `src/data/schema.ts:272` — accepted on read
- `src/data/types.ts:797` — **still mapped to `badge-success`**

The copy that rendered it was deleted in brief 66 (B-56), because the app transmits nothing to anyone. **So the B-56 defect class survives in the data layer after its UI was fixed: a status meaning "transmitted" that nothing transmits, still rendered as a green success badge.**

**Required:**
- Stop `'transmisa'` being **producible** on the write path.
- Keep it **readable**, and normalise it to an honest status on load — with the original preserved somewhere recoverable, or a recorded reason it isn't.
- **Remove the `badge-success` mapping.** A status the app considers legacy must not render as success.
- **If this needs a migration step, you may add one — but report it explicitly.** The chain head is **v21**; a new step must be named, ordered, and tested against a pre-migration payload. Do not add one silently.
- **Prove the choice with a test:** a payload containing `'transmisa'` still loads, and no longer renders as success.

---

## 2. B-78 — dead vocabulary left behind by PG-5b

Each item has a recorded reason it was not touched. Work through them and apply the §0 rule to each.

**Report the list you found, item by item, with the decision taken.** A handoff that says "removed dead vocabulary" without naming what was removed is not a handoff.

**Skip rather than rush anything that a test references.** A test referencing dead code is itself evidence worth reporting — it usually means the test is asserting a thing that can no longer happen.

---

## 3. B-139 — the third identifier family, and the guard that should have caught all three

- `src/domain/aggregation.ts:299` interpolates a raw `FiscalDateField` into a Romanian sentence: `„…” pe câmpul „collected” nu este o dată calendaristică reală` — while `fiscalDateSource` already spells the same field out in words nearby.
- `src/domain/fx/ledger.ts:151` does the same thing. **`src/domain/fx/**` is in scope for this brief** — it was off-limits to brief 66, not to you. But touch only the sentence, never the conversion logic.

**The important part is not the two sentences. It's the pattern.** This is now the **third** family in three briefs: B-55 (`FiscalBase`), B-138 (`CapBase`), B-139 (`FiscalDateField`). Each brief added its own family to `thresholds.language.test.ts` and moved on.

**Required: widen the guard to cover field-name and enum interpolation generally, rather than adding a fourth family list.** If a general rule genuinely cannot be written, **say so explicitly and explain why** — that is a useful answer, and better than a fourth list that guarantees a fifth.

---

## 4. Explicitly out of scope

- **B-140** — the e-Factura `În decurs de 2 zile` option contradicting the app's own cited 5-working-day deadline. **It is a data decision, not a copy fix**: the option is backed by a stored enum value (`'2-zile'`), and the correct deadline must be settled from the primary source before anything moves. Do not touch it.
- **`impozit_pe_cit`** — see §0. Do not remove it. If you disagree with that reasoning, **report the argument, do not implement it.**
- **`norma_venit`** — not selectable and not computable, but that is a *known unimplemented regime* awaiting D-NORMA-2, not legacy. Leave it.
- No arithmetic changes. No `caen_rev3.csv` or CAEN ingest. No persona figure changes. No `domain/fx/**` conversion logic. The 311.200-lei pin at `seed.identityHygiene.test.ts:339` must not move.
- Do not start **B-136** (PARKED), **B-137**, or **Step 12**.

---

## 5. Acceptance criteria

1. `npx tsc --noEmit` → 0. `npm run build` → 0. `npm run test` → all pass. `npm run test:e2e` → all pass. **One full-suite run each.**
2. **B-141:** `'transmisa'` is not producible; a stored payload carrying it still loads; it no longer renders as success. Pinned by a test.
3. **B-78:** every item listed in your handoff with its decision and reason.
4. **B-139:** no raw field name in either sentence, and the language guard covers the general case **or** explains in writing why it cannot.
5. **Any migration step you added is named, ordered, and tested against a pre-migration payload.**
6. Report **newly measured** unit and e2e counts. Do not restate the register's figures.

---

## 6. Boundary list — a hypothesis, not a contract (§12.15)

Expected: `src/data/types.ts`, `src/data/schema.ts`, `src/data/migration.ts` *(in scope this time)*, `src/domain/aggregation.ts`, `src/domain/fx/ledger.ts` *(sentence only)*, `src/domain/thresholds.language.test.ts`, plus whatever PG-5b left behind.

**If B-141 turns out to require a payload shape change beyond a status normalisation, stop and report rather than designing it yourself.** That is an architectural decision, not a cleanup.
