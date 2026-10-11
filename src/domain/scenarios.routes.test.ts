/**
 * PG-6a — a `fixTarget` has to go somewhere.
 *
 * The brief's third landmine is that a link which goes nowhere is worse than no link, and the fourth
 * acceptance criterion asks for a fix link that works. A route spelled as a string in a domain module
 * is a claim about the router, and a claim nothing checks. So this file follows every registered target
 * through `parseRoute` — the same function the shell calls on load and on popstate — and asserts it
 * resolves to the page and tab the target names.
 *
 * `ScenarioPage` is a local union rather than an import of `Page` from `App.tsx`, because the domain must
 * not depend on the shell. That trade is only safe while this test exists: it is what stops the two
 * lists drifting apart, which is the whole reason `VALID_TABS` in `App.tsx` is written as a comment-
 * bound contract instead of a shared constant.
 */
import { describe, expect, it } from 'vitest';
import { parseRoute } from '../App';
import { SCENARIO_SUPPORT, scenarioFixHref } from './scenarios';

describe('every registered fix target resolves through the live router', () => {
  for (const scenario of SCENARIO_SUPPORT) {
    it(`${scenario.id} → ${scenarioFixHref(scenario.fixTarget)}`, () => {
      const href = scenarioFixHref(scenario.fixTarget);
      window.history.pushState({ pg6a: true }, '', href);
      const route = parseRoute();
      expect(route.page).toBe(scenario.fixTarget.page);
      expect(route.tab).toBe(scenario.fixTarget.tab ?? null);
    });
  }

  it('a target with no tab lands on the page, not on a tab the page does not render', () => {
    window.history.pushState({ pg6a: true }, '', '/revenues');
    expect(parseRoute()).toMatchObject({ page: 'revenues', tab: null, focus: null });
  });
});
