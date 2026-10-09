/**
 * TASK 8 — the record family of the attention model, and the one place the two attention pipelines
 * are reconciled.
 *
 * The four genuinely unresolved records in the seed (`r2` awaiting e-Factura acceptance, `r3` rejected
 * with `CUI nevalid`, `e3` rejected with `Document neconform`, `d2` registered on 2026-07-08 with no
 * submission) produced nothing at all before this: `insights.ts` emitted only `reserve`,
 * `completeness`, `tax` and `fiscal-dates`, and `getActionItems` only deadlines, completeness keys and
 * a tax-review row. A user could have a rejected invoice on the register and read the dashboard as
 * clear.
 *
 * This module is presentation, not recalculation. `aggregation.ts` sums only `status === 'inregistrata'`
 * records and `estimateBasis.ts` classifies only `status === 'inregistrata'` expenses, so these records
 * are already out of every total and every cap. Nothing here re-reads them into a figure: the amounts
 * are carried on the fact for identification and are never summed. If surfacing one of these moved a
 * money figure, that would be a calculation change, not a dashboard change.
 *
 * The sentences come from `src/ui/copy/attention.ts`. The decisions — which records are unresolved, and
 * how urgent each is — come from `src/domain/attention.ts`. This file holds neither.
 */
import { unresolvedRecords, type AttentionItem, type UnresolvedRecord } from '../domain/attention';
import { attention as attentionCopy } from '../ui/copy';
import type { AppData } from './types';

/**
 * The route that holds the record. Each register page keys its tabs off the record's own status, so
 * the tab is not guessed: it is the status the record carries. `?f=<id>` is the focus token the page
 * consumes to land the table on that one record (`src/App.tsx parseRoute`).
 */
function recordTarget(r: UnresolvedRecord): AttentionItem['target'] {
  const focus = `?f=${encodeURIComponent(r.id)}`;
  if (r.kind === 'revenue') {
    const tab = r.status === 'respinsa' ? 'rejected' : 'pending';
    return { href: `/revenues#!/${tab}${focus}`, record: { kind: 'revenue', id: r.id, reference: r.reference } };
  }
  if (r.kind === 'expense') {
    return { href: `/expenses#!/rejected${focus}`, record: { kind: 'expense', id: r.id, reference: r.reference } };
  }
  return {
    href: `/declarations#!/${r.status}${focus}`,
    record: { kind: 'declaration', id: r.id, reference: r.reference },
  };
}

function toAttentionItem(r: UnresolvedRecord): AttentionItem {
  const target = recordTarget(r);

  if (r.state === 'rejected') {
    const isRevenue = r.kind === 'revenue';
    return {
      id: `record-${r.kind}-${r.id}`,
      severity: r.severity,
      state: r.state,
      source: r.kind,
      title: isRevenue
        ? attentionCopy.titles.rejectedRevenue(r.reference)
        : attentionCopy.titles.rejectedExpense(r.reference),
      description: isRevenue
        ? attentionCopy.descriptions.rejectedRevenue(r.reference, r.date, r.reason)
        : attentionCopy.descriptions.rejectedExpense(r.reference, r.date, r.reason),
      action: r.reason
        ? attentionCopy.actions.rejectedWithReason(r.reason)
        : attentionCopy.actions.rejected,
      target,
    };
  }

  if (r.state === 'awaiting_acceptance') {
    return {
      id: `record-${r.kind}-${r.id}`,
      severity: r.severity,
      state: r.state,
      source: r.kind,
      title: attentionCopy.titles.awaitingRevenue(r.reference),
      // The reason is the e-Factura status the record itself carries. With no status recorded the
      // sentence says only that the transmission is unconfirmed — it does not invent one.
      description: r.eFacturaStatus
        ? attentionCopy.descriptions.awaitingRevenueWithStatus(r.reference, r.date, r.eFacturaStatus)
        : attentionCopy.descriptions.awaitingRevenue(r.reference, r.date),
      action: attentionCopy.actions.awaiting,
      target,
    };
  }

  return {
    id: `record-${r.kind}-${r.id}`,
    severity: r.severity,
    state: r.state,
    source: r.kind,
    title: attentionCopy.titles.notSubmittedDeclaration(r.reference),
    description: attentionCopy.descriptions.notSubmittedDeclaration(r.reference, r.date),
    action: attentionCopy.actions.notSubmitted,
    target,
  };
}

/**
 * Every record whose own status says it is not settled, as an attention item. A record that has since
 * been corrected or submitted stops appearing — resolved items leave the surfaces, they are not
 * greyed out in them.
 */
export function recordAttentionItems(data: AppData): AttentionItem[] {
  return unresolvedRecords(data).map(toAttentionItem);
}
