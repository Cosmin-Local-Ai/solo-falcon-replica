import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ThresholdSection from './ThresholdSection';
import type { FiscalThreshold } from '../../domain/thresholds';
import { lei } from '../../domain/money';

function makeThreshold(overrides: Partial<FiscalThreshold> = {}): FiscalThreshold {
  return {
    thresholdId: 'CAS_MIN_BASE',
    type: 'min-base',
    currentValue: lei(12000),
    thresholdValue: lei(6000),
    distance: lei(1000),
    affectedDomain: 'pfa-revenue',
    affectedTax: 'cas',
    effectiveDate: '2026-01-01',
    warningDistance: lei(-1000),
    ruleRelease: 'PFA-2026-1.0.0',
    source: 'OUG 157/2017 art. 42',
    status: 'ok',
    fiscalBase: 'net-income',
    // TASK 4: the row carries a legal kind, an applicability decision and a severity — three
    // separate fields, none of them derived from the others.
    kind: 'tier_transition',
    engaged: false,
    severity: 'none',
    applicability: 'applicable',
    measuredBasis: 'annual-projected',
    consequence:
      'Venitul net anual este cel puțin egal cu 12 salarii minime brute; se datorează contribuția de asigurări sociale (art. 148 alin. (1) din Codul fiscal).',
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
    // TASK 4: the consequence is its own sentence. The old `La depășire:` prefix presumed a breach,
    // which is the claim this task removes.
    expect(screen.getByText(/se datorează contribuția de asigurări sociale/)).toBeInTheDocument();
    expect(screen.queryByText(/La depășire:/)).not.toBeInTheDocument();
    expect(screen.getByText('12.000,00 lei')).toBeInTheDocument();
    expect(screen.getByText('6.000,00 lei')).toBeInTheDocument();
    expect(screen.getByText('1.000,00 lei')).toBeInTheDocument();
  });

  it('states which basis the row measured', () => {
    // TASK 4: the contribution rows measure an annual figure and the VAT row measures YTD turnover.
    // That asymmetry is deliberate, so each row says which one it measured.
    render(
      <ThresholdSection
        thresholds={[
          makeThreshold(),
          makeThreshold({
            thresholdId: 'VAT_REGISTRATION',
            type: 'registration',
            kind: 'registration',
            fiscalBase: 'revenue-excl-vat',
            measuredBasis: 'ytd-turnover',
            affectedTax: 'vat',
          }),
        ]}
      />,
    );
    expect(screen.getByText(/Bază măsurată: venit net anual estimat pentru întreg anul/)).toBeInTheDocument();
    expect(screen.getByText(/Bază măsurată: cifra de afaceri înregistrată de la începutul anului/)).toBeInTheDocument();
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
            thresholdId: 'CASS_MAX_BASE',
            type: 'max-base',
            kind: 'over_limit',
            engaged: true,
            status: 'breached',
            severity: 'high',
            currentValue: lei(100000),
            thresholdValue: lei(80000),
            distance: lei(20000),
            consequence:
              'Venitul net anual depășește baza de calcul de 72 de salarii minime brute; contribuția se calculează la plafon (art. 170 alin. (1) din Codul fiscal).',
          }),
        ]}
      />,
    );
    expect(screen.getByText('Prag maxim CAS')).toBeInTheDocument();
    expect(screen.getByText('Depășit', { selector: '.badge' })).toBeInTheDocument();
    expect(screen.queryByText('breached')).not.toBeInTheDocument();
    expect(screen.getByText(/contribuția se calculează la plafon/)).toBeInTheDocument();
  });

  it('renders an unmeasured threshold as review_required, not as a fake 0', () => {
    render(
      <ThresholdSection
        thresholds={[
          makeThreshold({
            currentValue: null,
            distance: lei(0),
            status: 'review_required',
            measuredBasis: 'unmeasured',
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
            kind: 'tier_transition',
            engaged: true,
            status: 'warning',
            severity: 'medium',
            currentValue: lei(120000),
            thresholdValue: lei(97200),
            distance: lei(22800),
            consequence:
              'Venitul net anual este cel puțin egal cu 24 de salarii minime brute; baza minimă de calcul pentru CAS crește de la 12 SM la 24 SM (art. 148 alin. (2) lit. b) din Codul fiscal). Nu este un plafon.',
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
    // The two claims research 24 found no support for must not reach the screen.
    expect(screen.queryByText(/schimbare de regim/)).not.toBeInTheDocument();
    expect(screen.queryByText(/dezcalificare/)).not.toBeInTheDocument();
  });
});

describe('ThresholdSection (TASK 4 — kind, applicability and severity are separate dimensions)', () => {
  it('renders a below-floor contribution row as no contribution owed, never as a breach', () => {
    // The acceptance criterion in render form: income below a contribution floor is not a breach.
    render(
      <ThresholdSection
        thresholds={[
          makeThreshold({
            currentValue: lei(9096),
            thresholdValue: lei(48600),
            distance: lei(-39504),
            kind: 'tier_transition',
            engaged: true,
            status: 'warning',
            severity: 'medium',
            consequence:
              'Venitul net anual din activități independente este sub pragul de 12 salarii minime brute pe țară; în consecință, nu se datorează contribuția de asigurări sociale pentru acest an (art. 148 alin. (1) și (4) din Codul fiscal).',
          }),
        ]}
      />,
    );
    expect(screen.queryByText('Depășit', { selector: '.badge' })).not.toBeInTheDocument();
    expect(screen.getByText(/nu se datorează contribuția de asigurări sociale/)).toBeInTheDocument();
    const row = document.querySelector('[data-kind="tier_transition"]');
    expect(row).not.toBeNull();
    expect(row?.getAttribute('data-applicability')).toBe('applicable');
  });

  it('renders an inapplicable row as not applicable, with no consequence and no breach', () => {
    render(
      <ThresholdSection
        thresholds={[
          makeThreshold({
            thresholdId: 'VAT_REGISTRATION',
            type: 'registration',
            kind: 'registration',
            affectedTax: 'vat',
            fiscalBase: 'revenue-excl-vat',
            measuredBasis: 'ytd-turnover',
            engaged: true,
            status: 'breached',
            severity: 'none',
            applicability: 'not_applicable',
            applicabilityReason:
              'Profilul aplică TVA: obligația de înregistrare din art. 310 alin. (1) din Codul fiscal a intervenit deja.',
            consequence: 'Cifra de afaceri este cel puțin egală cu plafonul (art. 310 alin. (1) din Codul fiscal).',
          }),
        ]}
      />,
    );
    expect(screen.getByText(/Nu se aplică:/)).toBeInTheDocument();
    expect(screen.getByText(/obligația de înregistrare din art\. 310 alin\. \(1\)/)).toBeInTheDocument();
    // The consequence sentence is suppressed for a row the law made irrelevant.
    expect(screen.queryByText(/Cifra de afaceri este cel puțin egală cu plafonul/)).not.toBeInTheDocument();
    expect(document.querySelector('[data-applicability="not_applicable"][data-severity="none"]')).not.toBeNull();
  });

  it('says when the profile does not establish applicability, instead of assuming it', () => {
    render(
      <ThresholdSection
        thresholds={[
          makeThreshold({
            applicability: 'unknown',
            applicabilityReason:
              'Profilul nu conține cuantumul salarial, iar art. 174 alin. (7) lit. a) din Codul fiscal îl compară cu 6 salarii minime brute.',
            severity: 'low',
          }),
        ]}
      />,
    );
    expect(screen.getByText(/Aplicabilitate nesigură:/)).toBeInTheDocument();
    expect(document.querySelector('[data-applicability="unknown"]')).not.toBeNull();
  });

  it('carries a severity that is not a function of the kind', () => {
    // Same legal kind, different urgency; and a `registration` row that is less urgent than a
    // `tier_transition` one. If severity were derived from the kind these two rows could not exist.
    render(
      <ThresholdSection
        thresholds={[
          makeThreshold({ kind: 'tier_transition', severity: 'medium' }),
          makeThreshold({ thresholdId: 'X', kind: 'tier_transition', severity: 'none' }),
          makeThreshold({ thresholdId: 'Y', type: 'registration', kind: 'registration', severity: 'low' }),
        ]}
      />,
    );
    expect(document.querySelectorAll('[data-severity="medium"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-severity="none"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-severity="low"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-kind="registration"]')).toHaveLength(1);
  });

  it('labels a salariul-minim derived amount as computed, citing the SM value and its act', () => {
    // CF art. 148 states multipliers of „salariul minim", never a lei figure, and research 24 records
    // the governing SM vintage for FY2026 as unverified — so the lei amount must be labelled computed.
    render(
      <ThresholdSection
        thresholds={[
          makeThreshold({
            thresholdValue: lei(48600),
            computedFrom: {
              multiplier: 12,
              smValueBani: lei(4050),
              smAct: 'HG 1506/2024',
              note:
                'Codul fiscal exprimă acest prag în multipli de salariu minim brut pe țară, nu în lei; nivelul de referință nu este verificat.',
            },
          }),
        ]}
      />,
    );
    expect(screen.getByText(/Sumă calculată de aplicație: 12 × salariul minim de/)).toBeInTheDocument();
    expect(screen.getByText('4.050,00 lei')).toBeInTheDocument();
    expect(screen.getByText(/HG 1506\/2024/)).toBeInTheDocument();
    expect(screen.getByText(/nu este verificat/)).toBeInTheDocument();
  });

  it('labels the 10 % warning band as application policy, and only when it is what triggered the row', () => {
    const policyLine = /politică de afișare a aplicației, nu o prevedere legală/;
    const { rerender } = render(
      <ThresholdSection thresholds={[makeThreshold({ status: 'warning', severity: 'medium' })]} />,
    );
    expect(screen.getByText(policyLine)).toBeInTheDocument();

    rerender(<ThresholdSection thresholds={[makeThreshold({ status: 'ok', severity: 'none' })]} />);
    expect(screen.queryByText(policyLine)).not.toBeInTheDocument();
  });
});
