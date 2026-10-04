import type { TaxReserveRecommendation } from '../domain/taxReserve';
import { fmtRON } from '../data/types';

interface TaxReserveProps {
  reserve: TaxReserveRecommendation;
}

export default function TaxReserve({ reserve }: TaxReserveProps) {
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
              <div className="tax-hero-value mono">{fmtRON(reserve.recommendedMonthlyReserve)}</div>
              <div className="hint">
                {reserve.remainingTarget > 0
                  ? reserve.monthsRemaining > 0
                    ? `Rămâne de pus deoparte ${fmtRON(reserve.remainingTarget)} în următoarele ${reserve.monthsRemaining} luni.`
                    : `Rămâne de pus deoparte ${fmtRON(reserve.remainingTarget)}.`
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
                    {fmtRON(reserve.reservedAmount)}
                  </div>
                )}
              </div>
              <div className="stat-card">
                <div className="label">Estimare obligație fiscală</div>
                <div className="hint mono">{fmtRON(liability)}</div>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
