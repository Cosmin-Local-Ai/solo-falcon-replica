import { describe, expect, it } from 'vitest';

import { PFA_2026_SYSTEM_REAL_PACKAGE } from './package2026';
import { DEDUCTIBILITY_RULES_2026 } from './deductibility2026';
import {
  classifyExpenseDeductibility,
  expenseEngineRefusal,
  DEDUCTIBILITY_REGIME,
  type ExpenseCategory,
} from './deductibility';

const RULES = PFA_2026_SYSTEM_REAL_PACKAGE;
const q = (asOfDate = '2026-06-15') => ({ taxYear: 2026, asOfDate });

const byId = (id: string) => {
  const r = DEDUCTIBILITY_RULES_2026.find((x) => x.ruleId === id);
  if (!r) throw new Error(`no such rule ${id}`);
  return r;
};

describe('expense deductibility rule set — provenance', () => {
  it('every deductibility rule carries full provenance', () => {
    expect(DEDUCTIBILITY_RULES_2026.length).toBe(39);
    for (const rule of DEDUCTIBILITY_RULES_2026) {
      expect(rule.taxRegime, `${rule.ruleId} regime`).toBe(DEDUCTIBILITY_REGIME);
      expect(rule.jurisdiction).toBe('RO');
      expect(rule.entityType).toBe('PFA');
      expect(rule.taxYear).toBe(2026);
      expect(rule.status).toBe('ACTIVE');
      expect(rule.version).toBe(1);
      expect(rule.verifiedAt).toBe('2026-10-09');
      expect(rule.sourceAct, `${rule.ruleId} sourceAct`).not.toHaveLength(0);
      expect(rule.sourceArticle, `${rule.ruleId} sourceArticle`).not.toHaveLength(0);
      expect(rule.sourceUrl, `${rule.ruleId} sourceUrl`).not.toHaveLength(0);
      // SOURCE AUTHORITY: no secondary aggregator may back a deductibility rule.
      expect(
        rule.sourceUrl.startsWith('https://legislatie.just.ro/') ||
          rule.sourceUrl.startsWith('https://static.anaf.ro/'),
        `${rule.ruleId} cites a non-primary source: ${rule.sourceUrl}`,
      ).toBe(true);
    }
  });

  it('every rule is activated by the release, and cites art. 68 or the Normele that supply it', () => {
    for (const rule of DEDUCTIBILITY_RULES_2026) {
      // Grounded in the articles research 21 actually verified — nothing else.
      expect(
        rule.sourceArticle.includes('art. 68') || rule.sourceArticle.includes('Normele HG 1/2016'),
        `${rule.ruleId} cites neither art. 68 nor the Normele`,
      ).toBe(true);
    }
  });

  it('no euro cap is ever stored as a lei money parameter', () => {
    for (const rule of DEDUCTIBILITY_RULES_2026) {
      for (const p of rule.parameters) {
        // A 'lei' parameter is integer bani and is read by paramBani; euro amounts must stay in 'eur'
        // so they can never enter a bani calculation.
        expect(p.unit, `${rule.ruleId}.${p.id}`).not.toBe('lei');
      }
    }
    const eur = byId('EXPENSE_PRIVATE_PENSION_2026').parameters.find((p) => p.id === 'cap_eur');
    expect(eur?.value).toBe(400);
    expect(eur?.unit).toBe('eur');
  });
});

describe('expense deductibility — the four treatments', () => {
  it('non_deductible: personal use, art. 68 alin. (7) lit. a)', () => {
    const r = classifyExpenseDeductibility({ category: 'personal_or_family_use' }, RULES, q());
    expect(r.status).toBe('classified');
    if (r.status !== 'classified') return;
    expect(r.treatment).toBe('non_deductible');
    expect(r.rule.ruleId).toBe('EXPENSE_PERSONAL_USE_2026');
    expect(r.rule.sourceArticle).toContain('art. 68 alin. (7) lit. a)');
  });

  it('non_deductible: the income tax itself, art. 68 alin. (7) lit. c)', () => {
    const r = classifyExpenseDeductibility({ category: 'own_income_tax' }, RULES, q());
    expect(r.status === 'classified' && r.treatment).toBe('non_deductible');
    if (r.status !== 'classified') return;
    expect(r.rule.ruleId).toBe('EXPENSE_OWN_INCOME_TAX_2026');
  });

  it('deductible: telecom, by example in the Normele — and with NO percentage cap', () => {
    const r = classifyExpenseDeductibility({ category: 'postal_and_telecom' }, RULES, q());
    expect(r.status === 'classified' && r.treatment).toBe('deductible');
    if (r.status !== 'classified') return;
    expect(r.rule.ruleId).toBe('EXPENSE_POSTAL_TELECOM_2026');
    // There is no PFA cap for telephone/internet: the cap must not be invented.
    expect(r.cap).toBeUndefined();
  });

  it('capped: protocol at 2 % of the art. 68 alin. (6) base', () => {
    const r = classifyExpenseDeductibility({ category: 'protocol' }, RULES, q());
    expect(r.status === 'classified' && r.treatment).toBe('capped');
    if (r.status !== 'classified' || r.treatment !== 'capped') return;
    expect(r.cap?.percent).toBe(2);
    expect(r.cap?.base).toBe('art68_alin6_base');
    expect(r.cap?.baseArticle).toContain('art. 68 alin. (6)');
  });

  it('undetermined: a shared home-office cost, with the missing fact named', () => {
    const r = classifyExpenseDeductibility({ category: 'home_office_shared_cost' }, RULES, q());
    expect(r.status).toBe('undetermined');
    if (r.status !== 'undetermined') return;
    expect(r.rule?.ruleId).toBe('EXPENSE_HOME_OFFICE_SHARED_2026');
    expect(r.missingFact).toContain('art. 68 alin. (5) lit. i)');
    expect(r.missingFact).toContain('NO method');
  });
});

describe('expense deductibility — uncited categories are never silently deductible', () => {
  it('an unknown category is undetermined, with no rule attached', () => {
    const r = classifyExpenseDeductibility(
      { category: 'reclama_publicitate' as ExpenseCategory },
      RULES,
      q(),
    );
    expect(r.status).toBe('undetermined');
    if (r.status !== 'undetermined') return;
    expect(r.rule).toBeNull();
    expect(r.missingFact).toContain('No verified 2026 rule');
  });

  it('an expense carrying no category at all is undetermined', () => {
    const r = classifyExpenseDeductibility({ category: null }, RULES, q());
    expect(r.status).toBe('undetermined');
    if (r.status !== 'undetermined') return;
    expect(r.category).toBeNull();
    expect(r.rule).toBeNull();
  });

  it('no deductibility rule treats the art. 68 alin. (7) lit. l) open clause as a deduction', () => {
    for (const rule of DEDUCTIBILITY_RULES_2026) {
      expect(rule.sourceArticle, `${rule.ruleId} leans on the open clause`).not.toContain('lit. l)');
    }
  });
});

describe('expense deductibility — corporate-only limits must NOT reach a PFA', () => {
  it('no deductibility rule cites art. 21, which is not the deductibility article', () => {
    for (const rule of DEDUCTIBILITY_RULES_2026) {
      expect(rule.sourceArticle, `${rule.ruleId} cites art. 21`).not.toContain('art. 21');
      expect(rule.sourceAct, `${rule.ruleId} cites art. 21`).not.toContain('art. 21');
    }
  });

  it('the protocol cap is the PFA base, not the corporate accounting-profit base', () => {
    const protocol = byId('EXPENSE_PROTOCOL_2026');
    expect(protocol.sourceArticle).toContain('art. 68 alin. (5) lit. b)');
    // art. 25 alin. (3) lit. a) caps corporate protocol on accounting profit — a different base, and
    // art. 68 does not incorporate it.
    expect(protocol.sourceArticle).not.toContain('art. 25 alin. (3) lit. a)');
    const base = protocol.parameters.find((p) => p.id === 'cap_base_article')?.value ?? '';
    expect(String(base)).toContain('venitul brut');
    expect(String(base)).not.toContain('profit');
  });

  it('the vehicle cap comes from art. 68 alin. (7) lit. k), not the corporate art. 25 alin. (3) lit. l)', () => {
    const vehicle = byId('EXPENSE_VEHICLE_MIXED_USE_2026');
    expect(vehicle.sourceArticle).toContain('art. 68 alin. (7) lit. k)');
    expect(vehicle.sourceArticle).not.toContain('lit. l)');
    expect(vehicle.parameters.find((p) => p.id === 'cap_percent')?.value).toBe(50);
  });

  it('social expenses borrow only the destination list from art. 25 alin. (3) lit. b), never the cap', () => {
    const social = byId('EXPENSE_SOCIAL_EXPENSES_2026');
    expect(social.sourceArticle).toContain('art. 68 alin. (5) lit. c)');
    expect(social.parameters.find((p) => p.id === 'cap_percent')?.value).toBe(5);
    expect(social.parameters.find((p) => p.id === 'cap_base')?.value).toBe('annual_salary_expense');
  });
});

describe('expense deductibility — refusal where the law supplies no expense engine (B-29)', () => {
  it('cazare (art. 68^3, from FY2026) is refused rather than computed', () => {
    const r = classifyExpenseDeductibility(
      { category: 'rent_business_space', context: { activityFamily: 'cazare' } },
      RULES,
      q(),
    );
    expect(r.status).toBe('refused');
    if (r.status !== 'refused') return;
    expect(r.rule.ruleId).toBe('EXPENSE_ENGINE_CAZARE_2026');
    expect(r.reason).toContain('30%');
    expect(r.rule.sourceArticle).toContain('art. 68^3');
  });

  it('the refusal wins even for an uncategorised expense, and for a non-cazare activity it does not fire', () => {
    expect(expenseEngineRefusal({ activityFamily: 'cazare' }, RULES, q())).not.toBeNull();
    expect(expenseEngineRefusal({}, RULES, q())).toBeNull();
    expect(expenseEngineRefusal({ activityFamily: 'other' }, RULES, q())).toBeNull();
  });
});

describe('expense deductibility — capital purchases are never a direct expense (B-31)', () => {
  it('a depreciable asset purchase is non_deductible under art. 68 alin. (7) lit. h)', () => {
    const r = classifyExpenseDeductibility({ category: 'depreciable_asset_purchase' }, RULES, q());
    expect(r.status === 'classified' && r.treatment).toBe('non_deductible');
    if (r.status !== 'classified') return;
    expect(r.rule.ruleId).toBe('EXPENSE_DEPRECIABLE_ASSET_PURCHASE_2026');
    expect(r.rule.sourceArticle).toContain('art. 68 alin. (7) lit. h)');
  });

  it('depreciation of a business asset is the only deductible route; personal patrimony is not', () => {
    const asset = classifyExpenseDeductibility({ category: 'depreciation_business_asset' }, RULES, q());
    expect(asset.status === 'classified' && asset.treatment).toBe('deductible');
    const personal = classifyExpenseDeductibility(
      { category: 'depreciation_personal_patrimony' },
      RULES,
      q(),
    );
    expect(personal.status === 'classified' && personal.treatment).toBe('non_deductible');
  });
});

describe('expense deductibility — the facts the law keys on', () => {
  it('no supporting document disqualifies an otherwise deductible expense (alin. (4) lit. a))', () => {
    const r = classifyExpenseDeductibility(
      { category: 'rent_business_space', context: { documentEvidence: 'absent' } },
      RULES,
      q(),
    );
    expect(r.status === 'classified' && r.treatment).toBe('non_deductible');
    if (r.status !== 'classified') return;
    expect(r.rule.ruleId).toBe('EXPENSE_DOCUMENTATION_ABSENT_2026');
  });

  it('a vehicle with no usage record defaults to 50 %, per the statutory default', () => {
    const r = classifyExpenseDeductibility({ category: 'vehicle_related' }, RULES, q());
    expect(r.status === 'classified' && r.treatment).toBe('capped');
    if (r.status !== 'classified' || r.treatment !== 'capped') return;
    expect(r.rule.ruleId).toBe('EXPENSE_VEHICLE_MIXED_USE_2026');
    expect(r.cap?.percent).toBe(50);
    expect(r.cap?.base).toBe('expense_itself');
  });

  it('exclusive use, or one of the five exception categories, deducts fully', () => {
    for (const context of [
      { vehicleUse: 'exclusive' as const },
      { vehicleExceptionCategory: 'transport_persoane_cu_plata' as const },
    ]) {
      const r = classifyExpenseDeductibility({ category: 'vehicle_related', context }, RULES, q());
      expect(r.status === 'classified' && r.treatment).toBe('deductible');
      if (r.status !== 'classified') return;
      expect(r.rule.ruleId).toBe('EXPENSE_VEHICLE_EXCLUSIVE_USE_2026');
    }
  });

  it('a vehicle not used in the activity at all is fully non-deductible, not 50 %', () => {
    const r = classifyExpenseDeductibility(
      { category: 'vehicle_related', context: { vehicleUse: 'not_used' } },
      RULES,
      q(),
    );
    expect(r.status === 'classified' && r.treatment).toBe('non_deductible');
    if (r.status !== 'classified') return;
    expect(r.rule.ruleId).toBe('EXPENSE_VEHICLE_NOT_USED_2026');
  });

  it('the owner CAS/CASS is not an art. 68 expense — it is deducted later, at art. 118', () => {
    const r = classifyExpenseDeductibility({ category: 'owner_social_contributions' }, RULES, q());
    expect(r.status === 'classified' && r.treatment).toBe('non_deductible');
    if (r.status !== 'classified') return;
    expect(r.rule.sourceArticle).toContain('art. 118 alin. (2) lit. b)');
    const employer = classifyExpenseDeductibility(
      { category: 'employer_social_contributions' },
      RULES,
      q(),
    );
    expect(employer.status === 'classified' && employer.treatment).toBe('deductible');
  });
});

describe('expense deductibility — rules take effect when the law says they do', () => {
  it('a PEPP contribution paid in January 2026 is not yet deductible under art. 68 alin. (5) lit. g^2)', () => {
    const jan = classifyExpenseDeductibility({ category: 'pepp_contribution' }, RULES, q('2026-01-15'));
    expect(jan.status).toBe('undetermined');
    if (jan.status !== 'undetermined') return;
    expect(jan.rule).toBeNull();

    const mar = classifyExpenseDeductibility({ category: 'pepp_contribution' }, RULES, q('2026-03-05'));
    expect(mar.status === 'classified' && mar.treatment).toBe('capped');
    if (mar.status !== 'classified') return;
    expect(mar.rule.ruleId).toBe('EXPENSE_PEPP_2026');
    expect(mar.cap?.eur).toBe(400);
  });

  it('the classifier returns the rule that justified the treatment, so the estimate can explain itself', () => {
    const r = classifyExpenseDeductibility({ category: 'donation' }, RULES, q());
    expect(r.status === 'classified' && r.treatment).toBe('non_deductible');
    if (r.status !== 'classified') return;
    expect(r.rule.sourceAct).toContain('Legea nr. 227/2015');
    expect(r.rule.sourceArticle).toContain('art. 68 alin. (7) lit. e)');
    expect(r.rule.sourceUrl).toContain('legislatie.just.ro');
  });
});
