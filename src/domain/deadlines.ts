import type { FiscalRule } from './fiscal/rules';
import { selectApplicableRules } from './fiscal/select';

export type DeadlineEventType =
  | 'd212_filing'
  | 'cas_quarterly'
  | 'cass_quarterly'
  | 'income_tax_advance'
  | 'pfa_estimated_declaration'
  | 'vat_registration';

export interface Deadline {
  deadlineId: string;
  taxYear: number;
  eventType: DeadlineEventType;
  date: string | null; // resolved ISO date 'YYYY-MM-DD'; null when event-relative and no eventDate given
  dateFormula: string;
  appliesTo: string;
  legalSource: { act: string; article: string };
  effectiveFrom: string | null;
  effectiveTo: string | null;
  status: 'active' | 'not_applicable';
}

export interface DeadlineQuery {
  taxYear: number;
  asOfDate: string;
  eventDate?: string; // for event-relative deadlines (PFA start, VAT exceedance month)
}

const DAY_MS = 86400000;

function isoDaysAfter(date: string, days: number): string {
  return new Date(Date.parse(date + 'T00:00:00Z') + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

function monthEnd(date: string): string {
  const [y, m] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

export function daysRemaining(deadlineDate: string, asOfDate: string): number {
  const dl = Date.parse(deadlineDate + 'T00:00:00Z');
  const as = Date.parse(asOfDate + 'T00:00:00Z');
  return Math.round((dl - as) / DAY_MS);
}

export function computeDeadlines(
  rules: FiscalRule[],
  query: DeadlineQuery,
): Deadline[] {
  const { taxYear, asOfDate, eventDate } = query;
  const results: Deadline[] = [];
  const yearStart = `${taxYear}-01-01`;

  // d212_filing — rule-resolved fixed date (art. 122(3))
  const applicable = selectApplicableRules(rules, { taxYear, asOfDate });
  const d212Rule = applicable.find((r) => r.ruleId === 'PFA_DEADLINE_2026');
  const d212Param = d212Rule?.parameters.find((p) => p.id === 'deadline');
  if (d212Rule && d212Param && typeof d212Param.value === 'string') {
    results.push({
      deadlineId: `D212_${taxYear}`,
      taxYear,
      eventType: 'd212_filing',
      date: d212Param.value,
      dateFormula: 'fixed date from rule PFA_DEADLINE_2026',
      appliesTo: 'pfa',
      legalSource: { act: 'Cod. fiscal', article: 'art. 122(3)' },
      effectiveFrom: d212Rule.effectiveFrom,
      effectiveTo: d212Rule.effectiveTo,
      status: 'active',
    });
  }

  // cas_quarterly — 15th of the month following quarter end (art. 160)
  const casDates = [`${taxYear}-04-15`, `${taxYear}-07-15`, `${taxYear}-10-15`, `${taxYear + 1}-01-15`];
  casDates.forEach((date, i) => {
    results.push({
      deadlineId: `CAS_Q${i + 1}_${taxYear}`,
      taxYear,
      eventType: 'cas_quarterly',
      date,
      dateFormula: '15th of the month following quarter end (art. 160)',
      appliesTo: 'pfa',
      legalSource: { act: 'Cod. fiscal', article: 'art. 160' },
      effectiveFrom: yearStart,
      effectiveTo: null,
      status: 'active',
    });
  });

  // cass_quarterly — 15th of the month following quarter end (art. 170)
  casDates.forEach((date, i) => {
    results.push({
      deadlineId: `CASS_Q${i + 1}_${taxYear}`,
      taxYear,
      eventType: 'cass_quarterly',
      date,
      dateFormula: '15th of the month following quarter end (art. 170)',
      appliesTo: 'pfa',
      legalSource: { act: 'Cod. fiscal', article: 'art. 170' },
      effectiveFrom: yearStart,
      effectiveTo: null,
      status: 'active',
    });
  });

  // income_tax_advance — 25th of Mar/Jun/Sep/Dec (art. 81)
  const advanceMonths: Array<[string, string]> = [
    ['MAR', '03-25'],
    ['JUN', '06-25'],
    ['SEP', '09-25'],
    ['DEC', '12-25'],
  ];
  for (const [label, md] of advanceMonths) {
    results.push({
      deadlineId: `INCOME_ADV_${label}_${taxYear}`,
      taxYear,
      eventType: 'income_tax_advance',
      date: `${taxYear}-${md}`,
      dateFormula: '25th of March/June/September/December (art. 81)',
      appliesTo: 'pfa',
      legalSource: { act: 'Cod. fiscal', article: 'art. 81' },
      effectiveFrom: yearStart,
      effectiveTo: null,
      status: 'active',
    });
  }

  // pfa_estimated_declaration — start_date + 15 days (art. 81), event-relative
  results.push({
    deadlineId: 'PFA_ESTIMATED_DECLARATION',
    taxYear,
    eventType: 'pfa_estimated_declaration',
    date: eventDate ? isoDaysAfter(eventDate, 15) : null,
    dateFormula: 'start_date + 15 days (art. 81)',
    appliesTo: 'new_pfa',
    legalSource: { act: 'Cod. fiscal', article: 'art. 81' },
    effectiveFrom: null,
    effectiveTo: null,
    status: 'active',
  });

  // vat_registration — month_end(exceedance_month) + 30 days (art. 338), event-relative
  results.push({
    deadlineId: 'VAT_REGISTRATION',
    taxYear,
    eventType: 'vat_registration',
    date: eventDate ? isoDaysAfter(monthEnd(eventDate), 30) : null,
    dateFormula: 'month_end(exceedance_month) + 30 days (art. 338)',
    appliesTo: 'vat-registered-pfa',
    legalSource: { act: 'Cod. fiscal', article: 'art. 338' },
    effectiveFrom: null,
    effectiveTo: null,
    status: 'active',
  });

  return results;
}
