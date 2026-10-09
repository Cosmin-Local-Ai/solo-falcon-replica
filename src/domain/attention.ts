/**
 * TASK 8 — the shared attention model.
 *
 * Before this module there were two attention types and neither could say what it meant:
 *
 *   - `Insight` (`domain/insights.ts`) carried `severity: 'info' | 'warning' | 'danger'` and nothing
 *     else about the thing it reported. Legal status, urgency and the kind of record were fused into
 *     that one word, so the type could not express **legally load-bearing but not urgent** (a
 *     contribution floor whose level is in play, 200 days from any date) or **urgent but purely
 *     administrative** (a missing profile field, no legal consequence at all).
 *   - `ActionItem` (`data/dashboard.ts`) carried `id`, `label` and `source` — no severity at all —
 *     and was computed from the same underlying data by a second, independent pipeline. The two
 *     pipelines could, and did, describe the same problem twice.
 *
 * `AttentionItem` separates four dimensions and nothing here collapses one into another:
 *
 *   1. `severity` — how urgent this is **for this user**, on the same four-level scale the threshold
 *      rows already use (`ThresholdSeverity`). It is decided in the domain, per family, and the
 *      render layer styles from it without re-deriving it.
 *   2. `state` — what the item *is*: a rejected document, a submission awaiting a third party, a
 *      level in play, a withheld conclusion. This is the dimension `severity` used to stand in for.
 *   3. `source` — where it came from: which record, which engine.
 *   4. `title` / `description` / `action` / `target` — what it says, and where the person goes to act.
 *
 * The deduplication rule lives in `surfaceFor` and `partitionAttention` below, and it is the only
 * place it can live: one item is routed to exactly one surface, so one problem can never produce
 * both a card and an action.
 */
import type { ThresholdSeverity } from './thresholds';
import { money, type Bani, type Money } from './money';
import type { SnapshotRuleProvenance } from './snapshots/ruleProvenance';

/**
 * Dimension 1. Deliberately the SAME union the threshold rows use (TASK 4), so there is one urgency
 * scale in the app rather than a three-level one for insights and a four-level one for thresholds.
 * `none` means "no attention now" and is filtered out before anything reaches a surface — it is not
 * a soft `low`.
 */
export type AttentionSeverity = ThresholdSeverity;

/**
 * Dimension 2 — what the item is, independent of how urgent it is.
 *
 * `level_engaged` and `estimate_review_required` are legally load-bearing; `data_missing` is not.
 * Both can carry any severity. Keeping them in this field rather than in `severity` is the whole
 * point of the model.
 */
export type AttentionState =
  /** A record was rejected, and the record itself states why. */
  | 'rejected'
  /** A record was submitted somewhere (e-Factura, ANAF) and no acceptance has come back. */
  | 'awaiting_acceptance'
  /** A record exists in the app but no submission is recorded for it. */
  | 'not_submitted'
  /** A completeness check is unsatisfied: a fact the app does not hold. */
  | 'data_missing'
  /** A filing term is ahead of the user. */
  | 'deadline_open'
  /** A filing term has passed or is due today. */
  | 'deadline_overdue'
  /** A fiscal level is in play for this taxpayer; the row carries the legal consequence. */
  | 'level_engaged'
  /** A fiscal level is not in play yet but the measured value is inside the display band. */
  | 'level_approaching'
  /** A threshold row could not be measured; the row carries the reason. */
  | 'level_review_required'
  /** The engine ran and withheld a conclusion. Never resolved here. */
  | 'estimate_review_required'
  /** The reserve falls short of the target the app computed. */
  | 'reserve_shortfall'
  /** A stored date is not a usable calendar date, so the record sits out of every period total. */
  | 'record_date_unusable';

/** Dimension 3 — where the item came from. */
export type AttentionSource =
  | 'revenue'
  | 'expense'
  | 'declaration'
  | 'threshold'
  | 'deadline'
  | 'completeness'
  | 'tax'
  | 'reserve'
  | 'integrity';

/**
 * Dimension 4 (the actionable half) — where the person goes. `href` is a route this app's own router
 * understands; `record` is set when the route lands on one specific record, and `reference` is the
 * label the record carries in its own register (invoice number, `2026-06`), so the link can be read
 * without opening it.
 *
 * There is no `label` field on purpose: the words on a link belong to the language layer
 * (`copy.actions.openTarget`), and a target that carried its own sentence would be a second home for
 * the same phrase.
 */
export interface AttentionTarget {
  href: string;
  record?: {
    kind: 'revenue' | 'expense' | 'declaration';
    id: string;
    reference: string;
  };
}

export interface AttentionItem {
  id: string;
  severity: AttentionSeverity;
  state: AttentionState;
  source: AttentionSource;
  title: string;
  description: string;
  /** What to do, in one sentence. Optional: some items only need to be seen. */
  action?: string;
  /** Where to do it. `null` when there is no surface in this app to act on. */
  target: AttentionTarget | null;
  /**
   * TASK 9 — which rule package stands behind the figure this row is about, and whether the digest the
   * record carries still verifies. Attached by the data layer (`getAttentionItems`), never by a
   * component, and only for the families that report a computed figure (`FIGURE_SOURCES` below). A row
   * about a document or a date has no calculation behind it and carries `null` — that is not a missing
   * value to fill in, it is the honest answer.
   */
  provenance?: SnapshotRuleProvenance | null;
}

/**
 * TASK 9 — the attention families whose row reports a **computed figure**, and so can be attributed to
 * a rule package: the estimate itself, the reserve built from it, and the threshold rows measured
 * against the registered rules. A rejected invoice or an open deadline is not a computed figure and gets
 * no provenance line, because attaching one would claim a calculation that never happened.
 */
export const FIGURE_SOURCES: readonly AttentionSource[] = ['tax', 'reserve', 'threshold'];

export function isFigureSource(source: AttentionSource): boolean {
  return FIGURE_SOURCES.includes(source);
}

// ── The deduplication rule ────────────────────────────────
//
// One item, one surface. An item whose state describes something the user still has to DO is an
// action; an item whose state describes a fact the user has to KNOW is an observation. There is no
// configuration at the call site and no per-id exception, so the same problem cannot appear twice.

export type AttentionSurface = 'observation' | 'action';

const ACTION_STATES: readonly AttentionState[] = [
  'rejected',
  'awaiting_acceptance',
  'not_submitted',
  'data_missing',
  'deadline_open',
  'deadline_overdue',
];

export function surfaceFor(state: AttentionState): AttentionSurface {
  return ACTION_STATES.includes(state) ? 'action' : 'observation';
}

export interface AttentionSurfaces {
  observations: AttentionItem[];
  actions: AttentionItem[];
}

/**
 * Most urgent first, stable inside a level — the same ordering rule `insights.ts` had, widened to the
 * four-level scale.
 */
export function attentionRank(severity: AttentionSeverity): number {
  switch (severity) {
    case 'high':
      return 0;
    case 'medium':
      return 1;
    case 'low':
      return 2;
    case 'none':
      return 3;
  }
}

export function sortAttention(items: readonly AttentionItem[]): AttentionItem[] {
  return [...items].sort((a, b) => attentionRank(a.severity) - attentionRank(b.severity));
}

/**
 * Two producers that describe the same problem arrive with the same `id`. The more severe copy wins,
 * and the loser is dropped — never merged, because merging two descriptions invents a third sentence
 * neither producer wrote.
 */
export function dedupeAttention(items: readonly AttentionItem[]): AttentionItem[] {
  const byId = new Map<string, AttentionItem>();
  for (const item of items) {
    const existing = byId.get(item.id);
    if (existing === undefined || attentionRank(item.severity) < attentionRank(existing.severity)) {
      byId.set(item.id, item);
    }
  }
  return [...byId.values()];
}

/**
 * The single routing point. `severity: 'none'` never reaches a surface: a row the domain marked as
 * needing no attention is not a milder alert, it is not an alert.
 */
export function partitionAttention(items: readonly AttentionItem[]): AttentionSurfaces {
  const observations: AttentionItem[] = [];
  const actions: AttentionItem[] = [];
  for (const item of dedupeAttention(items)) {
    if (item.severity === 'none') continue;
    if (surfaceFor(item.state) === 'action') actions.push(item);
    else observations.push(item);
  }
  return { observations: sortAttention(observations), actions: sortAttention(actions) };
}

// ── The record family ─────────────────────────────────────
//
// The four seed records that were genuinely unresolved (`r2`, `r3`, `e3`, `d2`) produced no attention
// item at all: `insights.ts` emitted only `reserve`, `completeness`, `tax` and `fiscal-dates`, and
// `getActionItems` only deadlines, completeness keys and a tax-review row. A user looking at the
// dashboard saw nothing actionable about a rejected invoice, a rejected expense document, an e-Factura
// submission still waiting, or a declaration with no recorded submission.
//
// This is presentation, not recalculation. `aggregation.ts` aggregates only `status === 'inregistrata'`
// records and `estimateBasis.ts` classifies only `status === 'inregistrata'` expenses, so a rejected
// record is already out of every total; surfacing it moves no figure, and nothing here re-reads or
// re-adds it.

export type RecordKind = 'revenue' | 'expense' | 'declaration';

export interface UnresolvedRecord {
  kind: RecordKind;
  id: string;
  /** The label the record carries in its own register — invoice number, or `2026-06`. */
  reference: string;
  /** The record's own status code, carried so the target can land on the tab that holds it. */
  status: string;
  date: string;
  state: Extract<AttentionState, 'rejected' | 'awaiting_acceptance' | 'not_submitted'>;
  severity: AttentionSeverity;
  /**
   * The reason the RECORD states, verbatim (`statusDetail`). `null` when the record holds no reason —
   * in that case nothing here invents one, and the description says only what the status says.
   */
  reason: string | null;
  /** The e-Factura status, when the record carries one. Verbatim, never inferred. */
  eFacturaStatus: string | null;
  registeredOn: string | null;
  submittedOn: string | null;
  /**
   * The record's own net amount, **in the currency the record is written in**. Carried for the register,
   * never summed here.
   *
   * TASK 10a: a rejected EUR invoice has to show its EUR amount, not a lei number it never had. A
   * declaration is always lei — the Declarația Unică is filed in lei — so its row carries `RON` explicitly
   * rather than an unqualified number.
   */
  amountNet: Money;
}

interface RecordSource {
  revenues: readonly {
    id: string;
    nr: string;
    date: string;
    status: string;
    statusDetail?: string;
    eFacturaStatus?: string;
    valoareFaraTva: Money;
  }[];
  expenses: readonly {
    id: string;
    nr: string;
    date: string;
    status: string;
    statusDetail?: string;
    valoareFaraTva: Money;
  }[];
  declarations: readonly {
    id: string;
    an: number;
    luna: number;
    status: string;
    dataInregistrare: string;
    dataTrimitere?: string;
    venituri: Bani;
  }[];
}

/**
 * Severity for a record, decided once. It is NOT read off `status`: a rejected income document and a
 * rejected expense document are the same state at different severities, because the first leaves
 * income undocumented and the second only leaves a document out of a subset the engine already
 * excluded. A record awaiting a third party is unresolved without being a defect.
 */
function recordSeverity(
  kind: RecordKind,
  state: UnresolvedRecord['state'],
): AttentionSeverity {
  if (state === 'rejected') return kind === 'revenue' ? 'high' : 'medium';
  if (state === 'awaiting_acceptance') return 'medium';
  return 'medium';
}

function periodLabel(an: number, luna: number): string {
  return `${an}-${String(luna).padStart(2, '0')}`;
}

/**
 * Every record whose own status says it is not settled. `inregistrata` / `transmisa` are settled and
 * produce nothing: a resolved item leaves the surfaces.
 */
export function unresolvedRecords(data: RecordSource): UnresolvedRecord[] {
  const out: UnresolvedRecord[] = [];

  for (const r of data.revenues) {
    if (r.status === 'respinsa') {
      out.push({
        kind: 'revenue',
        id: r.id,
        reference: r.nr,
        status: r.status,
        date: r.date,
        state: 'rejected',
        severity: recordSeverity('revenue', 'rejected'),
        reason: r.statusDetail ?? null,
        eFacturaStatus: r.eFacturaStatus ?? null,
        registeredOn: null,
        submittedOn: null,
        amountNet: r.valoareFaraTva,
      });
    } else if (r.status === 'in-asteptare') {
      out.push({
        kind: 'revenue',
        id: r.id,
        reference: r.nr,
        status: r.status,
        date: r.date,
        state: 'awaiting_acceptance',
        severity: recordSeverity('revenue', 'awaiting_acceptance'),
        reason: r.statusDetail ?? null,
        eFacturaStatus: r.eFacturaStatus ?? null,
        registeredOn: null,
        submittedOn: null,
        amountNet: r.valoareFaraTva,
      });
    }
  }

  for (const e of data.expenses) {
    if (e.status === 'respinsa') {
      out.push({
        kind: 'expense',
        id: e.id,
        reference: e.nr,
        status: e.status,
        date: e.date,
        state: 'rejected',
        severity: recordSeverity('expense', 'rejected'),
        reason: e.statusDetail ?? null,
        eFacturaStatus: null,
        registeredOn: null,
        submittedOn: null,
        amountNet: e.valoareFaraTva,
      });
    }
  }

  for (const d of data.declarations) {
    // `transmisa` carries a submission date and is settled, and so does `inregistrata`: the app holds
    // no expectation that a merely-registered declaration was due to be filed, so calling it
    // unresolved would invent a reason the record does not state. `in-asteptare` and `respinsa` are the
    // record's own "not settled" markers — the same words the revenue register uses.
    if (d.status !== 'in-asteptare' && d.status !== 'respinsa') continue;
    if (d.dataTrimitere) continue;
    out.push({
      kind: 'declaration',
      id: d.id,
      reference: periodLabel(d.an, d.luna),
      status: d.status,
      date: d.dataInregistrare,
      state: d.status === 'respinsa' ? 'rejected' : 'not_submitted',
      severity: recordSeverity('declaration', d.status === 'respinsa' ? 'rejected' : 'not_submitted'),
      reason: null,
      eFacturaStatus: null,
      registeredOn: d.dataInregistrare,
      submittedOn: d.dataTrimitere ?? null,
      amountNet: money(d.venituri, 'RON'),
    });
  }

  return out;
}

// ── Severity for the deadline family ──────────────────────
//
// Decided in the domain, from the distance the deadline engine already computed — the same shape as
// `thresholds.ts` `severityFor`, and subject to the same rule: the render layer must never redo this.
// A term 200 days away is a legal duty and is NOT urgent; a term that has passed is.

export function deadlineSeverity(daysUntil: number): AttentionSeverity {
  if (!Number.isFinite(daysUntil)) return 'none';
  if (daysUntil <= 0) return 'high';
  if (daysUntil <= 7) return 'high';
  if (daysUntil <= 30) return 'medium';
  return 'low';
}
