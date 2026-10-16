/**
 * B-51 — the scope statement, pinned as a surface rather than as a string.
 *
 * The defect was an absence: no user-facing sentence anywhere said that these figures are decision
 * support and not a filing. A grep for `consultan`, `nu constituie`, `informativ` across `src/ui/copy/`
 * and `src/pages/` returned one hit and it was a code comment. So the assertion has to be about what a
 * person can read on a screen, not about whether a key exists.
 *
 * Three properties, in order of importance:
 *  1. the statement **renders** on both surfaces it is promised to — the first run, and Settings → Date;
 *  2. both surfaces render **the same sentence from one key**, because two near-identical disclaimers
 *     drift apart the same way two status vocabularies did before TASK 7 collapsed them;
 *  3. the sentence still carries the four things it exists to say, and still **claims no filing** — the
 *     B-56 discipline applied in reverse. These are stable fragments, not the whole wording, so an
 *     honest rewording does not break the pin while a gutted sentence does.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { StoreProvider } from '../data/store';
import { scope } from '../ui/copy';
import Onboarding from './Onboarding';
import Settings from './Settings';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

/** The hook both surfaces put on the paragraph, so the pin does not depend on surrounding copy. */
const renderedStatement = (): string => {
  const nodes = Array.from(document.querySelectorAll('[data-scope-statement]'));
  expect(nodes, 'the scope statement is not on screen').toHaveLength(1);
  return nodes[0].textContent ?? '';
};

describe('B-51 — the scope statement', () => {
  it('renders on the first-run screen, where expectations are set', () => {
    render(
      <StoreProvider>
        <Onboarding />
      </StoreProvider>,
    );
    expect(renderedStatement()).toBe(scope.statement);
  });

  it('renders again in Settings → Date, from the same key and with the same wording', () => {
    render(
      <StoreProvider>
        <Settings />
      </StoreProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Date' }));
    expect(renderedStatement()).toBe(scope.statement);
  });

  it('says the four things it exists to say', () => {
    // Fragments, deliberately: the wording may be reworded honestly, the content may not go missing.
    for (const fragment of [
      'sunt estimări',              // the figures are estimates, not measurements
      'ce ai introdus',             // …computed from what the person entered
      'nu se depune',               // nothing is filed from here
      'consultant fiscal',          // not a substitute for a consultant
      'ANAF',                       // …nor for the ANAF window
      'legea se schimbă',           // a figure can be wrong because the law moves
      'calculele sunt testate',     // and the arithmetic is not a toy: it is cited and tested
    ]) {
      expect(scope.statement, `the statement no longer says „${fragment}”`).toContain(fragment);
    }
  });

  it('claims no filing, no transmission and no guarantee — the B-56 discipline in reverse', () => {
    const said = scope.statement.toLowerCase();
    // B-56 is open: success messages already claim operations that do not happen. This sentence must not
    // add a sixth such claim, so anything affirmative about filing, sending or guaranteeing is a defect.
    for (const claim of ['am depus', 'am trimis', 'vom depune', 'vom trimite', 'garantăm', 'garantam']) {
      expect(said, `the statement now claims „${claim}”`).not.toContain(claim);
    }
    // The only filing verbs in the sentence are the negated ones and the taxpayer's own action.
    expect(said).toContain('nimic nu se depune');
    expect(said).toContain('declarația o depui tu');
  });
});
