import { useState } from 'react';
import { useStore } from '../../data/store';
import { localYear, toInstantISO } from '../../domain/date';
import { ANNUAL_AVERAGE_SOURCE_URL, DAILY_SOURCE_URL, rateKey, type RateCurrency } from '../../domain/fx/provider';
import { SERIES_CODE_STATUS, type FxRateRecord, type RateKind } from '../../domain/fx/rates';
import { fx } from '../../ui/copy';
import { InterpretationNote } from './InterpretationNote';

/**
 * Phase 10c (B-36) — the door a rate comes in through.
 *
 * Before this component `recordFxRate` had **no caller at all**: the store could hold a rate, the FX card
 * could show one, and no screen could produce one. A user with a EUR invoice therefore met the
 * missing-rate refusal with no way out except a developer writing to localStorage. This form is that way
 * out, and it is deliberately the *only* door: it calls the existing validated upsert and adds nothing of
 * its own.
 *
 * What it does NOT do:
 * - **It never fetches.** There is no network path in this app and none is added here. A rate is a datum a
 *   human read from BNR's published table, and the record says `entryMode: 'manual'` because of it.
 * - **It never edits a rate in place.** The correction route is the same form: the same currency, kind and
 *   date-or-year is the same `rateKey`, and `recordFxRate` replaces the record behind that key. A rate that
 *   has already been cited is not silently rewritten — the replacement is the same audited upsert, and the
 *   saved message says a replacement happened.
 * - **It never rewords a refusal.** `problems[]` from `recordFxRate` is rendered verbatim under one lead
 *   sentence. A validation message rewritten into friendlier words is a validation message nobody can act
 *   on.
 * - **It never decides the year is closed.** For an annual average of a year that has not ended, the
 *   provisional state is forced — the same decision `manualAnnualAverage` already makes, not a new one.
 */

/** The currencies a rate can be quoted against. `RON` is the target, never the source; the schema in
 *  `domain/fx/rates.ts` is the authority and refuses anything outside this set. */
const RATE_CURRENCIES: readonly RateCurrency[] = ['EUR', 'USD', 'GBP', 'HUF'];

/** The series a manual entry is read out of: verified for EUR, pattern-named (and labelled as such) for
 *  every other currency — the same `-PATTERN` honesty `bnrXml.ts` applies to a fetched record. */
function defaultSeriesCode(currency: string, kind: RateKind): string {
  if (currency === 'EUR') return kind === 'daily_reference' ? 'CURSZ_EUR' : 'CURSA_EURM';
  return kind === 'daily_reference' ? `CURSZ_${currency}-PATTERN` : `CURSA_${currency}M-PATTERN`;
}

interface FormState {
  currency: RateCurrency;
  rate: string;
  rateKind: RateKind;
  rateDate: string;
  rateYear: string;
  seriesCode: string;
  sourceUrl: string;
  /** `'da'` / `'nu'`; forced to `'da'` for an annual average of a year that has not closed. */
  provisional: 'da' | 'nu';
}

const INITIAL: FormState = {
  currency: 'EUR',
  rate: '',
  rateKind: 'daily_reference',
  rateDate: '',
  rateYear: '',
  seriesCode: defaultSeriesCode('EUR', 'daily_reference'),
  sourceUrl: DAILY_SOURCE_URL,
  provisional: 'da',
};

export interface FxRateEntryFormProps {
  /** Stable id so a test or a screen reader can point at the form. */
  id?: string;
}

export function FxRateEntryForm({ id }: FxRateEntryFormProps) {
  const { recordFxRate, fxRates } = useStore();
  const [form, setForm] = useState<FormState>(INITIAL);
  const [problems, setProblems] = useState<string[]>([]);
  const [saved, setSaved] = useState<string | null>(null);

  const e = fx.entry;
  const currentYear = localYear();
  const yearValue = Number(form.rateYear);
  /** The decision `manualAnnualAverage` already makes: BNR publishes a year's average after the year closes. */
  const yearNotClosed = form.rateKind === 'annual_average' && Number.isInteger(yearValue) && yearValue >= currentYear;
  const provisional = yearNotClosed ? 'da' : form.provisional;

  const setField = (patch: Partial<FormState>): void => {
    setForm(prev => ({ ...prev, ...patch }));
    setSaved(null);
  };

  /** Changing the currency or the kind changes which published series the number came from, so the series
   *  and the source move with it — a stale `CURSZ_EUR` on a USD record is a wrong citation, not a typo. */
  const reanchor = (currency: RateCurrency, kind: RateKind): void => {
    setField({ currency, rateKind: kind, seriesCode: defaultSeriesCode(currency, kind), sourceUrl: sourceFor(kind) });
  };

  const submit = (): void => {
    const validFor =
      form.rateKind === 'daily_reference' ? form.rateDate : form.rateYear.trim();
    const candidate: FxRateRecord = {
      currency: form.currency,
      rate: form.rate.trim(),
      rateKind: form.rateKind,
      ...(form.rateKind === 'daily_reference'
        ? { rateDate: form.rateDate === '' ? undefined : form.rateDate }
        : { rateYear: validFor === '' ? undefined : Number(form.rateYear) }),
      seriesCode: form.seriesCode.trim(),
      sourceUrl: form.sourceUrl.trim(),
      // When this record was entered — not the date the rate is valid for. `fetchedAt` is the audit stamp
      // the schema requires; a manual entry is still a read of a published table, just a human one.
      fetchedAt: toInstantISO(),
      provisional: provisional === 'da',
      entryMode: 'manual' as const,
    };
    const replacing = (fxRates ?? []).some(r => rateKey(r) === rateKey(candidate));
    const outcome = recordFxRate(candidate);
    if (!outcome.ok) {
      setProblems(outcome.problems);
      setSaved(null);
      return;
    }
    setProblems([]);
    setSaved(
      replacing
        ? e.replaced(outcome.record.currency, validFor || String(outcome.record.rateYear ?? ''))
        : e.saved(outcome.record.currency, validFor || String(outcome.record.rateYear ?? '')),
    );
  };

  const seriesIsUnverified = SERIES_CODE_STATUS[form.seriesCode.trim()] !== 'verified';

  return (
    <div className="fx-rate-entry" id={id} data-surface="fx-rate-entry">
      <p className="hint">{e.intro}</p>

      <div className="grid grid-2">
        <div className="field">
          <label htmlFor="fx-currency">{e.fields.currency}</label>
          <select
            id="fx-currency"
            className="input"
            name="fx-currency"
            value={form.currency}
            onChange={ev => reanchor(ev.target.value as RateCurrency, form.rateKind)}
          >
            {RATE_CURRENCIES.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="fx-rate">{e.fields.rate}</label>
          <input
            id="fx-rate"
            className="input"
            name="fx-rate"
            value={form.rate}
            onChange={ev => setField({ rate: ev.target.value })}
          />
          <span className="hint">{e.rateHelp}</span>
        </div>

        <div className="field">
          <label htmlFor="fx-kind">{e.fields.rateKind}</label>
          <select
            id="fx-kind"
            className="input"
            name="fx-kind"
            value={form.rateKind}
            onChange={ev => reanchor(form.currency, ev.target.value as RateKind)}
          >
            {Object.entries(fx.rateKindLabels).map(([kind, label]) => (
              <option key={kind} value={kind}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {form.rateKind === 'daily_reference' ? (
          <div className="field">
            <label htmlFor="fx-date">{e.fields.rateDate}</label>
            <input
              id="fx-date"
              className="input"
              type="date"
              name="fx-date"
              value={form.rateDate}
              onChange={ev => setField({ rateDate: ev.target.value })}
            />
          </div>
        ) : (
          <div className="field">
            <label htmlFor="fx-year">{e.fields.rateYear}</label>
            <input
              id="fx-year"
              className="input"
              name="fx-year"
              value={form.rateYear}
              onChange={ev => setField({ rateYear: ev.target.value })}
            />
          </div>
        )}

        <div className="field">
          <label htmlFor="fx-series">{e.fields.seriesCode}</label>
          <input
            id="fx-series"
            className="input"
            name="fx-series"
            value={form.seriesCode}
            onChange={ev => setField({ seriesCode: ev.target.value })}
          />
          {seriesIsUnverified ? <InterpretationNote note={e.seriesUnverified(form.seriesCode.trim())} /> : null}
        </div>

        <div className="field">
          <label htmlFor="fx-source">{e.fields.sourceUrl}</label>
          <input
            id="fx-source"
            className="input"
            name="fx-source"
            value={form.sourceUrl}
            onChange={ev => setField({ sourceUrl: ev.target.value })}
          />
        </div>

        <div className="field">
          <label htmlFor="fx-provisional">{e.fields.status}</label>
          <select
            id="fx-provisional"
            className="input"
            name="fx-provisional"
            value={provisional}
            disabled={yearNotClosed}
            onChange={ev => setField({ provisional: ev.target.value as 'da' | 'nu' })}
          >
            <option value="da">{fx.provisionalBadge}</option>
            <option value="nu">{fx.finalBadge}</option>
          </select>
          {yearNotClosed ? <span className="hint">{e.provisionalForced}</span> : null}
        </div>
      </div>

      <div className="row">
        <button type="button" className="btn btn-primary" onClick={submit}>
          {e.save}
        </button>
      </div>

      {problems.length > 0 ? (
        <div className="fx-rate-entry-problems" data-fx-entry-refused="true">
          <p className="error">{e.problemsLead}</p>
          <ul>
            {problems.map(p => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {saved ? (
        <p className="hint" data-fx-entry-saved="true">
          {saved}
        </p>
      ) : null}

      <p className="hint">{e.upsertHint}</p>
    </div>
  );
}

function sourceFor(kind: RateKind): string {
  return kind === 'daily_reference' ? DAILY_SOURCE_URL : ANNUAL_AVERAGE_SOURCE_URL;
}
