import type { DashboardSnapshot, ExcludedFiscalDate, Threshold } from './aggregation';
import type { ThresholdKind, ThresholdSeverity } from './thresholds';
import type { TaxEstimateResult } from './tax';
import type { Expense } from '../data/types';
import { formatRoCalendarDate } from './date';
import { formatBaniRON, type Bani } from './money';

// ── Contract ──────────────────────────────────────────────
// `Insight` and `InsightInput` match the consumers:
//   - src/data/dashboard.ts  → getInsights(data, snapshot, tax) → buildInsights({ snapshot, expenses, tax })
//   - src/components/Insights.tsx → renders insight.title / description / action
//     with SEVERITY_LABELS = { info: 'Info', warning: 'Atenție', danger: 'Urgent' }

export interface Insight {
  id: string;
  severity: 'info' | 'warning' | 'danger';
  title: string; // Romanian
  description: string; // Romanian
  action: string; // Romanian
}

export interface InsightInput {
  snapshot: DashboardSnapshot;
  /** Kept for contract compatibility with dashboard.ts; not used by current insights. */
  expenses?: readonly Expense[];
  /** Optional tax estimate; `undefined` → no tax insight. */
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


// ── Romanian label maps (never render raw keys) ────────────
//
// Phase 9b removed `cas_quarterly`, `cass_quarterly` and `pfa_estimated_declaration` — those
// obligations do not exist in fiscal year 2026 (see the `DeadlineEventType` doc comment in
// src/domain/deadlines.ts). `new_pfa` keeps its key but no longer reads "Declarație estimativă
// PFA": that label named an obligation abrogated on 01-01-2025, and no rule emits `new_pfa` today.

/** Fiscal date field → Romanian, for the B-21 insight. Raw property names are never rendered. */
const FISCAL_DATE_FIELD_LABEL: Record<ExcludedFiscalDate['field'], string> = {
  date: 'data',
  collected: 'data încasării',
  paid: 'data plății',
};

const DEADLINE_LABELS: Record<string, string> = {
  pfa: 'PFA',
  new_pfa: 'PFA nou',
  'vat-registered-pfa': 'Înregistrare în scop de TVA',
  cas_annual: 'CAS anual',
  cass_annual: 'CASS anual',
  vat_periodic: 'TVA periodic',
  vat_registration: 'Înregistrare în scop de TVA',
};

const THRESHOLD_LABELS: Record<string, string> = {
  'pfa-revenue': 'Venit PFA',
};

/** Romanian labels for the 9 known completeness check keys (must match completeness.ts). */
const COMPLETENESS_LABELS: Record<string, string> = {
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

function deadlineLabel(label: string): string {
  return DEADLINE_LABELS[label] ?? 'Termen fiscal';
}

function thresholdLabel(label: string): string {
  return THRESHOLD_LABELS[label] ?? 'Prag fiscal';
}

function completenessLabel(key: string): string {
  return COMPLETENESS_LABELS[key] ?? 'date';
}

// ── Severity ordering ─────────────────────────────────────
function severityRank(sev: Insight['severity']): number {
  switch (sev) {
    case 'danger':
      return 0;
    case 'warning':
      return 1;
    case 'info':
      return 2;
  }
}

// ── Threshold alerts ──────────────────────────────────────
interface ThresholdAlert {
  id: string;
  severity: Insight['severity'];
  title: string;
  description: string;
  action: string;
  affectedTax: string;
  ratio: number;
}

/**
 * TASK 4 — the severity is DECIDED in the domain (`thresholds.ts` `severityFor`, which never reads
 * the legal kind) and only translated here. This file used to invent it from `breached` + a private
 * `ratio >= 0.8` band, which was a second, uncited copy of the same application policy and made the
 * two surfaces disagree about how urgent a row looked.
 */
function insightSeverity(severity: ThresholdSeverity): Insight['severity'] {
  if (severity === 'high') return 'danger';
  if (severity === 'medium') return 'warning';
  return 'info';
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
  const label = thresholdLabel(t.label);
  const unmeasured = t.current === null;
  return {
    id: `threshold-${t.id}`,
    severity: insightSeverity(t.severity),
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
    const sevDiff = severityRank(a.severity) - severityRank(canonical.severity);
    if (sevDiff < 0 || (sevDiff === 0 && a.ratio > canonical.ratio)) {
      canonical = a;
    }
  }
  return canonical;
}

function toInsight(a: ThresholdAlert): Insight {
  return { id: a.id, severity: a.severity, title: a.title, description: a.description, action: a.action };
}

// ── Main ──────────────────────────────────────────────────
export function getInsights(input: InsightInput): Insight[] {
  const { snapshot, tax } = input;
  const insights: Insight[] = [];

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
  if (canonical !== null) insights.push(toInsight(canonical));
  for (const a of others) insights.push(toInsight(a));

  // 2. Deadline alerts — overdue (daysUntil < 0) and due today (daysUntil === 0)
  //    → danger; 1 <= daysUntil <= 30 → warning; > 30 → no insight.
  //    Invalid deadlines (empty date, non-finite daysUntil) are skipped.
  for (const d of snapshot.deadlines) {
    if (typeof d.daysUntil !== 'number' || !Number.isFinite(d.daysUntil)) continue;
    if (typeof d.date !== 'string' || d.date.length === 0) continue;
    const label = deadlineLabel(d.label);
    const date = formatRoCalendarDate(d.date);
    if (d.daysUntil <= 0) {
      insights.push({
        id: `deadline-${d.id}`,
        severity: 'danger',
        title: `Termen depășit: ${label}`,
        description:
          d.daysUntil < 0
            ? `Termenul ${label} a expirat pe ${date}.`
            : `Termenul ${label} este astăzi (${date}).`,
        action: `Depune ${label} cât de curând posibil.`,
      });
    } else if (d.daysUntil <= 30) {
      insights.push({
        id: `deadline-${d.id}`,
        severity: 'warning',
        title: `Termen apropiat: ${label}`,
        description: `Termenul ${label} este pe ${date}.`,
        action: `Pregătește ${label}.`,
      });
    }
  }

  // 3. Reserve gap (warning) — only when there is a real gap.
  //    No insight when no liability data is recorded (projectedLiabilityBani <= 0)
  //    and no insight when the reserve already meets the target (gapBani <= 0).
  const { projectedLiabilityBani, gapBani } = snapshot.taxReserve;
  if (projectedLiabilityBani > 0 && gapBani > 0) {
    const gap = gapBani;
    insights.push({
      id: 'reserve',
      severity: 'warning',
      title: 'Rezervă fiscală sub țintă',
      description: `Diferența față de ținta de rezervă: ${formatBaniRON(gap)}.`,
      action: 'Adaugă fonduri la rezerva fiscală.',
    });
  }

  // 4. Completeness (warning) — map raw keys to Romanian labels.
  const missing = snapshot.missing ?? [];
  if (missing.length > 0) {
    const labels = missing.map(completenessLabel).join(', ');
    insights.push({
      id: 'completeness',
      severity: 'warning',
      title: 'Date incomplete',
      description: `Lipsă: ${labels}.`,
      action: 'Completează datele lipsă în profil.',
    });
  }

  // 5. Tax estimate (info) — at most one, no raw reasons.
  if (tax !== undefined) {
    if (tax.status === 'review_required') {
      insights.push({
        id: 'tax',
        severity: 'info',
        title: 'Estimarea impozitului necesită verificare',
        description: 'Datele nu permit o estimare completă a impozitului.',
        action: 'Verifică datele fiscale.',
      });
    } else if (tax.status === 'computed') {
      insights.push({
        id: 'tax',
        severity: 'info',
        title: 'Estimare impozit',
        description: `Estimarea totală a impozitului: ${formatBaniRON(tax.output.total)}.`,
        action: 'Verifică detaliile estimării.',
      });
    }
  }

  // 6. B-21 — records whose stored date is not a usable calendar date.
  //    `inPeriod` excludes them from every total, so without this row the dashboard would look
  //    complete while quietly missing rows. One row for the whole class rather than one per
  //    record: the operator's job is one fix (correct the date), and a per-record row would let
  //    a bad import bury every other insight. The record itself is never rewritten.
  const dateIssues = input.fiscalDateIssues ?? [];
  if (dateIssues.length > 0) {
    const shown = dateIssues.slice(0, 3);
    const where = shown
      .map(i => `${i.kind === 'revenue' ? 'Venit' : 'Cheltuială'} ${i.id} · ${FISCAL_DATE_FIELD_LABEL[i.field]}`)
      .join('; ');
    const more = dateIssues.length > shown.length ? ` și încă ${dateIssues.length - shown.length}` : '';
    insights.push({
      id: 'fiscal-dates',
      severity: 'danger',
      title: `${dateIssues.length} înregistr${dateIssues.length === 1 ? 'are are' : 'ări au'} o dată de verificat`,
      description: `Data nu este o dată calendaristică ISO validă, deci înregistrarea nu intră în niciun total pe perioadă: ${where}${more}.`,
      action: 'De verificat: corectează data în registru; înregistrarea nu a fost modificată automat.',
    });
  }

  // Most urgent first — stable sort keeps natural order within a severity.
  insights.sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
  return insights;
}
