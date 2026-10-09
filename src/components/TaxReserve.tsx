import { useState } from 'react';
import type { TaxReserveRecommendation } from '../domain/taxReserve';
import { formatBaniRON, leiInputValue, parseLeiInput, type Bani } from '../domain/money';

interface TaxReserveProps {
  reserve: TaxReserveRecommendation;
  /**
   * TASK 3: record (or clear) how much the user has actually set aside. `null` clears back to
   * „no reserve recorded” — it is not the same as recording 0 lei. Omitted means the card is
   * read-only, which is what the presentational tests render.
   */
  onRecord?: (amount: Bani | null) => void;
}

/**
 * The entry control for the persisted reserve.
 *
 * It writes through `parseLeiInput`, so a fraction of a ban is refused rather than rounded, and it
 * never writes on its own initiative: an unrecorded reserve stays unrecorded until the user says
 * otherwise. Clearing is an explicit action, distinct from saving 0.
 */
function ReserveEntry({
  reservedAmount,
  onRecord,
}: {
  reservedAmount: Bani | null;
  onRecord: (amount: Bani | null) => void;
}) {
  const [text, setText] = useState(reservedAmount === null ? '' : leiInputValue(reservedAmount));
  const [refused, setRefused] = useState(false);

  const save = () => {
    const amount = parseLeiInput(text);
    // An unparseable or empty field records nothing. The stored value stays exactly as it was —
    // a blank box is not a claim that the user set aside 0 lei.
    if (amount === null) {
      setRefused(true);
      return;
    }
    setRefused(false);
    onRecord(amount);
  };

  return (
    <div className="reserve-entry">
      <label className="label" htmlFor="reserve-input">
        Cât ai pus deoparte pentru impozit (lei)
      </label>
      <div className="row">
        <input
          id="reserve-input"
          className="input"
          inputMode="decimal"
          value={text}
          placeholder="ex: 1500"
          onChange={(e) => setText(e.target.value)}
        />
        <button type="button" className="btn btn-primary" onClick={save}>
          Salvează
        </button>
        {reservedAmount !== null ? (
          <button
            type="button"
            className="btn"
            onClick={() => {
              setText('');
              setRefused(false);
              onRecord(null);
            }}
          >
            Șterge înregistrarea
          </button>
        ) : null}
      </div>
      {refused ? (
        <div className="hint">
          Suma nu este o valoare validă în lei — nimic nu a fost salvat.
        </div>
      ) : null}
    </div>
  );
}

export default function TaxReserve({ reserve, onRecord }: TaxReserveProps) {
  const liability = reserve.estimatedTaxLiability;

  return (
    <section className="card">
      <div className="card-head">
        <h2 className="card-title">Rezervă fiscală</h2>
      </div>
      <div className="card-body">
        {liability === null ? (
          <p className="hint">
            Nu există o estimare fiscală disponibilă — rezerva recomandată nu poate fi calculată.
          </p>
        ) : (
          <>
            <div className="stat-card">
              <div className="label">Recomandat de pus deoparte lunar</div>
              <div className="tax-hero-value mono">{formatBaniRON(reserve.recommendedMonthlyReserve)}</div>
              <div className="hint">
                {reserve.remainingTarget > 0
                  ? reserve.monthsRemaining > 0
                    ? `Rămâne de pus deoparte ${formatBaniRON(reserve.remainingTarget)} în următoarele ${reserve.monthsRemaining} luni.`
                    : `Rămâne de pus deoparte ${formatBaniRON(reserve.remainingTarget)}.`
                  : 'Rezerva este complet acoperită.'}
              </div>
            </div>
            <div className="grid grid-2">
              <div className="stat-card">
                <div className="label">Rezervat deja</div>
                {reserve.reservedAmount === null ? (
                  <>
                    <div className="value mono">—</div>
                    <div className="hint">Nicio sumă înregistrată.</div>
                  </>
                ) : (
                  <div className={reserve.reservedAmount < 0 ? 'value mono neg' : 'value mono'}>
                    {formatBaniRON(reserve.reservedAmount)}
                  </div>
                )}
              </div>
              <div className="stat-card">
                <div className="label">Estimare obligație fiscală</div>
                <div className="hint mono">{formatBaniRON(liability)}</div>
              </div>
            </div>
          </>
        )}
        {onRecord ? (
          // Keyed by the stored value so the field re-seeds itself after a save or a clear instead of
          // keeping text that no longer matches what is stored.
          <ReserveEntry
            key={reserve.reservedAmount === null ? 'unrecorded' : String(reserve.reservedAmount)}
            reservedAmount={reserve.reservedAmount}
            onRecord={onRecord}
          />
        ) : null}
      </div>
    </section>
  );
}
