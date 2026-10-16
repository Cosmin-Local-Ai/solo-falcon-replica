/**
 * Step 11 / Part D (B-132) — the persona surface renders the routing decision, and renders the LEVEL.
 *
 * The routing itself is pinned elsewhere (`personaCoverage.test.ts`, `personas.test.ts`). What is pinned
 * here is the part that did not exist: what a person SEES.
 *
 * Acceptance 3 is the one that matters most and is the easiest to fake. A secțiune-level match "looking
 * different" can be satisfied by a colour, and a colour is not a fact — it survives neither a screen reader,
 * nor a high-contrast theme, nor a test. So every assertion below is on rendered text: the strength sentence
 * for a clasă route and the strength sentence for a secțiune route must be different strings, and the
 * secțiune one must say what it is („doar la nivel de secțiune", „cel mai slab nivel").
 *
 * The codes are chosen from the measured distribution, not from convenience:
 *  - `5520` matches at clasă (the short-term host declares it),
 *  - `0210` reaches a persona only through its secțiune — the 379-clasă case,
 *  - `4611` is a tie at clasă level with three candidates,
 *  - `0510` is one of the 40 clase the lineage cannot reach at all.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { StoreProvider } from '../data/store';
import { CURRENT_DATA_VERSION } from '../data/migration';
import { seedData } from '../data/seed';
import { seedStorage } from '../test/storage';
import { caenInfo, routePersonaForCaen, CAEN_SAMPLE_LABEL } from '../data/personas';
import { personas as t } from '../ui/copy/personas';
import Personas from './Personas';

/** Put the codes under test where the page reads them: the person's own declared CAEN list. */
function seedDeclaredCaen(codes: string[]): void {
  seedStorage({
    ...seedData,
    version: CURRENT_DATA_VERSION,
    profile: {
      ...seedData.profile,
      identity: {
        ...seedData.profile.identity,
        caen: codes.map(cod => ({ cod, descriere: caenInfo(cod)?.denumire ?? '' })),
      },
    },
  });
}

function renderSurface() {
  return render(
    <StoreProvider>
      <Personas />
    </StoreProvider>,
  );
}

const textAt = (container: HTMLElement, selector: string): string | null =>
  container.querySelector(selector)?.textContent ?? null;

beforeEach(() => {
  localStorage.clear();
});

describe('the persona surface renders the match level (B-132, acceptance 3)', () => {
  it('renders a secțiune-level match with different WORDS, not a different colour', () => {
    seedDeclaredCaen(['5520', '0210']);
    const { container } = renderSurface();

    const clasaStrength = textAt(container, '[data-route-for="5520"] [data-match-strength]');
    const sectiuneStrength = textAt(container, '[data-route-for="0210"] [data-match-strength]');

    expect(clasaStrength).not.toBeNull();
    expect(sectiuneStrength).not.toBeNull();
    // The two levels must not render the same sentence. This is the assertion that fails if someone
    // collapses `levelSentence` back into one template with the level interpolated.
    expect(clasaStrength).not.toBe(sectiuneStrength);

    // A clasă route is a recommendation.
    expect(clasaStrength).toContain('recomandată');
    // A secțiune route names its own weakness, in words a reader and a test can both check.
    expect(sectiuneStrength).toContain('doar la nivel de secțiune');
    expect(sectiuneStrength).toContain('cel mai slab nivel');

    // And the level chip itself is rendered from the data layer's own labels, not re-worded here.
    expect(textAt(container, '[data-route-for="5520"] [data-match-level-label]')).toBe('clasă');
    expect(textAt(container, '[data-route-for="0210"] [data-match-level-label]')).toBe('secțiune');
  });

  it('renders what matched, so the reader can see the key rather than only its kind', () => {
    seedDeclaredCaen(['0210']);
    const { container } = renderSurface();
    const route = routePersonaForCaen('0210');
    expect(route.matchLevel).toBe('sectiune');
    const matched = textAt(container, '[data-route-for="0210"] [data-matched-on]');
    expect(matched).toContain(route.matchedOn);
    expect(matched).toContain('secțiune');
  });

  it('renders the no-route reason verbatim, and keeps the sample a different kind of object', () => {
    seedDeclaredCaen(['0510']);
    const { container } = renderSurface();
    const route = routePersonaForCaen('0510');
    expect(route.matchLevel).toBe('none');

    // Verbatim from `caenNoRouteReason` — the surface does not paraphrase why 40 clase are unreachable.
    expect(textAt(container, '[data-route-for="0510"] [data-route-reason]')).toBe(route.reason);
    expect(textAt(container, '[data-route-for="0510"] [data-route-reason]')).toContain('secțiunea B');

    // The sample is labelled as a sample and never rendered as if it were a candidate.
    expect(textAt(container, '[data-route-for="0510"] [data-sample-label]')).toBe(CAEN_SAMPLE_LABEL);
    expect(container.querySelectorAll('[data-route-for="0510"] [data-candidate]')).toHaveLength(0);
    expect(container.querySelector('[data-route-for="0510"] [data-sample-persona]')).not.toBeNull();
  });
});

describe('the persona surface renders every candidate on a tie (B-132, acceptance 4)', () => {
  it('shows all matching personas and never picks one', () => {
    seedDeclaredCaen(['4611']);
    const { container } = renderSurface();
    const route = routePersonaForCaen('4611');

    // The premise: this is genuinely a tie, and it has more than one candidate.
    expect(route.tie).toBe(true);
    expect(route.candidates.length).toBeGreaterThan(1);

    const rows = container.querySelectorAll('[data-route-for="4611"] [data-candidate]');
    expect(rows).toHaveLength(route.candidates.length);
    for (const candidate of route.candidates) {
      expect(container.querySelector(`[data-route-for="4611"] [data-candidate="${candidate.persona.id}"]`))
        .not.toBeNull();
    }

    // The tie is announced, not merely implied by a longer list.
    expect(textAt(container, '[data-route-for="4611"] [data-route-tie]'))
      .toBe(t.tieHeading(route.candidates.length));
    // And the router's own note is rendered, which is where „se afișează toate, nu se alege unul" lives.
    expect(textAt(container, '[data-route-for="4611"] [data-route-reason]'))
      .toContain('nu se alege unul');
  });
});

describe('the persona surface states its own coverage', () => {
  it('shows the measured distribution rather than a typed figure', () => {
    seedDeclaredCaen(['5520']);
    const { container } = renderSurface();
    const line = textAt(container, '[data-coverage-line]') ?? '';
    expect(line).toContain('379');
    expect(line).toContain('611');
    expect(line).toContain('651');
  });
});
