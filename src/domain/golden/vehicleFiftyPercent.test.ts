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
 * ── What the engine does not produce ──────────────────────────────────────────────────────────────────
 *
 * The sources state the non-deductible half as a figure of its own — „TVA nedeductibilă 10.500", „Restul de
 * 52,50 lei de TVA nedeductibil se adaugă la cheltuială". The engine reports the **claimable** half
 * (`decideInputVat` → `claimableTotal`) and does **not** report a total for the non-recoverable half of a
 * 50 %-restricted line: `nonRecoverableTotal` counts only lines decided at a hard zero. The half is
 * recoverable by subtraction from the invoiced VAT, and that subtraction is asserted below — but the
 * "adds to the expense" step is a separate finding, recorded in the phase doc.
 */
import { describe, expect, it } from 'vitest';
import { decideInputVat } from '../fiscal/vat';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from '../fiscal/package2026';
import { depreciationSchedule, FISCAL_DEPRECIATION_RULE_ID } from '../fiscal/depreciation';
import { money, lei, subBani, formatBani, type Bani } from '../money';

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

describe('FIXTURE 6 — what the engine does NOT report, stated rather than glossed', () => {
  it('nonRecoverableTotal counts hard-zero lines only, so the 50 % half has no reported total', () => {
    // The sources print „TVA nedeductibilă 10.500" as a figure. The engine's `nonRecoverableTotal` is 0 for a
    // 50 %-restricted line, because that field counts lines decided at a full zero (art. 300 alin. (4) and
    // friends). The amount is recoverable by subtraction, and the subtraction is pinned above — but a surface
    // that reads `nonRecoverableTotal` will show 0 lei beside a published 10.500 lei. Recorded as a finding.
    const d = vehicleVat(21_000);
    expect(d.nonRecoverableTotal).toBe(lei(0));
    expect(d.nonRecoverableTotal).not.toBe(lei(10_500));
    expect(formatBani(subBani(lei(21_000), d.claimableTotal))).toBe('10.500,00');
  });

  it('the non-recoverable half of a 50 % line is not added to the expense base either', () => {
    // `applyVatToExpenseBase` adds the VAT of lines decided at a hard zero, and nothing for a 50 % line. The
    // practitioner source says the 52,50 lei „se adaugă la cheltuială". The engine does not do that. Whether
    // it must is not settled for a PFA — `research/35` §1.5 and `research/42` §10 gap 2 found no Titlul IV
    // ordering rule, which is why `expenseBase.divergent` refuses rather than choosing. Pinned as the current
    // behaviour, with the dissent named.
    const d = vehicleVat(105);
    const base = lei(500);
    expect(d.nonRecoverableTotal).toBe(lei(0));
    // The expense measure the assembler would carry for this bon, under the engine's rule:
    expect(base + d.nonRecoverableTotal).toBe(lei(500)); // not 552,50 lei
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
