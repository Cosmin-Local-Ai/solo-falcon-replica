import { fmtDate } from '../../data/types';
import type { LedgerDisclosure } from '../../data/dashboard';
import { BASIS_LABELS } from '../../domain/fx/convert';
import { formatMoney } from '../../domain/money';
import { fx } from '../../ui/copy';
import { Card, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { InterpretationNote } from '../ui/InterpretationNote';

/**
 * Phase 10c (B-37) — the disclosure that makes the one money path checkable.
 *
 * Every lei total on the dashboard is now built on the same normalised ledger the tax estimate reads
 * (`domain/fx/ledger.ts` `normaliseStoredLedger`). A shared boundary is only honest if the user can see
 * what it did, so this card renders both halves of the pass:
 *
 * - **what came in**, with the printed rate, the date the rate is keyed to, the series, the source and the
 *   provisional/final state. A converted figure with no rate beside it is the regression TASK 10a was
 *   written to prevent, so the provenance is on the face of the row, not behind a disclosure.
 * - **what is still out**, with the datum that is missing. This is the half that stops a total reading as
 *   complete: a foreign record with no recorded rate is absent from the lei totals, and saying so here is
 *   the difference between an incomplete figure and a wrong one.
 *
 * Presentational only. It computes nothing: the lists arrive from `data/dashboard.ts getLedgerDisclosure`,
 * which is the same pass the totals were built on.
 */
export interface CurrencySectionProps {
  disclosure: LedgerDisclosure;
  /** Stable id so a test or a screen reader can point at the block. */
  id?: string;
}

export default function CurrencySection({ disclosure, id }: CurrencySectionProps) {
  const { conversions, unconverted } = disclosure;
  const provisional = conversions.filter(c => c.provisional);
  const carried = conversions.filter(c => c.carriedFrom !== undefined);
  const documentAnchored = conversions.filter(c => c.onDateSource === 'date');
  const l = fx.ledger;

  return (
    <Card
      header={
        <CardHeader>
          <CardTitle>{l.title}</CardTitle>
          <CardDescription>{l.lead}</CardDescription>
        </CardHeader>
      }
    >
      <div id={id} data-surface="ledger-currency">
        {conversions.length > 0 ? (
          <>
            <p className="hint">{l.convertedCount(conversions.length)}</p>
            <table className="table">
              <thead>
                <tr>
                  <th>{l.columns.record}</th>
                  <th>{l.columns.original}</th>
                  <th>{l.columns.rate}</th>
                  <th>{l.columns.onDate}</th>
                  <th>{l.columns.basis}</th>
                  <th>{fx.columns.source}</th>
                  <th>{l.columns.status}</th>
                </tr>
              </thead>
              <tbody>
                {conversions.map(c => (
                  <tr key={`${c.recordKind}-${c.recordId}`} data-conversion={c.recordId}>
                    <td>{l.kinds[c.recordKind]}</td>
                    {/* The amount as recorded, in its own currency, then the lei it entered the totals at.
                        Both are printed: the user has to be able to re-do the multiplication by hand. */}
                    <td className="mono">
                      {formatMoney(c.netRecorded)} + {formatMoney(c.vatRecorded)}
                    </td>
                    <td className="mono">{c.rate}</td>
                    <td>{fmtDate(c.onDate)}</td>
                    <td>{BASIS_LABELS[c.basis]}</td>
                    <td>
                      <span>{c.seriesCode}</span>
                      <span className="hint"> · </span>
                      <span>{c.sourceUrl}</span>
                    </td>
                    <td>
                      <span
                        className={`badge ${c.provisional ? 'badge-warning' : 'badge-success'}`}
                        data-provisional={c.provisional ? 'true' : 'false'}
                      >
                        {c.provisional ? fx.provisionalBadge : fx.finalBadge}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : null}

        {unconverted.length > 0 ? (
          <>
            <h3 className="card-title">{l.unconvertedTitle}</h3>
            <p className="hint ledger-unconverted-lead" data-unconverted-count={unconverted.length}>
              <strong className="mono">{l.unconvertedLead(unconverted.length)}</strong> {l.unconvertedTail}
            </p>
            <table className="table">
              <thead>
                <tr>
                  <th>{l.columns.record}</th>
                  <th>{l.columns.currency}</th>
                  <th>{l.columns.original}</th>
                  <th>{l.columns.detail}</th>
                </tr>
              </thead>
              <tbody>
                {unconverted.map(u => (
                  <tr key={`${u.kind}-${u.id}`} data-unconverted={u.id}>
                    <td>{l.kinds[u.kind]}</td>
                    <td>{u.currency}</td>
                    <td className="mono">{formatMoney(u.amount)}</td>
                    <td>{u.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : null}

        {conversions.length === 0 && unconverted.length === 0 ? (
          <p className="hint">{fx.empty}</p>
        ) : null}

        {provisional.length > 0 ? <InterpretationNote note={l.provisionalInTotal} /> : null}

        {carried.map(c => (
          <InterpretationNote
            key={`carry-${c.recordId}`}
            note={`${fx.carriedFrom(c.carriedFrom ?? '')} ${c.citation}`}
          />
        ))}

        {documentAnchored.length > 0 ? <InterpretationNote note={l.anchoredOnDocumentDate} /> : null}
      </div>
    </Card>
  );
}
