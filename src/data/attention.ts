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
 *
 * **B-78 (brief 67):** this function used to end with a third branch that built
 * `/declarations#!/<status>` for a `declaration` kind. PG-5b removed the only producer of that kind, so the
 * branch was already unreachable — and it was the worst kind of dead code, because reaching it would have
 * spliced a retired status word straight into a route segment and linked to a register with no such record
 * in it. It is deleted, and the point below is guarded as unreachable rather than quietly defaulted.
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
  // Unreachable through the type: `RecordKind` has two members and both are handled above. It is reachable
  // from untyped JavaScript — a kind read out of a payload, a hand-edited call — and defaulting to one of
  // the two registers there would send the person to a list that does not hold the record.
  // SAFETY: `r` is `never` here by construction, so the only way to name what arrived is through an
  // unknown; the value is used solely to report it.
  const seen = (r as unknown as { kind?: unknown }).kind;
  throw new RangeError(`recordTarget: unknown record kind ${JSON.stringify(seen)}`);
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
