/**
 * PG-6e (D-FA-2) — the two retained documents the fixed-asset register owes, generated from the register.
 *
 * **Generated, not stored.** The Registru-inventar (cod 14-1-2/b) and the Fișa mijlocului fix (cod 14-2-2)
 * are produced from the asset facts on demand. They are *not* separate records on `AppData`, and that is a
 * deliberate choice rather than an omission: a stored copy of a derived document is a second place the
 * depreciation figures live, and it drifts the moment an asset fact is corrected. The facts the documents
 * are made of already live on `AppData` — which is where they must live, for the reason `occupancySheets`
 * records in `data/types.ts`: `snapshots/snapshot.ts` canonicalises the profile into `inputsHash`, so a
 * register carried on the profile would move a stored fiscal digest and survive the asset's own deletion.
 *
 * **Retention, not filing.** Neither document is submitted anywhere. OMFP 170/2015 cap. III pct. 9 names
 * the Registru-inventar as one of the registers a partidă simplă taxpayer keeps, and cap. III pct. 17 names
 * the Fișa mijlocului fix as the way imobilizările corporale are evidenced. Both are kept by the taxpayer.
 *
 * **The retention figures are the current ones.** The 10-year rule people remember was abrogated by OMF
 * nr. 1.447 din 2 mai 2023 (MO nr. 453 din 24 mai 2023, art. II pct. 2), which introduced cap. IV pct. 1¹
 * and abrogated pct. 2-4. `docs/ai/research/36_fixed_assets_and_depreciation_2026.md` §14 records the
 * conflict and its resolution; §14.3 records that the fișa's own retention is **inferred**, and
 * `retentionFor` below labels it as such rather than presenting it as a quoted rule.
 */
import { assets as assetsCopy } from '../ui/copy/assets';
import type { FixedAsset } from './types';
import type { FiscalRule } from '../domain/fiscal/rules';
import {
  depreciationSchedule,
  type DepreciationYear,
} from '../domain/fiscal/depreciation';
import { formatBani, subBani, sumBani } from '../domain/money';

/**
 * How long one of these documents has to be kept.
 *
 * `usefulLife` is the alin. (2) case: a document that attests the provenance of a good whose viață utilă
 * exceeds 5 ani is kept for that whole useful life, not for 5 ani. `fiveYears` is the alin. (1) case,
 * counted from 1 July of the year following the exercise in which the document was made.
 */
export type Retention =
  | { kind: 'fiveYears' }
  | { kind: 'usefulLife'; years: number };

/**
 * The retention that applies to the fișa of one asset.
 *
 * The trigger is the **declared** duration, never a Catalog class — pct. 27 puts the duration with the
 * taxpayer, and no Catalog is encoded anywhere in this application. An asset with no declared duration has
 * no computable useful life, so it falls back to the alin. (1) floor rather than to an invented one.
 *
 * The fișa itself is not listed among the registre obligatorii of cap. III pct. 9, so this figure is
 * **inferred** from pct. 17 plus the cap. V nomenclature — see `research/36` §14.3.
 */
export function retentionFor(asset: FixedAsset): Retention {
  if (asset.normalLifeMonths === undefined) return { kind: 'fiveYears' };
  if (asset.normalLifeMonths <= 60) return { kind: 'fiveYears' };
  // Whole years, rounded up: a 78-month life is kept through its 7th year, not stopped at 6.
  return { kind: 'usefulLife', years: Math.ceil(asset.normalLifeMonths / 12) };
}

/** The sentence that states a retention, with the inference labelled where it is one. */
export function retentionText(r: Retention): string {
  return r.kind === 'fiveYears'
    ? assetsCopy.documents.retentionLine.replace('{years}', '5')
    : assetsCopy.documents.retentionLineUsefulLife;
}

/**
 * A CSV cell. The separator here is `;` — the Romanian locale writes decimals with a comma, so a comma
 * must **not** trigger quoting; only the separator itself, a quote or a newline may.
 */
function cell(value: string | number | undefined): string {
  const s = value === undefined ? '' : String(value);
  return /[\";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const row = (cells: (string | number | undefined)[]): string => cells.map(cell).join(';');

/**
 * The file shape the RJIP register and the occupancy sheet already use: a UTF-8 BOM and CRLF endings.
 * The reader is Romanian Excel, which opens a `;`-separated file with diacritics correctly only with the
 * BOM present. A document the taxpayer cannot open is not a retained document.
 */
const file = (lines: string[]): string => '\uFEFF' + lines.join('\r\n');

/**
 * The Registru-inventar listing (cod 14-1-2/b).
 *
 * The columns follow the model's own instruction — cap. V: „În coloana 3 se inscrie valoarea de inventar
 * reprezentată de: valoarea de intrare a elementelor patrimoniale inventariate, potrivit documentelor
 * justificative”. For a depreciable element the register also carries the depreciation „calculată potrivit
 * legislației fiscale”, which is what `depreciationSchedule` produces; where the schedule refuses, the
 * depreciation columns are left **empty** rather than filled with a figure the law does not yet give.
 */
export function inventoryRegisterCsv(assets: readonly FixedAsset[], rule: FiscalRule): string {
  const lines = [assetsCopy.documents.csvHeader];
  for (const a of [...assets].sort((x, y) => x.entryDate.localeCompare(y.entryDate))) {
    const out = depreciationSchedule(rule, a);
    const years: DepreciationYear[] = out.status === 'computed' ? out.years : [];
    const accumulated = sumBani(years.map(y => y.uncapped));
    const remaining = years.length > 0 ? subBani(a.fiscalValue, accumulated) : undefined;
    lines.push(row([
      a.label,
      a.entryDate,
      a.putInFunctionDate,
      formatBani(a.fiscalValue),
      formatBani(a.fiscalValue),
      a.normalLifeMonths,
      a.method,
      years.length > 0 ? formatBani(accumulated) : undefined,
      remaining === undefined ? undefined : formatBani(remaining),
    ]));
  }
  return file(lines);
}

/**
 * The Fișa mijlocului fix (cod 14-2-2) for one asset: one row per amortisation year, which is the shape
 * the fișa is kept in — it is the per-asset evidence, not a summary.
 *
 * A refusal is not rendered as a fiche with zeroes. If the schedule refuses, the fiche carries the facts
 * that were declared and stops; the gap is stated on screen, not written into a document.
 */
export function assetFicheCsv(asset: FixedAsset, rule: FiscalRule): string {
  const out = depreciationSchedule(rule, asset);
  const head = row([
    asset.label,
    assetsCopy.documents.ficheCode,
    asset.entryDate,
    asset.putInFunctionDate,
    asset.acquisition,
    formatBani(asset.fiscalValue),
    asset.nonDeductibleVatIncluded === undefined ? undefined : formatBani(asset.nonDeductibleVatIncluded),
    asset.method,
    asset.normalLifeMonths,
  ]);
  const lines = [assetsCopy.documents.ficheCsvHeader, head];
  if (out.status !== 'computed') return file(lines);
  let remaining = asset.fiscalValue;
  for (const y of out.years) {
    remaining = subBani(remaining, y.uncapped);
    lines.push(row([
      asset.label,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      y.fiscalYear,
      y.months,
      formatBani(y.uncapped),
      formatBani(y.deductible),
      y.lost > 0 ? formatBani(y.lost) : undefined,
      formatBani(remaining),
    ]));
  }
  return file(lines);
}
