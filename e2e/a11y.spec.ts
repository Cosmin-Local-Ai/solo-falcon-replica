import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fixedInstant } from '../src/test/fixedInstant';
import { SYNTHETIC_CNP_A, SYNTHETIC_SHEET } from '../src/test/occupancyFixtures';
import { seedBrowser, seedPayload } from './fixtures';

/**
 * PG-0 — axe-core on `/dashboard`, failing on `serious` and `critical` only.
 *
 * WHY THIS FILE IS IN `e2e/`
 * It reuses the existing `webServer`, `baseURL` and browser install rather than
 * duplicating server logic in a standalone runner. It runs as part of
 * `npm run test:e2e` — so a Worker breaks accessibility locally and sees it
 * immediately — AND as its own CI step, so the failure reads as an a11y failure
 * rather than being lost in the functional count.
 *
 * WHY ONLY serious + critical
 * Landmine 3 of brief 30: minor and moderate findings are noise at this stage and
 * would stall every later Worker. They are still printed, so they are not hidden —
 * they just do not fail the gate.
 *
 * SCOPE: `/dashboard` only, for PG-0. The other routes (`/revenues`, `/expenses`,
 * `/declarations`, `/documents`, `/settings`, `/e-factura`) are recorded as a
 * follow-up in `docs/ai/phases/27_pg0_groundwork.md`, not widened here.
 *
 * The clock is pinned to the same instant the functional specs pin, because the
 * dashboard's content — and therefore its DOM — is date-dependent.
 *
 * IMPORT DIRECTION: this spec may import `src/test/fixedInstant.ts` and must NEVER
 * import `src/test/clock.ts` (that one pulls in vitest, which has no place in the
 * Playwright module graph).
 */

const requireFromProject = createRequire(`${process.cwd()}/noop.js`);
const AXE_SOURCE = readFileSync(requireFromProject.resolve('axe-core/axe.min.js'), 'utf8');

/** The two impact levels that fail the gate. Everything else is reported, not fatal. */
const BLOCKING_IMPACTS: ReadonlyArray<string> = ['serious', 'critical'];

interface AxeViolation {
  id: string;
  impact: string | null;
  help: string;
  nodes: Array<{ target: string; failureSummary?: string }>;
}

/** The gate itself, kept separate from the assertion so the negative controls can exercise it. */
function blocking(violations: AxeViolation[]): AxeViolation[] {
  return violations.filter((v) => BLOCKING_IMPACTS.includes(v.impact ?? ''));
}

function describeViolations(violations: AxeViolation[]): string {
  return violations
    .map(
      (v) =>
        `[${v.impact ?? 'unknown'}] ${v.id} — ${v.help}\n` +
        v.nodes.map((n) => `    ${n.target.join(' ')}\n      ${n.failureSummary ?? ''}`).join('\n'),
    )
    .join('\n\n');
}

/** Load /dashboard and settle it. Kept separate from the scan so a probe can mutate the
 *  page between the two — a scan that re-navigates would wipe the injected violation and
 *  prove nothing. */
async function loadDashboard(page: import('@playwright/test').Page): Promise<void> {
  // Phase 11: a fresh context now opens on onboarding, not on a dashboard full of demo records — which is
  // the behaviour acceptance 1 pins, and the reason this gate has to seed the fixture explicitly. Without
  // it axe would scan the first-run screen while believing it scanned /dashboard.
  await seedBrowser(page);
  await page.clock.setFixedTime(fixedInstant());
  await page.goto('/dashboard');
  // The dashboard paints asynchronously (B-27 is the standing name for that class of flake);
  // scanning a half-painted page would make the result depend on timing rather than on markup.
  await expect(page.getByRole('heading', { name: 'Tablou de bord' })).toBeVisible();
}

/** Run axe against whatever is currently on screen. */
async function runAxe(page: import('@playwright/test').Page): Promise<AxeViolation[]> {
  await page.addScriptTag({ content: AXE_SOURCE });
  return page.evaluate(async () => {
    const results = await (window as unknown as { axe: {
      run(root: Element, options: object): Promise<{ violations: unknown[] }>;
    } }).axe.run(document, { resultTypes: ['violations'] });
    return results.violations as never;
  });
}

async function scanDashboard(page: import('@playwright/test').Page): Promise<AxeViolation[]> {
  await loadDashboard(page);
  return runAxe(page);
}

/**
 * PG-5 — the route this phase rebuilt.
 *
 * `/declarations` was recorded in `docs/ai/phases/27_pg0_groundwork.md` as a route the gate had not
 * widened to. It is widened here because PG-5 replaced the page: a register table and a modal form with
 * a required-date rule. That is new markup on a route the gate had never looked at, and a new surface
 * should not enter the tree unscanned.
 *
 * PG-5b: the second, read-only monthly table is gone, so the scan now covers the register with a filing
 * in it and the modal is one click away. The route stays in the gate — the landmine is that a rebuilt
 * route must not leave the tree unscanned, and deleting a table is a change to it like any other.
 */
async function loadDeclarations(page: import('@playwright/test').Page): Promise<void> {
  await seedBrowser(page, {
    ...seedPayload(),
    filings: [{ id: 'f-2026', taxYear: 2026, form: 'D212', status: 'depusa', filedOn: '2027-05-12', reference: 'D212.2026.000042' }],
  });
  await page.clock.setFixedTime(fixedInstant());
  await page.goto('/declarations');
  await expect(page.getByRole('heading', { name: 'Declarația unică (D212)' })).toBeVisible();
  // A populated register, so the scan covers the table's rows and not only its shell.
  await expect(page.getByText('D212.2026.000042')).toBeVisible();
}

/**
 * PG-6h-3 — the route this task added.
 *
 * The occupancy tab is the first table in the app whose rows are other people's names and identity
 * numbers, and it is the first table built with a `<caption>`, a `<th scope="col">` header row and a
 * visually-hidden column header for the delete control. That markup is exactly what an axe run is for,
 * and the same rule PG-5 recorded applies: a new surface must not enter the tree unscanned.
 *
 * The scan runs against a sheet **with two stays in it**, not an empty form — an empty-state shell passes
 * axe whether or not the table underneath it is accessible.
 */
async function loadOccupancy(page: import('@playwright/test').Page): Promise<void> {
  await seedBrowser(page, {
    ...seedPayload(),
    occupancySheets: [SYNTHETIC_SHEET],
  });
  await page.clock.setFixedTime(fixedInstant());
  await page.goto('/documents#!/occupancy');
  await expect(page.getByTestId('occ-sheet-heading')).toBeVisible();
  // Populated rows, so the scan covers the table and not only its shell.
  await expect(page.getByText(SYNTHETIC_CNP_A)).toBeVisible();
}

test.describe('PG-0 — axe-core accessibility gate on /dashboard', () => {
  test('the dashboard has no serious or critical axe violations', async ({ page }) => {
    const violations = await scanDashboard(page);
    const fatal = blocking(violations);
    const noise = violations.filter((v) => !BLOCKING_IMPACTS.includes(v.impact ?? ''));

    // minor / moderate are surfaced so they can be triaged later, never swallowed.
    test.info().annotations.push({
      type: 'axe',
      description: `${fatal.length} blocking (serious+critical), ${noise.length} non-blocking ` +
        `(minor+moderate) on /dashboard`,
    });
    if (noise.length > 0) console.log(`axe, non-blocking on /dashboard:\n${describeViolations(noise)}`);

    expect(fatal, `axe found blocking violations on /dashboard:\n\n${describeViolations(fatal)}`).toHaveLength(0);
  });

  test('the annual filing register has no serious or critical axe violations', async ({ page }) => {
    await loadDeclarations(page);
    const violations = await runAxe(page);
    const fatal = blocking(violations);
    const noise = violations.filter((v) => !BLOCKING_IMPACTS.includes(v.impact ?? ''));

    test.info().annotations.push({
      type: 'axe',
      description: `${fatal.length} blocking (serious+critical), ${noise.length} non-blocking ` +
        `(minor+moderate) on /declarations`,
    });
    if (noise.length > 0) console.log(`axe, non-blocking on /declarations:\n${describeViolations(noise)}`);

    expect(fatal, `axe found blocking violations on /declarations:\n\n${describeViolations(fatal)}`).toHaveLength(0);
  });

  test('the occupancy sheet has no serious or critical axe violations', async ({ page }) => {
    await loadOccupancy(page);
    const violations = await runAxe(page);
    const fatal = blocking(violations);
    const noise = violations.filter((v) => !BLOCKING_IMPACTS.includes(v.impact ?? ''));

    test.info().annotations.push({
      type: 'axe',
      description: `${fatal.length} blocking (serious+critical), ${noise.length} non-blocking `
        + `(minor+moderate) on /documents#!/occupancy`,
    });
    if (noise.length > 0) console.log(`axe, non-blocking on /documents#!/occupancy:\n${describeViolations(noise)}`);

    expect(fatal, `axe found blocking violations on /documents#!/occupancy:\n\n${describeViolations(fatal)}`).toHaveLength(0);
  });

  // ── Negative controls ─────────────────────────────────────────────────────────
  // Without these, the gate above could pass for the wrong reason: an axe run that
  // found nothing at all, or a filter that filtered out everything.

  test('the gate bites: a serious violation injected into the live dashboard is reported', async ({ page }) => {
    await loadDashboard(page);
    const before = await runAxe(page);
    expect(before.length, 'the clean dashboard scan reported nothing at all — the scan is vacuous').toBeGreaterThan(0);

    // Injected AFTER the clean scan, and the page is NOT re-navigated before the second
    // scan — re-gotoing would reload the document and erase the violation.
    await page.evaluate(() => {
      const img = document.createElement('img');
      img.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      // An EMPTY alt is decorative and legal; omitting the attribute entirely is the violation.
      img.setAttribute('data-probe', 'axe-serious-probe');
      // `document.body`, not `main`: this app renders no `<main>` landmark at all (grep finds no
      // `<main>` anywhere in src/), so a `querySelector('main')` here returned null and the probe
      // silently proved nothing. The missing landmark is itself axe's `landmark-one-main`,
      // moderate — recorded, not gated. See phases/27 §6.
      document.body.appendChild(img);
    });
    // Prove the injection landed before trusting the scan. Without this, a selector that quietly
    // matches nothing turns the negative control back into a vacuous pass.
    await expect(page.locator('[data-probe="axe-serious-probe"]')).toBeAttached();
    const after = await runAxe(page);
    const introduced = after.filter((v) => v.id === 'image-alt');
    expect(introduced.length, 'injecting an <img> with no alt raised no axe violation — the scan is vacuous').toBeGreaterThan(0);
    expect(
      blocking(introduced).length,
      `image-alt came back as '${introduced[0]?.impact}', which the gate would not fail on`,
    ).toBeGreaterThan(0);
  });

  test('the gate does not bite on a minor violation', async () => {
    // The classifier is what decides, and it must not be a blanket "any violation fails".
    const synthetic: AxeViolation[] = [
      { id: 'minor-probe', impact: 'minor', help: 'a minor finding', nodes: [{ target: ['div'] }] },
      { id: 'moderate-probe', impact: 'moderate', help: 'a moderate finding', nodes: [{ target: ['div'] }] },
      { id: 'null-impact-probe', impact: null, help: 'an unclassified finding', nodes: [{ target: ['div'] }] },
    ];
    expect(blocking(synthetic)).toEqual([]);

    const mixed: AxeViolation[] = [...synthetic, { id: 'serious-probe', impact: 'serious', help: 'x', nodes: [{ target: ['div'] }] }];
    expect(blocking(mixed).map((v) => v.id)).toEqual(['serious-probe']);
  });
});
