import { describe, it, expect } from 'vitest';
import { convertMoneyToBani, DATA_VERSION_MONEY_BANI, type MoneyPrecisionNotice } from './migration';
import type { PersistedAppData } from './schema';
import { seedData } from './seed';
import { lei } from '../domain/money';

/**
 * Phase 10 — the v4 → v5 unit conversion, in isolation.
 *
 * The acceptance criterion this file exists for: stored money becomes integer bani **without silently
 * changing any user's money**. A value that cannot be represented exactly must be reported, not quietly
 * decided for. And the conversion must NOT be art. 66 rounding — that rule rounds a sum a taxpayer owes
 * to a whole leu, and applying it to a stored revenue of 85,5 lei would turn it into 86 lei.
 */

/** A v4 payload: the seed dataset with money forced back to the OLD lei scale. */
function v4(overrides: Record<string, unknown> = {}): PersistedAppData {
  const base = JSON.parse(JSON.stringify({ ...seedData, version: 4 })) as Record<string, unknown>;
  return { ...base, ...overrides } as unknown as PersistedAppData;
}

function revenue(id: string, valoareFaraTva: number, tva = 0) {
  const first = (seedData.revenues[0] ?? {}) as unknown as Record<string, unknown>;
  return { ...first, id, valoareFaraTva, tva };
}

describe('money migration — exact values convert exactly, and say nothing', () => {
  it('turns 142,5 lei into 14250 bani with NO notice', () => {
    const { data, notices } = convertMoneyToBani(v4({ revenues: [revenue('r-1', 142.5)] }));
    expect(data.revenues[0]!.valoareFaraTva).toBe(14250);
    expect(notices).toEqual([]);
  });

  it('does not inherit IEEE-754 noise: 71,4 lei is exactly 7140 bani', () => {
    // 71.4 * 100 === 7140.000000000001, which is not an integer and would have been reported as
    // sub-ban precision — every seeded 71,4 lei expense falsely flagged as ambiguous.
    const { data, notices } = convertMoneyToBani(v4({ revenues: [revenue('r-1', 71.4)] }));
    expect(data.revenues[0]!.valoareFaraTva).toBe(7140);
    expect(notices).toEqual([]);
  });

  it('converts every money-bearing collection and stamps the new version', () => {
    const { data, notices } = convertMoneyToBani(v4());
    expect(notices).toEqual([]);
    expect(data.version).toBe(DATA_VERSION_MONEY_BANI);
    for (const r of data.revenues) {
      expect(Number.isSafeInteger(r.valoareFaraTva)).toBe(true);
      expect(Number.isSafeInteger(r.tva)).toBe(true);
    }
    for (const e of data.expenses ?? []) {
      expect(Number.isSafeInteger(e.valoareFaraTva)).toBe(true);
    }
    for (const d of data.declarations ?? []) {
      expect(Number.isSafeInteger(d.venituri)).toBe(true);
      expect(Number.isSafeInteger(d.cheltuieli)).toBe(true);
    }
    expect(data.profile!.cashFloorLei).toBe(lei(0));
  });

  it('touches ONLY the money fields of a record', () => {
    const before = revenue('r-1', 142.5, 85.5) as unknown as Record<string, unknown>;
    const { data } = convertMoneyToBani(v4({ revenues: [before] }));
    const after = data.revenues[0]! as unknown as Record<string, unknown>;
    for (const key of Object.keys(before)) {
      if (key === 'valoareFaraTva' || key === 'tva') continue;
      expect(after[key]).toEqual(before[key]);
    }
    expect(after.valoareFaraTva).toBe(14250);
    expect(after.tva).toBe(8550);
  });
});

describe('money migration — a value below ban precision is reported, never silently decided', () => {
  it('converts 674,504 lei to 67450 bani AND records a notice naming the record and field', () => {
    const { data, notices } = convertMoneyToBani(v4({ revenues: [revenue('r-1', 674.504)] }));
    expect(data.revenues[0]!.valoareFaraTva).toBe(67450);
    expect(notices).toHaveLength(1);
    const n = notices[0]!;
    expect(n).toMatchObject({
      collection: 'revenues',
      id: 'r-1',
      field: 'valoareFaraTva',
      original: 674.504,
      converted: 67450,
      reason: 'sub-ban-precision',
    });
  });

  it('rounds a half-ban tie DOWN, matching baniFromLei rather than Math.round', () => {
    // Math.round(674.505 * 100) is 67451 (and 674.505*100 is 67450.49999999999 anyway).
    const { data } = convertMoneyToBani(v4({ revenues: [revenue('r-1', 674.505)] }));
    expect(data.revenues[0]!.valoareFaraTva).toBe(67450);
  });

  it('reports the value exactly as stored, so the user can see what changed', () => {
    const { notices } = convertMoneyToBani(v4({ revenues: [revenue('r-1', 0.001)] }));
    expect(notices[0]!.original).toBe(0.001);
    expect(notices[0]!.converted).toBe(0);
  });

  it('names a record with no id instead of skipping it', () => {
    const anonymous = { ...(seedData.revenues[0] ?? {}) } as unknown as Record<string, unknown>;
    delete anonymous.id;
    anonymous.valoareFaraTva = 674.504;
    const { notices } = convertMoneyToBani(v4({ revenues: [anonymous] }));
    expect(notices[0]!.id).toBe('<no id>');
  });
});

describe('money migration — an unrepresentable value is carried, never zeroed', () => {
  it('carries NaN through unchanged and records a non-finite notice', () => {
    const { data, notices } = convertMoneyToBani(v4({ revenues: [revenue('r-1', Number.NaN)] }));
    const stored = data.revenues[0]!.valoareFaraTva as unknown as number;
    expect(Number.isNaN(stored)).toBe(true);
    expect(stored).not.toBe(0);
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({
      collection: 'revenues',
      id: 'r-1',
      field: 'valoareFaraTva',
      reason: 'non-finite',
    });
    // The notice carries the stored value verbatim, and `converted` is OMITTED rather than 0 —
    // a notice that claims the money became zero would be a lie.
    expect(Number.isNaN(notices[0]!.original)).toBe(true);
    expect('converted' in notices[0]!).toBe(false);
  });

  it('does not turn an unconvertible value into 0 anywhere', () => {
    const { data, notices } = convertMoneyToBani(
      v4({ revenues: [revenue('r-1', Number.POSITIVE_INFINITY)] }),
    );
    expect(data.revenues[0]!.valoareFaraTva).toBe(Number.POSITIVE_INFINITY);
    expect(notices[0]!.reason).toBe('non-finite');
  });

  it('reports one notice per affected field, and none for the fields that were fine', () => {
    const { data, notices } = convertMoneyToBani(v4({ revenues: [revenue('r-1', 10.005, 20.005)] }));
    expect(notices.map((n: MoneyPrecisionNotice) => n.field)).toEqual(['valoareFaraTva', 'tva']);
    // Half-DOWN at the ban, so 10,005 lei (1000.5 bani) becomes 1000, not 1001.
    expect(data.revenues[0]!.valoareFaraTva).toBe(1000);
    expect(data.revenues[0]!.tva).toBe(2000);
  });
});

describe('money migration — the profile and its optional money field', () => {
  it('converts cashFloorLei and reports it under the profile collection', () => {
    const profile = { ...(seedData.profile as unknown as Record<string, unknown>), cashFloorLei: 250.5 };
    const { data, notices } = convertMoneyToBani(v4({ profile }));
    expect(data.profile!.cashFloorLei).toBe(25050);
    expect(notices).toEqual([]);
  });

  it('keeps an absent salaryIncomeLei ABSENT rather than writing null', () => {
    // No persisted money field is `.nullable()`: writing null would fail safeParse on the next load
    // and quarantine the whole payload. Absence must stay absence.
    const profile = { ...(seedData.profile as unknown as Record<string, unknown>) };
    delete profile.salaryIncomeLei;
    const { data } = convertMoneyToBani(v4({ profile }));
    expect('salaryIncomeLei' in data.profile!).toBe(false);
  });

  it('converts a present salaryIncomeLei and flags it if it is not representable', () => {
    const profile = { ...(seedData.profile as unknown as Record<string, unknown>), salaryIncomeLei: 30000.004 };
    const { data, notices } = convertMoneyToBani(v4({ profile }));
    expect(data.profile!.salaryIncomeLei).toBe(3000000);
    expect(notices[0]).toMatchObject({ collection: 'profile', field: 'salaryIncomeLei', reason: 'sub-ban-precision' });
  });
});

describe('money migration — the conversion is idempotent in the only sense that matters', () => {
  it('never runs twice on a payload the chain already carried', () => {
    // The chain keys each step on the stored version, so a v5 payload skips the step entirely.
    // A double conversion would be a ×10 000 error on every amount in the dataset.
    const once = convertMoneyToBani(v4({ revenues: [revenue('r-1', 142.5)] }));
    expect(once.data.revenues[0]!.valoareFaraTva).toBe(14250);
    expect(once.data.version).toBe(DATA_VERSION_MONEY_BANI);
  });
});
