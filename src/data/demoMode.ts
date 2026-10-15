/**
 * Step 11 / Part D (B-134) — which demo profile, if any, is switched on.
 *
 * ## Why this is a separate key and not a field on `AppData`
 *
 * The toggle has to survive a reload, and the obvious place to put it would be the persisted dataset. That
 * is the wrong place, for three reasons this file exists to make impossible:
 *
 * 1. **The demo must never be persisted.** `store.tsx` refuses to write while a demo is on screen, and the
 *    whole losslessness of the toggle rests on that. A flag *inside* the dataset would be a field of the
 *    thing that must not be written, and would have to be stripped on every write to stay honest.
 * 2. **No migration step.** The chain head is v21 and the brief forbids adding a step. A field on
 *    `PersistedAppData` would need one, or would need the schema to tolerate an unknown key.
 * 3. **It is app state, not the user's fiscal record.** "Which profile am I looking at" is a property of the
 *    session, like the route in the URL bar. It belongs beside the data, never inside it — the same
 *    separation that keeps `dataOrigin` out of the persisted shape.
 *
 * So: one sibling key, one field, and it holds an **identifier** rather than a copy of the demo's records.
 * The records themselves are re-derived from `src/data/personas/**` on load, which means the key can never
 * grow stale demo data, and the user's own bytes under `STORAGE_KEY` are never read, rewritten or shadowed
 * by it.
 *
 * ## Why the flag has to be visible after a reload, not merely restored
 *
 * B-134 is the same defect class as B-129/B-130: a demo that renders like a real tax position. Restoring
 * the demo silently on load would be worse than not restoring it, because the user would come back to a
 * year of numbers they never entered and no marker saying so. The store therefore restores the demo *and*
 * reports it (`demoActive`, `demoPersonaId`), and `App.tsx` renders it in the topbar, which is outside the
 * scrolling container and cannot scroll out of view.
 */
import { PERSONA_IDS, type PersonaId } from './personas/personaTypes';

/**
 * The key. A sibling of `STORAGE_KEY`, never a replacement for it, and never written by the dataset's save
 * path — the same rule `QUARANTINE_STORAGE_KEY` follows.
 */
export const DEMO_MODE_STORAGE_KEY = 'pfa-demo-mode-v1';

/** What the toggle remembers: which persona is switched on, and nothing else. */
export interface DemoMode {
  personaId: PersonaId;
}

/**
 * Read the remembered demo.
 *
 * `null` means "the user's own data", which is the default and the safe answer to a damaged key: a
 * half-written value must never put somebody else's year on screen. An unknown `personaId` is rejected for
 * the same reason — a persona that this build does not have cannot be rendered, and pretending otherwise
 * would show a badge naming a profile that does not exist.
 */
export function readDemoMode(): DemoMode | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(DEMO_MODE_STORAGE_KEY);
  } catch {
    // Storage blocked: there is no remembered demo to restore, and the app opens on the user's own data.
    return null;
  }
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    clearDemoMode();
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) {
    clearDemoMode();
    return null;
  }
  const personaId = (parsed as { personaId?: unknown }).personaId;
  if (typeof personaId !== 'string' || !(PERSONA_IDS as readonly string[]).includes(personaId)) {
    clearDemoMode();
    return null;
  }
  return { personaId: personaId as PersonaId };
}

/** Switch a demo on. A failed write is not reported: the demo still works for this session, and the next
 *  load simply opens on the user's own data — the honest direction for a flag that only chooses a view. */
export function writeDemoMode(mode: DemoMode): void {
  try {
    localStorage.setItem(DEMO_MODE_STORAGE_KEY, JSON.stringify(mode));
  } catch (err) {
    console.warn('[demoMode] the demo selection could not be remembered', err);
  }
}

/** Switch back to the user's own data, and forget the choice. */
export function clearDemoMode(): void {
  try {
    localStorage.removeItem(DEMO_MODE_STORAGE_KEY);
  } catch (err) {
    console.warn('[demoMode] the demo selection could not be cleared', err);
  }
}
