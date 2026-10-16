# PHASE 8 BRIEF — FINANCIAL AMOUNT SEMANTICS

Repo: `/home/agent/workspace/solo-falcon-replica`. You are the WORKER for **Phase 8 only**.

**FIRST ACTION: read this file in full.** Then read `docs/ai/PLAN.md` (Phase 8 section, including the
**"Re-measured 2026-10-06, after Phase 7"** block — it supersedes the archived prompt), `docs/ai/STATE.md`
(defect register B-1…B-19, open questions, **"Archive corrections"**), and
`docs/ai/phases/07_identity.md` §10 ("Traps for the next reader").

---

## 0. Working rules (non-negotiable)

1. **One Worker at a time.** You are the only Worker. Do not spawn another.
2. **Spawn the Scouts you need BEFORE modifying anything**, and use their reports instead of searching
   the repository broadly yourself. Scouts are read-only and never modify files.
3. Scouts may run in parallel when their questions are independent. Each inspects the **smallest
   relevant territory** and returns: exact files, symbols, current behaviour, constraints, handoff notes.
4. If you find missing local information, spawn **another narrow Scout** — do not search broadly.
5. **One coherent, tightly scoped job.** Change only what this job requires.
6. Do **not** spawn a post-Worker Scout verification pass. Self-validate instead.
7. Self-validate with the narrowest useful checks: `npx tsc --noEmit`, `npm run build`,
   `npm run test`, `npm run test:e2e` — scoped to what you changed.
8. **Do not start Phase 9 or any later phase.** Stop when Phase 8's acceptance criteria are met.
9. **Scout infrastructure is a known defect.** The scout profile's configured model is unreachable
   (Phase 1: every attempt failed with a Connection error in ~2 s). If a Scout fails: retry **once**
   with an explicit working-model override; if that also fails, **STOP and report it as a BLOCKER**.
   Do **not** silently substitute your own self-inspection for the Scout.

### Handoff format (mandatory)

```
COMPLETED:
FILES CHANGED:
TESTS:
VALIDATION:
DECISIONS:
BLOCKERS:
NEXT HANDOFF:
```

---

## 1. Documentation namespace

- `docs/ai/steps/**` (02–34) is a **frozen archive**. Never rename, delete, renumber or overwrite it,
  and **never cite it as evidence of current behaviour**.
- Your deliverable is **`docs/ai/phases/08_amount_semantics.md`**.
- `docs/ai/PLAN.md` and `docs/ai/STATE.md` are the live shared state documents — update them.
- `docs/ai/notes/` and `docs/ai/briefs/` are working artifacts — **not sources of record**.
- **`docs/ai/research/06_2026_fiscal_research.md` is NOT authoritative.** Never cite it, nor
  `decisions/09_IMPLEMENTATION_ARCHITECTURE.md`, as `sourceUrl` on a production rule.
- Check `STATE.md`'s **"Archive corrections"** table before acting on any "known defect". Two claims
  that get re-sent in the standing prompt are **false**: the seed's "22% VAT ratio" (it is **21%**,
  which is statutory — do not "fix" it), and `settings.cotaTva` being a live value (it is still read
  nowhere).

---

## 2. Complete phase list (do not invent a boundary)

| # | Phase | Status |
|---|---|---|
| 1 | Real baseline (`steps/01_real_baseline.md`) | **COMPLETE** |
| 2 | Verified 2026 fiscal baseline + provenance (`phases/02_fiscal_baseline.md`) | **COMPLETE** |
| 3 | CAS correction (`phases/03_cas.md`) | **COMPLETE** |
| 4 | CASS correction (`phases/04_cass.md`) | **COMPLETE** |
| 5 | Income tax correction (`phases/05_income_tax.md`) | **COMPLETE** |
| 6 | Fiscal regime + profile foundation (`phases/06_fiscal_profile.md`) | **COMPLETE** |
| 7 | Identity source of truth + persisted-state migration (`phases/07_identity.md`) | **COMPLETE** |
| 8 | **Financial amount semantics — YOU ARE HERE** | in progress |
| 9 | Payment / collection dates | not started |
| 10 | Money precision | not started |

Baseline as measured at HEAD `4c04012`: `tsc` 0 · build 0 · **578 unit tests / 41 files** · **32 e2e**.
If your change is correct those numbers go **up**, not down.

---

## 3. PHASE 8 IS NOT BLOCKED — the standing prompt is out of date

The archived prompt says Phase 8 is "Blocked by Q-VAT-THRESHOLD, Q-VAT-BASIS, Q-NETGROSS" and "do not
decide this without the Researcher's answer." **All three were answered in Phase 2** and are closed in
`STATE.md:127-131`. **You need no Researcher to enter this phase.**

| ID | Resolved answer | Source of record |
|---|---|---|
| Q-VAT-THRESHOLD | **395,000 lei for 2026.** The discredited research doc's "2025 only / use 300,000" was **wrong**. | CF art. 310 alin. (1); OG nr. 22/2025, MO 806/29.08.2025 |
| Q-VAT-BASIS | The 395,000-lei plafon is **VAT-exclusive**. | CF art. 310 alin. (1)-(2) |
| Q-NETGROSS | `venituri` and `cheltuieli` are **net of VAT**. | OMFP 3254/2017 art. 4 alin. (3) + art. 5 alin. (6); CF art. 68 alin. (2)-(3) |

**Carry this caveat, do not resolve it:** the art. 310 alin. (2) reading is recorded honestly in
`phases/02_fiscal_baseline.md:255-258` — "exclusiv taxa" is grammatically attached to the
*ieșire din evidență* case, and alin. (2) also excludes fixed-asset deliveries. The VAT-exclusive
reading holds because **no provision anywhere measures the plafon TVA-inclusiv**, not because alin. (2)
is a global definition. State it that way; do not upgrade it into a cleaner claim than the evidence.

**And this provenance caveat:** Q-OMFP3254-HISTORY (U-7) — OMFP 3254/2017's amendment history could not
be verified (portal "Acțiuni suferite" returned 0 refs). Its being in force is established via OMF
808/2026 art. 8's express scope. The net-of-VAT base rests on that act. This does **not** block you; it
must appear as a caveat in your provenance.

---

## 4. The measured defect set (this is what "amount semantics" actually means here)

`computeThresholds` (`domain/thresholds.ts:161-198`) takes **one** `currentValue` and applies it to
every spec whose `requiredFiscalBase` matches. All four specs declare `'gross-revenue'`, and both call
sites pass the same thing: `currentValue: ytd.revenue`, `fiscalBase: 'gross-revenue'`
(`data/dashboard.ts:99-105` and `data/dashboard.ts:195-201`). `ytd.revenue` is **VAT-inclusive**
(`aggregation.ts:99`, `recordTotal(r)`).

| Spec | Rule param | Value | Compared against today | What the law measures |
|---|---|---|---|---|
| `CAS_MIN_BASE` | `CAS_2026.min_base` | 48,600 (12 SM) | VAT-inclusive gross revenue | the **CAS base** (net income) — CF art. 148 alin. (1) |
| `CASS_MIN_BASE` | `CASS_2026.min_base` | 24,300 (6 SM top-up floor) | VAT-inclusive gross revenue | the **CASS base** — CF art. 170 / 174 alin. (6) |
| `CASS_MAX_BASE` | `CASS_2026.max_annual_base` | 291,600 (72 SM) | VAT-inclusive gross revenue | the **CASS base** — CF art. 170 alin. (1) |
| `VAT_REGISTRATION` | `VAT_THRESHOLD_2026.threshold` | 395,000 | VAT-inclusive gross revenue | **VAT-exclusive turnover** — CF art. 310 alin. (1) |

So there are **two distinct errors**, and only one of them is the one the prompt mentions:

1. **Wrong VAT basis** on `VAT_REGISTRATION`: it measures a VAT-exclusive plafon against a
   VAT-inclusive number. The correct figure already exists — `revenueNet` (`aggregation.ts:101`,
   summing `valoareFaraTva`) — and is used only for display (`dashboard.ts:90`, `derived.ts:71`), never
   fed to a threshold.
2. **Wrong quantity entirely** on the three contribution rows: a *contribution base* is compared to
   *gross revenue*. `net-income` is a declared member of the `FiscalBase` union
   (`thresholds.ts:17`) that **zero production specs use** — it appears only in
   `thresholds.test.ts:275`. Phases 3–5 established what the CAS and CASS bases actually are; use those
   definitions, do not invent a new one.

**Design constraint you must solve, not work around:** one call cannot serve two bases. The second call
site sits inside `buildDashboardSnapshotView`, which **does** receive `tax: TaxEstimateResult`
(`dashboard.ts:188-195`), so a real contribution base is reachable there. The first,
`getThresholdStatuses(data, asOfDate)` (`dashboard.ts:97`), has **no access to the tax estimate** — so
either it takes the estimate as a parameter, or those three rows stop claiming a base they cannot
compute. Decide explicitly and write down why.

**Do not "fix" the tax engine's VAT handling.** `tax.ts` already selects `revenuesNet` when
`profile.vatExempt` is false, and it is false at every seed and default. VAT does **not** currently leak
into PFA taxable income. Make the semantics explicit and typed; do not invent a bug to fix.

**Vocabulary to make explicit** (the phase's real deliverable): transaction/cash amount · VAT amount ·
amount excluding VAT · gross amount · deductible expense · tax-relevant income. Note `types.ts` stores
**no** total — `total()` is a helper at `types.ts:176`, and `aggregation.ts:11` states plainly that no
total is stored.

---

## 5. Explicitly OUT of scope

- **Date semantics** (issued / received / paid) — Phase 9. There is one ambiguous date field per
  Revenue/Expense; leave it alone even though it is tempting.
- **Money representation and rounding policy** — Phase 10. **B-17 is owned by Phase 10.** `STATE.md`'s
  B-17 row currently names Phases 5, 10 and 8; Phase 10 is the owner. Do not centralise rounding here,
  and do not invent a legal rounding policy. If your basis change makes a rounding artefact visible,
  **record it for Phase 10** rather than fixing it.
- **Identity, persistence, migration, quarantine** — Phase 7 just closed these. Do not touch
  `data/migration.ts`, `data/quarantine.ts`, `data/store.tsx`'s load path, or `domain/snapshots/`.
- **A full VAT accounting system.** Not requested.
- **The 24 SM tier-floor threshold surface** — deliberately not built in Phase 7; it needs a new
  `ThresholdType` plus UI `labelFor`/`breachMeaningFor` cases. Only take it if you can cite it, and say
  so if you do not.
- **B-19** (CASS zeroed on the never-retrieved CF art. 154 alin. (1)) is a parked **research** item.
  Do not code around it and do not research it.
- **`settings.cotaTva`** is still read nowhere. Retiring it is not your job.

---

## 6. Traps

1. **THE SILENT-SKIP TRAP.** `thresholds.ts:173` is
   `if (spec.requiredFiscalBase !== query.fiscalBase) continue;`. A base mismatch **silently drops the
   threshold** — no error, no `REVIEW_REQUIRED`, the card just vanishes from the Dashboard. Correcting a
   spec's basis without mirroring the caller **deletes** a threshold instead of fixing it.
   `e2e/dashboard.spec.ts:165` asserts all four threshold cards render; keep it asserting four, and add
   a test that a base mismatch is either impossible or loud.
2. **Precedent against inventing thresholds.** `CAS_MAX_BASE` was **removed in Phase 3** because CF
   art. 148 alin. (2) sets floors ("nu poate fi mai mic decât") and contains **no CAS ceiling** — the
   row had asserted a statutory cap that does not exist (`thresholds.ts:79-87`). If a base you need has
   no citable threshold, return `REVIEW_REQUIRED` or drop the row; do not manufacture a number.
3. **`warningDistance = thresholdValue * 0.1`** (`thresholds.ts:181`) is a hardcoded UI warning band,
   not a statutory figure. Do not let it acquire a citation it does not have.
4. **Phase 7 changed the ground under you.** `profile.identity` is now the only identity store,
   `profile.caen` is deprecated, and `addSnapshot` still has **no production caller** — the app does not
   persist calculation snapshots yet. Do not assume stored snapshots exist at runtime.
5. **`playwright.config.ts:9`'s "No overload matches this call" is an LSP-only diagnostic**, not a
   defect (`tsconfig.json` `include: ["src"]` excludes root configs). Do not "fix" it.
6. **No 16% CASS rate, no `research/06` citations, no invented norm values.**

---

## 7. Acceptance criteria

1. `npx tsc --noEmit` 0 · `npm run build` 0 · `npm run test` green with **more** than 578 tests ·
   `npm run test:e2e` green with **more** than 32.
2. **`VAT_REGISTRATION` is measured on VAT-exclusive turnover**, with a test that pins the exact figure
   and shows it differs from the VAT-inclusive one on the seeded data (the seed has non-zero TVA, so the
   two numbers must not coincide).
3. **The three contribution rows are measured on their actual legal base**, each citing the article that
   defines that base — or are explicitly `REVIEW_REQUIRED` with the reason. No row may compare a
   contribution base to gross revenue after your change.
4. **All four threshold cards still render** (or the reduction is deliberate, cited, and asserted).
   Prove the silent-skip trap did not fire: a test that fails if a spec is dropped by a base mismatch.
5. **The amount vocabulary is explicit in types**, not in comments: a reader can tell cash amount, VAT
   amount, VAT-exclusive amount, and tax-relevant income apart without reading prose.
6. **The tax engine's existing net-of-VAT selection is unchanged in behaviour** — prove it with a test
   that the taxable base for the seeded profile is identical before and after your change.
7. `docs/ai/phases/08_amount_semantics.md` records: every base decision with its article, the alin. (2)
   caveat and U-7 caveat carried forward, the design decision about `getThresholdStatuses` lacking the
   tax estimate, what you left for Phase 9/10, and one line on any archived step file you contradict.
8. Update `STATE.md` honestly — **record anything you could not finish**. Do not quietly drop it.

If a legal fact you need is missing, **report a BLOCKER rather than guessing** — this app renders
citations to users, and a wrong citation is worse than a missing one.
