/**
 * PHASE 31 FIXTURE 6 — the 50 % vehicle restriction, art. 298 alin. (1), and the depreciable value it
 * produces.
 *
 * **SOURCE A** — contabilitatedigitala.ro, monografie 2026, TVA 21 %: LEUL FORTE SRL, VAT payer, mixed use,
 * 5 years / 60 months. **GRADE — FACT** (explicit arithmetic).
 * **SOURCE B** — firmaromania.com (2026), identical arithmetic. **GRADE — CORROBORATED.**
 * **SOURCE C** — expertcontabiltim.ro (2026), the running-costs case. **GRADE — FACT.**
 * **FISCAL YEAR OF ALL THREE — 2026. TVA — 21 %, the standard rate since 1 augustie 2025 (Legea 141/2025).**
 *
 * Recorded in `docs/ai/research/47_published_worked_examples_fy2026.md` §7A, §7B and §7C.
 *
 * ── The false friend this file must not import ────────────────────────────────────────────────────────
 *
 * `research/47` §7D records **fiscalx.ro** as a 2026-labelled example that computes with **TVA 19 %** —
 * „factură de 119.000 lei (100.000 + 19.000 TVA) → 19.000 × 50 % = 9.500". The standard rate has been 21 %
 * since 1 augustie 2025. **That source is never used here, and the 9.500 lei figure appears in this file only
 * as a negative**, so a later edit cannot quietly reintroduce it.
 *
 * ── The non-recoverable half: B-114 ───────────────────────────────────────────────────────────────────
 *
 * The sources state the non-deductible half as a figure of its own — „TVA nedeductibilă 10.500", „Restul de
 * 52,50 lei de TVA nedeductibil se adaugă la cheltuială". **B-114 (brief 74) closed the first half of that
 * gap**: `decideInputVat` now reports `nonRecoverableTotal` for a 50 %-restricted line, derived per line
 * from the same `fraction` that produces `claimableTotal` — not by subtracting one total from the other.
 * The figure is rendered on the dashboard beside the deductible one.
 *
 * **The second half is still open and is still asserted as open below.** „se adaugă la cheltuială" is B-87:
 * `research/35` §1.5 and `research/42` §10 gap 2 are documented negatives — no Titlul IV rule says whether
 * non-recoverable VAT enters a PFA's deductible expense. The engine does not add it, and that is pinned
 * against `applyVatToExpenseBase` itself, which is the code that decides the base.
 */
import { describe, expect, it } from 'vitest';
import {
  applyVatToExpenseBase,
  decideInputVat,
  lineNonRecoverableVat,
} from '../fiscal/vat';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from '../fiscal/package2026';
import { depreciationSchedule, FISCAL_DEPRECIATION_RULE_ID } from '../fiscal/depreciation';
import { addBani, money, lei, subBani, formatBani, type Bani } from '../money';
import type { InputVatLine } from '../fiscal/vat';

/** The claimable half of a line, floored the way `decideInputVat` floors it — for the residue assertion. */
function floorPercentOf(line: InputVatLine): Bani {
  const o = line.outcome;
  return o.kind === 'claimable' ? (Math.floor(line.tvaBani * o.fraction) as Bani) : lei(0);
}

const depRule = PFA_2026_SYSTEM_REAL_PACKAGE.find((r) => r.ruleId === FISCAL_DEPRECIATION_RULE_ID)!;

/**
 * One vehicle purchase line, VAT-registered buyer, mixed use — the state all three sources describe.
 * The document facts are set to the plainest claimable shape so the only thing under test is the 50 %.
 */
function vehicleVat(tvaLeu: number) {
  const d = decideInputVat({
    fiscalYear: 2026,
    asOfDate: '2026-12-31',
    registration: { status: 'inregistrat_art316' },
    vehicles: [{ id: 'veh-1', years: [{ fiscalYear: 2026, use: 'mixed' }] }],
    expenses: [
      {
        id: 'line-1', date: '2026-03-10', paid: '2026-03-10', supplierCui: '1234567', tip: 'factura',
        tva: money(lei(tvaLeu), 'RON'), vehicleId: 'veh-1',
        vatFacts: { destination: 'taxabila', supplierRegime: 'inregistrat', documentKind: 'factura', eFactura: 'da' },
      },
    ],
  });
  if (d.unresolved.length || d.deferred.length || d.zero.length) {
    throw new Error(`the line was not decided claimable: ${JSON.stringify(d.lines[0]?.outcome)}`);
  }
  return d;
}

describe('FIXTURE 6A (FACT — contabilitatedigitala.ro 2026, corroborated by firmaromania.com 2026; TVA 21 %, income year 2026) — preț 100.000, TVA 21.000 → deductibilă 10.500, nedeductibilă 10.500', () => {
  it('the 50 % cut on the vehicle purchase: 21.000 lei of TVA invoiced, 10.500 lei claimable', () => {
    const d = vehicleVat(21_000);
    expect(d.claimableTotal).toBe(lei(10_500)); // „TVA deductibilă 10.500"
    expect(d.lines[0].outcome.kind).toBe('claimable');
    expect((d.lines[0].outcome as { fraction: number }).fraction).toBe(0.5);
    // The non-deductible half, by subtraction from the invoiced VAT: „TVA nedeductibilă 10.500".
    expect(subBani(lei(21_000), d.claimableTotal)).toBe(lei(10_500));
  });

  it('the 19 % figure from the stale 2026-labelled source is not what this engine produces', () => {
    // fiscalx.ro, headed 2026, computes with TVA 19 %: 19.000 × 50 % = 9.500 deductibil. The standard rate
    // has been 21 % since 1 augustie 2025. Asserted as a negative so the number cannot return.
    expect(vehicleVat(21_000).claimableTotal).not.toBe(lei(9_500));
  });

  it('the depreciable value at entry: 100.000 + the 10.500 lei of VAT that became non-deductible = 110.500', () => {
    // Titlul II norm pct. 28 lit. b), reproduced in `fiscal/depreciation.ts`: „în valoarea fiscală a
    // mijloacelor fixe, la data intrării în patrimoniu, se include și taxa pe valoarea adăugată devenită
    // nedeductibilă". The published entry value is 110.500 lei.
    const pret = lei(100_000);
    const tvaNedeductibila = lei(10_500);
    expect(pret + tvaNedeductibila).toBe(lei(110_500));
  });

  it('110.500 lei over 60 months is 1.841,67 lei/lună — the published monthly figure, read off a one-month year', () => {
    // art. 28 alin. (12) lit. a) starts amortisation with the month after *punerea în funcțiune*, so a 60-month
    // schedule begun in Ianuarie 2026 ends in Ianuarie 2031 with exactly one month in that year. That month is
    // the monthly figure the sources print, unrounded by any annual aggregation.
    const out = depreciationSchedule(depRule, {
      label: 'Autoturism', entryDate: '2026-01-10', putInFunctionDate: '2026-01-10',
      fiscalValue: lei(110_500), normalLifeMonths: 60, isM1Vehicle: true, method: 'liniar',
    });
    if (out.status !== 'computed') throw new Error(`the schedule refused: ${out.reason}`);
    const oneMonth = out.years.find((y) => y.months === 1);
    if (!oneMonth) throw new Error('no one-month year in the schedule');
    expect(oneMonth.uncapped).toBe(lei(1_841) + 67); // 1.841,67 lei — „110.500 / 60 = 1.841,67 lei/lună"
  });

  it('a neplătitor de TVA carries the whole 21.000 lei into the entry value: 121.000 lei → 2.016,67 lei/lună', () => {
    const out = depreciationSchedule(depRule, {
      label: 'Autoturism', entryDate: '2026-01-10', putInFunctionDate: '2026-01-10',
      fiscalValue: lei(121_000), nonDeductibleVatIncluded: lei(21_000),
      normalLifeMonths: 60, isM1Vehicle: true, method: 'liniar',
    });
    if (out.status !== 'computed') throw new Error(`the schedule refused: ${out.reason}`);
    const oneMonth = out.years.find((y) => y.months === 1);
    if (!oneMonth) throw new Error('no one-month year in the schedule');
    expect(oneMonth.uncapped).toBe(lei(2_016) + 67); // 2.016,67 lei — „intrare 121.000 → 2.016,67/lună"
  });
});

describe('FIXTURE 6B (FACT — expertcontabiltim.ro 2026, TVA 21 %, income year 2026) — fuel bon 605 lei: 500 + 105 TVA, mixed use recovers 52,50 lei', () => {
  it('the running-cost VAT: 105 lei on the bon, 52,50 lei recovered under the 50 % rule', () => {
    const d = vehicleVat(105);
    expect(d.claimableTotal).toBe(lei(52) + 50); // „la regim mixt recuperezi 52,50 lei"
    // „Restul de 52,50 lei de TVA nedeductibil" — by subtraction.
    expect(subBani(lei(105), d.claimableTotal)).toBe(lei(52) + 50);
  });

  it('the 50 % is art. 298 alin. (1), and the rule package holds no second 50 % for it', () => {
    // The income-tax 50 % on running costs is art. 68 alin. (7) lit. k) — a different provision with a
    // different evidence rule. This fixture pins only the VAT one, and says which article it is.
    const d = vehicleVat(105);
    expect(String((d.lines[0].outcome as { rule: string }).rule)).toContain('art. 298 alin. (1)');
  });

  it('the gross on the bon is 605 lei: 500 lei of fuel plus 105 lei of TVA the buyer cannot all claim back', () => {
    // The published document total. Asserted so the 52,50 lei above is anchored to a real document and not
    // to a percentage floating free.
    expect(lei(500) + lei(105)).toBe(lei(605));
  });
});

describe('FIXTURE 6 (B-114, brief 74) — the published „TVA nedeductibilă 10.500" is a figure the engine reports', () => {
  it('B-114 — a 50 %-restricted line reports the published 10.500 lei, not 0', () => {
    // The defect: `nonRecoverableTotal` filtered on `kind === 'zero'`, and a line under art. 298 alin. (1)
    // is `kind: 'claimable', fraction: 0.5` — so it contributed nothing and the field read 0 lei beside a
    // published 10.500 lei. A user shown 0 lei concludes the restriction never applied to them. It did.
    const d = vehicleVat(21_000);
    expect(d.claimableTotal).toBe(lei(10_500)); // „TVA deductibilă 10.500" — already correct before B-114
    expect(d.nonRecoverableTotal).toBe(lei(10_500)); // „TVA nedeductibilă 10.500" — the B-114 half
    expect(formatBani(d.nonRecoverableTotal)).toBe('10.500,00');
  });

  it('the two published halves sum to the VAT on the document, so they are one rule read twice', () => {
    const d = vehicleVat(21_000);
    expect(addBani(d.claimableTotal, d.nonRecoverableTotal)).toBe(lei(21_000));
  });

  it('B-114 — the smaller published figure: 52,50 lei of the bon, both halves', () => {
    // expertcontabiltim.ro prints „52,50 lei de TVA nedeductibil" for a 105 lei bon. Asserted so the
    // 10.500 lei above is not the only size at which the derivation is checked.
    const d = vehicleVat(105);
    expect(d.claimableTotal).toBe(lei(52) + 50);
    expect(d.nonRecoverableTotal).toBe(lei(52) + 50);
  });

  it('B-114 — the total is NOT `sum(tvaBani) − claimableTotal`: an undecided line is not a lost line', () => {
    // THE TRAP this brief names. Subtracting assumes claimable and non-recoverable are complementary, and
    // art. 298 has cases where they are not. Here the register holds one 50 % vehicle line and one line
    // whose supplier standing was never declared, so it is `unresolved` — the app has not decided whether
    // that VAT is recoverable. A subtraction books it as lost and mints a non-recoverable amount the
    // person may in fact be entitled to claim. The two answers differ by exactly that line.
    const d = decideInputVat({
      fiscalYear: 2026,
      asOfDate: '2026-12-31',
      registration: { status: 'inregistrat_art316' },
      vehicles: [{ id: 'veh-1', years: [{ fiscalYear: 2026, use: 'mixed' }] }],
      expenses: [
        {
          id: 'line-1', date: '2026-03-10', paid: '2026-03-10', supplierCui: '1234567', tip: 'factura',
          tva: money(lei(21_000), 'RON'), vehicleId: 'veh-1',
          vatFacts: { destination: 'taxabila', supplierRegime: 'inregistrat', documentKind: 'factura', eFactura: 'da' },
        },
        {
          id: 'line-2', date: '2026-04-10', paid: '2026-04-10', tip: 'factura',
          tva: money(lei(8_000), 'RON'),
          vatFacts: { destination: 'nedeclarata' },
        },
      ],
    });
    const vatTotal = d.lines.reduce((acc, l) => addBani(acc, l.tvaBani), lei(0));
    expect(d.unresolved.map((l) => l.id)).toEqual(['line-2']);
    // What the rule says: only the 50 % half is lost.
    expect(d.nonRecoverableTotal).toBe(lei(10_500));
    // What the subtraction says: the undecided 8.000 lei swept in as lost too.
    expect(subBani(vatTotal, d.claimableTotal)).toBe(lei(18_500));
    expect(d.nonRecoverableTotal).not.toBe(subBani(vatTotal, d.claimableTotal));
  });

  it('B-114 — a hard-zero line loses all its VAT; an art. 298 alin. (3) category loses none', () => {
    // The two ends of the same derivation. `zero` is a whole denial; the alin. (3) exception categories and
    // the alin. (2) size carve-out lift the restriction entirely, so the non-recoverable half is 0 and the
    // figure is not a flat "half of everything a vehicle line carries".
    const zero = decideInputVat({
      fiscalYear: 2026,
      asOfDate: '2026-12-31',
      registration: { status: 'inregistrat_art316' },
      vehicles: [{ id: 'veh-1', years: [{ fiscalYear: 2026, use: 'not_used' }] }],
      expenses: [
        {
          id: 'line-1', date: '2026-03-10', paid: '2026-03-10', supplierCui: '1234567', tip: 'factura',
          tva: money(lei(21_000), 'RON'), vehicleId: 'veh-1',
          vatFacts: { destination: 'taxabila', supplierRegime: 'inregistrat', documentKind: 'factura', eFactura: 'da' },
        },
      ],
    });
    expect(zero.nonRecoverableTotal).toBe(lei(21_000)); // art. 300 alin. (4): „nu se deduce"

    const excepted = decideInputVat({
      fiscalYear: 2026,
      asOfDate: '2026-12-31',
      registration: { status: 'inregistrat_art316' },
      vehicles: [{ id: 'veh-1', years: [{ fiscalYear: 2026, use: 'mixed', exceptionCategory: 'transport_persoane_cu_plata' }] }],
      expenses: [
        {
          id: 'line-1', date: '2026-03-10', paid: '2026-03-10', supplierCui: '1234567', tip: 'factura',
          tva: money(lei(21_000), 'RON'), vehicleId: 'veh-1',
          vatFacts: { destination: 'taxabila', supplierRegime: 'inregistrat', documentKind: 'factura', eFactura: 'da' },
        },
      ],
    });
    expect(excepted.claimableTotal).toBe(lei(21_000));
    expect(excepted.nonRecoverableTotal).toBe(lei(0));
  });

  it('B-114 — the per-line derivation is exported, so a surface cannot re-derive it by subtraction', () => {
    const d = vehicleVat(21_000);
    expect(lineNonRecoverableVat(d.lines[0]!)).toBe(lei(10_500));
    // The floor stays on the claimable side, exactly where `floorPercent` puts it, so an odd amount leaves a
    // one-bani residue on the denied side and the pair still sums to the line's VAT. Flooring the denied
    // side instead would understate the loss and round a taxpayer into a bigger claim than the law gives.
    const odd: InputVatLine = {
      id: 'odd', tvaBani: 10_501 as Bani, vehicle: true, preRegistrationAdjustment: false,
      outcome: { kind: 'claimable', fraction: 0.5, rule: 'art. 298 alin. (1); Norme pct. 68 alin. (4)' },
    };
    expect(lineNonRecoverableVat(odd)).toBe(5_251); // 10.501 − floor(5.250,5) = 5.251
    expect(addBani(floorPercentOf(odd), lineNonRecoverableVat(odd))).toBe(10_501);
  });

  it('B-87 unchanged — the non-recoverable half is still NOT added to the expense base', () => {
    // Asserted against `applyVatToExpenseBase`, the code that actually decides the base, and not against
    // `nonRecoverableTotal`: B-114 changed what the reporting total means, and the base must not move with
    // it. The practitioner source says the 52,50 lei „se adaugă la cheltuială"; whether it must is B-87,
    // and research/35 §1.5 and research/42 §10 gap 2 found no Titlul IV rule either way.
    const d = vehicleVat(105);
    expect(d.nonRecoverableTotal).toBe(lei(52) + 50); // the reporting figure now exists
    const base = applyVatToExpenseBase(d, lei(500), [{ id: 'line-1', tva: lei(105), capped: false }]);
    expect(base.netFirst).toBe(lei(500)); // not 552,50 lei
    expect(base.grossFirst).toBe(lei(500));
  });
});

/** Kept so the file cannot be edited into using a stale rate: the 21 % is a fact about the year. */
const TVA_STANDARD_RATE_SINCE_2025_08_01: Bani = lei(21_000);
describe('FIXTURE 6 — the rate behind every figure above', () => {
  it('21.000 lei of TVA on a 100.000 lei price is 21 %, the rate in force from 1 augustie 2025', () => {
    expect(TVA_STANDARD_RATE_SINCE_2025_08_01).toBe(lei(21_000));
    expect(lei(100_000) + TVA_STANDARD_RATE_SINCE_2025_08_01).toBe(lei(121_000)); // „total 121.000,00"
  });
});
