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
    ...overrides,
  };
}

function makeState(items: LegislationItem[]): LegislationState {
  return { updatedAt: null, items };
}

describe('LegislationSection', () => {
  it('renders the honest empty state when there are no items', () => {
    render(<LegislationSection state={makeState([])} />);
    expect(screen.getByText('Legislation')).toBeInTheDocument();
    expect(screen.getByText('No verified upcoming changes.')).toBeInTheDocument();
    expect(screen.queryByText('Upcoming Change')).not.toBeInTheDocument();
    expect(screen.queryByText('Legislation Change Affecting You')).not.toBeInTheDocument();
  });

  it('renders an UPCOMING item with the correct header, badge, and all metadata', () => {
    render(<LegislationSection state={makeState([makeItem()])} />);
    expect(screen.getByText('Upcoming Change')).toBeInTheDocument();
    expect(screen.getByText('UPCOMING', { selector: '.badge' })).toBeInTheDocument();
    // Never mislabeled as "Current" / "Active"
    expect(screen.queryByText(/active/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Legislation Change Affecting You')).not.toBeInTheDocument();
    // All five metadata fields: source, published, effective, status, affected area
    expect(screen.getByText('ANAF / Official Gazette')).toBeInTheDocument();
    expect(screen.getByText('05.01.2026')).toBeInTheDocument();
    expect(screen.getByText('01.03.2026')).toBeInTheDocument();
    // "UPCOMING" appears twice: the badge and the Status row
    expect(screen.getAllByText('UPCOMING')).toHaveLength(2);
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
    expect(screen.getByText('Legislation Change Affecting You')).toBeInTheDocument();
    expect(screen.getByText('CURRENT', { selector: '.badge' })).toBeInTheDocument();
    // Never mislabeled as "Upcoming"
    expect(screen.queryByText('Upcoming Change')).not.toBeInTheDocument();
    // All five metadata fields: source, published, effective, status, affected area
    expect(screen.getByText('Law 296/2023 amendment')).toBeInTheDocument();
    expect(screen.getByText('10.01.2026')).toBeInTheDocument();
    expect(screen.getByText('01.02.2026')).toBeInTheDocument();
    // "CURRENT" appears twice: the badge and the Status row
    expect(screen.getAllByText('CURRENT')).toHaveLength(2);
    expect(screen.getByText('Social contributions (CS)')).toBeInTheDocument();
    expect(screen.getByText('CS contribution rate change now in force')).toBeInTheDocument();
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
    expect(screen.getByText('Legislation Change Affecting You')).toBeInTheDocument();
    expect(screen.getByText('Upcoming Change')).toBeInTheDocument();
    expect(screen.getByText('CURRENT', { selector: '.badge' })).toBeInTheDocument();
    expect(screen.getByText('UPCOMING', { selector: '.badge' })).toBeInTheDocument();
    expect(screen.getByText('New e-factura obligation now in force')).toBeInTheDocument();
    expect(screen.getByText('New VAT threshold coming into force')).toBeInTheDocument();
  });
});
