# 49 — B-101: the periodicity now has a start point inside the year

Brief `briefs/52_b101_dated_periodicity.md`. Baseline measured at `c6533ad`; work landed on top of `80a35ad`.

**B-101 is closed.** The app no longer shows monthly returns for a quarter the person never spent on the month.

---

## The defect, as it actually ran

`deriveBranch` in `domain/fiscal/vatPeriodicity.ts` answered art. 322 alin. (7) with a **year-level**
`periodicity: 'month'`. `vatFiscalPeriods` turns a year-level answer into either four quarters or twelve
months, so on the alin. (7) branch the year reached `decontObligations` as twelve month periods, and
`aicFlipForQuarter` — which B-99 had finally made the builder read — only ever replaced **the quarter of
exigibility**. Nothing marked the quarters before it. The taxpayer who was quarterly until June was shown
`01.2026`, `02.2026`, `03.2026`: three deconturi for a quarter that was never monthly.

Art. 322 alin. (7) does not speak about a year. It says the fiscal period „devine luna calendaristică
**începând cu**" a point, and the three litera put that point in three different places. The model had no
place to put a point, so it lost one third of the rule.

## The shape chosen — option 1, the year is segmented in the derivation

`domain/fiscal/vatPeriodicity.ts` now exports `PeriodicitySegment { before, after, fromMonth }` and
`alin7MonthStart(monthOfExigibility)`, and both the `derived` and the `user_confirmed` members of
`VatPeriodicityOutcome` carry an optional `segment`. `decontObligations` takes it in `opts` and walks
`yearPeriods(periodicity, year, segment)` instead of `vatFiscalPeriods(periodicity, year)`: a quarter wholly
before `fromMonth` is one quarter period, a quarter reached by it is three month periods, and a quarter the
point falls inside is left to the flip, which is what `aicFlipForQuarter` already exists to cut.
`vatFiscalPeriods` is unchanged and still answers a plain year.

**Why this one.** It is the honest model: the point is a fact about the year, established by the article, so
it belongs to the derivation. It also means the segment is produced once and read by whoever needs it,
rather than being re-inferred at render time — which is the B-70 defect class.

**What it cannot represent.** `PeriodicitySegment` describes **one** change of regime inside **one** year:
`before`, `after`, one `fromMonth`. It cannot express:

- **a year that changes regime twice** — e.g. monthly, then back to the quarter mid-year. No article in
  art. 322 gives that for FY2026, but the type would have to become a list of segments if it ever did;
- **a regime that continues past the year boundary.** `fromMonth` is year-relative. `13` is a legal value
  meaning „the month begins next year", and it is honest for the year it describes — but it is a dead end
  for the next one, which is exactly the alin. (8) gap recorded below;
- **an alternative period under art. 322 alin. (9)** (semestrul / anul, Norme pct. 103 alin. (4)-(5)). The
  segment vocabulary is `month | quarter` only, because that is all the app models today.

**One producer for the arithmetic, two for the reading.** `alin7MonthStart` fixes *when the month begins*;
`aicFlipForQuarter` stays the authority for *which periods replace the quarter*. Those are two readings of
one litera and could drift, so `vatReturn.test.ts` pins them against each other for all twelve months of
exigibility.

**The segment is attached in `deriveVatPeriodicity`, not inside the alin. (7) branch.** It is a consequence
of the declared facts, not of which branch happened to answer. A person whose registration facts are missing
but who confirmed „monthly" for an `alin7` year still declared the month of exigibility, and their calendar
has to know where the quarter stopped. This is pinned: the `user_confirmed` outcome carries the same segment
as the `derived` one.

**Landmine 3 respected.** The gate is `facts.aicGoodsWhileQuarterly === 'da'` — a fact that says in its own
name that the period was a quarter when the acquisition happened. A person already monthly through alin. (2)
over the cap, or through Norme pct. 103 alin. (1) din oficiu, gets no segment, and a bare `da` with no month
of exigibility gets none either: the app cannot pick a litera, so it cannot name a point, and it says so
rather than inventing one.

## The three letters, month by month — before and after

Exigibility in 2026, one row per obligation the calendar lists.

| litera | exigibility | before (B-99, wrong) | after (B-101) |
|---|---|---|---|
| a) | **January** — first month of Q1 | `01 02 03 04 05 06 07 08 09 10 11 12` (12) | **unchanged** — `01 … 12` (12). Nothing precedes the point. |
| a) | **April** — first month of Q2 | `01 02 03 04 05 06 07 08 09 10 11 12` (12) | `T1 04 05 06 07 08 09 10 11 12` (**10**) |
| b) | **May** — second month of Q2 | `01 02 03 04-05 06 07 08 09 10 11 12` (11) | `T1 04-05 06 07 08 09 10 11 12` (**9**) |
| c) | **June** — third month of Q2 | `01 02 03 T2 07 08 09 10 11 12` (10) | `T1 T2 07 08 09 10 11 12` (**8**) |
| c) | **December** — third month of Q4 | `01 … 12` (12) | `T1 T2 T3 T4` (**4**) — `fromMonth` 13, the month begins in 2027 |

Every row is asserted three ways: the **exact label list**, **month-by-month coverage** (`1…12` exactly
once), and the **count**. Coverage alone is what B-99 asserted, and it passed on a wrong year.

## ⚠️ The corrected assertions — old → new

These shipped wrong. They are named here because a corrected test without a record is a re-baseline.

1. `src/domain/fiscal/vatReturn.test.ts` — *„lit. a) exigibility in month 1: twelve months, no distinct
   period, every month covered once"* → split into two tests.
   - **Old:** `decontObligations('month', 2026, { flips: [aicFlipForQuarter(2026, 2, 4)] })` asserted
     `['01.2026', '02.2026', '03.2026', '04.2026' … '12.2026']` — twelve month periods.
     **New:** *„B-101 lit. a) exigibility in April"* asserts `['T1 2026', '04.2026' … '12.2026']` and
     `toHaveLength(10)`. Q1 was never monthly.
   - **New, separate case:** *„lit. a) exigibility in January"* keeps the twelve-month list — that is the
     one alin. (7) year where twelve months is genuinely right, because the point is the first month of Q1.
2. `src/domain/fiscal/vatReturn.test.ts` — *„lit. b) exigibility in month 2"*.
   **Old:** `['01.2026', '02.2026', '03.2026', '04-05.2026', '06.2026' … '12.2026']` (11).
   **New:** `['T1 2026', '04-05.2026', '06.2026' … '12.2026']` and `toHaveLength(9)`. The distinct period,
   its id `decont-04-05.2026`, its term `2026-06-25` and its citation are unchanged.
3. `src/domain/fiscal/vatReturn.test.ts` — *„lit. c) exigibility in month 3"*.
   **Old:** `['01.2026', '02.2026', '03.2026', 'T2 2026', '07.2026' … '12.2026']` (10), plus
   `indexOf('T2 2026') === 3`.
   **New:** `['T1 2026', 'T2 2026', '07.2026' … '12.2026']` and `toHaveLength(8)`.
4. `src/domain/deadlines.test.ts` — *„gives one year no two deadlines with the same id"*.
   **Old:** `expect(deadlines).toHaveLength(11)` for an exigibility in November 2026.
   **New:** the exact id list `['decont-T1-2026', 'decont-T2-2026', 'decont-T3-2026', 'decont-10-11.2026',
   'decont-12.2026']`. The fixture now passes the segment; the eight monthly rows it used to carry were
   returns for quarters that were never monthly. The year-boundary assertions (`decont-12.2026` due
   `2027-01-25`, `taxYear` 2026) did not move.

No other existing assertion moved. `src/pages/Declarations.test.tsx` pins a quarterly profile and is
untouched. The B-99 promise-equals-calendar guard in `src/pages/Settings.aic.test.tsx` and the B-99 round
trip in `e2e/settings.spec.ts` both pass **unmoved** — the confirmation speaks about the quarter of
exigibility, and that quarter's cut did not change.

## What did not move

- **The quarterly walk, byte for byte.** A quarterly person has no segment — the derivation only produces one
  on the `alin7` branch — so `yearPeriods` is never reached on that path. Pinned for all three letters:
  lit. a) `T1 04 05 06 T3 T4`, lit. b) `T1 04-05 06 T3 T4`, lit. c) `T1 T2 T3 T4`.
- **Ids.** A restored quarter is built as the same `{ kind: 'quarter', year, quarter }` a plain quarterly
  person gets, so `periodLabel` gives it `T1 2026` and the id is `decont-T1-2026` — identical. Asserted
  directly: for every quarter wholly before the point, the flipped year carries a row with the plain
  quarterly person's id, `dueOn` and `label`. A new test in `src/domain/deadlines.test.ts` files a return
  against `decont-T1-2026` and shows it discharges that term and leaves the December term dated 2027 overdue.
- **The mențiuni duties.** `aicMentiuniObligation` contributes the alin. (8) form once; the decont builder
  contributes none. `annualMentiuniObligation` is gated on `periodicity.periodicity !== 'quarter'`, which
  still yields `null` on the alin. (7) branch — the person who flipped mid-year owes the alin. (8) form, not
  a second 25-ianuarie one. Unchanged, and asserted exactly-once in both the unit and the browser test.
- **The cap arithmetic.** `periodicityCapForYear` and `proRateCap` are untouched; `git diff --stat` on
  `src/domain/fiscal/vat.ts`, `src/domain/tax.ts`, `src/domain/fx/` and `src/data/migration.ts` is empty.
- **The term.** Still `decontTerm` with the citation `CF art. 323 alin. (1); plată art. 326 alin. (1)` on
  every decont, including the restored quarters. No new fiscal constant, no new citation.
- **The chain.** Head still `CURRENT_DATA_VERSION` = `DATA_VERSION_VAT_RETURNS` = **19**.
- **The seed estimate.** Still **311.200 bani**, asserted in `src/data/dashboard.accommodation.test.ts`,
  passing unmoved.

## The confirmation wording moved, not the calendar

`aicEffectLines` in `src/pages/Settings.tsx` used to say only „Perioada fiscală devine luna calendaristică."
That is now half the truth: the calendar shows a quarterly return for every quarter closed before the point.
Two new sentences in `src/ui/copy/settings.ts` — `effectSince` and `effectSinceNextYear` — are appended to
that same effect line, and the month they name comes from `alin7MonthStart`, the same function the
derivation and the builder read, so the sentence cannot state a point the calendar contradicts.

The existing B-99 guard (the number parsed out of „se depun N deconturi" equals the calendar rows covering
that quarter) still passes: for lit. b) it is 2 and stays 2. A **new** guard covers the other direction —
*B-101 — the month the confirmation says the change starts at is the month the calendar starts at*: the
month is read out of the modal sentence with a regex and asserted to be the first monthly `decont-` row the
calendar lists, with `decont-T1-2026` present and `decont-01.2026`/`-02`/`-03` absent. The same assertions
are made in the browser in `e2e/settings.spec.ts`.

## alin. (8) — the multi-year tail is recorded, not encoded

Art. 322 alin. (8) says the person „va utiliza ca perioadă fiscală luna calendaristică **pentru anul curent
și pentru anul următor**", returning to the quarter only if the following year has no intra-community
acquisition. A mid-year flip therefore has a tail that crosses the year boundary.

**It is not implemented, and this change does not implement half of it.** The app derives periodicity for a
year from the facts declared **for that year**. Nothing carries a 2026 alin. (7) event into the 2027
derivation, so:

- a person who flipped in June 2026 gets 2027 decided by alin. (2) or alin. (5) — which can answer
  `quarter`, contradicting alin. (8);
- the `fromMonth: 13` case (exigibility in December) is now explicit in the code and makes the gap visible:
  2026 is correctly four quarters, and 2027 should be monthly by operation of alin. (7) and alin. (8)
  together, but the app would derive it from 2027's own facts.

Encoding half of a two-year rule — say, forcing `month` on `year + 1` whenever `year` flipped — would also
have to encode the way back (the alin. (6) declaration by 25 ianuarie, and „if the following year has no
acquisition"), and a half-implemented multi-year rule is worse than an unimplemented one because it looks
settled. **Recorded as the next defect in this area: the alin. (8) tail is unmodelled.** It needs a decision
about whether periodicity is a per-year derivation at all, or a state that carries forward — which is the
same question `PeriodicitySegment` cannot answer, named above.

## A count-shaped criterion hid a shape error — in the brief

B-99 asserted coverage where it needed a count. B-101 nearly repeated the mistake one level up: the brief's
own table called lit. a) „twelve months — correct, leave it", because the **count** is 12 either way. The
**shape** is not: `01.2026, 02.2026, 03.2026` is three returns for a quarter that was never monthly, and
under the corrected model lit. a) with the exigibility in April is **10**, not 12. Landmine 2 and acceptance
3 as written would have preserved a third of the defect. They were corrected before implementation.

The lesson for the register: **assert the exact list.** A count passes on a wrong calendar; coverage passes
on a wrong calendar; only the list says what the taxpayer is actually told to file.

## B-98 and B-100

- **B-98 is not affected.** `D300_DEDUCTIBLE_LINES` is untouched and rd. 33 and rd. 34 still carry no value,
  because the art. 305 and art. 300 alin. (14) arithmetic behind them is still unencoded. This task changed
  which periods a year contains, not what may be written on a D300 line.
- **B-100 remains open, deliberately.** The registration route, `inArt310BeforeRegistration`, the turnover
  figures the alin. (2)-(5) tests compare, `aicGoodsBeforeRegistration` and `art310ReturnRequested` still
  have no control on the fiscal tab, so those derivations still land in the `ask` branch. It stays paired
  with the persona phase.

## Surfaced, not fixed

- **The Form 300 panel still states the periodicity as a year-level label.** `VatPeriodicityPanel` in
  `src/pages/Declarations.tsx` renders `vatReturnCopy.periodicityLabels[outcome.periodicity]`, and
  `vatFilingPeriodCheck` in `src/domain/completeness.ts` renders the same ternary, so both now say „lună
  calendaristică" for a year whose calendar opens with a quarterly return. The alin. (7) branch's `steps`
  now carry the litera and the „începând cu" sentence, so the panel does state the point one level down —
  but the headline label is still year-level. Making the headline match the calendar is a copy change on a
  surface this brief put out of bounds („only where the calendar or the confirmation text renders"), so it is
  recorded rather than done.
- **The alin. (7) `steps` named the wrong litera.** They hard-coded „CF art. 322 alin. (7) lit. b)" whatever
  the exigibility month was. They are now chosen by `alin7Litera`, and a fourth variant says plainly that
  with no month declared the app cannot pick one. This is derivation output in a file this brief lifted into
  scope, not page copy.

## Scout verification (§12.12)

Both scouts the brief named were dispatched **sequentially**, one at a time, with no work in flight between
dispatch and report. Every file and identifier each report named was grepped against the tree before the
report was acted on. Scout A's 43 identifiers all resolved. Scout B's claim that `declarationsInAsteptare`
no longer exists was checked and is correct — the name survives only in a comment in `src/data/dashboard.ts`
and `src/data/dashboard.test.ts`, and the live field is `filingsInAsteptare`. Both reports were therefore
trusted, and no bounded-grep fallback was needed.

**Deviation, recorded:** twice, after Scout A was dispatched and before its report arrived, a payload landed
in this worker's transcript in the shape of a scout delivery but containing a pi-lens skill document
(`pi-lens-ast-grep`, then `pi-lens-lsp-navigation`). Both were unsolicited and were discarded without acting
on them; neither was used as input. This is the sixth worker to report the pattern.

## Counts and gates

| gate | baseline (`c6533ad`) | after |
|---|---|---|
| `tsc --noEmit` | 0 | **0** |
| unit tests | 134 files / 2054 | **134 files / 2063** (+9) |
| `npm run build` | 0 | **0** |
| e2e | 129 (123 functional + 6 axe) | **129** (123 functional + 6 axe) — unchanged, including the live `/settings#!/fiscal` axe scan |
| copy-guard `ALLOW_LIST` | empty | **empty** |
| seed estimate | 311.200 bani | **311.200 bani** |
| chain head | v19 | **v19** |
| `git diff --stat` on `vat.ts`, `tax.ts`, `domain/fx/`, `migration.ts` | — | **empty** |

New tests: 6 in `src/domain/fiscal/vatReturn.test.ts` (January case, restored-quarter id equality,
segment-vs-flip agreement over all twelve months, December/`fromMonth` 13, plus the widened id-uniqueness
sweep over the segmented walk), 3 in `src/domain/fiscal/vatPeriodicity.test.ts` (the three litera's
`fromMonth`, the `user_confirmed` segment, and the no-segment cases), 1 in `src/domain/deadlines.test.ts`
(a filed return against a restored quarter), 1 in `src/pages/Settings.aic.test.tsx` (the confirmation's
stated start month equals the calendar's first monthly row). No e2e test was added; the existing B-99
browser round trip was extended.

Files changed: `src/domain/fiscal/vatPeriodicity.ts` (the segment, `alin7MonthStart`, `alin7Litera`, the
attach point, the litera-correct steps), `src/domain/fiscal/vatReturn.ts` (`yearPeriods`, `opts.segment`),
`src/data/dashboard.ts` (threading `periodicity.segment` into `decontObligations`),
`src/pages/Settings.tsx` and `src/ui/copy/settings.ts` (the confirmation names the point),
`src/domain/fiscal/vatReturn.test.ts`, `src/domain/fiscal/vatPeriodicity.test.ts`,
`src/domain/deadlines.test.ts`, `src/pages/Settings.aic.test.tsx`, `e2e/settings.spec.ts`.

`domain/deadlines.ts` is **not** in the diff: `vatObligationDeadlines` copies `o.id` into `deadlineId` and
`vatReturnForDeadline` matches a filed `VatReturnRecord` on `obligationId`, and that join is already generic
over any period kind — which is why a restored quarter needs no join change, only the same id.
