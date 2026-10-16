/**
 * B-93 acceptance 3 — the refusal is visible, and it names the asset.
 *
 * B-106 is the standing counter-example in this repository: a `review_required` state with no reason
 * attached is not a refusal, it is a dead end. Before B-93 the Assets page showed a schedule and the
 * estimate deducted something else, with nothing on screen connecting the two. These tests pin the surface
 * that connects them: the card says whether this asset's plan actually enters the estimate, and when it
 * does not, it says why and names the colliding expense.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Assets from './Assets';
import { StoreProvider } from '../data/store';
import { seedStorage } from '../test/storage';
import { seedData } from '../data/seed';
import { assets as assetsCopy } from '../ui/copy';
import type { Expense, FixedAsset } from '../data/types';
import { lei, ron } from '../domain/money';
import { pinClock } from '../test/clock';

const asset = (over: Partial<FixedAsset> = {}): FixedAsset => ({
  id: 'a1',
  label: 'Utilaj de birou',
  entryDate: '2026-02-10',
  putInFunctionDate: '2026-02-15',
  fiscalValue: lei(120000),
  normalLifeMonths: 60,
  method: 'degresiv',
  acquisition: 'cumparare',
  paymentState: 'achitat',
  paidOn: '2026-02-11',
  ...over,
});

const typedDepreciation: Expense = {
  id: 'exp-amortizare-tipita',
  tip: 'factura',
  nr: 'Înreg-2026-0001',
  date: '2026-09-10',
  paid: '2026-09-10',
  furnizor: 'Registrul de amortizare',
  cui: 'RO00000000',
  valoareFaraTva: ron(70000),
  tva: ron(0),
  status: 'inregistrata',
  category: 'depreciation_business_asset',
};

function renderPage(payload: unknown) {
  seedStorage(payload);
  return render(
    <StoreProvider>
      <Assets />
    </StoreProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  // The page asks the assembler "is this expense in the period?", and the period is measured as of today.
  // Without a pinned clock that question is answered by the wall clock, and the repository's wall-clock guard
  // exists precisely to make such a test fail rather than drift.
  pinClock();
});

describe('a schedule that reaches the estimate says so', () => {
  it('the card states the posted figure for the profile fiscal year', () => {
    renderPage({ ...seedData, fixedAssets: [asset()] });
    const posted = screen.getByTestId('asset-posted-a1');
    // 120.000 lei, 60 months, degresiv 1,5, ten months in 2026 -> 30.000 lei.
    expect(posted.textContent).toContain('30.000');
    expect(posted.textContent).toContain(String(seedData.profile.fiscalYear));
  });

  it('the posted figure is the post-ceiling one, and the card says so', () => {
    renderPage({ ...seedData, fixedAssets: [asset({ isM1Vehicle: true, method: 'liniar' })] });
    const posted = screen.getByTestId('asset-posted-a1');
    // 24.000 lei/an = 2.000 lei/lună, capped at 1.500 lei/lună over ten months = 15.000 lei.
    expect(posted.textContent).toContain('15.000');
    expect(posted.textContent).not.toContain('20.000');
    expect(screen.getByText(assetsCopy.posting.ceilingTravels)).toBeTruthy();
  });

  it('the stale sentence that told the user these figures were not yet a cost is gone', () => {
    renderPage({ ...seedData, fixedAssets: [asset()] });
    expect(
      screen.queryByText('Cifrele de mai jos nu sunt încă o cheltuială.'),
    ).toBeNull();
  });
});

describe('a withheld schedule names the collision', () => {
  const payload = {
    ...seedData,
    fixedAssets: [asset()],
    expenses: [...seedData.expenses, typedDepreciation],
  };

  it('the card carries a refusal block, and it is the asset that is named', () => {
    renderPage(payload);
    const block = screen.getByTestId('asset-conflict-a1');
    expect(block).toBeTruthy();
    expect(block.textContent).toContain(assetsCopy.posting.conflictHeading);
    expect(block.textContent).toContain('de două ori');
  });

  it('the colliding expense is named by id, so the user knows which row to remove', () => {
    renderPage(payload);
    expect(screen.getByTestId('asset-conflict-expenses-a1').textContent).toContain('exp-amortizare-tipita');
  });

  it('no posted figure is shown for a withheld schedule', () => {
    renderPage(payload);
    expect(screen.queryByTestId('asset-posted-a1')).toBeNull();
  });

  it('the card says why every schedule is withheld, not only this one', () => {
    renderPage(payload);
    expect(screen.getByText(assetsCopy.posting.conflictWhyAll)).toBeTruthy();
  });

  it('the card states the fix, in both directions, without choosing one', () => {
    renderPage(payload);
    const fix = screen.getByText(assetsCopy.posting.conflictFix).textContent ?? '';
    expect(fix).toContain('șterge');
    expect(fix).toContain('păstreaz');
  });

  it('an asset whose schedule refused gets no conflict block — there is nothing to withhold', () => {
    renderPage({
      ...seedData,
      fixedAssets: [asset({ normalLifeMonths: undefined, method: undefined })],
      expenses: [...seedData.expenses, typedDepreciation],
    });
    expect(screen.queryByTestId('asset-conflict-a1')).toBeNull();
    expect(screen.getByTestId('asset-gap-a1')).toBeTruthy();
  });
});

/**
 * B-155 — the card had to start reading the scope it was already being given.
 *
 * `selectAssetDepreciation` decides `DepreciationConflict.scope` per conflict: `'register-wide'` only when
 * some typed depreciation expense in the period names **no** asset, `'asset'` when every one of them names
 * one. The dashboard coverage row has branched on it since B-108; the card printed `conflictWhyAll` for
 * every conflict, so on a two-asset register it told the person that nothing in the register posts while
 * the other asset's own card, on the same screen, said its schedule had posted.
 *
 * Both branches are asserted **on a register with two assets**, and the two payloads differ in exactly one
 * fact — whether the typed expense carries an `assetId`. That is what makes the difference proven rather
 * than assumed: a card that ignored the scope could not pass this pair.
 */
describe('B-155 — the conflict sentence says how far the refusal reaches', () => {
  const second = asset({ id: 'a2', label: 'Monitor de birou', fiscalValue: lei(6000) });
  const linked = { ...typedDepreciation, assetId: 'a1' };

  it('a linked expense narrows the refusal: this asset is withheld, the other posts', () => {
    renderPage({
      ...seedData,
      fixedAssets: [asset(), second],
      expenses: [...seedData.expenses, linked],
    });
    const scope = screen.getByTestId('asset-conflict-scope-a1').textContent ?? '';
    expect(scope).toContain('Planurile celorlalte bunuri din registru nu sunt atinse');
    // The register-wide sentence is the false one here, and it must not appear anywhere on the page.
    expect(screen.queryByText(assetsCopy.posting.conflictWhyAll)).toBeNull();
    expect(screen.getByText(assetsCopy.posting.conflictFixAsset).textContent).toContain('celorlalte bunuri');
    // And the claim the narrowed sentence makes is checked against the other card, not taken on trust.
    expect(screen.queryByTestId('asset-conflict-a2')).toBeNull();
    expect(screen.getByTestId('asset-posted-a2')).toBeTruthy();
  });

  it('one unlinked expense widens it back: both cards say no schedule posts', () => {
    renderPage({
      ...seedData,
      fixedAssets: [asset(), second],
      expenses: [...seedData.expenses, typedDepreciation],
    });
    for (const id of ['a1', 'a2']) {
      const scope = screen.getByTestId(`asset-conflict-scope-${id}`).textContent ?? '';
      expect(scope).toContain('niciun plan din registru nu este postat');
      expect(scope).not.toContain('Planurile celorlalte bunuri');
    }
    expect(screen.queryByTestId('asset-posted-a2')).toBeNull();
  });
});
