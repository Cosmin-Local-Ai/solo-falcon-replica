/**
 * B-97 (D-AIC-1, D-AIC-2) — the art. 322 alin. (7)-(8) facts are collected on Settings → Regim fiscal,
 * per fiscal year, behind a confirmation that names what the answer changes.
 *
 * The defect this pins is the blind spot, not a typo. The two facts already existed in the model, were
 * already persisted per year as `PfaProfile.vatPeriodicityYears`, and were already read by working
 * arithmetic in `data/dashboard.ts` — but **no control anywhere could write them**. A taxpayer who bought
 * goods in another EU country therefore had the rule applied to a question the app never asked, and the
 * split calendar it produces was unreachable.
 *
 * What these tests hold:
 * - an unanswered year stays unanswered. It is not coerced to „nu", and the derivation sees the absence,
 *   not a negative — the two lead art. 322 to different places.
 * - **nothing is persisted before the confirmation.** The single most important line here is the assertion
 *   that the profile is untouched after „da" and a month are chosen but before the confirm button is
 *   pressed. A single click must not apply a legal change (D-AIC-2).
 * - the three consequences are shown, with the 5-working-day mențiuni term and the period split taken from
 *   `aicMentiuniObligation` and `aicFlipForQuarter` rather than typed into the page.
 * - the month is asked and the quarter derived.
 * - the question is conditional, and each refusal says why.
 * - the consequence is shown on PG-6g's Form 300 panel, and Settings renders no second calendar.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { STORAGE_KEY, StoreProvider, useStore } from '../data/store';
import { CURRENT_DATA_VERSION } from '../data/migration';
import { seedData } from '../data/seed';
import Settings from './Settings';
import Declarations from './Declarations';
import { settings as settingsCopy } from '../ui/copy/settings';
import { getVatPeriodicity } from '../data/dashboard';
import { aicFlipForQuarter, aicMentiuniObligation } from '../domain/fiscal/vatReturn';
import { formatRoCalendarDate } from '../domain/date';
import type { FxRateRecord } from '../domain/fx/rates';

const aic = settingsCopy.fiscal.aic;

/**
 * The BNR rate the art. 322 cap is struck at — Normele pct. 103 alin. (2) ask for the rate „valabil
 * pentru data de 31 decembrie a anului precedent". The seed carries no rates on purpose, so a test that
 * needs the cap resolved has to record one; this is the same fixture `domain/fiscal/vatPeriodicity.test.ts`
 * and `pages/Declarations.test.tsx` use.
 */
const BNR_31_12_2025: FxRateRecord = {
  currency: 'EUR',
  rate: '5.0963',
  rateKind: 'daily_reference',
  rateDate: '2025-12-31',
  seriesCode: 'CURSZ_EUR',
  sourceUrl: 'https://www.bnr.ro/Cursul-de-schimb--7333.html',
  fetchedAt: '2026-01-02T08:00:00Z',
  provisional: false,
  entryMode: 'fetched',
};

function load(payload: Record<string, unknown>): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...seedData, version: CURRENT_DATA_VERSION, ...payload }),
  );
}

let storeRef: ReturnType<typeof useStore> | null = null;
function Probe() {
  storeRef = useStore();
  return null;
}

function renderFiscal() {
  return render(
    <StoreProvider>
      <Probe />
      <Settings initialTab="fiscal" />
    </StoreProvider>,
  );
}

function el(selector: string): Element | null {
  return document.querySelector(selector);
}

function text(selector: string): string {
  return (el(selector)?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function selectBy(selector: string, value: string): void {
  const node = el(selector);
  if (!node) throw new Error(`no control at ${selector}`);
  act(() => {
    fireEvent.change(node, { target: { value } });
  });
}

/** The stored year record for 2026, or `undefined` when the profile carries none. */
function year2026() {
  return (storeRef?.profile.vatPeriodicityYears ?? []).find((y) => y.year === 2026);
}

beforeEach(() => {
  localStorage.clear();
  storeRef = null;
});

describe('B-97 — the art. 322 alin. (7)-(8) question on Settings → Regim fiscal', () => {
  it('asks about goods bought in another EU country, with the technical term and the citation attached', () => {
    load({});
    renderFiscal();

    expect(el('[data-aic-block]')).not.toBeNull();
    // The question must be answerable by someone who knows only that they bought goods in the EU.
    expect(text('[data-aic-question]')).toContain('alt stat al Uniunii Europene');
    // …and the code's vocabulary stays attached to it, with the article that asks for the fact.
    expect(text('[data-aic-term]')).toContain('achiziție intracomunitară de bunuri');
    expect(text('[data-aic-term]')).toContain('art. 322 alin. (7) și (8)');
  });

  it('an unanswered year stays unanswered: the fact is absent, never „nu”', () => {
    load({});
    renderFiscal();

    // Nothing was written just by showing the question.
    expect(storeRef?.profile.vatPeriodicityYears).toBeUndefined();
    // The select sits on its third state, not on `nu`.
    expect((el('[data-aic-answer]') as HTMLSelectElement).value).toBe('');

    // And the arithmetic reads the same absence: art. 322 alin. (7) is not reported, and the year has not
    // been pushed to `month` by a negative nobody gave.
    const outcome = getVatPeriodicity(storeRef!);
    expect(outcome.branch).not.toBe('alin7');
  });

  it('answering „nu” records a checked negative, which is a different state from leaving it blank', () => {
    load({});
    renderFiscal();

    selectBy('[data-aic-answer]', 'nu');

    expect(year2026()?.aicGoodsWhileQuarterly).toBe('nu');
    expect(year2026()?.aicGoodsExigibilityMonth).toBeUndefined();
    // „nu” changes no fiscal period, so it needs no confirmation and mints no provenance record.
    expect(year2026()?.userChoice).toBeUndefined();
  });

  it('nothing is persisted before the confirmation is pressed', () => {
    load({});
    renderFiscal();

    selectBy('[data-aic-answer]', 'da');
    expect(storeRef?.profile.vatPeriodicityYears).toBeUndefined();

    selectBy('[data-aic-month]', '5');
    expect(storeRef?.profile.vatPeriodicityYears).toBeUndefined();

    // The consequences are on screen before any button is pressed.
    expect(el('[data-aic-effects]')).not.toBeNull();
    expect(text('[data-aic-pending]')).toContain('nu este salvat încă');

    act(() => {
      (el('[data-aic-review]') as HTMLButtonElement).click();
    });
    expect(el('[data-aic-confirm-go]')).not.toBeNull();
    // Opening the confirmation still writes nothing.
    expect(storeRef?.profile.vatPeriodicityYears).toBeUndefined();

    // Cancelling writes nothing either.
    act(() => {
      (el('[data-aic-confirm-cancel]') as HTMLButtonElement).click();
    });
    expect(storeRef?.profile.vatPeriodicityYears).toBeUndefined();
  });

  it('the saved fact carries confirmedBy: user and confirmedOn, exactly as PG-6g records a choice', () => {
    load({});
    renderFiscal();

    selectBy('[data-aic-answer]', 'da');
    selectBy('[data-aic-month]', '5');
    act(() => {
      (el('[data-aic-review]') as HTMLButtonElement).click();
    });
    act(() => {
      (el('[data-aic-confirm-go]') as HTMLButtonElement).click();
    });

    const record = year2026();
    expect(record?.aicGoodsWhileQuarterly).toBe('da');
    expect(record?.aicGoodsExigibilityMonth).toBe(5);
    expect(record?.userChoice?.confirmedBy).toBe('user');
    expect(record?.userChoice?.branch).toBe('alin7');
    expect(record?.userChoice?.confirmedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(record?.userChoice?.periodicity).toBe('month');
  });

  it('the confirmation names the three consequences, with the term and the split computed, not typed', () => {
    load({});
    renderFiscal();

    selectBy('[data-aic-answer]', 'da');
    selectBy('[data-aic-month]', '5');
    act(() => {
      (el('[data-aic-review]') as HTMLButtonElement).click();
    });

    expect(el('[data-aic-confirm-go]')).not.toBeNull();

    const body = Array.from(document.querySelectorAll('.modal-body li')).map((li) =>
      (li.textContent ?? '').replace(/\s+/g, ' ').trim(),
    );
    expect(body).toHaveLength(3);

    // 1. monthly, and which litera of alin. (7) says so.
    expect(body[0]).toContain('luna calendaristică');
    expect(body[0]).toContain('alin. (7) lit. b)');

    // 2. two deconturi where there was one quarter — the count comes from `aicFlipForQuarter`.
    const flip = aicFlipForQuarter(2026, 2, 5);
    expect(flip?.periods).toHaveLength(2);
    expect(body[1]).toContain('2 deconturi');

    // 3. the separate declarație de mențiuni, with the 5-working-day term `aicMentiuniObligation` counts.
    const mentiuni = aicMentiuniObligation({ year: 2026, monthOfExigibility: 5 });
    expect(mentiuni).not.toBeNull();
    expect(body[2]).toContain(formatRoCalendarDate(mentiuni!.dueOn));
    expect(body[2]).toContain('5 zile lucrătoare');
    expect(body[2]).toContain('declarație de mențiuni');
  });

  it('collects the month of exigibility as a month and derives the quarter from it', () => {
    load({});
    renderFiscal();

    selectBy('[data-aic-answer]', 'da');
    const monthSelect = el('[data-aic-month]') as HTMLSelectElement;
    const options = Array.from(monthSelect.options).map((o) => o.value);
    // Twelve months, no quarters: asking for the quarter invites an off-by-one the arithmetic cannot see.
    expect(options).toEqual(['', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);
    expect(Array.from(monthSelect.options).map((o) => o.textContent)).toContain('mai');

    selectBy('[data-aic-month]', '5');
    // The quarter is shown as a derivation of the month that was chosen.
    expect(text('[data-aic-quarter]')).toContain('T2');
  });

  it('does not ask a person outside the VAT register, and says why', () => {
    load({ profile: { ...seedData.profile, vatRegistration: { status: 'scutit_art310' } } });
    renderFiscal();

    expect(el('[data-aic-answer]')).toBeNull();
    expect(text('[data-aic-not-asked]')).toBe(aic.notAskedNotRegistered);
  });

  it('does not ask when the period is already the month, and says that too', () => {
    // `din oficiu` puts the year on `luna` by Norme pct. 103 alin. (1), so alin. (7) has nothing to flip.
    load({
      fxRates: [BNR_31_12_2025],
      profile: {
        ...seedData.profile,
        vatPeriodicityYears: [{ year: 2026, registrationRoute: 'din_oficiu' }],
      },
    });
    renderFiscal();

    expect(el('[data-aic-answer]')).toBeNull();
    expect(text('[data-aic-not-asked]')).toBe(aic.notAskedMonthly(2026));
  });

  it('asks when the registration state itself is unknown, but asks for that fact first', () => {
    load({ profile: { ...seedData.profile, vatRegistration: undefined } });
    renderFiscal();

    expect(el('[data-aic-answer]')).toBeNull();
    expect(text('[data-aic-not-asked]')).toBe(aic.notAskedRegistrationUnknown);
  });

  it('is a per-year fact: confirming 2026 writes nothing for 2027', () => {
    load({});
    renderFiscal();

    selectBy('[data-aic-answer]', 'da');
    selectBy('[data-aic-month]', '5');
    act(() => {
      (el('[data-aic-review]') as HTMLButtonElement).click();
    });
    act(() => {
      (el('[data-aic-confirm-go]') as HTMLButtonElement).click();
    });

    act(() => {
      storeRef?.updateProfile({ fiscalYear: 2027 });
    });

    const years = storeRef?.profile.vatPeriodicityYears ?? [];
    expect(years).toHaveLength(1);
    expect(years[0].year).toBe(2026);
    // The 2027 row is now unanswered on screen — the 2026 answer did not carry over.
    expect((el('[data-aic-answer]') as HTMLSelectElement).value).toBe('');
  });

  it('shows the consequence on PG-6g’s Form 300 panel and renders no second calendar on Settings', () => {
    load({});
    renderFiscal();

    selectBy('[data-aic-answer]', 'da');
    selectBy('[data-aic-month]', '5');
    act(() => {
      (el('[data-aic-review]') as HTMLButtonElement).click();
    });
    act(() => {
      (el('[data-aic-confirm-go]') as HTMLButtonElement).click();
    });

    // Settings links to the panel; it does not reproduce it. A second calendar here is the B-70 defect
    // class — two producers for one series.
    expect(document.querySelectorAll('[data-obligation-id]')).toHaveLength(0);
    expect(el('[data-aic-calendar-link]')?.getAttribute('href')).toBe('/declarations');
    expect(text('[data-aic-saved]')).toContain('al dumneavoastră');

    // The same fact, on the surface that already owns the calendar: the quarter is split and the mențiuni
    // row is there, dated by the domain rather than by this test.
    localStorage.clear();
    load({
      fxRates: [BNR_31_12_2025],
      profile: {
        ...seedData.profile,
        vatPeriodicityYears: [{
          year: 2026,
          aicGoodsWhileQuarterly: 'da',
          aicGoodsExigibilityMonth: 5,
          userChoice: {
            periodicity: 'month',
            branch: 'alin7',
            confirmedBy: 'user',
            confirmedOn: '2026-10-31',
          },
        }],
      },
    });
    render(
      <StoreProvider>
        <Declarations />
      </StoreProvider>,
    );

    expect(el('[data-obligation-id="mentiuni-aic-2026-05"]')).not.toBeNull();
    // The year is on months, not on quarters: alin. (7) moved the fiscal period, and the panel shows one
    // decont per closed month rather than one per quarter. (The partial-period split that lit. b) describes
    // is **not** rendered by `decontObligations` — it applies a flip only to a `quarter` period, and alin.
    // (7) has already set the periodicity to `month`. Recorded as a finding in the phase doc rather than
    // asserted here, because the fix belongs to the calendar, which this task must not touch.)
    expect(el('[data-obligation-id="decont-05.2026"]')).not.toBeNull();
    expect(el('[data-obligation-id="decont-06.2026"]')).not.toBeNull();
    expect(el('[data-obligation-id="decont-T2.2026"]')).toBeNull();
  });
});
