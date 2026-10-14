/**
 * PHASE 31 FIXTURE 3 — the FX rounding convention. Pinned on its own, and not absorbed into a total.
 *
 * **SOURCE** — ANAF București Sector 4, „Declarația unică … cedarea folosinței bunurilor", item 18,
 * `static.anaf.ro/static/10/Bucuresti/Dec_Unica_PF_Cedare_Fol.pdf`.
 * **FISCAL YEAR OF THE SOURCE — 2024. SMN THE SOURCE USED — 3.300 lei.**
 * **GRADE — FACT** (official), **but only for the conversion convention.** The thresholds in this example
 * are FY2024 ones and are **invalid as FY2026 assertions** — the 6-SMN floor it quotes is 6 × 3.300 = 19.800
 * lei, not the FY2026 24.300 lei. Nothing in this file asserts a FY2026 threshold from this source.
 *
 * Recorded in `docs/ai/research/47_published_worked_examples_fy2026.md` §3B.
 *
 * ── Why this fixture exists separately ────────────────────────────────────────────────────────────────
 *
 * ANAF writes „500 euro x 4977 lei = **2488 lei lunar**". The product is 2.488,5 lei. ANAF **truncates to a
 * whole leu** — it does not round to 2.489. Every downstream figure in that example is built from the
 * truncated monthly amount: 2.488 × 6 = 14.928, not 14.931.
 *
 * The app's converter (`domain/fx/convert.ts`, `product()`) rounds the product **to the nearest ban** and
 * deliberately does not apply CF art. 66 alin. (1)'s whole-leu rounding to it — `ROUNDING_CHOICE` in that
 * file records the decision and says art. 66 governs sums of tax that are due, and that whether it also
 * governs a converted amount is not established. So the engine keeps 2.488,50 lei where ANAF writes 2.488.
 *
 * **That is a divergence, and it is written down here as a divergence rather than smoothed over.** Left
 * unpinned, a half-leu difference in a monthly gross reads downstream as a rule error and costs a day to
 * diagnose. Pinned, it says plainly: the money is the same rule applied under two different rounding
 * conventions, and here is exactly where they part.
 */
import { describe, expect, it } from 'vitest';
import { convertToRon } from '../fx/convert';
import { fixtureRateProvider } from '../fx/provider';
import type { FxRateRecord } from '../fx/rates';
import { calculatorRegistry } from '../fiscal/calculators';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from '../fiscal/package2026';
import { money, majorToMinor, lei, formatBani, type Bani } from '../money';

const art84Rule = PFA_2026_SYSTEM_REAL_PACKAGE.find((r) => r.ruleId === 'CEDARE_ART84_2026')!;

/** The two BNR numbers ANAF uses for one contract: the rate on 1 iulie 2024, and the 2024 annual average. */
const RATE_1_IULIE_2024: FxRateRecord = {
  currency: 'EUR', rate: '4.9770', rateKind: 'daily_reference', rateDate: '2024-07-01',
  seriesCode: 'CURSZ_EUR', sourceUrl: 'https://www.bnr.ro', fetchedAt: '2025-01-15T00:00:00Z',
  provisional: false, entryMode: 'fetched',
};
const ANNUAL_AVERAGE_2024: FxRateRecord = {
  currency: 'EUR', rate: '4.9740', rateKind: 'annual_average', rateYear: 2024,
  seriesCode: 'CURSA_EURM', sourceUrl: 'https://www.bnr.ro', fetchedAt: '2025-01-15T00:00:00Z',
  provisional: false, entryMode: 'manual',
};

function monthlyRent() {
  return money(majorToMinor(500, 'EUR'), 'EUR');
}

function convertDaily(rate: FxRateRecord, onDate: string): Bani {
  const res = convertToRon(monthlyRent(), { basis: 'payment_date_daily', onDate }, fixtureRateProvider([rate]));
  if (!res.ok) throw new Error(`the conversion refused: ${JSON.stringify(res)}`);
  return res.ron.amount;
}

function convertAnnualAverage(rate: FxRateRecord, year: number): Bani {
  const res = convertToRon(monthlyRent(), { basis: 'income_realisation_year_annual_average', incomeRealisationYear: year }, fixtureRateProvider([rate]));
  if (!res.ok) throw new Error(`the conversion refused: ${JSON.stringify(res)}`);
  return res.ron.amount;
}

function determine(gross: Bani) {
  const res = calculatorRegistry['calc-cedare-art84-flat-ratio'](art84Rule, { gross });
  if ('reviewRequired' in res) throw new Error(res.reason);
  if (typeof res.determinedNet !== 'number') throw new Error('the rule reported no determined net');
  return { net: res.determinedNet, tax: res.value, forfetar: gross - res.determinedNet };
}

describe('FIXTURE 3 (FACT for the convention — ANAF București Sector 4, income year 2024, SMN 3.300 lei) — 500 EUR × 4,977 = 2.488 lei, truncated, not 2.489', () => {
  it.fails('FINDING — ANAF writes 2.488 lei; the engine produces 2.488,50 lei. The published value is asserted and fails.', () => {
    // ANAF, verbatim: „500 euro x 4977 lei = 2488 lei lunar".
    // The product is 2.488,5 lei. ANAF truncates. The engine keeps the half-leu.
    // `it.fails` keeps ANAF's number as the assertion: if the converter ever truncates, this test starts
    // failing for the opposite reason and whoever changes it has to read this comment.
    expect(convertDaily(RATE_1_IULIE_2024, '2024-07-01')).toBe(lei(2_488));
  });

  it('the engine value the finding above disagrees with, pinned so the half-leu cannot drift', () => {
    // 500 EUR × 4,9770 = 2.488,50 lei = 248.850 bani. This is the ENGINE's figure, not a published one.
    expect(convertDaily(RATE_1_IULIE_2024, '2024-07-01')).toBe(lei(2_488) + 50);
    // The divergence is exactly half a leu per month — and it is a rounding convention, not a rate and not
    // a rule about when income is income.
    expect(convertDaily(RATE_1_IULIE_2024, '2024-07-01') - lei(2_488)).toBe(lei(0) + 50);
  });

  it('where the product is already a whole leu, the two conventions agree: 500 EUR × 4,974 = 2.487 lei', () => {
    // ANAF's own definitive figure, at the BNR 2024 annual average: „2.487". The engine reproduces it
    // exactly, because 500 × 4,974 = 2.487,00 has nothing to round. This is the control case that proves
    // the divergence above is about the half-leu and not about the rate or the basis.
    expect(convertAnnualAverage(ANNUAL_AVERAGE_2024, 2024)).toBe(lei(2_487));
  });

  it('the six-month gross follows: ANAF 14.928 lei from the truncated month, engine 14.931 lei from the exact one', () => {
    // ANAF: „2.488 × 6 = 14.928". The engine's month is 2.488,50, so six of them are 14.931 lei.
    // The published gross is asserted as a literal so the size of the gap is on the record: 3 lei over half
    // a contract year.
    const anafGross = lei(2_488) * 6;
    const engineGross = convertDaily(RATE_1_IULIE_2024, '2024-07-01') * 6;
    expect(anafGross).toBe(lei(14_928));
    expect(engineGross).toBe(lei(14_931));
  });

  it.fails("FINDING — on ANAF's gross 14.928 lei, ANAF prints forfetar 2.986 lei; the engine keeps 2.985,60", () => {
    // ANAF, on gross 14.928: forfetar 2.986, net 11.942, impozit 1.194 lei. ANAF rounds each step to a whole
    // leu; the engine carries the fraction through to the sum that is actually due, which is what art. 66
    // alin. (1) governs. The forfetar and the net therefore disagree. The tax does not — see below.
    expect(determine(lei(14_928)).forfetar).toBe(lei(2_986)); // ANAF's figure.
  });

  it.fails("FINDING — on ANAF's gross 14.928 lei, ANAF prints net 11.942 lei; the engine keeps 11.942,40", () => {
    expect(determine(lei(14_928)).net).toBe(lei(11_942)); // ANAF's figure.
  });

  it("the one figure in that chain where both conventions land together: impozit 1.194 lei", () => {
    // ANAF: „impozit 1.194 lei". The engine, on the same gross, also says 1.194 lei. Pinned as a passing
    // assertion so the two findings above are not mistaken for a wholesale disagreement.
    expect(determine(lei(14_928)).tax).toBe(lei(1_194));
  });

  it('the same chain as the engine actually computes it, pinned beside the published one', () => {
    const { forfetar, net, tax } = determine(lei(14_928));
    expect(forfetar).toBe(lei(2_985) + 60); // 2.985,60 lei — the engine's, not ANAF's
    expect(net).toBe(lei(11_942) + 40); // 11.942,40 lei — the engine's, not ANAF's
    expect(tax).toBe(lei(1_194)); // the one figure where the two conventions land together
  });

  it('the FY2024 threshold in this example is NOT a FY2026 threshold, and nothing here may be read as one', () => {
    // ANAF: „nu datorează CASS, întrucât venitul net anual este sub plafonul minim de 6 salarii minime …
    // Salariul minim brut pe țară pentru anul 2024 a fost în sumă de 3300 lei/lună." That floor is
    // 6 × 3.300 = 19.800 lei. The FY2026 floor the rule package holds is 6 × 4.050 = 24.300 lei.
    // The published FY2024 floor is recorded as a literal so a later reader cannot quietly reuse it.
    const anafFy2024Floor = lei(19_800);
    expect(anafFy2024Floor).not.toBe(lei(24_300));
    const fy2026Floor = art84Rule.parameters.find((p) => p.id === 'min_base');
    // art. 84 carries no CASS parameter of its own — the rungs live on CASS_2026 — and that is deliberate:
    // one legal figure, one source. Asserted so this file cannot be read as holding a second floor.
    expect(fy2026Floor).toBeUndefined();
  });

  it('the divergence is stated in money, so a future fix can be measured', () => {
    const anaf = lei(2_488);
    const engine = convertDaily(RATE_1_IULIE_2024, '2024-07-01');
    // Half a leu a month, 3 lei over the six months ANAF computes, and 0 lei where the product is already
    // whole. `formatBani` so the numbers are readable in a failure message.
    expect(`${formatBani(anaf)} / ${formatBani(engine)}`).toBe('2.488,00 / 2.488,50');
  });
});
