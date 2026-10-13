# 48 — B-99: the art. 322 alin. (7) distinct period now reaches the calendar

Brief `briefs/51_b99_alin7_period.md`. Baseline measured at `0101d22`; work landed on top of `cddb353`.

**B-99 is closed.** The app told the user about a return and then did not list it.

---

## The defect, as it actually ran

`data/dashboard.ts` → `getVatObligations` already read the two B-97 facts, already called
`aicFlipForQuarter(year, q, month)`, already pushed the result into `flips`, and already passed `flips` to
`decontObligations`. **The wiring was correct.** What was wrong is one line inside the builder: it looked a
flip up only when the period it was walking had `kind === 'quarter'`. On the alin. (7) branch
`deriveBranch` in `domain/fiscal/vatPeriodicity.ts` has already returned `periodicity: 'month'`, so
`vatFiscalPeriods('month', year)` handed the builder twelve month periods, none of which is a quarter, and
the flip was **computed, passed in, and never read**.

The consequence was a promise with no object behind it. `aicEffectLines` in `pages/Settings.tsx` renders
`effectReturnsSplit` from `src/ui/copy/settings.ts` — *„În loc de un singur decont pe trimestrul T2, se depun
2 deconturi pentru aceeași perioadă: 04-05.2026, 06.2026."* — and the taxpayer then went to
`pages/Declarations.tsx` and found three ordinary monthly deconturi and no distinct period.

## The fix — one function, in the obligation builder

`src/domain/fiscal/vatReturn.ts` only:

- **`monthSpan(p)`** — the months a `VatFiscalPeriod` covers, as inclusive month numbers. It reuses the same
  period arithmetic the terms are already computed from; it does not re-derive anything.
- **`flipGoverningPeriod(flips, p)`** — replaces the old `p.kind === 'quarter' ? … : undefined`. A flip is
  keyed to a quarter, because alin. (7) speaks in quarters; the join is now **membership of that quarter**,
  so it matches whichever periods of that quarter the walk contains — one quarter, or the three months that
  stand in for it.
- **`substituted`** — a `Set<number>` of quarters already substituted. On a monthly walk one flip governs
  three periods; without this the same decont would be emitted three times.
- **a year guard on `opts.flips`** — `AicFlip` carries no year of its own (only `quarter`, `letter`,
  `periods`, `note`), so the year a flip was computed for is visible only inside its periods. A flip from
  another year would splice that year's periods into this year's list and leave months covered twice or not
  at all, so it is dropped rather than trusted. Every caller builds the flip with the year it renders, so
  this cannot discard a correctly built flip; it is pinned by a test.

**No other file needed to change, and none did.** `data/dashboard.ts` is not in the diff — the wiring was
already right. `domain/deadlines.ts` is not in the diff — `vatObligationDeadlines` turns `o.id` into the
`deadlineId` and `vatReturnForDeadline` matches a filed `VatReturnRecord` on `obligationId`, and that join is
already generic over any period kind. `pages/Declarations.tsx` is not in the diff — the calendar keys its
rows by `o.id`, prints `o.label`, `o.dueOn` and `o.citation` straight from the obligation, and `recordFiling`
already writes `periodKind: 'partial'` with `periodToMonth`, so the new row is dischargeable the moment it
exists. That is confirmed in the browser, not inferred.

## The three letters, month by month — before and after

Exigibility in the second quarter of 2026, one month per cell. **Before** = what the calendar produced on the
alin. (7) branch, where the periodicity is already `month`. **After** = the same call with the fixed builder.

| litera | exigibility | before (12 rows) | after |
|---|---|---|---|
| **a)** | month 1 of the quarter (month 4) | `01 02 03 04 05 06 07 08 09 10 11 12` | `01 02 03 04 05 06 07 08 09 10 11 12` — **12, no distinct period** |
| **b)** | month 2 of the quarter (month 5) | `01 02 03 04 05 06 07 08 09 10 11 12` | `01 02 03 **04-05** 06 07 08 09 10 11 12` — **11 rows** |
| **c)** | month 3 of the quarter (month 6) | `01 02 03 04 05 06 07 08 09 10 11 12` | `01 02 03 **T2** 07 08 09 10 11 12` — **10 rows** |

Every row above is asserted as **month-by-month coverage**, not as presence: each test expands the year's
periods back into months and asserts the list is exactly `1…12`. That is the assertion the fix can fail —
splicing a distinct period *beside* an already-monthly year covers April and May twice, and replacing the
quarter without re-emitting its months drops them.

- **lit. a)** produces no distinct period. A builder that always spliced would have invented an obligation
  the law does not create.
- **lit. b)** produces `decont-04-05.2026`, due **25.06.2026** — `decontTerm` applied to a period ending
  31 May, the same art. 323 alin. (1) formula as every other decont, with the same citation
  `CF art. 323 alin. (1); plată art. 326 alin. (1)`. **No new term and no new citation were introduced**,
  because there is no citation for one.
- **lit. c)** leaves the acquisition quarter a quarter and runs monthly from the next one. The quarter in
  which the acquisition happened is untouched.

## What did not move

- **The quarterly walk.** It already consulted flips, and it must not have drifted. The widened join is
  equivalent there: quarters align to quarter boundaries, so "same quarter" and "overlaps the flip's
  quarter" select the same period, and `substituted` is a no-op because a quarterly walk holds one period
  per quarter. Pinned directly — lit. a) `T1 04 05 06 T3 T4`, lit. b) `T1 04-05 06 T3 T4`, lit. c)
  `T1 T2 T3 T4`, each also asserted to cover `1…12` once.
- **`domain/fiscal/vatPeriodicity.ts`** — `deriveVatPeriodicity`, `deriveBranch`, `aicFlipForQuarter`,
  `aicMentiuniObligation`, `periodicityCapForYear`, `proRateCap`. `git diff --stat` on
  `src/domain/fiscal/vatPeriodicity.ts`, `src/domain/fiscal/vat.ts`, `src/domain/tax.ts` and `src/domain/fx/`
  is **empty**. The derivation was read, not edited: the tempting one-line change was to stop
  `deriveBranch` returning `month` for alin. (7), which would have fixed the calendar by breaking the
  confirmation panel, the completeness channel and the cap arithmetic.
- **The mențiuni duty.** `aicMentiuniObligation` contributes it and the decont builder contributes no
  mențiuni row at all — asserted, so the alin. (8) form cannot be shown twice.
- **Ids.** `periodLabel` renders a month as `MM.YYYY`, a quarter as `T{q} YYYY` and a partial as
  `MM-MM.YYYY`, so `decont-04-05.2026` cannot collide with `decont-04.2026` or with `decont-T2-2026`.
  Uniqueness is asserted for both walks across all twelve months of exigibility, and the
  filing-to-term join is exercised for the new period across a year boundary: an acquisition in November
  2026 gives `decont-10-11.2026` due 25.12.2026 and `decont-12.2026` due **25.01.2027**, and a filed return
  keyed to the December one discharges that term and leaves the distinct period **overdue**.
- **The chain.** Head still `CURRENT_DATA_VERSION` = `DATA_VERSION_VAT_RETURNS` = **19**. No new step: this
  is obligation output, not stored data.
- **The seed estimate.** Still **311.200 bani** — asserted by name in `src/data/dashboard.accommodation.test.ts`,
  which passes unmoved.

## The guard for the whole defect class

Acceptance 3 asked for one test that the number the confirmation **claims** equals the number the calendar
**produces**. It is in `src/pages/Settings.aic.test.tsx`:
*„B-99 — the deconturi the confirmation promises are the deconturi the calendar produces"*. It drives the real
Settings control, reads the number out of the real `effectReturnsSplit` sentence with a regex rather than
hard-coding it, saves the fact, renders `Declarations`, and counts the calendar rows covering that quarter.
It is proven to bite: with the old quarter-only join restored, it fails with
*“expected … to have a length of 2 but got 3”*.

The same round trip is proven in the browser in `e2e/settings.spec.ts`
*„B-99 — the split the confirmation promises is the split the filing calendar lists"*: answer „da", month 5,
confirm, go to `/declarations`, and the row `decont-04-05.2026` is there with term `25.06.2026` and the
art. 323 alin. (1) citation, `decont-05.2026` is **absent**, the mențiuni row appears exactly once, and
recording a filing against the distinct period marks that row `Depusă` while June stays `Neconsemnată`.
With the old join it fails at the first assertion — the row does not exist.

## Tests that moved

1. `src/pages/Settings.aic.test.tsx` — *„shows the consequence on PG-6g's Form 300 panel and renders no
   second calendar on Settings"*. **Before:** asserted `decont-05.2026` and `decont-06.2026` present and
   `decont-T2.2026` absent, with an inline comment recording that the lit. b) split was *not* rendered and
   that the fix belonged to a file that task must not touch. **After:** asserts `decont-04-05.2026` and
   `decont-06.2026` present, `decont-05.2026` **absent** (May is inside the distinct period, it no longer has
   a return of its own), `decont-T2.2026` absent, and the mențiuni row exactly once. This is the intended
   move, not a re-baseline: the assertion that changed is the one that had been pinned to the defect.
2. `src/domain/fiscal/vatReturn.test.ts` — *„the distinct alin. (7) period is representable, because
   `partial` exists"*. Its fixture hand-wrote `obligationId: 'decont-04-05-2026'`, which is **not** the id the
   calendar generates (`decont-04-05.2026` — a dash inside the period, a dot before the year). It was inert,
   because nothing compared it, but an id that does not match the generator is a join key waiting to
   false-pass. It now takes the id from `decontObligations` itself and asserts the literal.

No other existing test moved. `src/pages/Declarations.test.tsx` pins a quarterly profile and is untouched;
`e2e/settings.spec.ts` asserts `[data-obligation-id]` count 0 on the Settings tab, which still holds —
Settings renders no second calendar.

## New tests

- `src/domain/fiscal/vatReturn.test.ts` — a `B-99` block, 7 tests: lit. a) / lit. b) / lit. c) on a monthly
  walk, each with month-by-month coverage; the quarterly walk unchanged for all three letters; id
  uniqueness plus coverage for both walks over all twelve months; a flip from another year is dropped; the
  decont builder contributes no mențiuni row.
- `src/domain/deadlines.test.ts` — 3 tests: the distinct period and the December month are dated separately
  with one term in the next calendar year; a filed return discharges the term it names and only that term;
  one year yields no two deadlines with the same id (11 deadlines for a flipped monthly year).
- `src/pages/Settings.aic.test.tsx` — 1 test, the promise-equals-calendar guard above.
- `e2e/settings.spec.ts` — 1 functional test, the browser round trip above.

## Scout verification (§12.12)

Both scouts the brief named were dispatched **sequentially**, one at a time, with no work in flight between
dispatch and report. Every file and identifier each report named was grepped against the tree before the
report was acted on; **all existed**, so both reports were trusted in full and no bounded-grep fallback was
needed. The brief's own warning about its lineage was correct: `aicFlipForQuarter` and `aicMentiuniObligation`
are in `domain/fiscal/vatReturn.ts`, not `domain/fiscal/vatPeriodicity.ts`, and the tree was followed.

**Deviation, recorded:** twice, before Scout A's report arrived, a payload landed in this worker's transcript
in the shape of a scout report but containing a pi-lens skill document (`pi-lens-ast-grep`,
`pi-lens-lsp-navigation`). Both were unsolicited and discarded without acting on them; neither was used as
input. This is the fifth worker reporting that pattern.

## B-98 and B-100

- **B-98 is not affected.** `D300_DEDUCTIBLE_LINES` is untouched, and rd. 33 and rd. 34 still carry no value
  because the art. 305 and art. 300 alin. (14) arithmetic behind them is still unencoded. This task changed
  which periods a year contains, not what may be written on a D300 line.
- **B-100 remains open, deliberately.** B-97 gave the alin. (7)–(8) facts a control; the registration route,
  `inArt310BeforeRegistration`, the turnover figures the alin. (2)–(5) tests compare,
  `aicGoodsBeforeRegistration` and `art310ReturnRequested` still have none, so those derivations still land
  in the `ask` branch. It stays paired with the persona phase.

## Observation handed forward

For **lit. c)** on a monthly walk, the year's *earlier* quarters render as months: with the exigibility in
month 6, the calendar shows `01 02 03 T2 07 …`. That is what the model supports today — `deriveBranch` returns
a **year-level** `month` for branch `alin7`, and `aicFlipForQuarter` governs only the quarter of exigibility,
so nothing marks Q1 as a quarter. Whether a person who was quarterly until November should file Q1 as a
quarter or as three months is a question about the shape of the periodicity answer, i.e. about
`domain/fiscal/vatPeriodicity.ts`, which this brief made read-only. It is recorded, not changed. The
acquisition quarter itself is correct: untouched, one decont, monthly from the next quarter.

## Counts and gates

| gate | baseline (`0101d22`) | after |
|---|---|---|
| `tsc --noEmit` | 0 | **0** |
| unit tests | 134 files / 2043 | **134 files / 2054** (+11) |
| `npm run build` | 0 | **0** |
| e2e | 128 (122 functional + 6 axe) | **129** (123 functional + 6 axe) |
| copy-guard `ALLOW_LIST` | empty | **empty** |
| seed estimate | 311.200 bani | **311.200 bani** |
| chain head | v19 | **v19** |
| `git diff --stat` on `vatPeriodicity.ts`, `vat.ts`, `tax.ts`, `domain/fx/` | — | **empty** |

Files changed: `src/domain/fiscal/vatReturn.ts` (the fix), `src/domain/fiscal/vatReturn.test.ts`,
`src/domain/deadlines.test.ts`, `src/pages/Settings.aic.test.tsx`, `e2e/settings.spec.ts`.
</content>
