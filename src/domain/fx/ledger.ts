/**
 * TASK 10b — a ledger record written in a foreign currency enters the lei base at the BNR daily
 * reference rate **on the date the sum was paid or received**, and at nothing else.
 *
 * The authority is not EUR-specific, which is why this path carries USD with the same force it carries
 * EUR. CF art. 9 alin. (3) lit. b): „în oricare alt caz, sumele se convertesc în moneda națională a
 * României prin utilizarea cursului de schimb valutar la data la care se primesc sau se plătesc sumele
 * respective"; alin. (4): „cursul de schimb valutar … este cursul de schimb comunicat de Banca Națională
 * a României valabil pentru datele respective". Research 23 §Q4 verified that for a PFA on sistem real
 * there is no *expres* code exception for foreign-currency business income, so the residual rule of
 * art. 9 alin. (3) lit. b) + alin. (4) is the one that applies — and research 23 §"What the app can
 * implement with authority" items 3 and 4 state the same rule for receipts and for payments.
 *
 * This is deliberately a DIFFERENT basis from the one `capCeiling.ts` uses for a statutory ceiling
 * (pct. 7 alin. (6), the annual average of the payment year). Research 23 §"What must stay unresolved"
 * item 7 warns against sharing one conversion across the two anchors. Two amounts on one record may
 * legitimately carry two rates: the expense converts at the payment-date daily rate, the ceiling that
 * bounds it converts at the payment-year average.
 *
 * What this module refuses:
 * - it never guesses a rate. No rate for that currency on that date means the record stays out of the
 *   base and is reported, exactly as TASK 10a left it — the exclusion is not deleted, it is now reached
 *   by a lookup instead of by the absence of a rate layer;
 * - it never rewrites the stored record. The converted record is a copy, and the conversion that produced
 *   it travels beside it with the rate, the series code, the source URL and the fetch date, because BNR's
 *   terms require *indicarea sursei* and warn that its list is not mandatory for accounting entries;
 * - it never averages, interpolates or reaches for a neighbouring year or day. The one substitution it
 *   accepts is the carry-forward from the last published banking day, and that is `convertToRon`'s
 *   labelled app policy, surfaced through `carriedFrom` (research 23 §Q3: no statutory carry-forward
 *   exists for Titlul IV; the phrase occurs twice in the whole code, in the CASS articles).
 */
import type { AppData, Expense, Revenue } from '../../data/types';
import { isRon, type Bani, type CurrencyCode, type Money, type RonMoney } from '../money';
import { revenueFiscalDate, expenseFiscalDate } from '../aggregation';
import { BASIS_CITATIONS, convertToRon } from './convert';
import { isIsoDate } from './carryForward';
import type { FxRateProvider, RateCurrency } from './provider';
import type { FxRateRecord } from './rates';

/** The only basis a ledger amount may convert at. A record has one payment/receipt date, so it has one rate. */
export const LEDGER_CONVERSION_BASIS = 'payment_date_daily' as const;

/** One record that was brought into the lei base, with the rate that did it. */
export interface LedgerConversion {
  recordKind: 'revenue' | 'expense';
  recordId: string;
  currency: RateCurrency;
  /** The date the conversion is keyed to: collection for income, payment for an expense. */
  onDate: string;
  basis: typeof LEDGER_CONVERSION_BASIS;
  citation: string;
  /** The printed decimal, exactly as stored. */
  rate: string;
  netLei: Bani;
  vatLei: Bani;
  provisional: boolean;
  /** Set when the date had no published rate and the last banking day was used — app policy by analogy. */
  carriedFrom?: string;
  seriesCode: string;
  sourceUrl: string;
  fetchedAt: string;
}

/** One record that could NOT be brought in, and the datum that is missing. */
export interface UnconvertedLedgerRecord {
  recordKind: 'revenue' | 'expense';
  recordId: string;
  currency: CurrencyCode;
  onDate: string;
  detail: string;
}

export interface LedgerNormalisation {
  /**
   * The ledger with every convertible record replaced by a lei copy. RON records are returned
   * untouched — the pass is idempotent, so running it twice cannot drift.
   */
  data: AppData;
  conversions: LedgerConversion[];
  unconverted: UnconvertedLedgerRecord[];
}

type FieldConversion =
  | { ok: true; lei: Bani; record: FxRateRecord; carriedForward: boolean }
  | { ok: false; detail: string };

function convertField(amount: Money, onDate: string, provider: FxRateProvider): FieldConversion {
  if (isRon(amount)) return { ok: false, detail: 'recordul este deja în lei' };
  const result = convertToRon(amount, { basis: LEDGER_CONVERSION_BASIS, onDate }, provider);
  if (!result.ok) {
    return {
      ok: false,
      detail:
        result.reason === 'no_rate'
          ? result.detail
          : `conversia a fost refuzată de stratul valutar: ${result.reason}`,
    };
  }
  return { ok: true, lei: result.ron.amount, record: result.rate, carriedForward: result.carriedForward };
}

function normaliseRecord<T extends Revenue | Expense>(
  record: T,
  kind: 'revenue' | 'expense',
  onDate: string,
  provider: FxRateProvider,
): { record: T; conversion: LedgerConversion } | { detail: string } {
  const fields: Array<'valoareFaraTva' | 'tva'> = ['valoareFaraTva', 'tva'];
  const converted: Record<'valoareFaraTva' | 'tva', RonMoney> = {
    valoareFaraTva: { amount: 0 as Bani, currency: 'RON' },
    tva: { amount: 0 as Bani, currency: 'RON' },
  };
  let used: FxRateRecord | null = null;
  let carried = false;

  for (const field of fields) {
    const amount = record[field];
    if (isRon(amount)) {
      converted[field] = amount;
      continue;
    }
    const result = convertField(amount, onDate, provider);
    if (!result.ok) {
      return {
        detail:
          `${result.detail} (câmpul „${field}" al înregistrării ${record.id}, ${amount.currency})`,
      };
    }
    converted[field] = { amount: result.lei, currency: 'RON' };
    used = result.record;
    carried = carried || result.carriedForward;
  }

  const rate = used;
  if (rate === null) return { detail: 'înregistrarea nu are niciun câmp în valută de convertit' };

  // SAFETY: the copy changes only the two money fields, both of which exist on every `Revenue` and
  // every `Expense`; the record's own identity, status and category fields are spread through untouched.
  return {
    record: { ...record, valoareFaraTva: converted.valoareFaraTva, tva: converted.tva } as T,
    conversion: {
      recordKind: kind,
      recordId: record.id,
      currency: rate.currency,
      onDate,
      basis: LEDGER_CONVERSION_BASIS,
      citation: BASIS_CITATIONS[LEDGER_CONVERSION_BASIS],
      rate: rate.rate,
      netLei: converted.valoareFaraTva.amount,
      vatLei: converted.tva.amount,
      provisional: rate.provisional,
      ...(carried && rate.rateDate !== undefined ? { carriedFrom: rate.rateDate } : {}),
      seriesCode: rate.seriesCode,
      sourceUrl: rate.sourceUrl,
      fetchedAt: rate.fetchedAt,
    },
  };
}

/**
 * Replace every convertible foreign-currency record with a lei copy, and report both halves of the
 * result: what was converted at which rate, and what is still missing a rate.
 *
 * A record is converted only when BOTH money fields convert. A half-converted record — net in lei, VAT
 * in dollars — would be a new B-15-class mixing defect, so the whole record stays out and is reported.
 */
export function normaliseLedgerToRon(data: AppData, provider: FxRateProvider): LedgerNormalisation {
  const conversions: LedgerConversion[] = [];
  const unconverted: UnconvertedLedgerRecord[] = [];

  const mapOne = <T extends Revenue | Expense>(record: T, kind: 'revenue' | 'expense', onDate: string): T => {
    if (isRon(record.valoareFaraTva) && isRon(record.tva)) return record;
    if (!isIsoDate(onDate)) {
      unconverted.push({
        recordKind: kind,
        recordId: record.id,
        currency: isRon(record.valoareFaraTva) ? record.tva.currency : record.valoareFaraTva.currency,
        onDate,
        detail:
          `înregistrarea este în valută, iar data care ancorarea conversiei o cere lipsește: „${onDate}" nu este `
          + 'o dată calendaristică ISO (AAAA-LL-ZZ), deci art. 9 alin. (3) lit. b) nu poate fi aplicată.',
      });
      return record;
    }
    const outcome = normaliseRecord(record, kind, onDate, provider);
    if ('detail' in outcome) {
      unconverted.push({
        recordKind: kind,
        recordId: record.id,
        currency: isRon(record.valoareFaraTva) ? record.tva.currency : record.valoareFaraTva.currency,
        onDate,
        detail: outcome.detail,
      });
      return record;
    }
    conversions.push(outcome.conversion);
    return outcome.record;
  };

  const revenues = data.revenues.map(r => mapOne(r, 'revenue', revenueFiscalDate(r)));
  const expenses = data.expenses.map(e => mapOne(e, 'expense', expenseFiscalDate(e)));

  return { data: { ...data, revenues, expenses }, conversions, unconverted };
}
