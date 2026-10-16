import { fmtDate } from '../../data/types';
import type { FiscalDateField } from '../../domain/aggregation';
import { fiscalDateSource, moneyDate } from '../../ui/copy';

/**
 * PG-2 — the register row says which date its fiscal year was taken from.
 *
 * `domain/aggregation.ts` attributes a record to a year by `collected ?? date` / `paid ?? date`, and
 * `auditFiscalDates` already reports that choice as `'collected' | 'paid' | 'date'`. Until PG-2 no
 * screen could write either money date, so the choice was invisible: a record could sit in a year the
 * person reading the register did not choose and could not explain. This is that same vocabulary on the
 * row, not a third spelling of it — the prop is typed `FiscalDateField`, so the row cannot drift from
 * what the aggregate did.
 *
 * What the note may say is bounded by `docs/ai/research/37_cash_basis_date_semantics.md` §5. It names
 * the field the app used; it never claims the document date determines the fiscal year, and it never
 * presents the fallback as a legal presumption. When a record has no money date the note reads
 * `data documentului` and the date above it is the document's own — the caveat that this is a display
 * default, not a money date, is the form's `moneyDate.revenueEmpty` / `moneyDate.expenseEmpty` sentence
 * and the RJIP register's own disclosure line.
 */
export interface FiscalDateNoteProps {
  /** Decides „încasat în <an>" versus „plătit în <an>". */
  kind: 'revenue' | 'expense';
  /** The field the fiscal date actually resolved from — the domain's own union. */
  source: FiscalDateField;
  /** The date the aggregate keyed this record to. */
  fiscalDate: string;
  /** The document date: the year this record would have been read as belonging to. */
  documentDate: string;
}

export function FiscalDateNote({ kind, source, fiscalDate, documentDate }: FiscalDateNoteProps) {
  // The year crossing is the case a person needs pointed out: the money moved in a different year from
  // the paper, so the record sits somewhere the document date does not explain.
  const fiscalYear = Number(fiscalDate.slice(0, 4));
  const crossesYear = source !== 'date' && fiscalYear !== Number(documentDate.slice(0, 4));
  const inYear = kind === 'revenue' ? moneyDate.collectedIn : moneyDate.paidIn;
  return (
    <div className="text-sm muted" data-fiscal-date-source={source} style={{ marginTop: 3 }}>
      {fiscalDateSource[source]}
      {source === 'date' ? null : (
        <>
          {`: ${fmtDate(fiscalDate)}`}
          {crossesYear ? ` · ${inYear(fiscalYear)}` : null}
        </>
      )}
    </div>
  );
}
