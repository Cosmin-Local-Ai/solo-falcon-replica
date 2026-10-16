/**
 * B-145 — the register path for a carried-in fiscal loss.
 *
 * Brief 70 implemented art. 118 alin. (4)-(5) in the engine and asserted it twelve ways in
 * `tax.lossCarryIn.test.ts` — every one of those calls passed `priorYearLosses` **as an argument**. That is
 * exactly the gap it reported and did not fill: the engine could apply the rule, and no register could tell it
 * about a loss. `pierderiReportate` was `lei(0)` on every live path, so the twelve assertions proved the
 * arithmetic and nothing at all proved a person could reach it.
 *
 * This file is the register half. It drives `getTaxEstimate` — the same function the screens call — with a
 * profile that carries `priorYearFiscalLosses`, and asserts the loss changes the figures. If the field were
 * declared but never threaded, or threaded but stripped by the load gate, or threaded into one call site and
 * not the other, a test here fails and none of the engine's twelve would.
 */
import { describe, expect, it } from 'vitest';
import { getTaxEstimate } from './dashboard';
import { seedData } from './seed';
import type { AppData } from './types';
import { lei, ron, type Bani } from '../domain/money';
import type { PriorYearFiscalLoss } from '../domain/models';

/** Mid-year 2026: inside the active period, so the register computes a live estimate. */
const AS_OF = '2026-06-30';

const LOSS_LINE =
  'Pierderi fiscale reportate din anii precedenți (art. 118 alin. (4), rd. 5 — aceeași sursă, 5 ani fiscali)';

/** One revenue: 30.000,00 lei net from the independent activity, no expenses. */
function register(losses?: PriorYearFiscalLoss[]): AppData {
  return {
    ...seedData,
    profile: {
      ...seedData.profile,
      pfaStartDate: '2026-01-01',
      pfaStartYear: 2026,
      fiscalYear: 2026,
      ...(losses === undefined ? {} : { priorYearFiscalLosses: losses }),
    },
    revenues: [
      {
        id: 'rev-loss-1',
        tip: 'factura',
        nr: 'FCT-L1',
        date: '2026-03-03',
        client: 'Client SRL',
        cui: 'RO00000000',
        valoareFaraTva: ron(30_000),
        tva: ron(0),
        status: 'inregistrata',
      },
    ],
    expenses: [],
  } as unknown as AppData;
}

function lineValue(est: { lines: { label: string; value: Bani }[] }, label: string): Bani | undefined {
  return est.lines.find(l => l.label === label)?.value;
}

describe('B-145 — a persisted carried-in loss reaches the engine through the register', () => {
  it('a register with no losses declared carries no loss line at all', async () => {
    const est = await getTaxEstimate(register(), AS_OF);
    if (est.status !== 'computed') throw new Error('expected a computed estimate');
    expect(lineValue(est, LOSS_LINE)).toBeUndefined();
    expect(est.lossCarryIn).toBeUndefined();
  });

  it('the same register with a declared loss offsets it, and the engine reports the offset', async () => {
    const est = await getTaxEstimate(register([{ source: 'activitate_independenta', lossYear: 2023, amount: lei(10_000) }]), AS_OF);
    if (est.status !== 'computed') throw new Error('expected a computed estimate');
    // The line exists — which is the whole point of B-145. Before this step it could not exist on a live path.
    expect(lineValue(est, LOSS_LINE)).toBe(lei(10_000));
    expect(est.lossCarryIn).toBeDefined();
    expect(est.lossCarryIn!.reportate).toBe(lei(10_000));
    expect(est.lossCarryIn!.compensata).toBe(lei(10_000));
    // art. 118 alin. (2¹): the base the deductions are re-measured against is `net − rd.6`.
    expect(est.lossCarryIn!.recalculat).toBe(lei(20_000));
  });

  it('the per-year shape survives the register: a loss outside the 5 ani fiscali is expired, not used', async () => {
    // 2019 for a 2026 declaration is six years back — outside „pentru o perioadă de 5 ani fiscali”.
    // A persisted aggregate (the shape D212 rd.5 suggests) could not express this at all: there would be no
    // year to age. This is why the field is per loss year even though the return asks for one total.
    const est = await getTaxEstimate(register([{ source: 'activitate_independenta', lossYear: 2019, amount: lei(10_000) }]), AS_OF);
    if (est.status !== 'computed') throw new Error('expected a computed estimate');
    expect(est.lossCarryIn).toBeDefined();
    expect(est.lossCarryIn!.reportate).toBe(lei(0));
    expect(est.lossCarryIn!.compensata).toBe(lei(0));
    expect(est.lossCarryIn!.expirate).toEqual([{ lossYear: 2019, amount: lei(10_000) }]);
  });

  it('the per-source shape survives the register too: a DPI loss does not offset independent-activity net', async () => {
    // art. 118 alin. (4): „la nivelul fiecărei surse”. Without a persisted `source` the app could not apply
    // this, and an aggregate would silently offset across sources the article keeps apart.
    const est = await getTaxEstimate(
      register([{ source: 'drepturi_proprietate_intelectuala', lossYear: 2024, amount: lei(10_000) }]),
      AS_OF,
    );
    if (est.status !== 'computed') throw new Error('expected a computed estimate');
    expect(est.lossCarryIn!.altaSursa).toHaveLength(1);
    expect(est.lossCarryIn!.compensata).toBe(lei(0));
  });

  it('the 70 % ceiling is measured on this year\'s net, and the register path applies it', async () => {
    // 30.000 net ⇒ plafon 21.000. A 40.000 loss inside the window offsets 21.000 and keeps the rest.
    const est = await getTaxEstimate(register([{ source: 'activitate_independenta', lossYear: 2024, amount: lei(40_000) }]), AS_OF);
    if (est.status !== 'computed') throw new Error('expected a computed estimate');
    expect(est.lossCarryIn!.plafon).toBe(lei(21_000));
    expect(est.lossCarryIn!.compensata).toBe(lei(21_000));
    expect(est.lossCarryIn!.ramase).toEqual([{ lossYear: 2024, amount: lei(19_000) }]);
  });

  it('the oldest loss is used first — art. 118 alin. (5) lit. a), which only a per-year field can order', async () => {
    // 30.000 net ⇒ 70 % ceiling of 21.000. Two losses of 15.000 each total 30.000, so the ceiling forces an
    // ordering choice: the 2022 one must be consumed whole and the 2024 one only partly. If the engine took
    // them in the other order, `ramase` would name 2022 — which is exactly what alin. (5) lit. a) forbids:
    // „reportul se efectuează cronologic, în funcție de veşimea pierderii”.
    const est = await getTaxEstimate(
      register([
        { source: 'activitate_independenta', lossYear: 2024, amount: lei(15_000) },
        { source: 'activitate_independenta', lossYear: 2022, amount: lei(15_000) },
      ]),
      AS_OF,
    );
    if (est.status !== 'computed') throw new Error('expected a computed estimate');
    expect(est.lossCarryIn!.plafon).toBe(lei(21_000));
    expect(est.lossCarryIn!.compensata).toBe(lei(21_000));
    expect(est.lossCarryIn!.ramase).toEqual([{ lossYear: 2024, amount: lei(9_000) }]);
  });
});
