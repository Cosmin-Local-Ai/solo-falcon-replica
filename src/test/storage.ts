/**
 * Phase 11 — the one way a test puts records into the store.
 *
 * Before Phase 11 a test that wanted data simply rendered `<StoreProvider>` over an empty localStorage
 * and received the demo fixture for free. That freebie WAS the defect (D1): a fresh browser profile got
 * the same hand-out and nothing labelled it. It is gone, and with it the test shortcut — empty storage
 * now means a first run, which is the behaviour the app is supposed to have.
 *
 * So a test that wants records loads them the way the app loads them: as a persisted payload under the
 * store's own key. That keeps the load path in the test rather than bypassed by a module constant, and
 * writing at `CURRENT_DATA_VERSION` keeps the migration chain out of tests that are not about migration.
 *
 * IMPORT DIRECTION: this file imports no vitest and no `src/test/clock.ts`, so it is safe from a vitest
 * test and from an `e2e/` spec alike.
 */
import { STORAGE_KEY } from '../data/store';
import { CURRENT_DATA_VERSION } from '../data/migration';
import { seedData } from '../data/seed';

/** Write a payload to the store's key. Defaults to the demo fixture at the current data version. */
export function seedStorage(payload: unknown = { ...seedData, version: CURRENT_DATA_VERSION }): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}
