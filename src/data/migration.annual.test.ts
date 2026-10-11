import { describe, expect, it } from 'vitest';
import {
  DATA_VERSION_ANNUAL_FILING,
  DATA_VERSION_RECORD_CURRENCY,
  migrateAnnualFilingV11,
} from './migration';
import { seedData } from './seed';
import type { PersistedAppData } from './schema';
import { lei } from '../domain/money';

/**
 * PG-5 — the v10→v11 step, on its own.
 *
 * The chain tests prove the step runs and that a legacy payload still loads. This file is about what
 * the step is ALLOWED to do to the data, which is the part that can destroy something: the monthly rows
 * are the only place some of these facts exist, and the app must not turn them into a filing it was
 * never told about.
 *
 * The rule the whole file tests, in one sentence: **the rows travel, nothing is derived.** A monthly row
 * with `status: 'inregistrata'` is a record that something was registered — it is not evidence that
 * anyone filed an annual return, and an annual row minted from it would be a fact the user never
 * established. That is B-34, and a migration is exactly where it would be easiest to sneak in.
 */

const MONTHLY = [
  { id: 'd-1', an: 2026, luna: 3, venituri: lei(12500), cheltuieli: lei(1800), status: 'transmisa', dataInregistrare: '2026-04-10', dataTrimitere: '2026-04-15' },
  { id: 'd-2', an: 2026, luna: 6, venituri: lei(14200), cheltuieli: lei(2100), status: 'in-asteptare', dataInregistrare: '2026-07-08' },
  { id: 'd-3', an: 2025, luna: 12, venituri: lei(9680), cheltuieli: lei(546), status: 'inregistrata', dataInregistrare: '2026-01-05' },
];

function v10Payload(overrides: Record<string, unknown> = {}): PersistedAppData {
  const base = {
    version: DATA_VERSION_RECORD_CURRENCY,
    profile: seedData.profile,
    revenues: [
      {
        id: 'r-1', tip: 'factura', nr: 'F-1', date: '2026-03-15', client: 'Client', cui: '12345678',
        valoareFaraTva: { amount: 14250, currency: 'RON' },
        tva: { amount: 2707, currency: 'RON' },
        status: 'inregistrata',
      },
    ],
    expenses: [],
    clients: [],
    declarations: MONTHLY,
    documents: [],
    companyDocs: { im: [], cs: [], tva: [], facturi: [] },
    statements: [],
    snapshots: [],
    settings: seedData.settings,
    reservedAmount: null,
  };
  return { ...base, ...overrides } as unknown as PersistedAppData;
}

describe('the annual-filing step (v10 → v11)', () => {
  it('moves every monthly row byte for byte, in order, under the new key', () => {
    const after = migrateAnnualFilingV11(v10Payload());

    expect(after.legacyDeclarations).toEqual(MONTHLY);
    expect(after.legacyDeclarations!.map(d => d.id)).toEqual(['d-1', 'd-2', 'd-3']);
    // The fields that carry the facts survive untouched: the period, both amounts, the status, and both
    // dates. A rename that loses `dataTrimitere` would quietly delete the only record of a submission.
    expect(after.legacyDeclarations![0]).toEqual(MONTHLY[0]);
    expect(after.legacyDeclarations![2].status).toBe('inregistrata');
  });

  it('mints no annual filing from the rows it moved', () => {
    const after = migrateAnnualFilingV11(v10Payload());

    expect(after.filings).toEqual([]);
  });

  it('does not turn a registered monthly row into a filed annual return', () => {
    // Acceptance 2, at the migration layer. `inregistrata` is the record's own status on a monthly row;
    // reading it as "the D212 for that year was filed" is the exact inference the phase forbids.
    const after = migrateAnnualFilingV11(v10Payload());
    const filed = (after.filings ?? []).filter(f => f.status === 'depusa');
    expect(filed).toEqual([]);
  });

  it('drops the old key from the written shape', () => {
    const after = migrateAnnualFilingV11(v10Payload());
    expect('declarations' in after).toBe(false);
  });

  it('changes nothing else about the payload', () => {
    const before = v10Payload();
    const after = migrateAnnualFilingV11(before);

    const { version: _v, declarations: _d, ...restBefore } = before as unknown as Record<string, unknown>;
    const { version: _v2, legacyDeclarations: _l, filings: _f, ...restAfter } = after as unknown as Record<string, unknown>;
    expect(restAfter).toEqual(restBefore);
    expect(after.version).toBe(DATA_VERSION_ANNUAL_FILING);
  });

  it('touches no amount and no currency stamp', () => {
    // The `record-currency` file guards the same property from the other side: a step that renames a
    // collection must not re-wrap a money record on the way past it.
    const before = JSON.stringify((v10Payload().revenues as { valoareFaraTva: unknown }[]).map(r => r.valoareFaraTva));
    const after = migrateAnnualFilingV11(v10Payload());
    expect(JSON.stringify((after.revenues as { valoareFaraTva: unknown }[]).map(r => r.valoareFaraTva))).toBe(before);
  });

  it('gives a payload that never carried monthly rows no `legacyDeclarations` key at all', () => {
    // An empty array here would claim a monthly history this install does not have. The absence is the
    // honest shape; the load path treats an absent key as empty anyway.
    const after = migrateAnnualFilingV11(v10Payload({ declarations: undefined }));
    expect('legacyDeclarations' in after).toBe(false);
    expect(after.filings).toEqual([]);
    expect(after.version).toBe(DATA_VERSION_ANNUAL_FILING);
  });

  it('never replaces a `filings` array that is already there', () => {
    const existing = [{ id: 'f-2026', taxYear: 2026, form: 'D212', status: 'depusa', filedOn: '2027-05-12' }];
    const after = migrateAnnualFilingV11(v10Payload({ filings: existing }));
    expect(after.filings).toEqual(existing);
  });

  it('is idempotent: a second run changes nothing', () => {
    const once = migrateAnnualFilingV11(v10Payload());
    const twice = migrateAnnualFilingV11(once);
    expect(twice).toEqual(once);
  });

  it('leaves an already-renamed collection alone when a stray `declarations` key sits beside it', () => {
    // A payload can reach this state if a partial write left both keys. The renamed key is the one the
    // app reads; keeping both and letting them disagree is how a row goes missing from every surface.
    const kept = [{ id: 'd-keep', an: 2026, luna: 1, venituri: lei(1), cheltuieli: lei(0), status: 'inregistrata', dataInregistrare: '2026-02-01' }];
    const after = migrateAnnualFilingV11(v10Payload({ legacyDeclarations: kept }));
    expect(after.legacyDeclarations).toEqual(kept);
    expect('declarations' in after).toBe(false);
  });

  it('stamps the version even when there is nothing to move', () => {
    // The chain aborts on a step that fails to bump the version, and it should. A step that returns the
    // payload unstamped leaves every later load re-running the chain.
    const after = migrateAnnualFilingV11(v10Payload({ declarations: undefined }));
    expect(after.version).toBe(DATA_VERSION_ANNUAL_FILING);
  });
});
