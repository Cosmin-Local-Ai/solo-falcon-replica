import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import DeadlineSection from './DeadlineSection';
import type { DeadlineView } from '../../domain/deadlines';

const AS_OF = '2026-03-01';

/**
 * PG-5: the card reads `DeadlineView`, not `Deadline` — the row now carries whether the dataset already
 * discharges the term. The defaults here are the not-yet-filed case, which is what every pre-PG-5
 * assertion in this file describes.
 */
function makeDeadline(overrides: Partial<DeadlineView> = {}): DeadlineView {
  return {
    deadlineId: 'PFA_DEADLINE_2026',
    taxYear: 2026,
    eventType: 'd212_filing',
    date: '2026-03-25',
    dateFormula: 'rule PFA_DEADLINE_2026: fixed 2027-05-25 + 0 days',
    appliesTo: 'pfa',
    legalSource: { act: 'Cod fiscal (consolidat)', article: 'art. 122 alin. (3)' },
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    status: 'active',
    done: false,
    filedOn: null,
    outcome: 'upcoming',
    ...overrides,
  };
}

describe('DeadlineSection (Step 32 — Romanian, no raw enums)', () => {
  it('renders the Romanian title, description, item label, and days remaining', () => {
    render(<DeadlineSection deadlines={[makeDeadline()]} asOfDate={AS_OF} />);
    expect(screen.getByText('Termene limită')).toBeInTheDocument();
    expect(screen.getByText('Termene limită viitoare de depunere, la data de 01.03.2026')).toBeInTheDocument();
    expect(screen.getByText('Depunere D212')).toBeInTheDocument();
    expect(screen.getByText('PFA')).toBeInTheDocument();
    expect(screen.getByText(/25\.03\.2026 \(24 zile rămase\)/)).toBeInTheDocument();
  });

  it('uses the singular Romanian form for exactly one day', () => {
    render(
      <DeadlineSection
        deadlines={[makeDeadline({ deadlineId: 'dl-2', date: '2026-03-02' })]}
        asOfDate={AS_OF}
      />,
    );
    expect(screen.getByText(/02\.03\.2026 \(1 zi rămasă\)/)).toBeInTheDocument();
  });

  it('marks a term the record already discharges as depusă, with the date on the filing', () => {
    // PG-5. Before this, a filed return and an unfiled one rendered identically: the row came from the
    // rule engine, which has never seen a filing.
    render(
      <DeadlineSection
        deadlines={[makeDeadline({ done: true, filedOn: '2027-04-03', outcome: 'done' })]}
        asOfDate={AS_OF}
      />,
    );
    expect(screen.getByText('Depusă')).toBeInTheDocument();
    expect(screen.getByText('Depusă pe 03.04.2027')).toBeInTheDocument();
    expect(screen.queryByText('Activ')).not.toBeInTheDocument();
  });

  it('leaves an unfilled term on its rule status, not on the filing badge', () => {
    render(<DeadlineSection deadlines={[makeDeadline()]} asOfDate={AS_OF} />);
    expect(screen.getByText('Activ')).toBeInTheDocument();
    expect(screen.queryByText('Depusă')).not.toBeInTheDocument();
  });

  it('shows the honest Romanian empty state when there are no upcoming deadlines', () => {
    render(<DeadlineSection deadlines={[]} asOfDate={AS_OF} />);
    expect(screen.getByText('Niciun termen limită viitor')).toBeInTheDocument();
  });

  it('does not render past deadlines as upcoming', () => {
    render(
      <DeadlineSection
        deadlines={[makeDeadline({ deadlineId: 'dl-3', date: '2026-02-15' })]}
        asOfDate={AS_OF}
      />,
    );
    expect(screen.getByText('Niciun termen limită viitor')).toBeInTheDocument();
  });

  it('renders the Romanian status badge, never the raw enum value', () => {
    render(<DeadlineSection deadlines={[makeDeadline()]} asOfDate={AS_OF} />);
    expect(screen.getByText('Activ', { selector: '.badge' })).toBeInTheDocument();
    expect(screen.queryByText('active')).not.toBeInTheDocument();
  });

  // Phase 9b (brief 10 §2b): the VAT registration deadline's offset_days is 0, so the deadline IS the
  // exceedance date. Once resolved it can only be due today or overdue — it must never be rendered as
  // "N zile rămase", and a dateless one must never render at all.
  it('does not render a resolved VAT registration deadline as remaining days', () => {
    render(
      <DeadlineSection
        deadlines={[
          makeDeadline({
            deadlineId: 'VAT_REGISTRATION_DEADLINE_2026',
            eventType: 'vat_registration',
            appliesTo: 'vat-registered-pfa',
            date: AS_OF,
          }),
        ]}
        asOfDate={AS_OF}
      />,
    );
    expect(screen.getByText('Niciun termen limită viitor')).toBeInTheDocument();
    expect(screen.queryByText('Înregistrare TVA')).not.toBeInTheDocument();
  });

  it('does not render a dateless VAT registration deadline', () => {
    render(
      <DeadlineSection
        deadlines={[
          makeDeadline({
            deadlineId: 'VAT_REGISTRATION_DEADLINE_2026',
            eventType: 'vat_registration',
            appliesTo: 'vat-registered-pfa',
            date: null,
            status: 'not_applicable',
          }),
        ]}
        asOfDate={AS_OF}
      />,
    );
    expect(screen.getByText('Niciun termen limită viitor')).toBeInTheDocument();
  });
});
