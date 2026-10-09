import { useDashboardData } from '../data/dashboardAdapter';
import { useStore } from '../data/store';
import { getFinancialSummary } from '../data/dashboard';
import { identityGreeting } from '../domain/profile';
import { fmtDate } from '../data/types';
import { formatBaniRON } from '../domain/money';
import { estimateBasisExplanation, estimateBasisLabel } from '../domain/estimateBasis';
import { copy, dashboard as dashboardCopy } from '../ui/copy';
import { Disclosure } from '../components/ui/Disclosure';
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
  const greeting = identityGreeting(appData.profile.identity);
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
        <h1>{dashboardCopy.title}</h1>
        <span className="muted">
          {dashboardCopy.fiscalYearPrefix} {snapshot.taxYear} {dashboardCopy.updatedAt} {fmtDate(snapshot.asOf)}
        </span>
      </div>
      {/* Phase 7: the greeting reads the same identity store as the sidebar and
          the topbar. It uses the given name, not the full name the topbar shows. */}
      {greeting && <p className="greeting">{dashboardCopy.greeting} {greeting}</p>}

      {!hasData ? (
        <div className="empty-state">
          <h2>{dashboardCopy.onboarding.title}</h2>
          <p>{dashboardCopy.onboarding.body}</p>
          <div className="row">
            <a className="btn btn-primary" href="/revenues">{dashboardCopy.onboarding.addRevenue}</a>
            <a className="btn" href="/expenses">{dashboardCopy.onboarding.addExpense}</a>
          </div>
        </div>
      ) : (
        <>
          {/* 1. Cockpit strip — headline numbers */}
          <div className="grid grid-5">
            <StatCard label={dashboardCopy.cards.revenueYear} value={formatBaniRON(snapshot.pfaRevenue)} />
            <StatCard
              label={dashboardCopy.cards.taxEstimate}
              value={taxTotal === null ? copy.ui.noValue : formatBaniRON(taxTotal)}
              hint={dashboardCopy.cards.taxEstimateHint}
            />
            <StatCard label={dashboardCopy.cards.monthlyReserve} value={formatBaniRON(reserve.recommendedMonthlyReserve)} />
            <StatCard label={dashboardCopy.cards.remainingToSetAside} value={formatBaniRON(reserve.remainingTarget)} />
            <StatCard
              label={dashboardCopy.cards.completeness}
              value={`${completeness.satisfiedCount}/${completeness.totalCount}`}
              hint={dashboardCopy.cards.checksHint}
            />
          </div>

          {/* 2. Tax hero — estimate, completeness, reserve */}
          <SectionCard title={dashboardCopy.estimate.title}>
            <div className="stack">
              <div className="row between">
                {/* Task 1: the label carries the basis, so an annual run-rate figure can never be read as
                    money already collected. `estimateBasisLabel` says YTD only for actuals. */}
                <span className="muted">
                  {estimateBasisLabel(tax.basis)} · {dashboardCopy.fiscalYearPrefix} {snapshot.taxYear}
                </span>
                <span className="muted">
                  {dashboardCopy.estimate.completenessPrefix} {completeness.satisfiedCount}/{completeness.totalCount}
                </span>
              </div>
              <div className="tax-hero-value mono">{taxTotal === null ? copy.ui.noValue : formatBaniRON(taxTotal)}</div>
              <p className="hint">
                {dashboardCopy.estimate.setAsideLead}{' '}
                <strong className="mono">{formatBaniRON(reserve.recommendedMonthlyReserve)}</strong>{' '}
                {dashboardCopy.estimate.setAsideTail}
              </p>
              {/* TASK 7: the arithmetic behind the hero number is collapsed behind a real disclosure —
                  keyboard-operable, state visible, content in the DOM — never behind a hover. The lines
                  themselves are the engine's, with their own citations; nothing here re-derives them. */}
              <Disclosure label={copy.disclosure.breakdown} className="estimate-breakdown">
                {tax.status === 'computed' && tax.lines.length > 0 ? (
                  <table className="breakdown-table">
                    <tbody>
                      {tax.lines.map((line) => (
                        <tr key={line.label}>
                          <th scope="row">{line.label}</th>
                          <td className="mono">{formatBaniRON(line.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
                {/* A run-rate projection is an assumption, not a forecast; the wording says so. */}
                <p className="hint">{estimateBasisExplanation(tax.basis)}</p>
              </Disclosure>
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
            <TaxReserve reserve={data.reserve} onRecord={appData.setReservedAmount} />
            <ThresholdSection thresholds={data.thresholds} />
            <DeadlineSection deadlines={data.deadlines} asOfDate={data.snapshot.asOf} />
            <CompletenessSection completeness={data.completeness} />
            <ActionSection actions={data.actions} />
            <LegislationSection state={data.legislation} />
          </div>
        </>
      )}
    </div>
  );
}
