import type { DashboardSnapshot, ExcludedFiscalDate, Threshold } from './aggregation';
import type { ThresholdKind } from './thresholds';
import type { TaxEstimateResult } from './tax';
import type { Expense } from '../data/types';
import { formatRoCalendarDate } from './date';
import { formatBaniRON } from './money';
// PG-4 hygiene: this file used to keep its own `FISCAL_DATE_FIELD_LABEL` for the same three words
// `ui/copy/records.ts` already spells as `fiscalDateSource`. Two maps, two wordings (`data` vs
// `data documentului`), one idea — the B-70 mistake in miniature. The copy layer owns the words, so
// the domain reads them from there instead of re-spelling them.
import { fiscalDateSource } from '../ui/copy/records';
// PG-5: the deadline family's Romanian moved to `ui/copy/dashboard.ts` for the same reason PG-4 moved
// the fiscal-date words — this file had its own `DEADLINE_LABELS`, a third spelling of the same seven
// keys, and its D212 row read "PFA". A term that names only an audience is not actionable: the row now
// names the return and the year it declares.
import { checkLabel, deadlineLabelFor } from '../ui/copy/dashboard';
// B-74: the affected-domain family, third member of the same line as the two above. This file used to keep
// its own `THRESHOLD_LABELS` map AND a generic fallback — 'Prag fiscal' — so an unnamed threshold rendered
// as a plausible sentence, and `insights.test.ts` was green because of it.
import { thresholdDomainLabel } from '../ui/copy/thresholds';
import {
  deadlineSeverity,
  sortAttention,
  type AttentionItem,
  type AttentionSeverity,
  type AttentionState,
  type AttentionTarget,
} from './attention';

// ── Contract ──────────────────────────────────────────────
// TASK 8 replaced `Insight` with `AttentionItem` (`domain/attention.ts`). The old type had one field
// for three questions — `severity: 'info' | 'warning' | 'danger'` carried the legal weight, the
// urgency and the kind of thing at once — and this file was where the collapse happened:
// `insightSeverity()` mapped the domain's four-level `ThresholdSeverity` down to three words, so a
// `low` row and a `none` row that survived a filter became indistinguishable from each other and a
// legally load-bearing row could not be told apart from an administrative one.
//
// Now: severity is READ from the family that owns the decision (`thresholds.ts` `severityFor` for a
// threshold row, `deadlineSeverity` for a term, the record table in `attention.ts` for a document)
// and is never re-derived here. `state` says what the item is, `source` says where it came from, and
// `target` says where the person acts. `partitionAttention` then routes each item to exactly one
// surface, which is what stops the same problem appearing as both a card and an action.

export type { AttentionItem };

export interface InsightInput {
  snapshot: DashboardSnapshot;
  /** Kept for contract compatibility with dashboard.ts; not used by current insights. */
  expenses?: readonly Expense[];
  /** Optional tax estimate; `undefined` → no tax item. */
  tax?: TaxEstimateResult;
  /**
   * B-21: records the aggregate could not place in time (`domain/aggregation.ts`
   * `auditFiscalDates`). Optional because the existing callers/tests pass none; when it is
   * non-empty the exclusion MUST be visible, which is the whole point of the defect.
   */
  fiscalDateIssues?: readonly ExcludedFiscalDate[];
}

// ── Formatting ──
// There is deliberately no formatter in this file. A private `Intl.NumberFormat` here was a fifth
// instance of the same job, and it rounded on its own policy — that is the B-17 defect. Every money
// string comes from `formatBaniRON`, which performs no rounding at all.


// ── Romanian labels (never render raw keys) ───────────────
//
// Phase 9b removed `cas_quarterly`, `cass_quarterly` and `pfa_estimated_declaration` — those
// obligations do not exist in fiscal year 2026 (see the `DeadlineEventType` doc comment in
// src/domain/deadlines.ts). `new_pfa` keeps its key but no longer reads "Declarație estimativă
// PFA": that label named an obligation abrogated on 01-01-2025, and no rule emits `new_pfa` today.
//
// The words themselves live in `ui/copy/dashboard.ts` (`deadlineLabels` / `deadlineLabelFor`), together
// with the card's audience chip (`deadlineAppliesToLabels`). An unknown key renders its RAW key there,
// not a plausible generic — see the pin in `src/ui/copy/labels.test.ts`.

/** Fiscal date field → Romanian lives in `ui/copy/records.ts` (`fiscalDateSource`). Raw property
 *  names are never rendered, and the three words are spelled in exactly one place. */

/**
 * PG-5: `COMPLETENESS_LABELS` is deleted. It was a second spelling of the completeness family — the
 * copy layer already owns `CHECK_LABELS` — and it had drifted: it still carried `declarations` and
 * `taxEstimate`, two keys `completeness.ts` no longer emits, while the keys it DOES emit after PG-5
 * (`annualFiling`, `vatFilingPeriod`) were missing and would have rendered as the fallback word „date”.
 * One producer per family is the B-70 rule; the domain now reads the words from the language layer.
 */

/**
 * TASK 8 — an unsatisfied completeness check is now an item with somewhere to go, not a line of text.
 * The route is data (this app's own router), not language; the words on the link come from the
 * language layer at the render site.
 *
 * PG-5: `declarations` and `taxEstimate` are gone — no producer emits those keys any more, so their
 * routes were dead data. `annualFiling` points at the annual register; `vatFilingPeriod` points at the
 * fiscal profile, which is where the fact that would fix the period (the VAT registration date) belongs.
 */
const COMPLETENESS_TARGETS: Record<string, AttentionTarget | null> = {
  profile: { href: '/settings#!/fiscal' },
  income: { href: '/revenues' },
  expenses: { href: '/expenses' },
  clients: { href: '/clients' },
  documents: { href: '/documents' },
  companyDocuments: { href: '/documents#!/company' },
  annualFiling: { href: '/declarations' },
  vatFilingPeriod: { href: '/settings#!/fiscal' },
  statements: { href: '/documents#!/statements' },
};

function completenessLabel(key: string): string {
  // The copy layer's fallback is the RAW key, on purpose. The old fallback here was the word „date”,
  // which made an unlabelled check read as a plausible sentence — „Date lipsă: date” — and let a new
  // key ship without anyone noticing it had no name. `src/ui/copy/labels.test.ts` pins this.
  return checkLabel(key);
}

// ── Threshold alerts ──────────────────────────────────────
interface ThresholdAlert {
  id: string;
  severity: AttentionSeverity;
  state: AttentionState;
  title: string;
  description: string;
  action: string;
  affectedTax: string;
  ratio: number;
}

/**
 * TASK 4 — the severity is DECIDED in the domain (`thresholds.ts` `severityFor`, which never reads
 * the legal kind).
 *
 * TASK 8 removed the translation step. `insightSeverity` used to fold `high → danger`,
 * `medium → warning`, `low → info`, which threw away the difference between `low` and `none` and made
 * the alert scale a third vocabulary next to the row's own. The row's severity is used verbatim.
 */
function thresholdState(t: Threshold): AttentionState {
  if (t.current === null) return 'level_review_required';
  return t.engaged ? 'level_engaged' : 'level_approaching';
}

/**
 * TASK 4 — the title says what kind of level was reached, because "limita fiscală depășită" was false
 * for the contribution floors: CF art. 148 alin. (1) makes 12 SM the condition for the CAS obligation
 * to exist, and below it the consequence is `nu datorează contribuția` (research 24, "What the app
 * must not state" items 1-2 and 7). No CF citation is written here — the row carries its own.
 */
function thresholdTitle(kind: ThresholdKind, engaged: boolean, label: string): string {
  if (!engaged) return `Aproape de prag: ${label}`;
  switch (kind) {
    case 'registration':
      return `Prag de înregistrare depășit: ${label}`;
    case 'over_limit':
      return `Plafon depășit: ${label}`;
    case 'tier_transition':
      return `Nivel de calcul modificat: ${label}`;
    case 'informational':
      return `Prag de referință: ${label}`;
  }
}

function thresholdAction(kind: ThresholdKind): string {
  switch (kind) {
    case 'registration':
      return 'Verifică cifra de afaceri și termenul de înregistrare în scopuri de TVA.';
    case 'over_limit':
      return 'Verifică baza de calcul: contribuția se calculează la plafon.';
    case 'tier_transition':
      return 'Verifică venitul net anual: baza de calcul se modifică.';
    case 'informational':
      return 'Vezi detaliile pragului.';
  }
}

function makeThresholdAlert(t: Threshold): ThresholdAlert {
  const label = thresholdDomainLabel(t.label);
  const unmeasured = t.current === null;
  return {
    id: `threshold-${t.id}`,
    // Read, not translated: the row already carries the four-level severity `severityFor` decided.
    severity: t.severity,
    state: thresholdState(t),
    title: unmeasured ? `Prag de verificat: ${label}` : thresholdTitle(t.kind, t.engaged, label),
    // The description is the row's own factual, cited consequence. This is the second place that
    // used to re-write the same CF article by hand; there is now exactly one.
    description: unmeasured ? (t.reviewReason ?? t.consequence) : t.consequence,
    action: unmeasured ? 'Completează baza de calcul lipsă.' : thresholdAction(t.kind),
    affectedTax: t.affectedTax ?? '',
    // Kept for the CAS/CASS tie-break only. It is no longer a warning threshold: the proximity band
    // is the domain's 10 % presentation policy, stated once in `thresholds.ts`.
    ratio: t.ratio,
  };
}

/**
 * Collapse CASS/CAS threshold alerts into at most one canonical alert:
 * worst severity wins; on a tie, the highest ratio wins.
 */
function canonicalCassCas(alerts: ThresholdAlert[]): ThresholdAlert | null {
  let canonical: ThresholdAlert | null = null;
  for (const a of alerts) {
    if (canonical === null) {
      canonical = a;
      continue;
    }
    const sevDiff = rankOf(a.severity) - rankOf(canonical.severity);
    if (sevDiff < 0 || (sevDiff === 0 && a.ratio > canonical.ratio)) {
      canonical = a;
    }
  }
  return canonical;
}

function rankOf(severity: AttentionSeverity): number {
  if (severity === 'high') return 0;
  if (severity === 'medium') return 1;
  if (severity === 'low') return 2;
  return 3;
}

function toAttentionItem(a: ThresholdAlert): AttentionItem {
  return {
    id: a.id,
    severity: a.severity,
    state: a.state,
    source: 'threshold',
    title: a.title,
    description: a.description,
    action: a.action,
    // The row itself is the surface: *Praguri* renders it with its measured basis and its citation.
    target: { href: '/dashboard#!/praguri' },
  };
}

// ── Main ──────────────────────────────────────────────────
export function getInsights(input: InsightInput): AttentionItem[] {
  const { snapshot, tax } = input;
  const items: AttentionItem[] = [];

  // 1. Threshold alerts — the domain already decided which rows deserve attention at all
  //    (`severity: 'none'` covers an inapplicable row and a row far from its level), so this layer
  //    filters on that decision instead of re-deriving a band of its own. CASS/CAS still collapse to
  //    at most one canonical alert.
  const thresholdAlerts = snapshot.thresholds
    .filter((t) => t.severity !== 'none')
    .map(makeThresholdAlert);

  const cassCas = thresholdAlerts.filter((a) => a.affectedTax === 'cass' || a.affectedTax === 'cas');
  const others = thresholdAlerts.filter((a) => a.affectedTax !== 'cass' && a.affectedTax !== 'cas');
  const canonical = canonicalCassCas(cassCas);
  if (canonical !== null) items.push(toAttentionItem(canonical));
  for (const a of others) items.push(toAttentionItem(a));

  // 2. Deadline items — every dated term the engine resolved.
  //
  //    This family used to stop at 30 days, because it only ever fed an alert. It now feeds the
  //    action list too, so a term 200 days away still appears — at `low`, which is what the domain
  //    says it is. A legal duty that is far away is not the same as no duty, and `deadlineSeverity`
  //    is the only place that decides the difference.
  //    Invalid deadlines (empty date, non-finite daysUntil) are skipped: with no date there is no
  //    term to state, and the engine already says so in *Termene limită*.
  for (const d of snapshot.deadlines) {
    if (typeof d.daysUntil !== 'number' || !Number.isFinite(d.daysUntil)) continue;
    if (typeof d.date !== 'string' || d.date.length === 0) continue;
    const label = deadlineLabelFor(d.label, snapshot.taxYear);
    const date = formatRoCalendarDate(d.date);
    const severity = deadlineSeverity(d.daysUntil);
    if (severity === 'none') continue;
    if (d.daysUntil <= 0) {
      items.push({
        id: `deadline-${d.id}`,
        severity,
        state: 'deadline_overdue',
        source: 'deadline',
        title: `Termen depășit: ${label}`,
        description:
          d.daysUntil < 0
            ? `Termenul ${label} a expirat pe ${date}.`
            : `Termenul ${label} este astăzi (${date}).`,
        action: `Depune ${label} cât de curând posibil.`,
        target: { href: '/declarations' },
      });
    } else {
      items.push({
        id: `deadline-${d.id}`,
        severity,
        state: 'deadline_open',
        source: 'deadline',
        title: `Termen limită: ${label}`,
        description: `Termenul ${label} este pe ${date}.`,
        action: `Pregătește ${label}.`,
        target: { href: '/declarations' },
      });
    }
  }

  // 3. Reserve gap — only when there is a real gap.
  //    No item when no liability data is recorded (projectedLiabilityBani <= 0)
  //    and no item when the reserve already meets the target (gapBani <= 0).
  const { projectedLiabilityBani, gapBani } = snapshot.taxReserve;
  if (projectedLiabilityBani > 0 && gapBani > 0) {
    const gap = gapBani;
    items.push({
      id: 'reserve',
      severity: 'medium',
      state: 'reserve_shortfall',
      source: 'reserve',
      title: 'Rezervă fiscală sub țintă',
      description: `Diferența față de ținta de rezervă: ${formatBaniRON(gap)}.`,
      action: 'Adaugă fonduri la rezerva fiscală.',
      // The card that holds the control, not a page: the reserve is recorded on the dashboard.
      target: { href: '/dashboard#!/rezerva' },
    });
  }

  // 4. Completeness — one item per unsatisfied check, each with the route that can satisfy it.
  //
  //    This used to be one collapsed line in Observații ("Lipsă: X, Y") *and* one action per key from
  //    `getActionItems` — the same problem twice, in two vocabularies, with neither pointing anywhere.
  //    It is now one item per key, routed to the action surface by `surfaceFor`, and the collapsed
  //    card is gone.
  const missing = snapshot.missing ?? [];
  for (const key of missing) {
    items.push({
      id: `completeness-${key}`,
      severity: 'medium',
      state: 'data_missing',
      source: 'completeness',
      title: `Date lipsă: ${completenessLabel(key)}`,
      description: `Această verificare de completitudine nu este îndeplinită: ${completenessLabel(key)}.`,
      action: 'Completează datele lipsă.',
      target: COMPLETENESS_TARGETS[key] ?? null,
    });
  }

  // 5. Tax estimate — only when the engine withheld a conclusion.
  //
  //    A `computed` estimate used to raise an `info` item that repeated the hero figure in a card.
  //    That was a duplicate of a number already on the screen, not an item that needs attention, so
  //    it is gone; the estimate section states `computed` / `review-required` / `unavailable` itself.
  //    A withheld conclusion still surfaces, and still stays withheld: this item says the estimate
  //    needs checking, it does not resolve it or restate its reason as a number.
  if (tax !== undefined && tax.status === 'review_required') {
    items.push({
      id: 'tax',
      severity: 'high',
      state: 'estimate_review_required',
      source: 'tax',
      title: 'Estimarea impozitului necesită verificare',
      description: 'Datele nu permit o estimare completă a impozitului.',
      action: 'Verifică datele fiscale.',
      target: { href: '/dashboard#!/estimare' },
    });
  }

  // 6. B-21 — records whose stored date is not a usable calendar date.
  //    `inPeriod` excludes them from every total, so without this row the dashboard would look
  //    complete while quietly missing rows. One row for the whole class rather than one per
  //    record: the operator's job is one fix (correct the date), and a per-record row would let
  //    a bad import bury every other item. The record itself is never rewritten.
  const dateIssues = input.fiscalDateIssues ?? [];
  if (dateIssues.length > 0) {
    const shown = dateIssues.slice(0, 3);
    const where = shown
      .map(i => `${i.kind === 'revenue' ? 'Venit' : 'Cheltuială'} ${i.id} · ${fiscalDateSource[i.field]}`)
      .join('; ');
    const more = dateIssues.length > shown.length ? ` și încă ${dateIssues.length - shown.length}` : '';
    items.push({
      id: 'fiscal-dates',
      severity: 'high',
      state: 'record_date_unusable',
      source: 'integrity',
      title: `${dateIssues.length} înregistr${dateIssues.length === 1 ? 'are are' : 'ări au'} o dată de verificat`,
      description: `Data nu este o dată calendaristică ISO validă, deci înregistrarea nu intră în niciun total pe perioadă: ${where}${more}.`,
      action: 'De verificat: corectează data în registru; înregistrarea nu a fost modificată automat.',
      target: { href: '/revenues' },
    });
  }

  // Most urgent first — the same ranking `partitionAttention` applies to the merged list, so a caller
  // that reads the families directly and a caller that reads the surfaces see one order, not two.
  // The sort is stable, so within a severity the families keep the order above (thresholds, deadlines,
  // reserve, completeness, tax, integrity).
  return sortAttention(items);
}
