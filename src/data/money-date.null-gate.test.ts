import { describe, expect, it } from 'vitest';
import { CURRENT_DATA_VERSION, DATA_VERSION_RECORD_CURRENCY, migratePersistedData } from './migration';
import { expenseSchema, parseAppDataResult, revenueSchema, type PersistedAppData } from './schema';
import { seedData } from './seed';

/**
 * B-159 — the load gate has to name the declared non-movement before anything reads it.
 *
 * `collected: null` / `paid: null` is the state that keeps a sum out of the base. Zod STRIPS undeclared
 * keys silently, so a gate that accepts only `string` would erase the declaration on the next load and
 * the record would revert to the document-date reading — the exact defect B-159 closes, reintroduced by
 * the persistence layer with no test failing. This file is the test that fails.
 *
 * House pattern: `stored-status.transmisa.test.ts`. A real payload at a real pre-step version, the gate
 * first, then the chain.
 */

function payloadAt(version: number, overrides: Record<string, unknown> = {}): PersistedAppData {
  return {
    version,
    profile: seedData.profile,
    revenues: seedData.revenues,
    expenses: seedData.expenses,
    clients: [],
    documents: [],
    companyDocs: { im: [], cs: [], tva: [], facturi: [] },
    statements: [],
    snapshots: [],
    settings: seedData.settings,
    reservedAmount: null,
    ...overrides,
  } as unknown as PersistedAppData;
}

const UNCOLLECTED = { ...seedData.revenues[0], id: 'r-b159', collected: null };
const UNPAID = { ...seedData.expenses[0], id: 'e-b159', paid: null };

describe('B-159 — the declared non-movement survives the load gate', () => {
  it('the record schemas accept null on the money date, and still reject a non-date', () => {
    expect(revenueSchema.safeParse({ ...UNCOLLECTED }).success).toBe(true);
    expect(expenseSchema.safeParse({ ...UNPAID }).success).toBe(true);
    // Widening to nullable must not have widened to "anything": `''` is not a calendar date and the
    // forms store an empty input as an ABSENT key, never as null or ''.
    expect(revenueSchema.safeParse({ ...UNCOLLECTED, collected: 5 }).success).toBe(false);
    expect(expenseSchema.safeParse({ ...UNPAID, paid: {} }).success).toBe(false);
  });

  it('a payload carrying the declaration parses, the gate KEEPS it, and the chain preserves it', () => {
    const raw = JSON.stringify(
      payloadAt(DATA_VERSION_RECORD_CURRENCY, { revenues: [UNCOLLECTED], expenses: [UNPAID] }),
    );

    const parsed = parseAppDataResult(raw);
    expect(parsed.ok).toBe(true);
    // The assertion a silent strip would break.
    expect(parsed.ok && parsed.data.revenues?.[0]?.collected).toBeNull();
    expect(parsed.ok && parsed.data.expenses?.[0]?.paid).toBeNull();

    const outcome = migratePersistedData(parsed.ok ? parsed.data : ({} as PersistedAppData));
    expect(outcome.toVersion).toBe(CURRENT_DATA_VERSION);
    // No step invents a money date: the declaration reaches the read side as the person wrote it.
    expect(outcome.data.revenues.find(r => r.id === 'r-b159')?.collected).toBeNull();
    expect((outcome.data.expenses ?? []).find(e => e.id === 'e-b159')?.paid).toBeNull();
  });

  it('absence is still absence: a payload with no money-date key loads with no money-date key', () => {
    // The other half of the fix. Collapsing absence into the declared state would have deleted the seed
    // register from the base — the regression the 311.200 pin guards.
    const raw = JSON.stringify(payloadAt(DATA_VERSION_RECORD_CURRENCY));
    const parsed = parseAppDataResult(raw);
    expect(parsed.ok).toBe(true);
    const outcome = migratePersistedData(parsed.ok ? parsed.data : ({} as PersistedAppData));
    for (const r of outcome.data.revenues) expect('collected' in r).toBe(false);
    for (const e of outcome.data.expenses ?? []) expect('paid' in e).toBe(false);
  });
});
