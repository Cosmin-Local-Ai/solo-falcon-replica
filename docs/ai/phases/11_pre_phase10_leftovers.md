# Pre-Phase-10 leftovers — B-23, B-21, P-PROFILE-VAT-DATE, B-19, and the 24 SM CAS tier floor

**Date:** 2026-10-08 · **Brief:** `docs/ai/briefs/11_pre_phase10_leftovers.md` · **Baseline HEAD:** `01ab824`
**Commits:** `9752b11` (B-23) · `8530f1d` (B-21) · `f5e63e8` (P-PROFILE-VAT-DATE) · `180edc5` (B-19) ·
`7768dfe` (§7 item 5) · `9d7d3af` (§7 items 8-9, docs only)
**Measured at close:** `npx tsc --noEmit` **0 errors** · `npm run test` **44 files / 685 tests passing** ·
`npm run build` **exit 0** · `npm run test:e2e` **34 passed**. Baseline at `01ab824` was
0 / 41 files / 614 tests / exit 0 / 34 — every number in this document was measured by the person writing it.

This is **not a phase**. It is the set of items that had accumulated owners but no phase: three defects
that every phase handed past, one defect whose legal question had been answered but whose code had not
caught up, and two Phase 6 §7 items that had been filed under "deliberately not implemented" for so long
they read as decisions. Phase 10 (money precision) starts after this and was **not** entered here.

---

## 1. What was in scope, and what was fenced off

| # | Item | Outcome |
|---|---|---|
| 1 | **B-23** — a test asserted against the wall clock | **closed**, and the rule made enforceable (§2) |
| 2 | **B-21** — every record date is an unvalidated string, and the fiscal predicate drops anything malformed silently | **closed** (§3) |
| 3 | **P-PROFILE-VAT-DATE** — a correct, cited, rule-driven VAT deadline that could never fire | **closed** (§4) |
| 4 | **B-19** — a stored flag zeroes CASS with no legal basis, and the app calls it a *scutire* | **closed as an honesty defect**; no amount changed (§5) |
| 5 | **Phase 6 §7 item 5** — the 24 SM CAS ladder step had no surface | **built** (§6) |
| 6 | **Phase 6 §7 items 8 and 9** — CAEN-keyed rules; a VAT regime richer than the boolean `vatExempt` | **blocked on source**, recorded as such (§7) |

Fenced off and not touched: money representation, rounding, `lib/format.ts`, float→bani, `totalDue`
types, `tax.ts` rounding (B-17), the e-Factura SLA term, and any re-citation of the rules Phase 9b made
rule-driven. No legal rule, threshold, rate, date or citation was invented in this pass; every citation
below was already in the repo or in `docs/ai/research/20_*`.

---

## 2. B-23 — the no-wall-clock rule is now enforced, not just stated

**Honest split first.** The assertion named in the defect — `store.migration.test.ts:91`
`p.fiscalYear === new Date().getFullYear()` — **was already deleted in Phase 9b** (commit `edae614`).
The STATE.md defect row still said "open" while the phase table said "closed". So this task did not fix a
broken test; it fixed a **stale register row** and then made the standing rule ("no assertion may read the
clock") something the suite enforces instead of something a human remembers.

What shipped (`9752b11`):

- **New `src/test/wallClockGuard.test.ts`.** It fails the suite if any `src/**/*.test.{ts,tsx}` contains a
  zero-argument `new Date()`, `Date.now()` or `performance.now()`. The suite reads **its own source**
  through Vite: `import.meta.glob('/src/**/*.test.{ts,tsx}', { query: '?raw', import: 'default', eager: true })`.
  This matters — `@types/node` is not in this project, so `node:fs` / `process` would break `tsc`.
  Comment lines are skipped (the codebase documents this defect in comments), and `e2e/**` is out of the
  guard's reach because vitest's include is `src/**` — that limit is stated in the file, not hidden.
  The guard was proven **non-vacuous** with a throwaway probe test file: it went red, and green again after
  the probe was deleted.
- **10 indirect clock reads inside tests were pinned.** These never called `new Date()` themselves; they
  fired `now()` through a default argument in `domain/date.ts` and derived `fiscalYear` / `pfaStartYear` /
  `updatedAt` from the machine date: 5× `legacyProfileFromSettings(settings)`
  (`store.migration.test.ts:33,42,55,62,67`), 2× `createDefaultProfile()` (`profile.test.ts:40,53`),
  `buildDashboardData(data, tax)` (`dashboard.test.ts:215`) and `getActionItems(...)` (`dashboard.test.ts:331`).
  They now pass an explicit instant (`PINNED_INSTANT = new Date('2026-06-01T12:00:00Z')`,
  `AS_OF_INSTANT = new Date('2026-10-01T12:00:00+03:00')`).
- `profile.test.ts` now asserts `fiscalYear` / `pfaStartYear` = 2026 — deterministic only because the
  instant is pinned, which is the point.

**Found and recorded, deliberately not fixed** (none is an assertion on the clock, so none is in this
defect's scope): `pages/Documents.tsx:426` `new Date().getFullYear()`; `pages/Revenues.tsx:28`,
`pages/Expenses.tsx:26`, `pages/Declarations.tsx:28` take a **UTC** date where the app's rule is the
Romanian local calendar date (`domain/date.ts` `localDateISO`), so they disagree with the app near
midnight; `pages/Settings.tsx:226` uses `Date.now()` for an id instead of `epochMs()`; and four
`e2e/dashboard.spec.ts` assertions (`:216,219,223,289`) hold only while today < 2027-05-25 — no
`playwright clock` is installed in either config. These are Phase 10-or-later hygiene, now on the record.

---

## 3. B-21 — an unusable date is refused on write and reported on read, never silently dropped

The defect was a **silent deletion**: `inPeriod` (`domain/aggregation.ts`) is
`Number(date.slice(0,4)) === fiscalYear && date <= asOfDate`. `''` and `'2026-6-1'` failed it, so the
record simply stopped existing in every aggregate — no error, no `review_required`, no completeness
signal. `'2026-6-1'` also mis-sorted against `'2026-06-15'` (`'6' > '0'`). Phase 9 had widened the
exposure by making `Revenue.collected` / `Expense.paid` the fiscal dates.

Four layers, in the order data moves (`8530f1d`):

1. **Shape defined once** — `domain/date.ts`: `ISO_CALENDAR_DATE`, `isoCalendarDateProblem()` (shape, then
   month range, then the day against `daysInMonth`, so `2026-13-01` and `2026-02-30` are refused next to
   `''`, `'2026-6-1'`, `'not-a-date'`), `isISOCalendarDate()`, and `isoCalendarDateProblemText()` in
   Romanian. Problem **codes** stay machine-readable English; only the wording shown to a person is
   Romanian, and it says what is wrong in terms someone can act on — no `ISO`, no `AAAA-LL-ZZ`, because
   nobody types these fields by hand (they are `<input type="date">`).
2. **The write path refuses, loudly** — `data/schema.ts` `validateRecordDates(kind, record)` covers every
   date field of all five record kinds; `data/store.tsx` runs it in all 8 record actions and on a violation
   emits an `error` toast naming the record, the Romanian field label and the offending value, and writes
   **nothing** — not to state, not to localStorage. Those actions now return `boolean`, so a rejection is
   assertable rather than merely visible. `CompanyDocument.perioada` / `TaxStatement.perioada` are excluded
   **on purpose**: they are free text (`'T2 2026'`), and date-validating them would be the mirror-image bug
   — destroying data the app is meant to keep. A test pins that `'T2 2026'` still parses.
3. **Deliberately NOT wired into `persistedAppDataSchema`.** That gate's failure mode is
   `store.tsx` → `rejected()` → `data: seedData`: one legacy bad date would quarantine the payload and
   reset **every** record. That is mass silent data loss — the opposite of this fix — and the precedent is
   already written at `domain/schema.ts:43-49`. This is the one place the brief's literal wording
   ("validator at the schema boundary") was **not** followed, and it is recorded here rather than argued
   away: the boundary that must be strict is the **write** boundary, because the read boundary's punishment
   falls on unrelated records.
4. **Already-persisted values are reported, never repaired** — `domain/aggregation.ts` `auditFiscalDates(data)`
   returns `ExcludedFiscalDate[]` with `status: 'review_required'`, the field, the verbatim value and a named
   Romanian reason, for the **resolved** fiscal date (`collected ?? date` / `paid ?? date`) of **every**
   record. `data/dashboard.ts` feeds it to `domain/insights.ts`, which emits one `danger` row
   (`id: 'fiscal-dates'`) naming up to three records and counting the rest. Nothing is backfilled: a date
   invented here would move money between fiscal years on a guess — the same rule Phase 9's `payment-dates`
   migration step set, and `store.migration.chain.test.tsx` fails if that stops being true.

**The comparison is still lexicographic, and that is now proved rather than assumed** — the brief allowed
either replacing it or proving it. `inPeriod` refuses anything `isISOCalendarDate` rejects, so every string
that reaches `date <= asOfDate` is fixed-width 4-2-2, zero-padded, year-first and a real day: exactly the
condition under which character order equals chronological order. `aggregation.test.ts` asserts both the
equivalence and the old counter-example. **Storage stays ISO** because `localYear()` reads the year with
`slice(0,4)` and `inPeriod` compares strings directly — a `DD.MM.YYYY` store would make `slice(0,4)` return
the day and would sort `01.02.2000` before `02.01.1999`. Only presentation is Romanian.

**A second defect of the same class was found and closed on the way:** the `DD.MM.YYYY` formatter existed
**twice**, byte-identical and private, at `components/dashboard/DeadlineSection.tsx:54` and
`domain/insights.ts:47`, and both rendered `undefined.undefined.undefined` for a malformed value. There is
now exactly one presentation formatter, `domain/date.ts` `formatRoCalendarDate()`; no third copy exists; a
malformed value is flagged in place (`not-a-date (dată invalidă)`) instead of rendered as garbage — and it
does **not** throw, because throwing inside a render path blanks the dashboard, which is the same
data-loss-shaped failure this defect is about. `lib/format.ts` was left alone: Phase 10 owns money formatting.

---

## 4. P-PROFILE-VAT-DATE — the rule was right; the input did not exist

`VAT_REGISTRATION_DEADLINE_2026` has been correct, cited (CF art. 316 alin. (1) lit. b) + alin. (1¹) lit. b),
OG 22/2025 pct. 18-19 Art. I, MO 806/29.08.2025) and fully rule-driven since Phase 9b — and it still never
produced a deadline, because `vatExceedanceDate` existed on `DeadlineQuery` and **nothing in the app
populated it**. It always resolved `date: null, status: 'not_applicable'`. This is a missing input, not a
wrong rule, so **the rule and `deadlines.ts` were not touched**, and no date literal was added anywhere.

What was added (`f5e63e8`):

- `PfaProfile.vatExceedanceDate?: string` — the date the CF art. 310 alin. (1) ceiling was crossed.
  **Optional**, because `pfaProfileSchema` is the persisted gate and a required field would invalidate every
  payload written before this change (proven by `store.profileBackfill.test.tsx`). Phase 9b's split
  `pfaStartDate` / `vatExceedanceMonth` stands: this is the exceedance **date**, not the registration date
  and not a month.
- `pfaProfileSchema` validates it with `ISO_CALENDAR_DATE` — and the **identical inline**
  `/^\d{4}-\d{2}-\d{2}$/` that `pfaStartDate` already carried was deduped to that same constant. Two copies
  of one format rule is the same defect class as the two formatters in §3.
- `pages/Settings.tsx` (fiscal tab) renders a date input, validates with `isoCalendarDateProblem` /
  `isoCalendarDateProblemText`, and writes `fiscal.vatExceedanceDate || undefined` — **empty means absent,
  never `''`**, because an empty string would fail the schema and, worse, be a stored malformed date.
- `data/dashboard.ts` passes the value in **both** production callers (`getUpcomingDeadlines` and
  `buildSnapshot`'s `computeDeadlines`).
- `data/migration.ts`: `DATA_VERSION_VAT_DATE = 4` and a **no-op** `3 → 4` step
  (`name: 'vat-exceedance-date'`). It backfills nothing, because no legacy field records the event and an
  invented date would invent a filing deadline. The repo convention is that every version bump is a chain
  step, and `migratePersistedData` throws if a step fails to bump the version.

Acceptance, both directions: a profile with an exceedance date produces exactly one `vat_registration`
deadline dated **that date** (`offset_days = 0`, so the deadline *is* the exceedance date); a profile
without one produces **no** VAT deadline — the silence is correct and the pre-existing test that documented
the bug was kept, not deleted.

---

## 5. B-19 — a CASS zero from a stored flag is labelled honestly, and marked

`research/20` retrieved CF art. 154 verbatim: it is titled „**Exceptări de la plata contribuției de
asigurări sociale de sănătate**", has **alin. (1)-(3) only**, and **no letter covers a natural person
exercising o activitate independentă**. Lit. a) and b) are self-defeating — each ends „…pentru aceste
venituri **datorează contribuție**, conform regulilor specifice prezentului titlu". PFA sistem-real income
is art. 155 alin. (1) lit. b), so the `socialInsuranceStatus` flag has **no basis at all**, and the only
relief for such a person is art. 174 alin. (7) — a non-dueing of the **alin. (6) difference**, not an exemption.

**The naming rule, which is the part that changes code.** `scutit` appears 132 times and `scutire` 209 times
in the fiscal code, and **zero of either anywhere in Titlul V** („Contribuții sociale obligatorii", incl.
art. 150-181). A CASS result must therefore never be called a *scutire*. The code's own two concepts are:

- **„exceptat"** — art. 154 alin. (1), a status-based exemption over a **closed list of personal categories**;
- **„nu se datorează"** — conditional non-due (art. 146, 154, 168, 174, 180, 220⁵); art. 174 alin. (7) reaches
  only the *difference* from alin. (6).

What shipped (`180edc5`) — **labelling plus a marker, nothing else**:

- `domain/snapshots/types.ts`: `CalculationLine` gains `reviewRequired?: boolean` and `reason?: string`;
  `data/schema.ts` declares both `.optional()`. That second file is load-bearing: **zod strips undeclared
  keys**, so a marker that is not declared in the persisted schema is silently erased on load. A test guards it.
- `domain/tax.ts`: the flag branch no longer emits a bare `CASS (exempt) / value: 0`. The line is labelled
  `CASS (exceptat — art. 154 alin. (1); temeiul nu a fost verificat)` or
  `CASS (nu se datorează — temeiul nu a fost verificat)`, carries `reviewRequired: true` with a named reason,
  and a second line states the provenance: no legal basis was found for a PFA exemption under art. 154 alin. (1).
- `pages/Settings.tsx`: the options are now „**exceptat** (art. 154 alin. (1))" and „**nu se datorează**",
  with a hint that art. 154 alin. (1) is a closed list that covers no PFA with independent activity.

**What did not change, deliberately:** no computed amount (the flag still zeroes CASS, and a test pins the
50k/10k fixture total at 4.000 lei); a *grounded* zero (net = 0, art. 174 alin. (2)) is **not** marked, so
the marker keeps meaning "this came from a flag, not from a rule"; the flag was not deleted; the persisted
enum values `exempt` / `neplata` were **not** renamed (that needs a migration this brief did not authorise);
art. 174 alin. (7) was **not** implemented as a substitute; and the **72-SMGW CASS cap was not touched** —
`research/20` confirms art. 170 alin. (1) caps only art. 155 alin. (1) lit. b), so Phase 4's
`max_annual_base` = 291.600 lei stands and **U-8 stays open**.

What remains is not a citation gap but a product question: art. 154 alin. (1) is a closed list of personal
categories, none of them a PFA election, so there is nothing a user-facing „scutit de CASS" control could
honestly switch on.

---

## 6. Phase 6 §7 item 5 — the 24 SM CAS step is a threshold event, not a phantom ceiling

Phase 3 deleted the `CAS_MAX_BASE` row because CF art. 148 alin. (2) sets **floors** („nu poate fi mai mic
decât"), never a cap. Correct — but it left the 24 SM boundary inside a breakdown string: `calcCas` doubled
the floor from 12.150 to 24.300 lei and nothing else in the app noticed. `docs/ai/PLAN.md:277` had already
named the replacement `tier-floor`, so this used the pre-approved name rather than inventing one.

What shipped (`7768dfe`):

- `domain/thresholds.ts`: `ThresholdType` gains `'tier-floor'`; `THRESHOLD_SPECS` gains `CAS_TIER2_FLOOR` on
  `CAS_2026` / `tier2_base` (97.200 lei), base `net-income`, citing the **same** art. 148 alin. (2) lit. b)
  ladder Phase 3 already cites — no new citation, no rate change, no base-value change.
- `statusFor` handles `tier-floor` explicitly: breached at `distance >= 0`, **inclusive**, mirroring
  `calcCas`'s `realized >= tier2Base`, so the row and the amount cannot disagree. Without the explicit
  branch a new type would have fallen into the `else` and been read as a ceiling.
- Wording: the row is `Treaptă de calcul CAS`; its breach meaning is „Peste pragul de 24 SM — baza minimă de
  calcul pentru CAS crește de la 12 SM la 24 SM (nu este plafon)". The amounts 12.150 / 24.300 live in the
  rule parameters (`tier1_cas` / `tier2_cas`), never in a string — a test asserts no lei amount appears in
  the meaning text.
- `domain/insights.ts`: a crossed tier is a **`warning`** titled „Treaptă de calcul depășită: …" naming
  art. 148 alin. (2) lit. b), never „Prag depășit … limita fiscală" — crossing a ladder step disqualifies
  nothing, it raises the minimum base. The CAS/CASS collapse still applies, so at most one cas/cass alert.
- `domain/aggregation.ts` / `data/dashboard.ts`: the snapshot `Threshold.type` union widens to carry
  `'tier-floor'` instead of flattening it to `'income'`.

**Pairing is asserted, not assumed.** `thresholds.test.ts` drives one net income through
`computeThresholds` **and** `calculatorRegistry['calc-cas']` and requires: 60.000 → CAS 12.150 / row `ok`;
97.199 → CAS 12.150 / row `warning` (one leu below the tier, inside the app-chosen 10% band);
97.200 → CAS 24.300 / row `breached`. A guard test keeps any `max_cas` / `max_base` CAS parameter out of the
package; `grep max_cas src/ e2e/` returns only negative guards and comments about the unrelated `max_cass`.

The 10% `warningDistance` band remains an **app-chosen presentation constant with no citation**, and this
pass deliberately did not give it one.

---

## 7. Phase 6 §7 items 8 and 9 — blocked on source, not deferred

Phase 6 §7 listed items 5, 8 and 9 together under "deliberately not implemented", which made three
different situations look like one decision. Item 5 was an implementation gap and is now built. Items 8 and
9 are **not gaps**: there is no source to implement from. They are now labelled that way in `STATE.md`'s
live status paragraph, not only in an archived phase doc.

- **§7.8 CAEN-keyed rules.** `profile.caen` is user-writable and read by **no** rule. The only place CAEN
  carries a legal consequence is the norm-of-income regime, and the 2026 sources of record give no CAEN →
  rule mapping and no norm-of-income values; `norma_venit` is deliberately parseable-but-refused for exactly
  that reason. A CAEN table would be fabricated law. **No code written.**
- **§7.9 A VAT regime richer than the boolean `vatExempt`.** The 2026 sources contain neither the thresholds
  that would select `scutit` / `încărcare taxară` / `taxă pe din afara` nor the treatment such a regime would
  change. The boolean keeps driving the gross/net choice at `tax.ts`; the related question stays open as
  **Q-NETGROSS**. **No code written.**

If a future pass believes it has found a citable source for either, the correct first move is to write the
citation into `docs/ai/research/` and have it verified — not to encode a table.

---

## 8. Invariants that did not move

- **No computed amount changed anywhere.** The seed figures are unchanged: VNA **7.494,50 lei**, total
  **3.104,505 lei** (rendered `3.104,51`), VAT threshold measured on **7.700 lei** excl-VAT, CAS floors
  48.600 / 97.200 lei, CASS `min_base` 24.300 and `max_annual_base` 291.600 lei.
- **No money representation, rounding or formatter change.** `lib/format.ts` untouched; `decimal.js-light`
  is still declared and still never imported (Phase 10).
- **No new legal rule, threshold, rate, date or citation.** Every citation in this pass was already in the
  repo or in `research/20`.
- **No data destroyed.** No backfill, no enum rename, no new required field, no new quarantine trigger. The
  persisted gate was deliberately left permissive (§3.3) and the migration step added is a no-op (§4).
- **No assertion reads the wall clock** in `src/**` — and the guard now fails the suite if one is added.

---

## 9. Tests added

| Area | File | Added |
|---|---|---|
| clock rule | `src/test/wallClockGuard.test.ts` (new) | 2 (the guard scans every `src/**/*.test.*`) |
| clock pins | `store.migration.test.ts`, `profile.test.ts`, `dashboard.test.ts` | 10 reads pinned, +2 assertions |
| date shape | `src/domain/date.test.ts` (new) | 14 |
| write-path rejection | `src/data/store.dateValidation.test.tsx` (new) | 20 |
| aggregation + audit | `src/domain/aggregation.test.ts` | +8 |
| date-integrity insight + tier-floor alerts | `src/domain/insights.test.ts` | +4, +3 |
| VAT exceedance date end-to-end | `src/data/dashboard.test.ts` | +4 |
| migration `3 → 4` no-op | `src/data/store.migration.chain.test.tsx` | updated, +1 |
| Settings fiscal tab | `src/pages/Settings.test.tsx` | +2 |
| CASS flag honesty | `src/domain/tax.test.ts`, `src/data/schema.test.ts` | +4, +1 |
| tier-floor | `src/domain/thresholds.test.ts`, `src/data/dashboard.test.ts`, `src/components/dashboard/ThresholdSection.test.tsx` | +5, +2, +1 |

Suite: **41 files / 614 tests → 44 files / 685 tests** — the per-file figures above are vitest's own
per-file counts and sum to exactly **+71**, which is the measured suite delta. e2e count unchanged (34); the *Praguri* spec was
**re-counted**, not added to: 4 rows → 5, `Curent: 7.494,50 lei` 3 → 4, `În limite` 2 → 3, `Depășit` still 2,
plus `Treaptă de calcul CAS` and `Prag: 97.200,00 lei` visible and `Prag maxim CAS` still absent. The
engine-refusal case went from 3 to 4 loud `review_required` rows — the 24 SM row is measured on the same
base as the other contribution rows, so it must turn loud too.

---

## 10. Verification (measured, not inherited)

| Command | At baseline `01ab824` | At close |
|---|---|---|
| `npx tsc --noEmit` | 0 errors | **0 errors** |
| `npm run test` | 41 files / 614 tests | **44 files / 685 tests** |
| `npm run build` | exit 0 | **exit 0** |
| `npm run test:e2e` | 34 passed | **34 passed** |

Per-task counts: 616 after B-23 · 662 after B-21 · 674 after B-19 · 685 after the tier-floor surface.
No assertion was deleted or weakened to reach green; the only assertion counts that moved are the
threshold counts in §9, which moved because the app now renders one more row.

---

## 11. Archive claims this document supersedes

`docs/ai/steps/*` is a frozen archive (steps 02-34 predate this sprint) and is not evidence of current
behaviour. Where an archived step file contradicts this document, **this document wins**. Concretely, the
archived and phase-level statements that "the 24 SM CAS tier-floor surface is not built", that
`ThresholdType = 'min-base' | 'max-base' | 'registration' | 'income'`, and that the CASS flag's UI label is
„scutit" are all superseded by §5 and §6 above.

---

## 12. Flagged, not touched

- Production clock reads that bypass `domain/date.ts`, and the UTC-vs-Bucharest disagreement they create
  near midnight (§2).
- Four `e2e/dashboard.spec.ts` assertions that hold only while today < 2027-05-25; no Playwright clock is
  installed in either config (§2).
- The production migration chain derives `fiscalYear` from the wall clock
  (`migration.ts:186,218` call `legacyProfileFromSettings(...)` with no instant). Not a test, so outside
  B-23's scope, but it is the same failure waiting in production code.
- `STATE.md`'s Phase 6 reference `models.ts:83` for `vatExempt` was stale — it lands inside `PfaIdentity`;
  `vatExempt` is `models.ts:181`. Corrected in `9d7d3af`.
- Still open and untouched, as assigned elsewhere: **B-17** (rounding policy, Phase 10), **B-16** (fiscal-loss
  persistence), **B-24** (the phantom quarterly deadlines — closed by Phase 9b's rule deletion but the row
  still reads "open" and needs a docs pass), `addSnapshot` still has no production caller,
  `TaxInputsReference.chosenBase` is still unwired, `pensionStatus` is still a flag where art. 174 alin. (7)
  lit. c) needs realised pension income, and there is still no multi-source activity model.

## 13. Out of scope, respected

Phase 10 (money precision: integer bani or `decimal.js-light`, plus a rounding policy **with its legal
basis**) was not entered. No `tax.ts` rounding change, no `format.ts` change, no `totalDue` type change, no
e-Factura SLA term, no new legal research.
