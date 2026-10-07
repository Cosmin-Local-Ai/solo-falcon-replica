/**
 * Tests for the dashboard insights engine (`getInsights`) — Step 30 emission contract:
 *
 * | Source       | Condition                                   | Severity |
 * |--------------|---------------------------------------------|----------|
 * | Threshold    | breached                                      | danger   |
 * | Threshold    | !breached && ratio >= 0.8                    | warning  |
 * | Threshold    | ratio < 0.8                                  | —        |
 * | Threshold    | CASS + CAS both alerting                     | one canonical alert |
 * | Deadline     | daysUntil < 0 / === 0                        | danger   |
 * | Deadline     | 1..30                                        | warning  |
 * | Deadline     | > 30 / non-finite / empty date               | —        |
 * | Reserve      | projectedLiabilityBani > 0 && gapBani > 0   | warning  |
 * | Completeness | missing.length > 0                           | warning  |
 * | Tax          | review_required / computed                   | info     |
 *
 * Invariants: raw keys never leak into user-facing strings, all strings are
 * Romanian, output is sorted danger → warning → info, engine is deterministic.
 */
import { describe, expect, it } from 'vitest';
import { getInsights } from './insights';
import type { Insight, InsightInput } from './insights';
import type { DashboardSnapshot, ExcludedFiscalDate, Threshold } from './aggregation';
import type { TaxEstimateResult } from './tax';
import type { TaxCalculationSnapshot } from './snapshots/types';
import { assessCompleteness } from './completeness';
import type { AppData, SettingsState } from '../data/types';
import type { PfaProfile } from './models';
import { lei, subBani, type Bani, formatBaniRON } from './money';

// Factories

function threshold(overrides: Partial<Threshold> = {}): Threshold {
  return {
    id: 't1',
    label: 'pfa-revenue',
    current: lei(500_000),
    limit: lei(1_000_000),
    ratio: 0.5,
    breached: false,
    ...overrides,
  };
}

type DeadlineEntry = DashboardSnapshot['deadlines'][number];

function deadline(overrides: Partial<DeadlineEntry> = {}): DeadlineEntry {
  return {
    id: 'd1',
    label: 'pfa',
    daysUntil: 10,
    date: '2026-06-01',
    ...overrides,
  };
}

function snapshot(overrides: Partial<DashboardSnapshot> = {}): DashboardSnapshot {
  return {
    asOf: '2026-05-15',
    taxYear: 2026,
    missing: [],
    stale: [],
    deadlines: [],
    thresholds: [],
    taxReserve: {
      projectedLiabilityBani: lei(0),
      targetReserveBani: lei(0),
      currentReserveBani: lei(0),
      gapBani: lei(0),
      coverageMonths: 12,
      projectedQ4LiabilityBani: lei(0),
      taxYear: 2026,
    },
    ...overrides,
  };
}

function input(overrides: Partial<InsightInput> = {}): InsightInput {
  return { snapshot: snapshot(), ...overrides };
}

/** Minimal `computed` tax result — the engine only reads `status` and `output.total`. */
function taxComputed(total: Bani): TaxEstimateResult {
  return {
    status: 'computed',
    lines: [],
    output: { total },
    snapshot: undefined as unknown as TaxCalculationSnapshot,
    bases: { venitulBrut: total, cheltuieliDeductibile: lei(0), venitulNetDinActivitate: total },
  };
}

function taxReviewRequired(reason: string): TaxEstimateResult {
  return { status: 'review_required', reason, lines: [] };
}

// Helpers

function texts(insights: Insight[]): string {
  return insights.map((i) => `${i.title} ${i.description} ${i.action}`).join('\n');
}

// Phase 6 §7 item 5 — the 24 SM CAS ladder step (CF art. 148 alin. (2) lit. b).
// A tier floor is NOT a limit: crossing it raises the MINIMUM CAS base, so the existing
// "a depășit limita fiscală" wording would state the opposite of the law.
describe('tier-floor threshold alerts', () => {
  it('words a crossed tier as a ladder step, never as a limit breach', () => {
    const insights = getInsights(
      input({
        snapshot: snapshot({
          thresholds: [
            threshold({
              id: 'CAS_TIER2_FLOOR',
              affectedTax: 'cas',
              type: 'tier-floor',
              ratio: 1.23,
              breached: true,
            }),
          ],
        }),
      }),
    );

    expect(insights).toHaveLength(1);
    // Nothing went wrong — the contribution is simply computed on a higher floor, so this is not
    // a `danger`.
    expect(insights[0].severity).toBe('warning');
    expect(insights[0].id).toBe('threshold-CAS_TIER2_FLOOR');
    expect(insights[0].title).toContain('Treaptă de calcul depășită');
    expect(insights[0].description).toContain('art. 148 alin. (2) lit. b)');
    expect(texts(insights)).not.toContain('limita fiscală');
  });

  it('warns as the tier approaches, before it is crossed', () => {
    const insights = getInsights(
      input({
        snapshot: snapshot({
          thresholds: [
            threshold({ id: 'CAS_TIER2_FLOOR', affectedTax: 'cas', type: 'tier-floor', ratio: 0.9 }),
          ],
        }),
      }),
    );

    expect(insights).toHaveLength(1);
    expect(insights[0].severity).toBe('warning');
    expect(insights[0].description).toContain('90%');
  });

  it('says nothing while the tier is far away', () => {
    const insights = getInsights(
      input({
        snapshot: snapshot({
          thresholds: [
            threshold({ id: 'CAS_TIER2_FLOOR', affectedTax: 'cas', type: 'tier-floor', ratio: 0.07 }),
          ],
        }),
      }),
    );

    expect(insights).toEqual([]);
  });
});

// Thresholds

describe('thresholds', () => {
  it('emits exactly one danger when a threshold is breached', () => {
    const insights = getInsights(
      input({
        snapshot: snapshot({
          thresholds: [threshold({ id: 'cass', affectedTax: 'cass', ratio: 1.1, breached: true })],
        }),
      }),
    );

    expect(insights).toHaveLength(1);
    expect(insights[0].severity).toBe('danger');
    expect(insights[0].id).toBe('threshold-cass');
    expect(insights[0].title).toContain('Prag depășit');
  });

  it('emits a warning when not breached but ratio >= 0.8', () => {
    const insights = getInsights(
      input({
        snapshot: snapshot({
          thresholds: [threshold({ id: 'cass', affectedTax: 'cass', ratio: 0.85 })],
        }),
      }),
    );

    expect(insights).toHaveLength(1);
    expect(insights[0].severity).toBe('warning');
    expect(insights[0].id).toBe('threshold-cass');
    expect(insights[0].title).toContain('Aproape de prag');
  });

  it('emits a warning at exactly ratio 0.8 (boundary)', () => {
    const insights = getInsights(
      input({
        snapshot: snapshot({
          thresholds: [threshold({ id: 'cass', affectedTax: 'cass', ratio: 0.8 })],
        }),
      }),
    );

    expect(insights).toHaveLength(1);
    expect(insights[0].severity).toBe('warning');
  });

  it('emits nothing when ratio < 0.8', () => {
    const insights = getInsights(
      input({
        snapshot: snapshot({
          thresholds: [threshold({ id: 'cass', affectedTax: 'cass', ratio: 0.79 })],
        }),
      }),
    );

    expect(insights).toEqual([]);
  });

  it('emits danger at exactly ratio 1.0 when breached (boundary)', () => {
    const insights = getInsights(
      input({
        snapshot: snapshot({
          thresholds: [threshold({ id: 'cass', affectedTax: 'cass', ratio: 1.0, breached: true })],
        }),
      }),
    );

    expect(insights).toHaveLength(1);
    expect(insights[0].severity).toBe('danger');
    expect(insights[0].id).toBe('threshold-cass');
  });

  it('canonicalizes CASS + CAS alerts into one (worst severity wins)', () => {
    const insights = getInsights(
      input({
        snapshot: snapshot({
          thresholds: [
            threshold({ id: 'cass', affectedTax: 'cass', ratio: 1.05, breached: true }),
            threshold({ id: 'cas', affectedTax: 'cas', ratio: 0.9 }),
          ],
        }),
      }),
    );

    expect(insights).toHaveLength(1);
    expect(insights[0].severity).toBe('danger');
    expect(insights[0].id).toBe('threshold-cass');
  });

  it('canonicalizes CASS + CAS alerts on a severity tie by highest ratio', () => {
    const insights = getInsights(
      input({
        snapshot: snapshot({
          thresholds: [
            threshold({ id: 'cass', affectedTax: 'cass', ratio: 0.82 }),
            threshold({ id: 'cas', affectedTax: 'cas', ratio: 0.9 }),
          ],
        }),
      }),
    );

    expect(insights).toHaveLength(1);
    expect(insights[0].severity).toBe('warning');
    expect(insights[0].id).toBe('threshold-cas');
  });

  it('keeps CASS and VAT alerts as two distinct insights', () => {
    const insights = getInsights(
      input({
        snapshot: snapshot({
          thresholds: [
            threshold({ id: 'cass', affectedTax: 'cass', ratio: 0.85 }),
            threshold({ id: 'vat', affectedTax: 'vat', ratio: 0.85 }),
          ],
        }),
      }),
    );

    expect(insights).toHaveLength(2);
    expect(insights.map((i) => i.id).sort()).toEqual(['threshold-cass', 'threshold-vat']);
  });
});

// Deadlines

describe('deadlines', () => {
  it('emits danger for an overdue deadline (daysUntil < 0)', () => {
    const insights = getInsights(
      input({
        snapshot: snapshot({
          deadlines: [deadline({ id: 'pfa', label: 'pfa', daysUntil: -3, date: '2026-05-12' })],
        }),
      }),
    );

    expect(insights).toHaveLength(1);
    expect(insights[0].severity).toBe('danger');
    expect(insights[0].title).toContain('Termen depășit');
    expect(insights[0].description).toContain('a expirat pe');
  });

  it('emits danger when daysUntil === 0', () => {
    const insights = getInsights(
      input({
        snapshot: snapshot({
          deadlines: [deadline({ id: 'pfa', label: 'pfa', daysUntil: 0, date: '2026-05-15' })],
        }),
      }),
    );

    expect(insights).toHaveLength(1);
    expect(insights[0].severity).toBe('danger');
    expect(insights[0].title).toContain('Termen depășit');
    expect(insights[0].description).toContain('este astăzi');
  });

  it.each([1, 15, 30])('emits a warning for daysUntil = %i', (daysUntil) => {
    const insights = getInsights(
      input({
        snapshot: snapshot({
          deadlines: [deadline({ id: 'pfa', label: 'pfa', daysUntil })],
        }),
      }),
    );

    expect(insights).toHaveLength(1);
    expect(insights[0].severity).toBe('warning');
    expect(insights[0].title).toContain('Termen apropiat');
  });

  it('emits nothing for daysUntil > 30', () => {
    const insights = getInsights(
      input({
        snapshot: snapshot({
          deadlines: [deadline({ id: 'pfa', label: 'pfa', daysUntil: 31 })],
        }),
      }),
    );

    expect(insights).toEqual([]);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'skips non-finite daysUntil (%f)',
    (daysUntil) => {
      const insights = getInsights(
        input({
          snapshot: snapshot({
            deadlines: [deadline({ id: 'pfa', label: 'pfa', daysUntil })],
          }),
        }),
      );

      expect(insights).toEqual([]);
    },
  );

  it('skips an empty date', () => {
    const insights = getInsights(
      input({
        snapshot: snapshot({
          deadlines: [deadline({ id: 'pfa', label: 'pfa', daysUntil: 5, date: '' })],
        }),
      }),
    );

    expect(insights).toEqual([]);
  });
});

// Tax reserve

describe('tax reserve', () => {
  // These fixtures used to be written in the old cents scale, which is numerically identical to bani
  // (1 ban = 1 cent), so the VALUES here are unchanged by the migration — only the field names and types.
  const reserve = (gapBani: Bani, projectedLiabilityBani: Bani) =>
    snapshot({
      taxReserve: {
        projectedLiabilityBani,
        targetReserveBani: lei(1000),
        currentReserveBani: subBani(lei(1000), gapBani),
        gapBani,
        coverageMonths: 12,
        projectedQ4LiabilityBani: lei(0),
        taxYear: 2026,
      },
    });

  it('emits exactly one warning when projected liability > 0 and gap > 0', () => {
    const insights = getInsights(input({ snapshot: reserve(lei(250), lei(1000)) }));

    expect(insights).toHaveLength(1);
    expect(insights[0].severity).toBe('warning');
    expect(insights[0].id).toBe('reserve');
  });

  it('emits nothing when gapBani === 0', () => {
    expect(getInsights(input({ snapshot: reserve(lei(0), lei(1000)) }))).toEqual([]);
  });

  it('emits nothing when gapBani < 0', () => {
    expect(getInsights(input({ snapshot: reserve(lei(-250), lei(1000)) }))).toEqual([]);
  });

  it('emits nothing when projectedLiabilityBani === 0', () => {
    expect(getInsights(input({ snapshot: reserve(lei(1000), lei(0)) }))).toEqual([]);
  });

  it('emits nothing when projectedLiabilityBani < 0', () => {
    expect(getInsights(input({ snapshot: reserve(lei(250), lei(-1000)) }))).toEqual([]);
  });
});

// Completeness

describe('completeness', () => {
  it('emits one warning with the Romanian label for a known missing key', () => {
    const insights = getInsights(input({ snapshot: snapshot({ missing: ['profile'] }) }));

    expect(insights).toHaveLength(1);
    expect(insights[0].severity).toBe('warning');
    expect(insights[0].id).toBe('completeness');
    expect(insights[0].description).toContain('Profil');
  });

  it('lists multiple known keys with their Romanian labels', () => {
    const insights = getInsights(input({ snapshot: snapshot({ missing: ['profile', 'income'] }) }));

    expect(insights).toHaveLength(1);
    expect(insights[0].description).toContain('Profil');
    expect(insights[0].description).toContain('Venituri înregistrate');
  });

  it('falls back to "date" for unknown keys', () => {
    const insights = getInsights(input({ snapshot: snapshot({ missing: ['totally_unknown_key'] }) }));

    expect(insights).toHaveLength(1);
    expect(insights[0].description).toContain('date');
  });

  it('emits nothing when missing is empty', () => {
    expect(getInsights(input({ snapshot: snapshot({ missing: [] }) }))).toEqual([]);
  });

  it('renders the Romanian label for every one of the 9 completeness keys', () => {
    const labels: Record<string, string> = {
      profile: 'Profil',
      income: 'Venituri înregistrate',
      expenses: 'Cheltuieli înregistrate',
      clients: 'Clienți',
      documents: 'Documente',
      companyDocuments: 'Documente de firmă',
      declarations: 'Declarații',
      statements: 'Declarații fiscale',
      taxEstimate: 'Estimare impozit',
    };

    for (const [key, label] of Object.entries(labels)) {
      const insights = getInsights(input({ snapshot: snapshot({ missing: [key] }) }));
      expect(insights).toHaveLength(1);
      expect(insights[0].severity).toBe('warning');
      expect(insights[0].description).toContain(label);
    }
  });

  it('works with real assessCompleteness output (integration)', () => {
    const emptyData: AppData = {
      profile: null as unknown as PfaProfile,
      revenues: [],
      expenses: [],
      clients: [],
      declarations: [],
      documents: [],
      companyDocs: { im: [], cs: [], tva: [], facturi: [] },
      statements: [],
      snapshots: [],
      settings: {} as SettingsState,
    };

    const report = assessCompleteness(emptyData);
    const missing = report.checks.filter((c) => !c.satisfied).map((c) => c.key);
    expect(missing).toHaveLength(9); // every check fails on empty data

    const insights = getInsights(input({ snapshot: snapshot({ missing }) }));
    expect(insights).toHaveLength(1);
    expect(insights[0].severity).toBe('warning');
    expect(insights[0].id).toBe('completeness');
    // Every Romanian label must appear for the 9 missing keys.
    expect(insights[0].description).toContain('Profil');
    expect(insights[0].description).toContain('Estimare impozit');
  });
});

// Tax

describe('tax', () => {
  it('emits nothing when tax is undefined', () => {
    expect(getInsights(input({ snapshot: snapshot() }))).toEqual([]);
  });

  it('emits exactly one info for review_required, without numbers or the raw reason', () => {
    const reason = 'CAS rule not found for tax year 2026';
    const insights = getInsights(input({ snapshot: snapshot(), tax: taxReviewRequired(reason) }));

    expect(insights).toHaveLength(1);
    expect(insights[0].severity).toBe('info');
    expect(insights[0].id).toBe('tax');
    const text = `${insights[0].title} ${insights[0].description}`;
    expect(text).not.toMatch(/[0-9]/);
    expect(text).not.toContain(reason);
  });

  it('emits exactly one info with the formatted total for a computed tax', () => {
    // 1 234,57 lei is exactly representable as integer bani. The expected string is written out
    // LITERALLY here: this test used to define its own `Intl.NumberFormat` mirror and compare the
    // app's text against that mirror, which meant the suite was asserting a formatter that is not
    // the app's (Phase 10 §2.5 — the mirror is deleted, and a formatter regression can no longer
    // hide behind two copies agreeing with each other).
    const total = lei(1234.57);
    const insights = getInsights(input({ snapshot: snapshot(), tax: taxComputed(total) }));

    expect(insights).toHaveLength(1);
    expect(insights[0].severity).toBe('info');
    expect(insights[0].id).toBe('tax');
    expect(insights[0].description).toContain('1.234,57 RON');
    // the app's own single boundary turns integer bani into exactly that string
    expect(formatBaniRON(total)).toBe('1.234,57 RON');
  });
});

// Invariants

describe('invariants', () => {
  it('never exposes raw key strings in user-facing text', () => {
    const rawKeys = ['profile_field_raw', 'unknown_key_xyz', 'cass-max-raw', 'some-raw-label'];
    const insights = getInsights(
      input({
        snapshot: snapshot({
          missing: ['profile_field_raw', 'unknown_key_xyz'],
          thresholds: [threshold({ id: 't1', label: 'cass-max-raw', affectedTax: 'cass', ratio: 0.9 })],
          deadlines: [deadline({ id: 'd1', label: 'some-raw-label', daysUntil: 5 })],
        }),
      }),
    );

    expect(insights.length).toBeGreaterThan(0);
    const text = texts(insights);
    for (const raw of rawKeys) {
      expect(text).not.toContain(raw);
    }
  });

  it('contains no English leak patterns in user-facing text', () => {
    const englishLeaks = ['Missing', 'Deadline', 'Urgent', 'Warning', 'Approaching'];
    const insights = getInsights(
      input({
        snapshot: snapshot({
          missing: ['profile'],
          thresholds: [threshold({ id: 'cass', affectedTax: 'cass', ratio: 1.1, breached: true })],
          deadlines: [deadline({ id: 'pfa', label: 'pfa', daysUntil: -1, date: '2026-05-14' })],
          taxReserve: {
            projectedLiabilityBani: lei(1000),
            targetReserveBani: lei(1000),
            currentReserveBani: lei(750),
            gapBani: lei(250),
            coverageMonths: 12,
            projectedQ4LiabilityBani: lei(0),
            taxYear: 2026,
          },
        }),
        tax: taxComputed(lei(1234.57)),
      }),
    );

    expect(insights.length).toBeGreaterThan(0);
    const text = texts(insights).toLowerCase();
    for (const word of englishLeaks) {
      expect(text).not.toContain(word.toLowerCase());
    }
  });

  it('sorts danger → warning → info, stable within a severity', () => {
    const insights = getInsights(
      input({
        snapshot: snapshot({
          missing: ['profile'],
          thresholds: [
            threshold({ id: 'cass', affectedTax: 'cass', ratio: 1.1, breached: true }),
            threshold({ id: 'vat', affectedTax: 'vat', ratio: 0.85 }),
          ],
          deadlines: [
            deadline({ id: 'pfa', label: 'pfa', daysUntil: -1, date: '2026-05-14' }),
            deadline({ id: 'vat', label: 'vat', daysUntil: 10 }),
          ],
          taxReserve: {
            projectedLiabilityBani: lei(1000),
            targetReserveBani: lei(1000),
            currentReserveBani: lei(750),
            gapBani: lei(250),
            coverageMonths: 12,
            projectedQ4LiabilityBani: lei(0),
            taxYear: 2026,
          },
        }),
        tax: taxComputed(lei(100)),
      }),
    );

    expect(insights.map((i) => i.severity)).toEqual([
      'danger',
      'danger',
      'warning',
      'warning',
      'warning',
      'warning',
      'info',
    ]);
    // Within warnings: thresholds, deadlines, reserve, completeness (insertion order).
    expect(insights.filter((i) => i.severity === 'warning').map((i) => i.id)).toEqual([
      'threshold-vat',
      'deadline-vat',
      'reserve',
      'completeness',
    ]);
  });

  it('is deterministic for the same input', () => {
    const i = input({
      snapshot: snapshot({
        missing: ['profile'],
        thresholds: [threshold({ id: 'cass', affectedTax: 'cass', ratio: 0.9 })],
        deadlines: [deadline({ id: 'pfa', label: 'pfa', daysUntil: 5 })],
      }),
    });

    expect(getInsights(i)).toEqual(getInsights(i));
  });
});

// ── B-21: the aggregate's exclusion must be visible on the dashboard ────────────

describe('fiscal date integrity insight (B-21)', () => {
  function excluded(overrides: Partial<ExcludedFiscalDate> = {}): ExcludedFiscalDate {
    return {
      id: 'r1',
      kind: 'revenue',
      field: 'date',
      value: '2026-6-1',
      status: 'review_required',
      reason: '„2026-6-1” pe câmpul „date” nu este o dată calendaristică reală',
      ...overrides,
    };
  }

  it('emits nothing when every stored date is usable', () => {
    expect(getInsights(input({ fiscalDateIssues: [] })).map(i => i.id)).not.toContain('fiscal-dates');
    // Callers that pass no report at all are unaffected.
    expect(getInsights(input())).toEqual([]);
  });

  it('emits one urgent row naming the record, the kind and the Romanian field label', () => {
    const insights = getInsights(input({ fiscalDateIssues: [excluded({ field: 'collected' })] }));
    const row = insights.find(i => i.id === 'fiscal-dates');
    expect(row).toBeDefined();
    expect(row!.severity).toBe('danger');
    expect(row!.title).toContain('1 înregistrare are o dată de verificat');
    expect(row!.description).toContain('Venit r1');
    // Raw property names are never rendered.
    expect(row!.description).toContain('data încasării');
    expect(row!.description).not.toContain('collected');
    expect(row!.description).toContain('nu intră în niciun total');
    expect(row!.action).toContain('De verificat');
    expect(row!.action).toContain('nu a fost modificată automat');
  });

  it('collapses many bad records into one row, with the count and the remainder named', () => {
    const issues = [
      excluded({ id: 'r1' }),
      excluded({ id: 'r2' }),
      excluded({ id: 'e1', kind: 'expense', field: 'paid', value: '' }),
      excluded({ id: 'r3', value: '2026-13-01' }),
    ];
    const row = getInsights(input({ fiscalDateIssues: issues })).find(i => i.id === 'fiscal-dates')!;
    // One row per defect class, not one per record: a bad import must not bury every other insight.
    expect(getInsights(input({ fiscalDateIssues: issues })).filter(i => i.id === 'fiscal-dates')).toHaveLength(1);
    expect(row.title).toContain('4 înregistrări au o dată de verificat');
    expect(row.description).toContain('Venit r1');
    expect(row.description).toContain('Cheltuială e1');
    expect(row.description).toContain('și încă 1');
    expect(row.description).not.toContain('r3');
  });

  it('sorts ahead of warnings, because a silently missing total is the more urgent defect', () => {
    const insights = getInsights(
      input({
        snapshot: snapshot({ missing: ['profile'] }),
        fiscalDateIssues: [excluded()],
      }),
    );
    expect(insights.map(i => i.id)).toEqual(['fiscal-dates', 'completeness']);
  });
});
