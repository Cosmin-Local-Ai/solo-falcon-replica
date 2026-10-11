/**
 * PG-6a — the refusal block.
 *
 * A refusal that only changes a badge is a dead end: the brief's third landmine is that a link which
 * goes nowhere is worse than no link, and a reason that is paraphrased is a legal sentence the app
 * invented. This file pins the three things that make the block worth rendering — the framing sentence
 * is the language layer's, the reason is the rule's own and verbatim, and the link is the registry's
 * resolved route.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ScenarioRefusal from './ScenarioRefusal';
import { SCENARIO_SUPPORT } from '../../domain/scenarios';
import { copy } from '../../ui/copy';

const regime = SCENARIO_SUPPORT.find(s => s.id === 'regime-not-computable')!;

describe('ScenarioRefusal', () => {
  it('names the scenario, frames it in the language layer\'s words, and links to the fix', () => {
    render(
      <ScenarioRefusal
        scenario={{
          id: regime.id,
          effect: regime.effect,
          message: regime.message,
          fixTarget: regime.fixTarget,
          detail: 'Regimul fiscal înregistrat nu poate aparține unui PFA în 2026 — CF art. 13 alin. (1).',
        }}
      />,
    );

    expect(document.querySelector('[data-scenario-refusal="regime-not-computable"]')).not.toBeNull();
    expect(screen.getByText(copy.scenarios.messages.regimeNotComputable)).toBeInTheDocument();
    expect(
      document.querySelector('[data-scenario-detail="regime-not-computable"]')?.textContent,
    ).toContain('CF art. 13 alin. (1)');

    const link = screen.getByRole('link', { name: copy.scenarios.open });
    expect(link.getAttribute('href')).toBe('/settings#!/fiscal');
  });

  it('renders no detail paragraph when the scenario carries none', () => {
    render(
      <ScenarioRefusal
        scenario={{
          id: 'no-expense-engine',
          effect: 'refuse',
          message: 'noExpenseEngine',
          fixTarget: { page: 'settings', tab: 'fiscal' },
          detail: null,
        }}
      />,
    );
    expect(document.querySelector('[data-scenario-detail]')).toBeNull();
    // The link is not conditional on the detail: a refusal with no rule sentence still has to be fixable.
    expect(screen.getByRole('link', { name: copy.scenarios.open })).toBeInTheDocument();
  });

  it('renders no figure — a refusal replaces the number, it does not annotate it', () => {
    render(
      <ScenarioRefusal
        scenario={{
          id: 'no-expense-engine',
          effect: 'refuse',
          message: 'noExpenseEngine',
          fixTarget: { page: 'settings', tab: 'fiscal' },
          detail: 'Regula EXPENSE_ENGINE_CAZARE_2026 (art. 68^3).',
        }}
      />,
    );
    expect(document.querySelector('.mono')).toBeNull();
    expect(document.body.textContent).not.toMatch(/\d[\d.]*,\d{2}\s*(lei|RON)/);
  });
});
