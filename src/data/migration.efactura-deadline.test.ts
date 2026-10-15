import { describe, expect, it } from 'vitest';
import {
  parseAppDataResult,
  settingsSchema,
  EFACTURA_TRIMITERE_READ_VALUES,
  type PersistedAppData,
} from './schema';
import {
  CURRENT_DATA_VERSION,
  DATA_VERSION_DOCUMENT_BLOB_REF,
  DATA_VERSION_EFACTURA_DEADLINE,
  migrateEfacturaDeadlineV22,
  migratePersistedData,
} from './migration';
import { seedData, emptyData } from './seed';
import { PERSONAS } from './personas';
import { lei } from '../domain/money';

/**
 * B-140 (D-EFACT-1) — the e-Factura sending-deadline preference, retired by the v21→v22 step.
 *
 * The defect had two faces and the test pins both.
 *
 * **The screen face.** `src/ui/copy/settings.ts` offered „În decurs de 2 zile de la emitere” while the very
 * card printed the citation that says **5 zile lucrătoare** — OUG 120/2021 art. 10 alin. (7) as amended by
 * OUG 89/2025 pct. 2 art. X, in force 01.01.2026, per `docs/ai/research/16` §Q2. The app contradicted
 * itself about a legal deadline in two places on one screen.
 *
 * **The data face, which is why this is a chain step.** The select wrote `'2-zile'` and `'imediat'`; the
 * persisted enum declared only `'manual'` and `'automat'`, which is what `seed.ts` wrote. So the load gate
 * refused any payload whose owner had touched the dropdown: `store.tsx` → `rejected()` → quarantine plus
 * seed. Choosing an option on screen destroyed the dataset.
 *
 * The three properties this file exists to keep true:
 *
 * 1. **Readable at every version.** All five tokens the app has ever written pass the gate, at v21 and at
 *    the head. This is the read-wide half, and it is the half that must land *before* the step: brief 67's
 *    finding is that a step which runs after the data holding the value is gone proves nothing. Test 1 and
 *    test 4 are the ones a deletion of the schema entry would break.
 * 2. **Not producible.** No write path in the app puts the value on a payload any more — not `seed.ts`, not
 *    the persona kit, not the Settings form (the select is gone). Test 3 pins the two writers; the e2e
 *    settings spec pins that no control remains.
 * 3. **Dropped by the named step, with nothing else taken with it.** Test 5 compares the whole payload
 *    before and after, key by key, and test 6 shows `dateContact` — the other answer in the same block —
 *    survives untouched.
 */

/** Every token the load gate admits for `settings.eFactura.trimitere`, written out beside the assertion. */
const READ_VOCABULARY: readonly string[] = EFACTURA_TRIMITERE_READ_VALUES;

/**
 * A payload as a **v21 install** stored it — the shape immediately before this step, money already in bani
 * with currency, `blobRef` already declared, and the settings block carrying the value the select wrote.
 *
 * Built as a payload, not as a value: the fixture has to look like the bytes a v21 install left behind, or
 * the chain has nothing to migrate and the test proves nothing.
 */
function payloadAtV21(trimitere: string): PersistedAppData {
  return {
    version: DATA_VERSION_DOCUMENT_BLOB_REF,
    profile: seedData.profile,
    revenues: seedData.revenues,
    expenses: seedData.expenses,
    clients: seedData.clients,
    documents: seedData.documents,
    companyDocs: seedData.companyDocs,
    statements: seedData.statements,
    snapshots: seedData.snapshots,
    settings: {
      ...seedData.settings,
      eFactura: { trimitere, dateContact: '2026-09-01' } as unknown as PersistedAppData['settings']['eFactura'],
    },
    reservedAmount: lei(1500),
  } as unknown as PersistedAppData;
}

type Assert<T extends true> = T;

/**
 * Compile-time pins. The write vocabulary is a type, so "no producer can create this" is a claim about
 * types: the app's own default settings and the persona settings both have to satisfy `SettingsState`
 * **without** the key, and the key has to be optional so a payload that still carries one keeps parsing.
 */
export type _b140_checks = [
  // The stored union still names the retired token, so a payload carrying it is a payload we can open.
  Assert<'2-zile' extends (typeof EFACTURA_TRIMITERE_READ_VALUES)[number] ? true : false>,
  Assert<'imediat' extends (typeof EFACTURA_TRIMITERE_READ_VALUES)[number] ? true : false>,
  // And the head of the chain has moved past this step: v22 is a rung, not the head any more.
  Assert<typeof DATA_VERSION_EFACTURA_DEADLINE extends typeof CURRENT_DATA_VERSION ? false : true>,
];

describe('B-140 — the e-Factura sending-deadline value', () => {
  it('is still readable: the gate accepts every token this app has ever written', () => {
    // The read-wide half. If this starts failing, the load gate has become the thing that decides — and
    // before this step it decided by refusing the whole payload.
    for (const trimitere of READ_VOCABULARY) {
      const parsed = settingsSchema.safeParse({
        ...seedData.settings,
        eFactura: { trimitere, dateContact: '' },
      });
      expect(parsed.success, `trimitere='${trimitere}'`).toBe(true);
    }
    // And absence is legal, because the step drops the key.
    expect(
      settingsSchema.safeParse({ ...seedData.settings, eFactura: { dateContact: '' } }).success,
    ).toBe(true);
  });

  it('the read vocabulary is exactly the union of both vocabularies the app wrote', () => {
    // `manual`/`automat` are what seed wrote; `2-zile`/`imediat` are what the select wrote. Neither pair is
    // dropped from the read side, and no third spelling has crept in.
    expect([...READ_VOCABULARY].sort()).toEqual(
      ['2-zile', '5-zile-lucratoare', 'automat', 'imediat', 'manual'].sort(),
    );
  });

  it('is not producible: no settings writer in the app emits it', () => {
    // `emptyData()` is what a fresh install saves, `seedData` is the fixture it starts from, and every
    // persona carries its own settings block. If any of them starts writing the key again, the retired
    // value is back in the wild and the step is no longer the thing that ends it.
    expect('trimitere' in emptyData().settings.eFactura).toBe(false);
    expect('trimitere' in seedData.settings.eFactura).toBe(false);
    for (const persona of PERSONAS) {
      expect('trimitere' in persona.data.settings.eFactura, persona.id).toBe(false);
    }
  });

  it('a v21 payload carrying the retired value opens at the gate rather than quarantining', () => {
    const raw = JSON.stringify(payloadAtV21('2-zile'));
    const parsed = parseAppDataResult(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    // The gate kept the value. This is the assertion a schema deletion would break.
    expect(parsed.data.settings.eFactura.trimitere).toBe('2-zile');
  });

  it('a current-version payload carrying it is still accepted, not quarantined', () => {
    // Read-wide at the head too: a payload restored from a backup, or imported, opens instead of being
    // refused for a value nothing can produce any more.
    const atHead = { ...payloadAtV21('manual'), version: CURRENT_DATA_VERSION };
    const parsed = parseAppDataResult(JSON.stringify(atHead));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.settings.eFactura.trimitere).toBe('manual');
  });

  it('the chain retires it, and the named step — not the gate — is what drops it', () => {
    const parsed = parseAppDataResult(JSON.stringify(payloadAtV21('2-zile')));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const outcome = migratePersistedData(parsed.data);
    expect(outcome.toVersion).toBe(CURRENT_DATA_VERSION);
    expect(outcome.stepsApplied).toEqual(['efactura-deadline', 'expense-asset-link', 'fixed-asset-disposal-proceeds']);

    // After the chain the value is gone from the payload, and it is gone because the step dropped it.
    expect('trimitere' in outcome.data.settings.eFactura).toBe(false);
    expect(JSON.stringify(outcome.data)).not.toContain('2-zile');
  });

  it('drops exactly one key: everything else in the payload is bit-for-bit what it was', () => {
    const before = payloadAtV21('manual');
    const after = migrateEfacturaDeadlineV22(before);

    expect(after.version).toBe(DATA_VERSION_EFACTURA_DEADLINE);
    // The rest of the settings block, including the other e-Factura answer, is untouched.
    expect(after.settings.cotaTva).toBe(before.settings.cotaTva);
    expect(after.settings.company).toBe(before.settings.company);
    expect(after.settings.personal).toBe(before.settings.personal);
    expect(after.settings.bankAccounts).toBe(before.settings.bankAccounts);
    expect(after.settings.eFactura.dateContact).toBe('2026-09-01');
    // Every other top-level key survives with the same identity — the step rebuilds `settings`, nothing else.
    for (const key of Object.keys(before)) {
      if (key === 'settings' || key === 'version') continue;
      expect(after[key as keyof PersistedAppData], key).toBe(before[key as keyof PersistedAppData]);
    }
    // And the payload gained no key: the step retires, it does not annotate.
    expect(Object.keys(after).sort()).toEqual(Object.keys(before).sort());
  });

  it('is idempotent: a payload with no such key is returned with only the version stamped', () => {
    const once = migrateEfacturaDeadlineV22(payloadAtV21('imediat'));
    const twice = migrateEfacturaDeadlineV22(once);
    expect(twice.settings.eFactura).toEqual(once.settings.eFactura);
    expect(twice.version).toBe(DATA_VERSION_EFACTURA_DEADLINE);
    // Re-running the chain at the head applies nothing. (`twice` sits at v22, so the one rung above it still
    // runs — the assertion about this step is that it does not run twice.)
    expect(migratePersistedData(twice).stepsApplied).toEqual(['expense-asset-link', 'fixed-asset-disposal-proceeds']);
  });

  it('the on-screen contradiction is gone: no copy offers 2 days, and the 5-working-day citation stands', async () => {
    const { settings } = await import('../ui/copy/settings');
    const { copy } = await import('../ui/copy');

    // The wrong option no longer exists as an offer. The retired wording survives in exactly one place —
    // the sentence that tells a person what they had chosen — and nowhere as a choice the screen presents.
    const values = Object.values(settings.eFactura).filter(v => typeof v === 'string') as string[];
    expect(values.filter(v => v.includes('2 zile de la emitere'))).toHaveLength(1);
    expect(settings.eFactura.retiredChoice).toContain('2 zile de la emitere');
    expect(values.some(v => v.trim().startsWith('În decurs de'))).toBe(false);
    // The card states the term the citation states, and the retirement is said out loud.
    expect(settings.eFactura.deadlineValue).toContain('5 zile lucrătoare');
    expect(settings.eFactura.retiredChoice).toContain('5 zile lucrătoare');
    expect(copy.sources.eFacturaDeadline).toContain('5 zile lucrătoare');
    // B-56's denial is still there — the card may not start claiming it sends anything.
    expect(settings.eFactura.sendingHint).toMatch(/nu trimite nimic/);
  });
});
