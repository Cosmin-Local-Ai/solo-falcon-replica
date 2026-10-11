import { useDashboardData } from '../data/dashboardAdapter';
import { useStore } from '../data/store';
import { getFinancialSummary, type TaxEstimateState } from '../data/dashboard';
import { isGapReason } from '../domain/estimateBasis';
import { identityGreeting } from '../domain/profile';
import { fmtDate } from '../data/types';
import { formatBaniRON } from '../domain/money';
import { estimateBasisExplanation, estimateBasisLabel, estimateForecastExplanation, estimateForecastLabel } from '../domain/estimateBasis';
import { copy, dashboard as dashboardCopy, estimateState as estimateStateCopy, provenance as provenanceCopy, scenarios as scenariosCopy } from '../ui/copy';
import { Disclosure } from '../components/ui/Disclosure';
import { RuleProvenance } from '../components/ui/RuleProvenance';
import FinancialChart from '../components/FinancialChart';
import FinancialSummary from '../components/FinancialSummary';
import TaxReserve from '../components/TaxReserve';
import Insights from '../components/Insights';
import CurrencySection from '../components/dashboard/CurrencySection';
import EstimateCoverageRows from '../components/dashboard/EstimateCoverage';
import ScenarioRefusal from '../components/dashboard/ScenarioRefusal';
import { YearLifecycleBanner } from '../components/dashboard/YearLifecycleBanner';
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
      <div className="card-header">
        <h2 className="card-title">{title}</h2>
      </div>
      <div className="card-body">{children}</div>
    </section>
  );
}

/**
 * TASK 8 — the estimate is rendered from `estimateState`, and its states are visually distinct: a
 * computed figure carries a `Calculat` badge, a withheld conclusion carries `De verificat` plus the
 * engine's own reason, and the absence of any calculation carries `Indisponibil` and no number at all.
 * They are not one number with a footnote, and none of them is styled from anything but the state.
 *
 * PG-1 adds `Estimare incompletă` — the state the old `Calculat` covered up. A figure that leaves a
 * recorded record out is not wrong, and it is not finished either, so it gets its own colour rather
 * than the success green of a figure that describes everything.
 */
function estimateStateBadgeClass(state: TaxEstimateState): string {
  if (state === 'complete') return 'badge-success';
  if (state === 'incomplete' || state === 'review_required') return 'badge-warning';
  if (state === 'refused') return 'badge-danger';
  return 'badge-neutral';
}

export default function DashboardPage() {
  const data = useDashboardData();
  const { snapshot, completeness, reserve } = data;
  const appData = useStore();
  const greeting = identityGreeting(appData.profile.identity);
  const summary = getFinancialSummary(appData, snapshot.asOf);

  // B-68 and B-37, settled by asking a different question.
  //
  // Every earlier version of this gate inferred "is there anything here?" from a NUMBER — first
  // `snapshot.pfaRevenue > 0`, then that plus the pending and rejected counts, then that plus the
  // unconverted ledger (Phase 10c). Each time, a ledger that EXISTS but is EXCLUDED produced zero and the
  // page told the user to go record something: a EUR invoice with no rate (B-37), a rejected document, a
  // record dated outside the fiscal year. B-68 is the standing name for that class, and the fix is not one
  // more term — it is to stop inferring existence from an aggregate.
  //
  // The card's own sentence is "no revenue or expense recorded", so the gate is now that sentence: are the
  // registers empty? A record the totals leave out keeps the card away, by construction.
  const hasRecords = appData.revenues.length > 0 || appData.expenses.length > 0;

  // Acceptance 3: the hero's incomplete-profile state is read out of the SAME report the completeness
  // card renders — `assessCompleteness`, via `useDashboardData`. A second predicate would be a second
  // completeness model, which is what this file's own header has warned against since Step 17.
  const profileIncomplete =
    completeness.checks.find(c => c.key === 'profile')?.satisfied === false;

  const taxTotal =
    data.tax !== null && data.tax.status === 'computed' ? data.tax.output.total : null;
  const estimateState = data.estimateState;
  // PG-5C — the run-rate forecast, if the model has months left to project into. It is read here for one
  // reason: to be shown beside the hero, labelled, and visibly not the hero. Nothing on this page feeds
  // it to a figure; `basis.actual` is the only quantity the estimate and the thresholds were built from,
  // and `estimateBasis.actualsBasis.test.ts` proves the operand type cannot accept anything else.
  const forecast =
    data.tax !== null && data.tax.basis.kind === 'recorded-actuals'
      ? data.tax.basis.forecast
      : undefined;
  // PG-6a — the scenario that stopped the calculation, if one did. It is read off the basis the
  // assembler stamped, not re-derived here: `estimateBasis.ts selectEstimateOperands` is the one place
  // the registry runs, and a page that ran it a second time would be a second answer to one question.
  const refusal =
    data.tax !== null && data.tax.basis.kind === 'refused' ? data.tax.basis.scenario : null;

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

      {/* PG-4 (D-YEAR-1): the year the cockpit is speaking about is stated, not assumed. On 1 January
          the year advances automatically; a year this build has no rules for says so in words rather
          than through an em dash or a figure carried over from the year before. */}
      <YearLifecycleBanner year={data.year} />

      {/* Phase 11: the zero-record card no longer gates the page. It reports the absence and points at the
          two registers that would fill it; everything below renders regardless, because a deadline does not
          stop existing because the ledger is empty (B-68). */}
      {!hasRecords && (
        <div className="empty-state" data-empty-state>
          <h2>{dashboardCopy.noRecords.title}</h2>
          <p>{dashboardCopy.noRecords.body}</p>
          <div className="row">
            <a className="btn btn-primary" href="/revenues">{dashboardCopy.noRecords.addRevenue}</a>
            <a className="btn" href="/expenses">{dashboardCopy.noRecords.addExpense}</a>
          </div>
        </div>
      )}

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
              {/* Acceptance 3: while the required profile facts are missing the hero says so in its own
                  voice, and the estimate below it stays uncomputed. The app does not fill a gap in the
                  profile with an assumption and print a number over it. */}
              {profileIncomplete && (
                <div className="complete-profile" data-complete-profile>
                  <a className="btn btn-primary" href="/settings#!/fiscal">
                    {dashboardCopy.estimate.completeProfile}
                  </a>
                  <p className="hint">{dashboardCopy.estimate.completeProfileBody}</p>
                </div>
              )}
              <div className="row between">
                {/* Task 1: the label carries the basis, so an annual run-rate figure can never be read as
                    money already collected. `estimateBasisLabel` says YTD only for actuals. With no
                    calculation there is no basis to name, so the state word stands in for it.
                    PG-4: a CLOSED year has no basis to name either — its figure is the year's own actuals,
                    so it is labelled as a final calculation for that year, not as a run rate. */}
                <span className="muted">
                  {data.year.closed
                    ? dashboardCopy.estimate.finalCalculation(data.year.year)
                    : refusal
                      ? estimateStateCopy.badges.refused
                      : data.tax
                        ? estimateBasisLabel(data.tax.basis)
                        : estimateStateCopy.badges[estimateState]}{' '}
                  · {dashboardCopy.fiscalYearPrefix} {snapshot.taxYear}
                  {' · '}
                  {/* A refused estimate measured nothing, so the date beside it names the reading of the
                      register rather than a measurement that never happened. */}
                  {refusal
                    ? scenariosCopy.registerReadAsOf(fmtDate(snapshot.asOf))
                    : dashboardCopy.estimate.measuredAsOf(fmtDate(snapshot.asOf))}
                </span>
                <span className="row">
                  <span className="muted">
                    {dashboardCopy.estimate.completenessPrefix} {completeness.satisfiedCount}/{completeness.totalCount}
                  </span>
                  <span
                    className={`badge estimate-state ${estimateStateBadgeClass(estimateState)}`}
                    data-estimate-state={estimateState}
                  >
                    {estimateStateCopy.badges[estimateState]}
                  </span>
                </span>
              </div>
              <div className="tax-hero-value mono">{taxTotal === null ? copy.ui.noValue : formatBaniRON(taxTotal)}</div>
              {estimateState === 'complete' ? (
                <p className="hint">{estimateStateCopy.complete}</p>
              ) : (
                <p className="hint estimate-state-note" data-estimate-state={estimateState}>
                  {estimateState === 'incomplete'
                    ? (data.coverage.filter(g => isGapReason(g.reason)).length === 1
                        ? estimateStateCopy.incompleteOne
                        : estimateStateCopy.incompleteMany(data.coverage.filter(g => isGapReason(g.reason)).length))
                    : estimateState === 'refused'
                      ? estimateStateCopy.refused
                      : estimateState === 'review_required'
                        ? estimateStateCopy.reviewRequired
                        : estimateStateCopy.unavailable}
                </p>
              )}
              {/* PG-6a — the refusal says what could not be computed, in the rule's own words, and points
                  at the control that fixes it. It sits above the coverage rows because a refusal is not a
                  coverage problem: there is no figure for records to be missing from. */}
              {refusal ? <ScenarioRefusal scenario={refusal} /> : null}
              {/* PG-1: the badge says the figure is incomplete; these rows say which records, for which
                  reason, at which amount, and where to fix each one. Without them the badge is a warning
                  with nothing to act on. */}
              <EstimateCoverageRows coverage={data.coverage} />
              {estimateState === 'complete' ? (
                <p className="hint">
                  {dashboardCopy.estimate.setAsideLead}{' '}
                  <strong className="mono">{formatBaniRON(reserve.recommendedMonthlyReserve)}</strong>{' '}
                  {dashboardCopy.estimate.setAsideTail}
                </p>
              ) : null}
              {/* TASK 7: the arithmetic behind the hero number is collapsed behind a real disclosure —
                  keyboard-operable, state visible, content in the DOM — never behind a hover. The lines
                  themselves are the engine's, with their own citations; nothing here re-derives them. */}
              <Disclosure label={copy.disclosure.breakdown} className="estimate-breakdown">
                {data.tax !== null && data.tax.status === 'computed' && data.tax.lines.length > 0 ? (
                  <table className="breakdown-table">
                    <tbody>
                      {data.tax.lines.map((line) => (
                        <tr key={line.label}>
                          <th scope="row">{line.label}</th>
                          <td className="mono">{formatBaniRON(line.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
                {/* A run-rate projection is an assumption, not a forecast; the wording says so. A closed
                    year is not a projection at all, so it gets its own sentence instead. */}
                {data.year.closed ? (
                  <p className="hint">{dashboardCopy.estimate.finalCalculationNote(fmtDate(snapshot.asOf))}</p>
                ) : data.tax ? (
                  <p className="hint">{estimateBasisExplanation(data.tax.basis)}</p>
                ) : null}
              </Disclosure>
              {/* PG-5C — the forecast, beside the figure and not inside it. It is a separate block with
                  its own label rather than a clause in the explanation, because the two numbers differ
                  and a reader has to be able to tell which one the app calculated under a rule. No tax,
                  contribution or threshold figure is ever derived from it — the block shows the projected
                  net only, and the sentence says what it is not. */}
              {forecast ? (
                <div className="forecast-aside" data-forecast-method={forecast.method}>
                  <p className="hint forecast-title">{dashboardCopy.estimate.forecast.title}</p>
                  <p className="hint">
                    {dashboardCopy.estimate.forecast.netLead}{' '}
                    <strong className="mono">
                      {formatBaniRON(forecast.amounts.net)}
                    </strong>
                  </p>
                  <p className="hint">{estimateForecastLabel(forecast)}</p>
                  <p className="hint">{estimateForecastExplanation(forecast)}</p>
                </div>
              ) : null}
              {/* TASK 9: the figure is attributed. Which rule package produced it, and whether the digest
                  that calculation recorded still matches the registered rules, is its own disclosure —
                  separate from the arithmetic above because it answers a different question. When there
                  is no calculation there is nothing to attribute, so the disclosure is not mounted: the
                  estimate state already says the figure is missing or withheld. */}
              {data.provenance ? (
                <Disclosure label={provenanceCopy.label} className="estimate-provenance">
                  <RuleProvenance view={data.provenance} />
                </Disclosure>
              ) : null}
            </div>
          </SectionCard>

          {/* 3. Financial graph (Step 20) */}
          <FinancialChart />

          {/* 4. Summary (Step 21) — with the ledger disclosure beside it, so a lei total that leaves a
              foreign record out cannot read as complete (B-37). */}
          <FinancialSummary summary={summary} ledger={data.ledger} />
          <CurrencySection disclosure={data.ledger} id="ledger-currency" />

          {/* 5. Insights (Step 21) */}
          <Insights insights={data.insights} />

        <div className="grid grid-2">
          <TaxReserve reserve={data.reserve} onRecord={appData.setReservedAmount} />
          <ThresholdSection thresholds={data.thresholds} asOfDate={data.snapshot.asOf} />
          <DeadlineSection deadlines={data.deadlines} asOfDate={data.snapshot.asOf} />
          <CompletenessSection completeness={data.completeness} />
          <ActionSection actions={data.actions} />
          <LegislationSection state={data.legislation} />
        </div>
      </>
    </div>
  );
}
