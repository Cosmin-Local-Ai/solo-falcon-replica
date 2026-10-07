import { describe, it, expect } from 'vitest';
import { rjipCsv } from './Documents';
import { lei, type Bani } from '../domain/money';

/**
 * Phase 10 — an exported register is a screen. The RJIP cashflow CSV used to build its money cells with
 * `value.toFixed(2).replace('.', ',')` on a value that is now **bani**, so a 142,50 lei invoice exported
 * as `14250,00`. Nothing else in the suite reads the exported bytes, so nothing caught it.
 */
describe('RJIP CSV export — money is rendered, not dumped', () => {
  const rows = [
    { data: '2026-01-15', descriere: 'Factură F1 – Client', venit: lei(142.5), cheltuiala: 0 as Bani },
    { data: '2026-02-03', descriere: 'Bon fiscal B9 – Furnizor', venit: 0 as Bani, cheltuiala: lei(85.5) },
  ];

  it('writes lei with two decimals, never the raw ban count', () => {
    const csv = rjipCsv(rows);
    expect(csv).toContain('142,50');
    expect(csv).toContain('85,50');
    expect(csv).not.toContain('14250');
    expect(csv).not.toContain('8550');
  });

  it('keeps the semicolon separator, the comma decimal and the BOM Excel needs', () => {
    const lines = rjipCsv(rows).split('\r\n');
    expect(lines[0]).toBe('\uFEFFData;Descriere;Venit (RON);Cheltuiala (RON)');
    expect(lines).toHaveLength(3);
    expect(lines[1]!.split(';')).toHaveLength(4);
  });

  it('escapes a description that contains a quote', () => {
    const csv = rjipCsv([{ ...rows[0], descriere: 'Factură "A" – Client' }]);
    expect(csv).toContain('"Factură ""A"" – Client"');
  });

  it('sums a large register without float drift before rendering', () => {
    const many = Array.from({ length: 10_000 }, () => rows[0]);
    const csv = rjipCsv(many);
    // 10 000 × 142,50 lei = 1 425 000,00 lei exactly. In float lei this is where the cents start to lie.
    const cells = rjipCsv(many)
      .split('\r\n')
      .slice(1)
      .map((line) => line.split(';').slice(2));
    expect(cells).toHaveLength(10_000);
    expect(new Set(cells.flat())).toEqual(new Set(['142,50', '0,00']));
  });
});
