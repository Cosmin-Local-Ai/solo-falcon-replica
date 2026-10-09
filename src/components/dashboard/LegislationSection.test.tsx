import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import LegislationSection from './LegislationSection';
import type { LegislationItem, LegislationState } from '../../data/dashboard';

function makeItem(overrides: Partial<LegislationItem> = {}): LegislationItem {
  return {
    id: 'leg-1',
    source: 'ANAF / Official Gazette',
    publishedDate: '2026-01-05',
    effectiveDate: '2026-03-01',
    status: 'UPCOMING',
    affectedArea: 'VAT filing deadlines',
    summary: 'VAT filing deadlines move to the 25th',
    impact: { affects: 'yes', note: 'Termenele de depunere se schimbă pentru acest an.' },
    ...overrides,
  };
}

function makeState(items: LegislationItem[], monitor: LegislationState['monitor'] = 'unavailable'): LegislationState {
  return { updatedAt: null, items, monitor };
}

describe('LegislationSection', () => {
  it('says the monitor is unavailable when there are no items — not that nothing exists', () => {
    // Re-pinned, not deleted. The old sentence was „Nicio modificare viitoare verificată.”, which to a
    // user with no monitor at all reads as reassurance. `getLegislationState` performs no ingestion,
    // so the honest statement is about the monitor.
    render(<LegislationSection state={makeState([])} />);
    expect(screen.getByText('Legislație')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Monitorul de modificări legislative nu este activ: aplicația nu verifică nicio sursă, deci nu poate spune nici că există o modificare, nici că nu există.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Nicio modificare viitoare verificată.')).not.toBeInTheDocument();
    expect(screen.queryByText('Modificare viitoare')).not.toBeInTheDocument();
    expect(document.querySelector('[data-monitor="unavailable"]')).not.toBeNull();
  });

  it('renders an UPCOMING item with the correct header, badge, and all metadata', () => {
    render(<LegislationSection state={makeState([makeItem()])} />);
    expect(screen.getByText('Modificare viitoare')).toBeInTheDocument();
    expect(screen.getByText('Te afectează', { selector: '.badge' })).toBeInTheDocument();
    // Never mislabeled as "Current" / "Active"
    expect(screen.queryByText(/active/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Modificare legislativă în vigoare')).not.toBeInTheDocument();
    // All five metadata fields: source, published, effective, status, affected area
    expect(screen.getByText('Sursă')).toBeInTheDocument();
    expect(screen.getByText('ANAF / Official Gazette')).toBeInTheDocument();
    expect(screen.getByText('Publicat')).toBeInTheDocument();
    expect(screen.getByText('05.01.2026')).toBeInTheDocument();
    expect(screen.getByText('În vigoare de la')).toBeInTheDocument();
    expect(screen.getByText('01.03.2026')).toBeInTheDocument();
    expect(screen.getByText('Stare')).toBeInTheDocument();
    // "Viitoare" now appears once: the status row. The header badge carries the impact, not the status.
    expect(screen.getAllByText('Viitoare')).toHaveLength(1);
    expect(screen.getByText('Zonă afectată')).toBeInTheDocument();
    expect(screen.getByText('VAT filing deadlines')).toBeInTheDocument();
    expect(screen.getByText('VAT filing deadlines move to the 25th')).toBeInTheDocument();
  });

  it('renders a CURRENT item with the correct header, badge, and all metadata', () => {
    render(
      <LegislationSection
        state={makeState([
          makeItem({
            id: 'leg-2',
            status: 'CURRENT',
            source: 'Law 296/2023 amendment',
            publishedDate: '2026-01-10',
            effectiveDate: '2026-02-01',
            affectedArea: 'Social contributions (CS)',
            summary: 'CS contribution rate change now in force',
          }),
        ])}
      />,
    );
    // Re-pinned: the title used to read „Modificare legislativă care te afectează”, which asserted the
    // impact before anything had established one. The impact is its own badge now.
    expect(screen.getByText('Modificare legislativă în vigoare')).toBeInTheDocument();
    expect(screen.getByText('Te afectează', { selector: '.badge' })).toBeInTheDocument();
    // Never mislabeled as "Upcoming"
    expect(screen.queryByText('Modificare viitoare')).not.toBeInTheDocument();
    // All five metadata fields: source, published, effective, status, affected area
    expect(screen.getByText('Law 296/2023 amendment')).toBeInTheDocument();
    expect(screen.getByText('10.01.2026')).toBeInTheDocument();
    expect(screen.getByText('01.02.2026')).toBeInTheDocument();
    expect(screen.getAllByText('În vigoare')).toHaveLength(1);
    expect(screen.getByText('Social contributions (CS)')).toBeInTheDocument();
    expect(screen.getByText('CS contribution rate change now in force')).toBeInTheDocument();
  });

  it('renders the impact line, and says so when a change in force does not touch this user', () => {
    // The HG 146/2026 case: the minimum wage rose to 4.325 lei on 1 iulie 2026, and it does not
    // re-anchor FY2026 because CF art. 135¹ alin. (3) fixes the 1 January value. Both halves have to
    // be on the card — the change, and whether it lands on this taxpayer.
    render(
      <LegislationSection
        state={makeState([
          makeItem({
            id: 'sm-vintage-2026-07-01',
            source: 'HG 146/2026',
            publishedDate: undefined,
            effectiveDate: '2026-07-01',
            status: 'CURRENT',
            affectedArea: 'Salariul minim brut pe țară',
            summary: 'Salariul minim brut pe țară este 4.325,00 lei de la 2026-07-01 (HG 146/2026).',
            impact: {
              affects: 'no',
              note: 'Nu recalcalează pragurile anului 2026: art. 135¹ alin. (3) ia în calcul valoarea în vigoare la 1 ianuarie a anului de realizare a venitului.',
            },
          }),
        ])}
      />,
    );

    expect(screen.getByText('Nu te afectează în acest an fiscal', { selector: '.badge' })).toBeInTheDocument();
    expect(
      screen.getByText(/art\. 135¹ alin\. \(3\) ia în calcul valoarea în vigoare la 1 ianuarie/),
    ).toBeInTheDocument();
    expect(document.querySelector('[data-impact="no"]')).not.toBeNull();
    // The rule package records when a change is in force, not when it was published: no date is shown
    // rather than one invented.
    expect(screen.queryByText('Publicat')).not.toBeInTheDocument();
  });

  it('marks an undecided impact as undecided instead of picking a side', () => {
    render(
      <LegislationSection
        state={makeState([
          makeItem({ id: 'leg-x', impact: { affects: 'unknown', note: 'Nicio prevedere verificată nu stabilește efectul.' } }),
        ])}
      />,
    );
    expect(
      screen.getByText('Efectul nu este stabilit de nicio prevedere verificată', { selector: '.badge' }),
    ).toBeInTheDocument();
  });

  it('renders both cards with correct labels when items are mixed (one CURRENT + one UPCOMING)', () => {
    render(
      <LegislationSection
        state={makeState([
          makeItem({
            id: 'leg-3',
            status: 'CURRENT',
            source: 'ANAF / Official Gazette',
            summary: 'New e-factura obligation now in force',
          }),
          makeItem({
            id: 'leg-4',
            status: 'UPCOMING',
            source: 'Government decision',
            summary: 'New VAT threshold coming into force',
          }),
        ])}
      />,
    );
    expect(screen.getByText('Modificare legislativă în vigoare')).toBeInTheDocument();
    expect(screen.getByText('Modificare viitoare')).toBeInTheDocument();
    expect(screen.getByText('New e-factura obligation now in force')).toBeInTheDocument();
    expect(screen.getByText('New VAT threshold coming into force')).toBeInTheDocument();
  });
});
