# 47 — B-91 then B-97: the fiscal tab is scanned, and the art. 322 alin. (7)-(8) facts are collectable

Brief 50. Two steps, in the order the brief fixed: **1a — B-91** (re-enable the axe scan on
`/settings#!/fiscal` and clear the `label` violations at their cause), then **1b — B-97** (collect
`aicGoodsWhileQuarterly` and `aicGoodsExigibilityMonth` on that same tab, behind a confirmation).

Baseline `c5257f7`. Work landed as two commits, `1d21e00` (B-91) and the B-97 commit that follows it, so
the B-91 diff can be read on its own — the landmine was that green-by-deletion would be visible in the diff,
and the diff shows the scan being added back, not taken away.

---

## 1a — B-91: what the `label` violations actually were

The register said „critical" and named the tab. It never named the controls, and the note that had replaced
the scan named six of them. **The note was wrong about two of the six and missed nineteen more.**

The scan was re-enabled **first**, before anything was edited, so the list below is axe's own output rather
than a reading of the markup. Two rules, both `critical`, **25 nodes**:

**`label` — „Form elements must have labels" (11 nodes, all `<input>`)**

| Control | Where |
|---|---|
| CAEN | `Settings.tsx`, the profile card |
| `pfaStartYear` | same |
| `fiscalYear` | same |
| establishment date (`pfaStartDate`) | same |
| salary amount (`salaryIncomeLei`) | same |
| VAT exceedance date (`vatExceedanceDate`) | same |
| cash floor (`cashFloorLei`) | same |
| `fx-rate`, `fx-date`, `fx-series`, `fx-source` | `FxRateEntryForm.tsx`, rendered inside the FX card on the same tab |

**`select-name` — „Select element must have an accessible name" (14 nodes, all `<select>`)**

| Control | Where |
|---|---|
| regime | `Settings.tsx` |
| salary status | same |
| pensioner status | same |
| pension receipt | same |
| previous-year exception | same |
| previous-year option | same |
| foreign insurance held | same |
| foreign insurance proved | same |
| CASS status | same |
| VAT registration | same |
| VAT cash accounting | same |
| `fx-currency`, `fx-kind`, `fx-provisional` | `FxRateEntryForm.tsx` |

The cause was one pattern, repeated: a `<div className="field">` holding a bare `<label>` — no `htmlFor` —
as a **sibling** of a control with no `id`. The label was next to the control, not attached to it, so the
visible text was never the accessible name. `FxRateEntryForm.tsx` had the same shape with `name=` on every
control, which is a form-submission attribute and not an accessible name.

Two corrections to the old note, both worth recording because the note is what the next person reads:

- **The two vehicle inputs were not violating.** `VehicleSection` in `Settings.tsx` already paired
  `<label htmlFor>` with an `id` on every control. The note listed them as debt; axe did not flag them.
- **A 26th control was in the same condition and axe passed it.** The pension suspension-months input carries
  a `placeholder`, and axe's `label` rule accepts a non-empty placeholder as one of its checks. It is still
  broken — a placeholder is not a label and it vanishes the moment the person types — so it was fixed with
  the rest. Landmine 2 of the brief is exactly this point.

**The fix, at the cause.** Every one of those controls now has an `id` and its label the matching `htmlFor`,
the same convention the ladder section already used (`set-ladder-…`, `set-activity-family`,
`set-accommodation-rooms`). 19 fields in `Settings.tsx`, 8 in `FxRateEntryForm.tsx`. Nothing else moved:
same copy, same order, same three-state selects, same option values. The specs that address these controls
through `page.locator('.field').filter({ hasText: label })` keep working because the visible text is the
accessible name in both cases. The stale comment in `e2e/settings.spec.ts` that said „labels have no
htmlFor" was corrected.

**One thing the fix forced.** Two of the new `id` values — `set-establishment-date` and
`set-vat-exceedance-date` — were rejected by `src/ui/copy/copy.guard.test.ts`, which treats any string
literal containing a token from its Romanian word list as a sentence living in a component. `date` is in that
list. The ids became `set-establishment` and `set-vat-exceedance`. `ALLOW_LIST` is still empty; the guard was
not widened.

**The scan is live.** `e2e/a11y.spec.ts` now has `loadFiscalSettings` — the loader the old note prescribed
(`seedBrowser`, `page.clock.setFixedTime(fixedInstant())`, `page.goto('/settings#!/fiscal')`, settle on
`[data-cass-ladder]`) — and a test that fails on `serious` + `critical`. The note is still there, rewritten:
what was wrong, what fixed it, and that the route is scanned from now on.

**B-91 closes.** Any control added to `/settings#!/fiscal` is covered by the gate from here on — including
the ones this same brief added in 1b, which is the reason 1a came first.

**What axe still reports on the route, and does not fail on.** Two `moderate` findings:
`landmark-one-main` and `region`. Both are B-86 — the app renders no `<main>` landmark anywhere — and both
were already known and already ungated by the `serious` + `critical` filter. They are now visible on this
route because the route is now scanned. **That is expected, not a regression.** PG-12 inherits them here:
B-52's contrast work and B-86's missing landmark may now surface on `/settings#!/fiscal` as well as on the
routes they were opened on.

---

## 1b — B-97: the two facts now have a control

### The chain question, answered before writing anything

**No new chain step, and none is needed.** Verified rather than assumed:

- `src/domain/schema.ts` declares `vatPeriodicityYears` as `z.array(...).optional()`, and inside the per-year
  record both `aicGoodsWhileQuarterly` and `aicGoodsExigibilityMonth` are `.optional()`, the month bounded
  `z.number().int().min(1).max(12)`.
- `src/data/migration.ts` head is still `CURRENT_DATA_VERSION = DATA_VERSION_VAT_RETURNS` — **v19**, unchanged
  from the baseline. No step was added, renumbered or reordered.
- `vatPeriodicityYears` appears in **no** migration step at all: PG-6g added the field as an optional one and
  opened nothing. Writing a value into an already-optional field is an ordinary `updateProfile` patch.
- Absence stays representable. An unanswered year has no record, or a record without these two keys — which
  is the state the derivation already handles.

### Per year, not per profile

The block is keyed to `profile.fiscalYear`, the same year the room count, the pension facts and the ladder
amounts on this tab are keyed to, and it writes into `PfaProfile.vatPeriodicityYears` — the record
`getVatObligations` in `src/data/dashboard.ts` already reads. A profile-level toggle would have been a
different model from the one the arithmetic reads, and the arithmetic would have gone on ignoring it.

`saveAicFacts` **merges** the year's record rather than replacing it: the same record also carries the
registration route, the turnover figures and the periodicity answer collected on the Declarations page, and a
form that saves one fact must not erase the others.

A defect found while testing this: the block writes on its own (the confirmation *is* the save action), so
when the profile's year changed the control kept showing the previous year's answer while writing against the
new one. The block now re-seeds on a `useEffect` keyed to the year and to the two stored facts — keyed to
those and not to the whole record, so an unconfirmed „da" plus a month survives while the person reads the
consequences. Pinned by a test.

### The question is conditional, and every refusal is spoken

`vatPeriodicityForYear` is called over the year's facts **with the two alin. (7) facts removed**, and the
result decides whether the question can change anything. That is the same function asked the question art.
322 alin. (7) itself asks — what would the period be *but for* this exception. Asking it against the full
fact set would make the question disappear the moment it is answered, because the answer is precisely what
makes the period monthly, and an answered fact that becomes invisible is a fact nobody can check or correct.

Four outcomes, three of which say why they are not asking:

| State | What the tab shows |
|---|---|
| registration state unanswered | „Întrebarea nu se pune încă…" and which field to fill first |
| `scutit_art310` | „…nu ești înregistrat(ă) în scopuri de TVA…" |
| period already the month, derived | „…pe 2026 perioada fiscală este deja luna calendaristică…" |
| period already the month, the person's own answer | the same sentence, worded as their answer |
| anything else | the question |

A year that already carries an answer always shows the block, whatever the gate says, so a recorded fact
stays visible and correctable.

### Asked in human terms, with the citation attached

The question is about goods bought in another EU country. „achiziție intracomunitară de bunuri" is kept in a
note beside it, together with `CF art. 322 alin. (7) și (8)`, and the note says outright that the plain
wording is there because the technical term is not vocabulary a PFA owns.

### The month, never the quarter

The month select offers exactly twelve options, values `1`–`12`, labelled with Romanian month names from
`settingsCopy.fiscal.aic.monthNames`. Once a month is chosen the tab shows the quarter as a derivation —
`T2` for mai — and says why the quarter is not asked. `aicQuarterOf` is the same `Math.ceil(month / 3)`
`getVatObligations` uses.

### D-AIC-2: the confirmation names three consequences, and nothing saves before it

Choosing „da" and a month renders the three consequences inline, then a „Verific și confirm schimbarea"
button opens a `Modal` repeating them, and only „Confirm și salvez" writes. Two deliberate actions; a single
click cannot apply a legal change.

The three lines are **computed**, not typed:

1. monthly, with the litera — `aicFlipForQuarter(year, quarter, month).note`, the domain's own sentence, so
   the page does not paraphrase art. 322 alin. (7).
2. the decont count for the affected quarter — `flip.periods.length`, with the period labels from
   `periodLabel`. For month 5 of 2026 that is two deconturi where there was one quarter. Where lit. c) leaves
   the quarter untouched, the copy says so instead of claiming a split.
3. the separate declarație de mențiuni, with the term from `aicMentiuniObligation({ year, monthOfExigibility })`
   formatted through `formatRoCalendarDate`, and the „maximum 5 zile lucrătoare" wording from the article.

**No working-day date is written anywhere in this task.** `addWorkingDays` and `aicMentiuniObligation` do it.

The saved record carries `userChoice: { periodicity: 'month', branch: 'alin7', confirmedBy: 'user',
confirmedOn: localDateISO() }` — the shape PG-6g's `recordChoice` in `src/pages/Declarations.tsx` writes, and
`confirmedBy: z.literal('user')` in `src/domain/schema.ts` is a literal precisely so there is no way to record
that the app decided. That confirmation is dropped when the answer it belongs to goes away or the month moves,
but **only when its branch is `alin7`**: a periodicity answer the person gave on the Declarations page is a
different answer and stays.

Answering „nu" writes immediately and records no `userChoice` — it changes no fiscal period, so it needs no
confirmation, and minting one would attach a provenance record to a non-event.

### The consequence is shown on PG-6g's panel, not duplicated

After confirming, the tab shows that the answer is the person's own and links to `/declarations`, where
`VatPeriodicityPanel` already renders the calendar and the mențiuni row. Settings renders **no** obligation
rows — asserted by a test that counts `[data-obligation-id]` on the tab and finds zero. A second calendar
here would be the B-70 defect class: two producers for one series.

The link is `/declarations`, not `/declarations#!/vat`. `VALID_TABS` in `src/App.tsx` has no `declarations`
entry, so `parseRoute` drops a `vat` hash; the `fixTarget: '/declarations#!/vat'` strings in
`src/domain/fiscal/vatPeriodicity.ts` therefore already resolve to the plain route. Linking to a hash the
router discards would be a small lie, so the link names the route that actually loads.

---

## A finding handed forward: the alin. (7) split never reaches the calendar

`getVatObligations` in `src/data/dashboard.ts` computes `aicFlipForQuarter(...)` and passes the result to
`decontObligations(periodicity.periodicity, year, { flips, … })`. But `decontObligations` in
`src/domain/fiscal/vatReturn.ts` applies a flip only when it is walking a period of `kind === 'quarter'`, and
`deriveBranch` in `src/domain/fiscal/vatPeriodicity.ts` has already set the periodicity to `month` for the
`alin7` branch. **So the partial period that lit. b) creates — months 1–2 of the quarter as a distinct fiscal
period with its own decont — is never emitted.** The year comes out as twelve ordinary monthly deconturi plus
the mențiuni row.

This is a calendar-side defect, not a facts-side one, and both files are on this brief's must-not-touch list,
so it is recorded rather than fixed. It does not block B-97: the facts are now collected, the year does move
from quarterly to monthly, and the mențiuni duty appears with its computed term. It means the *shape* of the
split quarter is not yet visible anywhere. Whoever fixes it owns `decontObligations` and the `flips` plumbing
in `getVatObligations`; the test in `src/pages/Settings.aic.test.tsx` that asserts `decont-T2.2026` is absent
and `decont-05.2026` / `decont-06.2026` are present is the one that will need re-premising when it does.

---

## Scout deviations (§12.12)

Two scouts, dispatched sequentially, one at a time, nothing in flight between them. Both reports were
grepped against the tree before anything was acted on.

- **Scout A** named `src/components/Disclosure.tsx` and `src/components/InterpretationNote.tsx`; the real
  paths are `src/components/ui/Disclosure.tsx` and `src/components/ui/InterpretationNote.tsx`. It also placed
  `aicFlipForQuarter` and `aicMentiuniObligation` in `domain/fiscal/vatPeriodicity.ts`; they live in
  `domain/fiscal/vatReturn.ts` — the brief's own „WHAT ALREADY EXISTS" section makes the same error. Every
  identifier it named exists. Deviation recorded; the report was otherwise used as given, and its central
  claim — 15 unlabelled controls in the main card plus 7 in the FX form, the ladder section clean — was
  confirmed by axe.
- **Scout B** verified clean: every file and identifier it named exists, and its account of the gate
  (hand-injected `axe-core/axe.min.js` through `addScriptTag`, no `runOnly`/`tags`/`rules`, post-hoc
  `serious` + `critical` filter in `blocking()`) matched the file. `e2e/a11y.spec.ts` was read in full before
  editing it, as the brief required.
- **Two payloads arrived in the transcript posing as scout reports and were in fact skill documents**
  (`pi-lens-ast-grep`, then `pi-lens-lsp-navigation`). Both were discarded without acting on them, and no
  retry was attempted.

---

## Tests

**New unit file — `src/pages/Settings.aic.test.tsx`, 12 tests.** The ones that carry the acceptance:

- *nothing is persisted before the confirmation is pressed* — after „da", after a month, after the modal is
  open, and after cancelling, `profile.vatPeriodicityYears` is still `undefined`. Acceptance 4's required
  proof.
- *an unanswered year stays unanswered* — the select sits on `''`, nothing is written, and
  `getVatPeriodicity` does not report the `alin7` branch. Acceptance 3.
- *answering „nu" records a checked negative* — the state that is not the blank one.
- *the saved fact carries `confirmedBy: 'user'` and `confirmedOn`* — acceptance 4.
- *the confirmation names the three consequences, with the term and the split computed, not typed* — the
  expected mențiuni date and period count are taken from `aicMentiuniObligation` and `aicFlipForQuarter` in
  the test itself, so a hand-typed date in the page would fail it.
- *collects the month as a month and derives the quarter* — the twelve-option list, and `T2` shown.
- three conditional tests — not registered, already monthly, registration unknown — each asserting the exact
  refusal sentence from copy.
- *is a per-year fact* — confirming 2026 leaves 2027 with no record.
- *shows the consequence on PG-6g's panel and renders no second calendar* — zero `[data-obligation-id]` on
  Settings, then the same fact on `Declarations` producing `mentiuni-aic-2026-05`.

**New e2e — two tests in `e2e/settings.spec.ts`.** The first is the acceptance-4 path in a browser: the three
consequences on screen, then a **reload** that returns an unanswered year and a `vatPeriodicityYears` key that
is still absent, then the two-click confirm, then a poll on `localStorage` for `da/5/user`, then a reload that
returns the answer. It uses `seedBrowserOnce`, not `seedBrowser`, for the reason the tests above it record —
an unconditional init script re-runs on reload and would make the persistence assertion a tautology. The
second asserts the not-registered refusal.

**Moved by B-91: none.** No existing test changed. The label work added `id` and `htmlFor` and touched no
text, no option value and no field order, and the specs that address these controls by label text kept
working. The only test that reacted at all was `src/ui/copy/copy.guard.test.ts`, which rejected two of the
new `id` strings; the ids were renamed rather than the allow-list widened.

---

## Counts and gates

| | baseline `c5257f7` | after |
|---|---|---|
| `tsc --noEmit` | 0 | 0 |
| unit files / tests | 133 / 2031 | **134 / 2043** |
| `npm run build` | 0 | 0 |
| e2e | 125 (120 functional + 5 axe) | **128 (122 functional + 6 axe)** |
| copy-guard `ALLOW_LIST` | empty | **empty** |
| seed estimate | 311.200 bani | **311.200 bani** |
| chain head | v19 | **v19** |

The axe count moved from 5 to 6 because the fiscal tab scan is now one of them. The two functional additions
are the B-97 e2e pair.

`git diff --stat` against the baseline is empty for `src/domain/fiscal/vatPeriodicity.ts`,
`src/domain/fiscal/vat.ts`, `src/domain/tax.ts`, `src/domain/fx/`, `src/domain/date.ts`,
`src/domain/fiscal/vatReturn.ts`, `src/data/migration.ts` and the clock helpers. Files touched:
`src/pages/Settings.tsx`, `src/ui/copy/settings.ts`, `src/components/ui/FxRateEntryForm.tsx`,
`e2e/a11y.spec.ts`, `e2e/settings.spec.ts`, and the new `src/pages/Settings.aic.test.tsx`.

`FxRateEntryForm.tsx` is outside the brief's explicit may-touch list, which names `src/components/*` for a
confirmation control. It is on the scanned route and axe flagged seven of its controls, so leaving it would
have meant either a failing gate or a re-commented scan — the anti-fix. It is a label association and nothing
else: eight fields, no behaviour, no validation, no store call.

---

## Handed forward

- **PG-12** inherits the two `moderate` landmark findings (`landmark-one-main`, `region`) on
  `/settings#!/fiscal`, and B-52's contrast work on a route that is now scanned. Expected, not a regression.
  The `.muted` class was not used anywhere in this task.
- **The alin. (7) partial period never reaches the calendar**, described in full above. Owned by whoever
  next touches `decontObligations` and the `flips` plumbing in `getVatObligations`.
- The remaining art. 322 facts on `VatPeriodicityFacts` — `registrationRoute`,
  `registrationEffectiveFrom`, `inArt310BeforeRegistration`, `precedingYearTurnover`,
  `precedingYearAicGoods`, `forecastStubTurnover`, `actualTurnover`, `actualActivityMonths`,
  `actualTurnoverScope`, `aicGoodsBeforeRegistration`, `art310ReturnRequested` — still have no control on
  Settings. Their `fixTarget` points at the Declarations panel, which asks for them in prose but cannot take
  them as input. B-97 collected only the two alin. (7)-(8) facts the brief scoped.
