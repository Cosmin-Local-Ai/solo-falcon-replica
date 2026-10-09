import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ActionSection from './ActionSection';
import type { AttentionItem } from '../../domain/attention';

function makeActions(): AttentionItem[] {
  // TASK 8: the action list is a projection of the attention model, so a row carries its own title,
  // severity, state and target. The old fixtures carried a raw `label` (`pfa`, `profile`) that this
  // component translated — the translation moved to the domain, where the item is built.
  return [
    {
      id: 'deadline-PFA_DEADLINE_2026',
      severity: 'low',
      state: 'deadline_open',
      source: 'deadline',
      title: 'Termen limită: PFA',
      description: 'Termenul PFA este pe 25.05.2027.',
      target: { href: '/declarations' },
    },
    {
      id: 'completeness-profile',
      severity: 'medium',
      state: 'data_missing',
      source: 'completeness',
      title: 'Date lipsă: Profil',
      description: 'Această verificare de completitudine nu este îndeplinită: Profil.',
      target: { href: '/settings#!/fiscal' },
    },
    {
      id: 'completeness-statements',
      severity: 'medium',
      state: 'data_missing',
      source: 'completeness',
      title: 'Date lipsă: Declarații fiscale',
      description: 'Această verificare de completitudine nu este îndeplinită: Declarații fiscale.',
      target: { href: '/documents#!/statements' },
    },
    {
      id: 'record-revenue-r3',
      severity: 'high',
      state: 'rejected',
      source: 'revenue',
      title: 'Document de venit respins: NF-2026-003',
      description: 'Documentul NF-2026-003 din 18.09.2026 este respins: CUI nevalid.',
      target: { href: '/revenues#!/rejected?f=r3', record: { kind: 'revenue', id: 'r3', reference: 'NF-2026-003' } },
    },
  ];
}

describe('ActionSection (TASK 8 — the action surface)', () => {
  it('renders every real action item, in the data layer order', () => {
    render(<ActionSection actions={makeActions()} />);
    expect(screen.getByText('Termen limită: PFA')).toBeInTheDocument();
    expect(screen.getByText('Document de venit respins: NF-2026-003')).toBeInTheDocument();
    // TASK 7 grammar pass: `item` was an English calque; Romanian counts these as `element` and
    // agrees the plural with the numeral. Re-pinned from '4 item de rezolvat'.
    expect(screen.getByText('4 elemente de rezolvat')).toBeInTheDocument();
  });

  it('shows the source badge for each item, across every attention source', () => {
    render(<ActionSection actions={makeActions()} />);
    expect(screen.getByText('Termen limită')).toBeInTheDocument();
    expect(screen.getAllByText('Completitudine').length).toBe(2);
    expect(screen.getByText('Venit')).toBeInTheDocument();
  });

  it('shows the severity badge the domain decided, styled from severity', () => {
    render(<ActionSection actions={makeActions()} />);
    expect(screen.getByText('prioritate scăzută')).toBeInTheDocument();
    // Two of the four fixtures are medium, so the word appears twice — the badge is per item.
    expect(screen.getAllByText('prioritate medie')).toHaveLength(2);
    expect(screen.getByText('prioritate ridicată')).toBeInTheDocument();

    const rows = [...document.querySelectorAll('.attention-row')];
    const byId = new Map(rows.map(r => [r.getAttribute('data-source'), r]));
    expect(byId.get('deadline')!.querySelector('.badge')!.className).toContain('badge-info');
    expect(byId.get('revenue')!.querySelector('.badge')!.className).toContain('badge-danger');
  });

  it('never shows a raw internal key as a label', () => {
    render(<ActionSection actions={makeActions()} />);
    expect(screen.queryByText('profile')).not.toBeInTheDocument();
    expect(screen.queryByText('statements')).not.toBeInTheDocument();
    expect(screen.queryByText('pfa')).not.toBeInTheDocument();
  });

  it('links each item to the place it can be acted on', () => {
    render(<ActionSection actions={makeActions()} />);
    const links = [...screen.getAllByRole('link')].map(l => l.getAttribute('href'));
    expect(links).toEqual(
      expect.arrayContaining(['/declarations', '/settings#!/fiscal', '/revenues#!/rejected?f=r3']),
    );
  });

  it('shows the reason the record itself carries, on the row', () => {
    // "A rejected document" is not actionable. "Rejected: CUI nevalid" is. The reason comes from the
    // record (`statusDetail`), verbatim — the domain invents nothing when the record holds none.
    render(<ActionSection actions={makeActions()} />);
    expect(screen.getByText(/NF-2026-003 din 18\.09\.2026 este respins: CUI nevalid\./)).toBeInTheDocument();
    expect(screen.getByText(/Deschide înregistrarea NF-2026-003/)).toBeInTheDocument();
  });

  it('renders an item with no target without a link', () => {
    render(
      <ActionSection
        actions={[
          {
            id: 'completeness-taxEstimate',
            severity: 'medium',
            state: 'data_missing',
            source: 'completeness',
            title: 'Date lipsă: Estimare impozit',
            description: 'Această verificare de completitudine nu este îndeplinită: Estimare impozit.',
            target: null,
          },
        ]}
      />,
    );
    expect(screen.getByText('Date lipsă: Estimare impozit')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('1 element de rezolvat')).toBeInTheDocument();
  });

  it('shows the honest up-to-date state when there are no action items', () => {
    render(<ActionSection actions={[]} />);
    expect(screen.getByText('Totul este la zi — nimic nu necesită atenție.')).toBeInTheDocument();
    expect(screen.getByText('Nimic nu necesită atenția ta în acest moment.')).toBeInTheDocument();
  });
});

describe('ActionSection (TASK 9 — provenance on the action surface)', () => {
  it('renders a drifted provenance line as a mismatch, and repairs nothing', () => {
    const recorded = 'b'.repeat(64);
    const current = 'c'.repeat(64);
    const { container } = render(
      <ActionSection
        actions={[
          {
            ...makeActions()[0],
            source: 'tax',
            state: 'estimate_review_required',
            provenance: {
              state: 'drifted',
              releaseId: 'PFA_2026_SYSTEM_REAL',
              recordedHash: recorded,
              registeredHash: current,
              citations: [{ act: 'Cod fiscal', article: 'art. 118 alin. (2) lit. b)' }],
            },
          },
        ]}
      />,
    );
    expect(
      screen.getByText(
        'Regulile înregistrate acum nu mai corespund digestului consemnat la acest calcul: pachetul a fost modificat după calcul. Aplicația afișează neconcordanța și nu recalculează digestul.',
      ),
    ).toBeInTheDocument();
    // Both digests are on screen: that is the evidence, and it is not overwritten.
    expect(container.querySelector(`[data-digest-recorded="${recorded}"]`)).not.toBeNull();
    expect(container.querySelector(`[data-digest-registered="${current}"]`)).not.toBeNull();
    expect(screen.getByText('Cod fiscal — art. 118 alin. (2) lit. b)')).toBeInTheDocument();
  });

  it('renders no provenance line for a row about a record or a date', () => {
    const { container } = render(<ActionSection actions={makeActions()} />);
    expect(container.querySelector('[data-provenance-state]')).toBeNull();
  });
});
