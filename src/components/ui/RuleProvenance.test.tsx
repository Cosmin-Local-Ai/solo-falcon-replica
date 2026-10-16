import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RuleProvenance, provenanceSentence } from './RuleProvenance';
import type { SnapshotRuleProvenance } from '../../domain/snapshots/ruleProvenance';
import { provenance as provenanceCopy } from '../../ui/copy';

/**
 * TASK 9 — all four record states must be renderable, and each with a test. The two rules that are
 * easiest to break are pinned here rather than left to the surfaces: a digest is only ever shown
 * beside the provisions it rests on, and `drifted` is shown as a mismatch instead of being repaired.
 */

const CITATIONS = [
  { act: 'Cod fiscal — OUG nr. 128/2024, Art. I pct. 20 (MO 1125/11.11.2024)', article: 'art. 148 alin. (1)-(2) lit. a)' },
  { act: 'Cod fiscal — Legea 239/2025', article: 'art. 174 alin. (6)' },
];

function view(overrides: Partial<SnapshotRuleProvenance> = {}): SnapshotRuleProvenance {
  return {
    state: 'pinned',
    releaseId: 'PFA_2026_SYSTEM_REAL',
    recordedHash: 'a'.repeat(64),
    registeredHash: 'a'.repeat(64),
    citations: CITATIONS,
    ...overrides,
  };
}

describe('provenanceSentence', () => {
  it('has one sentence per state, and every one of them is the copy layer\'s', () => {
    expect(provenanceSentence(view())).toBe(provenanceCopy.pinned('PFA_2026_SYSTEM_REAL'));
    expect(provenanceSentence(view({ state: 'drifted' }))).toBe(provenanceCopy.drifted);
    expect(provenanceSentence(view({ state: 'unregistered', releaseId: 'REL_2024' }))).toBe(
      provenanceCopy.unregistered('REL_2024'),
    );
    expect(provenanceSentence(view({ state: 'unpinned' }))).toBe(provenanceCopy.unpinned);
    expect(provenanceSentence(view({ state: 'no_release', releaseId: null }))).toBe(
      provenanceCopy.noRelease,
    );
  });
});

describe('RuleProvenance', () => {
  it('pinned: names the release, shows the recorded digest, and keeps the article beside it', () => {
    const { container } = render(<RuleProvenance view={view()} />);
    expect(screen.getByText(provenanceCopy.pinned('PFA_2026_SYSTEM_REAL'))).toBeInTheDocument();
    expect(container.querySelector('[data-provenance-state="pinned"]')).not.toBeNull();
    expect(container.querySelector(`[data-digest-recorded="${'a'.repeat(64)}"]`)).not.toBeNull();
    // The invariant: a digest never stands alone.
    expect(screen.getByText(provenanceCopy.digestIsNotACitation)).toBeInTheDocument();
    for (const citation of CITATIONS) {
      expect(screen.getByText(`${citation.act} — ${citation.article}`)).toBeInTheDocument();
    }
    expect(screen.getByText(provenanceCopy.citationsLabel)).toBeInTheDocument();
  });

  it('drifted: shows BOTH digests — the mismatch is the finding, and nothing here repairs it', () => {
    const recorded = 'b'.repeat(64);
    const current = 'c'.repeat(64);
    const { container } = render(
      <RuleProvenance view={view({ state: 'drifted', recordedHash: recorded, registeredHash: current })} />,
    );
    expect(screen.getByText(provenanceCopy.drifted)).toBeInTheDocument();
    expect(container.querySelector(`[data-digest-recorded="${recorded}"]`)).not.toBeNull();
    expect(container.querySelector(`[data-digest-registered="${current}"]`)).not.toBeNull();
    expect(screen.getByText(provenanceCopy.digestRecorded)).toBeInTheDocument();
    expect(screen.getByText(provenanceCopy.digestRegisteredNow)).toBeInTheDocument();
    // The citations are labelled as the CURRENT package's, because the app no longer knows which ones
    // produced the figure.
    expect(screen.getByText(provenanceCopy.citationsLabelCurrent)).toBeInTheDocument();
    expect(screen.queryByText(provenanceCopy.citationsLabel)).not.toBeInTheDocument();
  });

  it('unregistered: names the release this build does not carry, and cites nothing', () => {
    const { container } = render(
      <RuleProvenance
        view={view({ state: 'unregistered', releaseId: 'REL_2024_IESIT', registeredHash: null, citations: [] })}
      />,
    );
    expect(screen.getByText(provenanceCopy.unregistered('REL_2024_IESIT'))).toBeInTheDocument();
    expect(container.querySelector('[data-provenance-state="unregistered"]')).not.toBeNull();
    expect(container.querySelector('.provenance-citations')).toBeNull();
    expect(container.querySelector(`[data-digest-recorded="${'a'.repeat(64)}"]`)).not.toBeNull();
    expect(screen.getByText(provenanceCopy.digestIsNotACitation)).toBeInTheDocument();
  });

  it('unpinned: says the rules cannot be reconstructed, and shows no digest — none is invented', () => {
    const { container } = render(
      <RuleProvenance view={view({ state: 'unpinned', recordedHash: null, citations: [] })} />,
    );
    expect(screen.getByText(provenanceCopy.unpinned)).toBeInTheDocument();
    expect(container.querySelector('[data-provenance-state="unpinned"]')).not.toBeNull();
    expect(container.querySelector('[data-digest-recorded]')).toBeNull();
    // Nothing that could be read as a digest appears at all.
    expect(container.textContent).not.toMatch(/[0-9a-f]{16,}/);
    // And with no digest on screen, the "a digest is not a citation" line has nothing to qualify.
    expect(screen.queryByText(provenanceCopy.digestIsNotACitation)).not.toBeInTheDocument();
  });

  it('no_release: a surface with no record to ask says so, and shows no digest', () => {
    const { container } = render(
      <RuleProvenance
        view={{ state: 'no_release', releaseId: null, recordedHash: null, registeredHash: null, citations: [] }}
      />,
    );
    expect(screen.getByText(provenanceCopy.noRelease)).toBeInTheDocument();
    expect(container.querySelector('[data-provenance-state="no_release"]')).not.toBeNull();
    expect(container.querySelector('[data-digest-recorded]')).toBeNull();
  });
});
