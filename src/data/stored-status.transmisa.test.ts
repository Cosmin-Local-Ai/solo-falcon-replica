import { describe, expect, it } from 'vitest';
import { statusBadge, type AppData, type ExpenseStatus, type RevenueStatus, type StoredStatusCode } from './types';
import {
  declarationSchema,
  expenseSchema,
  parseAppDataResult,
  revenueSchema,
  type PersistedAppData,
} from './schema';
import {
  CURRENT_DATA_VERSION,
  DATA_VERSION_RECORD_CURRENCY,
  migratePersistedData,
} from './migration';
import { seedData } from './seed';
import { lei } from '../domain/money';

/**
 * B-141 — `transmisa`: a status word that means "transmitted", which this app never does.
 *
 * Brief 66 (B-56) deleted the sentence that rendered it. This file is about what survived that fix in the
 * data layer, and it pins the three claims the fix rests on — because the tempting reading of "dead
 * vocabulary" here is deletion, and deletion is the wrong answer:
 *
 * 1. **Not producible.** No write-path schema enumerates it, so nothing in the app can put it on a record.
 * 2. **Still readable.** `declarationSchema` accepts it, and a pre-v11 payload carrying it passes the one
 *    load gate and is then dropped by the *named* chain step. That ordering is deliberate and documented
 *    at `schema.ts` `declarationSchema`: zod strips undeclared keys, so if the gate refused the word the
 *    gate would be the thing that destroyed the row, not the step with a recorded decision.
 * 3. **Never renders as success.** It used to map to `badge-success`, which claimed an external system had
 *    accepted something.
 *
 * The reason this is a read-wide / write-narrow case and not a deletion is the same reason `impozit_pe_cit`
 * survives in `PFA_REGIME_VALUES`: this is a local-first app, a stored payload cannot be re-fetched, and
 * turning „a value no producer can create” into „a payload we refuse to open” is data loss. The proof that
 * it cannot appear on a *live* record is in test 1 — the write schemas reject it — and the proof that it
 * can appear in *stored bytes* is in tests 2 and 4, which are the ones a deletion would break.
 */

/** A monthly row as a pre-v11 payload stores it, carrying the legacy word. */
const LEGACY_ROW = {
  id: 'd-transmisa',
  an: 2026,
  luna: 3,
  venituri: lei(12500),
  cheltuieli: lei(1800),
  status: 'transmisa',
  dataInregistrare: '2026-04-10',
  dataTrimitere: '2026-04-15',
};

function payloadAt(version: number, overrides: Record<string, unknown> = {}): PersistedAppData {
  return {
    version,
    profile: seedData.profile,
    revenues: seedData.revenues,
    expenses: seedData.expenses,
    clients: [],
    documents: [],
    companyDocs: { im: [], cs: [], tva: [], facturi: [] },
    statements: [],
    snapshots: [],
    settings: seedData.settings,
    reservedAmount: null,
    ...overrides,
  } as unknown as PersistedAppData;
}

/** The four words the read union admits, written out so the list is visible next to the assertion. */
const READ_VOCABULARY: readonly StoredStatusCode[] = ['inregistrata', 'in-asteptare', 'respinsa', 'transmisa'];

type Assert<T extends true> = T;

/**
 * Compile-time pins. TypeScript, not a runtime `expect`: the write vocabularies are types, and the claim
 * "not producible" is a claim about which types a record can carry. If someone adds `'transmisa'` to
 * `RevenueStatus`, line 3 of this tuple stops compiling.
 */
export type _b141_checks = [
  Assert<'transmisa' extends StoredStatusCode ? true : false>,
  Assert<'transmisa' extends RevenueStatus ? false : true>,
  Assert<'transmisa' extends ExpenseStatus ? false : true>,
  // The other half of "cannot reach a screen": `declarations` is storage-only, so a monthly row that
  // somehow survives the chain has no key on the shape the pages read.
  Assert<'declarations' extends keyof AppData ? false : true>,
];

describe('B-141 — the legacy status `transmisa`', () => {
  it('is not producible: no write-path schema accepts it on a record', () => {
    const revenue = { ...(seedData.revenues[0] as object), status: 'transmisa' };
    const expense = { ...(seedData.expenses[0] as object), status: 'transmisa' };

    const r = revenueSchema.safeParse(revenue);
    const e = expenseSchema.safeParse(expense);

    expect(r.success).toBe(false);
    expect(e.success).toBe(false);
    // Rejected at the `status` field specifically — not for some unrelated shape error that would make
    // this pass for the wrong reason.
    expect(r.error?.issues.some(i => i.path.join('.') === 'status')).toBe(true);
    expect(e.error?.issues.some(i => i.path.join('.') === 'status')).toBe(true);
  });

  it('is still readable: the pre-v11 monthly row parses with it', () => {
    // The read-wide half. If this starts failing, the load gate has become the thing that destroys the
    // row, and the v10→v11 step is no longer the decision point.
    expect(declarationSchema.safeParse(LEGACY_ROW).success).toBe(true);
  });

  it('a pre-v11 payload carrying it loads, and the named step drops it — not the gate', () => {
    const raw = JSON.stringify(payloadAt(DATA_VERSION_RECORD_CURRENCY, { declarations: [LEGACY_ROW] }));

    const parsed = parseAppDataResult(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    // The gate kept the row. This is the assertion a deletion would break.
    expect(parsed.data.declarations).toHaveLength(1);
    expect(parsed.data.declarations?.[0]?.status).toBe('transmisa');

    const outcome = migratePersistedData(parsed.data);
    expect(outcome.toVersion).toBe(CURRENT_DATA_VERSION);
    expect(outcome.stepsApplied).toContain('annual-filing');

    // After the chain the word is gone from the payload, and it is gone because the step dropped the row.
    expect('declarations' in outcome.data).toBe(false);
    expect(JSON.stringify(outcome.data)).not.toContain('transmisa');

    // Nothing else in the payload was collateral damage.
    expect(outcome.data.revenues).toHaveLength(seedData.revenues.length);
    expect(outcome.data.revenues.map(r => r.id)).toEqual(seedData.revenues.map(r => r.id));
  });

  it('a current-version payload carrying it is still accepted rather than quarantined', () => {
    // Read-wide at the head of the chain too: the gate does not refuse the word at any version, so a
    // payload that somehow still holds a monthly row opens instead of quarantining.
    const raw = JSON.stringify(payloadAt(CURRENT_DATA_VERSION, { declarations: [LEGACY_ROW] }));
    const parsed = parseAppDataResult(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.declarations?.[0]?.status).toBe('transmisa');
  });

  it('renders no success badge, for any status the app can read', () => {
    expect(statusBadge('transmisa')).toBe('badge-neutral');
    expect(statusBadge('transmisa')).not.toBe('badge-success');

    // The whole read vocabulary, so the pin does not have to be re-added when the next legacy word appears.
    for (const code of READ_VOCABULARY) {
      expect(statusBadge(code)).not.toBe('badge-success');
    }
  });
});
