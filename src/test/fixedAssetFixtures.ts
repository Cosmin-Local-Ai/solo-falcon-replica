/**
 * PG-6e (B-31, D-FA-1) — synthetic fixed assets, the only place this repository writes one.
 *
 * **Everything in this file is synthetic.** The seed declares no asset at all (`data/seed.ts` says why: a
 * seeded asset would mint an entry into the patrimony, a *punerea în funcțiune* and a duration nobody
 * chose). A fixture that needs an asset builds one here, labelled, and the e2e specs and the unit tests
 * share it so the browser run and the unit run describe the same facts.
 *
 * The three assets are chosen to cover the three shapes the register can hold, and nothing else:
 *
 *  - `a1` — a complete, computed schedule: an M1 car whose amortisation runs into the 1.500 lei/lună
 *    ceiling, so the excess and the words „pierdut definitiv" are both on screen;
 *  - `a2` — a second M1 car, to prove the ceiling is **per vehicle** rather than one-per-taxpayer
 *    (`research/40` §4): two cars depreciate at once while only one can carry running costs;
 *  - `a3` — an asset with **no declared duration**, so the register shows a refusal naming the gap next to
 *    the two computed schedules. A surface that only ever renders success proves nothing about the refusal.
 *
 * The labels are deliberately non-descriptive („Mașina de test unu”) so no reader mistakes one for a real
 * vehicle, and no `m1ExceptionCategory` is claimed on any of them — claiming an exception is a legal
 * assertion, and `research/36` §12.6 records that no evidencing rule exists for those categories.
 *
 * This module imports nothing from `vitest` or `@playwright/test`, so both the unit suite and the e2e
 * specs can use it.
 */
import type { FixedAsset } from '../data/types';
import { lei } from '../domain/money';

/** A complete M1 schedule that exceeds the art. 28 alin. (14) monthly ceiling. */
export const SYNTHETIC_ASSET_M1: FixedAsset = {
  id: 'a1',
  label: 'Mașina de test unu',
  entryDate: '2026-01-20',
  putInFunctionDate: '2026-01-31',
  // 120.000 lei over 24 months is 5.000 lei/lună — over the 1.500 lei ceiling every month.
  fiscalValue: lei(120000),
  normalLifeMonths: 24,
  method: 'liniar',
  acquisition: 'cumparare',
  paymentState: 'achitat',
  paidOn: '2026-01-21',
  isM1Vehicle: true,
};

/** A second M1 car: the ceiling applies to each, and neither is the other's substitute. */
export const SYNTHETIC_ASSET_M1_SECOND: FixedAsset = {
  id: 'a2',
  label: 'Mașina de test doi',
  entryDate: '2026-02-10',
  putInFunctionDate: '2026-02-28',
  fiscalValue: lei(96000),
  normalLifeMonths: 24,
  method: 'liniar',
  acquisition: 'cumparare',
  paymentState: 'achitat',
  paidOn: '2026-02-11',
  isM1Vehicle: true,
};

/** No declared duration: pct. 27 leaves the duration with the taxpayer, so this one refuses. */
export const SYNTHETIC_ASSET_INCOMPLETE: FixedAsset = {
  id: 'a3',
  label: 'Utilaj de test fără durată',
  entryDate: '2026-03-05',
  putInFunctionDate: '2026-03-15',
  fiscalValue: lei(40000),
  acquisition: 'cumparare',
  paymentState: 'achitat',
  paidOn: '2026-03-06',
};

export const SYNTHETIC_FIXED_ASSETS: readonly FixedAsset[] = [
  SYNTHETIC_ASSET_M1,
  SYNTHETIC_ASSET_M1_SECOND,
  SYNTHETIC_ASSET_INCOMPLETE,
];
