# Phase 8 Worker working notes — amount semantics

**NOT a source of record.** Working artifact (`docs/ai/notes/` per brief §1). Survives context compaction.
Worker: Phase 8 only. Repo `/home/agent/workspace/solo-falcon-replica`. Baseline HEAD `811ec5d`.

# ORCHESTRATOR PROMPT (verbatim, preserved so it survives compaction)

> You are the **WORKER for Phase 8 only** (financial amount semantics) in
> `/home/agent/workspace/solo-falcon-replica`.
>
> **FIRST ACTION: read `docs/ai/briefs/08_amount_semantics.md` in full.** It is your complete brief —
> working rules, the complete phase list (Phases 1–10, so you cannot invent a boundary), the resolved
> legal questions with their sources, the measured defect set, explicit out-of-scope, traps, and
> acceptance criteria. Do not start until you have read it.
>
> Then read: 1. `docs/ai/PLAN.md` — the Phase 8 section, **including the "Re-measured 2026-10-06, after
> Phase 7" block**, which supersedes the archived prompt's framing. 2. `docs/ai/STATE.md` — defect register
> B-1…B-19, the open-question register (`STATE.md:127-131` holds the three resolved VAT questions), and
> the **"Archive corrections"** table. 3. `docs/ai/phases/07_identity.md` §10 — "Traps for the next
> reader", written by the Phase 7 Worker about the ground that changed under you. 4.
> `docs/ai/phases/02_fiscal_baseline.md:240-260` — the VAT threshold finding and the art. 310 alin. (2)
> caveat.
>
> **Phase 8 is NOT blocked, and you need no Researcher to enter it.** The archived prompt claims Phase 8
> is blocked by Q-VAT-THRESHOLD, Q-VAT-BASIS and Q-NETGROSS and says not to decide without a Researcher.
> All three were answered in Phase 2 and are closed: **395,000 lei for 2026** (CF art. 310 alin. (1);
> OG 22/2025, MO 806/29.08.2025), the plafon is **VAT-exclusive**, and `venituri`/`cheltuieli` are **net
> of VAT** (OMFP 3254/2017 art. 4 alin. (3) + art. 5 alin. (6); CF art. 68 alin. (2)-(3)). Carry the alin.
> (2) caveat and the U-7 / Q-OMFP3254-HISTORY provenance caveat forward as written — do not upgrade them
> into cleaner claims than the evidence supports.
>
> **The defect is wider than the prompt says, and this is the core of your job.** `computeThresholds` takes
> ONE `currentValue` for every spec whose `requiredFiscalBase` matches; all four specs declare
> `'gross-revenue'`; both call sites (`dashboard.ts:99-105` and `dashboard.ts:195-201`) pass the same
> VAT-inclusive `ytd.revenue`. So there are two distinct errors: **Wrong VAT basis** — `VAT_REGISTRATION`
> measures a VAT-exclusive plafon against a VAT-inclusive number. `revenueNet` (`aggregation.ts:101`)
> already exists and is used only for display, never fed to a threshold. **Wrong quantity entirely** —
> `CAS_MIN_BASE` (48,600), `CASS_MIN_BASE` (24,300) and `CASS_MAX_BASE` (291,600) compare **contribution
> bases** to **gross revenue**. `net-income` is declared in the `FiscalBase` union (`thresholds.ts:17`) but
> **no production spec uses it**. Phases 3–5 already define what the CAS and CASS bases actually are — use
> those definitions, do not invent new ones.
>
> **Solve, do not work around, this design constraint:** one call cannot serve two bases.
> `buildDashboardSnapshotView` receives `tax: TaxEstimateResult` (`dashboard.ts:188-195`) so a real
> contribution base is reachable there, but `getThresholdStatuses(data, asOfDate)` (`dashboard.ts:97`) has
> no access to the estimate. Decide explicitly and write down why.
>
> **The trap that will bite you:** `thresholds.ts:173` is
> `if (spec.requiredFiscalBase !== query.fiscalBase) continue;` — a base mismatch **silently drops the
> threshold**. No error, no `REVIEW_REQUIRED`, the card just vanishes. Correcting a spec's basis without
> mirroring the caller **deletes** a threshold instead of fixing it. `e2e/dashboard.spec.ts:165` asserts
> four cards render; keep it asserting four, and add a test that fails if a spec is dropped by a base
> mismatch.
>
> **Do not manufacture any threshold.** Precedent: `CAS_MAX_BASE` was removed in Phase 3 because CF art.
> 148 alin. (2) sets floors and contains **no CAS ceiling** (`thresholds.ts:79-87`). If a base you need has
> no citable threshold, return `REVIEW_REQUIRED` or drop the row. Also: `warningDistance = thresholdValue *
> 0.1` (`thresholds.ts:181`) is a hardcoded UI band, not a statutory figure — do not let it acquire a
> citation it does not have.
>
> **Do not "fix" the tax engine's VAT handling.** `tax.ts` already selects `revenuesNet` when
> `profile.vatExempt` is false, and it is false at every seed and default. VAT does not currently leak into
> PFA taxable income. Make the semantics explicit and typed; acceptance criterion 6 requires a test that
> the seeded taxable base is identical before and after your change.
>
> **Boundaries:** dates (issued/received/paid) are Phase 9 — leave the ambiguous single date field alone
> even though it is tempting. **B-17 rounding is owned by Phase 10**: do not centralise rounding or invent
> a legal rounding policy; if your basis change makes a rounding artefact visible, record it for Phase 10.
> Do not touch `data/migration.ts`, `data/quarantine.ts`, `store.tsx`'s load path, or `domain/snapshots/` —
> Phase 7 closed those. Note `addSnapshot` still has **no production caller**: the app does not persist
> snapshots yet, so do not assume stored snapshots exist at runtime. **B-19** is a parked research item —
> do not code around it and do not research it. `settings.cotaTva` is still read nowhere; retiring it is
> not your job.
>
> **Two claims that get re-sent to you are false** (see STATE.md's "Archive corrections"): the seed's "22%
> VAT ratio" — it is **21%**, which is statutory, do not "fix" it; and `settings.cotaTva` being a live
> value. And `playwright.config.ts:9`'s "No overload matches this call" is an LSP-only diagnostic, not a
> defect.
>
> Baseline at HEAD `811ec5d`: `tsc` 0 · build 0 · **578 unit tests / 41 files** · **32 e2e**. If your change
> is correct those numbers go **up**.
>
> Spawn the Scouts you need before modifying anything; run them in parallel where their questions are
> independent. If a Scout fails with a connection error, retry once with an explicit working-model
> override; if that fails too, **stop and report it as a BLOCKER** — do not substitute your own
> self-inspection.
>
> Deliverable: `docs/ai/phases/08_amount_semantics.md`. Update `STATE.md` honestly — **record anything you
> could not finish**, do not quietly drop it.
>
> Stop when Phase 8's acceptance criteria are met. **Do not start Phase 9.** Report using the mandatory
> handoff format from the brief.

### Mid-task orchestrator addenda (these override nothing above, they are process instructions)

1. "do not do anything while the scouts run (beside reading the 4 docs)."
2. Skills are auto-loading and polluting context (hit 52% of 131k). "As soon as the scouts report comes,
   write their report, your decision, and everything else you would need to survive compaction." → this
   file is that record.
3. "check that you added scout 2 report" / "make sure the prompt the orchestrator gave you is also in the
   file."

---

## 0. Baseline to beat (measured at HEAD 811ec5d / 4c04012)

- `npx tsc --noEmit` → 0 errors
- `npm run build` → exit 0
- `npm run test` → **41 test files / 578 unit tests**, all passing
- `npm run test:e2e` → **32 e2e** (`e2e/dashboard.spec.ts` 24 + `e2e/settings.spec.ts` 8)
- All four numbers must go **UP**, not down.

## 1. Resolved legal facts (Phase 2 closed these — no Researcher needed)

| ID | Answer | Source of record |
|---|---|---|
| Q-VAT-THRESHOLD | **395,000 lei for 2026** (the "2025 only / use 300,000" claim was wrong) | CF art. 310 alin. (1); **Ordonanța** nr. 22/2025, MO 806/29.08.2025 |
| Q-VAT-BASIS | The 395,000-lei plafon is **VAT-exclusive** | CF art. 310 alin. (1)-(2) |
| Q-NETGROSS | `venituri` and `cheltuieli` are **net of VAT** | OMFP 3254/2017 art. 4 alin. (3) + art. 5 alin. (6); CF art. 68 alin. (2)-(3) |

### Caveats that MUST be carried forward verbatim, not upgraded

- **art. 310 alin. (2) caveat** (`phases/02_fiscal_baseline.md:255-258`): "exclusiv taxa" is grammatically
  attached to the *ieșire din evidență* case, and alin. (2) also excludes fixed-asset deliveries. The
  VAT-exclusive reading holds because **no provision anywhere measures the plafon TVA-inclusiv** — NOT
  because alin. (2) is a global definition. State it exactly that way.
- **U-7 / Q-OMFP3254-HISTORY**: OMFP 3254/2017's amendment history could not be verified (portal
  "Acțiuni suferite" returned 0 refs). Its being in force is established via **OMF 808/2026 art. 8**'s
  express scope (abrogates OMFP 870/2005 only). The net-of-VAT base rests on that act. Must appear as a
  provenance caveat.
- **U-1 / Q-NONDEDUCT-VAT**: whether non-deductible TVA enters deductible expense for a neplătitor de TVA
  is **UNVERIFIED, inference only, Medium**. Must stay `REVIEW_REQUIRED`, never a computed sourced rule.
- Do NOT cite HG 1/2016 for the netting rule (full-text scan found zero TVA netting paragraphs in Titlul IV).
- Do NOT cite `docs/ai/research/06_2026_fiscal_research.md` or `decisions/09_IMPLEMENTATION_ARCHITECTURE.md`
  as `sourceUrl` on a production rule.

## 2. The measured defect set (core of the job)

`computeThresholds` (`src/domain/thresholds.ts:161-198`) takes ONE `currentValue` for every spec whose
`requiredFiscalBase` matches. All four specs declare `'gross-revenue'`. Both call sites pass the same
VAT-inclusive `ytd.revenue`: `src/data/dashboard.ts:99-105` and `src/data/dashboard.ts:195-201`.
`ytd.revenue` is VAT-inclusive (`aggregation.ts:99`, `recordTotal(r)`).

| Spec | Rule param | Value | Compared against today | What the law measures |
|---|---|---|---|---|
| `CAS_MIN_BASE` | `CAS_2026.min_base` | 48,600 (12 SM) | VAT-inclusive gross revenue | the **CAS base** (net income) — CF art. 148 alin. (1) |
| `CASS_MIN_BASE` | `CASS_2026.min_base` | 24,300 (6 SM top-up floor) | VAT-inclusive gross revenue | the **CASS base** — CF art. 170 / 174 alin. (6) |
| `CASS_MAX_BASE` | `CASS_2026.max_annual_base` | 291,600 (72 SM) | VAT-inclusive gross revenue | the **CASS base** — CF art. 170 alin. (1) |
| `VAT_REGISTRATION` | `VAT_THRESHOLD_2026.threshold` | 395,000 | VAT-inclusive gross revenue | **VAT-exclusive turnover** — CF art. 310 alin. (1) |

Two distinct errors:
1. **Wrong VAT basis** on `VAT_REGISTRATION`. Correct figure already exists: `revenueNet`
   (`aggregation.ts:101`, sums `valoareFaraTva`) — used only for display (`dashboard.ts:90`,
   `derived.ts:71`), never fed to a threshold.
2. **Wrong quantity entirely** on the three contribution rows: a *contribution base* compared to *gross
   revenue*. `net-income` is declared in the `FiscalBase` union (`thresholds.ts:17`) but **zero production
   specs use it** — only `thresholds.test.ts:275`. Phases 3–5 already define the real CAS/CASS bases;
   **use those definitions, do not invent new ones.**

### Design constraint to SOLVE, not work around

One call cannot serve two bases. `buildDashboardSnapshotView` receives `tax: TaxEstimateResult`
(`dashboard.ts:188-195`) so a real contribution base is reachable there. `getThresholdStatuses(data,
asOfDate)` (`dashboard.ts:97`) has **no access to the tax estimate** → either it takes the estimate as a
parameter, or those three rows stop claiming a base they cannot compute. **Decide explicitly and write
down why.**

## 3. Traps

1. **SILENT-SKIP**: `thresholds.ts:173` = `if (spec.requiredFiscalBase !== query.fiscalBase) continue;`
   A base mismatch **silently drops the threshold** — no error, no `REVIEW_REQUIRED`, card vanishes.
   Correcting a spec's basis without mirroring the caller **deletes** a threshold.
   `e2e/dashboard.spec.ts:165` asserts four cards render → keep it asserting four, AND add a test that
   fails if a spec is dropped by a base mismatch.
2. **No invented thresholds.** `CAS_MAX_BASE` (the CAS one) was removed in Phase 3 because CF art. 148
   alin. (2) sets floors ("nu poate fi mai mic decât") and contains **no CAS ceiling**
   (`thresholds.ts:79-87`). If a base has no citable threshold → `REVIEW_REQUIRED` or drop the row.
3. `warningDistance = thresholdValue * 0.1` (`thresholds.ts:181`) is a **hardcoded UI band**, not a
   statutory figure. Never give it a citation.
4. Phase 7 changed the ground: `profile.identity` is the only identity store; `profile.caen` deprecated
   but parseable; **`addSnapshot` still has NO production caller** — the app does not persist snapshots,
   so do not assume stored snapshots exist at runtime.
5. `playwright.config.ts:9` "No overload matches this call" is **LSP-only** (`tsconfig.json`
   `include: ["src"]` excludes root configs). Do NOT "fix".
6. No 16% CASS rate. No `research/06` citations. No invented norm values.

## 4. FALSE claims that get re-sent — do not "fix"

- Seed "22% VAT ratio" → **FALSE**. Implied rate across all seven seeded money rows (945/4500, 252/1200,
  168/800, 672/3200, 25.2/120, 17.96/85.5, 71.4/340) is **21.00–21.01%**. 21% **is** statutory; the 0.01
  is `85.5 × 21%` rounded to `17.96`. Editing the seed corrupts correct data.
- `settings.cotaTva` being a live value → **still read nowhere** (only the type at `data/types.ts:110` and
  the schema at `data/schema.ts:188`). Retiring it is NOT my job.

## 5. OUT of scope (hard boundary — Phases 1–10: 1 real baseline, 2 fiscal baseline, 3 CAS, 4 CASS,
5 income tax, 6 fiscal profile, 7 identity, **8 = me**, 9 dates, 10 money precision)

- **Date semantics** (issued/received/paid) → Phase 9. Leave the single ambiguous `date` field alone.
- **B-17 rounding / money precision** → **Phase 10 owns it**. Do not centralise rounding, do not invent a
  legal rounding policy. If my basis change makes a rounding artefact visible, **record it for Phase 10**.
- **Identity / persistence / migration / quarantine** → Phase 7 closed. Do NOT touch `data/migration.ts`,
  `data/quarantine.ts`, `data/store.tsx`'s load path, `domain/snapshots/`.
- A full VAT accounting system — not requested.
- The **24 SM tier-floor threshold surface** — needs a new `ThresholdType` + UI `labelFor`/
  `breachMeaningFor` cases. Only take it if I can cite it; say so if I do not.
- **B-19** (CASS zeroed on never-retrieved CF art. 154 alin. (1)) — parked research item. Do not code
  around it, do not research it.
- Do NOT "fix" the tax engine's VAT handling: `tax.ts` already selects `revenuesNet` when
  `profile.vatExempt` is false, and it is false at every seed/default (`seed.ts:14`, `store.tsx:81`,
  `profile.ts:46`). VAT does NOT currently leak into PFA taxable income. Make it explicit + typed only.

## 6. Acceptance criteria (verbatim intent)

1. tsc 0 · build 0 · unit **> 578** · e2e **> 32**.
2. `VAT_REGISTRATION` measured on **VAT-exclusive turnover**, with a test pinning the exact figure and
   showing it **differs** from the VAT-inclusive one on seeded data (seed has non-zero TVA).
3. The three contribution rows measured on their **actual legal base**, each citing the article that
   defines that base — or explicitly `REVIEW_REQUIRED` with the reason. **No row may compare a
   contribution base to gross revenue after my change.**
4. All four threshold cards still render (or the reduction is deliberate, cited, asserted). Prove the
   silent-skip trap did not fire: a test that fails if a spec is dropped by a base mismatch.
5. Amount vocabulary explicit **in types**, not comments: cash amount · VAT amount · VAT-exclusive amount
   · gross amount · deductible expense · tax-relevant income — distinguishable without prose.
6. Tax engine's existing net-of-VAT selection **unchanged in behaviour** — test that the seeded taxable
   base is **identical before and after** my change.
7. `docs/ai/phases/08_amount_semantics.md` records: every base decision + article, the alin. (2) caveat
   and U-7 caveat carried forward, the `getThresholdStatuses` design decision, what I left for
   Phase 9/10, and one line on any archived step file I contradict.
8. Update `STATE.md` honestly — record anything I could not finish.

## 7. Phase 7 §10 traps that bind me

- A required new field is a data-loss event → new persisted fields must be `.optional()` + migrated.
  (I should avoid adding persisted fields at all.)
- `inputsKey` ≠ `inputsHash`. Do not unify. Load path must never re-hash.
- `settings.company`/`settings.personal` are required in schema, inert in app — do not make optional.
- `profile.caen` deprecated but parseable.
- The save effect fires on first mount.
- `dataOrigin` has three values; must not gain a fourth for migration.
- e2e round-trip tests must not seed localStorage if they then reload (`addInitScript` re-runs).

## 8. Follow-ups handed TO Phase 8 (from PLAN.md)

- From Phase 3: CAS floor figures + "no upper cap" live in the calculator `breakdown` as **text**; if they
  become rendered amounts they need this phase's semantics pass. `CAS_MIN_BASE`'s shared
  "dezcalificare din regim" wording needs a tax-specific map (for CAS, being under 12 SM means **no CAS is
  owed**, not disqualification).
- From Phase 5 (B-17): ownership is **Phase 10**. The seed's `Rezervă lunară` is a second live half-cent
  (`3.104,505 / 3 = 1.034,835` → rendered `1.034,84`), produced at presentation level.

## 9. Handoff format (mandatory, verbatim)

```
COMPLETED:
FILES CHANGED:
TESTS:
VALIDATION:
DECISIONS:
BLOCKERS:
NEXT HANDOFF:
```

## 10. Scout reports (append each as it lands)

### scout-thresholds — DONE (report condensed, faithful)

**Files:** `src/domain/thresholds.ts` (268 lines) · `src/domain/thresholds.test.ts` (437 lines, 46 tests:
27 `computeThresholds` + 11 `income threshold type (Step 29)` + 8 `ratio rule status (Step 29)`) ·
`src/data/dashboard.ts` (lines 12, 97-106, 195-201, 248) = **only production caller, 2 call sites** ·
`src/domain/fiscal/select.ts` (16 lines) · `src/domain/fiscal/package2026.ts` (CAS_2026 82-113,
CASS_2026 117-164, VAT_THRESHOLD_2026 218-237) · `src/components/dashboard/ThresholdSection.tsx`
(37-45 local `labelFor`) · `ThresholdSection.test.tsx`.

**Types (verbatim shapes):**
- `ThresholdType = 'min-base' | 'max-base' | 'registration' | 'income'` (:4)
- `FiscalBase = 'gross-revenue' | 'gross-expenses' | 'net-income'` (:5-17)
- `FiscalThreshold` (:19-42): `thresholdId, type, currentValue, thresholdValue, distance
  (= currentValue - thresholdValue, negative = below), affectedDomain, affectedTax, effectiveDate,
  warningDistance, ruleRelease, source, status: 'ok'|'warning'|'breached', fiscalBase: FiscalBase,
  breachMeaning`
- `ThresholdQuery` (:44-51): `{ taxYear: number; asOfDate: string; currentValue: number;
  fiscalBase: FiscalBase; ruleRelease: string }`
- `ThresholdSpec` (:53-66) — **NOT exported**: `{ thresholdId, type, ruleId, paramId, affectedDomain,
  affectedTax, requiredFiscalBase }`
- `RatioRuleStatus = 'ok'|'warning'|'breached'` (:215); `RatioRule` (:228-241)
- **No exported `ThresholdStatus` type** (inline union at :35). **No `REVIEW_REQUIRED` anywhere in
  thresholds.ts** — a missing rule/param/base is a silent `continue`, never a review flag.

**`THRESHOLD_SPECS` (:68-116)** — 4 specs, ALL `requiredFiscalBase: 'gross-revenue'`,
ALL `affectedDomain: 'pfa-revenue'`:
| id | type | ruleId/paramId | value | affectedTax |
|---|---|---|---|---|
| CAS_MIN_BASE | min-base | CAS_2026/min_base | 48600 (pkg:89) | cas |
| CASS_MIN_BASE | min-base | CASS_2026/min_base | 24300 (pkg:124) | cass |
| CASS_MAX_BASE | max-base | CASS_2026/max_annual_base | 291600 (pkg:125) | cass |
| VAT_REGISTRATION | registration | VAT_THRESHOLD_2026/threshold | 395000 (pkg:224) | vat |

Specs carry **no label/breach/citation fields**. Citation is built at runtime:
`source: `${rule.sourceAct} ${rule.sourceArticle}`` (:189). Breach text from `breachMeaningFor(type)`
(:146-160): min-base → `Sub baza minimă — dezcalificare din regim`; max-base → `Peste plafonul maxim al
bazei — schimbare de regim`; registration → `La sau peste prag — se declanșează obligația de
înregistrare`; income → `Peste pragul de venit — …`; ratio → `Raport sub minimumul cerut — risc de
reclasificare`. (Phase 3 comment at :79-87 records the CAS_MAX_BASE removal precedent and says a correct
replacement needs a NEW `ThresholdType` + UI `labelFor`/`breachMeaningFor` case.)

**`computeThresholds` (:161-194)** — control flow:
```ts
const applicable = selectApplicableRules(rules, { taxYear: query.taxYear, asOfDate: query.asOfDate });
for (const spec of THRESHOLD_SPECS) {
  if (spec.requiredFiscalBase !== query.fiscalBase) continue;   // :173 SILENT SKIP
  const rule = applicable.find(r => r.ruleId === spec.ruleId);
  if (!rule) continue;                                          // :175 also silent
  const param = rule.parameters.find(p => p.id === spec.paramId);
  if (!param || typeof param.value !== 'number') continue;      // :177 also silent
  const thresholdValue = param.value;
  const distance = query.currentValue - thresholdValue;
  const warningDistance = thresholdValue * 0.1;                 // :183 (brief said :181)
  results.push({ ...status: statusFor(spec.type, distance, warningDistance),
                 fiscalBase: query.fiscalBase, breachMeaning: breachMeaningFor(spec.type) });
}
```
One `currentValue` is shared by every surviving spec; `query.fiscalBase` is echoed into each result.

**`statusFor` (:118-140)** — registration: `distance>=0`→breached, `>=-warning`→warning, else ok.
min-base: `distance<0`→breached; max-base: `distance>0`→breached; then `|distance|<=warning`→warning
else ok.

**Exported helpers:** `statusFor`, `breachMeaningFor`, `computeThresholds`, `statusForRatioRule` (:253),
`withRatioRuleStatus` (:265). **No spec-lookup helper, no exported `labelFor`** — `labelFor` is
module-private in `ThresholdSection.tsx:37`.

**Call sites (both hardcode `fiscalBase:'gross-revenue'`, `currentValue: ytd.revenue`,
`ruleRelease: PFA_2026_RELEASE.ruleIds[0]`):** `dashboard.ts:99-105` inside
`getThresholdStatuses(data, asOfDate)`; `dashboard.ts:195-201` inside **`buildSnapshot(data, asOfDate,
tax)`** (note: scout names it `buildSnapshot`, not `buildDashboardSnapshotView`).
`getThresholdStatuses` is called at `dashboard.ts:248` (`thresholds:` field of the view).
Pipeline: `dashboard.ts` → `computeThresholds` → `selectApplicableRules` (filters `taxYear ===`,
`status === 'ACTIVE'`, `effectiveFrom <= asOfDate`, `effectiveTo === null || >= asOfDate`) → param lookup
→ `statusFor` → `FiscalThreshold[]` → `ThresholdSection.tsx` renders `labelFor(t)` + `formatLei`.

**Tests that will break / must be mirrored:**
- shared `QUERY` (:15-21): `taxYear 2026, asOfDate '2026-03-15', currentValue 100000,
  fiscalBase 'gross-revenue', ruleRelease 'PFA_2026_RELEASE'`.
- `returns 4 thresholds for 2026` (len 4) — **count-sensitive**.
- `warningDistance is exactly 10% of the threshold value` → 4860 / 2430 / 29160 / 39500.
- three end-to-end warning-band tests: min-base 53460→warning / 53461→ok; max-base 262440→warning /
  262439→ok; registration 355500→warning / 355499→ok.
- `every threshold carries the query fiscalBase` (all `'gross-revenue'`).
- **THE TWO SKIP TESTS — `thresholds.test.ts:270-280` `mismatched fiscal base → all specs skipped
  (empty result)` with `fiscalBase:'net-income'` → `toHaveLength(0)`; and `:282-292`
  `gross-expenses base → all specs skipped` → `toHaveLength(0)`.** These two tests currently **pin the
  silent-skip behaviour as correct**. If I add specs on `net-income`, the first one breaks — it must be
  rewritten to assert loudness, not emptiness.
- `has no CAS max-base row…` (CAS_MAX_BASE undefined; cas rows === `['CAS_MIN_BASE']`).
- `VAT: thresholdValue 395000, effectiveDate 2025-09-01`.
- `income has no fiscal rule spec (conceptual completeness only)`.
- `returns thresholds for 2026` uses `currentValue 100000` → CAS_MIN_BASE distance +51400 etc.

**`package2026.ts:234` already records the gap verbatim:** *"dashboard.ts feeds VAT-inclusive ytd.revenue
to this test"*.

**Start-here advice from the scout:** read `thresholds.ts:44-194` first — `ThresholdQuery` +
`THRESHOLD_SPECS` + `computeThresholds` determine everything observable downstream.

## 10b. scout-dashboard — DONE (condensed, faithful)

**★ PATH CORRECTIONS (the brief/PLAN line numbers were wrong about locations):**
- `src/data/aggregation.ts` **does not exist** → aggregation is **`src/domain/aggregation.ts`**.
- `src/data/derived.ts` is **React hooks only**; the pure tax-input selector is **`src/domain/derived.ts`**.
- **`buildDashboardSnapshotView` does not exist** → real names are **`buildSnapshot`** (private,
  `dashboard.ts:186-238`) and **`buildDashboardData`** (public, `dashboard.ts:241-256`).
- `TaxEstimateResult` is in **`src/domain/tax.ts`**, not `models.ts`.

**`src/domain/aggregation.ts`:**
```ts
17 export interface YtdTotals { revenue: number; expenses: number; net: number;
   /** Total revenues without VAT (valoareFaraTva only), lei. */ revenueNet: number;
   /** Total expenses without VAT (valoareFaraTva only), lei. */ expenseNet: number; }
70 function recordTotal(r: Pick<Revenue,'valoareFaraTva'|'tva'>) { return r.valoareFaraTva + r.tva; }
78 function inPeriod(date, asOfDate, fiscalYear) { Number(date.slice(0,4)) === fiscalYear && date <= asOfDate }
91 export function selectYtd(data: AppData, asOfDate: string): YtdTotals {
     // loops data.revenues / data.expenses, filter: status === 'inregistrata' && inPeriod(...)
     //   revenue += recordTotal(r);  revenueNet += r.valoareFaraTva
     //   expenses += recordTotal(e); expenseNet += e.valoareFaraTva
     return { revenue, expenses, net: revenue - expenses, revenueNet, expenseNet }; }
```
`selectMonthly` at 118-141. **`selectYtd` is the single origin of every amount.**

**`src/data/types.ts`:** `Revenue` (9-21) and `Expense` (26-36) carry `valoareFaraTva` + `tva` + one
`date`; **no stored total**. `export const total = (r: Revenue | Expense) => r.valoareFaraTva + r.tva;`
(:176). `Declaration` (52-60) is the only record with **stored** amounts (`venituri`/`cheltuieli`, no VAT
split) and is **not** used by `selectYtd`. `AppData` 153-165.

**`src/data/dashboard.ts` verbatim:**
```ts
97 export function getThresholdStatuses(data: AppData, asOfDate: string): FiscalThreshold[] {
98   const ytd = selectYtd(data, asOfDate);
99   return computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, {
       taxYear: data.profile.fiscalYear, asOfDate,
       currentValue: ytd.revenue, fiscalBase: 'gross-revenue',
       ruleRelease: PFA_2026_RELEASE.ruleIds[0] }); }
// ONLY call site: dashboard.ts:248 `thresholds: getThresholdStatuses(data, asOfDate),`

186 function buildSnapshot(data: AppData, asOfDate: string, tax: TaxEstimateResult): DashboardSnapshotView {
189   const taxYear = data.profile.fiscalYear;
192   const ytd = selectYtd(data, asOfDate);
193-200  const thresholds = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, { taxYear, asOfDate,
         currentValue: ytd.revenue, fiscalBase: 'gross-revenue',
         ruleRelease: PFA_2026_RELEASE.ruleIds[0] });   // ← DUPLICATES getThresholdStatuses inline
       const reserve = computeTaxReserve(tax, createTaxReserveState(null), { asOfDate, fiscalYear: taxYear });
     return { asOf, taxYear, pfaRevenue: ytd.revenue, missing, stale: [], deadlines: [...],
       thresholds: thresholds.map(t => ({ id: t.thresholdId, label: t.affectedDomain,
         current: t.currentValue, limit: t.thresholdValue,
         ratio: t.thresholdValue === 0 ? 0 : t.currentValue / t.thresholdValue,
         breached: t.distance > 0, type: t.affectedTax === 'vat' ? 'vat' : 'income',
         affectedTax: t.affectedTax })),
       taxReserve: { projectedLiabilityCents: (reserve.estimatedTaxLiability ?? 0)*100,
         targetReserveCents: reserve.remainingTarget*100, currentReserveCents: (reserve.reservedAmount??0)*100,
         gapCents: reserve.remainingTarget*100, coverageMonths: reserve.monthsRemaining,
         projectedQ4LiabilityCents: 0, taxYear } }; }

241 export function buildDashboardData(data: AppData, tax: TaxEstimateResult,
                                       instant: Date = now()): DashboardData {
242   const asOfDate = isoToday(instant);
243   const snapshot = buildSnapshot(data, asOfDate, tax);
     return { taxYear, snapshot, tax, thresholds: getThresholdStatuses(data, asOfDate),
       deadlines: getUpcomingDeadlines(...), completeness: getDataCompleteness(data),
       actions: getActionItems(data, instant), reserve: getTaxReserve(data, asOfDate, tax),
       insights: getInsights(data, snapshot, tax), pendingCounts: getPendingCounts(data),
       legislation: getLegislationState(data) }; }
```
**★ `buildDashboardData` already HAS `tax: TaxEstimateResult` in hand** — so passing it down to
`getThresholdStatuses` is trivial. `buildSnapshot` call site: only `dashboard.ts:243`.
`buildDashboardData` call sites: `src/data/dashboardAdapter.tsx:22`
(`buildDashboardData(data, estimate ?? LOADING_TAX)`, `estimate` from `useLatestTaxEstimate(localDateISO())`
at `:21`; **`LOADING_TAX` defined at `dashboardAdapter.tsx:13`**) and `src/data/dashboard.test.ts:209`.
`getFinancialSummary` 57-59, `getTaxEstimate` 82-95 also in this file.

**`src/domain/tax.ts:15-27` + `38-46` verbatim:**
```ts
15 export interface TaxCalculationInput { inputs: TaxInputsReference; profile: PfaProfile;
   revenues: number; expenses: number;
   /** Total revenues without VAT (valoareFaraTva only), lei. */ revenuesNet: number;
   /** Total expenses without VAT (valoareFaraTva only), lei. */ expensesNet: number;
   ruleRelease: RuleRelease; rules: FiscalRule[]; }
38 export type TaxEstimateResult =
   | { status: 'computed'; lines: CalculationLine[]; output: CalculationOutput;
      snapshot: TaxCalculationSnapshot; lossCarryForward?: FiscalLossCarryForward }
   | { status: 'review_required'; reason: string; lines: CalculationLine[] };
```
**`src/domain/snapshots/types.ts:23-38`:** `CalculationInput { profile; revenues: number /* comment says
"(valoareFaraTva)" — MISLEADING, it is whichever base tax.ts selected */; expenses: number }` ·
`CalculationLine { label: string; value: number }` · `CalculationOutput { total: number }`.
**There is NO typed field for any base** — the taxable/net and CAS/CASS bases exist **only as label
strings** in `tax.ts` (`'Venit brut'`, `'Cheltuieli deductibile'`, `'Venit net din activitate'`,
`'CAS (25%)'`, `'CASS (10%)'`, `'CAS deductibilă (art. 118 alin. (2^2))'`,
`'CASS deductibilă (art. 118 alin. (2^3), fără diferența art. 174 alin. (6))'`,
`'Venit net anual impozabil (art. 118 alin. (2) lit. b))'`, `'Impozit pe venit (rată de bază 10%)'`,
`'Total taxe'`).

**`src/data/derived.ts:63-73` (`useLatestTaxEstimate`) feeds the engine:**
```ts
computeTaxEstimate({ inputs: taxInputs.inputs, profile: store.profile,
  revenues: derived.ytd.revenue, expenses: derived.ytd.expenses,
  revenuesNet: derived.ytd.revenueNet, expensesNet: derived.ytd.expenseNet,
  ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE })
```
Identical shape in `data/dashboard.ts:82-95` (`getTaxEstimate`). **`vatExempt` is NOT a top-level amount
arg** — it travels inside `inputs: TaxInputsReference`, built at `domain/derived.ts:140`
(`vatExempt: profile.vatExempt`). Full `TaxInputsReference` at `domain/derived.ts:82-101`:
`regime, salaryStatus, salaryIncomeLei, pensionStatus, otherIncome, socialInsuranceStatus, vatExempt,
cashFloorLei, fiscalYear, pfaStartDate, inputsKey`. `profile.vatExempt: boolean` at `models.ts:170`.

**Architecture:** `AppData` → `domain/aggregation.ts:selectYtd` (single origin of gross vs net) →
(1) threshold path feeds **only `ytd.revenue`** with `'gross-revenue'`; (2) tax path feeds all four totals
+ `inputs` → `computeTaxEstimate` picks gross vs net via `inputs.vatExempt`, derives `net`, feeds
`base: net` to CAS/CASS. `computeTaxReserve` and `buildSnapshot.taxReserve` consume only
`TaxEstimateResult.output.total` (×100 for cents).

---

## 14. MY DECISIONS (made, with reasons)

**D-1 — One call CAN serve many bases: change `ThresholdQuery` from one `(currentValue, fiscalBase)` to a
base map.** The brief's "one call cannot serve two bases" is only true of the *current* query shape. The
real defect is that the query carries exactly one number and one label, so a spec needing a different
quantity has nothing to read. Fix: `ThresholdQuery.bases: ThresholdBases` — a record keyed by `FiscalBase`
whose entries may be absent. Then **one** `computeThresholds` call serves all four specs, and
`getThresholdStatuses` gains a third parameter `tax: TaxEstimateResult` (which `buildDashboardData` and
`buildSnapshot` already hold at `dashboard.ts:241-243` / `:186-188`). Chosen over "drop the three rows in
the display path" because criterion 3 forbids a contribution row measured on gross revenue AND criterion 4
wants four cards; chosen over "two separate calls" because two calls would let the two paths drift.

**D-2 — `FiscalBase` becomes an explicit amount vocabulary.** Replace
`'gross-revenue' | 'gross-expenses' | 'net-income'` with named, article-annotated bases:
`'revenue-incl-vat'` (cash collected = `valoareFaraTva + tva`), `'revenue-excl-vat'` (**cifră de afaceri**,
`valoareFaraTva` only — the base CF art. 310 alin. (1) measures), `'expense-incl-vat'`,
`'expense-excl-vat'`, `'net-income'` (**venitul net din activitate** — the CAS base per CF art. 148 alin.
(1)-(2) and the CASS base (VNA) per CF art. 170 alin. (1) / art. 174 alin. (6)). This is the phase's real
deliverable (PLAN: "replacing the three unrelated bases now in play").

**D-3 — Spec bases:** `CAS_MIN_BASE`, `CASS_MIN_BASE`, `CASS_MAX_BASE` → `'net-income'`; `VAT_REGISTRATION`
→ `'revenue-excl-vat'`. The `'net-income'` value is **exactly `net` at `tax.ts:98`** — the same number
already passed as `base:` to `calcCas` (`:120`) and `calcCass` (`:148`). Not a new definition.

**D-4 — The silent skip becomes loud.** A spec whose required base has **no supplied value** now emits a
row with `status: 'review_required'` + `reviewReason`, instead of `continue`. `FiscalThreshold['status']`
gains `'review_required'`, which makes `STATUS_BADGE`/`STATUS_LABEL` in `ThresholdSection.tsx` **compile
errors** until the UI handles it — TS-enforced loudness. `currentValue` becomes `number | null`.

**D-5 — Typed bases on `TaxEstimateResult`.** Add `bases: TaxAmountBases` to the `computed` variant
(`venitulBrut`, `cheltuieliDeductibile`, `venitulNetDinActivitate`). This is a **runtime result type, not a
persisted one** — `inputSnapshot`/`inputsHash` are untouched, so Phase 7 §10 traps 2/3 are not triggered.
Behaviour of `tax.ts:87-88` is unchanged; only the naming is made explicit.

**D-6 — No new thresholds, no new statuses beyond `review_required`, no rounding.** `warningDistance`
stays `thresholdValue * 0.1` with an explicit "UI band, not a statutory figure" comment. The 24 SM
tier-floor surface is **NOT taken** (needs a new `ThresholdType` + UI cases; recorded as not taken).

## 15. Implementation plan (tight scope)

1. `src/domain/thresholds.ts` — new `FiscalBase`, `ThresholdBases`, `review_required` status,
   `reviewReason?`, `currentValue: number | null`, spec bases per D-3, loud missing-base row, export
   `THRESHOLD_SPECS` (readonly) so a test can prove every spec's base is supplied by the production caller.
2. `src/domain/tax.ts` — add `bases: TaxAmountBases` to the computed result; no behaviour change.
3. `src/data/dashboard.ts` — `getThresholdStatuses(data, asOfDate, tax)`; make `buildSnapshot` reuse it
   instead of duplicating the inline call.
4. `src/components/dashboard/ThresholdSection.tsx` — `review_required` badge/label + null current.
5. `src/domain/aggregation.ts` — strengthen the amount vocabulary on `YtdTotals` (comments naming the six
   concepts); no field renames (too much ripple: FinancialSummary, derived, dashboard, e2e).
6. Tests: update `thresholds.test.ts` (the two skip tests at `:270-292` must be **rewritten to assert
   loudness**, not emptiness), `ThresholdSection.test.tsx`, `dashboard.test.ts`,
   `e2e/dashboard.spec.ts:165-195` (keep `.item-row` count **4**; `Curent:` becomes 7.494,50 ×3 and
   7.700,00 ×1). Add: seeded-data test that VAT base 7 700 ≠ 9 317; base-map coverage test; taxable-base
   identical before/after (52 002.9 at 6 dp).

## 16. Status log

- 4/4 Scouts complete. No Scout failures → no BLOCKER on Scout infrastructure.
- Baseline re-measured by me at current HEAD: `tsc --noEmit` → **0** · `npm run test` → **41 files / 578
tests**, all passing. Matches the brief.

### 16a. Two findings from re-reading the source (they change the plan)

**F-1 — `YtdTotals.net` is NOT the contribution base. Do not use it for `'net-income'`.**
`aggregation.ts:110` returns `net: revenue - expenses` where both operands are **VAT-inclusive**
(`recordTotal` = `valoareFaraTva + tva`). On the seed that is **9 068,34 lei**, whereas the fiscal
`venitul net din activitate` the engine actually contributes on is **7 494,50 lei** (net-of-VAT revenue
7 700 − net-of-VAT expense 205,50). The old `FiscalBase` doc comment at `thresholds.ts:11` asserted
`net-income: YTD profit/loss (YtdTotals.net)` — that comment is **wrong in law** and is one of the things
this phase must remove. `'net-income'` must be sourced from the **tax engine** (`tax.ts:98`), never from
`selectYtd`.

**F-2 — Blast radius of `FiscalThreshold` is small and the snapshot shape is `Threshold` in
`aggregation.ts`, not a `DashboardThreshold` in `data/types.ts`.**
- `FiscalThreshold` is referenced only by `src/data/dashboard.ts` (:12 import, :39
  `DashboardData.thresholds`, :97 `getThresholdStatuses`), `src/components/dashboard/ThresholdSection.tsx`
  (:1, :18 `STATUS_BADGE: Record<FiscalThreshold['status'], string>`, :25 `STATUS_LABEL`, :37 `labelFor`,
  :63) and the two test files. Nothing else.
- `DashboardSnapshotView extends DashboardSnapshot` (`dashboard.ts:31-33`), and `DashboardSnapshot` +
  **`Threshold`** are defined in **`src/domain/aggregation.ts:41-69`** — `Threshold.current: number`,
  `ratio: number`. `buildSnapshot` maps `current: t.currentValue` and
  `ratio = currentValue / thresholdValue`, so a `null` current needs `Threshold.current: number | null`
  and a null-guard on `ratio`.
- `Threshold.current` is also consumed by `src/domain/insights.ts` (imports `Threshold`,
  `DashboardSnapshot` from `./aggregation`) — check `insights.ts` for `current` arithmetic.

**Consequence:** adding `'review_required'` to the status union makes `STATUS_BADGE`/`STATUS_LABEL`
(`Record<FiscalThreshold['status'], …>`) **compile errors** until the UI handles it. That is the
TS-enforced loudness I want (D-4), and it means the silent-skip trap cannot fire silently again.

### 16b. Plan deltas after F-1/F-2

- Step 1 also: **delete the false `net-income: YtdTotals.net` doc claim** and state that `net-income` is
  supplied only by the tax engine.
- Step 3 also: widen `aggregation.ts:Threshold.current` to `number | null` + null-guard `ratio` in
  `buildSnapshot`; audit `domain/insights.ts` for `Threshold.current` arithmetic.
- Rule/param lookup stays **before** the base lookup in `computeThresholds`, so the existing
  "no rule → skip" behaviour (and the `income has no fiscal rule spec` test) is preserved while a
  **missing base** becomes the loud case.

---

## 17. IMPLEMENTATION STATE (written at ~115k/128k context — this is the recovery record)

**All code changes are DONE in the working tree (uncommitted).** Validation at this point:
`npx tsc --noEmit` → **0** · `npm run test` → **41 files / 587 tests passing** (baseline 578 → **+9**) ·
`npm run test:e2e` → **32 passed, 1 FAILED** (my own new test — cause diagnosed, fix known, see 17d).

### 17a. Files changed (9 modified + this untracked notes file)

1. **`src/domain/thresholds.ts`** — the core change.
   - `FiscalBase` replaced: `'gross-revenue'|'gross-expenses'|'net-income'` →
     **`'revenue-incl-vat' | 'revenue-excl-vat' | 'expense-incl-vat' | 'expense-excl-vat' | 'net-income'`**,
     each documented with the article defining it. Doc states `net-income` is supplied ONLY by the tax
     engine and that `YtdTotals.net` is NOT it.
   - New `export type ThresholdStatus = 'ok'|'warning'|'breached'|'review_required'`.
   - New `export interface ThresholdBases` — optional keys for all five bases.
   - `FiscalThreshold`: `currentValue: number | null`; `status: ThresholdStatus`; new optional
     `reviewReason?: string`; `warningDistance` documented as "presentation band… NOT a statutory
     figure… must not acquire one".
   - `ThresholdQuery`: `currentValue`+`fiscalBase` **replaced by `bases: ThresholdBases`** — this IS the
     solution to "one call cannot serve two bases": one call now serves all four specs.
   - `ThresholdSpec` now **exported**; `THRESHOLD_SPECS` now **`export const … : readonly`**; each spec
     gained **`baseSourceArticle`** (the provision defining the BASE, not just the value).
   - Spec bases: `CAS_MIN_BASE`→`net-income` (CF art. 148 alin. (1)-(2) lit. a));
     `CASS_MIN_BASE`→`net-income` (art. 174 alin. (6) cor. art. 170 alin. (1));
     `CASS_MAX_BASE`→`net-income` (art. 170 alin. (1), 72 SM); `VAT_REGISTRATION`→**`revenue-excl-vat`**
     (art. 310 alin. (1)) with the **alin. (2) caveat written into the code comment verbatim**.
   - `statusFor` returns `Exclude<ThresholdStatus,'review_required'>`.
   - **`computeThresholds` loop rewritten**: rule/param lookup FIRST (preserves the existing "no rule →
     skip" tests incl. `income has no fiscal rule spec`), then
     `const currentValue = query.bases[spec.requiredFiscalBase]`; if `undefined` → push a
     `review_required` row (`currentValue: null`, `distance: 0`, `reviewReason:
     'Baza „<base>” nu a fost furnizată; pragul nu poate fi evaluat.'`). **The `continue` on base
     mismatch is gone.** `fiscalBase: spec.requiredFiscalBase` (per-spec, not per-query).
2. **`src/domain/tax.ts`** — new `export interface TaxAmountBases { venitulBrut; cheltuieliDeductibile;
   venitulNetDinActivitate }`; `bases: TaxAmountBases` added to the **computed** variant of
   `TaxEstimateResult`; both computed return sites (`:222` loss branch, `:233` normal) pass
   `{ venitulBrut: gross, cheltuieliDeductibile: deductibleBase, venitulNetDinActivitate: net }`.
   **Behaviour unchanged** — the `:87-88` VAT selection is untouched.
3. **`src/data/dashboard.ts`** — imports `type ThresholdBases`; new **`export function
   buildThresholdBases(ytd, tax): ThresholdBases`** (the 4 turnover bases; adds `'net-income'` **only
   if** `tax.status === 'computed'`, from `tax.bases.venitulNetDinActivitate`); **`getThresholdStatuses
   (data, asOfDate, tax)`** third param added; `buildSnapshot` now **reuses
   `getThresholdStatuses(data, asOfDate, tax)`** instead of its own inline `computeThresholds` (the
   duplicate that let the two paths drift); snapshot mapping guards null:
   `ratio: t.thresholdValue === 0 || t.currentValue === null ? 0 : …`,
   `breached: t.currentValue !== null && t.distance > 0`; `buildDashboardData` passes `tax`.
4. **`src/domain/aggregation.ts`** — `YtdTotals` fully documented (one concept per field; `net` =
   "Cash profit — not a fiscal contribution base"; `revenueNet` = **cifră de afaceri**, art. 310 alin.
   (1)); `Threshold.current: number | null` + `ratio` documented. **No field renames.**
5. **`src/components/dashboard/ThresholdSection.tsx`** — `STATUS_BADGE['review_required'] =
   'badge-neutral'`, `STATUS_LABEL['review_required'] = 'De verificat'`; `progressPercent(currentValue:
   number | null, …)` returns 0 for null; `Curent:`/`Distanță:` render `'—'` when null; `t.reviewReason`
   replaces the `La depășire:` line when present.
6. **`src/domain/thresholds.test.ts`** — added `allBases(value)` helper; every query now
   `bases: allBases(N)`; `every threshold carries the query fiscalBase` → **`… the base its spec
   declares`**; **the two tests that pinned the silent skip as correct (`toHaveLength(0)`) were DELETED
   and replaced** by `unsupplied base → loud review_required row, never a dropped threshold`,
   `no base supplied at all → every spec is review_required, none dropped`, and
   `a spec is never silently dropped by a base mismatch (silent-skip guard)` (loops several base maps,
   asserts row count === `THRESHOLD_SPECS.length` and ids match); plus
   `every spec cites the provision that defines its BASE`.
7. **`src/data/dashboard.test.ts`** — imports `getThresholdStatuses`, `buildThresholdBases`, `seedData`,
   `selectYtd`, `THRESHOLD_SPECS`; new describe **`thresholds bases (Phase 8 — amount semantics, on
   seeded data)`** (AS_OF `'2026-12-31'`) with 6 tests: VAT on `revenue-excl-vat` = **7700** and
   `!== ytd.revenue` (9317); the 3 contribution rows on `net-income` = **7494.5**, `!== ytd.revenue`
   and `!== ytd.net`; contribution base === engine value; **production caller supplies a base for every
   spec** (guards the silent-skip trap in the app); engine-declined → 3 rows `review_required` but still
   4 rows and VAT still 7700; **acceptance 6** pins `tax.bases` = {7700, 205.5, 7494.5}, taxable ≈
   **6745.05**, total ≈ **3104.505** at 6 dp.
8. **`src/components/dashboard/ThresholdSection.test.tsx`** — fixture `fiscalBase` `'gross-revenue'` →
   `'net-income'`; new test `renders an unmeasured threshold as review_required, not as a fake 0`.
9. **`src/domain/insights.test.ts`** + **`src/domain/taxReserve.test.ts`** — minimal `computed` fixtures
   given `bases: { venitulBrut: total, cheltuieliDeductibile: 0, venitulNetDinActivitate: total }`.
10. **`e2e/dashboard.spec.ts`** — Praguri test: `Curent: 9.317,00 lei` ×4 replaced by
    `Curent: 7.494,50 lei` ×3 + `Curent: 7.700,00 lei` ×1 + `Curent: 9.317,00 lei` ×0 (`.item-row`
    count still **4**, `Depășit` still 2, `În limite` still 2). New test added in the B-14 describe.

### 17b. Acceptance criterion 6 — proven by real before/after measurement

Temp probe `src/data/__p8_probe.test.ts` (since **deleted**) run on my code and on
`git stash push -- src/`:
- BEFORE: `venitBrut 7700, cheltuieli 205.5, venitNetActivitate 7494.5, taxable 6745.05, total 3104.505, bases null`
- AFTER:  the same five figures, plus `bases {7700, 205.5, 7494.5}`
→ **byte-identical**; the only change is that the bases are now typed. Seed `ytd` =
`{revenue 9317, expenses 248.66, net 9068.34, revenueNet 7700, expenseNet 205.5}`.

### 17c. Seeded figures (verified by running, not assumed)

VAT-incl revenue **9317** · VAT-excl **7700** · VAT-incl expenses **248.66** · VAT-excl **205.5** ·
`YtdTotals.net` **9068.34** (NOT the VNA) · fiscal VNA **7494.50** · taxable **6745.05** · total
**3104.505**. Post-change statuses on seed: CAS_MIN breached, CASS_MIN breached, CASS_MAX ok, VAT ok →
still 2 `Depășit` + 2 `În limite`.

### 17d. THE ONE FAILING TEST — cause known, fix is mechanical

`e2e/dashboard.spec.ts:673` `when the engine refuses, the contribution thresholds turn
review_required instead of vanishing` fails at `getByText('De verificat', { exact: true })`
(the earlier `.item-row` count 4 assertion **passed**).
**Cause: the B-14 describe block has NO `beforeEach`.** The `addInitScript` that sets
`regime: 'impozit_pe_cit'` lives **inside the first test only**, so my new test loads the **default
seed** (regime `impozit_pe_venit`) → the engine computes → all four rows are measured → no
`De verificat` badge. **FIX: copy the first B-14 test's**
`page.addInitScript(([key, dataset]) => localStorage.setItem(key, JSON.stringify({ ...dataset,
profile: { ...dataset.profile, regime: 'impozit_pe_cit' } })), [STORAGE_KEY, computedDataset()])`
**into my new test before `page.goto('/dashboard')`.** Expected then: 4 `.item-row`, 3 `De verificat`,
3 `/nu a fost furnizată/`, 1 `Curent: 130.000,00 lei` (computedDataset VAT-excl = 50 000 + 80 000,
expenses `[]`), `Prag: 395.000,00 lei` visible. That takes e2e to **33** (> 32 ✔).

### 17e. REMAINING WORK (in this order) — **ALL DONE, see §18**

1. Fix the e2e test per 17d → `npm run test:e2e` → expect **33 passed**.
2. Re-run `npx tsc --noEmit`, `npm run build`, `npm run test` for final numbers.
3. **Write `docs/ai/phases/08_amount_semantics.md`**: every base decision + its article; the **art. 310
   alin. (2) caveat** and the **U-7 / Q-OMFP3254-HISTORY caveat** carried forward as written; the
   `getThresholdStatuses` design decision (D-1 base map + third param, and why not the alternatives);
   that `YtdTotals.net` is NOT the VNA (F-1); what is left for Phase 9/10; the **24 SM tier-floor
   surface NOT taken** (needs a new `ThresholdType` + UI cases and a citation I do not have); and one
   line on any archived step file I contradict.
4. **Update `docs/ai/STATE.md`** honestly — close the amount-semantics defects and **record the
   follow-up found but not fixed** (17f).
5. Report using the mandatory handoff format (§9).

### 17f. Follow-ups to record (found, deliberately NOT fixed — out of Phase 8 scope)

- **`buildSnapshot`'s `breached: t.distance > 0` is wrong for `min-base` rows.** A min-base threshold
  breaches when the base is **below** the floor, but the snapshot ratio-rule shape flags breached only
  when `distance > 0`. On the seed the three contribution rows are `breached` in
  `FiscalThreshold.status` yet `breached: false` in `snapshot.thresholds`, so the **insights engine
  never emits a threshold alert for them**. Pre-existing, not introduced by me; fixing it changes the
  `Observații` count and breaks `e2e/dashboard.spec.ts:265` (12 insights). **Record for the next phase;
  do not silently change.**
- **B-17 rounding** → Phase 10. My basis change makes the half-cent more visible: seeded total is
  **3104.505 lei**, rendered `3.104,51` and `1.034,84`/month. I centralised no rounding.
- **Date semantics** → Phase 9. Untouched.
- `settings.cotaTva` still read nowhere; `playwright.config.ts:9` is LSP-only; the seed's 21% VAT is
  correct — none of these were "fixed".
- `warningDistance = thresholdValue * 0.1` remains an uncited UI band (now documented as such).

---

## 18. PHASE 8 COMPLETE (final state)

17e items 1–5 are all done. Final measured validation (re-run after every edit, docs included):
`npx tsc --noEmit` → **0** · `npm run build` → **exit 0** · `npm run test` → **41 files / 587 tests**
(baseline 578, **+9**) · `npm run test:e2e` → **33 passed** (baseline 32, **+1**) ·
`grep -rn "gross-revenue|gross-expenses" src e2e` → **no matches** (the old vocabulary is fully gone).

- The e2e fix in 17d worked exactly as diagnosed: 4 `.item-row`, 3 `De verificat`, 3 reasons, VAT row
  still measured.
- `docs/ai/phases/08_amount_semantics.md` written (§1–10: defect, base table + `baseSourceArticle`, the
  D-1 decision and the two rejected alternatives, the silent-skip closure, the typed vocabulary, the
  art. 310 alin. (2) + U-7 + U-1 caveats carried as written, the before/after table, what was not taken,
  the B-20 handoff, and the archived-prompt contradiction).
- `docs/ai/STATE.md` updated: verification counts + header, Phase 8 status row, **new defect B-20**
  (the `breached: distance > 0` bug for `min-base` rows — pre-existing, recorded not hidden), B-17's
  Phase 8 half closed, U-1/U-7 no longer listed as blocking Phase 8, the stale "29 e2e specs" archive
  correction, and a documentation-status entry for the new phase doc.
- `docs/ai/PLAN.md` updated: Phase 8 outcome record in the same style as Phase 3–7 (numbers, bases,
  trap closed, not-taken-up list, B-20) and "Phase 9 is next".

Nothing was committed — the working tree is left for the orchestrator. Files: 13 modified
(540 insertions / 106 deletions) + 2 new docs + this notes file.

## 11. My decisions (fill in as made) — SUPERSEDED by §14

- D-1 `getThresholdStatuses` and the tax estimate: PENDING
- D-2 `FiscalBase` union shape: PENDING
- D-3 amount vocabulary types: PENDING
- D-4 what stays `REVIEW_REQUIRED`: PENDING

---

## 12. scout-taxengine — DONE (condensed, faithful)

**Files:** `src/domain/tax.ts` (234 L, `computeTaxEstimate` **52-234**) ·
`src/domain/fiscal/calculators.ts` (358 L: `CalculatorInput` 23-105, `calcCas` 112-184, `calcCass` 187-298,
`calcIncomeTax` 300-325, registry 351-358) · `src/domain/fiscal/package2026.ts` (262 L: `PROVENANCE_2026`
3-11, CAS_2026 80-113, CASS_2026 115-164, INCOME_TAX_2026 166-215, VAT_THRESHOLD_2026 217-241) ·
`src/domain/fiscal/rules.ts:19-37` (`FiscalRule`, 17 fields) · `src/domain/tax.test.ts` ·
`src/domain/derived.ts:93-146` (`TaxInputsReference`).

**★ KEY FINDING — the real contribution base already exists and is already named `net`:**
```ts
52 export async function computeTaxEstimate(input: TaxCalculationInput): Promise<TaxEstimateResult>
53   const { inputs, profile, revenues, expenses, revenuesNet, expensesNet, ruleRelease, rules } = input;
60   const asOf = `${inputs.fiscalYear}-01-01`;
61   const applicable = selectApplicableRules(rules, { taxYear: inputs.fiscalYear, asOfDate: asOf });
62-64 casRule/cassRule/incomeTaxRule = applicable.find(r => r.taxRegime === 'cas'|'cass'|'income-tax')
65-67 three `if (!rule) return rr(...)` guards
79   const regimeRefusal = regimeRefusalReason(inputs.regime); if (regimeRefusal) return rr(...)
87   const gross = inputs.vatExempt ? revenues : revenuesNet;          // ← VAT SELECTION, do not change
88   const deductibleBase = inputs.vatExempt ? expenses : expensesNet;
89   lines.push({ label: 'Venit brut', value: gross });
97   lines.push({ label: 'Cheltuieli deductibile', value: deductibleBase });
98   const net = gross - deductibleBase;
99   lines.push({ label: 'Venit net din activitate', value: net });
107-109 if (profile.pfaStartDate && !profile.pfaStartDate.endsWith('-01-01'))
           lines.push({ label: 'Fracțiune de an (art. 118 alin. (3)): venit anual', value: net });
119-122 casRes = registry['calc-cas'](casRule, { base: net, pensionStatus: inputs.pensionStatus })
123   if ('reviewRequired' in casRes) return rr(casRes.reason, lines)
124   lines.push({ label: 'CAS (25%)', value: casRes.value })
146   if (inputs.socialInsuranceStatus === 'obligatoriu') {
147-152   cassRes = registry['calc-cass'](cassRule, { base: net, pensionStatus, salaryStatus,
            salaryIncomeLei: inputs.salaryIncomeLei ?? undefined })
154     cassValue = cassRes.value; cassNonDeductibila = cassRes.nonDeductible ?? 0
157     lines.push({ label: 'CASS (10%)', value: cassValue })
159   } else lines.push({ label: `CASS (${inputs.socialInsuranceStatus})`, value: 0 })
165   const pierderiReportate = 0
166   const vnaRecalculat = net - pierderiReportate
176   const vnaSistemReal = Math.max(net, 0)
177-180 totalCumulatCas/Cass = vnaSistemReal; ratioCas = ratioCass = 1 (single source)
181   casDeductibila = ratioCas * casRes.value
187   cassDeductibila = Math.max(0, ratioCass * (cassValue - cassNonDeductibila))
194-199 deduceriCalculat; plafonDeduceri = Math.max(0, vnaRecalculat); deduceriRetinute = min(...);
        if capped → lines.push({ label: 'Deduceri blocate de plafonul art. 118 alin. (2^4)', ... })
201   const taxable = vnaRecalculat - deduceriRetinute
202   lines.push({ label: 'Venit net anual impozabil (art. 118 alin. (2) lit. b))', value: taxable })
204-225 if (taxable <= 0) → 'Impozit pe venit (fără bază impozabilă)' 0; total = cas + cass; return
227-231 incomeTaxRes = registry['calc-income-tax'](incomeTaxRule, { base: taxable });
        'Impozit pe venit (rată de bază 10%)'; total = cas + cass + incomeTax;
        lines.push({ label: 'Total taxe', value: total })
232-233 createCalculationSnapshot({ profile, revenues: gross, expenses: deductibleBase, ruleRelease,
        calculationLines: lines, output: { total } })
```
**`net` (tax.ts:98, label `'Venit net din activitate'`) is passed as `base` to BOTH `calcCas` (:120) and
`calcCass` (:148). That IS the contribution base Phases 3–5 use — reuse it, do not invent one.**
`computeTaxEstimate` is **`async`** → `Promise<TaxEstimateResult>`.

**How calculators consume it:**
- `calcCas`: `const realized = input?.base ?? 0` (:118) — only **selects the floor**.
  `:143 inTier2 = realized >= tier2Base; :144 floor = inTier2 ? tier2Base : tier1Base;
  :146 chosen = input?.chosenBase; :147 base = chosen === undefined ? floor : Math.max(chosen, floor);
  :148 cas = base * rate`. `pensionStatus==='da'` → 0 (:120-130); `realized < tier1Base` → 0 (:132-141).
- `calcCass`: `const vna = input?.base ?? 0` (:191) — it **IS** the base. `:192 floorCass = floorBase*rate`
  (2,430 lei) and `:193 ceilingCass = maxBase*rate` (29,160 lei) are **derived**. `:195 if (vna <= 0)
  return { value: 0 }` (art. 174 alin. (2)); `:210 if (vna < floorBase)` → pension 211-224 / salary
  229-249 / else `:257 due = vna*rate; difference = floorCass - due; return { value: floorCass,
  nonDeductible: difference }`; `:279 base = Math.min(vna, maxBase); :280 cass = base*rate`.
  **Never reads `chosenBase`.**
- `CalculatorInput` (:23-105): `{ base?: number; pensionStatus?: 'da'|'nu'; salaryStatus?: 'da'|'nu';
  salaryIncomeLei?: number; chosenBase?: number }`. `CalculatorResult` (:5-21):
  `{ value; breakdown: string[]; nonDeductible? } | { reviewRequired: true; reason: string }`.
- **`chosenBase` is NOT a profile field** — only `calculators.ts:74` (type), `:145` (read in `calcCas`),
  `fiscal.test.ts:137,145`. Absent from `models.ts`, `profile.ts`, `derived.ts`, `schema.ts`, `seed.ts`.
  JSDoc `:69-73` "Wired to no persisted field and no UI input". `computeTaxEstimate` never passes it.

**Rule params (exact ids/values):**
- `CAS_2026`: `rate` 25 · **`min_base` 48600** ("Tier-1 floor (12 SM annual)") · `tier2_base` 97200 ("not a
  ceiling") · `tier1_cas` 12150 · `tier2_cas` 24300. `effectiveFrom '2026-01-01'`. `sourceAct: 'Cod fiscal —
  OUG nr. 128/2024, Art. I pct. 20 (MO 1125/11.11.2024)'`; `sourceArticle: 'art. 148 alin. (1)-(2) lit. a);
  exceptie art. 150 alin. (1); SM anchor art. 135^1 alin. (3)'`.
- `CASS_2026`: `rate` 10 · **`min_base` 24300** ("Top-up floor (6 SM annual) — CF art. 174 alin. (6);
  conditional, not an unconditional minimum") · **`max_annual_base` 291600** ("Max annual base (72 SM)").
  `sourceArticle: 'art. 170 alin. (1) (cotă 10%, plafon 72 SM); art. 174 alin. (6) (prag de 6 SM prin
diferență de contribuție); art. 174 alin. (2) (VNA zero / pierdere fiscală); excepție art. 174 alin. (7)
lit. c); ancoră SM art. 135^1 alin. (3)'`. (`min_cass`/`max_cass` removed Phase 4.)
- `INCOME_TAX_2026`: `base_rate` 10 only; `verifiedAt: '2026-10-06'`.
- `VAT_THRESHOLD_2026`: **`threshold` 395000**, `effectiveFrom '2025-09-01'`, `sourceAct: 'Cod fiscal —
  Ordonanța nr. 22/2025 (MO 806/29.08.2025)'`, `sourceArticle: 'art. 310 alin. (1)'`.
- `FiscalRule` 17 fields: `ruleId, name, jurisdiction, entityType, taxRegime, taxYear, effectiveFrom,
  effectiveTo, parameters, calculatorId, sourceAct, sourceArticle, sourceUrl, verifiedAt, status, version,
  supersededBy?`. `FiscalRegime = 'cass'|'cas'|'income-tax'|'vat'|'deadlines'|'wage-reference'`.
  `FiscalParameter = { id, label, value: number|string, unit: 'lei'|'percent'|'date'|'count', description? }`.

**★ "BEFORE" anchors for acceptance criterion 6:** `tax.test.ts:351-366` — revenues 71 281 / expenses 0 →
`taxable = 71281 - 12150 - 7128.1 = 52002.9`, income `5200.29`, total `24478.39` (3 dp). Plus
`tax.test.ts:451-463` — same input, asserts line `'Venit net anual impozabil (art. 118 alin. (2) lit. b))'
≈ 52_002.9` at **6 dp**, CAS deductibilă ≈ 12_150, CASS deductibilă ≈ 7_128.1, no cap line, total
≈ 24_478.39. Other pinned totals: 50000/10000 → **7 600** (`:26`); CASS-exempt → **4 000** (`:36`);
60000/10000 → **20 435** (`:117`); 250000/0 → **69 370** (`:125`); 300000/0 → **78 114** (`:133`);
71281/0 → **24 478.2** (`:151`); 72000/0 → **24 615** (`:186`); B-13 → taxable 18 000 / total 4 230 (`:441`);
cap → total 53 600 (`:479`); pensioner → 1 900 (`:231`); CAS-exempt → 38 000 (`:296`); snapshot
`revenues 50_000 / expenses 10_000 / output.total 7_600` (`:100`).

**Architecture:** `derived.ts` builds `TaxInputsReference` from profile (`vatExempt:99`,
`salaryIncomeLei:95`, regime, socialInsuranceStatus, fiscalYear) → `tax.ts` selects rules via
`fiscal/select.ts:selectApplicableRules` over `package2026.ts:PFA_2026_SYSTEM_REAL_PACKAGE` (gated by
`regimes.ts:regimeRefusalReason`) → `calculatorRegistry[rule.calculatorId]` → composes art. 118 base →
`snapshots/snapshot.ts:createCalculationSnapshot`. Numbers only via `paramNumber(rule, id)`
(`calculators.ts:84-91`, throws if missing).

## 13. scout-ui-tests — DONE (condensed, faithful)

**Threshold UI:** `src/components/dashboard/ThresholdSection.tsx` (113 L) is the **only** renderer, called
from `src/pages/Dashboard.tsx:124` (`<ThresholdSection thresholds={data.thresholds} />`, import `:10`).
- `STATUS_BADGE` (:18-22) ok→`badge-success`, warning→`badge-warning`, breached→`badge-danger`.
- `STATUS_LABEL` (:24-28) ok→`În limite`, warning→`Atenție`, breached→`Depășit`.
- `DOMAIN_LABEL` (:30-32) `'pfa-revenue'`→`Venit PFA`.
- module-private `labelFor(t)` (:37-45): min-base→`Prag minim ${TAX}`, max-base→`Prag maxim ${TAX}`,
  registration→`Prag de înregistrare ${TAX}` (→ "… Vat"), income→`Prag de venit ${TAX}`.
- `progressPercent` (:46-52) clamps 0..100.
- Card (:66-112): `<CardTitle>Praguri</CardTitle>`, `<CardDescription>Praguri fiscale față de valorile
curente</CardDescription>`; empty state `<p className="hint">Niciun prag</p>`; per row `.item-row` with
`labelFor`, domain hint, status badge; then `.kv-row` with `Curent: {formatLei(t.currentValue)}` /
`Prag: {formatLei(t.thresholdValue)}` / `Distanță: {formatLei(t.distance)}`; then
`La depășire: {t.breachMeaning}`; then `.bar-track`/`.bar-fill {status}`; then `{t.source}`.
- **`warningDistance` is NOT displayed** — only `distance`. It exists on the model and drives `statusFor`
  only. (Confirms trap 3: it must never acquire a citation.)

**★ `e2e/dashboard.spec.ts:165-195` (verbatim, the four-card test):**
```ts
test('Praguri: renders all 4 thresholds with current value, threshold and status', async ({ page }) => {
  await page.goto('/dashboard');
  const thresholds = sectionWith(page, 'Praguri');
  await expect(thresholds.locator('.item-row')).toHaveCount(4);
  await expect(thresholds.getByText('Prag minim CAS', { exact: true })).toBeVisible();
  await expect(thresholds.getByText('Prag: 48.600,00 lei')).toBeVisible();
  await expect(thresholds.getByText('Prag maxim CAS', { exact: true })).toHaveCount(0);
  await expect(thresholds.getByText('Prag minim CASS', { exact: true })).toBeVisible();
  await expect(thresholds.getByText('Prag maxim CASS', { exact: true })).toBeVisible();
  await expect(thresholds.getByText('Prag: 24.300,00 lei')).toBeVisible();
  await expect(thresholds.getByText('Prag: 291.600,00 lei')).toBeVisible();
  await expect(thresholds.getByText('Prag de înregistrare Vat')).toBeVisible();
  await expect(thresholds.getByText('Prag: 395.000,00 lei')).toBeVisible();
  await expect(thresholds.getByText(/Curent: 9\.317,00 lei/)).toHaveCount(4);
  await expect(thresholds.getByText('Depășit', { exact: true })).toHaveCount(2);
  await expect(thresholds.getByText('În limite', { exact: true })).toHaveCount(2);
});
```
`sectionWith` = `page.locator('section.card').filter({ has: page.locator('h3', { hasText: title }) })`
(`:143-144`). **The `Curent: 9.317,00 lei` ×4 line MUST change when bases change** — keep `.item-row`
count 4.

**All 24 dashboard.spec.ts tests:** cockpit cards labels+seed values (58); all sections Romanian titles
(98); Rezervă fiscală recommended reserve (149); **Praguri 4 thresholds (165)**; Termene limită 6 deadlines
(197); Completitudine date 9 checks/8 satisfied (216); Ce trebuie să faci 8 actions (244); Legislație empty
state (258); Observații 12 insights (265); mobile 390x844 no overflow (293); normalizes / → /dashboard
(309); /revenues via sidebar (316); /revenues direct URL (324); onboarding CTA empty state (332); Grafic
financiar 12 rows "An" (448); KPI table 12 rows (464); "Lunar" default empty + month select (486); "YTD"
full FY2025 (502); "Lunar" default pressed / "An" ends Dec 2025 (519); mobile seeded FY2025 no overflow
(534); tax hero computed 46.570 lei (618); Rezervă fiscală computed estimate (626); cockpit tax cell
computed (634); refuses to compute impozit_pe_cit on PFA (643).
**8 settings.spec.ts tests:** regime offer+round-trip (117); refuses salary without amount (158); revenues
and expenses survive reload (175); salary ≥ 6 SM → no difference, CASS 10% × net (216); salary < 6 SM →
alin. (6) difference owed, not deductible (226); personal name → topbar+greeting after reload (255); sidebar
company name from store (273); corrupt payload quarantined + recovery banner (297).

**★ SEED FIGURES (`src/data/seed.ts:37-49`) — hand-computable, `inregistrata` rows only:**
- revenues r1 4500/945 (`inregistrata`), r2 1200/252 (`in-asteptare`), r3 800/168 (`respinsa`),
  r4 3200/672 (`inregistrata`)
- expenses e1 120/25.2 (`inregistrata`), e2 85.5/17.96 (`inregistrata`), e3 340/71.4 (`respinsa`)
- **gross (VAT-incl) revenue = (4500+945)+(3200+672) = 9 317**
- **VAT-exclusive revenue = 4500+3200 = 7 700**
- gross expenses = 120+25.2+85.5+17.96 = **248.66**; **net expenses = 120+85.5 = 205.5**
- **net income = 7700 − 205.5 = 7 494.50**
- profile: `fiscalYear: 2026`, `regime:'impozit_pe_venit'`, `salaryStatus:'nu'`, `pensionStatus:'nu'`,
  `socialInsuranceStatus:'obligatoriu'`, **`vatExempt:false`**, `cashFloorLei:0`, `pfaStartYear:2020`
- settings: `cotaTva: 9` (unread), plus frozen `company`/`personal` blocks, `bankAccounts`, `eFactura`.

**Post-change predictions for the seeded dashboard (verify, don't assume):** CAS_MIN_BASE current 7 494,50
vs 48 600 → breached; CASS_MIN_BASE 7 494,50 vs 24 300 → breached; CASS_MAX_BASE 7 494,50 vs 291 600 → ok;
VAT_REGISTRATION 7 700,00 vs 395 000 → ok. Still **2 Depășit + 2 În limite**, 4 cards.

**Other tests touching thresholds / ytd.revenue / revenueNet:**
- `src/components/dashboard/ThresholdSection.test.tsx` (4 tests, 75 L) — builds fake `FiscalThreshold`
  objects; expects `Prag minim CAS`, `Curent:`/`Prag:`/`Distanță:`, `12.000,00 lei`, `6.000,00 lei`,
  `1.000,00 lei`, `Niciun prag`, `În limite` badge (never raw `ok`), `Prag maxim CAS` + `Depășit` +
  `La depășire: părăsirea regimului PFA`.
- `src/domain/aggregation.test.ts:95-238` — `selectYtd`: `revenue 119 / expenses 59.5 / net 59.5`;
  `1190 / 474.4 / 715.6`; **net-vs-gross case `revenue 110, revenueNet 100, expenses 55, expenseNet 50,
  net 55`**; `595`; zeros `{revenue:0,expenses:0,net:0,revenueNet:0,expenseNet:0}`; tva=0 →
  `revenue 100, revenueNet 100`.
- `src/domain/derived.test.ts:111,126,192,205,218,252,262` — `ytd.revenue` 1190 / +952 delta / zeros / 119.
- `src/data/dashboard.test.ts:124,131,138` — `ytd.revenue` 0 / 1190 / 1190; `:212` `snapshot.pfaRevenue`
  1190; **`:214` only `Array.isArray(dashboard.thresholds)`** — weak, worth strengthening.
- `src/components/FinancialSummary.test.tsx:7-25` — `{revenue:156000,expenses:54000,net:102000,
  revenueNet:156000,expenseNet:54000}`, zeros, `{40000,60000,-20000,...}`.
- `src/domain/fiscal/fiscal.test.ts:339` — VAT threshold `toMatchObject({ value: 395000 })`.
- `src/domain/fiscal/rules.test.ts:74-76` — `VAT_THRESHOLD_2026` in applicable ids for 2026.
- **No test puts VAT_REGISTRATION near 395000 on seeded data** — only synthetic `computeThresholds` inputs
  (355500/355499/400000) in `thresholds.test.ts:151-233`. Acceptance criterion 2's "differs from the
  VAT-inclusive one on seeded data" therefore needs a NEW test.

**`package.json` scripts:** `dev: vite` · `build: tsc && vite build` · `preview: vite preview` ·
`typecheck: tsc --noEmit` · `test: vitest run` · `test:watch: vitest` · `test:e2e: playwright test`.

**Start-here:** `ThresholdSection.tsx` (whole, 113 L) + `e2e/dashboard.spec.ts:165-195` pin every
user-visible string/number; `thresholds.ts:120-183` for status math; `seed.ts:37-49` for the 9317 figure.
