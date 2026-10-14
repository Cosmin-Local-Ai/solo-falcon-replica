/**
 * PG-6h-3 (D-OCC-1) — the ONLY place this repository writes a guest name or a guest identifier.
 *
 * **Everything in this file is synthetic.** The occupancy sheet records real people, so a fixture that
 * carried a plausible identity would be a fabricated person sitting inside a shipped bundle and inside
 * every e2e run. Two rules make that provable rather than intended:
 *
 * 1. **A synthetic CNP must fail the CNP check digit.** The check digit is the one property that would
 *    let a 13-digit string be somebody's actual CNP, so every fixture value is chosen not to satisfy it.
 *    `src/data/occupancy.privacy.test.tsx` recomputes the digit over every CNP-shaped literal in the
 *    occupancy fixtures and fails if any of them validates — the acceptance-2 grep, written as a test so
 *    it cannot rot.
 * 2. **A synthetic value must also carry an impossible birth date**, so it fails on face value as well as
 *    on arithmetic. `9000000000001` reads as birth date `00-00-0000`, which no register contains.
 *
 * The names are the ones the rest of the repository already uses for demo people (Enache, Barbu), so a
 * reader who spots a name in a diff immediately knows which fixture it came from.
 *
 * This module imports nothing from `vitest` or `@playwright/test`, so both the unit suite and the e2e
 * specs can use it — the same reason `e2e/fixtures.ts` is careful about what it pulls in.
 */
import type { OccupancySheet, OccupancyStay } from '../data/types';

/**
 * Synthetic. Fails the CNP check digit (mask sum 18 → expected digit 7, not 1) and carries an impossible
 * birth date. It cannot be any real person's CNP.
 */
export const SYNTHETIC_CNP_A = '9000000000001';

/**
 * Synthetic, second value for tests that need two guests on one form. Mask sum 27 → expected digit 5, not
 * 2; birth date `00-00-0000`. Also cannot be real.
 */
export const SYNTHETIC_CNP_B = '2000000000002';

/**
 * Synthetic. A foreign guest with no CNP: the order asks for „seria și numărul actului de identitate” in
 * that case, and this is a series-and-number that is not a real document number.
 */
export const SYNTHETIC_ID_DOC = 'XX 000000';

/** One synthetic stay, first form. */
export const SYNTHETIC_STAY_A: OccupancyStay = {
  id: 'stay-synthetic-1',
  guestName: 'Enache Sorin (synthetic)',
  guestIdentifier: SYNTHETIC_CNP_A,
  identifierKind: 'cnp',
  firstDay: '2026-03-04',
  lastDay: '2026-03-07',
};

/** A second synthetic stay, so a form can be shown with more than one row. */
export const SYNTHETIC_STAY_B: OccupancyStay = {
  id: 'stay-synthetic-2',
  guestName: 'Barbu Cristina (synthetic)',
  guestIdentifier: SYNTHETIC_CNP_B,
  identifierKind: 'cnp',
  firstDay: '2026-08-01',
  lastDay: '2026-08-02',
};

/** A stay recorded with an identity document instead of a CNP — the order's second case. */
export const SYNTHETIC_STAY_ID_DOC: OccupancyStay = {
  id: 'stay-synthetic-3',
  guestName: 'Guest Without CNP (synthetic)',
  guestIdentifier: SYNTHETIC_ID_DOC,
  identifierKind: 'act_de_identitate',
  firstDay: '2026-05-10',
  lastDay: '2026-05-10',
};

/**
 * A whole synthetic form: one room, one year, two stays. The address is a street that does not resolve to
 * a real building number in this app's own fixtures, and the room label says what it is.
 */
export const SYNTHETIC_SHEET: OccupancySheet = {
  id: 'sheet-synthetic-1',
  fiscalYear: 2026,
  propertyAddress: 'Str. Exemplu nr. 1, Cluj-Napoca (synthetic)',
  roomLabel: 'Camera 1 (synthetic)',
  stays: [SYNTHETIC_STAY_A, SYNTHETIC_STAY_B],
};

/**
 * The CNP check-digit weights, in order, for the first twelve digits. Reproduced here so the privacy test
 * can prove its own fixtures are fake — **the application itself never validates a CNP**, because the app
 * records what the taxpayer recorded and has no authority to correct a document it did not issue.
 */
export const CNP_CHECK_DIGIT_WEIGHTS = [2, 7, 9, 1, 4, 6, 3, 5, 8, 2, 7, 9] as const;

/**
 * True when `value` would pass the CNP check digit. Test-only.
 *
 * If this ever returns true for a fixture value, that value is a plausible real CNP and must be replaced.
 */
export const cnpCheckDigitValid = (value: string): boolean => {
  if (!/^[0-9]{13}$/.test(value)) return false;
  const digits = value.split('').map(Number);
  const sum = CNP_CHECK_DIGIT_WEIGHTS.reduce((acc, w, i) => acc + w * digits[i], 0);
  const expected = sum % 11 === 10 ? 1 : sum % 11;
  return expected === digits[12];
};
