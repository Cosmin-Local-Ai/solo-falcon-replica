/**
 * Phase 11 / PG-3 — the first-run screen.
 *
 * Three things are pinned here, and each is an acceptance criterion rather than a detail:
 *  - onboarding refuses to proceed without a PFA start date (acceptance 2);
 *  - `norma_venit` reaches an explicit refusal screen that shows NO estimate (acceptance 2) — the regime
 *    is gated on D-NORMA-2, so the refusal is the deliverable, not a gap to fill;
 *  - completing onboarding ends the first-run state and writes the facts, while the demo sandbox stays
 *    in memory and never reaches storage (acceptance 4).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { StoreProvider, STORAGE_KEY, useStore } from '../data/store';
import { seedData } from '../data/seed';
import { onboarding as t } from '../ui/copy';
import Onboarding from './Onboarding';

let store: ReturnType<typeof useStore> | null = null;
function Probe() {
  store = useStore();
  return null;
}

function renderOnboarding() {
  return render(
    <StoreProvider>
      <Onboarding />
      <Probe />
    </StoreProvider>,
  );
}

const regimeRadio = (value: string): HTMLInputElement => {
  const input = document.querySelector(`[data-regime="${value}"] input`) as HTMLInputElement | null;
  if (!input) throw new Error(`no regime control for ${value}`);
  return input;
};

beforeEach(() => {
  localStorage.clear();
  store = null;
});

afterEach(() => {
  localStorage.clear();
});

describe('Onboarding — required facts', () => {
  it('refuses to proceed without a PFA start date, and writes nothing', () => {
    renderOnboarding();

    fireEvent.change(screen.getByLabelText(t.fields.nume), { target: { value: 'Popescu Andrei' } });
    fireEvent.click(screen.getByText(t.actions.finish));

    expect(screen.getByText(t.errors.startDateRequired)).toBeInTheDocument();
    // The first-run state is unchanged and nothing was persisted: an empty dataset is not a fact, and
    // writing one would make the next load a 'persisted' one and drop the user out of onboarding.
    expect(store!.dataOrigin).toBe('empty');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('rejects a malformed start date instead of storing it', () => {
    renderOnboarding();

    fireEvent.change(screen.getByLabelText(t.fields.nume), { target: { value: 'Popescu Andrei' } });
    fireEvent.change(screen.getByLabelText(t.fields.startDate), { target: { value: '2026-13-40' } });
    fireEvent.click(screen.getByText(t.actions.finish));

    expect(store!.dataOrigin).toBe('empty');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('writes the collected facts and ends the first-run state', () => {
    renderOnboarding();

    fireEvent.change(screen.getByLabelText(t.fields.nume), { target: { value: 'Popescu Andrei' } });
    fireEvent.change(screen.getByLabelText(t.fields.cui), { target: { value: 'RO12345678' } });
    fireEvent.change(screen.getByLabelText(t.fields.startDate), { target: { value: '2026-03-01' } });
    fireEvent.change(screen.getByLabelText(t.fields.salaryStatus), { target: { value: 'da' } });
    fireEvent.change(screen.getByLabelText(t.fields.salaryAmount), { target: { value: '30000' } });
    fireEvent.click(document.querySelector('[data-other-income="imobiliare"] input') as HTMLInputElement);
    fireEvent.click(screen.getByText(t.actions.finish));

    expect(store!.profile.pfaStartDate).toBe('2026-03-01');
    expect(store!.profile.pfaStartYear).toBe(2026);
    expect(store!.profile.identity.nume).toBe('Popescu Andrei');
    expect(store!.profile.identity.cui).toBe('RO12345678');
    expect(store!.profile.salaryStatus).toBe('da');
    // `salaryIncomeLei` keeps its stale suffix on purpose and holds integer BANI (landmine 5).
    expect(store!.profile.salaryIncomeLei).toBe(3_000_000);
    expect(store!.profile.otherIncome).toEqual(['imobiliare']);
    // The first run is over: the store now holds facts the person entered.
    expect(store!.dataOrigin).toBe('persisted');
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it('leaves an unanswered optional fact unrecorded rather than inventing one', () => {
    renderOnboarding();

    fireEvent.change(screen.getByLabelText(t.fields.nume), { target: { value: 'Popescu Andrei' } });
    fireEvent.change(screen.getByLabelText(t.fields.startDate), { target: { value: '2026-03-01' } });
    fireEvent.click(screen.getByText(t.actions.finish));

    // Both are optional on the model and the question was never answered, so they stay ABSENT. Writing
    // `pensionReceiptYears: [{ received: 'nu' }]` would assert a checked negative the user never gave —
    // the same tri-state rule `Settings.tsx` follows.
    expect(store!.profile.pensionReceiptYears).toBeUndefined();
    expect(store!.profile.vatExceedanceDate).toBeUndefined();
    // `pensionerStatus` is NOT one of them: `createDefaultProfile` already carries 'nu' for it, and
    // onboarding does not overwrite a default it was never asked about. That default is a model
    // limitation (the field has no third state), not something this phase changes — recorded as a
    // follow-up in docs/ai/phases/28_phase11_first_run.md rather than fixed by editing the domain here.
    expect(store!.profile.pensionerStatus).toBe('nu');
  });
});

describe('Onboarding — the norma de venit refusal', () => {
  it('routes the regime to an explicit refusal screen that carries no estimate', () => {
    renderOnboarding();

    fireEvent.click(regimeRadio('norma_venit'));

    expect(screen.getByText('Acest regim nu este suportat')).toBeInTheDocument();
    // The screen states that it shows no figure, and it does not: no money is rendered anywhere on it.
    expect(document.querySelector('[data-onboarding="no-estimate"]')).not.toBeNull();
    expect(document.body.textContent).not.toMatch(/RON/);
    expect(document.querySelector('.tax-hero-value')).toBeNull();
    expect(document.querySelector('.stat-card')).toBeNull();
    // Nothing was written: a refused regime does not become a stored profile.
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('returns to the regime choice instead of continuing', () => {
    renderOnboarding();

    fireEvent.click(regimeRadio('norma_venit'));
    fireEvent.click(screen.getByText(t.refusal.back));

    expect(document.querySelector('[data-onboarding="form"]')).not.toBeNull();
    expect(regimeRadio('impozit_pe_venit').checked).toBe(true);
  });

  it('refuses impozit_pe_cit the same way — a PFA cannot hold that regime in 2026', () => {
    renderOnboarding();
    fireEvent.click(regimeRadio('impozit_pe_cit'));
    expect(screen.getByText('Acest regim nu este suportat')).toBeInTheDocument();
  });
});

describe('Onboarding — the demo sandbox is opt-in', () => {
  it('loads the fixture in memory and never writes it to storage', () => {
    renderOnboarding();

    fireEvent.click(screen.getByText(t.demo.action));

    expect(store!.dataOrigin).toBe('sandbox');
    expect(store!.revenues).toHaveLength(seedData.revenues.length);
    // Never the initial state, and never persisted: a reload has to land back on onboarding.
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
