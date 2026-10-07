import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';
import { StoreProvider, useStore } from './store';
import { seedData } from './seed';
import type { Expense, Revenue, Toast } from './types';

// B-21 — the write path must refuse an unusable calendar date, loudly, and name the record,
// the field and the value. Before this, such a record was accepted and then vanished from
// every aggregate (`domain/aggregation.ts` `inPeriod`) with no trace at all.

// Must match STORAGE_KEY in src/data/store.tsx (module-private, not exported).
const STORAGE_KEY = 'pfa-app-data-v2';

let storeRef: ReturnType<typeof useStore> | null = null;
function Probe() {
  storeRef = useStore();
  return null;
}

beforeEach(() => {
  localStorage.clear();
  storeRef = null;
});

afterEach(() => {
  localStorage.clear();
});

function renderStore() {
  render(
    <StoreProvider>
      <Probe />
    </StoreProvider>,
  );
}

function persistedData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  expect(raw).not.toBeNull();
  return JSON.parse(raw!) as { revenues: Revenue[]; expenses: Expense[] };
}

/** The most recent error toast, if any. */
function lastError(): Toast | undefined {
  const errors = storeRef!.toasts.filter(t => t.kind === 'error');
  return errors[errors.length - 1];
}

function newRevenue(date: string): Omit<Revenue, 'id'> {
  return {
    tip: 'factura',
    nr: 'FCT-TEST-900',
    date,
    client: 'Presta Consulting SRL',
    cui: 'RO12345678',
    valoareFaraTva: 1000,
    tva: 210,
    status: 'inregistrata',
  };
}

// The four values the brief names, plus what each one breaks.
const MALFORMED: { value: string; reason: string }[] = [
  { value: '', reason: 'necompletat' },
  { value: '2026-6-1', reason: 'două cifre' },
  { value: '2026-13-01', reason: 'între 1 și 12' },
  { value: 'not-a-date', reason: 'citită ca o dată' },
];

describe('addRevenue — date validation (B-21)', () => {
  it.each(MALFORMED)('refuses %j and says which field and value', ({ value, reason }) => {
    renderStore();
    const before = storeRef!.revenues.length;

    let accepted: boolean | undefined;
    act(() => {
      accepted = storeRef!.addRevenue(newRevenue(value));
    });

    // The rejection is observable, not just a toast the user might miss.
    expect(accepted).toBe(false);
    expect(storeRef!.revenues).toHaveLength(before);
    expect(storeRef!.revenues.find(r => r.nr === 'FCT-TEST-900')).toBeUndefined();

    const toast = lastError();
    expect(toast).toBeDefined();
    expect(toast!.text).toContain('data');
    expect(toast!.text).toContain(value === '' ? 'necompletat' : value);
    expect(toast!.text).toContain(reason);
    expect(toast!.text).toContain('nu a fost salvată');
  });

  it('writes nothing to localStorage for a refused record', () => {
    renderStore();
    act(() => {
      storeRef!.addRevenue(newRevenue('2026-6-1'));
    });
    expect(persistedData().revenues).toEqual(seedData.revenues);
  });

  it('accepts a valid calendar date', () => {
    renderStore();
    const before = storeRef!.revenues.length;

    let accepted: boolean | undefined;
    act(() => {
      accepted = storeRef!.addRevenue(newRevenue('2026-06-01'));
    });

    expect(accepted).toBe(true);
    expect(storeRef!.revenues).toHaveLength(before + 1);
    expect(storeRef!.revenues.find(r => r.nr === 'FCT-TEST-900')?.date).toBe('2026-06-01');
    expect(lastError()).toBeUndefined();
  });

  it('rejects a malformed collection date even when the invoice date is valid', () => {
    renderStore();
    const before = storeRef!.revenues.length;

    let accepted: boolean | undefined;
    act(() => {
      accepted = storeRef!.addRevenue({ ...newRevenue('2026-06-01'), collected: '2026-6-1' });
    });

    // `collected` is the fiscally load-bearing date (Phase 9), so it is validated too.
    expect(accepted).toBe(false);
    expect(storeRef!.revenues).toHaveLength(before);
    expect(lastError()!.text).toContain('data încasării');
  });

  it('accepts an absent optional collection date', () => {
    renderStore();
    let accepted: boolean | undefined;
    act(() => {
      accepted = storeRef!.addRevenue({ ...newRevenue('2026-06-01'), collected: undefined });
    });
    expect(accepted).toBe(true);
  });
});

describe('updateRevenue — date validation (B-21)', () => {
  it('refuses the edit and leaves the stored record byte-identical', () => {
    renderStore();
    const original = storeRef!.revenues.find(r => r.id === 'r1')!;

    let accepted: boolean | undefined;
    act(() => {
      accepted = storeRef!.updateRevenue({ ...original, date: '2026-13-01' });
    });

    expect(accepted).toBe(false);
    expect(storeRef!.revenues.find(r => r.id === 'r1')).toEqual(original);
    expect(persistedData().revenues.find(r => r.id === 'r1')).toEqual(original);
    // The message names the record, so the user knows which row to fix.
    expect(lastError()!.text).toContain('r1');
    expect(lastError()!.text).toContain('2026-13-01');
  });

  it('accepts a valid edit', () => {
    renderStore();
    const original = storeRef!.revenues.find(r => r.id === 'r1')!;
    act(() => {
      storeRef!.updateRevenue({ ...original, date: '2026-07-15' });
    });
    expect(storeRef!.revenues.find(r => r.id === 'r1')?.date).toBe('2026-07-15');
  });
});

describe('expense date validation (B-21)', () => {
  const base = {
    tip: 'factura' as const,
    nr: 'FCT-PRO-900',
    date: '2026-06-01',
    furnizor: 'CloudHost SRL',
    cui: 'RO87654321',
    valoareFaraTva: 100,
    tva: 21,
    status: 'inregistrata' as const,
  };

  it.each(MALFORMED)('refuses a malformed invoice date %j', ({ value }) => {
    renderStore();
    const before = storeRef!.expenses.length;
    let accepted: boolean | undefined;
    act(() => {
      accepted = storeRef!.addExpense({ ...base, date: value });
    });
    expect(accepted).toBe(false);
    expect(storeRef!.expenses).toHaveLength(before);
    expect(lastError()!.text).toContain('Cheltuială');
  });

  it('refuses a malformed payment date, naming „data plății”', () => {
    renderStore();
    let accepted: boolean | undefined;
    act(() => {
      accepted = storeRef!.addExpense({ ...base, paid: 'not-a-date' });
    });
    expect(accepted).toBe(false);
    expect(lastError()!.text).toContain('data plății');
    expect(lastError()!.text).toContain('not-a-date');
  });

  it('accepts a valid expense', () => {
    renderStore();
    const before = storeRef!.expenses.length;
    let accepted: boolean | undefined;
    act(() => {
      accepted = storeRef!.addExpense({ ...base, paid: '2026-06-05' });
    });
    expect(accepted).toBe(true);
    expect(storeRef!.expenses).toHaveLength(before + 1);
  });
});

describe('other record kinds (B-21)', () => {
  it('refuses a declaration with no registration date', () => {
    renderStore();
    const before = storeRef!.declarations.length;
    let accepted: boolean | undefined;
    act(() => {
      accepted = storeRef!.addDeclaration({
        an: 2026,
        luna: 6,
        venituri: 1000,
        cheltuieli: 100,
        status: 'in-asteptare',
        dataInregistrare: '',
      });
    });
    expect(accepted).toBe(false);
    expect(storeRef!.declarations).toHaveLength(before);
    expect(lastError()!.text).toContain('data înregistrării');
  });

  it('refuses a company document with a malformed date', () => {
    renderStore();
    let accepted: boolean | undefined;
    act(() => {
      accepted = storeRef!.uploadDocument('facturi', {
        nume: 'doc',
        tip: 'pdf',
        content: 'x',
        marime: 1,
        data: '2026-6-1',
      });
    });
    expect(accepted).toBe(false);
    expect(lastError()!.text).toContain('Document');
  });

  it('does NOT date-validate perioada: free text like „T2 2026” is data, not a date', () => {
    renderStore();
    const before = storeRef!.statements.length;
    let accepted: boolean | undefined;
    act(() => {
      accepted = storeRef!.addStatement({
        tip: 'Declarație 112',
        perioada: 'T2 2026',
        depunere: 'SOLO',
        dataDepunere: '2026-07-25',
      });
    });
    // Rejecting this would be the mirror-image bug: silently destroying valid user data.
    expect(accepted).toBe(true);
    expect(storeRef!.statements).toHaveLength(before + 1);
  });

  it('refuses a statement with a malformed depunere date', () => {
    renderStore();
    let accepted: boolean | undefined;
    act(() => {
      accepted = storeRef!.addStatement({
        tip: 'Declarație 112',
        perioada: '2026-06',
        depunere: 'SOLO',
        dataDepunere: '2026-02-30',
      });
    });
    expect(accepted).toBe(false);
    expect(lastError()!.text).toContain('data depunerii');
  });
});
