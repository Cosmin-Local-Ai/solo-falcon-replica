/**
 * B-112 STAGE 1 — the DPI income category on the Venituri surface.
 *
 * The defect this stage exists to fix was representational before it was arithmetic: a `Revenue` carried
 * `tip`, a document type, and no income category, so the app could not hold art. 70 income at all and the
 * estimate silently omitted an entire income category. A field the person cannot set is a category that
 * does not exist, so this file pins three things: the form offers the category, choosing DPI reveals the
 * two facts that decide the DPI consequences, and a stored DPI record is visibly marked on its row.
 *
 * The last one matters more than it looks. A DPI row that renders exactly like an art. 67 row is how the
 * omission survives a review of the screen — the register would show the money and the estimate would
 * leave it out, with nothing on the row to explain the difference.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import Revenues from './Revenues';
import { StoreProvider } from '../data/store';
import { CURRENT_DATA_VERSION } from '../data/migration';
import { seedData } from '../data/seed';
import type { Revenue } from '../data/types';
import { ron } from '../domain/money';
import { pinClock, unpinClock } from '../test/clock';
import { fixedInstant } from '../test/fixedInstant';

const STORAGE_KEY = 'pfa-app-data-v2';

function revenue(over: Partial<Revenue> = {}): Revenue {
  return {
    id: over.id ?? 'dpi-rev',
    tip: 'factura',
    nr: 'FCT-2026-700',
    date: '2026-05-12',
    client: 'Client Test SRL',
    cui: 'RO99999998',
    valoareFaraTva: ron(5000),
    tva: ron(0),
    status: 'inregistrata',
    ...over,
  };
}

function seedWith(revenues: Revenue[]) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...seedData,
      revenues: [...seedData.revenues, ...revenues],
      version: CURRENT_DATA_VERSION,
    }),
  );
}

beforeEach(() => {
  pinClock(fixedInstant());
});
afterEach(() => {
  cleanup();
  unpinClock();
  localStorage.clear();
});

describe('B-112 — the income category is a field the person can set', () => {
  it('the add form offers the category, with both articles named', () => {
    seedWith([]);
    render(
      <StoreProvider>
        <Revenues />
      </StoreProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Adaugă venit/ }));

    const select = document.querySelector<HTMLSelectElement>('select[name="revenue-income-category"]');
    expect(select).not.toBeNull();
    const options = Array.from(select!.options).map((o) => o.value);
    expect(options).toEqual(['activitate_independenta', 'drepturi_de_proprietate_intelectuala']);
    // The labels name the articles, not just the Romanian phrases — the two categories are defined by
    // art. 67 and art. 70, and a person deciding between them needs the citation on the screen.
    const labels = Array.from(select!.options).map((o) => o.textContent ?? '');
    expect(labels.join(' ')).toContain('art. 67');
    expect(labels.join(' ')).toContain('art. 70');
  });

  it('the DPI facts are hidden until the category is DPI, because they have no effect otherwise', () => {
    seedWith([]);
    render(
      <StoreProvider>
        <Revenues />
      </StoreProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Adaugă venit/ }));

    expect(document.querySelector('select[name="revenue-dpi-contract-type"]')).toBeNull();
    expect(document.querySelector('select[name="revenue-dpi-excluded-kind"]')).toBeNull();

    fireEvent.change(document.querySelector('select[name="revenue-income-category"]')!, {
      target: { value: 'drepturi_de_proprietate_intelectuala' },
    });

    expect(document.querySelector('select[name="revenue-dpi-contract-type"]')).not.toBeNull();
    expect(document.querySelector('select[name="revenue-dpi-excluded-kind"]')).not.toBeNull();
  });

  it('the exclusion field states both consequences, not only the quota one', () => {
    // One stored flag, two consequences: no 40 % forfetară quota (art. 72 alin. (3)) AND outside CAS
    // (art. 137 alin. (1) lit. b^1)). A hint that mentions only the quota leaves the person to discover
    // the contribution half on their own.
    seedWith([]);
    render(
      <StoreProvider>
        <Revenues />
      </StoreProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Adaugă venit/ }));
    fireEvent.change(document.querySelector('select[name="revenue-income-category"]')!, {
      target: { value: 'drepturi_de_proprietate_intelectuala' },
    });

    const text = document.body.textContent ?? '';
    expect(text).toContain('art. 72 alin. (3)');
    expect(text).toContain('art. 137 alin. (1) lit. b^1)');
    expect(text).toContain('Nu sunt două întrebări separate');
  });

  it('the contract-object field cites the article that decides it, and the ÎCCJ decision', () => {
    // The category is not inferred from the taxpayer having a PFA, and the screen says why: art. 40 vs
    // art. 47 of Legea 8/1996, and ÎCCJ dec. nr. 1793/2021 refusing DPI for contracts merely labelled so.
    seedWith([]);
    render(
      <StoreProvider>
        <Revenues />
      </StoreProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Adaugă venit/ }));
    fireEvent.change(document.querySelector('select[name="revenue-income-category"]')!, {
      target: { value: 'drepturi_de_proprietate_intelectuala' },
    });

    const text = document.body.textContent ?? '';
    expect(text).toContain('art. 40');
    expect(text).toContain('art. 47');
    expect(text).toContain('1793');
  });
});

describe('B-112 — a stored DPI record is marked on its row', () => {
  it('an art. 70 record shows the DPI marker', () => {
    seedWith([revenue({ id: 'dpi-row', incomeCategory: 'drepturi_de_proprietate_intelectuala' })]);
    render(
      <StoreProvider>
        <Revenues />
      </StoreProvider>,
    );
    expect(screen.getByText('art. 70 · DPI')).toBeInTheDocument();
  });

  it('a pre-B-112 record with no category key carries no marker and no warning', () => {
    // Every payload written before this stage. The default reading is a statement about history, not a
    // finding, and a marker on it would read as a problem with a record that has none.
    seedWith([revenue({ id: 'legacy-row' })]);
    render(
      <StoreProvider>
        <Revenues />
      </StoreProvider>,
    );
    expect(screen.queryByText('art. 70 · DPI')).toBeNull();
    expect(screen.queryByText(/declarație contradictorie/)).toBeNull();
  });

  it('a record whose declared category and declared contract object contradict each other is marked', () => {
    seedWith([
      revenue({
        id: 'conflict-row',
        incomeCategory: 'drepturi_de_proprietate_intelectuala',
        dpiContractType: 'contract_de_comanda',
      }),
    ]);
    render(
      <StoreProvider>
        <Revenues />
      </StoreProvider>,
    );
    expect(screen.getByText('art. 70 · DPI')).toBeInTheDocument();
    expect(screen.getByText('declarație contradictorie — venit nepostat')).toBeInTheDocument();
  });

  it('B-149 — an art. 67 record carrying the same contradiction is marked too, in words that are true of it', () => {
    // The half the gate used to hide. `dpiRecordConflict` answers for this pair, B-117 already reports it on
    // the coverage surface, and the register said nothing — the app half-reported one fact. The tag cannot
    // reuse „venit nepostat”: this receipt is posted, and `estimateBasis.dpiCoverageGaps` gives its row
    // `amount: null` precisely because the estimate already computed on it at full value.
    seedWith([
      revenue({
        id: 'art67-conflict',
        incomeCategory: 'activitate_independenta',
        dpiContractType: 'cesiune_licenta',
      }),
    ]);
    render(
      <StoreProvider>
        <Revenues />
      </StoreProvider>,
    );
    expect(screen.getByText('declarație contradictorie — venitul este postat la art. 67')).toBeInTheDocument();
    // And the two tags are not interchangeable: the unposted wording must not reach a posted record.
    expect(screen.queryByText('declarație contradictorie — venit nepostat')).toBeNull();
    // The category marker stays DPI-only — art. 67 is the default, and marking it would read as a finding
    // on every record that carries none.
    expect(screen.queryByText('art. 70 · DPI')).toBeNull();
  });

  it('B-149 — the art. 72 alin. (3) exclusion carried on an art. 67 record is the same finding, not a new one', () => {
    // `dpiRecordConflict` returns a reason for this pair as well. One contradiction must not carry two names
    // depending on which half of it is wrong — the rule `dpiCoverageGaps` already states for the coverage row.
    seedWith([
      revenue({
        id: 'art67-excluded-kind',
        incomeCategory: 'activitate_independenta',
        dpiExcludedKind: 'drept_de_suita',
      }),
    ]);
    render(
      <StoreProvider>
        <Revenues />
      </StoreProvider>,
    );
    expect(screen.getByText('declarație contradictorie — venitul este postat la art. 67')).toBeInTheDocument();
  });

  it('B-149 — a coherent art. 67 record still carries no tag', () => {
    // Widening the gate must not turn every ordinary receipt into a warning. The tag is the contradiction,
    // and a record with no contradiction has nothing to report.
    seedWith([
      revenue({ id: 'plain-art67' }),
      revenue({ id: 'coherent-dpi', incomeCategory: 'drepturi_de_proprietate_intelectuala', dpiContractType: 'cesiune_licenta' }),
    ]);
    render(
      <StoreProvider>
        <Revenues />
      </StoreProvider>,
    );
    expect(screen.queryByText(/declarație contradictorie/)).toBeNull();
  });
});
