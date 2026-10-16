# Pre-Phase-11 execution plan — how these eight tasks will actually be run

**Orchestrator decision record. 2026-10-09 (date from `date +%F`; an earlier draft said 10-08, which is the typed-date error §2.1 forbids). HEAD after TASK 1: `c49d88f`.**
Inputs: two independent external audits of `ac84f37`, plus the orchestrator's own measurements across Phases 1-10.

This is not a restatement of the briefs. It is the decision of **how** each task is done, what is refused, and in what order they run.

---

## 0. Baseline as it now stands (measured, not claimed)

| check | value |
|---|---|
| `npx tsc --noEmit` | 0 |
| `npm run test` | **49 files / 784 tests** |
| `npm run build` | exit 0 (one 757 kB chunk — known, not addressed this round) |
| `npm run test:e2e` | 36 passed |

**TASK 1 is DONE** (`beb4b56` → `8572be9` → `c49d88f`). The annual estimate is fed the run-rate projection; the excl-VAT pair is annualised from its own totals, never scaled from gross; `elapsedMonths === 0` yields explicit actuals-only. YTD summary untouched. `phases/12_projection_annual_estimate.md`.

Remaining: TASKS 2-8 (TASK 2 split into **2a DONE / 2b / 2c**), plus a small hygiene task (TASK 9) and **TASK 10 — currency + an FX rate store** (defect **B-32**: `Revenue`/`Expense` carry no currency field, the only `moneda` is an unread free-text label on `BankAccount`, and there is no FX layer in `src/` at all). TASK 10 is what makes the art. 68 euro caps computable, and it is also what makes a EUR-collected invoice representable at all — CF art. 9 alin. (3) lit. b) requires conversion at the BNR rate on the date the money actually moved. **2c exists because the annual caps are cross-record and the protocol cap base is circular** — art. 68 alin. (6) defines it as gross minus deductible expenses *other than* protocol and private scholarships, so the base depends on a deductible total that must itself exclude the categories being capped. A partial implementation there produces a confident wrong number.

---

## 1. Order, and why it differs from both briefs

The second audit asked for threshold semantics **first**. I am **not** doing that — TASK 1 had to go first, because the threshold rows measure the tax engine's contribution base, and once the estimate became annual, the thresholds silently started measuring an annual quantity. Doing thresholds before the basis would have fixed the semantics against the wrong number.

Order now:

| # | Task | Why here | Researcher? |
|---|---|---|---|
| **2** | Expense deductibility | Largest remaining correctness hole: 100 % of expenses are deductible today. | **Yes** — the deductibility framework, see §3.1 |
| **3** | Persist tax-reserve | Small, independent, and it deletes a warning that can never clear. Cheap win. | No |
| **4** | Threshold semantics + applicability | Produces false "Urgent" alerts at **every** income level today. Now that the basis is annual, this is the right moment. | **Yes** — CAS 12-SM floor only |
| **5** | Pension / CASS input model | Legal-fact precision; feeds Task 4's CASS messaging, so after it. | **Yes** |
| **6** | Rule-release immutability | The one thing neither audit will let slip. Independent of 1-5. | No |
| **7** | User-facing language layer | Cross-cutting; must come after the domain semantics (4) and the severity model's inputs exist. | No |
| **8** | Prioritisation, severity, rendering | Depends on 4 (semantics), 7 (copy), 3 (reserve clears). Last of the eight. | No |
| **9** | Provenance + seed + layout hygiene | Small, mechanical, must not contaminate the eight. | No |

Strictly sequential, one Worker each. Scouts in parallel inside a task.

---

## 2. Standing rules for every Worker in this round

**OVERRIDE — Scouts are SEQUENTIAL (user instruction, 2026-10-09).** Rule 4 of the global contract ("Scouts may run in parallel when their questions are independent") is **suspended** from the next Worker onward: **spawn Scouts one at a time, waiting for each report before spawning the next.** The user is measuring whether sequential scouting is faster on their machine, so the comparison must be clean — do not parallelise Scouts, and do not run a Researcher concurrently with a Worker. Workers remain sequential (rule 1, unchanged). TASK 2c (`task2c-annual-caps`) was briefed **before** this override and is exempt; every brief from 18 on carries it.


These are additions to the global contract, learned from Phases 1-10.

1. **Date stamps come from the tool, never typed.** `date +%F` or `git log -1 --format=%cd --date=short`. The second audit caught ~40 `STATE.md` lines dated 2026-10-08 against a last commit of 7 Oct. It is provenance hygiene, not tampering, and it is now a rule.
2. **The e2e re-pin protocol.** When a pinned currency figure changes because the basis is now correct: compute the new value **by hand before running**, put the arithmetic in a comment, and record old → new in `DECISIONS:`. Deleting an assertion, loosening a matcher or widening a timeout is a failed task, not a fixed one. I diff the test files.
3. **Determinism by pinned clock, not pinned literal.** An annual run-rate figure is legitimately date-dependent. Pin the clock (`page.clock.setFixedTime` / `vi.useFakeTimers({toFake:['Date']})`), never the resulting literal. This is defect B-23's class.
4. **No blanket snapshot-hash migration.** The digest covers the stored `inputSnapshot` bytes. Only add a targeted, id-scoped legacy tier (the pattern in `src/data/migration.ts` — note: singular, `migrations.ts` does not exist) when stored bytes actually change. A blanket re-hash silently destroys every user's tamper evidence.
5. **Scout model override is mandatory, not a fallback.** The default scout model exits without output (~27 s, or 12m32s and nothing). The working override is `llama-cpp/qwen3.8-flash-next-iq3_s`. Every brief in this round states it up front. Report it in `BLOCKERS:` — do not silently self-inspect instead.
6. **One assembler, two call sites.** The tax operands are built in `src/domain/estimateBasis.ts` and consumed at exactly two places (`data/dashboard.ts getTaxEstimate`, `data/derived.ts useLatestTaxEstimate`). Any new quantity enters **inside the assembler or upstream of it**. Introducing it at a call site makes the live path and the test path drift — that is how the flake happened.
7. **Uncertainty is a first-class value.** `REVIEW_REQUIRED` internally, plain Romanian externally (Task 7). Never a plausible-looking number where the law or the data does not support one.

---

## 3. Task-by-task decisions

### 3.1 TASK 2 — expense deductibility
**Decision: the law classifies the expense, not the user. The user is asked only about the residue the law cannot reach.**

My first version of this section said "no Researcher, the user declares". That was wrong, and it conflated two different unknowns:

| Unknown | What it is | Can research settle it? |
|---|---|---|
| **Which kinds of expense are deductible, which are expressly not, which carry a statutory cap or percentage** | a question of **law** | **Yes.** Primary sources: Codul fiscal — the venituri independente chapter's definition of deductible cheltuieli and its cross-reference to the general deductibility/limitation article, plus the list of expressly non-deductible cheltuieli. |
| **Whether *this* OMV invoice was for the delivery van or the owner's personal car** | a **fact about the user's transaction** | No. No source answers it. This is the only genuine residue. |

So the Researcher **is** required here (reversing the earlier call). What research cannot do is tell us what an individual purchase was for — and that is not what the user should be doing accounting for either.

**Design:**

1. **Controlled category vocabulary on `Expense`.** Corrected by TASK 2a: `Expense` (`src/data/types.ts:39`) carries **no category field at all** — the `categoria: string` my first draft referred to exists only on `DocumentItem` (`types.ts:93`), an unrelated document list. TASK 2b must **add** the field, not replace one.
2. **A deductibility rule set in the rule store** — not a generic rule engine. Each rule maps `category + context → deductible | non_deductible | capped(percentage) | undetermined`, and carries the same provenance every other rule carries (`sourceAct`, `sourceArticle`, `sourceUrl`, `verifiedAt`, `status`, `version`). This is what makes Task 6 pay for itself: a corrected or newly verified per-category rule is a **new rule release**, and classification improves with no user action.
3. **Classification is automatic** for every category the rules cover. The estimate's breakdown names each category **and the rule that justified it**, so "explain the deductible total" is answered by data, not by a guess.
4. **Only the undetermined residue surfaces**, as a count with one action ("N cheltuieli fără încadrare — alege categoria"), never a form per expense and never a checklist the user must clear.
5. **Capped categories are not user chores.** Where the law fixes a treatment, the app applies it and says so. Where the treatment depends on a fact the app does not have (a vehicle usage log, a protocol ceiling measured against net revenue), that line is `undetermined` **with the missing fact named** — it does not become a data-entry task.
6. **Never silently deductible.** An undetermined expense is excluded from the deductible total and shown as its own line. This is the conservative direction *for the user*: an over-generous deduction is their fiscal liability, not ours.
7. **Migration:** existing expenses keep their text; they become `undetermined` **only where no rule maps their category**. The goal is that most map automatically, so the residue is small from day one.

**Consequence for scheduling:** this is larger than the brief assumed. Split it into two sequential Workers — **2a** Researcher + the deductibility rule set (domain only, no UI), then **2b** the category vocabulary, persistence/migration, classification wiring into `estimateBasis.ts`, and the minimal UI. Still one Worker at a time.

**Out of scope:** building a VAT treatment system, and any per-record "is this business-related" interrogation of the user.

#### 3.1.0 Status — TASK 2a DONE (`1583d9e`)

39 rules in `src/domain/fiscal/deductibility2026.ts`, all `taxRegime: 'expense-deductibility'`, each citing its own litera of CF art. 68 or Normele HG 1/2016 pct. 7. Package 9 → 48. Pure classifier `classifyExpenseDeductibility(...)` returns treatment **+ the rule that produced it**, with a `refused` state for art. 68^3. Suite 50 files / 810 tests. No stored snapshot digest moved; no migration added.

### 3.1.1 Legal basis as actually verified — `research/21_expense_deductibility_framework_2026.md`

The Researcher's findings **overturned the premise of this task**, and the correction matters:

- The governing article for a PFA on sistem real is **CF art. 68**, not art. 123 and not art. 21. Art. 68 is self-contained: its own conditions (alin. (4)), its own capped items (alin. (5)), its own cap base (alin. (6)) and its own **express non-deductible list (alin. (7))**.
- **Title IV (art. 61-133) contains zero references to art. 21.** Art. 21 in the 2026 consolidation is about IFRS taxpayers; the corporate general rule is **art. 25 alin. (1)**. Art. 68 borrows only four *named* Titlul II concepts (depreciation/art. 28, art. 28 alin. (4), art. 28 alin. (20), the destination list at art. 25 alin. (3) lit. b), and the reference rate at art. 27 alin. (7) lit. b)). **Any other corporate limit applied to a PFA is a fabrication.**
- The **50 % vehicle rule does exist for a PFA** — art. 68 alin. (7) lit. k), with a one-car-per-person limit (alin. (5) lit. j)) and a **foaie de parcurs** condition for full deduction. Depreciation sits outside the cap.
- **CAS/CASS are not art. 68 expenses**; they are deducted later at the *venitul net anual impozabil* stage, art. 118 alin. (2) lit. b), capped by alin. (2^4). **This confirms what `tax.ts` already does**, and art. 118 alin. (2) lit. b) expressly excludes the art. 174 alin. (6) CASS difference from deduction — which independently **validates B-13**.
- 2026 changes that reach this regime: **Legea 239/2025** (new **art. 68^3** — flat 30 % for *cazare*, from 2026 incomes) and **OUG 8/2026** (new capped letters g^1, g^2, s; art. 28 threshold 2.500 → **5.000 lei**). **OG 22/2025 is VAT-only** and **Legea 141/2025 did not touch art. 68 or art. 118** (verified by scanning all 18 amendment notes on art. 68).

Three new defect rows were opened from this and must not be lost: **B-29** (art. 68^3 cazare not modelled — a hospitality PFA currently gets the wrong regime), **B-30** (the deductible amount must be net of *actually deductible* VAT; non-deductible VAT is added back), **B-31** (no asset/depreciation model, so a capital purchase is deducted as an ordinary expense contrary to art. 68 alin. (7) lit. h)).

TASK 2a therefore has a duty beyond classification: **where the law says there is no expense engine at all (art. 68^3), the app must refuse rather than compute a plausible number.**

### 3.2 TASK 3 — persist tax-reserve
- Persist on `AppData` using the existing store/migration architecture. Two read sites, **both** must change: `dashboard.ts:169` **and `dashboard.ts:263`** — the original brief names only one; fixing one leaves the bug live.
- `reservedAmount: Bani | null`; `null` means "no reserve recorded" and renders as such — never 0.
- The reserve **must not** feed the tax calculation.
- Acceptance includes a reload test: enter → reload → same value.

### 3.3 TASK 4 — threshold semantics
**Decision: replace the single `breached` flag with a typed kind + separate user severity. Delete `breachMeaning`.**

- Kinds: `registration` · `tier_transition` · `over_limit` · `informational`. Below a contribution **floor** is `tier_transition` or `informational`, never a breach.
- `breachMeaningFor` and the "dezcalificare din regim" / "schimbare de regim" strings are **deleted**, not reworded.
- Applicability is computed from the profile/fiscal context: CASS rows respect the salary/pension/top-up exceptions; `VAT_REGISTRATION` is applicable only when the user's VAT state makes it matter.
- The 10 % warning distance stays an **application policy**, labelled as such, never a statutory fact.
- User severity is a separate dimension from legal/calculation status.
- **Researcher: one narrow question only** — the legal consequence, if any, of net income below the CAS 12-SM floor for a 2026 PFA on sistem real, from primary sources. Everything else here is engineering semantics, not law.
- Note the asymmetry Task 1 left behind and this task owns: the four contribution rows now measure **annual projected** VNA while `VAT_REGISTRATION` measures **YTD** turnover. That is intentional and must be labelled, not unified.

### 3.4 TASK 5 — pension / CASS input model
- A bare `pensionStatus` boolean is too broad. Replace with the fact the law actually keys on, per the Researcher's answer (pension **income** and whether it applies in the fiscal year).
- The CASS exception must remove **only** the applicable top-up/adjustment — never CASS entirely.
- `REVIEW_REQUIRED` where the data cannot establish the treatment.
- **Researcher required**: primary-source basis for the pension treatment of CASS for independent activities, 2026.

### 3.5 TASK 6 — rule-release immutability (the one not to let slip)
**Decision: content-address the rule set; do not redesign the release model.**

- A snapshot today freezes release *metadata*, not parameter values, and `releaseId` / `createdAt: '2026-01-01'` never changed across the Phase 3-5 formula corrections. That is the defect.
- Fix: a **content hash over the effective rule set** embedded in the snapshot; real `createdAt`; per-rule `version` bumped when the legal/formula content materially changes (not a display number).
- Lifecycle documented and enforced: `PROPOSED → VALIDATED → STAGED → SCHEDULED → ACTIVE → SUPERSEDED`. A revision gets a **new identity**, never an in-place edit of an ACTIVE rule.
- Superseded releases stay readable for historical snapshot interpretation.
- Find and name every place permanently hard-wired to `PFA_2026_RELEASE` / `PFA_2026_SYSTEM_REAL_PACKAGE` instead of selecting by taxYear/effective date/state. **Do not build future-year automation** — make the boundary correct.
- Fixtures: R1 active → R2 active later → an R1 snapshot still reproduces → a new calculation uses R2.

### 3.6 TASK 7 — user-facing language (its own Worker, as the audit insists)
- One central copy layer; no sentences scattered in components.
- Never render an enum: `review_required`, `computed`, `breached`, `min-base`, `not_applicable` are internal.
- Legal uncertainty = **"Notă de interpretare"** + one plain sentence on what the law does not state and what the app does.
- Breakdown collapsed behind **"Cum am ajuns la această sumă"**; sources behind **"Surse și note de interpretare"**. Never hover-only.
- `Settings` currently prints the literal `review_required` plus statute paragraphs — in scope.
- **Grammar pass by a native speaker, not just terminology.** TASK 5 shipped `nu înregistrat` in six Settings dropdowns — ungrammatical (`nu` + past participle with no auxiliary). Corrected 2026-10-09 to `nu este înregistrat`, and the hint that repeated it. Sweep for the same class: bare `nu` + participle, calques from English, and any internal enum token rendered as if it were Romanian.

### 3.7 TASK 8 — prioritisation and severity
- Shared attention model: `severity` · `state` · `source` · `title` · `description` · `target`. **Four dimensions, never collapsed into one field.**
- Real work must appear: the seed holds a pending revenue, a rejected revenue, a rejected expense and a pending declaration — **none** currently surface.
- Completed items leave attention surfaces; empty sections collapse rather than show a large empty card; no duplicate card + action for the same issue.
- Legislation: never say "no legislative changes" when the monitor holds no verified data. Say monitoring is unavailable/inactive. The published-vs-effective minimum-wage example (HG 146/2026, 1 July 2026) already in the rule store should surface **with** whether it affects this user.
- Tax estimate must visually distinguish computed / review-required / unavailable.

### 3.8 TASK 9 — hygiene (small, mechanical, separate)
- Date stamps from git (see §2.1).
- **3 `legalteka.ro` URLs remain against 6 `legislatie.just.ro`** — replace secondary with primary, or downgrade the citation honestly.
- Seed: 2020 start, SRL identity, SRL company documents, own-CUI colliding with a customer CUI, seed declarations contradicting seed transactions.
- Mobile chart overflow at 390 px (renders 657 px, clipped); two card systems with mixed h2/h3 and inconsistent padding.
- Heading/padding consistency; the "Revenue figures disagree" report (9.317 incl-VAT strip vs 7.700 threshold) is **correct by design** — different bases — and is a **labelling** fix for Task 7, not a bug.
- **Add a browser-level reload test for the tax reserve** (user decision, 2026-10-09). TASK 3 proved the round trip in jsdom against real `localStorage`; a Playwright test — record a reserve, reload the page, assert the same value — is the one that exercises a real browser's storage lifecycle. **This raises e2e from 36 to 37**, so every brief that pins "e2e 36 passed" must be read as 36 *until TASK 9 lands*. **LANDED 2026-10-09 (TASK 9):** the test exists in `e2e/dashboard.spec.ts` ("a recorded reserve survives a reload"), and **e2e is now 37** — see `phases/23_provenance_hygiene.md` §7. The counts in the table above are the TASK 1 round's and are left as written.
- **Docs hygiene:** `docs/ai/briefs/` holds **two briefs numbered 14** (`14_projection_tax_estimate.md`, `14_task1_projection_estimate.md`), and `docs/ai/phases/` still holds `_WORKING_NOTES_phase10.md` and `_WORKING_NOTES_task1.md`. Renumber or retire them so the brief sequence is unambiguous. **DONE 2026-10-09 (TASK 9):** the two working notes are now `docs/ai/notes/working_notes_phase10.md` and `docs/ai/notes/working_notes_task1.md`, and the orphan brief 14 is retired to `docs/ai/notes/brief14_projection_tax_estimate_superseded.md`; the survivor is `docs/ai/briefs/14_task1_projection_estimate.md`, the one `phases/12` cites. See `phases/23_provenance_hygiene.md` §8.

---

**TASK 2d — the protocol base is PRE-CAP (user decision, 2026-10-09).** Art. 68 alin. (6) never says whether „cheltuielile deductibile" in the base means the amounts as recorded or the amounts after the other alin. (5) ceilings. Pre-cap subtracts more → smaller base → smaller allowance → **can never cause an underpayment**. Post-cap is the generous reading (pinned example: 146,30 lei vs 54,00 lei) and **must still be shown to the user** — the flip may not be silent.

**TASK 10 — what research 23 actually settled.** The euro caps convert at the BNR **annual average for the year of payment** (HG 1/2016 Titlul IV Cap. II pct. 7 alin. (6)), and ANAF itself quotes that rule with its citation in the Brașov and București PFA brochures — but **no primary source reconciles it with CF art. 9 alin. (3) lit. b) + alin. (4)**, which reserve exceptions to „prevăzute expres în prezentul cod" and the norms are not the code. So the app uses the norm's rule **and discloses the conflict**. Three hard constraints: (1) the annual average is **obtainable, not computable** — BNR publishes `CURSA_EURM` and defines the annual average as an average of *monthly averages*, so a mean of daily rates gives a different number; (2) **there is no FY2026 annual average yet** — it is published after the year closes, so any 2026 cap is provisional (defect **B-33**); (3) the daily-rate endpoints moved to **`curs.bnr.ro`** on 6 Aug 2026, and the **25.000 euro** sistem-real threshold is anchored to the *year of income realisation*, not the year of payment — one conversion function must not serve both without a `basis` parameter.

## 4. Where the two audits contradict each other — resolved here

| Conflict | Audit A | Audit B | Decision |
|---|---|---|---|
| Completeness card | "weighted percentage with a bar" | "Do **not** use a percentage/score" | **No score.** Show only what is missing, each with a link to fix it. A score implies a completeness certainty the data does not support, and it invites gaming. |
| List length | "cap at about 5" | "maximum 3 per section" | **3** on the single top-level attention surface; up to **5** in a supporting section, ranked. |
| Thresholds first | threshold semantics first | projection first | **Projection first** (done), thresholds next — see §1. |
| "Ești la zi" | unreachable due to the circular taxEstimate check | hide empty sections | Both: remove the circular check **and** collapse the section when nothing is outstanding. |

---

## 5. Explicitly out of scope this round

Single-bundle 757 kB chunking · e-Factura (Phase 11+) · D430 · e-Tachigraphe · VIES/ANAF live checks · banking integrations · a generic rule engine · future-year legislation automation · any test-suite rewrite.

---

## 6. Known infra defect carried into every brief

The scout profile's default model exits without producing output. Working override: `llama-cpp/qwen3.8-flash-next-iq3_s`. This has now cost a full 12m32s scout run. It is a **BLOCKER-class** condition in the contract: retry once with the override, and if that fails, stop and report — never substitute silent self-inspection.
