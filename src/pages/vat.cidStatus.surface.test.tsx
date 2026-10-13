/**
 * B-94 acceptance 2 — the flag reaches a person, in the two places the 50 % is already explained.
 *
 * The domain suite proves the data. This proves the surface: the Form 300 rubric layout on Declarații
 * (the page that already puts art. 298 wording in front of the taxpayer, through `D300_DEDUCTIBLE_LINES`)
 * and the input-VAT disclosure on Dashboard (the one that already says the 50 % cut is why the claimable
 * figure is not one form line). Both render the SAME copy functions over the SAME domain object, so this
 * file also pins that the two surfaces do not give two accounts of one rule — the B-70 defect class.
 *
 * What is asserted, and what is deliberately not:
 *  - the CID, its 31.12.2026 end, the proposed extension to 31.12.2029, and the flag's own as-of date;
 *  - that the domestic rule is named as art. 298 alin. (1) and is NOT given an end date;
 *  - that the word for the extension is "not adopted", never "rejected";
 *  - NOT that any figure changed — the 50 % is unchanged by design.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { StoreProvider, STORAGE_KEY } from '../data/store';
import { CURRENT_DATA_VERSION } from '../data/migration';
import { seedData } from '../data/seed';
import { pinClock, unpinClock } from '../test/clock';
import Declarations from './Declarations';
import Dashboard from './Dashboard';

function seed() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...seedData, version: CURRENT_DATA_VERSION }),
  );
}

beforeEach(() => {
  pinClock();
  seed();
});

afterEach(() => {
  cleanup();
  unpinClock();
});

describe('B-94 — the dated CID status flag on the two surfaces that explain the 50 %', () => {
  it('Declarații carries the flag inside the Form 300 panel', () => {
    render(
      <StoreProvider>
        <Declarations />
      </StoreProvider>,
    );
    const flag = screen.getByTestId('vat-cid-status');
    expect(flag.textContent).toContain('art. 298 alin. (1) Cod fiscal');
    expect(flag.textContent).toContain('CID (EU) 2024/1641');
    expect(flag.textContent).toContain('32024D1641');
    expect(flag.textContent).toContain('31.12.2026');
    expect(flag.textContent).toContain('31.12.2029');
    expect(flag.textContent).toContain('COM(2026) 457 final');
    expect(flag.textContent).toContain('13.10.2026');
  });

  it('Dashboard carries the same flag inside the input-VAT disclosure', async () => {
    render(
      <StoreProvider>
        <Dashboard />
      </StoreProvider>,
    );
    // The estimate — and with it the input-VAT decision the disclosure is mounted on — resolves
    // asynchronously, so this waits for the disclosure rather than assuming it is already there.
    const flag = await screen.findByTestId('vat-cid-status');
    expect(flag.textContent).toContain('art. 298 alin. (1) Cod fiscal');
    expect(flag.textContent).toContain('CID (EU) 2024/1641');
    expect(flag.textContent).toContain('13.10.2026');
  });

  it('the two surfaces say the same thing about one rule', async () => {
    const a = render(
      <StoreProvider>
        <Declarations />
      </StoreProvider>,
    );
    const onDeclarations = screen.getByTestId('vat-cid-status').textContent;
    a.unmount();

    render(
      <StoreProvider>
        <Dashboard />
      </StoreProvider>,
    );
    expect((await screen.findByTestId('vat-cid-status')).textContent).toBe(onDeclarations);
  });

  it('the flag never gives the domestic rule an end date and never calls the extension rejected', () => {
    render(
      <StoreProvider>
        <Declarations />
      </StoreProvider>,
    );
    const text = screen.getByTestId('vat-cid-status').textContent ?? '';
    // The only 2026 end date on screen belongs to the derogation, not to art. 298 alin. (1).
    expect(text).toContain('fără termen de valabilitate');
    expect(text).not.toMatch(/respins/i);
    expect(text).not.toContain('32024R1641');
  });
});
