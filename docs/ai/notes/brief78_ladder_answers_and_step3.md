# Brief 78 — the ladder answers, not the ladder guesses: what landed, and the measured cost of what did not

**2026-10-16. Implements D-DPI-2 (`docs/ai/USER_DECISIONS.md`). Chain head: v25 → v26.**

---

## 1. What landed

**Step 1 — the tri-state and the narrowed ladder, with the typed net still working.**

- `CASS_LADDER_ANSWER_VALUES` / `CassLadderAnswer` in `src/domain/models.ts`: `amount`, `none`, `unknown`. Deliberately **not** `FactState` (`da`/`nu`/`unknown`) — `nu` there means "checked negative", which for an income category is ambiguous between "no income" and "no answer".
- `CassLadderYear.ladderAnswers?: Partial<Record<CassLadderCategory, CassLadderAnswer>>` — optional, no default, declared in the load gate (`src/domain/schema.ts`) **before** the step that reads it.
- `cassLadderCategoryFacts(amounts, answers)` is the **single** resolver of the two stored halves. Four outputs: `amount`, `none`, `unknown`, and `conflict` — the fourth is not a fifth answer a person could give, it is the app noticing that its own record says „nu am avut" beside a figure, or „am sumă" beside none. The ladder refuses on `conflict` rather than picking a winner, the same shape as `dpiDoubleRepresentation` and the cedarea double-producer refusal.
- `calcCassLadder`'s refusal is **narrowed, not removed**: from „not all six are numbers" to „not all six are answered". A declared `none` contributes a measured zero and the breakdown says so in words („nu am avut" — categorie declarată fără venit), never as a bare `0 lei`. A new sentence tells the person what would unblock it: *Dacă nu ai avut astfel de venituri, bifează „nu am avut" pe fiecare categorie — aceea este faptă a ta, nu a aplicației.*
- Chain step **v26 `cass-ladder-answers`**: `DATA_VERSION_LADDER_ANSWERS = 26`, `CURRENT_DATA_VERSION = 26`, body is the version stamp and nothing else.

**Step 2 — the questions.**

Settings asks the six categories as six **questions**, each with three answers a person can choose (`am avut` + figure / `nu am avut` / `nu vreau să declar acum`) and a fourth state the control starts in: nothing chosen. The amount box is not rendered until the person says they have such an income.

The questions are plain Romanian; the citation under each one is `CASS_LADDER_CATEGORY_NAMES` from `domain/models.ts` — **the same list the engine's own refusal prints** — so the screen and the refusal cannot grow two vocabularies for one legal list, which is what B-122 warns about.

| Category | Question (plain Romanian) | Cited article + quoted text | Corpus file |
|---|---|---|---|
| `proprietate_intelectuala` | Ai încasat bani din drepturi de proprietate intelectuală — drepturi de autor pentru o carte, o muzică, o fotografie, un program, sau o invenție? | art. 155 alin. (1) lit. c): „venituri din drepturi de proprietate intelectuale, definite conform art. 70" | `research/41` §1; DPI correction `research/48` §5 |
| `asociere_persoana_juridica` | Ai încheiat un contract de asociere cu o firmă — ai dat un bun sau o sumă de bani și ai primit o parte din profitul ei? | art. 155 alin. (1) lit. d): „venituri din asocierea cu o persoană juridică, contribuabil potrivit titlului II sau titlului III, pentru care sunt aplicabile prevederile art. 125" | `research/41` §1 |
| `cedarea_folosintei_bunurilor` | Ai dat în chirie ceva ce deții personal — un apartament, o casă, un teren, o mașină — și ai primit chirie? | art. 155 alin. (1) lit. e): „venituri din cedarea folosinței bunurilor, definite conform art. 83" | `research/41` §1, §2 (measurement: net per art. 84-85) |
| `activitati_agricole` | Ai avut venituri din agricultură, silvicultură sau piscicultură — din producția pământului tău, din pădure sau din crescătoria de pești? | art. 155 alin. (1) lit. f): „venituri din activități agricole, silvicultură și piscicultură, definite conform art. 103" | `research/41` §1, §2 (normă survives only here) |
| `investitii` | Ai încasat dividende sau dobânzi, ori ai câștigat din vânzarea de acțiuni și din alte investiții? | art. 155 alin. (1) lit. g): „venituri din investiții, definite conform art. 91" | `research/41` §1, §2 (dividends as „dividendele plătite, diminuate cu impozitul reținut") |
| `alte_surse` | Ai avut alte venituri care nu se potrivesc cu cele cinci de mai sus? | art. 155 alin. (1) lit. h): „venituri din alte surse, definite conform art. 114" | `research/41` §1, §2 (BRUT, and only here), §5 (the unqualified „alte" must be refused) |

The chapeau the whole section rests on is `research/41` §2, quoted in the breakdown: *„Încadrarea în plafonul anual … se efectuează prin cumularea veniturilor prevăzute la art. 155 alin. (1) lit. c)-h)"*.

**B-122 was checked before the questions were designed**, as the brief required: art. 174¹ alin. (3) names three withholding sources (DPI, arendă, asocieri cu persoane juridice) and those three are three of the same six categories. The form, the persisted gate, the calculator and the refusal all read `CASS_LADDER_CATEGORIES` / `CASS_LADDER_CATEGORY_NAMES`. No second vocabulary was created. B-122 itself is CLOSED and was not touched.

**Step 3 — the typed net — did NOT run.** See §4.

---

## 2. The six collapse tests, named

| §6 | Test | File |
|---|---|---|
| 1 — a payload with the new field absent migrates to `unknown`, and the ladder refuses (not to `none`) | „the cass-ladder-answers step leaves a real v25 payload UNANSWERED: unknown, never „nu am avut"" — asserted on a payload at `version: DATA_VERSION_PRIOR_YEAR_LOSSES`, i.e. a real v25 payload, not the current schema | `src/data/store.migration.chain.test.tsx` |
| 2 — an explicitly `none` category lets the ladder proceed, and the CASS figure is asserted | „five declared absences and one 30.000-lei figure compute: 6 SM base, 2.430 lei CASS" (base `lei(24_300)`, value `lei(2_430)`, derived by hand against SM = 4.050) | `src/domain/ladderAnswers.test.ts` |
| 2 (browser) | „six declared „nu am avut" are six answers, and they compute to no CASS rather than to a refusal" | `e2e/cass-ladder.spec.ts` |
| 3 — one `unknown` among five answered still refuses, and says which category | „names the category that is missing, in the words the person reads" and „a category explicitly answered „nu se știe" blocks the ladder exactly like silence" | `src/domain/ladderAnswers.test.ts` |
| 3 (browser) | „five answers and one untouched question stops the estimate and names the missing category" | `e2e/cass-ladder.spec.ts` |
| 4 — no `?? 0`, `|| 0`, zod default or number-coercion on the payload → `calcCassLadder` path | Diff grep (see §3) **plus** three behavioural pins: „exhaustively: no combination of amounts without an explicit `none` ever yields `none`" (all 64 amount subsets × 4 answer tokens × 6 categories), „a payload with the field absent parses, and the field stays absent — it is not defaulted to none", „an unknown token is rejected rather than coerced, so no fifth state can reach storage" | `src/domain/ladderAnswers.test.ts` |
| 5 — the UI cannot submit an untouched control as `none` | „saving without touching anything stores NO answer at all — the state stays unknown" (jsdom, on the persisted profile) and, on the saved bytes, „a question nobody touched is saved as nothing at all — never as „nu am avut"" | `src/pages/Settings.ladderAnswers.test.tsx`, `e2e/cass-ladder.spec.ts` |
| 6 — the computed DPI amount and a previously typed net disagreeing still trips the guard, until step 3 lands | „a record whose declared kind contradicts its declared DPI contract still conflicts" (`dpiRecordConflict`) and „the typed ladder net and a recorded DPI gross are two producers, and the resolver does not merge them"; the end-to-end half was already pinned and is unchanged: „the B-112 refusal is untouched by this: same row, same sentence, and still no DPI income posted" (`dpi_income_double_represented`) | `src/domain/ladderAnswers.test.ts`, `src/domain/dpi.path.test.ts` |

**The extra pin the brief asked for by name** (zod strips undeclared keys): „a declared „nu am avut" survives a real save-and-load instead of being stripped by the gate" — `src/data/store.migration.chain.test.tsx`, through the store load path rather than a direct schema call.

---

## 3. The forbidden-pattern grep, reported

`git diff -U0 | grep -nE '^\+.*(\?\? 0|\|\| 0|\.default\(|Number\()'` over the whole brief:

```
+ * If they ever collapse — through a default, an optional field, a `?? 0`, or a form that submits an
+   * **Optional, and it must stay optional — with no `.default()` and no backfill anywhere.** A payload
+        // **Optional, and no `.default()` — on pain of the worst line this brief could write.** A payload
```

**Three hits, all three comments warning against the pattern, zero code.** No `?? 0`, no `|| 0`, no `|| 0.0`, no zod `.default(`, no `Number(` on the CASS path. The only numeric coercion in the ladder path is the existing `parseLeiInput`, which returns `null` for anything unparseable and is never given a fallback.

---

## 4. The typed net: not retired, and the measured cost of retiring it

**Status: `CassLadderYear.proprietateIntelectuala` is still there, still the only producer for the DPI limb of the ladder, and `dpiDoubleRepresentation` / `dpiRecordConflict` are still load-bearing and still pinned.**

Brief 78 §5 sets the rule that decided this: *a half-retired typed net is worse than no retirement, because the double representation would survive while the guard that made it safe had been loosened.* Steps 1 and 2 landed and are committed; step 3 did not start. Stopping at a commit boundary is what the checkpoint discipline is for.

**Measured, not estimated** (`grep -rn proprietateIntelectuala src e2e` → **56 references across 32 files**):

1. **Five personas type the net.** Personas 4, 5, 7 and 9 declare `lei(0)` — those convert to `ladderAnswers.proprietate_intelectuala = 'none'` for free and move no figure. **Persona 6 is the one brief 71 warned about:** DPI income and zero DPI documents (`personaCoverage.test.ts:874-877`). Its `proprietateIntelectuala: lei(30000)` is the only DPI route the app gives it. Keeping that route means giving persona 6 art. 70 receipts whose gross produces the same 30.000-lei net (gross 50.000 × the 40 % quota) — which also moves its CAS cumul and its `reținută la sursă` row, asserted in `e2e/persona-6-investor.spec.ts:38,50`.
2. **Four golden fixtures reproduce ANAF's published figures by typing a net** — `src/domain/golden/regimeSplit.test.ts:114, :209, :289, :324` (plus `:347` with a declared zero). Each has to be re-derived from a gross through `calcDpiFlatQuota` with its CAS and CASS figures re-pinned old → new. Brief 72 proved that path exists; it did not migrate these fixtures.
3. **Engine readers to re-point:** `tax.ts:884` (`typedDpiNet`), `:1141` (the ladder's DPI amount), `estimateBasis.ts:1559` (`declaredNet`, the `dpi_income_double_represented` row), `dpi.ts:159`, `models.ts` (`ladderAmountFor`, the interface, the doc comments), `domain/schema.ts` (the persisted key), plus the `dpiDoubleRepresentation` branch itself — which is exactly the guard §6.6 says must stay up until the retirement lands, so it cannot be removed in the same breath as the key.
4. **It owes chain step v27**, and the load gate must keep accepting the key until v27 is what drops it — the v22 discipline, pinned by a test, or the gate destroys the value and the step never gets to record a reason for dropping it.

**What is now cheaper for whoever briefs it:** the ladder no longer refuses a partial set, so the retirement no longer has to solve the other five categories at the same time. That was the whole content of B-152's blocker, and it is gone.

---

## 5. Register

- **B-116** re-tokenised `[BLOCKED: decision]` → `[BLOCKED: chain]`. D-DPI-2 settled the fork, so a decision is no longer what is holding it; a chain step is. The row records what landed, what did not, and the cost above.
- **B-152** stays `[BLOCKED: chain]`, half-closed in substance: the sentence *„one computed DPI amount cannot answer the other five"* is no longer true, and the row says so. The wiring itself — computed DPI net into the ladder — is still missing and is the same act as the retirement.
- Roll-up counts re-checked by grep: 34 OPEN + 85 CLOSED + 2 BLOCKED: research + 3 BLOCKED: decision + 2 BLOCKED: chain + 1 PARKED + 4 REFUTED = **131**.
- **B-153 untouched** (stays open, per the brief's boundary). **B-151's six unreachable `calculatorId`s are not among the five categories** — none of them is a ladder category, so nothing was wired and nothing is reported beyond this sentence.

---

## 6. Gates, quoted from the logs

- `npm run test` (capped: `--pool=threads --poolOptions.threads.maxThreads=2`):
  `Test Files  194 passed (194)` / `Tests  3173 passed (3173)` / `EXIT=0`
- `npm run test:e2e` (capped: `--workers=2`), **first run**: `1 failed` / `233 passed (1.8m)` / `EXIT=1` — the failure was in brief 78's own new spec: `[data-ladder-amount]` counted 2 because `neimpozabil` and `cassRetinutLaSursa` carry that attribute and are not categories. The assertion was scoped to the six category ids.
- `npm run test:e2e`, re-run after that fix: `234 passed (1.7m)` / `EXIT=0`, 39 spec files.
- `npx tsc --noEmit` → 0. `npm run build` → 0.
- **The seed estimate is still exactly 311.200 bani** — `src/data/seed.identityHygiene.test.ts:339` untouched, not re-pinned. **No persona hero moved.** The seed profile records no ladder year, so it stays in the state the ladder refuses on, which is the state its figure has always been computed under.
- `e2e/settings.spec.ts:529` chain-version pin re-pinned **25 → 26**, with the reason beside it, and it now also asserts the v26 step minted no `ladderAnswers` in a payload that never answered a question.
