import { describe, it, expect } from 'vitest';
import {
  CURRENT_DATA_VERSION,
  DATA_VERSION_RECORD_CURRENCY,
  // B-105 — the version that opens `profile.leaseFactsYears`.
  DATA_VERSION_LEASE_FACTS,
  // PG-11 — the head of the chain: the shape declaration that lets a document carry a blob pointer.
  DATA_VERSION_EFACTURA_DEADLINE,
  DATA_VERSION_EXPENSE_ASSET_LINK,
  DATA_VERSION_RULE_SET_DIGEST,
  MIGRATION_CHAIN,
  migratePersistedData,
  migrateRecordCurrencyV10,
} from './migration';
import { computeInputsHashSync } from '../domain/snapshots/hashSync';
import { seedData } from './seed';
import type { PersistedAppData } from './schema';
import type { TaxCalculationSnapshot } from '../domain/snapshots/types';
import { lei } from '../domain/money';

/**
 * TASK 10a — the `record-currency` step, and the snapshot landmine.
 *
 * The brief names this as the failure mode to get right: `inputSnapshot` is the enumerated subset
 * `{ profile, revenues, expenses }` and `inputsHash` is derived from it, so adding a currency to the money
 * record *could* move every stored digest. It does not, and this file is the proof rather than the claim.
 *
 * The reason, read from the canonicalisation rather than inferred from a comment
 * (`src/domain/snapshots/serialize.ts`): `canonicalize` walks the object it is handed and emits every own
 * enumerable key in sorted order. What it is handed is `inputSnapshot`, whose `revenues` and `expenses` are
 * **aggregate `Bani` totals** (`CalculationInput` in `src/domain/snapshots/types.ts`), not `Revenue[]` /
 * `Expense[]`. A currency stamped on a record is therefore not reachable from the hashed bytes. The step
 * that stamps it touches no snapshot at all.
 *
 * The two ways this task *could* have moved a digest were (a) adding a field to `PfaProfile`, which
 * `canonicalize` would emit, or (b) adding a key to `inputSnapshot`, which `snapshots.test.ts:437` already
 * forbids. Neither was done.
 */

/** A v9 payload: money already at the ban scale (the `money-bani` step ran at v4→v5), no currency yet. */
function v9Payload(overrides: Record<string, unknown> = {}): PersistedAppData {
  const base = {
    version: DATA_VERSION_RULE_SET_DIGEST,
    profile: seedData.profile,
    revenues: [
      {
        id: 'r-1', tip: 'factura', nr: 'F-1', date: '2026-03-15', client: 'Client', cui: '12345678',
        // Bare bani, exactly as a v9 payload stores them. 142,50 lei.
        valoareFaraTva: 14250, tva: 2707, status: 'inregistrata',
      },
      {
        id: 'r-2', tip: 'factura', nr: 'F-2', date: '2026-04-02', client: 'Client', cui: '12345678',
        valoareFaraTva: 0, tva: 0, status: 'inregistrata',
      },
    ],
    expenses: [
      {
        id: 'e-1', tip: 'factura', nr: 'F-9', date: '2026-03-20', furnizor: 'Furnizor', cui: '87654321',
        // 85,50 lei — the amount Phase 10 refuses to round to 86 lei.
        valoareFaraTva: 8550, tva: 1625, status: 'inregistrata', category: 'rent_business_space',
      },
    ],
    clients: [],
    declarations: [
      { id: 'd-1', an: 2026, luna: 3, venituri: 14250, cheltuieli: 8550, status: 'inregistrata', dataInregistrare: '2026-04-10' },
    ],
    documents: [],
    companyDocs: { im: [], cs: [], tva: [], facturi: [] },
    statements: [],
    snapshots: [storedSnapshot()],
    settings: seedData.settings,
    reservedAmount: lei(250),
  };
  return { ...base, ...overrides } as unknown as PersistedAppData;
}

/**
 * A snapshot as a v9 build would have stored it: `inputSnapshot` holding **aggregate lei totals**, and the
 * digest that build recorded for those exact bytes.
 */
function storedSnapshot(): TaxCalculationSnapshot {
  const inputSnapshot = {
    profile: seedData.profile,
    revenues: 14250 as never,
    expenses: 8550 as never,
  };
  return {
    calculationId: 'calc-1',
    taxYear: 2026,
    calculatedAt: '2026-05-01T10:00:00.000Z',
    ruleRelease: seedData.snapshots[0]?.ruleRelease ?? {
      releaseId: 'rel-legacy', name: '2026.1', jurisdiction: 'RO', entityType: 'pfa', taxYear: 2026,
      ruleIds: [], status: 'SAFE_ACTIVATION', effectiveFrom: '2026-01-01', createdAt: '2026-01-01T00:00:00.000Z', evidence: [],
    },
    inputSnapshot,
    inputsHash: computeInputsHashSync(inputSnapshot),
    calculationLines: [{ label: 'Impozit estimat', value: 81900 as never }],
    output: { total: 81900 as never },
    status: 'computed',
    ruleSetHash: null,
  };
}

describe('record-currency is a no-op in value', () => {
  it('stamps RON on every money field without changing a single number', () => {
    const before = v9Payload();
    const after = migrateRecordCurrencyV10(before);

    expect(after.revenues[0]!.valoareFaraTva).toEqual({ amount: 14250, currency: 'RON' });
    expect(after.revenues[0]!.tva).toEqual({ amount: 2707, currency: 'RON' });
    expect(after.expenses![0]!.valoareFaraTva).toEqual({ amount: 8550, currency: 'RON' });
    // A zero stays a zero — it is not wrapped into `null` and not dropped.
    expect(after.revenues[1]!.valoareFaraTva).toEqual({ amount: 0, currency: 'RON' });

    // The bit-identical check, stated directly: the JSON of the amounts before and after is the same text.
    const amountsBefore = JSON.stringify([14250, 2707, 0, 0, 8550, 1625]);
    const amountsAfter = JSON.stringify([
      after.revenues[0]!.valoareFaraTva.amount, after.revenues[0]!.tva.amount,
      after.revenues[1]!.valoareFaraTva.amount, after.revenues[1]!.tva.amount,
      after.expenses![0]!.valoareFaraTva.amount, after.expenses![0]!.tva.amount,
    ]);
    expect(amountsAfter).toBe(amountsBefore);
  });

  it('stamps the version and nothing else about the payload shape', () => {
    const after = migrateRecordCurrencyV10(v9Payload());
    expect(after.version).toBe(DATA_VERSION_RECORD_CURRENCY);
    // PG-6g re-pin (replaced, not deleted): this step is no longer the head of the chain — v11 … v18, v19,
    // v20, v21, v22 and now v23 follow it. Unchanged is that the step itself stamps exactly 10 and nothing
    // else. Brief 76 states both edges again, because "the head moved by exactly one" is a property worth a
    // test: v22 is now the second-to-last rung and v23 is what this build writes.
    expect(MIGRATION_CHAIN[MIGRATION_CHAIN.length - 1]!.from).toBe(DATA_VERSION_EFACTURA_DEADLINE);
    expect(CURRENT_DATA_VERSION).toBe(DATA_VERSION_EXPENSE_ASSET_LINK);
  });

  it('is idempotent: running it again on a v10 payload changes nothing', () => {
    const once = migrateRecordCurrencyV10(v9Payload());
    const twice = migrateRecordCurrencyV10(once);
    expect(twice).toEqual(once);
  });

  it('leaves a record whose money is already currency-tagged exactly as it was', () => {
    const once = migrateRecordCurrencyV10(v9Payload());
    // Identity, not just equality: an already-stamped record is not rebuilt.
    expect(once.revenues[0]).toBe(migrateRecordCurrencyV10(once).revenues[0]);
  });
});

describe('the landmine: stored inputsHash values do not move', () => {
  it('does not touch the stored snapshot at all', () => {
    const before = v9Payload();
    const stored = before.snapshots![0]!;
    const after = migrateRecordCurrencyV10(before);
    const migrated = after.snapshots![0]!;

    expect(migrated.inputsHash).toBe(stored.inputsHash);
    expect(migrated.inputSnapshot).toEqual(stored.inputSnapshot);
    expect(migrated.calculationLines).toEqual(stored.calculationLines);
    expect(migrated.output).toEqual(stored.output);
    expect(migrated.ruleSetHash).toBe(stored.ruleSetHash);
  });

  it('writes no preMigrationInputsHash — there is no superseded digest to preserve', () => {
    const after = migrateRecordCurrencyV10(v9Payload());
    const snapshot = after.snapshots![0]!;
    // `preMigrationInputsHash` exists for the steps that legitimately re-derive a digest because the
    // hashed bytes changed (`money-bani`, `profile-materialization`). Writing it here would assert that
    // this step changed the bytes, and it did not.
    expect('preMigrationInputsHash' in snapshot).toBe(false);
    expect(snapshot.preMigrationInputsHash).toBeUndefined();
  });

  it('the stored digest still verifies against the stored inputSnapshot after the migration', () => {
    const after = migrateRecordCurrencyV10(v9Payload());
    const snapshot = after.snapshots![0]!;
    // Self-verification is the property that keeps a historical snapshot interpretable: the digest in the
    // record still matches the inputs in the record.
    expect(snapshot.inputsHash).toBe(computeInputsHashSync(snapshot.inputSnapshot));
  });

  it('inputSnapshot still holds exactly the three enumerated keys — no currency marker was added', () => {
    const after = migrateRecordCurrencyV10(v9Payload());
    expect(Object.keys(after.snapshots![0]!.inputSnapshot).sort()).toEqual(['expenses', 'profile', 'revenues']);
  });

  it('the snapshot aggregates stay bare numbers, not money objects', () => {
    const after = migrateRecordCurrencyV10(v9Payload());
    const snapshot = after.snapshots![0]!;
    // This is the mechanism, asserted rather than explained: the hashed payload carries post-aggregation
    // lei totals. Wrapping them would change the canonical bytes and move the digest.
    expect(typeof snapshot.inputSnapshot.revenues).toBe('number');
    expect(typeof snapshot.inputSnapshot.expenses).toBe('number');
  });

  it('the profile is untouched, because canonicalize emits every own key of it', () => {
    const before = v9Payload();
    const after = migrateRecordCurrencyV10(before);
    expect(after.profile).toEqual(before.profile);
    // No currency field was added to the profile. Had one been, `canonicalize` would have emitted it and
    // every stored digest would have moved — which is the trap this step is written to avoid.
    expect(Object.keys(after.profile!).sort()).toEqual(Object.keys(before.profile!).sort());
  });
});

describe('the step touches only the two collections it names', () => {
  it('leaves declarations at bare bani — they are RON aggregates, not foreign-currency records', () => {
    const after = migrateRecordCurrencyV10(v9Payload());
    expect(after.declarations![0]!.venituri).toBe(14250);
    expect(after.declarations![0]!.cheltuieli).toBe(8550);
  });

  it('leaves the recorded reserve untouched', () => {
    const after = migrateRecordCurrencyV10(v9Payload());
    expect(after.reservedAmount).toBe(lei(250));
  });

  it('carries every record identity through, in order', () => {
    const after = migrateRecordCurrencyV10(v9Payload());
    expect(after.revenues.map((r) => r.id)).toEqual(['r-1', 'r-2']);
    expect(after.expenses!.map((e) => e.id)).toEqual(['e-1']);
    expect(after.expenses![0]!.category).toBe('rent_business_space');
  });
});

describe('the chain', () => {
  it('runs record-currency as its own step, from 9 to 10', () => {
    // PG-5 re-pin (replaced, not deleted): this used to assert record-currency was the FINAL step. It is
    // now step 10 of 23 — the annual-filing, activity-family, accommodation, occupancy-sheet, vehicle-facts,
    // other-income-ladder, fixed-assets, input-vat-registration, vat-returns, lease-facts,
    // document-blob-ref, efactura-deadline and expense-asset-link steps follow it — so the assertion moves
    // from "last" to "present at exactly this edge", which is the property this file cares about. The offset
    // below is counted from the END of the chain, so a step appended by a later phase moves it by one; that
    // is the whole point of writing it as an offset rather than a literal index.
    const step = MIGRATION_CHAIN.find((s) => s.name === 'record-currency')!;
    expect(step.from).toBe(DATA_VERSION_RULE_SET_DIGEST);
    expect(step.to).toBe(DATA_VERSION_RECORD_CURRENCY);
    // Brief 76 re-pin (replaced, not deleted): the chain grew by one step again, so the offset from the end
    // moves by one. The property is unchanged — record-currency still sits at exactly this edge, and the
    // offset is written from the END on purpose so a later phase only has to move this one number.
    expect(MIGRATION_CHAIN.indexOf(step)).toBe(MIGRATION_CHAIN.length - 14);
  });

  it('a v9 payload needs one step per version above it', () => {
    const outcome = migratePersistedData(v9Payload());
    expect(outcome.fromVersion).toBe(DATA_VERSION_RULE_SET_DIGEST);
    expect(outcome.toVersion).toBe(CURRENT_DATA_VERSION);
    // PG-5 re-pin: `annual-filing` follows. It renames a collection and opens another; it touches no
    // amount, which is what this file guards.
    expect(outcome.stepsApplied).toEqual([
      'record-currency',
      'annual-filing',
      'activity-family',
      'accommodation-facts',
      'occupancy-sheet',
      'vehicle-facts',
      'other-income-ladder',
      'fixed-assets',
      'input-vat-registration',
    'vat-returns',
    // B-105 — opens `profile.leaseFactsYears` by writing nothing, so it moves no amount: the property this
    // file guards.
    'lease-facts',
    // PG-11 — the same property holds for `document-blob-ref`: a shape declaration that touches no amount.
    'document-blob-ref',
    // B-140 — and for `efactura-deadline`: it retires one settings preference and touches no amount.
    'efactura-deadline',
    'expense-asset-link',
    ]);
  });

  it('a v9 payload keeps its stored digest through the whole chain', () => {
    const stored = v9Payload().snapshots![0]!;
    const outcome = migratePersistedData(v9Payload());
    expect(outcome.data.snapshots![0]!.inputsHash).toBe(stored.inputsHash);
    expect('preMigrationInputsHash' in outcome.data.snapshots![0]!).toBe(false);
  });

  it('a v10 payload runs the annual-filing and activity-family steps, and no amount moves', () => {
    // PG-5 re-pin (replaced, not deleted): v10 used to be the head, so a payload at v10 ran no step at
    // all. It now runs two. The guarded property is intact — the v11 step renames a collection and opens
    // another, the v12 step writes a version and touches no value, and neither moves a money field.
    const atV10 = migrateRecordCurrencyV10(v9Payload());
    const amountsBefore = JSON.stringify(atV10.revenues.map(r => [r.valoareFaraTva, r.tva]));
    const outcome = migratePersistedData(atV10);
    expect(outcome.migrated).toBe(true);
    expect(outcome.stepsApplied).toEqual(['annual-filing', 'activity-family', 'accommodation-facts', 'occupancy-sheet', 'vehicle-facts', 'other-income-ladder', 'fixed-assets', 'input-vat-registration', 'vat-returns', 'lease-facts', // PG-11 — appended after v20; it fills nothing in.
      'document-blob-ref', // B-140 — appended after v21; it retires a preference and moves no amount.
      'efactura-deadline', 'expense-asset-link']);
    expect(JSON.stringify(outcome.data.revenues.map(r => [r.valoareFaraTva, r.tva]))).toBe(amountsBefore);
    expect(outcome.data.version).toBe(CURRENT_DATA_VERSION);
  });

  it('a payload already at the current version runs no step at all', () => {
    const atHead = migratePersistedData(v9Payload()).data;
    const outcome = migratePersistedData(atHead);
    expect(outcome.migrated).toBe(false);
    expect(outcome.stepsApplied).toEqual([]);
  });
});

describe('a profile with no revenues or expenses still migrates cleanly', () => {
  it('stamps the version and invents no records', () => {
    const empty = v9Payload({ revenues: [], expenses: [] });
    const after = migrateRecordCurrencyV10(empty);
    expect(after.revenues).toEqual([]);
    expect(after.expenses).toEqual([]);
    expect(after.version).toBe(DATA_VERSION_RECORD_CURRENCY);
  });

  it('a payload with no `expenses` key at all does not gain one', () => {
    // The key must be genuinely absent, not present-and-`undefined`: a spread that writes `expenses:
    // undefined` keeps the key, and the assertion would then be about the fixture rather than the step.
    const noKey = v9Payload();
    delete noKey.expenses;
    expect('expenses' in noKey).toBe(false);
    const after = migrateRecordCurrencyV10(noKey);
    expect('expenses' in after).toBe(false);
  });
});
