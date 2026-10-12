/**
 * PG-6h-3 (D-OCC-1) — the privacy consequences, written as tests.
 *
 * D-OCC-1's numbered consequences are acceptance criteria, not commentary. This file is where four of
 * them are pinned:
 *
 *  1. **Local storage only, and no network path.** The repository had no network write path before this
 *     task — a grep for `fetch(`, `XMLHttpRequest` and `navigator.sendBeacon` returned nothing outside
 *     tests — so the property to defend is an existing one. It is now enforced mechanically rather than by
 *     the absence of anyone thinking to add a call. A guard that only checks the occupancy module would
 *     miss the failure mode that matters: a fetch added somewhere else that happens to read the sheet.
 *  2. **No real CNP in any fixture.** Proved by arithmetic, not by eyeballing: every CNP-shaped literal in
 *     the occupancy fixtures must fail the CNP check digit, because the check digit is the one property
 *     that would make a 13-digit string somebody's actual CNP.
 *  3. **No guest data in an export the user did not ask for.** Asserted against the one CSV path that
 *     already existed — `rjipCsv` — with a payload that carries both money and a sheet.
 *  4. **Guest data is not an engine operand and appears in no figure, breakdown, diagnostic or deadline.**
 *     Asserted two ways: a source scan proving the engine never names this data at all, and a data-level
 *     scan proving that no surface the dashboard renders contains a guest string.
 *
 * The source scans use Vite's raw glob, the same choice `src/test/wallClockGuard.test.ts` and
 * `src/ui/copy/copy.guard.test.ts` record: this is a browser app with no `@types/node`.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';
import { StoreProvider, useStore, STORAGE_KEY } from './store';
import { seedData } from './seed';
import { seedStorage } from '../test/storage';
import { buildRjipRegister, rjipCsv } from '../pages/Documents';
import {
  getFinancialSummary, getLedgerDisclosure, getMonthlyFinancialSeries, getTaxEstimate,
} from './dashboard';
import { pinClock } from '../test/clock';
import {
  SYNTHETIC_CNP_A, SYNTHETIC_CNP_B, SYNTHETIC_SHEET, SYNTHETIC_STAY_ID_DOC,
  cnpCheckDigitValid,
} from '../test/occupancyFixtures';

// ── 1. No network path, standing ────────────────────────────────────────────

/**
 * The production source, as text. Test files are excluded because a test that stubs or spies a fetcher is
 * sanctioned — `src/pages/Settings.fx.test.tsx` deliberately replaces `globalThis.fetch` with a spy to
 * prove the rate form never calls it.
 */
const PRODUCTION_SOURCES = import.meta.glob<string>('/src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const isTestFile = (path: string): boolean => /\.test\.tsx?$/.test(path);

/**
 * Built by concatenation so this file never contains the token it forbids — the same trick
 * `src/test/wallClockGuard.test.ts` uses, without which the guard would report itself.
 */
const OFFENDERS: ReadonlyArray<{ label: string; re: RegExp }> = [
  { label: 'a fetch call', re: new RegExp('\\b' + 'fetch' + '\\s*\\(') },
  { label: 'an XHR', re: new RegExp('\\b' + 'XMLHttpRequest' + '\\b') },
  { label: 'a beacon', re: new RegExp('navigator\\s*\\.\\s*' + 'sendBeacon' + '\\s*\\(') },
  { label: 'a websocket', re: new RegExp('\\b' + 'WebSocket' + '\\b') },
  { label: 'an EventSource', re: new RegExp('\\b' + 'EventSource' + '\\b') },
];

/** Blank for a comment-only line, otherwise the line minus a trailing line-comment. */
function stripComments(line: string): string {
  const trimmed = line.trimStart();
  if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return '';
  const at = line.search(/\s\/\//); // `\s//` so a URL scheme is not read as a comment
  return at === -1 ? line : line.slice(0, at);
}

describe('D-OCC-1 consequence 3 — there is no network path, and this task did not add one', () => {
  it('finds no network call anywhere in non-test src/', () => {
    const hits: string[] = [];
    for (const [file, source] of Object.entries(PRODUCTION_SOURCES)) {
      if (isTestFile(file)) continue;
      source.split('\n').forEach((raw, index) => {
        const line = stripComments(raw);
        if (!line) return;
        for (const { label, re } of OFFENDERS) {
          if (re.test(line)) hits.push(`${file}:${index + 1} — ${label} — ${line.trim()}`);
        }
      });
    }
    expect(hits).toEqual([]);
  });

  it('is not vacuous: the glob covers the app and the patterns still fire', () => {
    const files = Object.keys(PRODUCTION_SOURCES).filter(f => !isTestFile(f));
    // The scan must actually see the surfaces guest data could leave through.
    expect(files.length).toBeGreaterThan(60);
    for (const surface of ['pages/Documents.tsx', 'data/store.tsx', 'pages/Settings.tsx']) {
      expect(files.some(f => f.endsWith(surface)), `${surface} left the scan`).toBe(true);
    }
    // Each pattern must fire on the token it names — otherwise a typo in a regex would leave the scan
    // above passing while watching for nothing.
    const TRIGGERS: Record<string, string> = {
      'a fetch call': 'fetch(data)',
      'an XHR': 'new XMLHttpRequest()',
      'a beacon': 'navigator.sendBeacon("/x", body)',
      'a websocket': 'new WebSocket("wss://x")',
      'an EventSource': 'new EventSource("/stream")',
    };
    for (const { label, re } of OFFENDERS) {
      expect(re.test(TRIGGERS[label]), `${label} pattern does not fire`).toBe(true);
    }
    // And the near-miss that already exists in the tree must not fire: `FetchText` is an injected function
    // type in domain/fx, and nothing in this repository calls the network through it.
    expect(OFFENDERS[0].re.test('const f: FetchText = inject me')).toBe(false);
  });

  it('the occupancy sheet reaches storage and stops there', () => {
    // The property is "localStorage is the only sink". It is asserted on which keys exist after a real
    // mutation, not by intercepting `setItem`: jsdom's Storage is a Proxy whose methods cannot be shadowed
    // via own properties — the same reason `src/data/store.save.test.tsx` swaps `window.localStorage`
    // rather than the method. A second sink would have to introduce a second key, and that is what this
    // catches.
    seedStorage({ ...seedData, occupancySheets: [SYNTHETIC_SHEET] });
    render(<StoreProvider><Probe /></StoreProvider>);
    const sheetId = storeRef!.occupancySheets[0].id;

    // A real write, so the assertion below is not watching an idle store.
    act(() => { storeRef!.addOccupancyStay(sheetId, SYNTHETIC_STAY_ID_DOC); });

    const keys = Object.keys(localStorage).sort();
    expect(keys).toEqual([STORAGE_KEY]);
    // And the sheet really is in those bytes — otherwise "only one key" would be vacuous.
    expect(localStorage.getItem(STORAGE_KEY)).toContain(SYNTHETIC_STAY_ID_DOC.guestIdentifier);
    // The quarantine key is the one other key this app ever writes; it must not appear here.
    expect(localStorage.length).toBe(1);
  });
});

// ── 2. No real CNP in any fixture ───────────────────────────────────────────

/** The fixture sources: the synthetic module and every occupancy test that carries guest values. */
const FIXTURE_SOURCES = import.meta.glob<string>('/src/**/occupancy*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

describe('D-OCC-1 consequence 5 — no real CNP in any fixture, seed or test', () => {
  it('every CNP-shaped literal in the occupancy fixtures fails the CNP check digit', () => {
    // A value that passes the check digit is a plausible real person's CNP, and must be replaced. This is
    // the acceptance-2 grep, written as a test so it cannot quietly rot.
    const offenders: string[] = [];
    const seen: string[] = [];
    for (const [file, source] of Object.entries(FIXTURE_SOURCES)) {
      for (const m of source.matchAll(/['"]([0-9]{13})['"]/g)) {
        seen.push(`${file}: ${m[1]}`);
        if (cnpCheckDigitValid(m[1])) offenders.push(`${file}: ${m[1]} validates as a real CNP`);
      }
    }
    // Not vacuous: the scan has to find the values, or it would pass on an empty set.
    expect(seen.length).toBeGreaterThan(0);
    expect(offenders).toEqual([]);
  });

  it('the synthetic values themselves are provably not real', () => {
    for (const value of [SYNTHETIC_CNP_A, SYNTHETIC_CNP_B]) {
      expect(cnpCheckDigitValid(value)).toBe(false);
      // And they fail on face value too: birth date 00-00-0000 is in no register.
      expect(value.slice(1, 7)).toBe('000000');
    }
  });

  it('the seed declares no occupancy sheet, so it carries no third-party data at all', () => {
    expect(seedData.occupancySheets).toEqual([]);
  });
});

// ── 3. No guest data in an export the user did not ask for ──────────────────

describe('D-OCC-1 consequence 3 — the existing export does not pick up guest data', () => {
  const payload = { ...seedData, occupancySheets: [SYNTHETIC_SHEET] };
  const guestStrings = [
    SYNTHETIC_SHEET.stays[0].guestName,
    SYNTHETIC_SHEET.stays[1].guestName,
    SYNTHETIC_CNP_A,
    SYNTHETIC_CNP_B,
    SYNTHETIC_SHEET.propertyAddress,
    SYNTHETIC_SHEET.roomLabel,
  ];

  it('the RJIP CSV is unchanged by the presence of a sheet', () => {
    const withoutSheet = rjipCsv(buildRjipRegister(seedData, 2026).rows);
    const withSheet = rjipCsv(buildRjipRegister(payload, 2026).rows);
    expect(withSheet).toBe(withoutSheet);
    for (const s of guestStrings) {
      expect(withSheet).not.toContain(s);
    }
  });

  it('no guest string appears in any figure, breakdown, ledger, series or deadline the dashboard renders', async () => {
    const asOf = pinClock().toISOString().slice(0, 10);
    const surfaces: Record<string, unknown> = {
      ledger: getLedgerDisclosure(payload),
      summary: getFinancialSummary(payload, asOf),
      series: [...getMonthlyFinancialSeries(payload, asOf).entries()],
      estimate: await getTaxEstimate(payload, asOf),
    };
    for (const [name, value] of Object.entries(surfaces)) {
      const rendered = JSON.stringify(value);
      for (const s of guestStrings) {
        expect(rendered, `${name} carries guest data`).not.toContain(s);
      }
    }
  });
});

// ── 4. The engine never reads this data ─────────────────────────────────────

/**
 * The calculation path, by name. A scan rather than a review, because the boundary is standing: a later
 * task that wants an occupancy figure would have to edit one of these files, and that edit has to fail
 * here before it can become a number.
 */
/**
 * The calculation path, by name. A scan rather than a review, because the boundary is standing: a later
 * task that wants an occupancy figure would have to edit one of these files, and that edit has to fail
 * here before it can become a number.
 *
 * The pattern is the **access surface**, not the English word. Four files under `domain/fiscal/` and
 * `domain/scenarios.ts` already contain the string "occupancy" — five of those hits are the research
 * filename `38_art68x3_cass_and_occupancy_order.md` and one is a comment recording that alin. (8) is this
 * task's job. Matching the word would have made this test fail on prose and taught the next reader to
 * delete it, which is how a guard gets weakened. Matching the identifiers is what actually catches a read.
 */
const ENGINE_FILES = [
  '/src/domain/tax.ts',
  '/src/domain/estimateBasis.ts',
  '/src/domain/aggregation.ts',
  '/src/domain/scenarios.ts',
  '/src/domain/projection.ts',
  '/src/data/dashboard.ts',
  '/src/data/derived.ts',
];

/** Every name by which the occupancy data could be read. */
const OCCUPANCY_ACCESS = /\b(occupancySheets|OccupancySheet|OccupancyStay|GuestIdentifierKind|occupancyCsv|occupancyStayExceedsShortTermCeiling|isCnpShaped|SHORT_TERM_LET_MAX_DAYS)\b/;

describe('D-OCC-1 — the occupancy sheet is not an engine operand', () => {
  it('no file on the calculation path can read the occupancy data', () => {
    const offenders: string[] = [];
    for (const [file, source] of Object.entries(PRODUCTION_SOURCES)) {
      const isEngine = ENGINE_FILES.includes(file) || file.includes('/domain/fiscal/');
      if (!isEngine) continue;
      if (OCCUPANCY_ACCESS.test(source)) offenders.push(file);
    }
    // Not vacuous: the scan must actually have found the engine files, and the pattern must actually fire
    // on a read while staying silent on the prose that already exists in these same files.
    const scanned = Object.keys(PRODUCTION_SOURCES).filter(
      f => ENGINE_FILES.includes(f) || f.includes('/domain/fiscal/'),
    );
    expect(scanned.length).toBeGreaterThan(5);
    expect(OCCUPANCY_ACCESS.test('const gross = data.occupancySheets.length;')).toBe(true);
    expect(OCCUPANCY_ACCESS.test(
      '// alin. (8) — the occupancy sheet (OPANAF 381/2026). See research/38_art68x3_cass_and_occupancy_order.md',
    )).toBe(false);
    expect(offenders).toEqual([]);
  });

  it('a sheet with a guest row leaves every fiscal figure where it was', async () => {
    const asOf = pinClock().toISOString().slice(0, 10);
    const bare = await getTaxEstimate(seedData, asOf);
    const withSheet = await getTaxEstimate({ ...seedData, occupancySheets: [SYNTHETIC_SHEET] }, asOf);
    // `TaxEstimateWithBasis` is a union: only the computed member carries the figures. Narrowing is also
    // the assertion — the seed profile must still compute, and a sheet must not be what stops it.
    expect(bare.status).toBe('computed');
    expect(withSheet.status).toBe('computed');
    if (bare.status !== 'computed' || withSheet.status !== 'computed') {
      throw new Error('the seed estimate stopped computing — a sheet must not change that');
    }
    // Compared on the fiscal payload, not on the whole snapshot: `calculationId` carries a random UUID, so
    // a full-object comparison would fail for a reason that has nothing to do with this boundary.
    expect(JSON.stringify(withSheet.lines)).toBe(JSON.stringify(bare.lines));
    expect(JSON.stringify(withSheet.output)).toBe(JSON.stringify(bare.output));
    expect(JSON.stringify(withSheet.bases)).toBe(JSON.stringify(bare.bases));
    expect(JSON.stringify(withSheet.basis)).toBe(JSON.stringify(bare.basis));
    // The digest is the strongest form of the claim: the bytes the calculation ran on did not change.
    expect(withSheet.snapshot.inputsHash).toBe(bare.snapshot.inputsHash);
    expect(JSON.stringify(withSheet.snapshot.inputSnapshot))
      .toBe(JSON.stringify(bare.snapshot.inputSnapshot));
    // And the seed's published figure itself — 311.200 bani — is the thing acceptance 6 names.
    expect(withSheet.output.total).toBe(bare.output.total);
    expect(bare.output.total).toBe(311_200);
    expect(JSON.stringify(getFinancialSummary({ ...seedData, occupancySheets: [SYNTHETIC_SHEET] }, asOf)))
      .toBe(JSON.stringify(getFinancialSummary(seedData, asOf)));
  });
});

// ── 5. Deletion is real ─────────────────────────────────────────────────────

let storeRef: ReturnType<typeof useStore> | null = null;
function Probe() {
  storeRef = useStore();
  return null;
}

describe('D-OCC-1 consequence 4 — deleting removes the record from persisted data', () => {
  beforeEach(() => {
    storeRef = null;
  });

  it('a deleted sheet is gone from the bytes in localStorage, not only from the view', () => {
    seedStorage({ ...seedData, occupancySheets: [SYNTHETIC_SHEET] });
    render(<StoreProvider><Probe /></StoreProvider>);
    expect(storeRef).not.toBeNull();
    const sheetId = storeRef!.occupancySheets[0].id;

    // Present first, or the deletion assertion proves nothing.
    expect(localStorage.getItem(STORAGE_KEY)).toContain(SYNTHETIC_CNP_A);

    act(() => { storeRef!.deleteOccupancySheet(sheetId); });

    const persisted = localStorage.getItem(STORAGE_KEY)!;
    expect(JSON.parse(persisted).occupancySheets).toEqual([]);
    // The guest's name and identifier are gone from the stored bytes, not merely hidden.
    expect(persisted).not.toContain(SYNTHETIC_CNP_A);
    expect(persisted).not.toContain(SYNTHETIC_CNP_B);
    expect(persisted).not.toContain(SYNTHETIC_SHEET.stays[0].guestName);
    expect(persisted).not.toContain(SYNTHETIC_SHEET.propertyAddress);
  });

  it('deleting one stay leaves the form and the other stays standing', () => {
    seedStorage({ ...seedData, occupancySheets: [SYNTHETIC_SHEET] });
    render(<StoreProvider><Probe /></StoreProvider>);
    const sheet = storeRef!.occupancySheets[0];
    act(() => { storeRef!.deleteOccupancyStay(sheet.id, sheet.stays[0].id); });

    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(persisted.occupancySheets).toHaveLength(1);
    expect(persisted.occupancySheets[0].stays).toHaveLength(1);
    expect(localStorage.getItem(STORAGE_KEY)).not.toContain(SYNTHETIC_CNP_A);
    expect(localStorage.getItem(STORAGE_KEY)).toContain(SYNTHETIC_CNP_B);
  });

  it('a stay recorded with an identity document, not a CNP, persists and deletes like any other', () => {
    seedStorage({ ...seedData, occupancySheets: [{ ...SYNTHETIC_SHEET, stays: [SYNTHETIC_STAY_ID_DOC] }] });
    render(<StoreProvider><Probe /></StoreProvider>);
    expect(localStorage.getItem(STORAGE_KEY)).toContain(SYNTHETIC_STAY_ID_DOC.guestIdentifier);
    const sheet = storeRef!.occupancySheets[0];
    act(() => { storeRef!.deleteOccupancyStay(sheet.id, sheet.stays[0].id); });
    expect(localStorage.getItem(STORAGE_KEY)).not.toContain(SYNTHETIC_STAY_ID_DOC.guestIdentifier);
  });
});
