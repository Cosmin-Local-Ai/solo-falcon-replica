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
import { CAEN_ENTRIES } from './caenRev3';
import {
  CAEN_DEMO_SAMPLE_PERSONA_ID,
  CAEN_MATCH_LEVEL_LABELS,
  CAEN_SAMPLE_LABEL,
  PERSONAS,
  caenCoverage,
  personaForCaen,
  personasForCaen,
  routePersonaForCaen,
} from './personas';
import { PERSONA_IDS, type PersonaId } from './personas/personaTypes';
import { contentCreatorPersona } from './personas/persona2ContentCreator';
import { fixedInstant } from '../test/fixedInstant';
import { pinClock, unpinClock } from '../test/clock';
import { CASS_LADDER_CATEGORIES, type CassLadderCategory, type CassLadderYear } from '../domain/models';
import { lei } from '../domain/money';
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
  it('each persona moves at least one threshold row off its default answer, or fires a flat-ratio / withholding line', async () => {
    for (const p of PERSONAS) {
      const e = await evidenceForPersona(p);
      // RE-PINNED by B-129/B-130. The predicate used to accept only `engaged`, which silently meant "this
      // persona's numbers sit on the consequential side of a level". For the pensioner persona that is now
      // false by law — art. 150 alin. (1) removes CAS entirely and art. 174 alin. (7) lit. c) removes the
      // art. 174 alin. (6) top-up — and the engine now says so instead of reporting those levels as
      // engaged. A row the law disapplies for this person is just as much a rung moved as one crossed, so
      // the probe asks the question it always meant: did this persona's data change the app's answer?
      const moved =
        e.thresholds.some((t) => t.engaged) ||
        e.thresholds.some((t) => t.applicability === 'not_applicable') ||
        e.lines.some((l) => l.includes('forfetare') || l.includes('reținut') || l.includes('reținută'));
      expect(moved, `${p.id} changes no rung, no cap, no relief and no withholding state`).toBe(true);
    }
  });

  it('each persona computes rather than refuses', async () => {
    for (const p of PERSONAS) {
      const e = await evidenceForPersona(p);
      expect(e.computed, `${p.id} does not produce a computed estimate`).toBe(true);
    }
  });
});

describe('B-129 / B-130 — the flat-ratio profiles: each minimum row agrees with the figure on its own line', () => {
  /**
   * The three profiles the persona run surfaced the defects on. All three let their register be determined
   * under a flat ratio — art. 85 (7 camere), art. 84 (arendă / chirii), art. 84^1 (cedare cu reținere la
   * sursă) — which is what makes the register supply no art. 155 alin. (1) lit. b) source at all.
   *
   * They are asserted one at a time, not as a group, because the point of the fix is that the verdict is
   * per category: persona 6 declares art. 72/72¹/73 intellectual-property income, which IS inside the
   * art. 148 alin. (3) CAS cumulation, and must therefore keep the CAS rows applicable while the other two
   * lose them.
   */
  const FLAT_RATIO: PersonaId[] = ['short-term-host', 'long-term-landlord', 'passive-investor'];

  async function evidence(personaId: PersonaId) {
    const p = PERSONAS.find((x) => x.id === personaId)!;
    pinClock(fixedInstant());
    const est = await getTaxEstimate(p.data, AS_OF);
    if (est.status !== 'computed') throw new Error(`${personaId}: the pipeline must compute, not refuse`);
    return { est, rows: getThresholdStatuses(p.data, AS_OF, est) };
  }

  const lineStartingWith = (est: Awaited<ReturnType<typeof evidence>>['est'], prefix: string) =>
    est.lines.find((l) => l.label.startsWith(prefix));

  for (const personaId of FLAT_RATIO) {
    it(`${personaId}: no lit. b) source, and the engine says so`, async () => {
      const { est } = await evidence(personaId);
      // The fact the rows read. `venitulNetDinActivitate` is 0 for all three, which is exactly why an
      // amount could not carry this verdict — a loss-making PFA gives the same 0 and gets the opposite one.
      expect(est.bases.venitulNetDinActivitate, personaId).toBe(lei(0));
      expect(est.contributionCategories.independentActivity, personaId).toBe('nu');
    });

    it(`${personaId}: the CASS 6-SM row does not claim a top-up, and says which route the CASS on the line beside it came from`, async () => {
      const { est, rows } = await evidence(personaId);
      const row = rows.find((t) => t.thresholdId === 'CASS_MIN_BASE')!;
      // B-130 reported `unknown`. The law is settled for these categories, so the honest verdict is
      // `not_applicable`, with the article that limits art. 174 alin. (6) to the lit. b) base.
      expect(row.applicability, personaId).toBe('not_applicable');
      expect(row.engaged, personaId).toBe(false);
      expect(row.status, personaId).toBe('ok');
      expect(row.severity, personaId).toBe('none');
      expect(row.applicabilityReason ?? '', personaId).toContain('art. 174 alin. (6)');
      expect(row.applicabilityReason ?? '', personaId).toContain('art. 155 alin. (1) lit. b)');
      expect(row.applicabilityReason ?? '', personaId).toContain('art. 170 alin. (2)-(4)');
      expect(row.applicabilityReason ?? '', personaId).toContain('art. 174¹ alin. (1)');
      // And the figure beside it really is a CASS liability — reached by the ladder, not by the top-up.
      // A row that says "this minimum does not apply" next to a non-zero CASS is only honest if it names
      // the other route, which is what the reason above does.
      const ladderCass = lineStartingWith(est, 'CASS pe veniturile din art. 155 alin. (1) lit. c)-h)');
      expect(ladderCass, `${personaId}: expected a lit. c)-h) CASS line`).toBeDefined();
      expect(ladderCass!.value, personaId).toBeGreaterThan(lei(0));
      expect(lineStartingWith(est, 'CASS (10%)')!.value, personaId).toBe(lei(0));
    });
  }

  for (const personaId of (['short-term-host', 'long-term-landlord'] as const)) {
    it(`${personaId}: the CAS rows do not assert a minimum for a contribution the law never charges`, async () => {
      const { est, rows } = await evidence(personaId);
      expect(est.contributionCategories.casBearing, personaId).toBe('nu');
      expect(lineStartingWith(est, 'CAS (25%)')!.value, personaId).toBe(lei(0));
      for (const id of ['CAS_MIN_BASE', 'CAS_TIER2_FLOOR']) {
        const row = rows.find((t) => t.thresholdId === id)!;
        expect(row.applicability, `${personaId}/${id}`).toBe('not_applicable');
        expect(row.engaged, `${personaId}/${id}`).toBe(false);
        expect(row.status, `${personaId}/${id}`).toBe('ok');
        expect(row.severity, `${personaId}/${id}`).toBe('none');
        expect(row.applicabilityReason ?? '', `${personaId}/${id}`).toContain('art. 148 alin. (1)');
        expect(row.applicabilityReason ?? '', `${personaId}/${id}`).toContain('art. 137 alin. (1) lit. b) și b^1)');
      }
    });
  }

  it('passive-investor keeps the CAS rows applicable, because its art. 72/72¹/73 amount is inside art. 148 alin. (3)', async () => {
    // The per-category half of the acceptance. This persona declares 30.000 lei of intellectual-property
    // income, and B-112 stage 2 put that litera into the CAS cumulation — so the 12-SMN level IS in play,
    // the measured amount is under it, and the CAS line of 0 is the row's own consequence, not a
    // contradiction. A blanket "flat-ratio profiles get no CAS rows" would have been wrong here.
    const { est, rows } = await evidence('passive-investor');
    expect(est.contributionCategories.casBearing).toBe('da');
    expect(lineStartingWith(est, 'CAS (25%)')!.value).toBe(lei(0));
    const row = rows.find((t) => t.thresholdId === 'CAS_MIN_BASE')!;
    expect(row.applicability).toBe('applicable');
    expect(row.engaged).toBe(true);
    expect(row.consequence).toContain('nu se datorează contribuția de asigurări sociale');
    // KNOWN GAP, minted as B-133 and NOT fixed here: the row measures `net-income`, which is the art. 170
    // alin. (1) (lit. b)) cumulation — 0 for this register — while `calcCas` measured on the art. 148
    // alin. (3) cumulation, which includes the 30.000 lei of DPI. Same side of the 12-SMN floor, so the
    // verdict and the figure agree; the amount beside the row is understated. Closing it needs a second
    // amount concept in `FiscalBase`, which is the Phase 8 base-semantics surface, not B-129/B-130.
    expect(lineStartingWith(est, 'Venit cumulat pentru CAS (art. 148 alin. (3)')!.value).toBe(lei(30_000));
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

  it('answers a code nobody models with no exact match, and says what the miss means', async () => {
    const { caenCoverage } = await import('./personas');
    // The exact map is still exact: B-128 added a route, it did not pretend 2511 is a persona's code.
    expect(personasForCaen('2511')).toEqual([]);
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

describe('B-128 — every clasă routes to a demo, by the nomenclator’s own lineage', () => {
  const CLASE = CAEN_ENTRIES.filter((e) => e.nivel === 'clasa');

  it('routes every clasă in the nomenclator by lineage, or says exactly why it cannot', () => {
    // Iterated over the nomenclator, not over a list of examples: the requirement is about all 651.
    expect(CLASE.length).toBe(651);
    for (const entry of CLASE) {
      const route = routePersonaForCaen(entry.cod);
      const routed = route.matchLevel !== 'none';
      if (routed) {
        expect(route.candidates.length, `${entry.cod} routed with no candidate`).toBeGreaterThan(0);
        expect(route.tie).toBe(route.candidates.length > 1);
        expect(route.sample, `${entry.cod} matched and also carried a sample`).toBeUndefined();
        expect(route.matchedOn, `${entry.cod} routed without naming the ancestor`).not.toBe('');
      } else {
        // A no-route answer must be explainable and must not dead-end: it carries the sample instead.
        expect(route.candidates).toEqual([]);
        expect(route.matchedOn).toBe('');
        expect(route.sample?.id).toBe(CAEN_DEMO_SAMPLE_PERSONA_ID);
        expect(route.reason).toContain(`secțiunea ${entry.sectiune}`);
      }
      for (const m of route.candidates) {
        expect(PERSONAS.some((p) => p.id === m.persona.id), `${entry.cod} routed to an unknown persona`).toBe(true);
      }
    }
  });

  it('the lineage never leaves the nomenclator’s own prefixes — there is no semantic matching', () => {
    // The structural proof that no fuzzy matching exists: every match is a code prefix or a section letter.
    for (const entry of CLASE) {
      const route = routePersonaForCaen(entry.cod);
      if (route.matchLevel === 'none') continue;
      const ok =
        route.matchLevel === 'sectiune'
          ? route.matchedOn === entry.sectiune
          : entry.cod.startsWith(route.matchedOn) && route.matchedOn.length > 0;
      expect(ok, `${entry.cod} matched on ${route.matchedOn}, which is not a lineage ancestor`).toBe(true);
    }
  });

  it('the distribution across levels is the measured one, and it is the deliverable', () => {
    const c = caenCoverage();
    // Pinned deliberately: these numbers say how much of the nomenclator is genuinely covered and how much
    // is reached only by a weak fallback. If a persona is added they move, and that is the point of pinning.
    expect(c.matchLevelCounts).toEqual({ clasa: 34, grupa: 36, diviziune: 97, sectiune: 331, none: 153 });
    expect(c.routedClasses).toBe(498);
    expect(c.unroutedClasses).toBe(153);
    expect(c.routedClasses + c.unroutedClasses).toBe(c.totalClasses);
    expect(Object.values(c.matchLevelCounts).reduce((a, b) => a + b, 0)).toBe(c.totalClasses);
    expect(c.tieClasses).toBe(104);
    // A secțiune-level route is the majority of what "coverage" here means. Stated, not implied.
    expect(c.matchLevelCounts.sectiune).toBeGreaterThan(c.routedClasses / 2);
  });

  it('the 153 uncovered clase are a coverage gap in 11 named secțiuni, not scattered misses (B-131)', () => {
    const c = caenCoverage();
    expect(c.sectiuniWithoutPersona).toEqual(['B', 'D', 'E', 'F', 'L', 'P', 'Q', 'R', 'T', 'U', 'V']);
    expect(Object.keys(c.unroutedBySectiune).sort()).toEqual(c.sectiuniWithoutPersona);
    expect(Object.values(c.unroutedBySectiune).reduce((a, b) => a + b, 0)).toBe(c.unroutedClasses);
    // Every clasă in a secțiune with a persona routes; every clasă in one without does not.
    for (const entry of CLASE) {
      const hasPersona = !c.sectiuniWithoutPersona.includes(entry.sectiune);
      expect(routePersonaForCaen(entry.cod).matchLevel !== 'none', entry.cod).toBe(hasPersona);
    }
  });

  it('names the level it matched at, from the exact case down to the weakest', () => {
    // Every code here is a real clasă in docs/ai/data/caen_rev3.csv. 6201 and 6202 are not: they are Rev.2
    // codes and Rev.3 does not contain them, so the register row’s `6202` example cannot be tested.
    expect(routePersonaForCaen('6210')).toMatchObject({ matchLevel: 'clasa', matchedOn: '6210', tie: false });
    expect(routePersonaForCaen('4931')).toMatchObject({ matchLevel: 'grupa', matchedOn: '493' });
    expect(routePersonaForCaen('4911')).toMatchObject({ matchLevel: 'diviziune', matchedOn: '49' });
    expect(routePersonaForCaen('2511')).toMatchObject({ matchLevel: 'sectiune', matchedOn: 'C' });
    expect(routePersonaForCaen('4931').candidates.map((m) => m.persona.id)).toEqual(['ride-hailing-driver']);
    expect(routePersonaForCaen('4911').candidates.map((m) => m.persona.id)).toEqual(['ride-hailing-driver']);
    // The weakest route is labelled as weak, in the reason the UI renders.
    expect(routePersonaForCaen('2511').reason).toContain('Potrivire slabă');
    expect(routePersonaForCaen('2511').candidates.map((m) => m.persona.id)).toEqual(['agricultural-producer']);
    expect(personaForCaen('2511')?.id).toBe('agricultural-producer');
  });

  it('returns every candidate on a tie at every level, never a silent pick', () => {
    const ties: [string, string, string[]][] = [
      ['4721', 'clasa', ['agricultural-norma', 'agricultural-producer']],
      ['4722', 'grupa', ['agricultural-norma', 'agricultural-producer']],
      // Diviziunea 47 holds three personas: commerce declares 4791 as principal, normă declares 4721 as
      // principal, the agricultural producer declares 4721 as secondary — so principal first puts 4791 ahead.
      ['4730', 'diviziune', ['online-commerce', 'agricultural-norma', 'agricultural-producer']],
      ['4611', 'sectiune', ['online-commerce', 'agricultural-norma', 'agricultural-producer']],
    ];
    for (const [cod, level, ids] of ties) {
      const route = routePersonaForCaen(cod);
      expect(route.matchLevel, cod).toBe(level);
      expect(route.tie, cod).toBe(true);
      expect(route.candidates.map((m) => m.persona.id), cod).toEqual(ids);
      // Principal first, so the convenience accessor is ranked rather than arbitrary — and the tie is one
      // call away for anything that has to show the choice.
      expect(personaForCaen(cod)?.id, cod).toBe(ids[0]);
    }
  });

  it('a sample is a different kind of answer from a match, and is labelled so', () => {
    const route = routePersonaForCaen('0710'); // Extracția minereurilor feroase — secțiunea B, no persona.
    expect(route.matchLevel).toBe('none');
    expect(route.candidates).toEqual([]);
    expect(route.sample?.id).toBe('online-commerce');
    expect(route.reason).toContain('Niciun persona demonstrativ');
    expect(route.reason).not.toContain('aceeași');
    // The sample must never be reachable through the match path, at any level.
    for (const cod of ['6210', '4931', '4911', '2511', '4721']) {
      expect(routePersonaForCaen(cod).sample, cod).toBeUndefined();
    }
    // And the wording the UI renders keeps the two apart.
    expect(CAEN_SAMPLE_LABEL).toBe('Exemplu demonstrativ — nu activitatea dumneavoastră');
    for (const level of ['clasa', 'grupa', 'diviziune', 'sectiune', 'none'] as const) {
      expect(CAEN_MATCH_LEVEL_LABELS[level]).toBeTruthy();
      expect(CAEN_SAMPLE_LABEL).not.toBe(CAEN_MATCH_LEVEL_LABELS[level]);
    }
    expect(new Set(Object.values(CAEN_MATCH_LEVEL_LABELS)).size).toBe(5);
  });

  it('refuses a sample for a code that is not in the nomenclator at all', () => {
    // 6201 is a Rev.2 code Rev.3 dissolved. Offering a demo for it would paper over an input error.
    for (const cod of ['6201', '6202', '9999', '']) {
      const route = routePersonaForCaen(cod);
      expect(route.matchLevel, cod).toBe('none');
      expect(route.sample, cod).toBeUndefined();
      expect(route.candidates, cod).toEqual([]);
    }
    expect(routePersonaForCaen('6201').reason).toContain('nu există în CAEN Rev.3');
  });

  it('routes a grupa or diviziune code by the level it actually is', () => {
    // The picker only ever hands a clasă, but the map is queried with partial codes elsewhere.
    expect(routePersonaForCaen('621')).toMatchObject({ matchLevel: 'grupa', matchedOn: '621' });
    expect(routePersonaForCaen('49')).toMatchObject({ matchLevel: 'diviziune', matchedOn: '49' });
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
