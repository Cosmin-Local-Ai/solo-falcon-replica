/**
 * PG-6e (D-FA-2) — the two retained documents, and the retention figures they carry.
 *
 * The retention sentences are the ones that are **in force now**. The 10-year rule a generation of
 * taxpayers memorised was abrogated by OMF nr. 1.447 din 2 mai 2023 (MO nr. 453 din 24 mai 2023,
 * art. II pct. 2), which inserted cap. IV pct. 1¹ into OMFP 170/2015 and abrogated pct. 2-4. A UI that
 * still printed „10 ani" would be stating a fact that stopped being true in 2023, so the first test below
 * asserts the absence of that string as well as the presence of the current one.
 *
 * The fișa's own retention is **inferred**, not quoted — `research/36` §14.3. The second test pins that the
 * sentence says so, because an inference presented as a citation is the same defect class as a wrong
 * number.
 */
import { describe, expect, it } from 'vitest';
import { retentionFor, retentionText, inventoryRegisterCsv, assetFicheCsv } from './fixedAssetDocuments';
import { assets as assetsCopy } from '../ui/copy/assets';
import type { FixedAsset } from './types';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from '../domain/fiscal/package2026';
import { FISCAL_DEPRECIATION_RULE_ID } from '../domain/fiscal/depreciation';
import { lei } from '../domain/money';

const rule = PFA_2026_SYSTEM_REAL_PACKAGE.find((r) => r.ruleId === FISCAL_DEPRECIATION_RULE_ID)!;

const csvLines = (csv: string): string[] => csv.replace(/^\uFEFF/, '').split('\r\n');

const asset = (over: Partial<FixedAsset> = {}): FixedAsset => ({
  id: 'a1',
  label: 'Utilaj de birou',
  entryDate: '2026-02-10',
  putInFunctionDate: '2026-02-15',
  fiscalValue: lei(120000),
  normalLifeMonths: 60,
  method: 'liniar',
  acquisition: 'cumparare',
  paymentState: 'achitat',
  paidOn: '2026-02-11',
  ...over,
});

describe('retention: the current rule, not the remembered one', () => {
  it('a 60-month asset falls under the 5-ani floor of cap. IV pct. 1^1 alin. (1)', () => {
    expect(retentionFor(asset())).toEqual({ kind: 'fiveYears' });
    expect(retentionText(retentionFor(asset()))).toContain('5 ani de la 1 iulie a anului următor');
  });

  it('a 78-month asset is kept for its whole useful life, and the years are rounded up', () => {
    // alin. (2): provenance documents for a good with viață utilă > 5 ani are kept for that life.
    expect(retentionFor(asset({ normalLifeMonths: 78 }))).toEqual({ kind: 'usefulLife', years: 7 });
    expect(retentionText(retentionFor(asset({ normalLifeMonths: 78 }))))
      .toContain('durata de viață utilă');
  });

  it('an asset with no declared duration falls back to the floor rather than to an invented life', () => {
    // pct. 27 puts the duration with the taxpayer; without one there is no useful life to read.
    const bare = asset({ normalLifeMonths: undefined });
    expect(retentionFor(bare)).toEqual({ kind: 'fiveYears' });
  });

  it('no operative retention sentence states the abrogated 10-ani period', () => {
    // The abrogation is *named* in `retentionAbrogated`, which is the one place the old figure may appear.
    // What must not appear is 10-ani as the period a taxpayer should keep something for.
    const operative = [
      assetsCopy.documents.retentionRegister,
      assetsCopy.documents.retentionProvenance,
      assetsCopy.documents.retentionLine,
      assetsCopy.documents.retentionLineUsefulLife,
      assetsCopy.documents.ficheInferred,
    ].join(' ');
    expect(operative).not.toMatch(/\b10 ani\b/);
    // Not vacuous: the abrogation is named, so the absence above is a choice and not an omission.
    expect(assetsCopy.documents.retentionAbrogated).toContain('1.447');
    expect(assetsCopy.documents.retentionAbrogated).toContain('10 ani');
    expect(assetsCopy.documents.retentionRegister).toContain('5 ani');
    expect(assetsCopy.documents.retentionRegister).toContain('1 iulie');
  });

  it('the fișa sentence labels its own retention as inferred', () => {
    expect(assetsCopy.documents.ficheInferred).toContain('inferat');
  });
});

describe('the generated documents', () => {
  it('the Registru-inventar listing carries one row per asset, ordered by entry date', () => {
    const csv = inventoryRegisterCsv(
      [
        asset({ id: 'b', label: 'Al doilea', entryDate: '2026-05-01' }),
        asset({ id: 'a', label: 'Primul', entryDate: '2026-01-01' }),
      ],
      rule,
    );
    const lines = csvLines(csv);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe(assetsCopy.documents.csvHeader);
    expect(lines[1]).toContain('Primul');
    expect(lines[2]).toContain('Al doilea');
  });

  it('an asset whose schedule refuses leaves the depreciation columns empty, not zero', () => {
    // A zero in „amortizare cumulată" would state that the asset was fully depreciated, or not
    // depreciated, either of which is a figure the law has not given.
    const csv = inventoryRegisterCsv([asset({ putInFunctionDate: undefined })], rule);
    const row = csvLines(csv)[1];
    const cells = row.split(';');
    // Columns 8 and 9 are the accumulated depreciation and the remaining value.
    expect(cells[7]).toBe('');
    expect(cells[8]).toBe('');
  });

  it('the fișa carries one row per amortisation year, and the remaining value reaches zero', () => {
    const facts = asset({ normalLifeMonths: 24, method: 'liniar' });
    const csv = assetFicheCsv(facts, rule);
    const lines = csvLines(csv);
    // header + the identity row + the amortisation years. puterea în funcțiune on 15 February 2026 starts
    // the schedule in March, so a 24-month life spans three calendar years: 10 + 12 + 2 months.
    expect(lines).toHaveLength(5);
    const last = lines[4]!.split(';');
    expect(last[14]).toBe('0,00');
  });

  it('a fișa for an asset that refuses stops after the declared facts instead of writing zeroes', () => {
    const csv = assetFicheCsv(asset({ normalLifeMonths: undefined }), rule);
    expect(csvLines(csv)).toHaveLength(2);
  });

  it('a label containing the separator is quoted rather than split', () => {
    const csv = inventoryRegisterCsv([asset({ label: 'Cremă, mare; nouă' })], rule);
    expect(csv).toContain('"Cremă, mare; nouă"');
  });

  it('opens in Romanian Excel: a UTF-8 BOM and CRLF endings, like the other retained files', () => {
    // A document the taxpayer cannot open is not a retained document. This is the same file shape the
    // RJIP register and the occupancy sheet already use.
    const csv = inventoryRegisterCsv([asset()], rule);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('\r\n');
    expect(csvLines(csv)[1]!.split(';').length).toBe(9);
  });
});
