import type { Page } from '@playwright/test';
import { seedData } from '../src/data/seed';
import { CURRENT_DATA_VERSION } from '../src/data/migration';
import type { AppData } from '../src/data/types';

/**
 * Phase 11 — how an e2e test gets data into the app.
 *
 * Before Phase 11 a fresh browser context received the demo fixture from `store.tsx` and a spec could
 * simply `page.goto('/dashboard')`. That hand-out WAS defect D1, and it is gone: empty storage now opens on
 * onboarding. A spec that wants the fixture has to load it the way the app loads any data — as a persisted
 * payload under the store's own key — which is also why the payload carries `version`: without it the
 * migration chain treats the fixture as a pre-v10 payload and scales money that is already in bani.
 *
 * IMPORT DIRECTION: this file may import production modules under `src/data` and `src/domain`, and must
 * never import `src/test/clock.ts` (that one pulls in vitest, which has no place in the Playwright module
 * graph). `src/test/storage.ts` is deliberately NOT reused here: it writes through the browser's
 * `localStorage`, which does not exist in the Node process a Playwright spec runs in.
 */

/** Must match `STORAGE_KEY` in `src/data/store.tsx`. */
export const STORAGE_KEY = 'pfa-app-data-v2';

/** A persisted payload: the runtime dataset plus the version stamp the load path reads. */
export type SeedPayload = AppData & { version: number };

/** The demo fixture as a persisted payload at the current data version. */
export function seedPayload(): SeedPayload {
  return { ...seedData, version: CURRENT_DATA_VERSION };
}

/**
 * Seed the context before the app's scripts run. A post-load `evaluate` + reload is racy under
 * `fullyParallel`, which is why every existing spec in this directory uses `addInitScript`.
 */
export async function seedBrowser(page: Page, payload: SeedPayload = seedPayload()): Promise<void> {
  await page.addInitScript(
    (data: { key: string; dataset: SeedPayload }) => {
      localStorage.setItem(data.key, JSON.stringify(data.dataset));
    },
    { key: STORAGE_KEY, dataset: payload },
  );
}

/**
 * Seed only if nothing is stored yet — for the rare test that then writes through the UI and reloads.
 * A plain `addInitScript` re-runs on every document, including the reload, and would overwrite the value
 * the UI just saved, so the assertion would prove nothing (the same reason `e2e/settings.spec.ts` avoids
 * it there).
 */
export async function seedBrowserOnce(page: Page, payload: SeedPayload = seedPayload()): Promise<void> {
  await page.addInitScript(
    (data: { key: string; dataset: SeedPayload }) => {
      if (!localStorage.getItem(data.key)) localStorage.setItem(data.key, JSON.stringify(data.dataset));
    },
    { key: STORAGE_KEY, dataset: payload },
  );
}
