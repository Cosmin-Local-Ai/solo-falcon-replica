/**
 * Phase 14 — the recalculation triggers, proven instead of asserted.
 *
 * The plan carried phase 14 as "done — extend the triggers" with no open defect attached. That is the
 * shape of a phase that was declared and never checked, and the check was missing: **no test anywhere in
 * this repository proves the tax FIGURE recomputes after an in-session mutation.** `derived.test.tsx:87-137`
 * proves the derived *views* recompute; the e2e specs that assert a tax figure add a record and then
 * `page.reload()` first (`payment-dates.spec.ts:150`, `activity-family.spec.ts:124`). So the acceptance
 * evidence for "the estimate re-runs when the facts change" did not exist.
 *
 * The mechanism (source, not inference): `useLatestTaxEstimate` runs in a `useEffect` whose dependency
 * list is `[store, asOfDate]` (`derived.ts:174`), and `StoreProvider` builds its context value as a fresh
 * object literal on every render (`store.tsx:713` — `useMemo` appears nowhere in that file). So every
 * field of `AppData` is a trigger, because they all travel on one reference. These tests pin the four
 * cases the phase names, in-session, with no reload.
 *
 * What is NOT a trigger is recorded in the register as B-160 rather than hidden here.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { act, render, screen, cleanup, waitFor } from '@testing-library/react';
import { StoreProvider, useStore } from './store';
import { useLatestTaxEstimate } from './derived';
import { seedStorage } from '../test/storage';
import { pinClock, unpinClock } from '../test/clock';
import { fixedInstant } from '../test/fixedInstant';
import { ron } from '../domain/money';
import type { TaxEstimateWithBasis } from '../domain/estimateBasis';

const AS_OF = '2026-10-31';

function lineValue(estimate: TaxEstimateWithBasis | null, label: string): number | null {
  if (!estimate || estimate.status !== 'computed') return null;
  const line = estimate.lines.find(l => l.label === label);
  return line ? line.value : null;
}

function Probe() {
  const { estimate } = useLatestTaxEstimate(AS_OF);
  const store = useStore();
  const total = estimate && estimate.status === 'computed' ? estimate.output.total : -1;
  return (
    <div>
      <span data-testid="status">{estimate ? estimate.status : 'none'}</span>
      <span data-testid="total">{total}</span>
      <span data-testid="cas">{lineValue(estimate, 'CAS (25%)')}</span>
      <span data-testid="cass">{lineValue(estimate, 'CASS (10%)')}</span>
      <button
        data-testid="add-revenue"
        onClick={() =>
          store.addRevenue({
            tip: 'factura', nr: 'FCT-P14-001', date: '2026-09-01', client: 'Client Nou', cui: '12345678',
            valoareFaraTva: ron(2000), tva: ron(380), status: 'inregistrata',
          })
        }
      >
        add-revenue
      </button>
      <button
        data-testid="add-large-revenue"
        onClick={() =>
          store.addRevenue({
            tip: 'factura', nr: 'FCT-P14-002', date: '2026-09-02', client: 'Client Mare', cui: '12345678',
            valoareFaraTva: ron(120000), tva: ron(22800), status: 'inregistrata',
          })
        }
      >
        add-large-revenue
      </button>
      {/* A date correction on a record the seed already holds: r1 moves out of the fiscal year. */}
      <button
        data-testid="move-r1-out"
        onClick={() => {
          const r1 = store.revenues.find(r => r.id === 'r1');
          if (r1) store.updateRevenue({ ...r1, collected: '2027-01-05' });
        }}
      >
        move-r1-out
      </button>
      <button
        data-testid="move-r1-in"
        onClick={() => {
          const r1 = store.revenues.find(r => r.id === 'r1');
          if (r1) store.updateRevenue({ ...r1, collected: '2026-02-03' });
        }}
      >
        move-r1-in
      </button>
    </div>
  );
}

function read(id: string): string {
  return screen.getByTestId(id).textContent ?? '';
}

describe('Phase 14 — the estimate re-runs when the facts change, in session', () => {
  beforeEach(() => {
    localStorage.clear();
    seedStorage();
    pinClock(fixedInstant());
  });
  afterEach(() => {
    cleanup();
    unpinClock();
    localStorage.clear();
  });

  it('a record added changes the tax figure without a reload', async () => {
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    await waitFor(() => expect(read('status')).toBe('computed'));
    const before = Number(read('total'));
    expect(before).toBeGreaterThan(0);

    act(() => screen.getByTestId('add-revenue').click());
    await waitFor(() => expect(Number(read('total'))).not.toBe(before));
    expect(Number(read('total'))).toBeGreaterThan(before);
  });

  it('a date corrected moves the figure, and moving it back moves it back', async () => {
    // The December-invoice case, driven through the store rather than through a reload: the money date is
    // the fact the fiscal year turns on (art. 68 alin. (2) lit. a)), so correcting it is a fact change.
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    await waitFor(() => expect(read('status')).toBe('computed'));
    const baseline = Number(read('total'));

    act(() => screen.getByTestId('move-r1-out').click());
    await waitFor(() => expect(Number(read('total'))).not.toBe(baseline));
    const released = Number(read('total'));

    act(() => screen.getByTestId('move-r1-in').click());
    await waitFor(() => expect(Number(read('total'))).toBe(baseline));
    expect(released).not.toBe(baseline);
  });

  it('a threshold crossed re-runs the contribution rules, not only the income line', async () => {
    // The claim being pinned is not "the total moved" — that would follow from arithmetic alone. It is
    // that the CAS and CASS lines are RE-DERIVED from the new facts, i.e. the contribution engine ran
    // again rather than the income line being patched.
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    await waitFor(() => expect(read('status')).toBe('computed'));
    const casBefore = read('cas');
    const cassBefore = read('cass');
    const totalBefore = Number(read('total'));

    act(() => screen.getByTestId('add-large-revenue').click());
    await waitFor(() => expect(Number(read('total'))).not.toBe(totalBefore));

    // CAS is floored on net income and CASS is capped on an annual ceiling: at 120 000 lei of new net
    // income at least one of the two must move, and both are read from a fresh run.
    expect(read('cas')).not.toBe(casBefore);
    expect(Number(read('cas'))).toBeGreaterThan(0);
    expect(Number(read('cass'))).toBeGreaterThan(0);
  });

  it('the as-of date is a live input: a different cut-off is a different calculation', async () => {
    // `inPeriod` cuts at `date <= asOfDate`, and `selectRuleSet(fiscalYear, asOfDate)` is re-read inside
    // the effect body (`derived.ts:79`), not memoised — so the run is a function of the date it is given.
    function DateProbe({ asOf }: { asOf: string }) {
      const { estimate } = useLatestTaxEstimate(asOf);
      return <span data-testid="d-total">{estimate && estimate.status === 'computed' ? estimate.output.total : -1}</span>;
    }
    const { rerender } = render(
      <StoreProvider>
        <DateProbe asOf="2026-03-31" />
      </StoreProvider>,
    );
    await waitFor(() => expect(Number(read('d-total'))).toBeGreaterThan(0));
    const march = Number(read('d-total'));

    rerender(
      <StoreProvider>
        <DateProbe asOf="2026-10-31" />
      </StoreProvider>,
    );
    await waitFor(() => expect(Number(read('d-total'))).not.toBe(march));
  });
});
