import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ThresholdSection from './ThresholdSection';
import type { FiscalThreshold } from '../../domain/thresholds';

function makeThreshold(overrides: Partial<FiscalThreshold> = {}): FiscalThreshold {
  return {
    thresholdId: 'CAS_MIN_BASE',
    type: 'min-base',
    currentValue: 12000,
    thresholdValue: 6000,
    distance: 1000,
    affectedDomain: 'pfa-revenue',
    affectedTax: 'cas',
    effectiveDate: '2026-01-01',
    warningDistance: -1000,
    ruleRelease: 'PFA-2026-1.0.0',
    source: 'OUG 157/2017 art. 42',
    status: 'ok',
    fiscalBase: 'net-income',
    breachMeaning: 'pierdere drept PFA',
    ...overrides,
  };
}

describe('ThresholdSection (Step 32 — Romanian, no raw enums)', () => {
  it('renders the Romanian title, description, label, and value rows', () => {
    render(<ThresholdSection thresholds={[makeThreshold()]} />);
    expect(screen.getByText('Praguri')).toBeInTheDocument();
    expect(screen.getByText('Praguri fiscale față de valorile curente')).toBeInTheDocument();
    expect(screen.getByText('Prag minim CAS')).toBeInTheDocument();
    expect(screen.getByText('Curent:')).toBeInTheDocument();
    expect(screen.getByText('Prag:')).toBeInTheDocument();
    expect(screen.getByText('Distanță:')).toBeInTheDocument();
    expect(screen.getByText(/La depășire:/)).toBeInTheDocument();
    expect(screen.getByText('12.000,00 lei')).toBeInTheDocument();
    expect(screen.getByText('6.000,00 lei')).toBeInTheDocument();
    expect(screen.getByText('1.000,00 lei')).toBeInTheDocument();
  });

  it('shows the honest Romanian empty state when there are no thresholds', () => {
    render(<ThresholdSection thresholds={[]} />);
    expect(screen.getByText('Niciun prag')).toBeInTheDocument();
  });

  it('renders the Romanian status badge, never the raw enum value', () => {
    render(<ThresholdSection thresholds={[makeThreshold()]} />);
    expect(screen.getByText('În limite', { selector: '.badge' })).toBeInTheDocument();
    expect(screen.queryByText('ok')).not.toBeInTheDocument();
  });

  it('labels a breached threshold in Romanian', () => {
    render(
      <ThresholdSection
        thresholds={[
          makeThreshold({
            thresholdId: 'CAS_MAX_BASE',
            type: 'max-base',
            currentValue: 100000,
            thresholdValue: 80000,
            distance: 20000,
            status: 'breached',
            breachMeaning: 'părăsirea regimului PFA',
          }),
        ]}
      />,
    );
    expect(screen.getByText('Prag maxim CAS')).toBeInTheDocument();
    expect(screen.getByText('Depășit', { selector: '.badge' })).toBeInTheDocument();
    expect(screen.queryByText('breached')).not.toBeInTheDocument();
    expect(screen.getByText('La depășire: părăsirea regimului PFA')).toBeInTheDocument();
  });

  it('renders an unmeasured threshold as review_required, not as a fake 0', () => {
    render(
      <ThresholdSection
        thresholds={[
          makeThreshold({
            currentValue: null,
            distance: 0,
            status: 'review_required',
            reviewReason: 'Baza „net-income” nu a fost furnizată; pragul nu poate fi evaluat.',
          }),
        ]}
      />,
    );
    // Loud, Romanian, and never collapsed into `ok`.
    expect(screen.getByText('De verificat', { selector: '.badge' })).toBeInTheDocument();
    expect(screen.queryByText('În limite')).not.toBeInTheDocument();
    expect(screen.queryByText('review_required')).not.toBeInTheDocument();
    // No invented amount is displayed for an unmeasured base.
    expect(screen.queryByText('0,00 lei')).not.toBeInTheDocument();
    expect(screen.getByText(/nu a fost furnizată/)).toBeInTheDocument();
  });

  it('labels the 24 SM CAS step as a ladder step, never as a ceiling', () => {
    render(
      <ThresholdSection
        thresholds={[
          makeThreshold({
            thresholdId: 'CAS_TIER2_FLOOR',
            type: 'tier-floor',
            currentValue: 120000,
            thresholdValue: 97200,
            distance: 22800,
            status: 'breached',
            breachMeaning:
              'Peste pragul de 24 SM — baza minimă de calcul pentru CAS crește de la 12 SM la 24 SM (nu este plafon)',
          }),
        ]}
      />,
    );

    expect(screen.getByText('Treaptă de calcul CAS')).toBeInTheDocument();
    // The 97.200 lei step comes from the rule parameter, and this row is not a maximum.
    expect(screen.getByText('97.200,00 lei')).toBeInTheDocument();
    expect(screen.queryByText('Prag maxim CAS')).not.toBeInTheDocument();
    expect(screen.getByText(/baza minimă de calcul pentru CAS crește/)).toBeInTheDocument();
    expect(screen.queryByText('tier-floor')).not.toBeInTheDocument();
  });
});
