import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import TaxReserve from './TaxReserve';
import type { TaxReserveRecommendation } from '../domain/taxReserve';
import { lei } from '../domain/money';

function makeReserve(overrides: Partial<TaxReserveRecommendation> = {}): TaxReserveRecommendation {
  return {
    estimatedTaxLiability: lei(120000),
    reservedAmount: lei(30000),
    remainingTarget: lei(90000),
    monthsRemaining: 6,
    recommendedMonthlyReserve: lei(15000),
    ...overrides,
  };
}

describe('TaxReserve', () => {
  it('renders the reserve hero value (recommended cash reserve)', () => {
    render(<TaxReserve reserve={makeReserve()} />);
    expect(screen.getByText('Recomandat de pus deoparte lunar')).toBeInTheDocument();
    expect(screen.getByText('15.000,00 RON')).toBeInTheDocument();
  });

  it('renders the estimated liability as a distinct stat when present', () => {
    render(<TaxReserve reserve={makeReserve()} />);
    expect(screen.getByText('Estimare obligație fiscală')).toBeInTheDocument();
    expect(screen.getByText('120.000,00 RON')).toBeInTheDocument();
  });

  it('renders the honest "no estimate" state when estimatedTaxLiability === null (never zero)', () => {
    render(<TaxReserve reserve={makeReserve({ estimatedTaxLiability: null })} />);
    expect(
      screen.getByText(
        'Nu există o estimare fiscală disponibilă — rezerva recomandată nu poate fi calculată.',
      ),
    ).toBeInTheDocument();
    // No hero figure, no liability stat, and no fabricated zero.
    expect(screen.queryByText('Recomandat de pus deoparte lunar')).not.toBeInTheDocument();
    expect(screen.queryByText('Estimare obligație fiscală')).not.toBeInTheDocument();
    expect(screen.queryByText(/0,00 RON/)).not.toBeInTheDocument();
  });

  it('shows the remaining target and months left as supporting text', () => {
    render(<TaxReserve reserve={makeReserve()} />);
    expect(screen.getByText('Rămâne de pus deoparte 90.000,00 RON în următoarele 6 luni.')).toBeInTheDocument();
  });

  it('shows "fully covered" when the remaining target is 0', () => {
    render(<TaxReserve reserve={makeReserve({ reservedAmount: lei(120000), remainingTarget: lei(0) })} />);
    expect(screen.getByText('Rezerva este complet acoperită.')).toBeInTheDocument();
  });

  // TASK 3: the persisted tri-state reaches the screen. `null` means the user never recorded anything
  // and must never render as a number; `0` means they recorded that they set aside nothing and must
  // render as 0. Untested before this task, which is exactly how a `?? 0` collapse could hide.
  it('renders an unrecorded reserve as "no reserve recorded", never as 0,00 lei', () => {
    render(
      <TaxReserve
        reserve={makeReserve({ reservedAmount: null, remainingTarget: lei(120000) })}
      />,
    );
    expect(screen.getByText('Rezervat deja')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('Nicio sumă înregistrată.')).toBeInTheDocument();
    // The liability stat is 120.000,00 lei; nothing on the card may read as a zero reserve.
    expect(screen.queryByText('0,00 RON')).not.toBeInTheDocument();
  });

  it('renders an explicit 0 lei reserve as a real amount, distinct from the unrecorded state', () => {
    render(
      <TaxReserve reserve={makeReserve({ reservedAmount: lei(0), remainingTarget: lei(120000) })} />,
    );
    expect(screen.getByText('0,00 RON')).toBeInTheDocument();
    expect(screen.queryByText('Nicio sumă înregistrată.')).not.toBeInTheDocument();
    expect(screen.queryByText('—')).not.toBeInTheDocument();
  });
});

/**
 * TASK 3 — the entry control. Without it the persisted field is write-only from the app's point of
 * view, and the „Rezervă fiscală sub țintă” warning stays unclearable, which is the defect the task
 * exists to close.
 */
describe('TaxReserve — recording the reserve', () => {
  const input = () => screen.getByLabelText('Cât ai pus deoparte pentru impozit (lei)');
  const save = () => screen.getByRole('button', { name: 'Salvează' });

  it('writes a typed lei amount out as integer bani', () => {
    const onRecord = vi.fn();
    render(<TaxReserve reserve={makeReserve({ reservedAmount: null })} onRecord={onRecord} />);
    fireEvent.change(input(), { target: { value: '1050' } });
    fireEvent.click(save());
    expect(onRecord).toHaveBeenCalledTimes(1);
    expect(onRecord).toHaveBeenCalledWith(lei(1050));
  });

  it('refuses an amount with sub-ban precision and writes nothing', () => {
    const onRecord = vi.fn();
    render(<TaxReserve reserve={makeReserve({ reservedAmount: lei(30000) })} onRecord={onRecord} />);
    fireEvent.change(input(), { target: { value: '85.555' } });
    fireEvent.click(save());
    expect(onRecord).not.toHaveBeenCalled();
    expect(
      screen.getByText('Suma nu este o valoare validă în lei — nimic nu a fost salvat.'),
    ).toBeInTheDocument();
  });

  it('an empty field saves nothing: a blank box is not a claim that the user set aside 0 lei', () => {
    const onRecord = vi.fn();
    render(<TaxReserve reserve={makeReserve({ reservedAmount: lei(30000) })} onRecord={onRecord} />);
    fireEvent.change(input(), { target: { value: '' } });
    fireEvent.click(save());
    expect(onRecord).not.toHaveBeenCalled();
  });

  it('clearing an existing record writes null, not 0', () => {
    const onRecord = vi.fn();
    render(<TaxReserve reserve={makeReserve({ reservedAmount: lei(30000) })} onRecord={onRecord} />);
    fireEvent.click(screen.getByRole('button', { name: 'Șterge înregistrarea' }));
    expect(onRecord).toHaveBeenCalledTimes(1);
    expect(onRecord).toHaveBeenCalledWith(null);
  });

  it('offers no clear action while nothing is recorded', () => {
    render(<TaxReserve reserve={makeReserve({ reservedAmount: null })} onRecord={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Șterge înregistrarea' })).not.toBeInTheDocument();
  });

  it('stays read-only when no recorder is supplied', () => {
    render(<TaxReserve reserve={makeReserve()} />);
    expect(screen.queryByLabelText('Cât ai pus deoparte pentru impozit (lei)')).not.toBeInTheDocument();
  });
});
