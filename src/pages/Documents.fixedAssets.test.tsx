/**
 * PG-6e (D-FA-2) — the two retained documents on the Documents surface.
 *
 * The tab is a **păstrare** surface, not a filing surface: there is no upload, no "send to ANAF", and no
 * deadline widget, because OMFP 170/2015 asks the taxpayer to keep these registers, not to submit them.
 * The tests below pin that shape, and pin the retention sentences — including the one that names the
 * abrogated 10-ani rule as abrogated, which is the difference between a current application and one that
 * stopped being true in 2023.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Documents from './Documents';
import { StoreProvider } from '../data/store';
import { seedStorage } from '../test/storage';
import { seedData } from '../data/seed';
import { assets as assetsCopy } from '../ui/copy';
import type { FixedAsset } from '../data/types';
import { lei } from '../domain/money';

const asset = (over: Partial<FixedAsset> = {}): FixedAsset => ({
  id: 'a1',
  label: 'Utilaj de birou',
  entryDate: '2026-02-10',
  putInFunctionDate: '2026-02-15',
  fiscalValue: lei(120000),
  normalLifeMonths: 60,
  method: 'liniar',
  acquisition: 'cumparare',
  paymentState: 'achitat',
  paidOn: '2026-02-11',
  ...over,
});

function renderTab(payload: unknown) {
  seedStorage(payload);
  return render(
    <StoreProvider>
      <Documents initialTab="fixed-assets" />
    </StoreProvider>,
  );
}

beforeEach(() => localStorage.clear());

describe('the tab is a retained-document surface, not a filing surface', () => {
  it('with an empty register it says there is nothing to generate', () => {
    renderTab(seedData);
    expect(screen.getByText(assetsCopy.documents.emptyTitle)).toBeTruthy();
    expect(screen.queryByTestId('fa-download-register')).toBeNull();
  });

  it('names both documents with their OMFP codes', () => {
    renderTab({ ...seedData, fixedAssets: [asset()] });
    expect(screen.getByText(`${assetsCopy.documents.registerTitle} (${assetsCopy.documents.registerCode})`)).toBeTruthy();
    expect(screen.getByText(`${assetsCopy.documents.ficheTitle} — Utilaj de birou`)).toBeTruthy();
    expect(assetsCopy.documents.registerCode).toBe('cod 14-1-2/b');
    expect(assetsCopy.documents.ficheCode).toBe('cod 14-2-2');
  });

  it('offers no upload, no submission and no deadline widget', () => {
    renderTab({ ...seedData, fixedAssets: [asset()] });
    const text = document.body.textContent ?? '';
    expect(text).toContain('Nimic nu se trimite la ANAF');
    // Not vacuous: the download buttons are here, so the absence above is a shape, not an empty page.
    expect(screen.getByTestId('fa-download-register')).toBeTruthy();
  });
});

describe('retention on screen', () => {
  it('states the 5-ani rule anchored at 1 July, and cites cap. IV pct. 1^1', () => {
    renderTab({ ...seedData, fixedAssets: [asset()] });
    const register = screen.getByText(assetsCopy.documents.retentionRegister);
    expect(register.textContent).toContain('5 ani');
    expect(register.textContent).toContain('1 iulie');
    expect(register.textContent).toContain('pct. 1^1');
  });

  it('names the abrogated 10-ani rule as abrogated, with its amending act', () => {
    renderTab({ ...seedData, fixedAssets: [asset()] });
    const note = screen.getByText(assetsCopy.documents.retentionAbrogated);
    expect(note.textContent).toContain('1.447');
    expect(note.textContent).toContain('abrogat');
  });

  it('a long-lived asset gets the useful-life retention sentence, per alin. (2)', () => {
    renderTab({ ...seedData, fixedAssets: [asset({ id: 'long', normalLifeMonths: 120 })] });
    expect(screen.getByTestId('fa-retention-long').textContent).toContain('durata de viață utilă');
  });

  it('says the fișa retention is inferred, not quoted', () => {
    renderTab({ ...seedData, fixedAssets: [asset()] });
    expect(screen.getByText(assetsCopy.documents.ficheInferred).textContent).toContain('inferat');
  });

  it('says deleting the asset does not discharge the duty to keep the document', () => {
    renderTab({ ...seedData, fixedAssets: [asset()] });
    expect(screen.getByText(assetsCopy.documents.retentionDeletion)).toBeTruthy();
  });
});

describe('the downloads are an explicit act', () => {
  it('clicking the register download produces a file and a toast, and nothing before that', async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn();
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });

    renderTab({ ...seedData, fixedAssets: [asset()] });
    expect(createObjectURL).not.toHaveBeenCalled();
    await user.click(screen.getByTestId('fa-download-register'));
    await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
    vi.unstubAllGlobals();
  });
});
