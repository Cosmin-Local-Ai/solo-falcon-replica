import { describe, expect, it } from 'vitest';
import { parseAppDataResult, type PersistedAppData } from './schema';
import { pfaProfileSchema } from '../domain/schema';
import {
  CURRENT_DATA_VERSION,
  DATA_VERSION_DISPOSAL_PROCEEDS,
  DATA_VERSION_PRIOR_YEAR_LOSSES,
  migratePersistedData,
} from './migration';
import { seedData } from './seed';
import { lei } from '../domain/money';

/**
 * B-145 — a carried-in fiscal loss can now be persisted, at chain step v24→v25.
 *
 * Brief 70 built the engine side of art. 118 alin. (4)-(5) — per-source offset, chronological by age, the
 * 5-fiscal-year window, the 70 % cap, and the fact that the offset is not elective — and asserted it twelve
 * ways. It then **reported rather than closed** the persistence gap, and the reason was a real tension:
 * **D212 rd.5 asks for one total with no per-year column**, while art. 118 alin. (4)-(5) cannot be applied to
 * a total at all. Brief 70 refused to invent a persisted ageing schedule from a form field that does not
 * carry one. That left the app able to compute the relief and unable to be told about the loss:
 * `pierderiReportate` stayed `lei(0)` and every later year's tax was overstated by a loss the person had
 * already declared.
 *
 * The properties this file guards:
 *  - the step exists at exactly this edge, appended and never renumbered;
 *  - it **backfills nothing** — a carried-in loss is a fact about a filed return, and deriving one from a
 *    negative result in this register would invent a loss nobody declared;
 *  - the load gate **declares** the field, because zod strips undeclared keys: an undeclared list would be
 *    erased on the next load and the engine would silently go back to zero while the person believed the loss
 *    was on the return;
 *  - the entries stay per source and per loss year, because the window, the per-source rule and the
 *    chronological order are all per-loss facts.
 *
 * And what this step does NOT buy, stated rather than implied: because D212 rd.5 carries no per-year split,
 * **the app can age a declared split but cannot verify one.** The Settings screen says so in those words.
 */

/** A profile in the shape a **v24** install stored it: no `priorYearFiscalLosses` key at all. */
const PRE_STEP_PROFILE = { ...seedData.profile, priorYearFiscalLosses: undefined };

/**
 * A payload as a **v24 install** stored it — the shape immediately before this step. One rung behind, with
 * the disposal-proceeds field already opened, so the fixture tests this step rather than the three before it.
 */
function payloadAtV24(overrides: Record<string, unknown> = {}): PersistedAppData {
  return {
    version: DATA_VERSION_DISPOSAL_PROCEEDS,
    profile: PRE_STEP_PROFILE,
    revenues: seedData.revenues,
    expenses: seedData.expenses,
    clients: seedData.clients,
    documents: seedData.documents,
    companyDocs: seedData.companyDocs,
    statements: seedData.statements,
    snapshots: seedData.snapshots,
    settings: seedData.settings,
    reservedAmount: null,
    ...overrides,
  } as unknown as PersistedAppData;
}

describe('B-145 — the `prior-year-fiscal-losses` step (v24 → v25)', () => {
  it('is present at exactly this edge, appended and never renumbered', () => {
    const outcome = migratePersistedData(payloadAtV24());
    expect(outcome.fromVersion).toBe(DATA_VERSION_DISPOSAL_PROCEEDS);
    expect(outcome.toVersion).toBe(CURRENT_DATA_VERSION);
    expect(outcome.stepsApplied).toEqual(['prior-year-fiscal-losses']);
    expect(CURRENT_DATA_VERSION).toBe(DATA_VERSION_PRIOR_YEAR_LOSSES);
  });

  it('backfills nothing: a v24 profile still has no `priorYearFiscalLosses` after the whole chain ran', () => {
    const parsed = parseAppDataResult(JSON.stringify(payloadAtV24()));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const outcome = migratePersistedData(parsed.data);
    const profile = outcome.data.profile!;
    // Absence stays absence. An empty array would read as "checked, and there are none", which is a different
    // claim from "nobody told the app" — and the engine's own reporting depends on that difference.
    expect('priorYearFiscalLosses' in profile).toBe(false);
    expect(profile.priorYearFiscalLosses).toBeUndefined();
  });

  it('keeps every collection it did, and gains no key anywhere', () => {
    const before = payloadAtV24();
    const outcome = migratePersistedData(before);
    expect(outcome.data.revenues!.map(r => r.id)).toEqual(before.revenues!.map(r => r.id));
    expect(outcome.data.expenses!.map(e => e.id)).toEqual(before.expenses!.map(e => e.id));
    expect(Object.keys(outcome.data).sort()).toEqual(Object.keys(before).sort());
  });

  it('a payload that already declares losses keeps them, which is what makes the step a no-op and not a wipe', () => {
    const declared = {
      source: 'activitate_independenta',
      lossYear: 2022,
      amount: lei(40000),
    };
    const payload = payloadAtV24({
      profile: { ...seedData.profile, priorYearFiscalLosses: [declared] },
    });
    const parsed = parseAppDataResult(JSON.stringify(payload));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const outcome = migratePersistedData(parsed.data);
    expect(outcome.data.profile!.priorYearFiscalLosses).toEqual([declared]);
    expect(migratePersistedData(outcome.data).stepsApplied).toEqual([]);
  });

  it('the load gate declares the field, so zod cannot strip losses the person entered', () => {
    // The standing reason every optional field is declared here: zod strips undeclared keys. An undeclared
    // list would be erased on the next save-and-load and the engine would fall back to
    // `pierderiReportate = 0` — brief 70's reported gap, re-opened by accident.
    const parsed = pfaProfileSchema.safeParse({
      ...seedData.profile,
      priorYearFiscalLosses: [
        { source: 'activitate_independenta', lossYear: 2022, amount: 4000000 },
        { source: 'drepturi_proprietate_intelectuala', lossYear: 2023, amount: 150000 },
      ],
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.priorYearFiscalLosses).toHaveLength(2);
    // Per source AND per loss year survive: the 5-year window and the chronological order both read the year.
    expect(parsed.data.priorYearFiscalLosses!.map((l: { lossYear: number }) => l.lossYear)).toEqual([2022, 2023]);
    expect(parsed.data.priorYearFiscalLosses!.map((l: { source: string }) => l.source)).toEqual([
      'activitate_independenta',
      'drepturi_proprietate_intelectuala',
    ]);
  });

  it('the gate refuses a source art. 118 alin. (4) does not name, and refuses a signed loss', () => {
    // alin. (4) closes the list — „din activități independente, din drepturi de proprietate intelectuală și
    // din activități agricole, silvicultură și piscicultură” — and alin. (6) excludes the rest. A fourth
    // source would be a carry-forward route the article does not grant.
    const badSource = pfaProfileSchema.safeParse({
      ...seedData.profile,
      priorYearFiscalLosses: [{ source: 'dividende', lossYear: 2022, amount: 100 }],
    });
    expect(badSource.success).toBe(false);
    // D212 rd.5 validates „Doar valori pozitive”; a negative would double-count as an extra deduction.
    const negative = pfaProfileSchema.safeParse({
      ...seedData.profile,
      priorYearFiscalLosses: [{ source: 'activitate_independenta', lossYear: 2022, amount: -100 }],
    });
    expect(negative.success).toBe(false);
  });
});
