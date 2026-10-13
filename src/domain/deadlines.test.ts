import { describe, expect, it } from 'vitest';
import {
  DEADLINE_EVENT_TYPES,
  classifyDeadline,
  computeDeadlines,
  daysRemaining,
  filterUpcoming,
  getApplicableDeadlines,
  resolveDeadlineOutcome,
  vatObligationDeadlines,
  vatReturnForDeadline,
} from './deadlines';
import type { Deadline, DeadlineEventType } from './deadlines';
import { aicFlipForQuarter, decontObligations } from './fiscal/vatReturn';
import { alin7MonthStart } from './fiscal/vatPeriodicity';
import type { VatReturnRecord } from '../data/types';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from './fiscal/package2026';
import type { FiscalRule } from './fiscal/rules';

const rules = PFA_2026_SYSTEM_REAL_PACKAGE;
const baseQuery = { taxYear: 2026, asOfDate: '2026-06-01' };

/**
 * The four obligations Phase 9b deleted. They are not `DeadlineEventType` members any more, so these
 * strings can only ever appear here — never in the type, never in a rule, never in the UI. Every
 * test that loops over them is a regression guard: if someone re-adds one, `computeDeadlines` will
 * start emitting it and these assertions go red.
 */
const DELETED_EVENT_TYPES = [
  'income_tax_advance',
  'cas_quarterly',
  'cass_quarterly',
  'pfa_estimated_declaration',
] as const;

const makeRule = (overrides: Partial<FiscalRule> = {}): FiscalRule => ({
  ruleId: 'PFA_DEADLINE_2026',
  name: 'PFA single deadline 2026',
  jurisdiction: 'RO',
  entityType: 'PFA',
  taxRegime: 'deadlines',
  taxYear: 2026,
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  parameters: [
    { id: 'deadline', label: 'Single deadline', value: '2027-05-25', unit: 'date' },
    { id: 'event_type', label: 'Deadline event type', value: 'd212_filing', unit: 'text' },
    { id: 'applies_to', label: 'Applies to', value: 'pfa', unit: 'text' },
  ],
  calculatorId: 'calc-deadline',
  sourceAct: 'Cod fiscal (consolidat)',
  sourceArticle: 'art. 122 alin. (3)',
  sourceUrl: 'https://legislatie.just.ro/Public/DetaliiDocument/312601',
  verifiedAt: '2026-01-01',
  status: 'ACTIVE',
  version: 1,
  ...overrides,
});

describe('DEADLINE_EVENT_TYPES', () => {
  it('is exactly the event types that have a legal basis in 2026', () => {
    // PG-6g widened this from two to four, deliberately and with a citation per entry. The pin still does
    // its job: an event type with no article behind it fails here rather than reaching the screen.
    expect(DEADLINE_EVENT_TYPES).toEqual([
      'd212_filing',      // CF art. 122 alin. (3) — D212, termenul de depunere
      'vat_registration', // CF art. 316 alin. (1) lit. b) — „cel târziu la data depășirii plafonului"
      'vat_return',       // CF art. 323 alin. (1) — decontul pe fiecare perioadă fiscală; plată art. 326 alin. (1)
      'vat_mentiuni',     // CF art. 322 alin. (6) și alin. (8) — declarația de mențiuni, nu un decont
    ]);
  });

  it('keeps the two PG-6g types apart, because a mențiune is not a decont', () => {
    // Collapsing them into one type is how a 25-ianuarie mențiuni duty would come to be presented as a
    // periodic return, and how a taxpayer would be told to file the wrong form. The types differ, the
    // `appliesTo` keys differ, and the labels differ.
    expect(DEADLINE_EVENT_TYPES).toContain('vat_return');
    expect(DEADLINE_EVENT_TYPES).toContain('vat_mentiuni');
    expect(DEADLINE_EVENT_TYPES).not.toContain('vat_obligatie');
  });

  it('contains none of the four deleted event types', () => {
    for (const dead of DELETED_EVENT_TYPES) {
      expect(DEADLINE_EVENT_TYPES as readonly string[]).not.toContain(dead);
    }
  });
});

describe('computeDeadlines — rule-driven, no literals', () => {
  it('emits exactly the deadlines the 2026 package declares', () => {
    const result = computeDeadlines(rules, baseQuery);
    expect(result.map((d) => d.deadlineId).sort()).toEqual([
      'PFA_DEADLINE_2026',
      'VAT_REGISTRATION_DEADLINE_2026',
    ]);
  });

  it('emits nothing for the four deleted event types, for any query', () => {
    const queries = [
      baseQuery,
      { ...baseQuery, pfaStartDate: '2026-03-01' },
      { ...baseQuery, vatExceedanceDate: '2026-03-15' },
      { ...baseQuery, pfaStartDate: '2026-03-01', vatExceedanceDate: '2026-03-15' },
      { taxYear: 2026, asOfDate: '2026-01-15' },
      { taxYear: 2026, asOfDate: '2026-12-31' },
    ];
    for (const q of queries) {
      const emitted = computeDeadlines(rules, q);
      for (const dead of DELETED_EVENT_TYPES) {
        expect(emitted.filter((d) => (d.eventType as string) === dead)).toHaveLength(0);
      }
      // Every emitted event type is a declared one.
      for (const d of emitted) {
        expect(DEADLINE_EVENT_TYPES).toContain(d.eventType);
      }
    }
  });

  it('emits NO deadline at all for a year with no deadline rule (no hardcoded fallback)', () => {
    // Under the old engine this returned twelve quarterly dates fabricated from arrays inside
    // computeDeadlines. A rule-driven engine can only answer with what the package declares.
    for (const year of [1999, 2025, 2027]) {
      const result = computeDeadlines(rules, { taxYear: year, asOfDate: `${year}-06-01` });
      expect(result).toHaveLength(0);
    }
  });

  it('drops a deadline when its rule is removed from the package', () => {
    const withoutD212 = rules.filter((r) => r.ruleId !== 'PFA_DEADLINE_2026');
    const result = computeDeadlines(withoutD212, baseQuery);
    expect(result.find((d) => d.eventType === 'd212_filing')).toBeUndefined();
    expect(result.map((d) => d.deadlineId)).toEqual(['VAT_REGISTRATION_DEADLINE_2026']);
  });

  it('carries legalSource verbatim from the rule, not from a literal in the engine', () => {
    const mutated = [
      makeRule({ sourceAct: 'ACT_FROM_RULE', sourceArticle: 'ARTICOL_FROM_RULE' }),
    ];
    const [d212] = computeDeadlines(mutated, baseQuery);
    expect(d212.legalSource).toEqual({ act: 'ACT_FROM_RULE', article: 'ARTICOL_FROM_RULE' });

    // And the real package's citation is the corrected one: payment is art. 68 alin. (10), because
    // art. 123 alin. (1) is the RATE provision, not the payment provision.
    const real = computeDeadlines(rules, baseQuery).find((d) => d.eventType === 'd212_filing')!;
    expect(real.legalSource.article).toContain('art. 122 alin. (3)');
    expect(real.legalSource.article).toContain('art. 68 alin. (10)');
    expect(real.legalSource.article).not.toContain('art. 123 alin. (1)');
  });

  it('resolves the D212 filing deadline from the rule', () => {
    const d212 = computeDeadlines(rules, baseQuery).find((d) => d.eventType === 'd212_filing')!;
    expect(d212.deadlineId).toBe('PFA_DEADLINE_2026');
    expect(d212.date).toBe('2027-05-25');
    expect(d212.status).toBe('active');
    expect(d212.appliesTo).toBe('pfa');
    expect(d212.effectiveFrom).toBe('2026-01-01');
    expect(d212.effectiveTo).toBeNull();
  });

  it('is deterministic (two calls return equal results)', () => {
    const a = computeDeadlines(rules, baseQuery);
    const b = computeDeadlines(rules, baseQuery);
    expect(b).toEqual(a);
  });

  it('respects tax-year applicability (no 2026 deadlines for taxYear 2027)', () => {
    const result = computeDeadlines(rules, { taxYear: 2027, asOfDate: '2027-06-01' });
    expect(result.filter((d) => d.taxYear === 2026)).toHaveLength(0);
  });
});

describe('VAT registration deadline (CF art. 316 alin. (1) lit. b))', () => {
  it('is the exceedance date itself — offset_days is 0, so the deadline IS the event', () => {
    const result = computeDeadlines(rules, {
      ...baseQuery,
      vatExceedanceDate: '2026-03-15',
    });
    const vat = result.find((d) => d.eventType === 'vat_registration')!;
    expect(vat.deadlineId).toBe('VAT_REGISTRATION_DEADLINE_2026');
    expect(vat.date).toBe('2026-03-15');
    expect(vat.status).toBe('active');
    expect(vat.appliesTo).toBe('vat-registered-pfa');
  });

  it('never reports days remaining for a resolved VAT deadline: past or due_today, never upcoming', () => {
    // offset_days = 0 means deadline === exceedance date, so once the exceedance is known the term is
    // already due. `filterUpcoming` therefore never surfaces it in the Termene limită card — correct,
    // because past that date the registration obligation is OVERDUE and "N zile rămase" would lie.
    const exceedance = '2026-03-15';
    const onDay = computeDeadlines(rules, { ...baseQuery, vatExceedanceDate: exceedance })
      .find((d) => d.eventType === 'vat_registration')!;
    expect(classifyDeadline(onDay, exceedance)).toBe('due_today');

    const dayAfter = computeDeadlines(rules, { ...baseQuery, vatExceedanceDate: exceedance })
      .find((d) => d.eventType === 'vat_registration')!;
    expect(classifyDeadline(dayAfter, '2026-03-16')).toBe('past');

    expect(filterUpcoming([onDay], exceedance)).toHaveLength(0);
    expect(filterUpcoming([dayAfter], '2026-03-16')).toHaveLength(0);
  });

  it('stays dateless and not_applicable when no exceedance date is supplied', () => {
    const vat = computeDeadlines(rules, baseQuery).find((d) => d.eventType === 'vat_registration')!;
    expect(vat.date).toBeNull();
    expect(vat.status).toBe('not_applicable');
    expect(vat.dateFormula).toContain('vat_exceedance + 0 days');
  });

  it('cites OG 22/2025 and art. 316, and does not duplicate the 395.000 lei ceiling', () => {
    const vat = computeDeadlines(rules, baseQuery).find((d) => d.eventType === 'vat_registration')!;
    expect(vat.legalSource.article).toContain('art. 316 alin. (1) lit. b)');
    expect(vat.legalSource.act).toContain('Ordonanța nr. 22/2025');
    // The ceiling belongs to VAT_THRESHOLD_2026 — one figure, one source.
    const params = rules.find((r) => r.ruleId === 'VAT_REGISTRATION_DEADLINE_2026')!.parameters;
    expect(params.some((p) => p.value === 395000)).toBe(false);
  });
});

describe('a PFA start date resolves no deadline at all', () => {
  // Brief 10 §2c: there is no `fiscal_registration` obligation for a PFA. CPF (Legea nr. 207/2015)
  // art. 82 alin. (6) lit. c) excludes from the 30-day declarație de înregistrare fiscală the persons
  // who register at registrul comerțului, and OUG 44/2008 art. 7 alin. (1) makes that registration
  // mandatory for a PFA — while art. 13 alin. (3) of the same act makes the ONRC certificate itself
  // the act of fiscal taking-into-evidence. So a start date must be inert.
  it('produces results identical to a query with no start date', () => {
    const withStart = computeDeadlines(rules, { ...baseQuery, pfaStartDate: '2026-03-01' });
    const withoutStart = computeDeadlines(rules, baseQuery);
    expect(withStart).toEqual(withoutStart);
  });

  it('never resolves a date from the start date, whatever the start date is', () => {
    for (const start of ['2026-01-01', '2026-03-01', '2026-11-15', '2026-12-31']) {
      const result = computeDeadlines(rules, { ...baseQuery, pfaStartDate: start });
      const dated = result.filter((d) => d.date !== null);
      // Only the D212 filing deadline is dated, and it is dated by the rule, not by the start date.
      expect(dated.map((d) => d.date)).toEqual(['2027-05-25']);
      for (const d of result) {
        expect(d.dateFormula).not.toContain('pfa_start');
      }
    }
  });

  it('a rule that tries to bind pfa_start cannot resolve — there is no such event key', () => {
    const rogue = makeRule({
      ruleId: 'ROGUE_START_RULE',
      parameters: [
        { id: 'event_type', label: 'Deadline event type', value: 'd212_filing', unit: 'text' },
        { id: 'applies_to', label: 'Applies to', value: 'pfa', unit: 'text' },
        { id: 'event', label: 'Event', value: 'pfa_start', unit: 'text' },
        { id: 'offset_days', label: 'Offset', value: 30, unit: 'days' },
      ],
    });
    const [deadline] = computeDeadlines([rogue], { ...baseQuery, pfaStartDate: '2026-03-01' });
    expect(deadline.date).toBeNull();
    expect(deadline.status).toBe('not_applicable');
  });
});

describe('malformed deadline rules emit nothing', () => {
  it('unknown event_type', () => {
    const rule = makeRule({
      parameters: [
        { id: 'deadline', label: 'd', value: '2027-05-25', unit: 'date' },
        { id: 'event_type', label: 'et', value: 'cas_quarterly', unit: 'text' },
        { id: 'applies_to', label: 'a', value: 'pfa', unit: 'text' },
      ],
    });
    expect(computeDeadlines([rule], baseQuery)).toHaveLength(0);
  });

  it('missing event_type', () => {
    const rule = makeRule({
      parameters: [
        { id: 'deadline', label: 'd', value: '2027-05-25', unit: 'date' },
        { id: 'applies_to', label: 'a', value: 'pfa', unit: 'text' },
      ],
    });
    expect(computeDeadlines([rule], baseQuery)).toHaveLength(0);
  });

  it('missing applies_to', () => {
    const rule = makeRule({
      parameters: [
        { id: 'deadline', label: 'd', value: '2027-05-25', unit: 'date' },
        { id: 'event_type', label: 'et', value: 'd212_filing', unit: 'text' },
      ],
    });
    expect(computeDeadlines([rule], baseQuery)).toHaveLength(0);
  });

  it('event-relative rule with no numeric offset_days', () => {
    const rule = makeRule({
      parameters: [
        { id: 'event_type', label: 'et', value: 'vat_registration', unit: 'text' },
        { id: 'applies_to', label: 'a', value: 'vat-registered-pfa', unit: 'text' },
        { id: 'event', label: 'e', value: 'vat_exceedance', unit: 'text' },
      ],
    });
    expect(computeDeadlines([rule], { ...baseQuery, vatExceedanceDate: '2026-03-15' })).toHaveLength(0);
  });

  it('fixed-date rule with an unparsable deadline', () => {
    const rule = makeRule({
      parameters: [
        { id: 'deadline', label: 'd', value: '25 mai 2027', unit: 'text' },
        { id: 'event_type', label: 'et', value: 'd212_filing', unit: 'text' },
        { id: 'applies_to', label: 'a', value: 'pfa', unit: 'text' },
      ],
    });
    expect(computeDeadlines([rule], baseQuery)).toHaveLength(0);
  });

  it('rules outside the deadlines regime are ignored', () => {
    const rule = makeRule({ taxRegime: 'income-tax' });
    expect(computeDeadlines([rule], baseQuery)).toHaveLength(0);
  });
});

describe('effective-date applicability', () => {
  it('excludes the d212 rule when asOfDate is before effectiveFrom', () => {
    const result = computeDeadlines([makeRule()], { taxYear: 2026, asOfDate: '2025-12-31' });
    expect(result.find((d) => d.eventType === 'd212_filing')).toBeUndefined();
  });

  it('includes the d212 rule when asOfDate is on/after effectiveFrom', () => {
    const result = computeDeadlines([makeRule()], { taxYear: 2026, asOfDate: '2026-06-01' });
    const d212 = result.find((d) => d.eventType === 'd212_filing');
    expect(d212?.date).toBe('2027-05-25');
    expect(d212?.status).toBe('active');
  });

  it('includes the d212 rule when asOfDate is exactly on the effectiveFrom boundary day', () => {
    const result = computeDeadlines([makeRule()], { taxYear: 2026, asOfDate: '2026-01-01' });
    const d212 = result.find((d) => d.eventType === 'd212_filing');
    expect(d212).toBeDefined();
    expect(d212?.date).toBe('2027-05-25');
  });
});

describe('daysRemaining', () => {
  it('counts days before the deadline', () => {
    expect(daysRemaining('2027-05-25', '2027-05-20')).toBe(5);
  });

  it('is zero on the deadline', () => {
    expect(daysRemaining('2027-05-25', '2027-05-25')).toBe(0);
  });

  it('is negative after the deadline', () => {
    expect(daysRemaining('2027-05-25', '2027-05-26')).toBe(-1);
  });

  it('counts days across a year boundary', () => {
    expect(daysRemaining('2027-01-01', '2026-12-31')).toBe(1);
    expect(daysRemaining('2027-01-01', '2026-12-01')).toBe(31);
  });

  it('handles February in leap and non-leap years', () => {
    // 2028 is a leap year: Feb 29 exists and is one day after Feb 28.
    expect(daysRemaining('2028-02-29', '2028-02-28')).toBe(1);
    // 2027 is not a leap year: Mar 1 follows Feb 28.
    expect(daysRemaining('2027-03-01', '2027-02-28')).toBe(1);
  });
});

describe('deadline helpers', () => {
  const makeDeadline = (date: string | null, eventType: DeadlineEventType = 'd212_filing'): Deadline => ({
    deadlineId: 'TEST_DEADLINE',
    taxYear: 2026,
    eventType,
    date,
    dateFormula: 'test',
    appliesTo: 'pfa',
    legalSource: { act: 'Cod fiscal (consolidat)', article: 'art. 122 alin. (3)' },
    effectiveFrom: null,
    effectiveTo: null,
    status: 'active',
  });

  it('getApplicableDeadlines returns only deadlines with non-null dates', () => {
    const all = computeDeadlines(rules, baseQuery);
    const applicable = getApplicableDeadlines(rules, baseQuery);
    expect(applicable.every((d) => d.date !== null)).toBe(true);
    expect(applicable.map((d) => d.deadlineId)).toEqual(['PFA_DEADLINE_2026']);
    expect(applicable).toEqual(all.filter((d) => d.date !== null));
  });

  it('getApplicableDeadlines includes the VAT deadline once the exceedance date is known', () => {
    const applicable = getApplicableDeadlines(rules, { ...baseQuery, vatExceedanceDate: '2026-03-15' });
    expect(applicable.every((d) => d.date !== null)).toBe(true);
    expect(applicable).toHaveLength(2);
  });

  it('filterUpcoming returns only upcoming (future-dated) deadlines', () => {
    const all = computeDeadlines(rules, baseQuery);
    const upcoming = filterUpcoming(all, baseQuery.asOfDate);
    expect(upcoming.map((d) => d.date)).toEqual(['2027-05-25']);
    expect(upcoming.every((d) => classifyDeadline(d, baseQuery.asOfDate) === 'upcoming')).toBe(true);
  });

  it('filterUpcoming excludes past, due-today, and null-dated deadlines', () => {
    const deadlines = [
      makeDeadline('2026-05-01'), // past
      makeDeadline('2026-06-01'), // due today
      makeDeadline('2026-07-15'), // upcoming
      makeDeadline(null), // no date
    ];
    const upcoming = filterUpcoming(deadlines, '2026-06-01');
    expect(upcoming.map((d) => d.date)).toEqual(['2026-07-15']);
  });
});

describe('classifyDeadline (Step 29 boundary tests)', () => {
  const makeDeadline = (date: string | null): Deadline => ({
    deadlineId: 'TEST_DEADLINE',
    taxYear: 2026,
    eventType: 'd212_filing',
    date,
    dateFormula: 'test',
    appliesTo: 'pfa',
    legalSource: { act: 'Cod fiscal (consolidat)', article: 'art. 122 alin. (3)' },
    effectiveFrom: null,
    effectiveTo: null,
    status: 'active',
  });

  it('returns "past" for a deadline date before the asOfDate', () => {
    const deadline = makeDeadline('2026-05-01');
    const asOfDate = '2026-06-01';
    expect(classifyDeadline(deadline, asOfDate)).toBe('past');
  });

  it('negative days are never classified as "upcoming" (approaching)', () => {
    const deadline = makeDeadline('2026-05-01'); // 31 days before asOfDate
    const asOfDate = '2026-06-01';
    expect(daysRemaining(deadline.date!, asOfDate)).toBeLessThan(0);
    expect(classifyDeadline(deadline, asOfDate)).not.toBe('upcoming');
    expect(classifyDeadline(deadline, asOfDate)).toBe('past');
  });

  it('returns "due_today" when the deadline date equals the asOfDate (days === 0)', () => {
    const deadline = makeDeadline('2026-06-01');
    expect(classifyDeadline(deadline, '2026-06-01')).toBe('due_today');
  });

  it('returns null for a dateless deadline', () => {
    expect(classifyDeadline(makeDeadline(null), '2026-06-01')).toBeNull();
  });

  it('classifies the three zones consistently around the boundary', () => {
    expect(classifyDeadline(makeDeadline('2026-05-31'), '2026-06-01')).toBe('past');
    expect(classifyDeadline(makeDeadline('2026-06-01'), '2026-06-01')).toBe('due_today');
    expect(classifyDeadline(makeDeadline('2026-06-02'), '2026-06-01')).toBe('upcoming');
  });
});

/**
 * B-99 — the distinct alin. (7) period is a term like any other, so the join has to work for it too.
 *
 * `obligationId` is a join key, not a label: `vatObligationDeadlines` turns a `VatObligation.id` into the
 * `deadlineId`, and `vatReturnForDeadline` matches a filed return against it. The case that cannot be
 * shortcut is the one that crosses a year boundary — an acquisition in November 2026 (lit. b) of art. 322
 * alin. (7)) makes 10–11 a fiscal period of its own due 25 December, while December itself stays a period
 * whose term is 25 ianuarie 2027. One filed return discharges one of those and not the other.
 */
describe('B-99 — the alin. (7) distinct period joins a filed return to its term', () => {
  // lit. b) with the exigibility in November: Q4 is replaced by the partial 10–11 plus the month 12.
  const flip = aicFlipForQuarter(2026, 4, 11)!;
  // B-101 — and the year is not twelve months. Art. 322 alin. (7) lit. b) begins the month at the third
  // month of Q4, so the first three quarters are still one return each. Without the segment this fixture
  // handed the taxpayer twelve monthly deconturi for a year they spent on the quarter until December.
  const deadlines = vatObligationDeadlines(
    decontObligations('month', 2026, { flips: [flip], segment: { before: 'quarter', after: 'month', fromMonth: alin7MonthStart(11)! } }),
    2026,
  );

  it('dates the distinct period and the December month separately, one of them in the next calendar year', () => {
    const distinct = deadlines.find((d) => d.deadlineId === 'decont-10-11.2026')!;
    expect(distinct.date).toBe('2026-12-25');
    expect(distinct.eventType).toBe('vat_return');
    const december = deadlines.find((d) => d.deadlineId === 'decont-12.2026')!;
    expect(december.date).toBe('2027-01-25');
    expect(december.taxYear).toBe(2026);
  });

  it('a filed return discharges the term it names, and only that term', () => {
    const december = deadlines.find((d) => d.deadlineId === 'decont-12.2026')!;
    const distinct = deadlines.find((d) => d.deadlineId === 'decont-10-11.2026')!;
    const filed: VatReturnRecord = {
      id: 'r-dec', obligationId: 'decont-12.2026', year: 2026, form: '300',
      periodKind: 'month', periodIndex: 12, status: 'depusa', filedOn: '2027-01-20',
    };
    // The join survives the year boundary: the term is in 2027, the period and the record are 2026.
    expect(vatReturnForDeadline([filed], december)?.id).toBe('r-dec');
    expect(resolveDeadlineOutcome(december, [], '2027-03-01', [filed])).toBe('done');
    // The distinct period is a real obligation, not a caption on the December one: filing December does
    // not discharge it, and it is overdue.
    expect(vatReturnForDeadline([filed], distinct)).toBeNull();
    expect(resolveDeadlineOutcome(distinct, [], '2027-03-01', [filed])).toBe('overdue');
  });

  it('gives one year no two deadlines with the same id', () => {
    expect(new Set(deadlines.map((d) => d.deadlineId)).size).toBe(deadlines.length);
    // Three untouched quarters, the distinct 10–11 period, and December. B-101 moved this from 11: the
    // eight monthly rows the old fixture carried were returns for quarters that were never monthly.
    expect(deadlines.map((d) => d.deadlineId)).toEqual([
      'decont-T1-2026', 'decont-T2-2026', 'decont-T3-2026', 'decont-10-11.2026', 'decont-12.2026',
    ]);
  });

  it('a return filed against a restored quarter discharges that quarter, across the year boundary', () => {
    // The restored Q1 is not a caption: it is the same term a plain quarterly person has, so a filing
    // recorded against it joins, and the December term dated in 2027 stays open.
    const q1 = deadlines.find((d) => d.deadlineId === 'decont-T1-2026')!;
    const december = deadlines.find((d) => d.deadlineId === 'decont-12.2026')!;
    const filed: VatReturnRecord = {
      id: 'r-q1', obligationId: 'decont-T1-2026', year: 2026, form: '300',
      periodKind: 'quarter', periodIndex: 1, status: 'depusa', filedOn: '2026-04-20',
    };
    expect(vatReturnForDeadline([filed], q1)?.id).toBe('r-q1');
    expect(resolveDeadlineOutcome(q1, [], '2027-03-01', [filed])).toBe('done');
    expect(resolveDeadlineOutcome(december, [], '2027-03-01', [filed])).toBe('overdue');
  });
});
