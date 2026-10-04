import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { StoreProvider } from '../data/store';
import Revenues from './Revenues';

const activeTabText = () => document.querySelector('.tab.active')?.textContent ?? '';

describe('Revenues (Step 25 — Defect 4)', () => {
  it('resets to the default tab when the URL becomes bare /revenues (back/forward)', () => {
    const { rerender } = render(
      <StoreProvider>
        <Revenues initialTab="pending" />
      </StoreProvider>,
    );

    // The pending tab is active for #/revenues/pending.
    expect(activeTabText()).toContain('În așteptare');

    // Back/forward to bare /revenues: initialTab becomes undefined.
    rerender(
      <StoreProvider>
        <Revenues />
      </StoreProvider>,
    );

    // The tab must reset to the canonical default `registered`.
    expect(activeTabText()).toContain('Înregistrate');
  });

  it('still syncs when the URL changes to a valid tab', () => {
    const { rerender } = render(
      <StoreProvider>
        <Revenues initialTab="rejected" />
      </StoreProvider>,
    );

    expect(activeTabText()).toContain('Respinse');

    rerender(
      <StoreProvider>
        <Revenues initialTab="pending" />
      </StoreProvider>,
    );

    expect(activeTabText()).toContain('În așteptare');
  });

  it('defaults to the registered tab on initial mount without a tab', () => {
    render(
      <StoreProvider>
        <Revenues />
      </StoreProvider>,
    );

    expect(activeTabText()).toContain('Înregistrate');
  });
});

describe('Revenues — data preservation across tab navigation', () => {
  // Seed data: registered = FCT-2026-001, FCT-2026-004 (2)
  //             pending    = FCT-2026-002 (1)
  //             rejected   = NF-2026-003 (1)
  it('rows reappear unchanged after navigating between tabs and back', () => {
    render(
      <StoreProvider>
        <Revenues />
      </StoreProvider>,
    );

    // Default tab: registered shows both seed rows.
    expect(screen.getByText('FCT-2026-001')).toBeInTheDocument();
    expect(screen.getByText('FCT-2026-004')).toBeInTheDocument();

    // Navigate to pending: only that tab's row is visible.
    fireEvent.click(screen.getByRole('button', { name: /În așteptare/ }));
    expect(screen.getByText('FCT-2026-002')).toBeInTheDocument();
    expect(screen.queryByText('FCT-2026-001')).not.toBeInTheDocument();
    expect(screen.queryByText('FCT-2026-004')).not.toBeInTheDocument();

    // Navigate to rejected.
    fireEvent.click(screen.getByRole('button', { name: /Respinse/ }));
    expect(screen.getByText('NF-2026-003')).toBeInTheDocument();
    expect(screen.queryByText('FCT-2026-002')).not.toBeInTheDocument();

    // Back to registered: the original rows are still there, intact.
    fireEvent.click(screen.getByRole('button', { name: /Înregistrate/ }));
    expect(screen.getByText('FCT-2026-001')).toBeInTheDocument();
    expect(screen.getByText('FCT-2026-004')).toBeInTheDocument();
  });

  it('tab counts stay stable while navigating', () => {
    const { container } = render(
      <StoreProvider>
        <Revenues />
      </StoreProvider>,
    );

    const counts = () =>
      Array.from(container.querySelectorAll('.tab .count')).map(el => el.textContent);

    expect(counts()).toEqual(['2', '1', '1']);

    fireEvent.click(screen.getByRole('button', { name: /În așteptare/ }));
    expect(counts()).toEqual(['2', '1', '1']);

    fireEvent.click(screen.getByRole('button', { name: /Respinse/ }));
    expect(counts()).toEqual(['2', '1', '1']);

    fireEvent.click(screen.getByRole('button', { name: /Înregistrate/ }));
    expect(counts()).toEqual(['2', '1', '1']);
  });
});
