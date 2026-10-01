import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
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
