# Phase 9b — Worker notes: deadline corrections

Worker: Phase 9b. Spec: `docs/ai/briefs/10_deadline_corrections.md`.
Baseline commit: `30d2698`. HEAD at time of writing: `529ca48` (orchestrator committed docs during
this run; no `docs/` file of mine is in that commit and I did not touch `docs/ai/STATE.md`).

Everything below is stated from the primary text recorded in
`docs/ai/research/11_pfa_first_year_and_vat_registration_deadlines_2026.md`,
`docs/ai/research/12_quarterly_payment_deadlines_2026.md` and
`docs/ai/research/15_verification_of_deadline_claims_2026.md`. I ran no research; I only made the
code agree with what is already verified.

---

## 1. Files changed

| File | Change |
|---|---|
| `src/domain/deadlines.ts` | `DeadlineEventType` cut to 2 members; `computeDeadlines` rewritten to be **rule-driven and literal-free**; `vatExceedanceMonth` → `vatExceedanceDate`; `monthEnd()` deleted; `isApplicable()` deleted; event binding registry added |
| `src/domain/fiscal/rules.ts` | `FiscalParameter['unit']` extended with `'days' \| 'text'` (additive; no exhaustive switch on `unit` exists anywhere) |
| `src/domain/fiscal/package2026.ts` | `PFA_DEADLINE_2026` citation + comment corrected, rule params made declarative; **new rule `VAT_REGISTRATION_DEADLINE_2026`** |
| `src/domain/fiscal/release2026.ts` | `VAT_REGISTRATION_DEADLINE_2026` added to `ruleIds` (a rule not in the release is never selected — silent non-existence) |
| `src/components/dashboard/DeadlineSection.tsx` | `labelFor` switch cut to 2 cases |
| `src/components/dashboard/ActionSection.tsx`, `src/domain/insights.ts` | dead label keys removed; `new_pfa` relabelled |
| `src/data/dashboard.ts` | comment only: why `pfaStartDate` is inert and why no VAT exceedance date is passed |
| tests | `deadlines.test.ts` rewritten (33 → 38 tests), `fiscal.test.ts`, `dashboard.test.ts`, `DeadlineSection.test.tsx`, `ActionSection.test.tsx`, `e2e/dashboard.spec.ts` |
| `src/data/store.migration.test.ts` | **B-23, separate commit** — wall-clock assertion removed |

Unit suite: 603 → **614 tests**, 41 files. e2e: **34 tests**.

---

## 2. What I deleted, and why

Four of the six `DeadlineEventType` members are gone. They were not miscitations to repair — **the
obligations do not exist in fiscal year 2026**, which is why no article could be found for them and
why deleting is the only honest fix:

| Deleted | Cited | Reality |
|---|---|---|
| `income_tax_advance` (25 Mar/Jun/Sep/Dec) | CF art. 81 | Art. 81 is the **payroll declarative article** and is cross-referenced **0 times** in the consolidated CF. The advance-payment articles **art. 120 / 120¹ are `Abrogat.` from 01-01-2025** (OUG 128/2024 pct. 11 Art. I, MO 1125/11.11.2024). Real rule: art. 68 alin. (9)-(10) → art. 122 alin. (3), **annual, 25 May**. |
| `cas_quarterly` (15 Apr/Jul/Oct/Jan) | CF art. 160 | Art. 160 is `Abrogat.` — *„(la 01-01-2018, Articolul 160 … a fost abrogat de Punctul 71, Articolul I din ORDONANȚA DE URGENȚĂ nr. 79 din 8 noiembrie 2017, MO nr. 885 din 10 noiembrie 2017)"*. Dead for eight years. CAS declarare **and** plată are the same single date: **art. 151 alin. (1)**. |
| `cass_quarterly` (15 Apr/Jul/Oct/Jan) | CF art. 170 | Art. 170 is *„Baza de calcul al contribuției de asigurări sociale de sănătate"* — a **base** article, no dates at all. Payment: **art. 174 alin. (15) → 25 May**. |
| `pfa_estimated_declaration` (start + 15 days) | CF art. 81 | Basis art. 120 abrogated 01-01-2025, and it duplicated the already-correct `d212_filing`. A PFA opened at any point in 2026 files its first Declarația Unică by **25.05.2027**: art. 122 alin. (3) *„Prevederea se aplică și în situațiile prevăzute la alin. (2)."* |

There is **no quarterly payment deadline for a PFA în sistem real in 2026**. Income tax, CAS and CASS
are each declared *and* paid by 25 May of the following year — art. 68 alin. (10), art. 151 alin. (1)
and art. 174 alin. (15) each route to art. 122 alin. (3).

I did **not** add a `fiscal_registration` type or any 30-day rule (brief §2c). CPF (Legea nr. 207/2015,
MO 547/23.07.2015; forma consolidată 08.08.2026, Portal Legislativ doc **312603**) art. 82 alin. (6)
lit. c) attaches the 30-day `declarație de înregistrare fiscală` to natural persons working
independently *„cu excepția celor care se înregistrează, potrivit legii speciale, la registrul
comerțului"* — and a PFA is inside that carve-out: OUG 44/2008 art. 7 alin. (1) makes
registrul-comerțului registration mandatory before activity begins, and art. 13 alin. (3) of the same
act makes the ONRC certificate itself the act of fiscal taking-into-evidence.

Citation hygiene I kept: the procedure code cites **Legea nr. 207/2015**, never "OG 2/2024" (a
fabricated label). **No note count appears in code or UI anywhere** — Portal Legislativ publishes
none, and every count in the research files is an unreproducible derived value. Doc id +
consolidation date only.

---

## 3. The rule-parameter design

`computeDeadlines` no longer contains a single date or article literal. It iterates
`selectApplicableRules(rules, {taxYear, asOfDate})`, keeps `taxRegime === 'deadlines'`, and reads:

| Parameter | Meaning |
|---|---|
| `event_type` | which `DeadlineEventType` the rule produces; must be in the `DEADLINE_EVENT_TYPES` registry |
| `applies_to` | audience key (`pfa`, `vat-registered-pfa`); the Romanian labels live in the components |
| `event` | present ⇒ event-relative; the key must exist in `EVENT_DATE` (only `vat_exceedance` does) |
| `offset_days` | days from event (or from the fixed date) to the deadline; **required** for event rules |
| `deadline` | present and no `event` ⇒ fixed calendar date, validated against `^\d{4}-\d{2}-\d{2}$` |

Contract:
- **Absent rule ⇒ no deadline.** No literal fallback exists, so a deadline cannot be rendered unless
  a rule produced it. This is the structural fix: previously four of six event types were hardcoded
  arrays inside `computeDeadlines`, and the `Deadline` shape had no field in which a citation could
  live — which is exactly how confident-looking article strings came to be attached to obligations
  that do not exist.
- **Malformed rule ⇒ emit nothing** (unknown/missing `event_type`, missing `applies_to`, event rule
  without a numeric `offset_days`, unparsable `deadline`). Never fabricate, never default a date.
- **Unresolvable event ⇒ `date: null, status: 'not_applicable'`**, preserving the old contract;
  `filterUpcoming`, `DeadlineSection` and `insights` all exclude it.
- `deadlineId` is now the **ruleId**, so every rendered deadline names the rule that produced it.
- `effectiveFrom`/`effectiveTo` now come from the rule for every deadline (previously `null` for
  event-relative ones). Small behaviour change, strictly more informative.

Tests that would fail under the old code:
- `computeDeadlines` for taxYear **1999 / 2025 / 2027 → 0 deadlines** (the old engine fabricated
  twelve quarterly dates for any year at all);
- mutate a rule's `sourceArticle` → the emitted `legalSource.article` changes (proves no literal);
- remove `PFA_DEADLINE_2026` from the package → its deadline disappears;
- the four deleted event types are emitted for **no** query in a six-query sweep;
- `fiscal.test.ts` now asserts **every package rule is listed in the release** (the mirror of the
  existing test — a rule left out of the release silently does not exist).

`isApplicable()` was **deleted**, not repaired: it was dead, had no production caller, took a `rule`
but only ever looked for `d212_filing`, and inventing a caller for it would have been worse than
removing it.

---

## 4. VAT registration: `offset_days = 0` and what it does to the UI

`VAT_REGISTRATION_DEADLINE_2026` implements CF art. 316 alin. (1) lit. b) — the request is due
*„cel târziu la data depășirii plafonului"* — with **`offset_days = 0`, because the deadline IS the
exceedance date.** There is no grace period to add; `isoDaysAfter(date, 0)` is the identity.
Registration then takes effect from that same day (art. 316 alin. (1^1) lit. b)). Both provisions are
as amended by **ORDONANȚA nr. 22 din 28.08.2025 — an OG, not an OUG — pct. 18-19 Art. I, MO 806
din 29.08.2025**, in force 01-09-2025. The ceiling (art. 310 alin. (1), 395.000 lei) is **not
duplicated** on this rule: `VAT_THRESHOLD_2026` owns it, one figure one source.

The old code's `month_end(exceedance_month) + 30 days`, cited to "art. 338", **never existed in any
period** (art. 338 is the TVA contravention chapter; string counts in the consolidation:
`30 de zile de la sfârșitul lunii` → 0).

Consequence for the UI, asserted in `deadlines.test.ts` and `DeadlineSection.test.tsx`: with offset 0,
a resolved VAT deadline classifies as **`due_today`** when `asOfDate == exceedanceDate` and **`past`**
after it, so `filterUpcoming` never shows it in the Termene limită card. That is correct — past that
day the registration obligation is **overdue**, and "N zile rămase" would misstate it. I did not bend
the filter.

Precision the brief leaves implicit: "never upcoming" holds whenever the exceedance date is not in the
future. A query that supplied a *future* exceedance date would classify it `upcoming` — but that input
is not physically meaningful (you cannot know the plafon was depășit before it happened). My tests
assert the `due_today` and `past` cases, not a blanket impossibility.

**The UI-facing half of §2b is currently unobservable, and I did not invent a way to observe it.** No
profile field anywhere in this app records the date on which the TVA ceiling was exceeded
(`grep -rn exceed src/domain/models.ts src/domain/schema.ts src/data/seed.ts` → nothing), so
`getUpcomingDeadlines` never passes one and the rule always resolves
`date: null, status: 'not_applicable'` in the running app. Adding a `vatExceedanceDate` profile field
would be new data-model surface nobody asked for; it is a Phase 10+ decision, not a deadline fix.

---

## 5. `pfaStartDate` is inert, structurally

The field stays on `DeadlineQuery` (documented as deliberately unread) but **no event key binds to
it**: `DeadlineEventKey` is `'vat_exceedance'` only. A rule that declares `event: 'pfa_start'`
therefore cannot resolve and yields `date: null, status: 'not_applicable'` — there is a test for
exactly that rogue rule. The silence is structural, not a convention a future edit can quietly forget.

`dashboard.test.ts` asserts the strongest form: `computeDeadlines` results for a query **with** a PFA
start date are `toEqual` the results without it, and for four different start dates the only dated
deadline is `2027-05-25`. Any future rule that starts consuming the start date turns that red.

---

## 6. New e2e counts and how they were derived

asOf = real today (2026-10-07), seed `fiscalYear: 2026`. After the change `computeDeadlines` emits
exactly two rows: `PFA_DEADLINE_2026` (2027-05-25, active) and `VAT_REGISTRATION_DEADLINE_2026`
(dateless, not_applicable).

- **Termene limită** (`filterUpcoming`): 6 rows → **1** row (`Depunere D212`, `25.05.2027`,
  `Activ` ×1). Added explicit absence assertions for the labels `CAS trimestrial`,
  `CASS trimestrial`, `Avans impozit pe venit`, `Declarație estimativă PFA`, `Înregistrare TVA` and
  for the dates `15.04.2026 15.07.2026 15.10.2026 15.01.2027 25.03.2026 25.06.2026 25.09.2026
  25.12.2026` — including 15.04.2026, which is the 3 % bonificație date for the **2025** year
  (OUG 8/2026 art. 8), not a 2026 deadline.
- **Ce trebuie să faci**: 8 → **3** items (`3 item de rezolvat`, `.action-label` ×3,
  `Termen limită` ×1) = 1 deadline + 1 completeness + 1 tax.
- **Observații**: 13 → **4** insights. D212 is 230 days out (> 30 ⇒ no alert) and the VAT row has an
  empty date (skipped), so **0** deadline insights: `Termen depășit: PFA` ×0,
  `Termen apropiat: PFA` ×0. Remaining: 1 threshold danger (the collapsed CAS/CASS floor breach),
  1 completeness warning, 1 reserve warning, 1 tax info ⇒ badges **Urgent ×1, Atenție ×2, Info ×1**.
- **Phase 9 describe** retitled to *"a PFA start date resolves no deadline"*: with a `pfaStartDate`
  (today + 5 days) in localStorage, the card shows exactly **1** row and **0** rows for
  `Declarație estimativă PFA` / `Înregistrare TVA`.

**Caveat, pre-existing and not fixed (out of scope):** these e2e counts are clock-dependent — asOf is
the real browser date. D212 stays "upcoming" until 2027-05-25, and it starts producing a
`Termen apropiat` insight once it is ≤ 30 days away, which would change the Observații counts again.
Making e2e deterministic requires injecting the clock into the app, which is a larger change than
this phase. Related: B-23 below.

---

## 7. B-23 — separate commit, and a rule for this suite

`src/data/store.migration.test.ts:91` asserted `p.fiscalYear === new Date().getFullYear()` while the
seed pins `fiscalYear: 2026`. It goes red on 2027-01-01 for no code reason. `legacyProfileFromSettings`
already takes an injectable `instant` for exactly this purpose, so the test now passes
`new Date('2026-06-01T12:00:00Z')` and asserts `fiscalYear === 2026` and `pfaStartYear === 2026`.

**No test in this suite may read the wall clock.** `grep -rn "new Date()" src --include=*.test.*` now
returns nothing. The one remaining clock read is `e2e/dashboard.spec.ts:426`
(`Date.now() + 5 days`), which is deliberate: the start date is now inert, so the test no longer
depends on the clock at all — it only needs a future start date to prove nothing is derived from it.

---

## 8. Where I went beyond the brief, and where I disagree

1. **`new_pfa` relabelled, not deleted** (ActionSection + insights). The brief listed only the four
   deleted event types as label-map keys to remove. But `new_pfa` was labelled *"Declarație
   estimativă PFA"* — a label naming an obligation abrogated on 01-01-2025 — and no rule emits
   `new_pfa`. Deleting the key would have been churn; leaving the text invites the same bug back. I
   relabelled it to `PFA nou` (matching `DeadlineSection`) and left the key for a future first-year
   rule. Flagging as a judgement call.
2. **`unit` union extended** with `'days' | 'text'`. The brief said to carry the formula as a rule
   parameter but did not address that `FiscalParameter['unit']` had no member for a string or a day
   count. Verified additive: no exhaustive switch on `unit` exists in the repo.
3. **Brief §2b vs reality** — not a contradiction, but an unmet precondition: §2b's UI assertion
   presumes a resolvable VAT deadline, and this codebase has no input that can resolve one (§4 above).
   I implemented the rule and the domain-level assertions and left the UI path dateless rather than
   inventing a profile field.
4. **Brief §4 vs §2c contradiction check:** I found **no remaining internal contradiction** in the
   brief, so I did not stop. §4's test list is consistent with §2c (the brief already records that the
   old §4 contradicted §2c and was corrected).
5. **`calcDeadline` left untouched** per §3.5, even though it can only read a fixed `deadline`
   parameter and therefore answers `reviewRequired` for the event-relative rule. No production impact:
   `computeDeadlines` reads `parameters` directly and never routes deadline rules through
   `calculatorRegistry`. I pinned the current behaviour with a named test
   *"deadline calculator cannot express an event-relative rule (Phase 10 follow-up)"* so the gap
   cannot be forgotten.
6. **Non-goals honoured:** no 30-day rule, no normă de venit deadline, no historical VAT rule, no
   15 April 2026 deadline, no PL 204/2026 (3 working days — a pending bill), no 26 May 2026
   (unverified prorogation), `d212_filing` not gated, `src/domain/tax.ts` / calculators / money code
   untouched.

---

## 9. Follow-ups for the orchestrator

- **Phase 10:** extend `calcDeadline` (or add a calculator) so an event-relative deadline rule can
  express itself; today it is the only rule in the package whose calculator cannot consume it.
- **Data model:** if the VAT registration deadline should ever appear in the UI, add a
  `vatExceedanceDate` to the profile and pass it in `src/data/dashboard.ts`. The rule is already wired
  for it — `event: 'vat_exceedance'`, `offset_days: 0`.
- **2027 ruleset:** re-check art. 122 alin. (3) (GAP U-3: which act last amended it is unpinned, the
  ANAF consolidation being annotative) and the pending PL 204/2026 ("cel mult 3 zile lucrătoare de la
  data depășirii plafonului") before writing next year's package.
- **Historical ruleset (not 2026):** for periods up to 31-08-2025 the VAT term was `month_end + 10
  days` at a 300.000-lei ceiling — corroborated only by secondary sources (an ANAF page and the
  Senate expunere de motives for PL 204/2026). Deliberately **not encoded**: this app is pinned to
  fiscal year 2026 and the brief lists it as a non-goal.
- **e2e determinism:** inject the clock so the Termene limită / Observații counts stop depending on
  the machine date (see §6 caveat, and B-23).

---

## 10. Verification (exit codes read directly, no pipelines into grep)

| Command | Exit | Result |
|---|---|---|
| `npx tsc --noEmit` | **0** | clean |
| `npx vitest run` | **0** | 41 files, **614 tests** passed |
| `npm run build` | **0** | `tsc && vite build`, 767 modules |
| `npm run test:e2e` | **0** | **34 tests** passed |

Each command was run to completion with output redirected to a file and `$?` printed on its own line;
the log was filtered in a separate step. No test run was piped into `grep`/`tail`.
