import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FxRateProvenance } from './FxRateProvenance';
import { copy } from '../../ui/copy';
import type { FxRateRecord } from '../../domain/fx/rates';

/**
 * TASK 10a — the rate record on screen.
 *
 * The properties worth asserting are the ones a plain table would get wrong:
 *
 * - **provenance is always visible** (BNR's licence requires the source to be indicated, and a conversion
 *   the user cannot trace is a conversion they cannot defend);
 * - **no internal token reaches the screen** — `daily_reference` and `fetched` are codes, and TASK 7's
 *   guard exists precisely because an enum once served as a dropdown label;
 * - **each uncertainty gets its own note, and no note resolves it** — the carry-forward in particular must
 *   read as an app policy by analogy, never as a statute.
 */

const daily: FxRateRecord = {
  currency: 'EUR',
  rate: '5.3470',
  rateKind: 'daily_reference',
  rateDate: '2026-10-08',
  seriesCode: 'CURSZ_EUR',
  sourceUrl: 'https://curs.bnr.ro/nbrfxrates.xml',
  fetchedAt: '2026-10-08T13:05:00Z',
  provisional: false,
  entryMode: 'fetched',
};

/**
 * A rate used for a date BNR has no row for. `stampCarriedFrom` sets `carriedFrom` to the record's own
 * published date, so both fields name the same day — the Friday whose rate answers for the weekend.
 */
const carried: FxRateRecord = {
  ...daily,
  rateDate: '2026-10-02',
  rate: '5.3410',
  carriedFrom: '2026-10-02',
};

const provisionalAverage: FxRateRecord = {
  currency: 'EUR',
  rate: '5.3100',
  rateKind: 'annual_average',
  rateYear: 2026,
  seriesCode: 'CURSA_EURM',
  sourceUrl: 'https://www.bnr.ro/1975-cursul-de-schimb-serii-statistice',
  fetchedAt: '2026-10-09T09:00:00Z',
  provisional: true,
  entryMode: 'manual',
};

describe('FxRateProvenance', () => {
  it('names the rate, the series and how it got here', () => {
    render(<FxRateProvenance records={[daily]} />);
    expect(screen.getByText('5.3470')).toBeTruthy();
    expect(screen.getByText('CURSZ_EUR')).toBeTruthy();
    expect(screen.getByText(copy.fx.entryModeLabels.fetched)).toBeTruthy();
    expect(screen.getByText(copy.fx.rateKindLabels.daily_reference)).toBeTruthy();
    // The published date is shown in the app's date format, keyed to the day the rule asks about.
    expect(screen.getByText('08.10.2026')).toBeTruthy();
  });

  it('never prints the internal codes as cells', () => {
    const { container } = render(<FxRateProvenance records={[daily, provisionalAverage]} />);
    const text = container.textContent ?? '';
    expect(text).not.toContain('daily_reference');
    expect(text).not.toContain('annual_average');
    // A substring test cannot settle this one: the Romanian label for a manual entry is „introdus
    // manual”, which legitimately contains the word. So the honest check is on the cells themselves —
    // no cell may BE the enum value.
    const cells = Array.from(container.querySelectorAll('td')).map((td) => (td.textContent ?? '').trim());
    for (const code of ['fetched', 'manual']) {
      expect(cells).not.toContain(code);
    }
    // …and the Romanian labels do appear in their place.
    expect(text).toContain(copy.fx.rateKindLabels.annual_average);
    expect(text).toContain(copy.fx.entryModeLabels.manual);
    expect(text).toContain(copy.fx.entryModeLabels.fetched);
  });

  it('marks a current-year average provisional, and says why in a note', () => {
    render(<FxRateProvenance records={[provisionalAverage]} />);
    expect(screen.getByText(copy.fx.provisionalBadge)).toBeTruthy();
    expect(screen.getByText(copy.notes.fxProvisionalAnnual)).toBeTruthy();
    // The year, not a date — an annual average is keyed to a year.
    expect(screen.getByText('2026')).toBeTruthy();
  });

  it('shows the final badge for a settled rate and no provisional note', () => {
    const { container } = render(<FxRateProvenance records={[daily]} />);
    expect(screen.getByText(copy.fx.finalBadge)).toBeTruthy();
    expect(container.textContent).not.toContain(copy.notes.fxProvisionalAnnual);
  });

  it('names the date a carried rate was actually taken from', () => {
    render(<FxRateProvenance records={[carried]} />);
    // The record stores the date it was taken from; the date that was asked for belongs to the
    // conversion, not to the record. Showing the used date is what keeps the substitution visible.
    expect(screen.getByText(/02\.10\.2026/)).toBeTruthy();
    // The substitution sentence and the note about it render inside one `InterpretationNote`, so the
    // assertion is on that element's text rather than on a standalone node.
    const note = document.querySelector('[data-note="interpretare"]');
    expect(note?.textContent ?? '').toContain(copy.fx.carriedFrom('2026-10-02'));
  });

  it('labels the carry-forward as app policy by analogy, and cites the articles it is borrowed from', () => {
    const { container } = render(<FxRateProvenance records={[carried]} />);
    const note = container.querySelector('[data-note="interpretare"]');
    expect(note).toBeTruthy();
    const text = note?.textContent ?? '';
    expect(text).toContain(copy.notes.fxCarryForward);
    // The citation is present so the borrowing is traceable — but the note itself is what says this is an
    // analogy, so the citation cannot read as the rule that governs an income-tax conversion.
    expect(text).toContain('art. 68^3 alin. (4)');
    expect(text).toContain('politică a aplicației');
  });

  it('always states the unresolved conversion-rule conflict, even with no rates recorded', () => {
    const { container } = render(<FxRateProvenance records={[]} />);
    const notes = Array.from(container.querySelectorAll('[data-note="interpretare"]'));
    const text = notes.map((n) => n.textContent ?? '').join(' ');
    expect(text).toContain(copy.notes.fxConversionConflict);
    expect(text).toContain('HG 1/2016');
    expect(text).toContain('art. 9 alin. (3) lit. b)');
  });

  it('shows an honest empty state rather than an empty table', () => {
    render(<FxRateProvenance records={[]} />);
    expect(screen.getByText(copy.fx.empty)).toBeTruthy();
  });

  it('renders no row for a currency that was never recorded', () => {
    const { container } = render(<FxRateProvenance records={[daily]} />);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
  });
});
