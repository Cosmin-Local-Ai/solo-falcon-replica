/**
 * Tests for the attention families (`getInsights`) — emission contract:
 *
 * | Source       | Condition                                   | Severity |
 * |--------------|---------------------------------------------|----------|
 * | Threshold    | domain severity 'high'                      | high     |
 * | Threshold    | domain severity 'medium'                    | medium   |
 * | Threshold    | domain severity 'low'                       | low      |
 * | Threshold    | domain severity 'none' (inapplicable, far)  | —        |
 * | Threshold    | CASS + CAS both alerting                     | one canonical alert |
 * | Deadline     | daysUntil < 0 / === 0                        | high     |
 * | Deadline     | 1..7 / 8..30                                 | high / medium |
 * | Deadline     | > 30                                         | low      |
 * | Deadline     | non-finite daysUntil / empty date            | —        |
 * | Reserve      | projectedLiabilityBani > 0 && gapBani > 0   | medium   |
 * | Completeness | one item per unsatisfied check               | medium   |
 * | Tax          | review_required                              | high     |
 * | Tax          | computed                                     | —        |
 *
 * TASK 4 put the threshold severity decision in the domain (`thresholds.ts` `severityFor`, which never
 * reads the legal kind). TASK 8 removed the translation this layer used to apply on top of it —
 * `high → danger`, `medium → warning`, `low → info` — because folding four levels into three is the
 * collapse this task exists to remove. The row's severity is now read verbatim.
 *
 * The deadline family widened on purpose: it used to stop at 30 days because it only ever fed an
 * alert, and it now feeds the action list too, so a term 200 days away still appears — at `low`.
 * A legal duty that is far away is not no duty.
 *
 * Invariants: raw keys never leak into user-facing strings, all strings are
 * Romanian, output is sorted high → medium → low, engine is deterministic.
 */
import { describe, expect, it } from 'vitest';
import { getInsights } from './insights';
import type { InsightInput } from './insights';
import type { AttentionItem } from './attention';
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
    // TASK 4: the semantic fields the domain now passes through. `severity` is what decides whether
    // an alert exists at all; `kind` decides how it is worded; `consequence` is the cited sentence
    // the alert shows, so the CF citation lives in exactly one file.
    kind: 'over_limit',
    engaged: false,
    severity: 'medium',
    consequence: 'Baza de calcul pentru CASS este venitul net anual, în limita plafonului de 72 SM (art. 170 alin. (1) din Codul fiscal).',
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

function texts(insights: AttentionItem[]): string {
  return insights.map((i) => `${i.title} ${i.description} ${i.action}`).join('\n');
}

// Phase 6 §7 item 5 — the 24 SM CAS ladder step (CF art. 148 alin. (2) lit. b).
// A tier floor is NOT a limit: crossing it raises the MINIMUM CAS base, so the old
// "a depășit limita fiscală" wording stated the opposite of the law. TASK 4 removed the
// `breached → danger` path entirely: a `tier_transition` row cannot be breached in either direction.
describe('tier_transition threshold alerts (CF art. 148 alin. (2))', () => {
  it('words a crossed tier as a changed calculation base, never as a limit breach', () => {
    const insights = getInsights(
      input({
        snapshot: snapshot({
          thresholds: [
            threshold({
              id: 'CAS_TIER2_FLOOR',
              affectedTax: 'cas',
              type: 'tier-floor',
              kind: 'tier_transition',
              engaged: true,
              ratio: 1.23,
              // The domain's own decision: a crossed ladder rung is worth showing, not alarming on.
              severity: 'medium',
              consequence:
                'Baza minimă de calcul pentru CAS crește de la 12 SM la 24 SM (art. 148 alin. (2) lit. b) din Codul fiscal). Nu este un plafon.',
            }),
          ],
        }),
      }),
    );

    expect(insights).toHaveLength(1);
    // Nothing went wrong — the contribution is simply computed on a higher floor, so this is not
    // a `danger`.
    expect(insights[0].severity).toBe('medium');
    expect(insights[0].id).toBe('threshold-CAS_TIER2_FLOOR');
    expect(insights[0].title).toContain('Nivel de calcul modificat');
    expect(insights[0].description).toContain('art. 148 alin. (2) lit. b)');
    expect(texts(insights)).not.toContain('limita fiscală');
    expect(texts(insights)).not.toContain('Prag depășit');
  });

  it('shows the row the domain marked medium, whatever its ratio', () => {
    const insights = getInsights(
      input({
        snapshot: snapshot({
          thresholds: [
            threshold({
              id: 'CAS_TIER2_FLOOR',
              affectedTax: 'cas',
              type: 'tier-floor',
              kind: 'tier_transition',
              ratio: 0.9,
              severity: 'medium',
            }),
          ],
        }),
      }),
    );

    expect(insights).toHaveLength(1);
    expect(insights[0].severity).toBe('medium');
    expect(insights[0].title).toContain('Aproape de prag');
  });

  it('says nothing while the domain says the row needs no attention', () => {
    const insights = getInsights(
      input({
        snapshot: snapshot({
          thresholds: [
            threshold({
              id: 'CAS_TIER2_FLOOR',
              affectedTax: 'cas',
              type: 'tier-floor',
              kind: 'tier_transition',
              ratio: 0.07,
              severity: 'none',
            }),
          ],
        }),
      }),
    );

    expect(insights).toEqual([]);
  });

  it('a below-floor CAS row is never worded as a breach, in either direction', () => {
    // TASK 4 acceptance, at the alert layer: income below the CAS floor means no contribution is owed
    // (CF art. 148 alin. (1) and (4)); it is not a breach, a regime change or a reportable event.
    const insights = getInsights(
      input({
        snapshot: snapshot({
          thresholds: [
            threshold({
              id: 'CAS_MIN_BASE',
              affectedTax: 'cas',
              kind: 'tier_transition',
              engaged: true,
              ratio: 0.19,
              severity: 'medium',
              consequence:
                'Venitul net anual este sub pragul de 12 salarii minime brute; nu se datorează contribuția de asigurări sociale pentru acest an (art. 148 alin. (1) și (4) din Codul fiscal).',
            }),
          ],
        }),
      }),
    );

    expect(insights).toHaveLength(1);
    expect(insights[0].severity).toBe('medium');
    expect(insights[0].description).toContain('art. 148 alin. (1) și (4)');
    expect(texts(insights)).not.toContain('Prag depășit');
    expect(texts(insights)).not.toContain('limita fiscală');
    expect(texts(insights).toLowerCase()).not.toContain('dezcalificare');
    expect(texts(insights).toLowerCase()).not.toContain('schimbare de regim');
  });
});

// Thresholds

describe('thresholds', () => {
  it('emits exactly one danger when the domain marks a row high', () => {
    const insights = getInsights(
      input({
        snapshot: snapshot({
          thresholds: [
            threshold({
              id: 'cass',
              affectedTax: 'cass',
              ratio: 1.1,
              breached: true,
              engaged: true,
              severity: 'high',
            }),
          ],
        }),
      }),
    );

    expect(insights).toHaveLength(1);
    expect(insights[0].severity).toBe('high');
    expect(insights[0].id).toBe('threshold-cass');
    // `over_limit` is the one kind whose crossing may be called a depășire: CF art. 170 alin. (1)
    // really does cap the base there.
    expect(insights[0].title).toContain('Plafon depășit');
    expect(insights[0].description).toContain('art. 170 alin. (1)');
  });

  it('emits a warning for a row the domain marked medium', () => {
    const insights = getInsights(
      input({
        snapshot: snapshot({
          thresholds: [
            threshold({ id: 'cass', affectedTax: 'cass', ratio: 0.85, severity: 'medium' }),
          ],
        }),
      }),
    );

    expect(insights).toHaveLength(1);
    expect(insights[0].severity).toBe('medium');
    expect(insights[0].id).toBe('threshold-cass');
    expect(insights[0].title).toContain('Aproape de prag');
  });

  it('does not re-derive its own proximity band: the ratio alone never creates an alert', () => {
    // Replaces the two assertions that pinned `ratio >= 0.8` here. That band was a second, uncited
    // copy of the app's 10 % presentation policy; it now lives once in `thresholds.ts`, and this layer
    // must stay silent for a row the domain marked `none` however close its ratio is to 1.
    const insights = getInsights(
      input({
        snapshot: snapshot({
          thresholds: [
            threshold({ id: 'cass', affectedTax: 'cass', ratio: 0.99, severity: 'none' }),
          ],
        }),
      }),
    );

    expect(insights).toEqual([]);
  });

  it('emits an info insight for a low-severity row, so severity and legal kind stay separate', () => {
    const insights = getInsights(
      input({
        snapshot: snapshot({
          thresholds: [
            threshold({ id: 'cass', affectedTax: 'cass', ratio: 0.2, severity: 'low' }),
          ],
        }),
      }),
    );

    expect(insights).toHaveLength(1);
    expect(insights[0].severity).toBe('low');
  });

  it('emits nothing when the domain marks the row none', () => {
    const insights = getInsights(
      input({
        snapshot: snapshot({
          thresholds: [threshold({ id: 'cass', affectedTax: 'cass', ratio: 0.79, severity: 'none' })],
        }),
      }),
    );

    expect(insights).toEqual([]);
  });

  it('an inapplicable row is silent even when its level is engaged and its ratio is over 1', () => {
    // The severity `none` the domain gives an inapplicable row is what keeps it out of Observații —
    // the flag alone cannot make it alert.
    const insights = getInsights(
      input({
        snapshot: snapshot({
          thresholds: [
            threshold({
              id: 'vat',
              affectedTax: 'vat',
              kind: 'registration',
              ratio: 1.4,
              breached: true,
              engaged: true,
              severity: 'none',
            }),
          ],
        }),
      }),
    );

    expect(insights).toEqual([]);
  });

  it('emits danger at exactly ratio 1.0 when the domain marks the row high (boundary)', () => {
    const insights = getInsights(
      input({
        snapshot: snapshot({
          thresholds: [
            threshold({
              id: 'cass',
              affectedTax: 'cass',
              ratio: 1.0,
              breached: true,
              engaged: true,
              severity: 'high',
            }),
          ],
        }),
      }),
    );

    expect(insights).toHaveLength(1);
    expect(insights[0].severity).toBe('high');
    expect(insights[0].id).toBe('threshold-cass');
  });

  it('canonicalizes CASS + CAS alerts into one (worst severity wins)', () => {
    const insights = getInsights(
      input({
        snapshot: snapshot({
          thresholds: [
            threshold({ id: 'cass', affectedTax: 'cass', ratio: 1.05, breached: true, engaged: true, severity: 'high' }),
            threshold({ id: 'cas', affectedTax: 'cas', ratio: 0.9, severity: 'medium' }),
          ],
        }),
      }),
    );

    expect(insights).toHaveLength(1);
    expect(insights[0].severity).toBe('high');
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
    expect(insights[0].severity).toBe('medium');
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
    expect(insights[0].severity).toBe('high');
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
    expect(insights[0].severity).toBe('high');
    expect(insights[0].title).toContain('Termen depășit');
    expect(insights[0].description).toContain('este astăzi');
  });

  it('emits a medium item for a term inside the month, and says which term it is', () => {
    const insights = getInsights(
      input({
        snapshot: snapshot({
          deadlines: [deadline({ id: 'pfa', label: 'pfa', daysUntil: 15 })],
        }),
      }),
    );

    expect(insights).toHaveLength(1);
    expect(insights[0].severity).toBe('medium');
    expect(insights[0].state).toBe('deadline_open');
    expect(insights[0].title).toContain('Termen limită');
  });

  it.each([1, 7])('emits a high item for a term inside the week (daysUntil = %i)', (daysUntil) => {
    const insights = getInsights(
      input({
        snapshot: snapshot({
          deadlines: [deadline({ id: 'pfa', label: 'pfa', daysUntil })],
        }),
      }),
    );

    expect(insights).toHaveLength(1);
    expect(insights[0].severity).toBe('high');
    expect(insights[0].state).toBe('deadline_open');
  });

  it('emits a low item for daysUntil > 30: a duty far away is still a duty', () => {
    // Replaced, not deleted: this used to assert `[]`. The family stopped at 30 days because it only
    // ever fed an alert. It now feeds the action list as well, and a filing term 206 days out — the
    // D212 term on the seed — is a real obligation at a low urgency, not an absence of one.
    const insights = getInsights(
      input({
        snapshot: snapshot({
          deadlines: [deadline({ id: 'pfa', label: 'pfa', daysUntil: 31 })],
        }),
      }),
    );

    expect(insights).toHaveLength(1);
    expect(insights[0].severity).toBe('low');
    expect(insights[0].state).toBe('deadline_open');
    expect(insights[0].source).toBe('deadline');
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
    expect(insights[0].severity).toBe('medium');
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
  it('emits one medium item with the Romanian label for a known missing key', () => {
    const insights = getInsights(input({ snapshot: snapshot({ missing: ['profile'] }) }));

    expect(insights).toHaveLength(1);
    expect(insights[0].severity).toBe('medium');
    expect(insights[0].state).toBe('data_missing');
    expect(insights[0].id).toBe('completeness-profile');
    expect(insights[0].description).toContain('Profil');
    // TASK 8: an unsatisfied check is something the user can fix, so it carries the route that fixes it.
    expect(insights[0].target?.href).toBe('/settings#!/fiscal');
  });

  it('emits one item per missing key, not one collapsed line', () => {
    // Replaced, not deleted: the old behaviour collapsed every missing key into a single card
    // („Lipsă: Profil, Venituri înregistrate”) while `getActionItems` emitted one action per key for the
    // same data. One problem, two surfaces, two vocabularies. There is now one item per key, and
    // `partitionAttention` sends it to exactly one of the two surfaces.
    const insights = getInsights(input({ snapshot: snapshot({ missing: ['profile', 'income'] }) }));

    expect(insights).toHaveLength(2);
    expect(insights.map(i => i.id)).toEqual(['completeness-profile', 'completeness-income']);
    expect(insights[0].description).toContain('Profil');
    expect(insights[1].description).toContain('Venituri înregistrate');
  });

  it('renders an unknown completeness key RAW rather than the old generic', () => {
    // PG-5 re-pin (replaced, not deleted). The old fallback was the word „date”, so an unlabelled check
    // read as „Date lipsă: date” — a sentence that looks finished and means nothing. That generic was
    // the same defect as the deadline family's 'Termen fiscal': it made a missing label invisible.
    // The raw key is ugly on purpose, and `src/ui/copy/labels.test.ts` fails when a key the producer
    // emits has no label, so the ugliness never reaches a user.
    const insights = getInsights(input({ snapshot: snapshot({ missing: ['totally_unknown_key'] }) }));

    expect(insights).toHaveLength(1);
    expect(insights[0].description).toContain('totally_unknown_key');
    expect(insights[0].description).not.toContain(': date');
  });

  it('emits nothing when missing is empty', () => {
    expect(getInsights(input({ snapshot: snapshot({ missing: [] }) }))).toEqual([]);
  });

  it('renders the Romanian label for every completeness key the producer emits', () => {
    // PG-5 re-pin (replaced, not deleted): `declarations` left with the check it labelled, and
    // `taxEstimate` had already left in PG-1 — this map kept both, which is what a second producer
    // does. The list is now the keys `completeness.ts` actually emits.
    const labels: Record<string, string> = {
      profile: 'Profil',
      income: 'Venituri înregistrate',
      expenses: 'Cheltuieli înregistrate',
      clients: 'Clienți',
      documents: 'Documente',
      companyDocuments: 'Documente de firmă',
      annualFiling: 'Declarația unică (D212)',
      vatFilingPeriod: 'Perioada de depunere TVA',
      statements: 'Declarații fiscale',
    };

    for (const [key, label] of Object.entries(labels)) {
      const insights = getInsights(input({ snapshot: snapshot({ missing: [key] }) }));
      expect(insights).toHaveLength(1);
      expect(insights[0].severity).toBe('medium');
      expect(insights[0].description).toContain(label);
    }
  });

  it('works with real assessCompleteness output (integration)', () => {
    const emptyData: AppData = {
      reservedAmount: null,
      profile: null as unknown as PfaProfile,
      revenues: [],
      expenses: [],
      clients: [],
      filings: [], legacyDeclarations: [],
      documents: [],
      companyDocs: { im: [], cs: [], tva: [], facturi: [] },
      statements: [],
      snapshots: [],
      settings: {} as SettingsState,
    };

    const report = assessCompleteness(emptyData);
    const missing = report.checks.filter((c) => !c.satisfied).map((c) => c.key);
    // PG-5 re-pin: eight became nine — `declarations` split into `annualFiling` (the return this fiscal
    // year owes) and `vatFilingPeriod` (B-35, the period the recorded facts cannot fix).
    expect(missing).toHaveLength(9); // every check fails on empty data

    const insights = getInsights(input({ snapshot: snapshot({ missing }) }));
    expect(insights).toHaveLength(9);
    for (const item of insights) {
      expect(item.severity).toBe('medium');
      expect(item.state).toBe('data_missing');
    }
    // Every Romanian label must appear, one per item now that each key is its own item.
    const all = insights.map(i => i.description).join('\n');
    expect(all).toContain('Profil');
    // PG-1: `Estimare impozit` was the label of the removed check. Nothing emits it now, and the row
    // that claimed a calculated estimate was a completeness fact is gone with it.
    expect(all).toContain('Declarații fiscale');
    expect(all).not.toContain('Estimare impozit');
  });
});

// Tax

describe('tax', () => {
  it('emits nothing when tax is undefined', () => {
    expect(getInsights(input({ snapshot: snapshot() }))).toEqual([]);
  });

  it('emits exactly one high item for review_required, without numbers or the raw reason', () => {
    const reason = 'CAS rule not found for tax year 2026';
    const insights = getInsights(input({ snapshot: snapshot(), tax: taxReviewRequired(reason) }));

    expect(insights).toHaveLength(1);
    expect(insights[0].severity).toBe('high');
    expect(insights[0].state).toBe('estimate_review_required');
    expect(insights[0].id).toBe('tax');
    const text = `${insights[0].title} ${insights[0].description}`;
    expect(text).not.toMatch(/[0-9]/);
    expect(text).not.toContain(reason);
    // The item says the estimate needs attention; it does not resolve the withheld conclusion.
    expect(text).not.toMatch(/calculul este|se poate calcula/);
  });

  it('emits nothing for a computed estimate: the figure is on the hero, not an alert', () => {
    // Replaced, not deleted. This test used to assert an `info` card repeating the formatted total —
    // a second copy of the hero number, in the attention surface, needing no attention at all. The
    // estimate section now states `computed` / `review-required` / `unavailable` itself, so the
    // attention model carries an item only when a conclusion was withheld.
    const total = lei(1234.57);
    const insights = getInsights(input({ snapshot: snapshot(), tax: taxComputed(total) }));

    expect(insights).toEqual([]);
    // The formatter the deleted assertion used to mirror is still the app's only one.
    expect(formatBaniRON(total)).toBe('1.234,57 RON');
  });
});

// Invariants

describe('invariants', () => {
  it('never exposes raw key strings for the families that have labels', () => {
    // PG-5 re-pin (replaced, not deleted): this test used to sweep every raw key into one
    // must-not-appear list, which only held because two fallbacks papered unknown keys with plausible
    // generics ('Termen fiscal', 'date'). Those fallbacks are gone, so the invariant is now stated for
    // what it actually protects: a key that HAS a label must never render its identifier. A key with no
    // label renders itself, loudly — pinned in the next test and guarded in `ui/copy/labels.test.ts`.
    const rawKeys = ['cass-max-raw'];
    const insights = getInsights(
      input({
        snapshot: snapshot({
          thresholds: [threshold({ id: 't1', label: 'cass-max-raw', affectedTax: 'cass', ratio: 0.9 })],
        }),
      }),
    );

    expect(insights.length).toBeGreaterThan(0);
    const text = texts(insights);
    for (const raw of rawKeys) {
      expect(text).not.toContain(raw);
    }
  });

  it('PG-5: an unknown deadline key surfaces RAW instead of a plausible generic', () => {
    // Re-pin of the old `some-raw-label` assertion, which relied on `deadlineLabelFor` answering every
    // unknown key with 'Termen fiscal'. That fallback was the defect: a rule added next quarter would
    // have rendered as a sentence nobody wrote, and the suite would have stayed green. The raw key is
    // the honest failure, and this test is what makes it visible before it ships.
    const insights = getInsights(
      input({ snapshot: snapshot({ deadlines: [deadline({ id: 'd1', label: 'some-raw-label', daysUntil: 5 })] }) }),
    );
    const text = texts(insights);
    expect(text).toContain('some-raw-label');
    expect(text).not.toContain('Termen fiscal');

    // And a known key renders the sentence acceptance 1 asks for.
    const known = getInsights(input({ snapshot: snapshot({ deadlines: [deadline({ id: 'd1', label: 'pfa', daysUntil: -1 })] }) }));
    expect(texts(known)).toContain('Declarația unică (D212) pentru 2026');
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

  it('sorts high → medium → low, stable within a severity', () => {
    const insights = getInsights(
      input({
        snapshot: snapshot({
          missing: ['profile'],
          thresholds: [
            threshold({ id: 'cass', affectedTax: 'cass', ratio: 1.1, breached: true, engaged: true, severity: 'high' }),
            threshold({ id: 'vat', affectedTax: 'vat', ratio: 0.85, severity: 'medium' }),
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
      'high',
      'high',
      'medium',
      'medium',
      'medium',
      'medium',
    ]);
    // Within the medium band: thresholds, deadlines, reserve, completeness (insertion order).
    // The `tax` entry that used to sit at the end is gone: a computed estimate is not an alert.
    expect(insights.filter((i) => i.severity === 'medium').map((i) => i.id)).toEqual([
      'threshold-vat',
      'deadline-vat',
      'reserve',
      'completeness-profile',
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
    expect(row!.severity).toBe('high');
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
    expect(insights.map(i => i.id)).toEqual(['fiscal-dates', 'completeness-profile']);
  });
});
