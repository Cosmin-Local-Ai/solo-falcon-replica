/**
 * PG-6h-3 (D-OCC-1) — the occupancy sheet renders, exports on an explicit act, and flags without blocking.
 *
 * Acceptance 1 is the headline: **a sheet exists per room per year with the fields the order specifies,
 * and a test renders one with synthetic guest data.** Every guest value here comes from
 * `src/test/occupancyFixtures.ts`, where each CNP is chosen to fail the CNP check digit so it cannot be a
 * real person's.
 *
 * The three behaviours that make this page different from every other table in the app get their own
 * tests, because each is a sentence a reader would otherwise get wrong: it is not a filing, deleting it
 * does not discharge the duty, and the identifier is recorded rather than corrected.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Documents, { occupancyCsv } from './Documents';
import { StoreProvider } from '../data/store';
import { seedStorage } from '../test/storage';
import { seedData } from '../data/seed';
import { occupancy as occupancyCopy } from '../ui/copy';
import { SHORT_TERM_LET_MAX_DAYS } from '../data/types';
import {
  SYNTHETIC_CNP_A, SYNTHETIC_CNP_B, SYNTHETIC_SHEET, SYNTHETIC_STAY_ID_DOC,
} from '../test/occupancyFixtures';

function renderSheet(payload: unknown = { ...seedData, occupancySheets: [SYNTHETIC_SHEET] }) {
  seedStorage(payload);
  return render(<Documents initialTab="occupancy" />);
}

/** Renders the page inside the store, the way the app does. */
function renderOccupancy(payload: unknown = { ...seedData, occupancySheets: [SYNTHETIC_SHEET] }) {
  seedStorage(payload);
  return render(
    <StoreProvider>
      <Documents initialTab="occupancy" />
    </StoreProvider>,
  );
}

describe('occupancyCsv — the taxpayer\'s own copy, as a file', () => {
  it('carries the order\'s fields, one row per stay', () => {
    const lines = occupancyCsv(SYNTHETIC_SHEET).split('\r\n');
    expect(lines[0]).toBe('\uFEFF' + occupancyCopy.export.csvHeader);
    // header + two stays
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain(String(SYNTHETIC_SHEET.fiscalYear));
    expect(lines[1]).toContain(`"${SYNTHETIC_SHEET.propertyAddress}"`);
    expect(lines[1]).toContain(`"${SYNTHETIC_SHEET.roomLabel}"`);
    expect(lines[1]).toContain(SYNTHETIC_STAY_A_NAME);
    expect(lines[1]).toContain(SYNTHETIC_CNP_A);
    expect(lines[1]).toContain(SYNTHETIC_SHEET.stays[0].firstDay);
    expect(lines[1]).toContain(SYNTHETIC_SHEET.stays[0].lastDay);
  });

  it('uses the same file shape the RJIP register uses, because Romanian Excel is the reader', () => {
    const csv = occupancyCsv(SYNTHETIC_SHEET);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('\r\n');
    expect(csv.split('\r\n')[1]!.split(';').length).toBe(8);
  });

  it('quotes every free-text field, because an address contains a comma and a name may hold a semicolon', () => {
    const csv = occupancyCsv({
      ...SYNTHETIC_SHEET,
      propertyAddress: 'Str. Exemplu, nr. 1; bl. A',
    });
    expect(csv).toContain('"Str. Exemplu, nr. 1; bl. A"');
  });

  it('has no money column at all — the sheet is not a revenue source', () => {
    const header = occupancyCsv(SYNTHETIC_SHEET).split('\r\n')[0]!;
    for (const forbidden of ['RON', 'lei', 'venit', 'impozit', 'CASS', 'CAS']) {
      expect(header.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it('names the identifier kind, so a CNP and an ID number are not confused in the file', () => {
    const csv = occupancyCsv({ ...SYNTHETIC_SHEET, stays: [SYNTHETIC_STAY_ID_DOC] });
    expect(csv).toContain(occupancyCopy.form.identifierKindId);
    expect(csv).toContain(SYNTHETIC_STAY_ID_DOC.guestIdentifier);
  });
});

const SYNTHETIC_STAY_A_NAME = SYNTHETIC_SHEET.stays[0].guestName;

describe('the occupancy tab — the sheet on screen', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders one form per room per year, with the fields the order specifies', async () => {
    renderOccupancy();
    await waitFor(() => expect(screen.getByTestId('occ-sheet-heading')).toBeInTheDocument());
    expect(screen.getByTestId('occ-sheet-heading').textContent)
      .toBe(occupancyCopy.form.sheetHeading(SYNTHETIC_SHEET.fiscalYear, SYNTHETIC_SHEET.roomLabel));
    expect(screen.getByTestId('occ-sheet-address').textContent)
      .toContain(SYNTHETIC_SHEET.propertyAddress);
    // Secțiunea II, with a row per stay.
    expect(screen.getByText(SYNTHETIC_SHEET.stays[0].guestName)).toBeInTheDocument();
    expect(screen.getByText(SYNTHETIC_SHEET.stays[1].guestName)).toBeInTheDocument();
    expect(screen.getByText(SYNTHETIC_CNP_A)).toBeInTheDocument();
    expect(screen.getByText(SYNTHETIC_CNP_B)).toBeInTheDocument();
    expect(screen.getByText(SYNTHETIC_SHEET.stays[0].firstDay)).toBeInTheDocument();
    expect(screen.getByText(SYNTHETIC_SHEET.stays[0].lastDay)).toBeInTheDocument();
  });

  it('states, in Romanian, that this is the taxpayer\'s own retained copy and that nothing is filed', () => {
    renderOccupancy();
    const retention = screen.getByTestId('occ-retention');
    expect(retention.textContent).toContain('păstreaz');
    expect(retention.textContent).toContain('ANAF');
    // The order is cited by its real number, never by the abrogated one.
    expect(document.body.textContent).toContain('381/2026');
    expect(document.body.textContent).not.toContain('398/2021');
  });

  it('says plainly that deleting here does not discharge the obligation', () => {
    renderOccupancy();
    expect(document.body.textContent).toContain(occupancyCopy.retention.deletion);
  });

  it('offers the sheet regardless of the fiscal title, because both beneficiary groups owe it', () => {
    // The seed profile declares `activityFamily: 'other'` and no room count, so no accommodation fact is
    // known at all. The sheet is still reachable — gating it on a title the app could not resolve would
    // refuse the likeliest person who needs it.
    renderOccupancy({ ...seedData, occupancySheets: [] });
    expect(screen.getByTestId('occ-add-sheet')).toBeInTheDocument();
    expect(screen.getByTestId('occ-scope').textContent).toContain('1–7');
  });

  it('carries the order\'s definitional rule beside the data, with the citation', () => {
    renderOccupancy();
    expect(screen.getByTestId('occ-definition').textContent).toContain('30 de zile');
    expect(document.body.textContent).toContain('fracțiune de zi');
  });
});

describe('the occupancy tab — flags that never block', () => {
  it('flags a CNP-shaped gap but keeps the value the taxpayer typed', async () => {
    const typoed = {
      ...SYNTHETIC_SHEET,
      stays: [{ ...SYNTHETIC_STAY_ID_DOC, identifierKind: 'cnp' as const, guestIdentifier: '12345' }],
    };
    renderOccupancy({ ...seedData, occupancySheets: [typoed] });
    expect(screen.getByTestId('occ-suspect')).toBeInTheDocument();
    // Recorded, not repaired and not refused.
    expect(screen.getByText('12345')).toBeInTheDocument();
  });

  it('does not flag an identity document, which is the order\'s second case and has no CNP shape', () => {
    renderOccupancy({ ...seedData, occupancySheets: [{ ...SYNTHETIC_SHEET, stays: [SYNTHETIC_STAY_ID_DOC] }] });
    expect(screen.queryByTestId('occ-suspect')).toBeNull();
  });

  it('flags a stay longer than the order\'s 30-day definition, and still shows it', () => {
    const long = {
      ...SYNTHETIC_SHEET,
      stays: [{
        ...SYNTHETIC_STAY_ID_DOC,
        firstDay: '2026-01-01',
        lastDay: `2026-03-01`,
      }],
    };
    renderOccupancy({ ...seedData, occupancySheets: [long] });
    const flag = screen.getByTestId('occ-over-ceiling');
    expect(flag.textContent).toContain(String(SHORT_TERM_LET_MAX_DAYS));
    expect(screen.getByText('2026-03-01')).toBeInTheDocument();
  });

  it('leaves a stay inside the ceiling unflagged', () => {
    renderOccupancy();
    expect(screen.queryAllByTestId('occ-over-ceiling')).toHaveLength(0);
  });
});

describe('the occupancy tab — writing and deleting', () => {
  it('creates a form with the three Secțiunea I / II identity fields', async () => {
    renderOccupancy({ ...seedData, occupancySheets: [] });
    await userEvent.click(screen.getByTestId('occ-add-sheet'));
    await userEvent.type(screen.getByTestId('occ-field-propertyAddress'), 'Str. Exemplu 2');
    await userEvent.type(screen.getByTestId('occ-field-roomLabel'), 'Camera 3');
    await userEvent.click(screen.getByTestId('occ-save-sheet'));
    await waitFor(() => expect(screen.getByTestId('occ-sheet-heading')).toBeInTheDocument());
    expect(screen.getByTestId('occ-sheet-heading').textContent).toContain('Camera 3');
  });

  it('refuses an empty form with a sentence, not a silent no-op', async () => {
    renderOccupancy({ ...seedData, occupancySheets: [] });
    await userEvent.click(screen.getByTestId('occ-add-sheet'));
    await userEvent.click(screen.getByTestId('occ-save-sheet'));
    expect(screen.getByText(occupancyCopy.validation.addressRequired)).toBeInTheDocument();
    expect(screen.queryByTestId('occ-sheet-heading')).toBeNull();
  });

  it('adds a stay and shows it on the form', async () => {
    renderOccupancy();
    await userEvent.click(screen.getByTestId('occ-add-stay'));
    await userEvent.type(screen.getByTestId('occ-stay-guestName'), 'Guest Synthetic');
    await userEvent.type(screen.getByTestId('occ-stay-guestIdentifier'), SYNTHETIC_CNP_A);
    await userEvent.type(screen.getByTestId('occ-stay-firstDay'), '2026-07-01');
    await userEvent.type(screen.getByTestId('occ-stay-lastDay'), '2026-07-03');
    await userEvent.click(screen.getByTestId('occ-save-stay'));
    await waitFor(() => expect(screen.getByText('Guest Synthetic')).toBeInTheDocument());
  });

  it('rejects a stay whose last day precedes its first, and says why', async () => {
    renderOccupancy();
    await userEvent.click(screen.getByTestId('occ-add-stay'));
    await userEvent.type(screen.getByTestId('occ-stay-guestName'), 'Guest Synthetic');
    await userEvent.type(screen.getByTestId('occ-stay-guestIdentifier'), SYNTHETIC_CNP_A);
    await userEvent.type(screen.getByTestId('occ-stay-firstDay'), '2026-07-05');
    await userEvent.type(screen.getByTestId('occ-stay-lastDay'), '2026-07-01');
    await userEvent.click(screen.getByTestId('occ-save-stay'));
    expect(screen.getByText(occupancyCopy.validation.dateOrder)).toBeInTheDocument();
    expect(screen.queryByText('Guest Synthetic')).toBeNull();
  });

  it('asks before deleting a form, and the confirmation repeats that the duty survives', async () => {
    renderOccupancy();
    await userEvent.click(screen.getByTestId('occ-delete-sheet'));
    expect(screen.getByTestId('occ-confirm-delete')).toBeInTheDocument();
    expect(document.body.textContent).toContain(occupancyCopy.retention.deletion);
    act(() => {});
    await userEvent.click(screen.getByTestId('occ-confirm-delete'));
    await waitFor(() => expect(screen.queryByTestId('occ-sheet-heading')).toBeNull());
  });
});
