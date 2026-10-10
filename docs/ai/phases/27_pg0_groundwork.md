# 27 — PG-0 Groundwork (clock, date stamping, CI)

Brief: `docs/ai/briefs/30_pg0_groundwork.md`. Date: **2026-10-10** (from `scripts/today`, not typed).
Baseline inherited: Phase 10c at `ab7df41` — `tsc` 0 · **80 test files / 1368 unit tests** · `build` 0 · **e2e 39** · copy-guard allow-list empty.

---

## 1. What PG-0 is

Four deliverables, all groundwork for the rule in `PHASE_PLAN_11_34.md` §12.2 — *"PG-0 is a hard
prerequisite for any date-dependent acceptance criterion."*

1. A shared fixed-clock helper for vitest, so no unit test reads the wall clock.
2. `scripts/today`, so doc stamps stop being typed by hand.
3. CI: typecheck → vitest → build → Playwright (browsers installed) → axe on `/dashboard`.
4. `STATE.md`'s test figures reconciled to the Phase 10c handoff.

---

## 2. The clock seam — and why brief 30 scope item 1 was wrong as written

**The brief said:** *"Mock `domain/date.ts`'s `now()` — do not monkey-patch the global `Date`."*
**That instruction is incorrect as written, and the Orchestrator has ruled (option C) to build on the
house pattern instead.** Recorded here with the evidence, per the ruling; the brief itself is the
Orchestrator's to correct.

Evidence gathered by Scout C and confirmed by reading the files:

- **`src/test/wallClockGuard.test.ts` already exists** and enforces the standing **B-23** rule: no test
  under `src/**` may read the wall clock. Its doc comment sanctions **exactly two mechanisms** —
  *"inject an instant (every entry point already accepts one) or install fake timers explicitly."*
- **Both tests the brief names already use fake timers, not `vi.mock`:**
  `pages/Dashboard.test.tsx:146-147` = `vi.useFakeTimers({ toFake: ['Date'] })` + `vi.setSystemTime(FIXED_INSTANT)`,
  teardown `vi.useRealTimers()`; `pages/Settings.fx.test.tsx:208` = inline `vi.useFakeTimers({ now: … .getTime() })`.
- **There is no `vi.mock` of `domain/date`, no `vi.spyOn(Date`, and no `importOriginal` anywhere in `src/`.**
  The only `vi.mock` calls in the tree are `components/FinancialChart.test.tsx:14-16`, mocking store/adapter.

Why the brief's own reason does not support its instruction: it objects that faking the date would break
*"the injectable `instant`"* invariant. `vi.useFakeTimers({ toFake: ['Date'] })` pins **what the clock
reads**; an injected `instant` is still an injected `instant`. The invariant is untouched.

Why the letter would have been worse than the spirit: `vi.mock` is file-scoped and hoisted relative to the
importing file, so it cannot be wrapped in one shared importable helper — and it would have added a
**third** mechanism to a control that sanctions two. **Widening an existing control to satisfy a brief is
backwards.** `wallClockGuard.test.ts` was therefore **not touched** (Orchestrator constraint 1).

### What was built

`src/test/clock.ts` — `pinClock(at?)` / `unpinClock()` / `assertClockSeam(at)`, wrapping
`vi.useFakeTimers({ toFake: ['Date'], now: at.getTime() })` + `vi.setSystemTime` + `vi.useRealTimers`.

`toFake: ['Date']` is inherited deliberately from `Dashboard.test.tsx`: it leaves `setTimeout` and
microtasks real, so the documented macrotask wait in `expectTaxFigure` still works. `fakeAllTimers: true`
opts out for the rarer case.

### The proof for acceptance criterion 2

*"No test reads the wall clock. Prove it by the helper being the only seam, not by grepping for
`new Date()` and hoping."*

`pinClock()` calls `assertClockSeam()`, which reads `domain/date.ts`'s own `now()` and throws
`ClockSeamError` naming `src/domain/date.ts → now()` if it does not report the pinned instant. Since
`date.ts:21` is the only place the domain touches the clock, a pinned `now()` means every function
downstream of it is pinned. `src/test/clock.test.ts` proves this two ways:

- it calls `localDateISO()`, `localYear()`, `toInstantISO()` and `epochMs()` **with no argument** — the
  25 `DEFAULT` call sites the scout mapped — and asserts all four resolve to the pinned instant;
- a **negative control** asserts `assertClockSeam` *throws* when handed a wrong instant, so the seam check
  cannot pass by being vacuous.

---

## 3. One pinned instant, and the import direction that keeps it from rotting

`src/test/fixedInstant.ts` exports `FIXED_INSTANT_ISO = '2026-10-31T12:00:00'` and `fixedInstant()`.

**Before PG-0 the same instant was spelled four times:** `FIXED_AS_OF` defined independently at
`e2e/dashboard.spec.ts:72` and `e2e/settings.spec.ts:231`, plus two inline
`setFixedTime(new Date('2026-10-31T12:00:00'))` at `e2e/settings.spec.ts:497` and `:539` that bypassed
even those constants. All four now read the one export. No config change was needed: `testDir` restricts
*discovery*, not *resolution*, and the e2e specs previously imported nothing from `src/` at all.

The instant is unchanged, so **no existing figure moved**. Why 2026-10-31 (9 full months + 31/31 days =
10 elapsed months, so every operand is YTD × 1,2) is reasoned out in the shared module, once.

**IMPORT DIRECTION — the one thing that would make this setup rot quietly** (Orchestrator constraint,
written as a comment in both files):

1. `src/test/fixedInstant.ts` must **never** import `vitest` — the Playwright specs import it, and they
   have no vitest module graph. One `import { vi }` there breaks every e2e run while every unit test
   stays green.
2. `src/test/clock.ts` may import vitest and must **never** be imported by an `e2e/` spec. Same failure,
   mirrored.

The string carries **no UTC offset on purpose**: it denotes local time, and `domain/date.ts` formats
through an explicit `Europe/Bucharest` `Intl` format, so `localDateISO(fixedInstant())` is `2026-10-31`
whether the runner is in UTC (CI) or EEST (a laptop in Bucharest). Pinned by a test, not assumed — this is
the **B-46** class of bug.

---

## 4. e2e — what was already pinned, what escaped, what was pinned

The gate's *"re-pin every date-dependent E2E assertion"* was largely finished before PG-0; the job was to
find what escaped. Scout B's inventory found exactly two tests that had no clock pin:

| Test | Drifting assertions | Action |
|---|---|---|
| `e2e/dashboard.spec.ts` — *"Termene limită: renders the single upcoming filing deadline (D212)"* | `.item-row` count, `25.05.2027` visible, `Activ` count — the "upcoming" filter is wall-clock driven, so `25.05.2027` disappears from the list once the real day passes it | `await fixClock(page)` added |
| `e2e/dashboard.spec.ts` — *"Grafic financiar: 'Lunar' range (default) is empty for FY2025 data"* | its own comment admits *"Default month is the current one"* — an assertion about the real date | `await fixClock(page)` added |

**No assertion was exposed as already-wrong.** Pinning both kept them green, and pinning the unit clock
broke nothing. So there is **nothing to hand to PG-2 on that count** — the honest result is a clean
negative, not a list.

**`e2e/dashboard.spec.ts:612` `new Date(Date.now() + 5 * 86_400_000)` was left alone deliberately.** It is
a fixture builder feeding an assertion that the start date changes *nothing* — clock-relative input,
clock-invariant expectation — and `wallClockGuard.test.ts` excludes it by name for the same reason.

**B-46 was not touched**, per the brief: `Expenses.tsx:47`, `Revenues.tsx:30`, `Declarations.tsx:31` still
default a record date with `new Date().toISOString().slice(0, 10)`, which is the **UTC** calendar date.
They belong to **PG-2 / 12C**.

---

## 5. `scripts/today`

`scripts/today` → `2026-10-10`; `scripts/today --stamp` → local ISO with offset. POSIX `sh`, `date +%F`,
no dependencies, runs on a clean clone before `npm install`.

**It emits the local date, not the UTC date** (landmine 5). Proven, not asserted: under
`TZ=Pacific/Apia` (UTC+13) it prints **2026-10-11** while `date -u +%F` prints **2026-10-10**. The UTC
form is deliberately not offered, and the header comment names B-46 as the reason.

No `package.json` script entry was added — the brief's boundary allows `package.json` **devDependencies
only**. Invoke it as `./scripts/today`.

---

## 6. CI and the axe gate

`.github/workflows/ci.yml` — the first CI this repository has; there was no `.github/` at all.
Order: `typecheck` → `test` → `build` → `playwright install --with-deps chromium` → **E2E functional** →
**E2E axe**. `reuseExistingServer: true` untouched (landmine 2) — a CI runner has no existing server, so
Playwright starts its own.

### Expected counts — read these before calling a changed total a regression

| Run | Tests |
|---|---|
| `npx playwright test --grep-invert axe-core` (CI "E2E — functional") | **39** — unchanged from the Phase 10c baseline |
| `npx playwright test e2e/a11y.spec.ts` (CI "E2E — axe") | **3** — the gate + two negative controls |
| `npm run test:e2e` (both, the default local run) | **42** |

The axe spec runs **inside** the default `npm run test:e2e` so a Worker sees an a11y break locally, **and**
as its own CI step so a failure reads as an a11y failure. The functional step greps it out, so the two CI
steps cover every spec exactly once and never scan twice.

### Acceptance 5, shown both ways

- **It fails on a real `serious` violation.** On 2026-10-10 the gate failed on the dashboard as it stood:
  `color-contrast` (serious), **6 nodes** — `.muted` "An fiscal 2026 · actualizat la 31.10.2026" at
  4.43:1 on `#f0f2f5`, and `.stat-card .hint` ×2 / `.stack > p.hint` ×3 / a `<strong>` inside a hint at
  2.57:1 on `#ffffff`. That is the demonstration, on real markup.
- **It still bites permanently.** `e2e/a11y.spec.ts` injects an `<img>` with no `alt` into the live
  dashboard and asserts the scan reports `image-alt` **and** that the gate classifies it as blocking —
  plus an assertion that the injection actually landed, because a selector that silently matches nothing
  turns a negative control back into a vacuous pass. (`image-alt` is *critical* impact; the gate blocks
  `serious` **and** `critical`.)
- **It does not fail on a `minor` one.** A classifier test asserts `minor`, `moderate` and a `null` impact
  are all ignored, and that a `serious` finding mixed in with them is still caught.

### The palette fix, and what it did *not* settle — **B-69**

Two hex values in the token block, nothing else (Orchestrator constraint 1: no selector changes, no
overrides, no special-casing `.hint`).

| Token | Before | After | min ratio across surfaces (before → after) |
|---|---|---|---|
| `--text-3` | `#667085` | `#5b6472` | 5.24 → **6.61** |
| `--text-4` | `#98a2b3` | `#646d7a` | 2.44 → **5.58** |

Values were found **empirically against axe**, not from arithmetic — hand-computed WCAG ratios disagree
with axe's own measurement (5.24 vs 4.43 for the same pair), so arithmetic was not trusted. Verified
against **every** surface the tokens land on, not just the two measured: `#ffffff`, `#f0f2f5`, `#f8fafc`,
`#eff6ff`, `#ecfdf3`, `#fffaeb`.

**Blast radius — this is app-wide, not dashboard-local.** 31 use sites of `--text-3` / `--text-4`:
`src/styles.css` (`.stat-card .label`, `.stat-card .hint`, `.hint`, `.muted`, `.label`, `.page-header .sub`,
`.kv dt`, `.badge-neutral`, `.chart-legend-swatch.projection`, `.btn-outline:hover`, an uppercase label at
`:78`), `src/components.css` (`.field .hint`, `.field input:disabled`, a borderless button at `:84`,
`.empty-state`, `.pagination .page-info`, `.list-row .doc-sub`, `.muted`, `.kv dt`,
`.tax-hero-value[data-estimate-state=unavailable]`, `.estimate-state-note[…]`, two header/tab rules),
`pages/Documents.tsx:103,139,171,533,537,541,547` and `pages/Settings.tsx:604` (inline styles).
**`--text-3` also doubles as a border colour** (`.btn-outline:hover`, `.chart-legend-swatch.projection`), so
darkening it moves a rule line as well as text.

**This is a minimum-compliance contrast floor, not a palette decision.** It compresses the four-step text
ladder (`--text #1d2939` → `--text-2 #475467` → `--text-3` → `--text-4`). The proper contrast and
colour-coding pass belongs to **Phase 28 / PG-12**, which also owns the **non-colour** actual-vs-projected
cue the graph still lacks.

**Recorded and deliberately NOT gated:** axe also reports `landmark-one-main` and `region` (both
**moderate**) because **the app renders no `<main>` landmark anywhere in `src/`** — grep finds no `<main>`
at all. PG-0 gates `serious`/`critical` only (landmine 3), so these are printed, not fatal. They are minted
as **B-69** so the missing landmark is a structural finding someone fixes on purpose.

Axe stays scoped to `/dashboard` for PG-0. The other routes are a follow-up, not widened now.

---

## 7. `STATE.md` reconciliation

Figures taken from the Phase 10c handoff, **not re-measured** (§12.10). Corrected in every place they
appeared: the header's forward-plan line (`64 files / 1149 tests`), the superseded-claims paragraph
(`28 test files, 102 tests` — kept as the disproved claim, now labelled stale), the verification-summary
heading, the vitest table row (`64 / 1149`), the e2e table row (`37`), and the per-area file breakdown
(stale at 64). The 80-file count was confirmed without running the suite:
`find src -name '*.test.ts' -o -name '*.test.tsx' | wc -l` → 80.

**Post-PG-0 figures for the next sync:** **81 test files / 1375 unit tests** (+1 file, +7 tests —
`src/test/clock.test.ts`), **e2e 42** (39 functional + 3 axe).

---

## 8. Validation (measured 2026-10-10, runner exit status, never a piped `grep`)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | **0 errors** |
| `npm run test` | **81 files / 1375 tests, all passing** |
| `npm run build` | **exit 0** |
| `npx playwright test --grep-invert axe-core` | **39 passed** |
| `npx playwright test e2e/a11y.spec.ts` | **3 passed** |
| `npm run test:e2e` | **42 passed** |
| `src/test/wallClockGuard.test.ts` | **2 passed, file unmodified** |
| copy-guard allow-list | **empty** (unchanged; `copy.guard.test.ts` green in the run above) |

CI itself was **not executed** — GitHub Actions cannot run here. The exact command sequence it runs was
executed locally and is green; `npx playwright install --with-deps chromium` is the step that makes the
browser stage green on a clean clone.

---

## 9. Follow-ups (not done here, on purpose)

1. **Mandate the helper over hand-rolled `vi.useFakeTimers` in new tests.** `wallClockGuard.test.ts` was
   left at its two sanctioned mechanisms (constraint 1) — making the helper mandatory is a change to an
   existing control and needs its own decision.
2. **The two existing tests were not migrated to the helper.** `Dashboard.test.tsx` and
   `Settings.fx.test.tsx` already fake time correctly; rewriting them would have widened the diff for no
   behavioural gain. New tests should use `pinClock()`.
3. **Axe on the other routes** — `/revenues`, `/expenses`, `/declarations`, `/documents`, `/settings`,
   `/e-factura`.
4. **B-69 → PG-12 / 28**: the real contrast and colour-coding pass, the `<main>` landmark, and the
   non-colour actual-vs-projected cue.
5. **`test-results/` and `playwright-report/` are still not in `.gitignore`** (pre-existing hygiene note in
   `STATE.md`); the CI artifact step uploads them but nothing stops a local commit.

---

## 10. NEXT HANDOFF

**Phase 11 + PG-3** (seed and first-run separation, both halves decided by **D-SEED-2**: no preloaded
data, seed data is test-only).

What PG-0 hands them:

- **Any date-dependent acceptance criterion may now be briefed** (§12.2's gate is open). Use
  `pinClock()` from `src/test/clock.ts` and the shared instant from `src/test/fixedInstant.ts`; do not
  hand-roll fake timers and do not invent a new date constant.
- **The unit layer and the browser layer pin the same day**, so a figure asserted in vitest and a figure
  asserted in Playwright are comparable without re-deriving anything.
- **B-46 is still open and still PG-2's** — three UTC date defaults at `Expenses.tsx:47`,
  `Revenues.tsx:30`, `Declarations.tsx:31`. PG-0 made the clock deterministic around them without touching
  them.
- **B-69 is open and is PG-12's.**
- **CI is live.** Every later Worker's changes run typecheck, 1375 unit tests, build, 39 functional e2e and
  the axe gate.
