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
    fiscalBase: 'gross-revenue',
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
});
