import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Insights from './Insights';
import type { AttentionItem } from '../domain/attention';

function makeInsight(overrides: Partial<AttentionItem> = {}): AttentionItem {
  return {
    id: 'insight-1',
    severity: 'medium',
    state: 'level_engaged',
    source: 'threshold',
    title: 'Nivel de calcul modificat: Venit PFA',
    description: 'Baza de calcul pentru CASS este venitul net anual (art. 170 alin. (1) din Codul fiscal).',
    action: 'Verifică venitul net anual: baza de calcul se modifică.',
    target: null,
    ...overrides,
  };
}

describe('Insights (TASK 8 — the observation surface)', () => {
  it('collapses instead of rendering an empty card', () => {
    // Replaced, not deleted: this used to assert the „Ești la zi…” caption inside a full card. A
    // section with nothing on it is not mounted at all — an empty card reads as a result.
    const { container } = render(<Insights insights={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders severity badge, title, description and action for each insight', () => {
    render(<Insights insights={[makeInsight()]} />);
    expect(screen.getByText('Nivel de calcul modificat: Venit PFA')).toBeInTheDocument();
    expect(screen.getByText('prioritate medie')).toBeInTheDocument();
    expect(
      screen.getByText('Baza de calcul pentru CASS este venitul net anual (art. 170 alin. (1) din Codul fiscal).'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Verifică venitul net anual: baza de calcul se modifică.'),
    ).toBeInTheDocument();
  });

  it('maps severity to the right badge label, on the four-level scale', () => {
    // Re-pinned from the three-word `Info` / `Atenție` / `Urgent` set. The words now come from
    // `copy.severity`, the four-level map TASK 7 supplied and left unwired; the collapse from four
    // levels to three was the defect TASK 8 removed.
    render(
      <Insights
        insights={[
          makeInsight({ id: 'a', severity: 'low' }),
          makeInsight({ id: 'b', severity: 'high' }),
          makeInsight({ id: 'c', severity: 'medium' }),
        ]}
      />,
    );
    expect(screen.getByText('prioritate scăzută')).toBeInTheDocument();
    expect(screen.getByText('prioritate ridicată')).toBeInTheDocument();
    expect(screen.getByText('prioritate medie')).toBeInTheDocument();
  });

  it('exposes severity, state and source on the row, and styles from severity only', () => {
    render(<Insights insights={[makeInsight({ severity: 'high', state: 'estimate_review_required', source: 'tax' })]} />);
    const row = document.querySelector('.attention-row');
    expect(row).not.toBeNull();
    expect(row!.getAttribute('data-severity')).toBe('high');
    expect(row!.getAttribute('data-state')).toBe('estimate_review_required');
    expect(row!.getAttribute('data-source')).toBe('tax');
    // The colour comes from `severity`, never from `state` or `source`.
    expect(row!.querySelector('.badge')!.className).toContain('badge-danger');
  });

  it('renders the target link with the record reference when the item has one', () => {
    render(
      <Insights
        insights={[
          makeInsight({
            id: 'record-revenue-r3',
            state: 'rejected',
            source: 'revenue',
            target: { href: '/revenues#!/rejected?f=r3', record: { kind: 'revenue', id: 'r3', reference: 'NF-2026-003' } },
          }),
        ]}
      />,
    );
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/revenues#!/rejected?f=r3');
    expect(link).toHaveTextContent('înregistrarea NF-2026-003');
  });

  it('renders no link when the item has nowhere to go', () => {
    render(<Insights insights={[makeInsight()]} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders all insights when multiple are present', () => {
    render(
      <Insights
        insights={[
          makeInsight({ id: 'a', title: 'First insight' }),
          makeInsight({ id: 'b', title: 'Second insight' }),
          makeInsight({ id: 'c', title: 'Third insight' }),
        ]}
      />,
    );
    expect(screen.getByText('First insight')).toBeInTheDocument();
    expect(screen.getByText('Second insight')).toBeInTheDocument();
    expect(screen.getByText('Third insight')).toBeInTheDocument();
  });
});

describe('Insights (TASK 9 — the row says which rules produced the figure)', () => {
  it('renders the provenance line, the recorded digest and the article beside it', () => {
    const { container } = render(
      <Insights
        insights={[
          makeInsight({
            provenance: {
              state: 'pinned',
              releaseId: 'PFA_2026_SYSTEM_REAL',
              recordedHash: 'a'.repeat(64),
              registeredHash: 'a'.repeat(64),
              citations: [{ act: 'Cod fiscal', article: 'art. 174 alin. (6)' }],
            },
          }),
        ]}
      />,
    );
    expect(
      screen.getByText(
        'Calculul folosește pachetul de reguli PFA_2026_SYSTEM_REAL, iar digestul înregistrat se potrivește cu cel al pachetului.',
      ),
    ).toBeInTheDocument();
    expect(container.querySelector('[data-provenance-state="pinned"]')).not.toBeNull();
    expect(container.querySelector(`[data-digest-recorded="${'a'.repeat(64)}"]`)).not.toBeNull();
    expect(screen.getByText('Cod fiscal — art. 174 alin. (6)')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Digestul este o adresă de conținut, nu o prevedere legală; articolul rămâne afișat alături de el.',
      ),
    ).toBeInTheDocument();
  });

  it('renders no provenance line on a row that is not about a computed figure', () => {
    // A rejected document has no calculation behind it. Attaching a provenance line would claim one.
    const { container } = render(
      <Insights insights={[makeInsight({ source: 'revenue', state: 'rejected', provenance: null })]} />,
    );
    expect(container.querySelector('[data-provenance-state]')).toBeNull();
  });

  it('renders the unpinned state honestly: no digest is invented for a record that predates one', () => {
    const { container } = render(
      <Insights
        insights={[
          makeInsight({
            provenance: {
              state: 'unpinned',
              releaseId: 'PFA_2026_SYSTEM_REAL',
              recordedHash: null,
              registeredHash: 'a'.repeat(64),
              citations: [],
            },
          }),
        ]}
      />,
    );
    expect(
      screen.getByText(
        'Înregistrarea este anterioară adresării prin digest, așa că regulile din spatele acestei cifre nu pot fi reconstituite.',
      ),
    ).toBeInTheDocument();
    expect(container.querySelector('[data-digest-recorded]')).toBeNull();
    expect(container.textContent).not.toMatch(/[0-9a-f]{16,}/);
  });
});
