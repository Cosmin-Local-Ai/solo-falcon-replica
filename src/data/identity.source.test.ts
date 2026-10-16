/**
 * Phase 7 — the identity source-of-truth invariant, checked against the source.
 *
 * Acceptance criterion 6: "No duplicate identity state remains readable: nothing
 * outside the migration path reads `settings.company`/`settings.personal` for
 * identity."
 *
 * A grep written into a docs file goes stale the moment someone adds a file, so
 * the check lives in the test suite: it walks the real source tree and fails with
 * the offending paths. `settings.company` / `settings.personal` remain PARSEABLE
 * (decision D-1 keeps them in the schema so pre-Phase-7 payloads still load) —
 * they are simply no longer readable by application code.
 *
 * The sources are pulled in with Vite's raw glob rather than `node:fs`: this is a
 * browser app with no `@types/node`, and installing Node types just to police one
 * invariant would add a dependency the shipped app never uses.
 */
import { describe, expect, it } from 'vitest';

/** Every app source file, as raw text, keyed by path relative to this file. */
const SOURCES = import.meta.glob('../**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const APP_FILES = Object.keys(SOURCES)
  // Tests are allowed to reference anything; declarations carry no behaviour.
  .filter((path) => !/\.test\.tsx?$/.test(path) && !/\.d\.ts$/.test(path))
  .sort();

/**
 * The only files allowed to touch the legacy identity blocks:
 * - `data/migration.ts` — the migration path itself (D-1's absorption);
 * - `data/schema.ts` / `data/types.ts` — they DECLARE the legacy shape so a
 *   pre-Phase-7 payload still parses (trap 3: `settings` is required);
 * - `data/seed.ts` — the seed still writes the legacy block, which is what makes
 *   "parseable but unreadable" observable at all.
 */
const LEGACY_IDENTITY_ALLOWED = ['migration.ts', 'schema.ts', 'types.ts', 'seed.ts'];

/** Files that may still name the deprecated `profile.caen` scalar. */
const DEPRECATED_CAEN_ALLOWED = ['migration.ts', 'models.ts', 'schema.ts'];

function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

/**
 * Strip comments so prose that NAMES a retired field ("`settings.company` is no
 * longer read") does not trip a check about CODE that reads it.
 */
function codeOnly(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function offenders(pattern: RegExp, allowed: string[]): string[] {
  return APP_FILES.filter(
    (path) =>
      !allowed.includes(basename(path)) && pattern.test(codeOnly(SOURCES[path])),
  );
}

describe('identity has exactly one readable source (acceptance criterion 6)', () => {
  it('finds the source tree it is meant to police', () => {
    // Guards against the check silently passing because the glob stopped matching.
    expect(APP_FILES.length).toBeGreaterThan(30);
    expect(APP_FILES.map(basename)).toContain('Settings.tsx');
    expect(APP_FILES.map(basename)).toContain('migration.ts');
  });

  it('reads settings.company / settings.personal in the migration path only', () => {
    // Member access on the settings object — the way the old code read them.
    const found = offenders(/\b(?:settings|s)\s*[!?]?\.\s*(?:company|personal)\b/, LEGACY_IDENTITY_ALLOWED);
    expect(found).toEqual([]);
  });

  it('no longer reads the deprecated profile.caen scalar anywhere', () => {
    // D-1b resolved the CAEN duplication by making `identity.caen[]` the model.
    // `profile.caen` survives only as an optional, deprecated field that the
    // migration consumes — no application code may read it.
    //
    // `fiscal.caen` is deliberately NOT policed: it is the Settings fiscal form's
    // own field name, and it is seeded from `identity.caen[0].cod` and written
    // back to `identity.caen[0]` — never to the deprecated scalar.
    const found = offenders(/\bprofile\s*\.\s*caen\b/, DEPRECATED_CAEN_ALLOWED);
    expect(found).toEqual([]);
  });
});
