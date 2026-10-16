import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MoneyPrecisionNoticeBanner } from './MoneyPrecisionNotice';
import { lei } from '../domain/money';
import type { MoneyPrecisionNotice } from '../data/migration';

/**
 * Phase 10, B-26 — the migration report reaching a screen.
 *
 * The defect was not that the report was never produced; it was that nothing showed it and the first write
 * after a load erased it. These tests pin the showing half, and in particular the two ways this component
 * could lie: printing the raw `Bani` count (the exact 100× defect the phase removes), or reporting an
 * unconvertible value as if it had become 0.
 */

const subBan: MoneyPrecisionNotice = {
  collection: 'revenues',
  id: 'r-1',
  field: 'valoareFaraTva',
  original: '674.504',
  converted: lei(674.5),
  reason: 'sub-ban-precision',
};

const nonFinite: MoneyPrecisionNotice = {
  collection: 'profile',
  id: 'profile',
  field: 'cashFloorLei',
  original: 'NaN',
  reason: 'non-finite',
};

it('renders nothing when there is nothing to report', () => {
  const { container } = render(<MoneyPrecisionNoticeBanner notices={[]} />);
  expect(container.firstChild).toBeNull();
});

it('names the collection, the record, the field and both values', () => {
  render(<MoneyPrecisionNoticeBanner notices={[subBan]} />);
  const text = screen.getByRole('status').textContent ?? '';
  expect(text).toContain('venituri');
  expect(text).toContain('r-1');
  expect(text).toContain('valoareFaraTva');
  expect(text).toContain('674.504'); // verbatim, as stored
  expect(text).toContain('674,50'); // converted, in lei
});

it('shows the converted amount in lei — a raw ban count on screen is the B-17 class defect', () => {
  render(<MoneyPrecisionNoticeBanner notices={[subBan]} />);
  const text = screen.getByRole('status').textContent ?? '';
  expect(text).not.toContain('67450');
  expect(text).toContain('674,50');
});

it('states the rounding direction, and it is the art. 66 direction', () => {
  render(<MoneyPrecisionNoticeBanner notices={[subBan]} />);
  const text = screen.getByRole('status').textContent ?? '';
  expect(text).toContain('jumătate în jos');
  expect(text).toContain('art. 66');
});

it('says an unconvertible value was carried unchanged, and never that it became 0', () => {
  render(<MoneyPrecisionNoticeBanner notices={[nonFinite]} />);
  const text = screen.getByRole('status').textContent ?? '';
  expect(text).toContain('NaN');
  expect(text).toContain('neschimbat');
  expect(text).not.toContain('0,00');
});

it('reports one row per affected field, mixing both kinds without merging them', () => {
  render(<MoneyPrecisionNoticeBanner notices={[subBan, nonFinite]} />);
  expect(screen.getAllByRole('listitem')).toHaveLength(2);
  const text = screen.getByRole('status').textContent ?? '';
  expect(text).toContain('674,50');
  expect(text).toContain('NaN');
});

it('agrees in number: one value gets singular, several get plural', () => {
  const one = render(<MoneyPrecisionNoticeBanner notices={[subBan]} />);
  expect(one.container.textContent).toContain('O sumă nu a putut fi reprodusă exact.');
  expect(one.container.textContent).toContain('1 valoare a fost rotunjită');
  one.unmount();

  const many = render(<MoneyPrecisionNoticeBanner notices={[subBan, { ...subBan, id: 'r-2' }]} />);
  // TASK 7 grammar pass: the headline takes the article a Romanian reader expects — „Sumele…", not a
  // bare „2 sume…". The count is carried by the sentence that agrees with a noun anyway.
  // Re-pinned from '2 sume nu au putut fi reproduse exact.'
  expect(many.container.textContent).toContain('Sumele nu au putut fi reproduse exact.');
  expect(many.container.textContent).toContain('2 valori au fost rotunjite');
});

it('keeps the two kinds of notice in separate sentences instead of merging their counts', () => {
  const { container } = render(<MoneyPrecisionNoticeBanner notices={[subBan, nonFinite]} />);
  const text = container.textContent ?? '';
  expect(text).toContain('1 valoare a fost rotunjită');
  expect(text).toContain('1 valoare nu este un număr valid și a fost păstrată neschimbată');
});
