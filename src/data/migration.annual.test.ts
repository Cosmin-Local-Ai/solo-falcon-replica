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
 * PG-5 — the v10→v11 step, on its own. PG-5b changed what it does, not what it is.
 *
 * The chain tests prove the step runs and that a legacy payload still loads. This file is about what the
 * step is ALLOWED to do to the data, which is the part that can destroy something. PG-5's rule was "the
 * rows travel, nothing is derived". PG-5b keeps the second half of that sentence and changes the first:
 * **the rows are dropped, nothing is derived.**
 *
 * Dropping is a decision with a name behind it — `docs/ai/USER_DECISIONS.md` D-USER-1 records that there
 * are no active users, so there is no stored payload to preserve, and a PFA în sistem real has no monthly
 * return for the shape to be a record of. What did NOT move is the half that makes this step dangerous:
 * it still may not turn a monthly row into an annual filing. A monthly row with `status: 'inregistrata'`
 * records that something was registered — it is not evidence that anyone filed an annual return, and an
 * annual row minted from it would be a fact the user never established. That is B-34, and a migration is
 * exactly where it would be easiest to sneak in. Deleting a record is no licence to invent one.
 *
 * The step keeps its number, its position and its idempotency. A payload in the wild sits at whatever
 * version it was written at, and the chain has to be able to walk it from there; renumbering a step would
 * break every payload that already ran through it.
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
  it('drops every monthly row the payload carried, under either key', () => {
    // PG-5b replaced "moves every monthly row byte for byte, in order, under the new key". The assertion
    // it carries is the same one the old test carried — the rows are accounted for, and they are not
    // hidden somewhere the app cannot see — only the answer changed: there is no bucket for them any
    // more, under the old name or the new one, and nothing about them is summarised into a count.
    const after = migrateAnnualFilingV11(v10Payload());

    expect('declarations' in after).toBe(false);
    expect('legacyDeclarations' in after).toBe(false);
    // No trace of the rows survives anywhere in the written shape: not the ids, not the period, not the
    // amounts, not the dates.
    const written = JSON.stringify(after);
    for (const row of MONTHLY) {
      expect(written).not.toContain(row.id);
      expect(written).not.toContain(row.dataInregistrare);
    }
  });

  it('mints no annual filing from the rows it dropped', () => {
    // The half of the old rule that PG-5b did NOT relax.
    const after = migrateAnnualFilingV11(v10Payload());

    expect(after.filings).toEqual([]);
  });

  it('does not turn a registered monthly row into a filed annual return', () => {
    // Acceptance 2, at the migration layer. `inregistrata` is the record's own status on a monthly row;
    // reading it as "the D212 for that year was filed" is the exact inference the phase forbids — and it
    // is now unrepresentable, because no monthly row survives the step to be misread.
    const after = migrateAnnualFilingV11(v10Payload());
    const filed = (after.filings ?? []).filter(f => f.status === 'depusa');
    expect(filed).toEqual([]);
  });

  it('changes nothing else about the payload', () => {
    const before = v10Payload();
    const after = migrateAnnualFilingV11(before);

    const { version: _v, declarations: _d, ...restBefore } = before as unknown as Record<string, unknown>;
    const { version: _v2, filings: _f, ...restAfter } = after as unknown as Record<string, unknown>;
    expect(restAfter).toEqual(restBefore);
    expect(after.version).toBe(DATA_VERSION_ANNUAL_FILING);
  });

  it('touches no amount and no currency stamp', () => {
    // The `record-currency` file guards the same property from the other side: a step that deletes a
    // collection must not re-wrap a money record on the way past it.
    const before = JSON.stringify((v10Payload().revenues as { valoareFaraTva: unknown }[]).map(r => r.valoareFaraTva));
    const after = migrateAnnualFilingV11(v10Payload());
    expect(JSON.stringify((after.revenues as { valoareFaraTva: unknown }[]).map(r => r.valoareFaraTva))).toBe(before);
  });

  it('stamps the version whether or not the payload carried monthly rows', () => {
    // The chain aborts on a step that fails to bump the version, and it should. A step that returns the
    // payload unstamped leaves every later load re-running the chain.
    const after = migrateAnnualFilingV11(v10Payload({ declarations: undefined }));
    expect(after.version).toBe(DATA_VERSION_ANNUAL_FILING);
    expect(after.filings).toEqual([]);
    expect('legacyDeclarations' in after).toBe(false);
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

  it('drops a `legacyDeclarations` bucket a PG-5-era payload still carries', () => {
    // PG-5 wrote that key for one release. An install upgraded under PG-5 has it in its bytes; the same
    // step that once created it now removes it, so the bucket cannot survive a load merely because
    // nothing reads it any more.
    const kept = [{ id: 'd-keep', an: 2026, luna: 1, venituri: lei(1), cheltuieli: lei(0), status: 'inregistrata', dataInregistrare: '2026-02-01' }];
    const after = migrateAnnualFilingV11(v10Payload({ legacyDeclarations: kept }));
    expect('legacyDeclarations' in after).toBe(false);
    expect('declarations' in after).toBe(false);
    expect(after.filings).toEqual([]);
  });
});
