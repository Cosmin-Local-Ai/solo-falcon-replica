/**
 * Step 11 / Part C — what the personas actually exercise, **measured, not declared**.
 *
 * ## Why this file exists instead of a `regimes: [...]` field on the persona
 *
 * Brief 64 acceptance criterion 1: *„Every one of the 13 regimes is reachable through at least one persona,
 * and every one of the six `CASS_LADDER_CATEGORIES` is entered by at least one persona. **State the mapping
 * in the test file, not in prose.**"*
 *
 * A persona that *claimed* its regimes would be prose wearing a type: the day its data stopped exercising
 * one, the claim would still read true. So nothing here reads a persona's own description. Each probe runs
 * the real pipeline — `getTaxEstimate`, `getThresholdStatuses`, `getDeadlineRows`, `getVatPeriodicity`,
 * `dpiCoverageGaps` — against the persona's real dataset and asks what came out. A persona whose data drifts
 * off a regime fails this file, which is the only honest way to hold „a persona that loads without changing
 * a rung is not finished".
 *
 * ## The one regime no persona reaches as shipped, and how it is reached anyway
 *
 * `accommodation-flat-ratio` (art. 68³) applies to a private person letting **more than 7** rooms. Persona 4
 * sits at 7 — the top of the art. 85 band — because one profile-year can run only one income determination
 * method, and seeding 9 rooms would silently reclassify the persona rather than show the boundary. The
 * regime is therefore probed through persona 4 with **one declared fact changed**, which is what the brief
 * asks for: „the >7-room boundary shown as a boundary, not as data". The e2e walks the same change through
 * the Settings control.
 *
 * ## What this file does not claim
 *
 * It maps regimes to personas. It does not assert that any figure is *correct* — the regime fixtures and the
 * golden harness do that. A probe that a line exists with a value of 0 still counts as the regime being
 * reachable: the rule fired and the app showed its answer, which is what „reachable" means.
 */
import { describe, expect, it } from 'vitest';
import { getDeadlineRows, getTaxEstimate, getThresholdStatuses, getVatPeriodicity } from './dashboard';
import { PERSONAS, personaForCaen, personasForCaen } from './personas';
import { PERSONA_IDS, type PersonaId } from './personas/personaTypes';
import { contentCreatorPersona } from './personas/persona2ContentCreator';
import { fixedInstant } from '../test/fixedInstant';
import { pinClock, unpinClock } from '../test/clock';
import { CASS_LADDER_CATEGORIES, type CassLadderCategory, type CassLadderYear } from '../domain/models';
import type { FiscalRegime } from '../domain/fiscal/rules';
import { selectRuleSet } from '../domain/fiscal';
import { selectApplicableRules } from '../domain/fiscal/select';
import { dpiCoverageGaps, selectIncomeDeterminationMethod } from '../domain/estimateBasis';
import type { AppData } from './types';
import type { PersonaDefinition } from './personas/personaTypes';
import { afterEach } from 'vitest';

const AS_OF = '2026-10-31';

afterEach(() => unpinClock());

function rulesFor(data: AppData) {
  const selection = selectRuleSet(data.profile.fiscalYear, AS_OF);
  return selection ? selectApplicableRules([...selection.rules], { taxYear: data.profile.fiscalYear, asOfDate: AS_OF }) : [];
}

/** Everything the pipeline says about one persona, gathered once per persona. */
interface Evidence {
  lines: string[];
  thresholds: ReturnType<typeof getThresholdStatuses>;
  deadlines: ReturnType<typeof getDeadlineRows>;
  vat: ReturnType<typeof getVatPeriodicity>;
  gaps: ReturnType<typeof dpiCoverageGaps>;
  hasDepreciation: boolean;
  computed: boolean;
}

async function evidenceFor(data: AppData): Promise<Evidence> {
  pinClock(fixedInstant());
  const est = await getTaxEstimate(data, AS_OF);
  const thresholds = est.status === 'computed' ? getThresholdStatuses(data, AS_OF, est) : [];
  return {
    lines: est.lines.map((l) => l.label),
    thresholds,
    deadlines: getDeadlineRows(data, AS_OF),
    vat: getVatPeriodicity(data),
    gaps: dpiCoverageGaps(data, AS_OF, rulesFor(data)),
    hasDepreciation: (est.depreciation?.lines.length ?? 0) > 0,
    computed: est.status === 'computed',
  };
}

const cache = new Map<string, Promise<Evidence>>();
function evidenceForPersona(p: PersonaDefinition): Promise<Evidence> {
  let hit = cache.get(p.id);
  if (!hit) {
    hit = evidenceFor(p.data);
    cache.set(p.id, hit);
  }
  return hit;
}

/**
 * The regime → persona mapping. Each predicate is a question asked of the pipeline's own output.
 *
 * `via` is filled in by the loop below, so the failure message names the persona that was expected to
 * carry the regime and the ones that actually did — a coverage failure that only says "uncovered" sends
 * the next reader to grep.
 */
const REGIME_PROBES: ReadonlyArray<{ regime: FiscalRegime; expect: PersonaId[]; probe: (e: Evidence, d: AppData) => Promise<boolean> | boolean }> = [
  {
    regime: 'income-tax',
    expect: ['it-freelance', 'content-creator', 'ride-hailing-driver', 'agricultural-producer', 'online-commerce', 'agricultural-norma'],
    probe: (e) => e.lines.some((l) => l.startsWith('Impozit pe venit')),
  },
  {
    regime: 'cas',
    expect: ['it-freelance', 'content-creator', 'ride-hailing-driver', 'online-commerce', 'agricultural-norma'],
    probe: (e) => e.lines.some((l) => l.startsWith('CAS (25%)')),
  },
  {
    regime: 'cass',
    expect: ['it-freelance', 'content-creator', 'ride-hailing-driver', 'agricultural-producer', 'online-commerce', 'agricultural-norma'],
    probe: (e) => e.lines.some((l) => l.startsWith('CASS (10%)')),
  },
  {
    // A declared VAT status is not a cadence (B-96): the regime counts as reached only where the period
    // is DERIVED from registration facts, not merely asked about.
    regime: 'vat',
    expect: ['it-freelance', 'online-commerce'],
    probe: (e) => e.vat.kind === 'derived',
  },
  {
    regime: 'deadlines',
    expect: ['it-freelance', 'long-term-landlord', 'online-commerce'],
    probe: (e) => e.deadlines.length > 0,
  },
  {
    // The SM-multiple rows carry `computedFrom` because the lei amount is derived from the SM act, not
    // quoted from it. A persona with no such row never touches the wage reference.
    regime: 'wage-reference',
    expect: ['it-freelance', 'content-creator', 'ride-hailing-driver', 'online-commerce', 'agricultural-norma'],
    probe: (e) => e.thresholds.some((t) => t.computedFrom !== undefined),
  },
  {
    regime: 'expense-deductibility',
    expect: ['it-freelance', 'ride-hailing-driver', 'agricultural-producer', 'online-commerce', 'agricultural-norma'],
    probe: (e) => e.lines.some((l) => l === 'Cheltuieli deductibile'),
  },
  {
    regime: 'short-term-rooms-flat-ratio',
    expect: ['short-term-host'],
    probe: (e) => e.lines.some((l) => l.includes('Cheltuieli forfetare 30 %')),
  },
  {
    regime: 'accommodation-flat-ratio',
    expect: ['short-term-host'],
    probe: (_e, d) => reachArt68x3(d),
  },
  {
    regime: 'cedare-art84-flat-ratio',
    expect: ['long-term-landlord'],
    probe: (e) => e.lines.some((l) => l.includes('Venit brut art. 84 (')),
  },
  {
    regime: 'cedare-art84x1-withheld',
    expect: ['passive-investor'],
    probe: (e) => e.lines.some((l) => l.includes('Impozit reținut la sursă de plătitor')),
  },
  {
    // The DPI quota regime is reached through the coverage rows, which is where this build puts the 40 %:
    // the receipts are scoped out of the sistem-real engine on purpose, and the row quotes the quota the
    // rule itself declares.
    regime: 'dpi-flat-quota',
    expect: ['content-creator'],
    probe: (e) => e.gaps.some((g) => g.detail.includes('40%')),
  },
  {
    regime: 'contribution-withholding',
    expect: ['passive-investor', 'agricultural-norma'],
    probe: (e) => e.lines.some((l) => l.includes('reținută la sursă')),
  },
  {
    regime: 'fiscal-depreciation',
    expect: ['it-freelance', 'ride-hailing-driver'],
    probe: (e) => e.hasDepreciation,
  },
];

/**
 * Does this dataset route to the art. 68³ regime?
 *
 * **Measured as a route, not as a figure — and that distinction is the finding.** Persona 4 sits at 7 rooms,
 * inside the art. 85 band, so the probe moves the one declared fact (`accommodationRoomCounts`) past the
 * band, exactly as the e2e does through the Settings control. What comes back is not a number: this build
 * refuses an art. 68³ register with `accommodation-method-attribution-missing`, because the two legs of
 * art. 68³ are not wired apart in `domain/tax.ts` yet. Part D forbids a persona hiding an open defect, so
 * this file asserts the route AND asserts that the refusal is what the app returns. A probe that demanded a
 * computed art. 68³ total would be asking Part C to implement Part of `tax.ts`, and would have been written
 * to pass rather than to report.
 */
async function reachArt68x3(data: AppData): Promise<boolean> {
  if (data.profile.accommodationRoomCounts?.[0]?.rooms !== 7) return false;
  const over: AppData = {
    ...data,
    profile: {
      ...data.profile,
      accommodationRoomCounts: [{ fiscalYear: 2026, rooms: 8 }],
      // art. 68³ alin. (1) is an eligibility gate, not a room count: past 7 rooms the regime also needs the
      // person to be in the tourism sector. Both facts are the boundary; the room count alone is not.
      accommodationTourismEligibility: 'da',
    },
  };
  pinClock(fixedInstant());
  const method = selectIncomeDeterminationMethod(over, rulesFor(over), AS_OF);
  if (method !== 'accommodation-flat-ratio') return false;
  const est = await getTaxEstimate(over, AS_OF);
  const refusal = est.basis?.kind === 'refused'
    ? (est.scenarios ?? []).some((s) => s.id === 'accommodation-method-attribution-missing')
    : false;
  return refusal;
}

describe('step 11 — every regime is reachable through at least one persona', () => {
  for (const { regime, expect: expected, probe } of REGIME_PROBES) {
    it(`${regime} is reached`, async () => {
      const hit: PersonaId[] = [];
      for (const p of PERSONAS) {
        if (await probe(await evidenceForPersona(p), p.data)) hit.push(p.id);
      }
      // The art. 68³ regime is reached by moving persona 4 past 7 rooms — the probe does that itself, so a
      // persona sitting inside the art. 85 band still answers for the regime it crosses one fact away.
      expect(hit, `no persona reaches ${regime}; expected one of ${expected.join(', ')}`).not.toEqual([]);
      for (const id of expected) {
        expect(hit, `${id} was expected to reach ${regime}`).toContain(id);
      }
    });
  }
});

describe('step 11 — every CASS ladder category is entered by at least one persona', () => {
  // lit. e) is the category the engine fills from the art. 84 / 84¹ / 85 leg rather than from a declared
  // field, so "entered" means either the field is declared or the persona runs a method that produces it.
  const CEDARE_METHODS = ['long-term-landlord', 'passive-investor', 'short-term-host'];
  const FIELD_FOR: Record<CassLadderCategory, keyof CassLadderYear | null> = {
    proprietate_intelectuala: 'proprietateIntelectuala',
    asociere_persoana_juridica: 'asocierePersoanaJuridica',
    cedarea_folosintei_bunurilor: 'cedareaFolosinteiBunurilor',
    activitati_agricole: 'activitatiAgricole',
    investitii: 'investitii',
    alte_surse: 'alteSurse',
  };

  for (const category of CASS_LADDER_CATEGORIES) {
    it(`${category} is entered`, async () => {
      const field = FIELD_FOR[category];
      const declared = PERSONAS.filter((p) =>
        p.data.profile.cassLadderYears?.some((y) => y[field as never] !== undefined),
      ).map((p) => p.id);
      const entered = category === 'cedarea_folosintei_bunurilor'
        ? [...new Set([...declared, ...PERSONAS.filter((p) => CEDARE_METHODS.includes(p.id)).map((p) => p.id)])]
        : declared;
      expect(entered, `no persona enters the ladder category ${category}`).not.toEqual([]);
      // Every persona that declares a ladder must declare it COMPLETE: the ladder sums over all six and an
      // unanswered category makes the sum unknown, never smaller.
      for (const p of PERSONAS.filter((x) => x.data.profile.cassLadderYears?.length)) {
        for (const year of p.data.profile.cassLadderYears ?? []) {
          const missing = CASS_LADDER_CATEGORIES.filter((c) => {
            const f = FIELD_FOR[c] as never;
            return year[f] === undefined && !(c === 'cedarea_folosintei_bunurilor' && CEDARE_METHODS.includes(p.id));
          });
          expect(missing, `${p.id} declares a ladder year with unanswered categories`).toEqual([]);
        }
      }
    });
  }
});

describe('step 11 — a persona that loads without changing a rung is not finished', () => {
  it('each persona moves at least one threshold row onto its engaged side, or fires a flat-ratio / withholding line', async () => {
    for (const p of PERSONAS) {
      const e = await evidenceForPersona(p);
      const moved =
        e.thresholds.some((t) => t.engaged) ||
        e.lines.some((l) => l.includes('forfetare') || l.includes('reținut') || l.includes('reținută'));
      expect(moved, `${p.id} changes no rung, no cap and no withholding state`).toBe(true);
    }
  });

  it('each persona computes rather than refuses', async () => {
    for (const p of PERSONAS) {
      const e = await evidenceForPersona(p);
      expect(e.computed, `${p.id} does not produce a computed estimate`).toBe(true);
    }
  });
});

describe('step 11 — the CAEN→persona map (D-DEMO-3)', () => {
  it('resolves a code that several personas declare, principal first (the tie case is real, not contrived)', () => {
    // 6820 is persona 5's principal and persona 4's secondary; 5520 is the other way round.
    const by6820 = personasForCaen('6820');
    expect(by6820.map((m) => m.persona.id)).toEqual(['long-term-landlord', 'short-term-host']);
    expect(by6820[0].role).toBe('principal');
    expect(by6820[1].role).toBe('secundar');

    const by5520 = personasForCaen('5520');
    expect(by5520.map((m) => m.persona.id)).toEqual(['short-term-host', 'long-term-landlord']);
    expect(personaForCaen('5520')?.id).toBe('short-term-host');
  });

  it('answers a code nobody models with no match, and says what the miss means', async () => {
    const { caenCoverage } = await import('./personas');
    expect(personasForCaen('2511')).toEqual([]);
    expect(personaForCaen('2511')).toBeUndefined();
    const coverage = caenCoverage();
    expect(coverage.unmappedClasses).toBeGreaterThan(coverage.mappedClasses);
    expect(coverage.missMeaning).toContain('nu că codul nu există');
  });

  it('leaves the persona with no CAEN out of the map, and keeps it in the list', async () => {
    const { PERSONAS: list, caenCoverage } = await import('./personas');
    const investor = list.find((p) => p.id === 'passive-investor');
    expect(investor).toBeDefined();
    expect(investor?.caen.principal).toBe('');
    expect(personasForCaen('')).toEqual([]);
    expect(caenCoverage().coveredClasses).not.toContain('');
  });
});

describe('step 11 — the persona set itself', () => {
  it('the set matches the declared ids, in order, with no duplicate', () => {
    expect(PERSONAS.map((p) => p.id)).toEqual([...PERSONA_IDS]);
    expect(new Set(PERSONAS.map((p) => p.id)).size).toBe(PERSONAS.length);
  });

  it('persona 2 is the DPI persona and persona 6 is not a second producer of the same DPI', async () => {
    pinClock(fixedInstant());
    const p2 = await evidenceForPersona(contentCreatorPersona);
    expect(p2.gaps.some((g) => g.reason === 'dpi_income_not_modelled')).toBe(true);
    // Persona 6 declares the DPI net on the ladder and records no art. 70 receipt: the two routes stay apart.
    const dpiRecords = PERSONAS.find((p) => p.id === 'passive-investor')!.data.revenues.filter(
      (r) => r.incomeCategory === 'drepturi_de_proprietate_intelectuala',
    );
    expect(dpiRecords).toEqual([]);
  });

  it('exactly one persona exercises the normă measurement, and it declares rather than derives it', () => {
    const norma = PERSONAS.filter((p) =>
      p.data.profile.cassLadderYears?.some((y) => y.activitatiAgricoleBaza === 'norma_de_venit'),
    );
    expect(norma.map((p) => p.id)).toEqual(['agricultural-norma']);
    // D-NORMA-2 stays open as a data question: the app ships no norm table, and the figure is the
    // taxpayer's own declaration. Nothing here may compute one.
    expect(norma[0].data.profile.cassLadderYears?.[0]?.activitatiAgricole).toBeDefined();
  });
});
