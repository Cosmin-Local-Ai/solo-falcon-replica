import { useDashboardData } from '../data/dashboardAdapter';
import { useStore } from '../data/store';
import { getFinancialSummary } from '../data/dashboard';
import { fmtRON, fmtDate } from '../data/types';
import FinancialChart from '../components/FinancialChart';
import FinancialSummary from '../components/FinancialSummary';
import TaxReserve from '../components/TaxReserve';
import Insights from '../components/Insights';
import ThresholdSection from '../components/dashboard/ThresholdSection';
import DeadlineSection from '../components/dashboard/DeadlineSection';
import CompletenessSection from '../components/dashboard/CompletenessSection';
import ActionSection from '../components/dashboard/ActionSection';
import LegislationSection from '../components/dashboard/LegislationSection';

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="stat-card">
      <div className="label">{label}</div>
      <div className="value mono">{value}</div>
      {hint ? <div className="hint">{hint}</div> : null}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card">
      <div className="card-head">
        <h2 className="card-title">{title}</h2>
      </div>
      <div className="card-body">{children}</div>
    </section>
  );
}

export default function DashboardPage() {
  const data = useDashboardData();
  const { snapshot, tax, completeness, reserve, pendingCounts } = data;
  const appData = useStore();
  const summary = getFinancialSummary(appData, snapshot.asOf);

  const hasData =
    snapshot.pfaRevenue > 0 ||
    pendingCounts.revenuesInAsteptare > 0 ||
    pendingCounts.revenuesRespinsa > 0 ||
    pendingCounts.expensesRespinsa > 0;

  const taxTotal = tax.status === 'computed' ? tax.output.total : null;

  return (
    <div className="dashboard">
      <div className="row between">
        <h1>Tablou de bord</h1>
        <span className="muted">
          An fiscal {snapshot.taxYear} · actualizat la {fmtDate(snapshot.asOf)}
        </span>
      </div>

      {!hasData ? (
        <div className="empty-state">
          <h2>Începe înregistrarea activității</h2>
          <p>
            Adaugă prima factură de venit și prima cheltuială pentru a vedea estimarea taxelor, termenele
            limită și recomandarea de rezervă lunară.
          </p>
          <div className="row">
            <a className="btn btn-primary" href="/revenues">Adaugă un venit</a>
            <a className="btn" href="/expenses">Adaugă o cheltuială</a>
          </div>
        </div>
      ) : (
        <>
          {/* 1. Cockpit strip — headline numbers */}
          <div className="grid grid-5">
            <StatCard label="Venituri PFA (an)" value={fmtRON(snapshot.pfaRevenue)} />
            <StatCard
              label="Impozit estimat"
              value={taxTotal === null ? '—' : fmtRON(taxTotal)}
              hint="de pus deoparte"
            />
            <StatCard label="Rezervă lunară" value={fmtRON(reserve.recommendedMonthlyReserve)} />
            <StatCard label="Rămâne de pus deoparte" value={fmtRON(reserve.remainingTarget)} />
            <StatCard
              label="Date complete"
              value={`${completeness.satisfiedCount}/${completeness.totalCount}`}
              hint="verificări"
            />
          </div>

          {/* 2. Tax hero — estimate, completeness, reserve, calculation access */}
          <SectionCard title="Estimare impozit">
            <div className="stack">
              <div className="row between">
                <span className="muted">ESTIMARE · An fiscal {snapshot.taxYear}</span>
                <span className="muted">
                  Date complete: {completeness.satisfiedCount}/{completeness.totalCount}
                </span>
              </div>
              <div className="tax-hero-value mono">{taxTotal === null ? '—' : fmtRON(taxTotal)}</div>
              <p className="hint">
                Impozit estimat de pus deoparte. Pune deoparte{' '}
                <strong className="mono">{fmtRON(reserve.recommendedMonthlyReserve)}</strong> pe lună.
              </p>
              <a className="btn" href="/calcul">Deschide calculul</a>
            </div>
          </SectionCard>

          {/* 3. Financial graph (Step 20) */}
          <FinancialChart />

          {/* 4. Summary (Step 21) */}
          <FinancialSummary summary={summary} />

          {/* 5. Insights (Step 21) */}
          <Insights insights={data.insights} />

          {/* 6. Lower sections — Rezervă fiscală (Step 21); thresholds, deadlines, completeness, actions (Step 22) */}
          <div className="grid grid-2">
            <TaxReserve reserve={data.reserve} />
            <ThresholdSection thresholds={data.thresholds} />
            <DeadlineSection deadlines={data.deadlines} asOfDate={data.snapshot.asOf} />
            <CompletenessSection completeness={data.completeness} />
            <ActionSection pendingCounts={data.pendingCounts} />
            <LegislationSection state={data.legislation} />
          </div>
        </>
      )}
    </div>
  );
}
