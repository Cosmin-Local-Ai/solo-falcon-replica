# Step 08 — Development Dependencies (Test & Tooling Stack)

# Role
Install worker (Task 8).

# Objective
Add test tooling (unit + E2E) to solo-falcon-replica without upgrading the
existing stack and without creating application tests.

# Work performed
- Inspected baseline package.json, package-lock.json, Node/npm environment.
- Resolved Vitest-vs-Vite compatibility from npm peer-dependency metadata.
- Installed runtime and dev dependencies; added vitest/playwright configs.
- Removed stray test files left by a prior worker (src/App.test.tsx,
  src/data/types.test.ts, e2e/smoke.spec.ts) and reverted .gitignore.

# Files inspected
- package.json, package-lock.json, /usr/bin, ~/.cache/ms-playwright.

# Files changed
- package.json, package-lock.json
- vitest.config.ts (new), playwright.config.ts (new), src/test/setup.ts (new)

# Findings
Baseline: React 18.3.1, Vite 5.4.21, TypeScript 5.9.3, Node v24.21.0,
npm 11.19.0. No test/chart libs present. A usable Playwright Chromium
(chromium-1243) already exists in ~/.cache/ms-playwright — no browser
download needed.

Installed dependencies (exact installed versions):
- Runtime: recharts ^3.10.1 (dashboard graph), zod ^4.6.5 (runtime
  validation), decimal.js-light ^2.5.1 (exact decimal arithmetic).
- Dev: vitest ^3.2.7 (unit/integration), jsdom ^30.1.1 (DOM env for vitest),
  @testing-library/react ^16.3.3 (React component tests),
  @testing-library/jest-dom ^7.0.1 (DOM matchers),
  @testing-library/user-event ^14.6.7 (user interaction simulation),
  @testing-library/dom ^10.4.2 (core DOM queries; peer of testing-library/react),
  @playwright/test ^1.63.0 (E2E/responsive, reuses existing Chromium).

# Decisions
- No Vite/React/TS upgrade: vitest 3.2.7 peer-depends on Vite ^5.0.0, so the
  Vite 5.4.21 baseline is kept as-is (current Vitest majors require Vite >=6.4).
- Playwright config points at the existing chromium-1243 binary — no browser
  install.
- Deliberately NOT added: Redux, Zustand, TanStack Query, backend frameworks,
  AI SDK, rule-expression engines, large UI component frameworks, extra chart
  libraries.

# Tests
Scripts added: `test`, `test:watch`, `test:e2e`. No application tests created
yet (per task rules).

# Problems
- npm .bin shims were dropped by the overlay filesystem and had to be
  regenerated after install.

# Handoff
- Verification: `npm run build` passes (tsc && vite build, 44 modules);
  `npx vitest --version` → 3.2.7; `npx playwright test` starts and reports
  "No tests found".
- Next: write application unit tests (vitest + testing-library) and an E2E
  smoke test (Playwright).
