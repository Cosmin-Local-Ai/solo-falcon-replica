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
 *    **B-111:** until Step 11 Part D this file computed `sum % 11` (10 → 1), which is the CUI rule, not the
 *    CNP rule. The canonical CNP control digit is `(sum % 11) * 10 % 11` (10 → 1). The two synthetic values
 *    below fail under both formulations, so no fixture was ever exposed; what the wrong rule did was let
 *    three suites certify fixtures as "not a real person" using a key that the real key does not honour.
 *    `src/data/seed.identityHygiene.test.ts` reports which literals the corrected rule reclassifies.
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
 * Synthetic. Fails the canonical CNP control digit (weighted sum 18 → `(18 % 11) * 10 % 11` = 4, and the
 * value carries 1) and carries an impossible birth date. It cannot be any real person's CNP.
 */
export const SYNTHETIC_CNP_A = '9000000000001';

/**
 * Synthetic, second value for tests that need two guests on one form. Weighted sum 4 → control digit 7,
 * and the value carries 2; birth date `00-00-0000`. Also cannot be real.
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
 * The canonical CNP control digit: `(sum % 11) * 10 % 11`, with 10 → 1.
 *
 * B-111. The previous spelling here was `sum % 11 === 10 ? 1 : sum % 11`, which is the **CUI** rule. It is
 * not a looser version of the CNP rule: the two map the residue to different digits, so a value can satisfy
 * one and not the other. That matters because this helper is the guard three suites use to prove their
 * fixtures are not real people — under the CUI rule it was answering a different question.
 *
 * Exported rather than kept private because `seed.identityHygiene.test.ts` and `personas.test.ts` each had
 * their own copy of the canonical formula. Three spellings of one arithmetic idea is how one of them stayed
 * wrong for as long as this one did.
 */
export const cnpControlDigit = (value: string): number => {
  const digits = value.split('').map(Number);
  const sum = CNP_CHECK_DIGIT_WEIGHTS.reduce((acc, w, i) => acc + w * digits[i], 0);
  const rest = (sum % 11) * 10 % 11;
  return rest === 10 ? 1 : rest;
};

/**
 * True when `value` would pass the CNP check digit. Test-only.
 *
 * If this ever returns true for a fixture value, that value is a plausible real CNP **on arithmetic** and
 * must be excused by structure or replaced. Arithmetic alone is not enough to make a CNP real — see
 * `cnpBirthDatePlausible` — and it has not been enough for the seed fixture since B-110.
 */
export const cnpCheckDigitValid = (value: string): boolean => {
  if (!/^[0-9]{13}$/.test(value)) return false;
  return cnpControlDigit(value) === Number(value[12]);
};

/**
 * True when the CNP decodes to a birth date a civil register could contain.
 *
 * The other half of "could this be a real person". A value that satisfies the control digit but decodes to
 * month 45 or day 67 cannot belong to anyone, which is the distinction the seed fixture rests on and which
 * B-111 had to leave standing.
 */
export const cnpBirthDatePlausible = (value: string): boolean => {
  if (!/^[0-9]{13}$/.test(value)) return false;
  const sex = Number(value[0]);
  if (sex < 1 || sex > 9) return false;
  const year = 1900 + Number(value.slice(1, 3));
  const month = Number(value.slice(3, 5));
  const day = Number(value.slice(5, 7));
  if (month < 1 || month > 12) return false;
  const daysInMonth = new Date(year, month, 0).getDate();
  return day >= 1 && day <= daysInMonth;
};

/**
 * A CNP is real-looking only when BOTH the canonical arithmetic and the decoded birth date hold. Either
 * half failing is enough for a fixture to be provably not a person.
 */
export const cnpLooksReal = (value: string): boolean =>
  /^[0-9]{13}$/.test(value) && cnpCheckDigitValid(value) && cnpBirthDatePlausible(value);
