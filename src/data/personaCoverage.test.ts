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
import { dpiCoverageGaps, selectIncomeDeterminationMethod, selectDeductibleExpenses } from '../domain/estimateBasis';
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

describe('B-131 — the six new personas: what each one proves, measured through the pipeline', () => {
  /**
   * The brief's rule for a persona is *„a persona that loads without changing a rung is not finished"*, and
   * B-131 adds the demand that the new ones be chosen for what a Romanian PFA actually does. Both are
   * checked here against the pipeline's own output: the expense set (`selectDeductibleExpenses`) says which
   * rule classified each row and which rows left the base and why; the estimate says what the totals became.
   * The figures are pinned so that a persona drifting off its showcase fails a test instead of quietly
   * becoming decoration.
   */
  async function probe(personaId: PersonaId) {
    const p = PERSONAS.find((x) => x.id === personaId)!;
    pinClock(fixedInstant());
    const set = selectDeductibleExpenses(p.data, AS_OF, rulesFor(p.data));
    const est = await getTaxEstimate(p.data, AS_OF);
    if (est.status !== 'computed') throw new Error(`${personaId}: the pipeline must compute, not refuse`);
    return {
      p,
      set,
      est,
      rows: getThresholdStatuses(p.data, AS_OF, est),
      net: () => est.bases.venitulNetDinActivitate / 100,
      lei: (v: number) => v / 100,
      total: (label: string) => est.lines.find((l) => l.label.startsWith(label))!.value / 100,
      lineFor: (category: string) => set.lines.find((l) => l.category === category),
      excludedFor: (category: string) => set.excluded.filter((x) => x.category === category),
      cappedFor: (category: string) => set.annualCapped.find((l) => l.category === category),
    };
  }

  for (const id of [
    'construction-finisher',
    'music-teacher',
    'physiotherapist',
    'hair-salon',
    'insurance-agent',
    'waste-collector',
  ] as PersonaId[]) {
    it(`${id}: computes, and engages the CAS 24-smn rung`, async () => {
      const x = await probe(id);
      const row = x.rows.find((t) => t.thresholdId === 'CAS_TIER2_FLOOR')!;
      expect(row.engaged, id).toBe(true);
      expect(row.thresholdValue / 100, id).toBe(97_200);
      expect(x.total('Venit net din activitate'), id).toBeGreaterThan(97_200);
    });
  }

  it('construction-finisher: exclusive-use van at 100 %, and the protocol ceiling cuts 442 lei', async () => {
    const x = await probe('construction-finisher');
    // The van's running costs go in whole, on the `exclusive` + foaie de parcurs leg — the pair of persona 3's
    // 50 % default. 700 lei x 10 months of fuel plus 3.200 of service = 10.200, and none of it is halved.
    const vehicle = x.lineFor('vehicle_related')!;
    expect(vehicle.ruleId).toBe('EXPENSE_VEHICLE_EXCLUSIVE_USE_2026');
    expect(vehicle.treatment).toBe('deductible');
    expect(x.lei(vehicle.exclVat)).toBe(10_200);
    // Protocol is held back for the assembler's annual pass, and the ceiling is what trims it.
    const protocol = x.cappedFor('protocol')!;
    expect(x.lei(protocol.exclVat)).toBe(3_300);
    const allowed = x.total('Cheltuieli deductibile') - (119_000 + 20_000 + 10_200 + 12_400);
    expect(allowed).toBeCloseTo(2_858, 2);
    expect(x.total('Cheltuieli deductibile')).toBe(164_458);
    expect(x.net()).toBe(127_642);
  });

  it('music-teacher: the euro pension ceiling is reached and NOT struck; the home-office split stays undetermined', async () => {
    const x = await probe('music-teacher');
    // Ten monthly contributions of 300 lei. The rule finds them, treats them as capped, and the ceiling
    // cannot be computed — so they leave the base with the conflict named, which is the showcase.
    const pensions = x.excludedFor('private_pension_contribution');
    expect(pensions.length).toBe(10);
    expect(new Set(pensions.map((e) => e.reason))).toEqual(new Set(['cap_unresolved']));
    expect(pensions[0].detail).toContain('cursul mediu');
    expect(pensions[0].detail).toContain('data plății');
    // The home-office utilities: the law allows the activity's share and supplies no method for the share.
    expect(x.excludedFor('home_office_shared_cost').map((e) => e.reason)).toEqual(['undetermined', 'undetermined']);
    // And the register does hold EUR rates: the twelve platform receipts entered the lei base through them.
    expect(x.set.conversions.length).toBe(12);
    expect(x.total('Cheltuieli deductibile')).toBe(25_000);
    expect(x.net()).toBe(128_750);
  });

  it('physiotherapist: a euro ceiling that cannot be struck next to a lei ceiling that can', async () => {
    const x = await probe('physiotherapist');
    expect(x.excludedFor('voluntary_health_insurance').length).toBe(10);
    expect(new Set(x.excludedFor('voluntary_health_insurance').map((e) => e.reason))).toEqual(new Set(['cap_unresolved']));
    // The coleg contribution is capped at 5 % of gross — a lei base — so the assembler strikes it and, being
    // inside it, the whole 1.200 lei stays in the base.
    const dues = x.cappedFor('mandatory_professional_contribution')!;
    expect(dues.ruleId).toBe('EXPENSE_PROFESSIONAL_CONTRIBUTION_2026');
    expect(x.lei(dues.exclVat)).toBe(1_200);
    expect(x.total('Cheltuieli deductibile')).toBe(50_400);
    expect(x.net()).toBe(177_100);
  });

  it('hair-salon: the 1 martie date gate shows as two different answers for two identical rows', async () => {
    const x = await probe('hair-salon');
    // January: no rule in force covers the category, and art. 68 alin. (7) lit. l) is an open clause.
    expect(x.excludedFor('pepp_contribution').filter((e) => e.reason === 'undetermined').length).toBe(1);
    // March onwards: classified under the PEPP rule, then held out because the euro ceiling is unconvertible.
    expect(x.excludedFor('pepp_contribution').filter((e) => e.reason === 'cap_unresolved').length).toBe(8);
    // The protocol ceiling IS strikable: 4.000 lei recorded, 2.290 lei admitted, 1.710 lei lost.
    expect(x.lei(x.cappedFor('protocol')!.exclVat)).toBe(4_000);
    const allowed = x.total('Cheltuieli deductibile') - (14_000 + 9_000 + 40_000 + 7_600);
    expect(allowed).toBeCloseTo(2_290, 2);
    expect(x.net()).toBe(104_610);
  });

  it('insurance-agent: the mixed-use car is halved, and the euro union dues leave the base', async () => {
    const x = await probe('insurance-agent');
    const vehicle = x.lineFor('vehicle_related')!;
    expect(vehicle.ruleId).toBe('EXPENSE_VEHICLE_MIXED_USE_2026');
    expect(vehicle.treatment).toBe('capped');
    // 5.000 lei of fuel and 1.200 of service by 31 October, halved by the statutory default.
    expect(x.lei(vehicle.exclVat)).toBe(3_100);
    expect(x.excludedFor('professional_body_dues').map((e) => e.reason)).toEqual(['cap_unresolved']);
    // The net approaches the CASS 72-smn ceiling (291.600 lei) without reaching it.
    expect(x.net()).toBe(282_400);
    const cassMax = x.rows.find((t) => t.thresholdId === 'CASS_MAX_BASE')!;
    expect(cassMax.engaged).toBe(false);
  });

  it('waste-collector: the goods-transport exception keeps the truck at 100 %, and the M1 ceiling does not touch it', async () => {
    const x = await probe('waste-collector');
    const vehicle = x.lineFor('vehicle_related')!;
    // The exception category routes to the same 100 % answer as evidenced exclusive use — and the amount
    // proves it: 22.000 lei of fuel plus 4.500 of service, whole, where the default would have admitted 13.250.
    expect(vehicle.ruleId).toBe('EXPENSE_VEHICLE_EXCLUSIVE_USE_2026');
    expect(x.lei(vehicle.exclVat)).toBe(26_500);
    // 168.000 lei over 84 months is 2.000 lei a month, above the 1.500-lei/lună ceiling — and nothing is lost,
    // because that ceiling is stated for M1 passenger cars and this is a collection truck.
    const dep = x.est.depreciation!.lines[0];
    expect(dep.uncapped / 100).toBe(24_000);
    expect(dep.deductible / 100).toBe(24_000);
    expect(dep.lost).toBe(0);
    expect(x.total('Cheltuieli deductibile')).toBe(95_500);
    expect(x.net()).toBe(157_500);
  });
});

describe('B-131 — the secțiune verdicts, measured against the routing, not against prose', () => {
  /**
   * B-131 asked for a recorded verdict per secțiune: a persona, a reasoned non-coverage, or a partial
   * coverage naming the clase that stay out. A prose register rots the day a persona changes, so the verdicts
   * live here, next to the measurement that can falsify them. Three things are checked for every row:
   *
   * 1. `no-persona` really means **no clasă in that secțiune routes** — not "we chose not to".
   * 2. `persona` / `partial` really means **every clasă in it routes**, by some lineage level.
   * 3. Every clasă named in `outOfScope` is a **real clasă in the shipped nomenclator** and is **declared by
   *    no persona** — so "these stay out" is a fact about the data, not a sentence about intent.
   *
   * The letters are the ones `docs/ai/data/caen_rev3.csv` carries, because they are the letters the router
   * matches on. That file letters the sections A–V and splits 58-60 / 61-63 / 64-66 into J / K / L, where the
   * printed CAEN Rev.3 nomenclator has one section J (58-63) and a section K (64-66); the shift is a defect
   * in the reference data, reported in the B-131 register row and NOT fixed here, because fixing it moves
   * every secțiune-level route and the pins below.
   */
  type Verdict = 'persona' | 'partial' | 'no-persona';
  const VERDICTS: ReadonlyArray<{ sectiune: string; denumire: string; verdict: Verdict; outOfScope?: string[]; note: string }> = [
    { sectiune: 'A', denumire: 'agricultură, vânătoare și servicii anexe', verdict: 'persona', note: 'persona 7 (0125) și persona 9 (normă de venit); 3 clase declarate din 39 — restul pe ruta de secțiune; anterior B-131' },
    { sectiune: 'B', denumire: 'industria extractivă', verdict: 'no-persona', note: 'nicio activitate PFA obișnuită: cariere și extracție cu autorizații de mediu și titlu minier; utilizatorul primește exemplul demonstrativ, nu un persona' },
    { sectiune: 'C', denumire: 'industria prelucrătoare', verdict: 'partial', note: 'o singură clasă declarată în C: 1039 (brutărie, la persona 7); celelalte 231 sunt atinse doar pe ruta de secțiune — acoperire slabă, marcată ca atare în UI' },
    { sectiune: 'D', denumire: 'producția și furnizarea de energie electrică și termică, gaze, apă caldă, aer condiționat', verdict: 'no-persona', note: 'utilități reglementate: licență ANRE, nu obiect de activitate PFA' },
    {
      sectiune: 'E',
      denumire: 'colectarea și epurarea apelor, gestionarea deșeurilor și activități de decontaminare',
      verdict: 'partial',
      outOfScope: ['3600', '3700', '3812', '3822', '3823', '3831', '3832', '3833', '3900'],
      note: 'persona 15 (3811, 3821); apa și canalul sunt sistem licențiat, iar deșeurile periculoase, incinerarea, depozitul și decontaminarea au regim propriu de autorizare',
    },
    {
      sectiune: 'F',
      denumire: 'construcții',
      verdict: 'partial',
      outOfScope: ['4100', '4211', '4221', '4291', '4311', '4312', '4313'],
      note: 'persona 10 (4334 + 4331-4333, 4335); construcția de clădiri și lucrările de infrastructură, demolările, pregătirea terenului și forajul cer altă scală, autorizație de constructor și utilaje — nu un PFA cu o dubă',
    },
    { sectiune: 'G', denumire: 'comerț', verdict: 'persona', note: 'persona 8 (4791) și persona 9 (4721); anterior B-131' },
    { sectiune: 'H', denumire: 'transport și depozitare', verdict: 'persona', note: 'persona 3 (4933) cu 4932, 4941, 5320; anterior B-131' },
    { sectiune: 'I', denumire: 'hoteluri și restaurante', verdict: 'partial', note: 'persona 4 declară 5510, 5520, 5540, 5590 ca secondary; restul de 7 clase pe ruta de secțiune' },
    { sectiune: 'J', denumire: 'informații și comunicări (58-60 în fișierul shipped)', verdict: 'partial', note: 'persona 1 (5829) și persona 2 (5811, 5920) — clase secondary; 12 din 15 rămân pe secțiune' },
    { sectiune: 'K', denumire: 'informații și comunicări (61-63 în fișierul shipped)', verdict: 'persona', note: 'persona 1 are activitatea de bază aici (6210, 6220, 6290, plus 6310/6391); anterior B-131' },
    {
      sectiune: 'L',
      denumire: 'intermedieri financiare și asigurări (64-66 în fișierul shipped)',
      verdict: 'partial',
      outOfScope: ['6411', '6419', '6421', '6422', '6431', '6432', '6491', '6492', '6499', '6511', '6512', '6520', '6530', '6611', '6612', '6630'],
      note: 'persona 14 (6622, 6629): agentul de asigurări e intermediar autorizat, nu bancă; underwriting-ul, creditarea, leasingul, fondurile și administrarea de piețe cer autorizații pe care un PFA nu le deține',
    },
    { sectiune: 'M', denumire: 'activități imobiliare (68 în fișierul shipped)', verdict: 'persona', note: 'persona 5 are activitatea de bază aici (6820, plus 6811, 6812, 6831); anterior B-131' },
    { sectiune: 'N', denumire: 'activități profesionale, științifice și tehnice', verdict: 'partial', note: 'o singură clasă declarată: 7420 (persona 2); celelalte 21 pe ruta de secțiune' },
    { sectiune: 'O', denumire: 'activități de servicii administrative și de suport', verdict: 'partial', note: 'o singură clasă declarată: 7711 (persona 3, închiriere cu șofer); celelalte 31 pe ruta de secțiune' },
    { sectiune: 'P', denumire: 'administrație publică și apărută; asigurări sociale din sistemul public', verdict: 'no-persona', note: 'un PFA nu poate fi autoritate publică; autoritatea publică apare ca CLIENT (persona 15), nu ca profil' },
    {
      sectiune: 'Q',
      denumire: 'învățământ',
      verdict: 'partial',
      outOfScope: ['8510', '8520', '8531', '8532', '8533', '8540'],
      note: 'persona 11 (8552, 8559, 8569): lecții particulare și cursuri non-formale; grădinița, școala, liceul și universitatea sunt unități de învățământ cu acreditare, nu activitate PFA',
    },
    {
      sectiune: 'R',
      denumire: 'sănătate și asistență socială',
      verdict: 'partial',
      outOfScope: ['8610', '8691', '8692', '8710', '8720', '8730'],
      note: 'persona 12 (8695, 8699): cabinet ambulatoriu; spitalul, imagistica și laboratorul, ambulanța și centrele cu cazare sunt unități cu autorizație proprie',
    },
    { sectiune: 'S', denumire: 'artă, activități recreative și distractive', verdict: 'partial', note: 'persona 2 declară 9011 (activități de creație artistică); celelalte 19 rămân pe ruta de secțiune' },
    {
      sectiune: 'T',
      denumire: 'alte activități de servicii',
      verdict: 'partial',
      outOfScope: ['9411', '9412', '9420', '9491', '9492', '9499'],
      note: 'persona 13 (9621, 9622): coafură și înfrumusețare; organizațiile patronale, profesionale, sindicale, religioase și politice sunt organizații de membri, nu activitate PFA',
    },
    { sectiune: 'U', denumire: 'activități ale gospodăriilor casnice', verdict: 'no-persona', note: 'angajarea de personal de către gospodării (menaj, bonă, îngrijire la domiciliu): angajatorul e o persoană fizică în gospodărie, nu o PFA cu obiect de activitate; motorul nu are payroll' },
    { sectiune: 'V', denumire: 'activități ale organizațiilor și extra-teritoriale', verdict: 'no-persona', note: 'ambasade, organizații internaționale, organisme extra-teritoriale: nu există o astfel de activitate pentru un micro-agent economic român' },
  ];

  const CLASE_BY_SECZIUNE = new Map<string, string[]>();
  for (const e of CAEN_ENTRIES.filter((x) => x.nivel === 'clasa')) {
    const list = CLASE_BY_SECZIUNE.get(e.sectiune) ?? [];
    list.push(e.cod);
    CLASE_BY_SECZIUNE.set(e.sectiune, list);
  }

  it('the verdict table covers every secțiune the nomenclator has, exactly once', () => {
    expect(VERDICTS.map((v) => v.sectiune)).toEqual([...CLASE_BY_SECZIUNE.keys()].sort());
    expect(VERDICTS.length).toBe(22);
  });

  it('a `no-persona` verdict is a measured fact: not one clasă in that secțiune routes', () => {
    for (const v of VERDICTS.filter((x) => x.verdict === 'no-persona')) {
      const clase = CLASE_BY_SECZIUNE.get(v.sectiune)!;
      for (const cod of clase) {
        expect(routePersonaForCaen(cod).matchLevel, `${v.sectiune}/${cod}`).toBe('none');
      }
    }
    // And the converse: every secțiune NOT marked no-persona routes in full.
    for (const v of VERDICTS.filter((x) => x.verdict !== 'no-persona')) {
      for (const cod of CLASE_BY_SECZIUNE.get(v.sectiune)!) {
        expect(routePersonaForCaen(cod).matchLevel, `${v.sectiune}/${cod}`).not.toBe('none');
      }
    }
  });

  it('a `partial` verdict names clase that really are out: they exist, and no persona declares them', () => {
    const declared = new Set<string>();
    for (const p of PERSONAS) {
      if (p.caen.principal) declared.add(p.caen.principal);
      for (const c of p.caen.secondary) declared.add(c);
    }
    for (const v of VERDICTS) {
      for (const cod of v.outOfScope ?? []) {
        const exists = CLASE_BY_SECZIUNE.get(v.sectiune)?.includes(cod);
        expect(exists, `${v.sectiune}: ${cod} is named as out of scope but is not a clasă of that secțiune`).toBe(true);
        expect(declared.has(cod), `${cod} is named as out of scope but a persona declares it`).toBe(false);
      }
    }
  });

  it('the six B-131 secțiuni that got a persona route at every lineage level, not only by secțiune', () => {
    // The honest part of the answer: a secțiune-level route is weak, and B-131 was not allowed to stop at it.
    // Where a persona declares the diviziune or grupa, the clase under it must route at that level.
    const measured: Record<string, string> = {};
    for (const s of ['E', 'F', 'L', 'Q', 'R', 'T']) {
      const levels = new Set(CLASE_BY_SECZIUNE.get(s)!.map((cod) => routePersonaForCaen(cod).matchLevel));
      measured[s] = [...levels].sort().join('+');
    }
    // Q routes entirely below secțiune level: grupa 855 and diviziunea 85 cover all 12 education clase.
    expect(measured.Q).toBe('clasa+diviziune+grupa');
    for (const s of ['E', 'F', 'L', 'R', 'T']) {
      expect(measured[s], s).toContain('clasa');
      expect(measured[s], s).toContain('sectiune');
    }
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
    // RE-PINNED by B-131, deliberately and in the open. Before the six new personas the split was
    // { clasa: 34, grupa: 36, diviziune: 97, sectiune: 331, none: 153 } — 498 routed, 153 unreachable.
    // The six personas move 113 clase out of `none`. The honest reading of where they landed:
    //   +16 at clasă, +14 at grupă, +35 at diviziune — reached because a persona really declares that code
    //     or its grupa/diviziune;
    //   +48 at secțiune — reached only because the persona shares the secțiune, which is the weak level and
    //     is labelled weak in the UI. B-131 did not pretend those are covered.
    // So coverage improved by 113 clase of route, of which 65 by real lineage and 48 by ancestry.
    expect(c.matchLevelCounts).toEqual({ clasa: 50, grupa: 50, diviziune: 132, sectiune: 379, none: 40 });
    expect(c.routedClasses).toBe(611);
    expect(c.unroutedClasses).toBe(40);
    expect(c.routedClasses + c.unroutedClasses).toBe(c.totalClasses);
    expect(Object.values(c.matchLevelCounts).reduce((a, b) => a + b, 0)).toBe(c.totalClasses);
    expect(c.tieClasses).toBe(104);
    // A secțiune-level route is still the majority of what "coverage" here means. Stated, not implied.
    expect(c.matchLevelCounts.sectiune).toBeGreaterThan(c.routedClasses / 2);
  });

  it('the 40 uncovered clase are five secțiuni with a recorded reason, not scattered misses (B-131)', () => {
    const c = caenCoverage();
    // B-131 closed six of the eleven secțiuni named in the defect row (E, F, L, Q, R, T). The five that
    // remain are the ones the verdict table answers with `no-persona`, each with its reason:
    // B 15 industria extractivă, D 12 utilități reglementate, P 9 administrație publică, U 3 gospodării,
    // V 1 organizații extra-teritoriale.
    expect(c.sectiuniWithoutPersona).toEqual(['B', 'D', 'P', 'U', 'V']);
    expect(c.unroutedBySectiune).toEqual({ B: 15, D: 12, P: 9, U: 3, V: 1 });
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
