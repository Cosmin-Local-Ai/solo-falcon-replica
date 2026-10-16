import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { STORAGE_KEY } from './fixtures';
import { fixedInstant } from '../src/test/fixedInstant';
import type { PersonaId } from '../src/data/personas/personaTypes';

/**
 * Step 11 — how a persona spec gets its person into the browser.
 *
 * ## Why this does not `import` the personas
 *
 * `e2e/fixtures.ts` can import `src/data/seed.ts` because the seed is plain TypeScript. A persona cannot be
 * imported here: `src/data/personas/index.ts` reaches `src/data/caenRev3.ts`, which loads
 * `docs/ai/data/caen_rev3.csv` through Vite's `?raw` suffix — and Playwright's own Node-side loader has no
 * idea what `?raw` means. It tries to compile the CSV as JavaScript and fails on `01,diviziune,…` as a
 * legacy octal literal. That is not a quirk to work around in the spec; it is the Part A design decision
 * (one copy of the nomenclator, no copy under `src/`) showing up at a second loader.
 *
 * So the payload is built **inside the browser**, through the module graph that does understand `?raw` —
 * the dev server the specs run against. The persona data the spec asserts on is then byte-for-byte the data
 * the app itself would load, which is the stronger guarantee anyway: a spec that re-assembled the dataset
 * from its own copy would be testing its copy.
 *
 * ## Why `evaluate` + reload rather than `addInitScript`
 *
 * `fixtures.ts` uses `addInitScript` because a dynamic import cannot be awaited inside it, and an unawaited
 * one would race the app's own boot. Here the app is booted first (empty, on onboarding), the payload is
 * written from the page context, and the document is reloaded once. No init script is installed, so nothing
 * re-runs on the reload and overwrites what was just written — the hazard `e2e/settings.spec.ts` avoids for
 * the same reason.
 *
 * ## The clock
 *
 * Pinned to the shared instant (`src/test/fixedInstant.ts`), 2026-10-31. Every figure in the persona specs
 * is the estimate at that date: the estimate runs on recorded actuals through the as-of date, so ten of a
 * persona's twelve months are in the figure and two are not.
 */

/**
 * The app's own module specifiers, held in variables and **passed into the page** on purpose.
 *
 * A dynamic `import()` with a **string literal** is resolved by TypeScript at compile time, and `/src/...`
 * is a Vite dev-server path, not a module TypeScript can see — it would fail the type check for a specifier
 * that only ever exists at runtime. A non-literal specifier is typed `any` and left alone, which is the
 * correct treatment: the thing being imported is a running dev server's module graph, not this file's
 * dependency graph.
 *
 * They are passed as `evaluate` arguments because `page.evaluate` serialises the *function* and runs it in
 * the browser, where this module's scope does not exist. A module-level constant read inside the callback
 * is `undefined` there — which is the same trap as any closure across the process boundary.
 */
const PERSONAS_MODULE = '/src/data/personas/index.ts';
const MIGRATION_MODULE = '/src/data/migration.ts';

/** Build one persona's dataset in the page and store it under the app's own key. */
async function writePersonaPayload(page: Page, personaId: PersonaId, overrides: Record<string, unknown>): Promise<void> {
  await page.evaluate(
    async ({ id, over, modules }: { id: string; over: Record<string, unknown>; modules: string[] }) => {
      const personas = await import(modules[0]);
      const migration = await import(modules[1]);
      const persona = personas.PERSONAS.find((p: { id: string }) => p.id === id);
      if (!persona) throw new Error(`no persona with id ${id}`);
      localStorage.setItem(
        'pfa-app-data-v2',
        JSON.stringify({ ...persona.data, ...over, version: migration.CURRENT_DATA_VERSION }),
      );
    },
    { id: personaId, over: overrides, modules: [PERSONAS_MODULE, MIGRATION_MODULE] },
  );
}

/** Load one persona and land on the cockpit, clock pinned. */
export async function loadPersona(
  page: Page,
  personaId: PersonaId,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  await page.goto('/');
  await writePersonaPayload(page, personaId, overrides);
  await page.clock.setFixedTime(fixedInstant());
  await page.goto('/dashboard');
}

/**
 * The same persona with one **profile fact** changed, landing wherever that fact is shown.
 *
 * This is the shape persona 4's boundary needs: the same person, one declared number moved, a different
 * article answering. The merge happens in the page against the persona's own profile rather than against a
 * profile restated in the spec, so the spec cannot drift from the data it is perturbing.
 */
export async function loadPersonaWithProfile(
  page: Page,
  personaId: PersonaId,
  profileOverrides: Record<string, unknown>,
  route = '/settings#!/fiscal',
): Promise<void> {
  await page.goto('/');
  await page.evaluate(
    async ({ id, profile, modules }: { id: string; profile: Record<string, unknown>; modules: string[] }) => {
      const personas = await import(modules[0]);
      const migration = await import(modules[1]);
      const persona = personas.PERSONAS.find((p: { id: string }) => p.id === id);
      if (!persona) throw new Error(`no persona with id ${id}`);
      localStorage.setItem(
        'pfa-app-data-v2',
        JSON.stringify({
          ...persona.data,
          profile: { ...persona.data.profile, ...profile },
          version: migration.CURRENT_DATA_VERSION,
        }),
      );
    },
    { id: personaId, profile: profileOverrides, modules: [PERSONAS_MODULE, MIGRATION_MODULE] },
  );
  await page.clock.setFixedTime(fixedInstant());
  await page.goto(route);
}

/**
 * The same persona with one **expense row** patched, leaving every other row as the persona declared it.
 *
 * This is the shape B-108's two branches need: the fact under test is the link between one expense and one
 * asset, so the negative branch must be the *same person with the link removed*, not a register restated in
 * the spec. A patch is applied inside the page against the persona's own row; a `null` value means "remove
 * this key", which is how an absent `assetId` is expressed — `undefined` does not survive the JSON the app
 * reads back, and an empty string would be a different fact (a link to nothing, not no link).
 */
export async function loadPersonaWithExpensePatch(
  page: Page,
  personaId: PersonaId,
  expenseId: string,
  patch: Record<string, unknown>,
  route = '/dashboard',
): Promise<void> {
  await page.goto('/');
  await page.evaluate(
    async ({ id, expense, changes, modules }: {
      id: string;
      expense: string;
      changes: Record<string, unknown>;
      modules: string[];
    }) => {
      const personas = await import(modules[0]);
      const migration = await import(modules[1]);
      const persona = personas.PERSONAS.find((p: { id: string }) => p.id === id);
      if (!persona) throw new Error(`no persona with id ${id}`);
      const expenses = persona.data.expenses.map((e: { id: string }) => {
        if (e.id !== expense) return e;
        const next = { ...e } as Record<string, unknown>;
        for (const [key, value] of Object.entries(changes)) {
          if (value === null) delete next[key];
          else next[key] = value;
        }
        return next;
      });
      localStorage.setItem(
        'pfa-app-data-v2',
        JSON.stringify({ ...persona.data, expenses, version: migration.CURRENT_DATA_VERSION }),
      );
    },
    { id: personaId, expense: expenseId, changes: patch, modules: [PERSONAS_MODULE, MIGRATION_MODULE] },
  );
  await page.clock.setFixedTime(fixedInstant());
  await page.goto(route);
}

/**
 * Open the estimate breakdown on the cockpit.
 *
 * The arithmetic behind the hero number is collapsed behind a real `<details>` disclosure — keyboard
 * operable, state visible, content in the DOM — never behind a hover. That is the right presentation, and
 * it means a spec that wants to read a line has to open the thing the user would open. Asserting against a
 * hidden row would pass on markup nobody sees.
 */
export async function openEstimateBreakdown(page: Page): Promise<void> {
  const details = page.locator('details.estimate-breakdown');
  await expect(details).toBeAttached();
  if ((await details.getAttribute('open')) === null) await details.locator('summary').click();
}

/** One line of the estimate, by its label. Opens the breakdown first, so "visible" means visible. */
export async function estimateLine(page: Page, label: string) {
  await openEstimateBreakdown(page);
  return page.locator('details.estimate-breakdown tr').filter({ hasText: label });
}

/** A coverage row on the cockpit, by the reason the engine named. */
export function coverageRow(page: Page, reason: string) {
  return page.locator(`[data-coverage-reason="${reason}"]`).first();
}

/**
 * The estimate total the hero shows, as rendered text.
 *
 * `.first()` because the page carries more than one `.tax-hero-value`: the run-rate forecast beside the hero
 * is rendered with the same class, deliberately, so the two read as the same kind of number. The hero is
 * first in document order; scoping here rather than in each spec keeps a persona spec from failing on the
 * forecast's existence.
 */
export function taxHero(page: Page) {
  return page.locator('.tax-hero-value').first();
}

/** The estimate-state badge — the gate PG-1 put on the word „Calculat”. */
export function estimateBadge(page: Page, state: string) {
  return page.locator(`.badge[data-estimate-state="${state}"]`);
}

/**
 * A threshold row on the cockpit, located by the lei amount of its limit.
 *
 * `ThresholdSection` labels rows from `type` + `affectedTax` rather than carrying the threshold id in the
 * DOM, and no two rows share a limit amount, so the limit is the stable handle.
 */
export function thresholdRowWithLimit(page: Page, limit: string) {
  return page.locator('.threshold-row').filter({ has: page.getByText(limit, { exact: true }) });
}

export { STORAGE_KEY };
