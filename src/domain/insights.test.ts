import { describe, it, expect } from 'vitest';
import { buildInsights } from './insights';
import type {
  Insight,
  InsightEventType,
  InsightInput,
  InsightPriority,
  InsightSeverity,
} from './insights';
import type { DashboardSnapshot, Threshold } from './aggregation';
import type { Expense } from '../data/types';

// ── helpers ──────────────────────────────────────────────────────────

function expense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'e1',
    tip: 'factura',
    nr: 'F1',
    date: '2026-05-10',
    furnizor: 'Test',
    cui: 'RO123',
    valoareFaraTva: 10000,
    tva: 1900,
    status: 'inregistrata',
    ...overrides,
  };
}

function threshold(overrides: Partial<Threshold> = {}): Threshold {
  return {
    id: 't1',
    label: 'Test threshold',
    current: 500000,
    limit: 1000000,
    ratio: 0.5,
    breached: false,
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
      projectedLiabilityCents: 0,
      targetReserveCents: 0,
      currentReserveCents: 0,
      gapCents: 0,
      coverageMonths: 12,
      projectedQ4LiabilityCents: 0,
      taxYear: 2026,
    },
    ...overrides,
  };
}

function input(overrides: Partial<InsightInput> = {}): InsightInput {
  return {
    snapshot: snapshot(),
    ...overrides,
  };
}

function find(insights: Insight[], eventType: string): Insight | undefined {
  return insights.find((i) => i.eventType === eventType);
}

// ── 1. INCOME_THRESHOLD_APPROACHING ──────────────────────────────────

describe('INCOME_THRESHOLD_APPROACHING', () => {
  it('emits warning when income threshold ratio is between 0.8 and 0.95', () => {
    const snap = snapshot({
      thresholds: [threshold({ type: 'income', ratio: 0.85, current: 850000, limit: 1000000 })],
    });
    const result = buildInsights(input({ snapshot: snap }));
    const insight = find(result, 'INCOME_THRESHOLD_APPROACHING');
    expect(insight).toBeDefined();
    expect(insight!.severity).toBe('warning');
    expect(insight!.priority).toBe('medium');
  });

  it('emits danger when income threshold ratio is >= 0.95', () => {
    const snap = snapshot({
      thresholds: [threshold({ type: 'income', ratio: 0.97, current: 970000, limit: 1000000 })],
    });
    const result = buildInsights(input({ snapshot: snap }));
    const insight = find(result, 'INCOME_THRESHOLD_APPROACHING');
    expect(insight).toBeDefined();
    expect(insight!.severity).toBe('danger');
    expect(insight!.priority).toBe('high');
  });

  it('does not emit when ratio is below 0.8', () => {
    const snap = snapshot({
      thresholds: [threshold({ type: 'income', ratio: 0.5, current: 500000, limit: 1000000 })],
    });
    const result = buildInsights(input({ snapshot: snap }));
    expect(find(result, 'INCOME_THRESHOLD_APPROACHING')).toBeUndefined();
  });

  it('does not emit when threshold is breached', () => {
    const snap = snapshot({
      thresholds: [threshold({ type: 'income', ratio: 1.1, breached: true, current: 1100000, limit: 1000000 })],
    });
    const result = buildInsights(input({ snapshot: snap }));
    expect(find(result, 'INCOME_THRESHOLD_APPROACHING')).toBeUndefined();
  });

  it('does not emit for vat-type thresholds', () => {
    const snap = snapshot({
      thresholds: [threshold({ type: 'vat', ratio: 0.9, current: 900000, limit: 1000000 })],
    });
    const result = buildInsights(input({ snapshot: snap }));
    expect(find(result, 'INCOME_THRESHOLD_APPROACHING')).toBeUndefined();
  });
});

// ── 2. MISSING_DOCUMENTS ─────────────────────────────────────────────

describe('MISSING_DOCUMENTS', () => {
  it('emits one insight per missing field', () => {
    const snap = snapshot({ missing: ['cui', 'adresa'] });
    const result = buildInsights(input({ snapshot: snap }));
    const missing = result.filter((i) => i.eventType === 'MISSING_DOCUMENTS');
    expect(missing).toHaveLength(2);
    expect(missing[0].id).toBe('missing:cui');
    expect(missing[1].id).toBe('missing:adresa');
  });

  it('emits warning severity and high priority', () => {
    const snap = snapshot({ missing: ['cui'] });
    const result = buildInsights(input({ snapshot: snap }));
    const insight = find(result, 'MISSING_DOCUMENTS');
    expect(insight!.severity).toBe('warning');
    expect(insight!.priority).toBe('high');
  });

  it('does not emit when no fields are missing', () => {
    const snap = snapshot({ missing: [] });
    const result = buildInsights(input({ snapshot: snap }));
    expect(find(result, 'MISSING_DOCUMENTS')).toBeUndefined();
  });
});

// ── 3. VAT_THRESHOLD_APPROACHING ─────────────────────────────────────

describe('VAT_THRESHOLD_APPROACHING', () => {
  it('emits warning when vat threshold ratio is between 0.8 and 0.95', () => {
    const snap = snapshot({
      thresholds: [threshold({ type: 'vat', ratio: 0.85, current: 850000, limit: 1000000 })],
    });
    const result = buildInsights(input({ snapshot: snap }));
    const insight = find(result, 'VAT_THRESHOLD_APPROACHING');
    expect(insight).toBeDefined();
    expect(insight!.severity).toBe('warning');
    expect(insight!.priority).toBe('medium');
  });

  it('emits danger when vat threshold threshold ratio is >= 0.95', () => {
    const snap = snapshot({
      thresholds: [threshold({ type: 'vat', ratio: 0.96, current: 960000, limit: 1000000 })],
    });
    const result = buildInsights(input({ snapshot: snap }));
    const insight = find(result, 'VAT_THRESHOLD_APPROACHING');
    expect(insight).toBeDefined();
    expect(insight!.severity).toBe('danger');
    expect(insight!.priority).toBe('high');
  });

  it('does not emit when ratio is below 0.8', () => {
    const snap = snapshot({
      thresholds: [threshold({ type: 'vat', ratio: 0.5, current: 500000, limit: 1000000 })],
    });
    const result = buildInsights(input({ snapshot: snap }));
    expect(find(result, 'VAT_THRESHOLD_APPROACHING')).toBeUndefined();
  });

  it('does not emit when threshold is breached', () => {
    const snap = snapshot({
      thresholds: [threshold({ type: 'vat', ratio: 1.2, breached: true, current: 1200000, limit: 1000000 })],
    });
    const result = buildInsights(input({ snapshot: snap }));
    expect(find(result, 'VAT_THRESHOLD_APPROACHING')).toBeUndefined();
  });
});

// ── 4. DEADLINE_APPROACHING ──────────────────────────────────────

describe('DEADLINE_APPROACHING', () => {
  it('emits danger when deadline is within 7 days', () => {
    const snap = snapshot({
      deadlines: [{
        id: 'd1',
        label: 'TVA 3Q',
        date: '2026-05-20',
        daysUntil: 5,
      }],
    });
    const result = buildInsights(input({ snapshot: snap }));
    const insight = find(result, 'DEADLINE_APPROACHING');
    expect(insight).toBeDefined();
    expect(insight!.severity).toBe('danger');
    expect(insight!.priority).toBe('high');
  });

  it('emits warning when deadline is within 30 days', () => {
    const snap = snapshot({
      deadlines: [{
        id: 'd1',
        label: 'TVA 3Q',
        date: '2026-06-10',
        daysUntil: 25,
      }],
    });
    const result = buildInsights(input({ snapshot: snap }));
    const insight = find(result, 'DEADLINE_APPROACHING');
    expect(insight).toBeDefined();
    expect(insight!.severity).toBe('warning');
    expect(insight!.priority).toBe('medium');
  });

  it('does not emit when deadline is > 30 days away', () => {
    const snap = snapshot({
      deadlines: [{
        id: 'd1',
        label: 'TVA 3Q',
        date: '2026-07-15',
        daysUntil: 60,
      }],
    });
    const result = buildInsights(input({ snapshot: snap }));
    expect(find(result, 'DEADLINE_APPROACHING')).toBeUndefined();
  });
});

// ── 5. TAX_ESTIMATE_CHANGED ──────────────────────────────────────────

describe('TAX_ESTIMATE_CHANGED', () => {
  it('does not emit when estimate increased < 10%', () => {
    const result = buildInsights(input({
      currentTaxEstimateCents: 105000,
      previousTaxEstimateCents: 100000,
    }));
    expect(result.filter((i) => i.eventType === 'TAX_ESTIMATE_CHANGED')).toHaveLength(0);
  });

  it('emits warning when estimate increased > 10%', () => {
    const result = buildInsights(input({
      currentTaxEstimateCents: 115000,
      previousTaxEstimateCents: 100000,
    }));
    const insight = find(result, 'TAX_ESTIMATE_CHANGED');
    expect(insight).toBeDefined();
    expect(insight!.severity).toBe('warning');
    expect(insight!.priority).toBe('high');
  });

  it('does not emit when estimate decreased < 10%', () => {
    const result = buildInsights(input({
      currentTaxEstimateCents: 95000,
      previousTaxEstimateCents: 100000,
    }));
    expect(result.filter((i) => i.eventType === 'TAX_ESTIMATE_CHANGED')).toHaveLength(0);
  });

  it('emits warning when estimate decreased > 10%', () => {
    const result = buildInsights(input({
      currentTaxEstimateCents: 85000,
      previousTaxEstimateCents: 100000,
    }));
    const insight = find(result, 'TAX_ESTIMATE_CHANGED');
    expect(insight).toBeDefined();
    expect(insight!.severity).toBe('warning');
    expect(insight!.priority).toBe('high');
  });

  it('does not emit when estimates are equal', () => {
    const result = buildInsights(input({
      currentTaxEstimateCents: 100000,
      previousTaxEstimateCents: 100000,
    }));
    expect(find(result, 'TAX_ESTIMATE_CHANGED')).toBeUndefined();
  });

  it('does not emit when previous is 0', () => {
    const result = buildInsights(input({
      currentTaxEstimateCents: 100000,
      previousTaxEstimateCents: 0,
    }));
    expect(find(result, 'TAX_ESTIMATE_CHANGED')).toBeUndefined();
  });

  it('does not emit when previous is undefined', () => {
    const result = buildInsights(input({
      currentTaxEstimateCents: 100000,
    }));
    expect(find(result, 'TAX_ESTIMATE_CHANGED')).toBeUndefined();
  });
});

// ── 6. LEGISLATION_CHANGED ───────────────────────────────────────────

describe('LEGISLATION_CHANGED', () => {
  it('emits info when legislation change date is provided', () => {
    const result = buildInsights(input({
      legislationChangeDate: '2026-05-01',
    }));
    const insight = find(result, 'LEGISLATION_CHANGED');
    expect(insight).toBeDefined();
    expect(insight!.severity).toBe('info');
    expect(insight!.priority).toBe('low');
    expect(insight!.description).toContain('2026-05-01');
  });

  it('does not emit when no legislation change date', () => {
    const result = buildInsights(input({}));
    expect(find(result, 'LEGISLATION_CHANGED')).toBeUndefined();
  });
});

// ── 7. PROJECTED_REVENUE_DROP ────────────────────────────────────────

describe('PROJECTED_REVENUE_DROP', () => {
  it('emits warning when revenue dropped > 30%', () => {
    const result = buildInsights(input({
      currentMonthRevenueCents: 70000,
      previousMonthRevenueCents: 100000,
    }));
    const insight = find(result, 'PROJECTED_REVENUE_DROP');
    expect(insight).toBeDefined();
    expect(insight!.severity).toBe('warning');
    expect(insight!.priority).toBe('high');
  });

  it('does not emit when revenue increased', () => {
    const result = buildInsights(input({
      currentMonthRevenueCents: 130000,
      previousMonthRevenueCents: 100000,
    }));
    expect(find(result, 'PROJECTED_REVENUE_DROP')).toBeUndefined();
  });

  it('does not emit when change is < 30%', () => {
    const result = buildInsights(input({
      currentMonthRevenueCents: 90000,
      previousMonthRevenueCents: 100000,
    }));
    expect(find(result, 'PROJECTED_REVENUE_DROP')).toBeUndefined();
  });

  it('does not emit when previous revenue is 0', () => {
    const result = buildInsights(input({
      currentMonthRevenueCents: 100000,
      previousMonthRevenueCents: 0,
    }));
    expect(find(result, 'PROJECTED_REVENUE_DROP')).toBeUndefined();
  });

  it('does not emit when previous revenue is undefined', () => {
    const result = buildInsights(input({
      currentMonthRevenueCents: 100000,
    }));
    expect(find(result, 'PROJECTED_REVENUE_DROP')).toBeUndefined();
  });
});

// ── 8. STRUCTURE_COMPARISON_RELEVANT ─────────────────────────────────

describe('STRUCTURE_COMPARISON_RELEVANT', () => {
  it('emits info when CASS threshold is within 20% of the limit', () => {
    const snap = snapshot({
      thresholds: [threshold({ affectedTax: 'cass', ratio: 0.85, current: 850000, limit: 1000000 })],
    });
    const result = buildInsights(input({ snapshot: snap }));
    const insight = find(result, 'STRUCTURE_COMPARISON_RELEVANT');
    expect(insight).toBeDefined();
    expect(insight!.severity).toBe('info');
    expect(insight!.priority).toBe('medium');
  });

  it('does not emit when expenses are empty', () => {
    const result = buildInsights(input({ expenses: [] }));
    expect(find(result, 'STRUCTURE_COMPARISON_RELEVANT')).toBeUndefined();
  });

  it('does not emit when expenses are undefined', () => {
    const result = buildInsights(input({}));
    expect(find(result, 'STRUCTURE_COMPARISON_RELEVANT')).toBeUndefined();
  });
});

// ── 9. RESERVE_BEHIND ────────────────────────────────────────────────

describe('RESERVE_BEHIND', () => {
  it('emits warning when gap is > 0', () => {
    const snap = snapshot({
      taxReserve: {
        projectedLiabilityCents: 100000,
        targetReserveCents: 120000,
        currentReserveCents: 50000,
        gapCents: 70000,
        coverageMonths: 6,
        projectedQ4LiabilityCents: 30000,
        taxYear: 2026,
      },
    });
    const result = buildInsights(input({ snapshot: snap }));
    const insight = find(result, 'RESERVE_BEHIND');
    expect(insight).toBeDefined();
    expect(insight!.severity).toBe('warning');
    expect(insight!.priority).toBe('high');
  });

  it('does not emit when gap is 0', () => {
    const snap = snapshot({
      taxReserve: {
        projectedLiabilityCents: 100000,
        targetReserveCents: 100000,
        currentReserveCents: 100000,
        gapCents: 0,
        coverageMonths: 12,
        projectedQ4LiabilityCents: 0,
        taxYear: 2026,
      },
    });
    const result = buildInsights(input({ snapshot: snap }));
    expect(result.filter((i) => i.eventType === 'RESERVE_BEHIND')).toHaveLength(0);
  });

  it('emits warning when reserve coverage is below 3 months', () => {
    const snap = snapshot({
      taxReserve: {
        projectedLiabilityCents: 100000,
        targetReserveCents: 120000,
        currentReserveCents: 50000,
        gapCents: 0,
        coverageMonths: 2,
        projectedQ4LiabilityCents: 0,
        taxYear: 2026,
      },
    });
    const result = buildInsights(input({ snapshot: snap }));
    const insight = find(result, 'RESERVE_BEHIND');
    expect(insight).toBeDefined();
    expect(insight!.severity).toBe('warning');
    expect(insight!.priority).toBe('high');
  });
});

// ── 10. SEVERITY_PRIORITY_CONSISTENCY ────────────────────────────────

describe('SEVERITY_PRIORITY_CONSISTENCY', () => {
  it('danger always has high priority', () => {
    const snap = snapshot({
      thresholds: [threshold({ type: 'income', ratio: 0.97, current: 970000, limit: 1000000 })],
    });
    const result = buildInsights(input({ snapshot: snap }));
    for (const insight of result) {
      if (insight.severity === 'danger') {
        expect(insight.priority).toBe('high');
      }
    }
  });

  it('warning has medium or high priority', () => {
    const snap = snapshot({
      thresholds: [threshold({ type: 'income', ratio: 0.85, current: 850000, limit: 1000000 })],
      missing: ['cui'],
      stale: ['expenses'],
    });
    const result = buildInsights(input({ snapshot: snap }));
    for (const insight of result) {
      if (insight.severity === 'warning') {
        expect(['medium', 'high']).toContain(insight.priority);
      }
    }
  });

  it('info always has low priority', () => {
    const result = buildInsights(input({
      currentTaxEstimateCents: 105000,
      previousTaxEstimateCents: 100000,
    }));
    for (const insight of result) {
      if (insight.severity === 'info') {
        expect(insight.priority).toBe('low');
      }
    }
  });
});

// ── 11. UNUSUAL_EXPENSE ─────────────────────────────────────────────

describe('UNUSUAL_EXPENSE', () => {
  it('flag unusual expense', () => {
    const data = input({
      expenses: [
        ...Array.from({ length: 10 }, (_, i) =>
          expense({ id: `e-small-${i}`, valoareFaraTva: 10000, tva: 0 }),
        ),
        expense({ id: 'e-big', valoareFaraTva: 1000000, tva: 0 }),
      ],
    });
    const result = buildInsights(data);
    const unusual = result.filter((i) => i.eventType === 'UNUSUAL_EXPENSE');
    expect(unusual).toHaveLength(1);
    const insight = unusual[0]!;
    expect(insight.severity).toBe('danger');
    expect(insight.priority).toBe('high');
    expect(insight.conditions.amountCents).toBe(1000000);
    expect(insight.conditions.meanCents).toBe(100000);
    expect(insight.conditions.stdCents).toBe(284605);
  });
});

// ── 12. PROJECTED_TAX_INCREASE ───────────────────────────────────────

describe('PROJECTED_TAX_INCREASE', () => {
  it('flag projected tax increase', () => {
    const data = input({
      previousTaxEstimateCents: 1000000,
      currentTaxEstimateCents: 1600000,
    });
    const result = buildInsights(data);
    const increases = result.filter((i) => i.eventType === 'PROJECTED_TAX_INCREASE');
    expect(increases).toHaveLength(1);
    const insight = increases[0]!;
    expect(insight.severity).toBe('warning');
    expect(insight.priority).toBe('high');
    expect(insight.conditions.increaseCents).toBe(600000);
  });
});

// ── 13. DETERMINISM ──────────────────────────────────────────────────

describe('DETERMINISM', () => {
  it('is deterministic', () => {
    const data = input({
      snapshot: snapshot({
        deadlines: [
          { id: 'd1', label: 'TVA 3Q', date: '2026-05-20', daysUntil: 5 },
        ],
        missing: ['cui'],
      }),
      currentTaxEstimateCents: 105000,
      previousTaxEstimateCents: 100000,
    });
    const a = buildInsights(data);
    const b = buildInsights(data);
    expect(a).toEqual(b);
  });
});

// ── 14. DATA_INCOMPLETE ──────────────────────────────────────────────

describe('DATA_INCOMPLETE', () => {
  it('emits warning when profile fields are missing', () => {
    const data = input({
      snapshot: snapshot({ missing: ['cui'] }),
    });
    const result = buildInsights(data);
    const incomplete = result.filter((i) => i.eventType === 'DATA_INCOMPLETE');
    expect(incomplete).toHaveLength(1);
    const insight = incomplete[0]!;
    expect(insight.severity).toBe('warning');
    expect(insight.priority).toBe('medium');
    expect(insight.conditions.missingCount).toBe(1);
    expect(insight.conditions.fields).toBe('cui');
  });

  it('does not emit when only stale data is present', () => {
    const data = input({
      snapshot: snapshot({ stale: ['expenses'] }),
    });
    const result = buildInsights(data);
    const incomplete = result.filter((i) => i.eventType === 'DATA_INCOMPLETE');
    expect(incomplete).toHaveLength(0);
  });
});

// ── 15. NO_FABRICATION ───────────────────────────────────────────────

describe('NO_FABRICATION', () => {
  it('returns no insights for a clean snapshot with no optional context', () => {
    // Clean snapshot: no thresholds, no deadlines, no missing fields, no
    // reserve gap, full coverage — and no estimate/revenue/legislation/expense
    // context. Nothing may be fabricated.
    const result = buildInsights(input({}));
    expect(result).toEqual([]);
  });
});

// ── 16. CONDITIONS_CONTENT ───────────────────────────────────────────

describe('CONDITIONS_CONTENT', () => {
  it('conditions is a stable Record with exact keys per event type and no personal data', () => {
    const snap = snapshot({
      deadlines: [{ id: 'd1', label: 'TVA 3Q', date: '2026-05-20', daysUntil: 5 }],
      missing: ['cui'],
    });
    const result = buildInsights(input({ snapshot: snap }));
    const deadline = find(result, 'DEADLINE_APPROACHING')!;
    // Exact key set for DEADLINE_APPROACHING — stable, no personal data.
    expect(Object.keys(deadline.conditions).sort()).toEqual(['date', 'daysUntil']);
    expect(deadline.conditions).toEqual({ daysUntil: 5, date: '2026-05-20' });
    // Every condition value across all insights is number|string|boolean.
    for (const insight of result) {
      for (const value of Object.values(insight.conditions)) {
        expect(['number', 'string', 'boolean']).toContain(typeof value);
      }
    }
  });
});

// ── 17. SEVERITY_PRIORITY_MATRIX ─────────────────────────────────────

describe('SEVERITY_PRIORITY_MATRIX', () => {
  // One input that fires all 12 event types at once, each in its primary
  // (non-escalated) band, so the table pins severity+priority per type.
  const allEventsInput = () =>
    input({
      snapshot: snapshot({
        thresholds: [
          threshold({ id: 'income', label: 'CA 2026', type: 'income', current: 850_000, limit: 1_000_000, ratio: 0.85 }),
          threshold({ id: 'vat', label: 'TVA 2026', type: 'vat', current: 850_000, limit: 1_000_000, ratio: 0.85 }),
          threshold({ id: 'cass', label: 'CASS 2026', affectedTax: 'cass', current: 850_000, limit: 1_000_000, ratio: 0.85 }),
        ],
        deadlines: [{ id: 'd1', label: 'TVA 3Q', date: '2026-07-15', daysUntil: 25 }],
        missing: ['cui'],
        taxReserve: {
          projectedLiabilityCents: 100_000,
          targetReserveCents: 170_000,
          currentReserveCents: 100_000,
          gapCents: 70_000,
          coverageMonths: 6,
          projectedQ4LiabilityCents: 30_000,
          taxYear: 2026,
        },
      }),
      currentTaxEstimateCents: 1_600_000,
      previousTaxEstimateCents: 1_000_000,
      currentMonthRevenueCents: 70_000,
      previousMonthRevenueCents: 100_000,
      legislationChangeDate: '2026-05-01',
      expenses: [
        ...Array.from({ length: 10 }, (_, i) =>
          expense({ id: `e-small-${i}`, valoareFaraTva: 10_000, tva: 0 }),
        ),
        expense({ id: 'e-big', valoareFaraTva: 1_000_000, tva: 0 }),
      ],
    });

  const MATRIX: Record<InsightEventType, { severity: InsightSeverity; priority: InsightPriority }> = {
    INCOME_THRESHOLD_APPROACHING: { severity: 'warning', priority: 'medium' },
    MISSING_DOCUMENTS: { severity: 'warning', priority: 'high' },
    DATA_INCOMPLETE: { severity: 'warning', priority: 'medium' },
    VAT_THRESHOLD_APPROACHING: { severity: 'warning', priority: 'medium' },
    DEADLINE_APPROACHING: { severity: 'warning', priority: 'medium' },
    TAX_ESTIMATE_CHANGED: { severity: 'warning', priority: 'high' },
    LEGISLATION_CHANGED: { severity: 'info', priority: 'low' },
    PROJECTED_TAX_INCREASE: { severity: 'warning', priority: 'high' },
    PROJECTED_REVENUE_DROP: { severity: 'warning', priority: 'high' },
    STRUCTURE_COMPARISON_RELEVANT: { severity: 'info', priority: 'medium' },
    UNUSUAL_EXPENSE: { severity: 'danger', priority: 'high' },
    RESERVE_BEHIND: { severity: 'warning', priority: 'high' },
  };

  it('fires all 12 event types in a single input', () => {
    const result = buildInsights(allEventsInput());
    expect(result).toHaveLength(12);
    for (const type of Object.keys(MATRIX) as InsightEventType[]) {
      expect(find(result, type)).toBeDefined();
    }
  });

  it.each(Object.entries(MATRIX))('maps %s → severity=%s, priority=%s', (type, expected) => {
    const insight = find(buildInsights(allEventsInput()), type as InsightEventType)!;
    expect(insight.severity).toBe(expected.severity);
    expect(insight.priority).toBe(expected.priority);
  });
});
