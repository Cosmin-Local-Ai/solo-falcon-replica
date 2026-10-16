# Phase 22 — TASK 8: prioritisation, severity and rendering

Date: 2026-10-09 · Worker: TASK 8 · Brief: `docs/ai/briefs/24_task8_prioritisation_severity.md`
Baseline commit: `e4e6820` (measured) / `884d0e4` (brief written) · This work: `c6a2d5d` + follow-up commit

## 1. The defect, stated precisely

Two attention types existed, and neither could say what it meant.

`Insight` (`src/domain/insights.ts:14-20`) carried `severity: 'info' | 'warning' | 'danger'` plus
`title` / `description` / `action`. That one field carried three facts at once — the legal status of
the thing, how urgent it was, and what kind of thing it was. The type therefore could not express:

* **legally load-bearing but not urgent** — the CASS contribution floor, whose level is in play and
  whose consequence is cited law, sitting 200 days from any date; and
* **urgent but purely administrative** — a missing profile field with no legal consequence attached.

Saying either would have needed a second field. `insights.ts` then translated the domain's own
four-level `ThresholdSeverity` into the three-word scale (`high→danger`, `medium→warning`,
`low→info`), which is the collapse happening a second time, at the boundary.

`ActionItem` (`src/data/dashboard.ts:301-305`) carried `{id, label, source}` and **no severity at
all**, computed by `getActionItems` — a second pipeline over the same deadlines and completeness
checks that `insights.ts` also walked. The two could not see each other, and they did describe the
same problem twice: a missing tax snapshot was a card („Date incomplete") *and* an action
(„Estimare impozit"); a deadline was an alert *and* an action; the tax estimate was a card *and* an
action.

And the four genuinely unresolved items in the seed surfaced as **nothing at all**.

## 2. The model

`src/domain/attention.ts` — `AttentionItem`, four dimensions, none derivable from another:

| dimension | type | decided where |
| --- | --- | --- |
| `severity` | `AttentionSeverity = ThresholdSeverity` (`none`/`low`/`medium`/`high`) | the domain, per family: `recordSeverity`, `deadlineSeverity`, `thresholds.ts severityFor` |
| `state` | `AttentionState` (12 members, §2 below) | the domain, from the record/engine fact |
| `source` | `AttentionSource` (`revenue`/`expense`/`declaration`/`threshold`/`deadline`/`completeness`/`tax`/`reserve`/`integrity`) | which producer built the item |
| `title` / `description` / `action` / `target` | strings + `AttentionTarget \| null` | the domain, wording from `src/ui/copy/` |

`severity` is deliberately the **same union the threshold rows already use** (TASK 4), so the app has
one urgency scale rather than a three-level one for insights and a four-level one for thresholds.
`none` means "no attention now" and is filtered before anything reaches a surface — it is not a soft
`low`, and it is how an inapplicable threshold row stays off the surfaces.

`state` is the dimension `severity` used to stand in for: `level_engaged` and
`estimate_review_required` are legally load-bearing, `data_missing` is not, and both can carry any
severity.

`AttentionTarget` has `href` plus an optional `record {kind, id, reference}`. It has **no `label`**
field on purpose: the words on a link belong to the language layer (`copy.attention.openTarget`), and
a target carrying its own sentence would be a second home for the same phrase.

**Proof of independence** — `src/domain/attention.test.ts` › `the four dimensions stay independent`:
four tests, each taking two items that agree on three dimensions and differ on exactly one, plus the
pair the old type could not write (a `low` `level_engaged` threshold item and a `high` `data_missing`
completeness item, ranked by severity alone). 33 tests in that file.

## 3. The deduplication rule

One rule, in one place: `surfaceFor(state)` routes an item to exactly one surface.

* **action** (`Ce trebuie să faci`) — `rejected`, `awaiting_acceptance`, `not_submitted`,
  `data_missing`, `deadline_open`, `deadline_overdue`: states that describe something still to **do**.
* **observation** (`Observații`) — `level_engaged`, `level_approaching`, `level_review_required`,
  `estimate_review_required`, `reserve_shortfall`, `record_date_unusable`: states that describe a fact
  to **know**.
* `severity === 'none'` reaches neither.

`partitionAttention(items)` = `dedupeAttention` (same `id` twice → the more severe copy wins, the
other is dropped) then the split. It is the only place the rule can live, and it is applied once, in
the data layer (`src/data/attention.ts` → `getAttentionItems`), so `buildDashboardData` hands
`Insights` and `ActionSection` two disjoint lists that together cover the whole set.

`insights.ts` no longer emits a collapsed `completeness` card or a `tax-review` item; `getActionItems`
no longer walks deadlines and completeness checks on its own. Both are projections of one list.
Asserted end to end in `src/data/dashboard.test.ts` › *no issue appears on both surfaces*: the two id
sets are disjoint, `completeness-taxEstimate` is an action, `completeness` / `tax-review` /
`deadline-PFA_DEADLINE_2026` are not observations.

## 4. What surfaced, and why

`unresolvedRecords(data)` in the domain reads the registers and returns what is not settled:

| item | state | severity | reason carried | target |
| --- | --- | --- | --- | --- |
| `r3` revenue NF-2026-003 | `rejected` | **high** | `statusDetail` verbatim: `CUI nevalid` | `/revenues#!/rejected?f=r3` |
| `r2` revenue FCT-2026-002 | `awaiting_acceptance` | medium | e-Factura status verbatim: `În așteptare` | `/revenues#!/pending?f=r2` |
| `e3` expense FCT-PRO-121 | `rejected` | medium | `statusDetail` verbatim: `Document neconform` | `/expenses#!/rejected?f=e3` |
| `d2` declaration 2026-06 | `not_submitted` | medium | *no* submission date is recorded (the record holds no reason, so none is invented) | `/declarations#!/in-asteptare?f=d2` |

Why the severities differ, since the domain decides them per family and not per status:

* `r3` is `high` and `e3` is `medium` although both are `rejected`: a rejected **income** document
  leaves income undocumented, while a rejected **expense** document only leaves a document out of a
  subset the engine had already excluded.
* `r2` is `medium`: awaiting a third party's acceptance is not a defect, and it is not urgent.
* `d2` says „înregistrată în aplicație … nu are nicio dată de depunere înregistrată". The app states
  what its own record holds; it does not claim the return was not filed.

**What deliberately does *not* surface:** `d3` is `inregistrata` with no submission date. The app
holds no expectation that a merely-registered declaration was due to be filed, so calling it
unresolved would state a reason the record does not carry. `in-asteptare` and `respinsa` are the
record's own "not settled" markers — the same words the revenue register uses. A settled record
(`transmisa`, or any declaration carrying `dataTrimitere`) leaves the surfaces; the test
`a declaration that carries a submission date is settled even when its status is not transmisa` pins
that, and `a corrected revenue record stops appearing` pins the revenue side.

**Landmine check — presentation, not recalculation.** `aggregation.ts` still sums only
`status === 'inregistrata'`: seed registered revenue = r1 + r4 = 770.000 bani, registered expenses =
e1 + e2 = 20.550 bani; r3's 80.000 bani and e3's 34.000 bani stay out. The attention items carry no
sum. Every figure assertion in the e2e suite is untouched and green: deductible 120,00 / 144,00 lei,
VNA 9.096,00, impozit 819,00, total 3.249,00, reserve 1.083,00, hero 51.510 lei.

## 5. Empty sections

`Insights` returns `null` when it has nothing to say. It used to render a full card captioned
„Ești la zi. Nu există probleme de rezolvat în momentul de față." — a panel that reads as a result.
`ActionSection` keeps a one-line empty state (`copy.actions.emptyDescription` / `emptyBody`) inside its
card: an empty action list is a fact worth one sentence, and that sentence is pinned by existing tests.
`DeadlineSection` / `CompletenessSection` / `ThresholdSection` already rendered a single `<p class="hint">`
when empty, not a panel — left as they are.

## 6. Legislation honesty

`getLegislationState(data, asOfDate)` now returns `{updatedAt, items, monitor}`.

* `monitor: 'unavailable'` — no ingestion, no monitor. The section says so: *„Monitorul de modificări
  legislative nu este activ: aplicația nu verifică nicio sursă, deci nu poate spune nici că există o
  modificare, nici că nu există."* The old sentence, *„Nicio modificare viitoare verificată."*, was a
  different statement and read as reassurance.
* The items it *can* stand behind are the ones already in the rule package: the minimum-wage vintages
  read from `readMinimumWageVintages` (`src/domain/thresholds.ts`, new export). Nothing is invented —
  no date is shown where the package records none (the rule package records when a change is in force,
  not when it was published).
* Each card carries an **impact** line, which is the point:
  * **HG 146/2026** — 4.325,00 lei from 2026-07-01, `status: CURRENT`, `impact.affects: 'no'`, note
    citing **CF art. 135¹ alin. (3)**: it does not re-anchor FY2026, because the annual multiples take
    the value in force on 1 January of the year the income is earned.
  * **HG 1506/2024** — 4.050,00 lei from 2026-01-01, `status: PAST`, `impact.affects: 'yes'`: this is
    the vintage the FY2026 thresholds are measured on.
* The card title no longer asserts the impact („Modificare legislativă care te afectează"); the impact
  is its own badge (`Te afectează` / `Nu te afectează în acest an fiscal` / `Efectul nu este stabilit
  de nicio prevedere verificată`), and an undecided impact is shown as undecided.

## 7. The estimate: three epistemic states

`DashboardData.estimateState: 'computed' | 'review_required' | 'unavailable'`
(`TaxEstimateWithBasis | null` — the `null` is the third state, and `data/dashboardAdapter.tsx` no
longer collapses it).

* `computed` — `badge-success`, the figure, `copy.estimateState.computed`.
* `review_required` — `badge-warning`, the figure suppressed to `—`, and the note pointing to the
  chart, where the engine's refusal reason is rendered **once** (`FinancialChart .chart-tax-note`,
  pinned by name in the B-14 e2e describe). The reason is deliberately not duplicated in the hero.
* `unavailable` — `badge-neutral`, `—` in a muted colour, italic note: *„…cifra lipsește, nu este
  zero."*

The `loading` sentinel that used to print an internal token on the chart note is gone; a mid-flight
estimate is `unavailable`, and B-28 (the `—` ambiguity) stays registered, not papered over.

## 8. Severity rendering

`src/components/ui/severityBadge.ts` — `severityLabel(severity)` (reads `copy.severity`) and
`severityBadgeClass(severity)`. Every attention row carries `data-severity`, `data-state` and
`data-source`; `src/components.css` styles **only** `data-severity`. `data-state` and `data-source`
are exposed for tests and for a reader inspecting the DOM, and are deliberately unstyled — styling
from them would put the severity decision back into the presentation layer. The Praguri badge still
shows `status`; the row exposes `data-severity` beside it.

`insights.ts` no longer translates severity at all: the row's severity is read verbatim.

## 9. Routing to a record

The hash form is extended to `#!/<tab>?f=<id>` (`src/App.tsx` `parseRoute` / `routeToUrl`), and
`Revenues` / `Expenses` / `Declarations` take `focusRecord`, switch to the right tab, page to the row
if needed, and mark it `.row-focus`. Verified in a throwaway Playwright pass (deleted after): clicking
the `r3` action's link lands on `/revenues#!/rejected?f=r3` with exactly one `.row-focus` row naming
NF-2026-003; the `d2` and `e3` targets resolve the same way.

## 10. Re-pins (old → new). Nothing deleted, no matcher loosened, no timeout widened.

**e2e (`e2e/dashboard.spec.ts`, still 36 tests: 26 dashboard + 10 settings)**

| test | old | new |
| --- | --- | --- |
| *Ce trebuie să faci* | `3 elemente de rezolvat`, `.action-label` count 3, sources `Termen limită`×1 / `Completitudine` / `Revizuire estimări fiscale` | `6 elemente de rezolvat`, count 6; sources `Termen limită`×1, `Completitudine`×1, `Venit`×2, `Cheltuială`×1, `Declarație`×1; `Revizuire estimări fiscale` count 0; the four records with their reasons; severity badges `ridicată`×1 / `medie`×4 / `scăzută`×1 |
| *Legislație* | `Nicio modificare viitoare verificată.` visible | monitor-unavailable sentence visible; old sentence count 0; HG 146/2026 card with `Nu te afectează în acest an fiscal` + art. 135¹ alin. (3); HG 1506/2024 anchor card with `Te afectează` |
| *Observații* | title *renders all 4 insights*; `Date incomplete`, `Lipsă: Estimare impozit.`, `Estimare impozit`, `Estimarea totală a impozitului:` visible; badges `Atenție`×3, `Info`×1 | title *renders the 2 observations*; those four strings asserted **absent** (count 0) and the completeness item asserted present **once**, on the action surface; badges `Urgent`/`Atenție`/`Info` all count 0, `prioritate medie`×2, `ridicată`/`scăzută` 0 |

The three e2e tests that changed are the ones the brief predicted. Every figure assertion in the e2e
suite is unchanged.

**Unit (`npm run test`, 62 files / 1076 tests → 63 files / 1121 tests)**

* `src/domain/insights.test.ts` — severity expectations `danger`→`high`, `warning`→`medium`,
  `info`→`low`; the collapsed `completeness` card expectation replaced by one item per missing key;
  `46 passed`.
* `src/data/dashboard.test.ts` — `getActionItems` shape test re-pinned from `{id, label, source}` to
  `AttentionItem`; `getLegislationState` test re-pinned from `{updatedAt, items: []}` to the
  monitor/impact shape; floor-alert severity `warning`→`medium`; two new tests (record targets,
  surface disjointness).
* `src/components/Insights.test.tsx` — the empty-array test replaced by *collapses instead of
  rendering an empty card*; badge labels re-pinned to `copy.severity`; new `data-severity` /
  `data-state` / `data-source` and target-link tests.
* `src/components/dashboard/ActionSection.test.tsx` — fixtures re-shaped from `ActionItem` to
  `AttentionItem`; new tests for the reason line, the severity badge styling and the target link.
* `src/components/dashboard/LegislationSection.test.tsx` — `impact` added to every fixture; the
  empty-state test replaced (monitor sentence); the CURRENT card title re-pinned; `Viitoare` badge
  count 2→1 and `În vigoare` 2→1 because the header badge now carries the impact, not the status; two
  new tests (HG 146/2026, undecided impact).
* `src/domain/attention.test.ts` — new, 33 tests.

## 11. Copy

Every new sentence is in `src/ui/copy/`: new module `src/ui/copy/attention.ts` (surface words, source
labels, severity-linked phrases, the estimate-state sentences) plus additions to
`src/ui/copy/dashboard.ts` (legislation monitor/impact, minimum-wage summary). `copy.severity` is the
scale the badges read. **The guard test's allow-list is still empty** (`src/ui/copy/copy.guard.test.ts:103`).

## 12. Withheld conclusions untouched

No attention item resolves an `unknown` / `REVIEW_REQUIRED` / Notă de interpretare site. The
`estimate_review_required` state says the engine withheld a conclusion and carries the engine's own
reason; it does not supply one. `19_pension_cass_input_model.md` §withheld sites: unchanged. The 10 %
band is still not presented as statutory, no lei amount is presented as statutory text, and
*dezcalificare* / *schimbare de regim* are still absent (asserted absent in the Observații e2e test).

## 13. Validation

`npx tsc --noEmit` → 0 · `npm run test` → **63 files / 1121 tests passed** · `npm run build` → 0 ·
`npm run test:e2e` → **36 passed** (26 dashboard + 10 settings).

## 14. What TASK 9 inherits

* **The attention-item type is `AttentionItem`** (`src/domain/attention.ts`), dimensions
  `severity` · `state` · `source` · `title`/`description`/`action`/`target`. `ActionItem` is gone.
* **Severity is read, never derived, at the render layer**: `severityLabel` / `severityBadgeClass` in
  `src/components/ui/severityBadge.ts`, CSS keyed on `data-severity` only.
* **Surfaces TASK 9 may add provenance to**: `Insights` rows and `ActionSection` rows (both already
  expose `data-source` and carry an `AttentionTarget`), the legislation cards
  (`LegislationItem.source` is already the act, e.g. `HG 146/2026`), and the estimate hero
  (`estimateState` + the disclosure). `src/data/attention.ts` `getAttentionItems` is the single place
  an item is produced, so provenance has one home there too.
* **`currentReserveBani` was NOT widened.** `DashboardSnapshot.taxReserve.currentReserveBani` is still
  `Bani` with the `?? 0`. No card in this task reads the snapshot aggregate: `TaxReserve` renders
  `TaxEstimateRecommendation.reservedAmount`, already `Bani | null` since TASK 3. If TASK 9 builds a
  surface that reads the snapshot aggregate, it must widen it to `Bani | null` first and assert the
  `null` vs `0` difference — the trap is still live.
* The Playwright reserve-reload test that takes e2e **36 → 37** is TASK 9's; this task left the count
  at 36 deliberately.
