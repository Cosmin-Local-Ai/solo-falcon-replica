import type { DashboardSnapshot, Threshold } from './aggregation';
import type { TaxEstimateResult } from './tax';
import type { Expense } from '../data/types';

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
}

// ── Pure formatters (inlined — domain layer must not import the data layer) ──
const ron = new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Format a value already in lei as Romanian RON. */
function formatLei(n: number): string {
  return `${ron.format(n)} RON`;
}

/** Format a cents value as Romanian RON. */
function formatCents(cents: number): string {
  return formatLei(cents / 100);
}

/** Format an ISO 'YYYY-MM-DD' date as 'DD.MM.YYYY'. */
function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

// ── Romanian label maps (never render raw keys) ────────────
const DEADLINE_LABELS: Record<string, string> = {
  pfa: 'PFA',
  new_pfa: 'Declarație estimativă PFA',
  'vat-registered-pfa': 'Înregistrare în scop de TVA',
  cas_quarterly: 'CAS trimestrial',
  cass_quarterly: 'CASS trimestrial',
  cas_annual: 'CAS anual',
  cass_annual: 'CASS anual',
  vat_periodic: 'TVA periodic',
  pfa_estimated_declaration: 'Declarație estimativă PFA',
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
  severity: 'danger' | 'warning';
  title: string;
  description: string;
  action: string;
  affectedTax: string;
  ratio: number;
}

function makeThresholdAlert(t: Threshold): ThresholdAlert {
  const label = thresholdLabel(t.label);
  const pct = Math.round(t.ratio * 100);
  if (t.breached === true) {
    return {
      id: `threshold-${t.id}`,
      severity: 'danger',
      title: `Prag depășit: ${label}`,
      description: `Valoarea curentă a depășit limita fiscală (${pct}%).`,
      action: `Verifică ${label} și corectează datele.`,
      affectedTax: t.affectedTax ?? '',
      ratio: t.ratio,
    };
  }
  return {
    id: `threshold-${t.id}`,
    severity: 'warning',
    title: `Aproape de prag: ${label}`,
    description: `Valoarea curentă este la ${pct}% din limita fiscală.`,
    action: `Monitorizează ${label} pentru a evita depășirea.`,
    affectedTax: t.affectedTax ?? '',
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

  // 1. Threshold alerts — collect ALL (breached → danger, ratio >= 0.8 → warning),
  //    then collapse CASS/CAS into at most one canonical alert.
  const thresholdAlerts = snapshot.thresholds
    .filter((t) => t.breached === true || (!t.breached && t.ratio >= 0.8))
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
    const date = formatDate(d.date);
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
  //    No insight when no liability data is recorded (projectedLiabilityCents <= 0)
  //    and no insight when the reserve already meets the target (gapCents <= 0).
  const { projectedLiabilityCents, gapCents } = snapshot.taxReserve;
  if (projectedLiabilityCents > 0 && gapCents > 0) {
    const gap = gapCents;
    insights.push({
      id: 'reserve',
      severity: 'warning',
      title: 'Rezervă fiscală sub țintă',
      description: `Diferența față de ținta de rezervă: ${formatCents(gap)}.`,
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
        description: `Estimarea totală a impozitului: ${formatLei(tax.output.total)}.`,
        action: 'Verifică detaliile estimării.',
      });
    }
  }

  // Most urgent first — stable sort keeps natural order within a severity.
  insights.sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
  return insights;
}
