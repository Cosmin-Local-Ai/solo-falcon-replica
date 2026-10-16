/**
 * B-144 — the threshold card says when the number under its rows is a stand-in.
 *
 * The five answers are asserted on **rendered Romanian**, not on a class name or a prop. A note that stops
 * rendering is the failure this corpus keeps hitting — B-106 is the standing example of a refusal that
 * reached no surface — and a test that asserts a `data-*` attribute would still pass on an empty card.
 *
 * The subject is `threshold`, so points 1 to 3 must be the income rule's sentences, not the ceiling's: the
 * ceiling note says the ceiling is written in euro and the expenses are in lei, and a landlord reading that
 * beside their own income would be told the wrong story. Points 4 and 5 are shared, and asserting them here
 * is what stops the two subjects from drifting apart.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ThresholdSection from './ThresholdSection';
import type { FiscalThreshold } from '../../domain/thresholds';
import type { ProvisionalRateEvidence } from '../../domain/fx/convert';
import { lei } from '../../domain/money';

function makeThreshold(overrides: Partial<FiscalThreshold> = {}): FiscalThreshold {
  return {
    thresholdId: 'CAS_MIN_BASE',
    type: 'min-base',
    currentValue: lei(20_000),
    thresholdValue: lei(24_300),
    distance: lei(-4_300),
    affectedDomain: 'pfa-revenue',
    affectedTax: 'cas',
    effectiveDate: '2026-01-01',
    warningDistance: lei(2_430),
    ruleRelease: 'PFA-2026-1.0.0',
    source: 'art. 148 alin. (1) Codul fiscal',
    status: 'warning',
    fiscalBase: 'net-income',
    kind: 'tier_transition',
    engaged: false,
    severity: 'medium',
    applicability: 'applicable',
    measuredBasis: 'annual-actual',
    consequence:
      'Venitul net anual este sub 6 salarii minime brute; nu se datorează contribuția de asigurări sociale.',
    ...overrides,
  };
}

const PROVISIONAL: ProvisionalRateEvidence = {
  currency: 'EUR',
  rate: '5.3100',
  anchor: '2026',
  seriesCode: 'CURSA_EURM',
  provisional: true,
  entryMode: 'manual',
  fetchedAt: '2026-10-01T21:30:00Z',
  sourceUrl: 'https://www.bnr.ro',
};

describe('B-144 — ThresholdSection names the provisional annual average its rows are measured on', () => {
  it('all five answers render, in the income rule\'s words', () => {
    const { container } = render(
      <ThresholdSection thresholds={[makeThreshold()]} provisionalIncomeRates={[PROVISIONAL]} />,
    );
    const note = container.querySelector('[data-provisional-ceiling-note]');
    expect(note).not.toBeNull();
    expect(note?.getAttribute('data-provisional-subject')).toBe('threshold');

    // 1. Why a euro threshold and a euro rent both ended up in lei.
    expect(screen.getByText(/Pragul este scris în euro în textul legii/)).toBeInTheDocument();
    // 2. The rule that measured the income, and why an open year cannot produce a final figure.
    expect(screen.getByText(/media anuală a BNR pentru anul în care s-a realizat venitul/)).toBeInTheDocument();
    expect(screen.getByText(/pentru 2026, care nu s-a încheiat încă, cifra este provizorie/)).toBeInTheDocument();
    // 3. The rival conversion rule, on screen rather than hidden.
    expect(screen.getByText(/art\. 9 alin\. \(3\) lit\. b\)/)).toBeInTheDocument();
    // 4. The one that changes how the whole card reads: the return is filed after BNR publishes, so a
    //    provisional figure never reaches ANAF.
    expect(screen.getByText(/Declarația pentru 2026 se depune abia în 2027/)).toBeInTheDocument();
    expect(screen.getByText(/nu ajunge niciodată la ANAF/)).toBeInTheDocument();
    // 5. Where the number came from, since the app is forbidden from producing one.
    expect(screen.getByText(/Aplicația nu și-a calculat singură această medie/)).toBeInTheDocument();
    expect(screen.getByText(/media anuală 5\.3100 lei pentru un EUR în 2026/)).toBeInTheDocument();
    expect(screen.getByText(/introdus manual/)).toBeInTheDocument();
    expect(screen.getByText(/nu din cursurile zilnice/)).toBeInTheDocument();
  });

  it('says what is at stake, which is not the same thing a ceiling is at stake in', () => {
    render(<ThresholdSection thresholds={[makeThreshold()]} provisionalIncomeRates={[PROVISIONAL]} />);
    expect(
      screen.getByText(/nu schimbă doar o deducere.*prag/s, { exact: false, selector: '*' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/schimbă forma întregului an/)).toBeInTheDocument();
  });

  it('renders the ceiling story NOT at all: the landlord is not told about expenses', () => {
    render(<ThresholdSection thresholds={[makeThreshold()]} provisionalIncomeRates={[PROVISIONAL]} />);
    // The ceiling's point 1 — "your expenses are in lei" — must not appear on a threshold card. If it does,
    // the subject prop stopped selecting and the two subjects have silently merged.
    expect(screen.queryByText(/cheltuielile dumneavoastră sunt în lei/)).not.toBeInTheDocument();
  });

  it('the note sits below the rows it explains, not above them', () => {
    const { container } = render(
      <ThresholdSection thresholds={[makeThreshold()]} provisionalIncomeRates={[PROVISIONAL]} />,
    );
    const rows = container.querySelector('[data-measured-at]')?.parentElement ?? container;
    const text = rows.textContent ?? '';
    const noteAt = text.indexOf('Ce înseamnă cifra de mai sus');
    const consequenceAt = text.indexOf('nu se datorează contribuția de asigurări sociale');
    expect(noteAt).toBeGreaterThan(-1);
    expect(consequenceAt).toBeGreaterThan(-1);
    expect(noteAt).toBeGreaterThan(consequenceAt);
  });

  it('no provisional rate, no note: a final average is not a warning', () => {
    const { container } = render(
      <ThresholdSection
        thresholds={[makeThreshold()]}
        provisionalIncomeRates={[{ ...PROVISIONAL, provisional: false }]}
      />,
    );
    expect(container.querySelector('[data-provisional-ceiling-note]')).toBeNull();
    expect(screen.queryByText(/Ce înseamnă cifra de mai sus/)).not.toBeInTheDocument();
  });

  it('the card still renders its rows and its measured-at line beside the note', () => {
    // The note is an addition, not a replacement. A card that swaps its rows for an explanation has traded
    // one unreadable figure for another.
    const { container } = render(
      <ThresholdSection
        thresholds={[makeThreshold()]}
        asOfDate="2026-10-31"
        provisionalIncomeRates={[PROVISIONAL]}
      />,
    );
    expect(container.querySelector('[data-measured-at="2026-10-31"]')).not.toBeNull();
    expect(screen.getByText('Prag minim CAS')).toBeInTheDocument();
    expect(screen.getByText('20.000,00 lei')).toBeInTheDocument();
  });
});
