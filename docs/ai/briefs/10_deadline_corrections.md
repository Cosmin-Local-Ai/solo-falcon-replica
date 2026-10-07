# Brief 10 — Phase 9b: delete the phantom deadlines, ground the rest in rules

> **Status: staged, not yet spawned.** A second Researcher pass (`deadline-sweep-researcher`, 2026-10-07) is
> running on three further obligations the user surfaced — a possible 30-day declaration at PFA setup, the
> VAT return once registered, and e-Factura transmission. If those land as real, this brief widens to cover
> them rather than spawning a second Worker over the same file. See `docs/ai/research/13_*` when it exists.

> **On the 30-day claim specifically:** it is the same shape as `pfa_estimated_declaration`, which §1 deletes.
> If the sweep shows a genuine 30-day duty at setup, it is almost certainly the **CPF fiscal-registration**
> declaration that §2c already adds — not a CF income-estimation filing. Do not reinstate the phantom under a
> new name.

**You are one Worker. Do not spawn other agents. Do not run a Researcher.** Everything you need is in this
brief and in `docs/ai/research/11_...md` and `docs/ai/research/12_...md`. The legal research is **done**;
your job is to make the code agree with it.

## 0. The finding you are implementing

`docs/ai/research/12_quarterly_payment_deadlines_2026.md` (commit `f9a88fe`) establishes, with verbatim text
and hit counts from Portal Legislativ doc 312601 (2,021 amendment notes, latest 08-08-2026):

> **There are no quarterly payment deadlines for a PFA în sistem real in fiscal year 2026.** Income tax, CAS
> and CASS are all declared **and** paid by **25 May** of the following year — art. 68 alin. (9)-(10),
> art. 151 alin. (1), art. 174 alin. (15), each routing to art. 122 alin. (3).

And `docs/ai/research/11_pfa_first_year_and_vat_registration_deadlines_2026.md` (commit `c577fe6`) establishes
that `pfa_estimated_declaration` implements an obligation abrogated on 01-01-2025, and that VAT registration is
due **on the day the plafon is exceeded**, never `month_end + 30 days`.

**So four of the six deadline event types must be deleted, not re-cited.** Do not try to find a correct
article for them. There isn't one, because the obligation does not exist. Re-citing a non-existent obligation
is the failure this phase exists to remove.

## 1. Delete these four event types entirely

| Event type | Why |
|---|---|
| `income_tax_advance` | No instalment obligation for art. 68 income. Art. 120/120¹ are `Abrogat` from 01-01-2025. Art. 81 is payroll and is cross-referenced **0** times in the CF. |
| `cas_quarterly` | Cites **art. 160, which is `Abrogat.` from 01-01-2018** (OUG 79/2017 pct. 71, MO 885/10.11.2017). CAS declarare *and* plată are both 25 May, art. 151 alin. (1). |
| `cass_quarterly` | Art. 170 is *Baza de calcul* and contains no dates. CASS payment is art. 174 alin. (15) → 25 May. |
| `pfa_estimated_declaration` | Basis abrogated 01-01-2025; duplicates the correct `d212_filing`. `research/11` §4. |

Remove them from `DeadlineEventType`, from `computeDeadlines`, from the label maps in
`src/components/dashboard/ActionSection.tsx:31-37` and `src/domain/insights.ts:51-57`, and from the
`labelFor` switch in `src/components/dashboard/DeadlineSection.tsx:39-49`. Remove their tests.

## 2. Move every surviving deadline into the 2026 rules package

This is the point of the phase, not a refactor for tidiness. Today only `PFA_DEADLINE_2026` is a `FiscalRule`
(`src/domain/fiscal/package2026.ts:241`). The other four event types are hardcoded arrays and string literals
in `src/domain/deadlines.ts:117-166` — **there is no field in which a citation could live**, which is exactly
why twelve fabricated deadlines shipped with confident-looking article strings attached.

Required end state:

- `computeDeadlines` contains **no date literals and no article literals**. Every date and every citation comes
  from a `FiscalRule` in the package. If a rule is absent from the applicable set, that deadline is **not
  emitted** — it must not fall back to a literal.
- `DeadlineEventType` becomes exactly: `'d212_filing' | 'vat_registration' | 'fiscal_registration'`.
- Carry the formula as a rule parameter rather than as code, e.g. an `offsetDays` parameter, so the event-relative
  rules are data. `FiscalRule` already has `parameters`, `sourceAct`, `sourceArticle`, `sourceUrl`,
  `verifiedAt`, `effectiveFrom`, `effectiveTo`, `status` (`src/domain/fiscal/rules.ts:19-37`) — use them.

### 2a. `PFA_DEADLINE_2026` — keep, correct two things

- `sourceArticle` is currently `'art. 122 alin. (3); payment art. 123 alin. (1)'`. **The payment half is a
  mis-attribution.** Art. 123 alin. (1) is the **rate** provision („Impozitul **anual** datorat se stabilește
  … prin aplicarea cotei de 10%…"). The payment provision is **art. 68 alin. (10)**. Change to
  `'art. 122 alin. (3); payment art. 68 alin. (10)'`.
- Delete the `GAP U-4 (UNVERIFIED)` sentence from the rule's comment — U-4 is now closed by `research/12`.
  **Keep** the U-3 note (which act last amended art. 122 alin. (3) is still not pinned) and keep the note that
  OUG 8/2026 art. 8 is an incentive, not a deadline change.
- The `2027-05-25` value stays. It is correct and verified.

### 2b. Add `VAT_REGISTRATION_DEADLINE_2026`

- Basis: **CF art. 316 alin. (1) lit. b)** — the request must be made *„cel târziu la data depășirii
  plafonului"*, and **alin. (1¹) lit. b)** makes registration effective from that same day. Amended by
  **OG 22/2025 pct. 18-19, MO 806/29.08.2025, effective 01-09-2025**. Ceiling: art. 310 alin. (1), 395,000 lei.
- **`offsetDays` = 0.** The deadline *is* the exceedance date.
- Rename the query field `vatExceedanceMonth` → **`vatExceedanceDate`** (ISO `YYYY-MM-DD`). A month is no
  longer enough information, because the deadline is a specific day. `monthEnd()` becomes unused — delete it.
- **Do not hide the semantic oddity; assert it.** Because the deadline coincides with the event, a resolved VAT
  registration deadline classifies as `past` or `due_today`, never `upcoming`. That is correct: if the date has
  passed, the registration obligation is overdue. Write a test that states this explicitly, and make sure the
  UI wording does not claim „N zile rămase" for something that is overdue. If `filterUpcoming` therefore drops
  it from the *Termene limită* card, that is acceptable — say so in your notes rather than bending the filter.

### 2c. Add `FISCAL_REGISTRATION_DEADLINE_2026`

- Basis: **CPF (Legea 207/2015) art. 82 alin. (6) lit. c)** — *„Declarația de înregistrare fiscală se depune
  în termen de 30 de zile de la: … c) data începerii activității pentru persoanele fizice care desfășoară
  activități economice în mod independent sau exercită profesii libere…"*. Source of record: Portal Legislativ
  doc **304520** (828 notes, latest 18-12-2025). Alin. (6) last amended by OUG 30/2017, MO 708/31.08.2017.
- **`offsetDays` = 30 from `pfaStartDate`.** This is the deadline that legitimately consumes the PFA start date —
  the one `pfa_estimated_declaration` was falsely standing in for.
- `sourceAct` must say **Cod de procedură fiscală**, not Cod fiscal. This is the first CPF-sourced rule in the
  package; `research/11` §1 and `research/10` C-1 (as superseded there) explain why doc 304520 is usable and
  doc 172697 is not. Put that in the rule's comment.
- Confidence is **medium-high** (single-source, not corroborated by this repo). Record that in the rule comment
  honestly — do not present it at the same confidence as the art. 122 term.

## 3. Explicit non-goals — encoding any of these is a regression

1. **No historical VAT rule.** For periods up to 31-08-2025 the rule was `month_end + 10 days` at a 300,000-lei
   ceiling (`research/11` §6). That text was corroborated only by secondary sources (an ANAF page and the
   Senate's *expunere de motive*), and the app is pinned to fiscal year 2026. **Do not encode it.** Note it as
   a requirement for any future historical ruleset.
2. **No 15 April 2026 deadline.** This one is a trap and it is a trap this repository has already been near:
   the **3% bonificație for filing and paying by 15 April 2026 is real, verified law** — OUG 8/2026 art. 8, and
   `research/09` established it. But it is a **2025-only incentive**, not a 2026 deadline, and it looks exactly
   like a quarterly instalment date. `research/12` §8 flags it as the most likely source of a recurrence of
   this exact error. Keep the existing comment in `PFA_DEADLINE_2026` that says so.
3. **No PL 204/2026** (proposed 3 working days for VAT registration) and **no 26 May 2026** (unverified
   secondary prorogation claim — `research/12` gap 4). CF art. 122 alin. (3) says 25 May.
4. **Do not gate `d212_filing`.** Whether a PFA with zero income must still file the DU is not established by
   `research/12`; do not invent a gate. Open it as a question instead.
5. **Do not touch `src/domain/tax.ts`, the calculators, or any money/rounding code.** Phase 10 owns that.

## 4. Tests and the cascade you must expect

`e2e/dashboard.spec.ts` pins the fabricated deadlines. Expect to change:

- `:204-220` — currently asserts **6 upcoming** deadline rows including `15.10.2026` ×2, `15.01.2027` ×2,
  `25.12.2026`. Those dates must no longer appear **at all**. Assert their absence, not just a lower count.
- `:259` (6 deadline actions), `:277` (7 overdue / 2 upcoming), `:297` (8 Urgent / 4 Atenție) — all derived
  from deadline counts. Recompute them from the new reality; do not adjust them until they pass.
- `:383-458` — the Phase 9 test. **`:456` asserts `Declarație estimativă PFA` is visible. Delete that
  assertion**; it pins a phantom rule. **Keep `:458`** (`Înregistrare TVA` count 0): the guarantee that a PFA
  *start* date must not resolve a *VAT* deadline is still correct and still valuable. Re-point the test at
  `fiscal_registration` for the start-date half.

Add tests that would fail under the old code:
- no `cas_quarterly` / `cass_quarterly` / `income_tax_advance` / `pfa_estimated_declaration` event type is ever
  emitted, for any query;
- no date or article literal survives in `deadlines.ts` (assert the emitted `legalSource.article` comes from
  the rule, e.g. by mutating the rule's `sourceArticle` in a test and seeing it flow through);
- removing a rule from the package removes its deadline (proves no literal fallback);
- VAT registration deadline equals the exceedance date exactly, offset 0, and classifies as `past`/`due_today`;
- fiscal registration equals `pfaStartDate + 30 days`, and a VAT exceedance date does **not** resolve it.

**`isApplicable` (`deadlines.ts:236-245`) is dead and misleading** — it takes a `rule` argument but only ever
looks for `d212_filing`, so it returns false for every other event type. It has no production caller. Delete
it, or rewrite it to be event-type aware and give it a caller. Leaving it as-is is not acceptable.

## 5. Also fix, as a clearly separate final step

**B-23** (`STATE.md`): `src/data/store.migration.test.ts:91` asserts `p.fiscalYear === new Date().getFullYear()`
while the seed pins `fiscalYear: 2026` (`seed.ts:7`). It goes red on 2027-01-01 for no code reason. Assert
against the seed's own `fiscalYear` or an explicit constant. Keep it as its own commit so it is visible in the
diff, and state in your notes that no test in this suite may read the wall clock.

## 6. Deliverable

- Code + tests, `npx tsc --noEmit` clean, full `npx vitest run` green, `npm run build` green, and the e2e suite
  green. **Check exit codes yourself; do not pipe a test run into `grep` and trust `&&`** — a pipeline returns
  grep's status, and that is how a red run got committed in a previous phase.
- Worker notes in `docs/ai/notes/phase9b_worker_notes.md`: what you deleted and why, the rule-parameter design,
  the VAT `offsetDays = 0` semantic and what it means for the UI, the new counts in `e2e/dashboard.spec.ts` and
  how you derived them, and anything in this brief you judged wrong. **If you disagree with the brief, say so in
  the notes and do the defensible thing** — a previous Worker overrode a brief of mine and was right.
- Do not edit `docs/ai/STATE.md`; I own the state file.
