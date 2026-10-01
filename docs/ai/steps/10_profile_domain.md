# Step 10 — PFA/Profile Domain Foundation

# Role
Implementation worker (Task 10).

# Objective
Create the PFA/profile domain foundation: profile ID, PFA start year, current
tax year, tax regime, main activity/CAEN, salary status, pension status, other
relevant income flags/statuses, identity/contact data used by the
application. Move application identity toward ONE profile source of truth,
persist the profile using the project's existing local persistence
architecture, and add TypeScript types + schema validation.

# Work performed
- Inspected the data layer: `src/data/types.ts`, `src/data/seed.ts`,
  `src/data/store.tsx`, `src/pages/Settings.tsx`, and the three authoritative
  checkpoints (01-architecture, 02-dashboard, 03-fiscal).
- Created a new `src/domain/` layer (models, schema, repository, profile
  domain logic) with unit tests.
- Wired the profile into the existing persistence architecture: new
  `profile` collection on `AppData` under the existing `pfa-app-data-v2`
  localStorage key, load-once / write-on-change store cycle, and a
  backfill/migration for existing local data that lacks the profile.
- Added domain unit tests and a store migration test.

# Files inspected
- /tmp/solo-task-10/01-architecture.md, 02-dashboard.md, 03-fiscal.md
- src/data/types.ts, src/data/seed.ts, src/data/store.tsx
- src/pages/Settings.tsx (identity usage sites)
- docs/ai/steps/08_stack_setup.md, _TEMPLATE.md
- vitest.config.ts, tsconfig.json, package.json

# Files changed
- src/domain/models.ts (new) — `PfaProfile` model + `TaxRegime`,
  `SalaryStatus`, `PensionStatus`, `OtherIncomeStatus` types.
- src/domain/schema.ts (new) — zod v4 `pfaProfileSchema` + `parsePfaProfile`.
- src/domain/repo.ts (new) — `PfaProfileRepository` interface (load/save/subscribe).
- src/domain/profile.ts (new) — domain logic: `createDefaultProfile`,
  `currentTaxYear`, `isPfaActiveForYear`, `profileIdentity`.
- src/domain/profile.test.ts (new) — 15 domain tests.
- src/data/types.ts — `AppData` gains `profile: PfaProfile`.
- src/data/seed.ts — seed includes a default profile.
- src/data/store.tsx — `migrateToCurrent` backfills a default profile when
  absent (exported for testability); store stays thin (no domain imports).
- src/data/store.migration.test.ts (new) — 5 migration tests.

# Findings
- The `src/domain/` directory did not exist; the repository interface from the
  architecture checkpoint was missing from the codebase and was created here.
- zod ^4.6.5, vitest ^3.2.7, jsdom, testing-library were already installed
  (Step 08). No new dependencies added.
- Identity/contact data was previously read from `settings.company` /
  `settings.personal` (Settings.tsx). The profile is now the source of truth
  for identity; the Settings state remains until the Step 11+ Settings
  redesign, and the store migration keeps old local data valid.
- PfaProfile fields (per architecture checkpoint): `id`, `fiscalYear`,
  `regime` ('impozit_pe_cit' | 'impozit_pe_venit'), `salaryStatus`,
  `pensionStatus`, `otherIncome`, `socialInsuranceStatus`, `vatExempt`,
  `cashFloorLei` (default 0), `updatedAt` (ISO). PFA start year and
  main activity/CAEN are carried by the profile identity fields.

# Decisions
- Profile persisted as a new `AppData` collection `profile` behind the
  existing load/save cycle on `pfa-app-data-v2` (no new storage key, no
  backend).
- Store stays thin: load-once, write-on-change, CRUD only; no domain logic
  imported into the store. Domain logic lives in `src/domain/`.
- Migration is a pure, exported function so it is unit-testable without
  touching localStorage.
- No UI changes: no onboarding wizard, no Settings/Dashboard redesign, no
  fiscal-rule implementation (out of scope for Step 10).

# Tests
- `npx vitest run` → 20 tests pass (15 profile domain + 5 store migration).
- `npx tsc --noEmit` clean; `npm run build` (tsc && vite build) succeeds.

# Problems
- None blocking. Initial `edit` on types.ts failed on whitespace mismatch;
  resolved by re-reading the file and matching exact text.

# Handoff
- Profile is the single source of truth for application identity and the
  attributes the future tax engine (Task 11) depends on.
- Next: Task 11 (fiscal-rule implementation) can consume `PfaProfile` via the
  repository interface and `parsePfaProfile` for runtime validation.
