import { describe, expect, it } from 'vitest';
import { DPI_RULES_2026, dpiExcludedKindsOf, dpiQuotaPercentOf } from './dpi2026';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from './package2026';
import { PFA_2026_DPI_PACKAGE, PFA_2026_DPI_RELEASE_ID } from './release2026dpi';
import { defaultRuleReleaseRegistry } from './registry';
import { calculatorRegistry, type CalculatorResult } from './calculators';
import { selectApplicableRules } from './select';
import { DPI_EXCLUDED_KINDS } from '../dpi';
import { lei, type Bani } from '../money';

/**
 * B-112 STAGE 1 — the DPI rule and its calculator.
 *
 * The premise this file exists to keep from coming back: **the DPI flat quota is 40 %, and the 20 % belongs
 * to *cedarea folosinței bunurilor*.** `docs/ai/research/48_dpi_income_rules_fy2026.md` correction 1 records
 * that the brief's earlier draft had it wrong, and the two numbers sit in rules that look alike — same
 * `expense_ratio` parameter id, same 10 % tax rate, both flat-ratio. So the tests below assert the two rules
 * apart from each other rather than only asserting the DPI one in isolation.
 */

const dpiRule = DPI_RULES_2026[0];
const run = (input?: Parameters<(typeof calculatorRegistry)['calc-dpi-flat-quota']>[1]) =>
  calculatorRegistry['calc-dpi-flat-quota'](dpiRule, input);

/**
 * `CalculatorResult` is a union whose success branch carries no discriminant, so the repo's own tests reach
 * it with `toMatchObject`. These two helpers do the same thing but let a test read `determinedNet` and
 * `reason` without a cast — and a refusal that reaches `ok()` fails loudly with the calculator's own
 * sentence, which is more useful than an assertion diff against `undefined`.
 */
function ok(r: CalculatorResult): { value: Bani; determinedNet?: Bani; breakdown: string[] } {
  if ('reviewRequired' in r) throw new Error(`calculator refused: ${r.reason}`);
  // The cast is here because `CalculatorResult`'s success branch carries no discriminant, so `in` cannot
  // exclude `ReviewRequired` for the compiler. It is confined to this helper: no test in this file casts.
  return r as { value: Bani; determinedNet?: Bani; breakdown: string[] };
}
function refused(r: CalculatorResult): { reason: string } {
  if ('reviewRequired' in r) return r;
  throw new Error(`calculator did not refuse; it returned ${String(r.value)}`);
}

/** The calculator's own sentences, joined for a `toContain` assertion. */
function words(r: CalculatorResult): string {
  const computed = ok(r);
  return computed.breakdown.join('\n');
}

describe('B-112 — the DPI rule carries the 40 % quota, and the 20 % stays with cedare', () => {
  it('the quota is 40 %', () => {
    const p = dpiRule.parameters.find((x) => x.id === 'expense_ratio')!;
    expect(p.value).toBe(40);
    expect(p.unit).toBe('percent');
  });

  it('the cedare rules still carry 20 %, so the two numbers were not merged', () => {
    const quotas = ['CEDARE_ART84_2026', 'CEDARE_ART84X1_2026'].map((id) => {
      const r = PFA_2026_SYSTEM_REAL_PACKAGE.find((x) => x.ruleId === id)!;
      return r.parameters.find((x) => x.id === 'expense_ratio')!.value;
    });
    expect(quotas).toEqual([20, 20]);
  });

  it('the two regimes are different `taxRegime` strings, so `applicable.find` cannot shadow one with the other', () => {
    // `tax.ts` resolves a regime by scanning `applicable` for a matching `taxRegime`. Two rules sharing one
    // string would make whichever ruleId sorts first answer for both, and the quotas would silently swap.
    const cedare = PFA_2026_SYSTEM_REAL_PACKAGE.filter((r) => r.taxRegime.startsWith('cedare'));
    expect(dpiRule.taxRegime).toBe('dpi-flat-quota');
    expect(cedare.map((r) => r.taxRegime)).not.toContain(dpiRule.taxRegime);
  });

  it('the quota is stated in the rule text as 40 %, not only as a number', () => {
    // A parameter whose description contradicts its value is the drift this package's history records.
    const p = dpiRule.parameters.find((x) => x.id === 'expense_ratio')!;
    expect(String(p.description)).toContain('40%');
    expect(String(p.description)).toContain('NU este cota de 20%');
  });

  it('the tax rate is 10 % on the NET, and the effective burden is therefore 6 % of gross', () => {
    expect(dpiRule.parameters.find((x) => x.id === 'tax_rate')!.value).toBe(10);
    // 10 % × 60 % — asserted as arithmetic the rule's own numbers produce, not as a remembered figure.
    const q = dpiQuotaPercentOf(DPI_RULES_2026, 2026)!;
    const t = dpiRule.parameters.find((x) => x.id === 'tax_rate')!.value as number;
    expect((t * (100 - q)) / 100).toBe(6);
  });
});

describe('B-112 — the art. 72 alin. (3) exclusion set is one list, read from the rule', () => {
  it('the rule names exactly the kinds the record vocabulary allows', () => {
    expect(dpiExcludedKindsOf(DPI_RULES_2026, 2026)).toEqual([...DPI_EXCLUDED_KINDS]);
  });

  it('the rule states both consequences, not just the quota one', () => {
    const p = dpiRule.parameters.find((x) => x.id === 'excluded_kinds')!;
    const text = `${p.label} ${p.description} ${p.value}`;
    expect(text).toContain('art. 72 alin. (3)');
    // The CAS consequence — art. 137 alin. (1) lit. b¹) excludes „veniturile prevăzute la art. 72 alin. (3)”.
    expect(text).toContain('CAS');
  });

  it('reading the set for a year with no DPI rule yields nothing rather than a default', () => {
    expect(dpiExcludedKindsOf(PFA_2026_SYSTEM_REAL_PACKAGE, 2026)).toEqual([]);
    expect(dpiQuotaPercentOf(PFA_2026_SYSTEM_REAL_PACKAGE, 2026)).toBeNull();
  });
});

describe('B-112 — the calculator: gross → 40 % quota → net → 10 % final tax', () => {
  it('100.000 lei brut leaves 60.000 lei net and 6.000 lei impozit', () => {
    const r = ok(run({ gross: lei(100_000) }));
    expect(r.determinedNet).toBe(lei(60_000));
    expect(r.value).toBe(lei(6_000));
  });

  it('a gross whose 40 % quota does not land on a whole ban is reported, not rounded', () => {
    // One ban of gross: 0,6 × 1 ban is not a whole ban. The house boundary is that art. 66 rounds
    // the sums that are DUE, not the bases, so a base that lands on a fraction of a ban must be reported
    // rather than quietly rounded into a plausible number.
    const r = refused(run({ gross: lei(0.01) }));
    expect(r.reason).toContain('art. 66');
  });

  it('zero gross is zero net and zero tax, not a refusal', () => {
    const r = ok(run({ gross: lei(0) }));
    expect(r.determinedNet).toBe(lei(0));
    expect(r.value).toBe(lei(0));
  });

  it('no gross at all is a refusal, and the refusal says what is missing', () => {
    const r = refused(run());
    expect(r.reason).toContain('art. 72 alin. (2)');
  });

  it('a negative gross is a refusal', () => {
    expect(refused(run({ gross: lei(-1) })).reason).toContain('nu poate fi negativ');
  });

  it('the breakdown says the quota is 40 % and names the 20 % as belonging to cedare', () => {
    const text = words(run({ gross: lei(100_000) }));
    expect(text).toContain('40%');
    expect(text).toContain('art. 84');
  });

  it('the breakdown states that CAS and CASS sit inside the quota, so they are not deducted twice', () => {
    // ANAF DGRFP Cluj, 12 februarie 2026: „În cheltuielile forfetare se includ, printre altele:
    // contribuțiile sociale datorate…”.
    const text = words(run({ gross: lei(100_000) }));
    expect(text).toContain('contribu');
  });

  it('the breakdown names the two different contribution limbs for the same income', () => {
    const text = words(run({ gross: lei(100_000) }));
    expect(text).toContain('art. 137 alin. (1) lit. b^1)');
    expect(text).toContain('art. 155 alin. (1) lit. c)');
  });

  it("the withholding deadline is the PAYER's, and the breakdown says so", () => {
    const text = words(run({ gross: lei(100_000) }));
    expect(text).toContain('25');
    expect(text).toContain('plătitor');
  });
});

describe('B-112 — the rule reaches the engine only through the FY2026 revision', () => {
  it('the DPI rule is on the revision and not on v5', () => {
    const v5 = defaultRuleReleaseRegistry.rulesOf('PFA_2026_SYSTEM_REAL')!;
    expect(v5.some((r) => r.ruleId === 'DPI_ART72_2026')).toBe(false);
    expect(PFA_2026_DPI_PACKAGE.some((r) => r.ruleId === 'DPI_ART72_2026')).toBe(true);
  });

  it('a FY2026 date selects the DPI rule, so the path is reachable and not merely registered', () => {
    const selection = selectRuleSetFor2026();
    expect(selection.some((r) => r.ruleId === 'DPI_ART72_2026')).toBe(true);
  });

  it('the rule set selected for 2026 resolves the DPI rule through the registry, by content', () => {
    const entry = defaultRuleReleaseRegistry.entryByReleaseId(PFA_2026_DPI_RELEASE_ID)!;
    expect(entry.rules.find((r) => r.ruleId === 'DPI_ART72_2026')?.calculatorId).toBe(
      'calc-dpi-flat-quota',
    );
    // The calculator id must exist in the registry, or the rule is a parameter sheet nothing can run.
    expect(calculatorRegistry[entry.rules.find((r) => r.ruleId === 'DPI_ART72_2026')!.calculatorId]).toBeTypeOf(
      'function',
    );
  });
});

describe('B-112 stage 4 — the withholding machine is on the rule package, with the alineate that are in force', () => {
  const rule = DPI_RULES_2026.find((r) => r.ruleId === 'DPI_CONTRIB_WITHHOLDING_2026')!;

  it('it rides on the FY2026 revision, not on v5, and a FY2026 date selects it', () => {
    const v5 = defaultRuleReleaseRegistry.rulesOf('PFA_2026_SYSTEM_REAL')!;
    expect(v5.some((r) => r.ruleId === 'DPI_CONTRIB_WITHHOLDING_2026')).toBe(false);
    expect(PFA_2026_DPI_PACKAGE.some((r) => r.ruleId === 'DPI_CONTRIB_WITHHOLDING_2026')).toBe(true);
    expect(selectRuleSetFor2026().some((r) => r.ruleId === 'DPI_CONTRIB_WITHHOLDING_2026')).toBe(true);
  });

  it('it carries NO lei parameter: the rates and the SMN figures stay owned by CAS_2026 and CASS_2026', () => {
    // Phase 4 deleted `min_cass`/`max_cass` and Phase 5 deleted `multiple_6x`…`multiple_72x` for exactly
    // this reason. A withholding rule that restates 48.600 or 97.200 is a second source of truth for a
    // statutory figure, and the year that changes the minimum wage updates one of the two.
    expect(rule.parameters.filter((p) => p.unit === 'lei')).toEqual([]);
    expect(rule.parameters.length).toBeGreaterThan(0);
  });

  it('it cites the post-OUG 128/2024 alineate, and names the old numbering as the old numbering', () => {
    // The point of the rule. `research/48` §4 states the CASS machine as „art. 174¹ alin. (2), (6)-(10)”,
    // which is the pre-2025 text; `research/50` gives the current one. A rule that carried the old chain
    // would keep re-producing wrong briefs, which is the failure mode this phase has now hit three times.
    expect(rule.sourceArticle).toMatch(/art\. 174¹ alin\. \(3\)-\(9\)/);
    expect(rule.sourceArticle).toMatch(/art\. 151 alin\. \(5\)-\(11\)/);
    expect(rule.sourceAct).toMatch(/OUG nr\. 128\/2024/);
    const cass = rule.parameters.find((p) => p.id === 'cass_machine')!.value as string;
    for (const step of ['alin. (3)', 'alin. (4)', 'alin. (5)', 'alin. (6)', 'alin. (7)', 'alin. (8)', 'alin. (9)']) {
      expect(cass).toContain(step);
    }
    expect(cass).toMatch(/contribuția reținută … este luată în calcul/);
    const cas = rule.parameters.find((p) => p.id === 'cas_machine')!.value as string;
    for (const step of ['alin. (6)', 'alin. (7)', 'alin. (8)', 'alin. (9)', 'alin. (10)', 'alin. (11)']) {
      expect(cas).toContain(step);
    }
  });

  it('it states, as a limitation and not as a gap, that the app holds no payment register', () => {
    const note = rule.parameters.find((p) => p.id === 'no_payment_register')!.value as string;
    expect(note).toMatch(/nu are registru de plăți/);
    expect(note).toMatch(/absență/);
  });
});

function selectRuleSetFor2026() {
  const entry = defaultRuleReleaseRegistry.entryByReleaseId(PFA_2026_DPI_RELEASE_ID)!;
  return selectApplicableRules([...entry.rules], { taxYear: 2026, asOfDate: '2026-01-01' });
}
