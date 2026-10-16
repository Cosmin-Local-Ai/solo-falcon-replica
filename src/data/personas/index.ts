/**
 * The demo personas, and the CAEN→persona map (D-DEMO-3).
 *
 * ## What this file is for
 *
 * D-DEMO-3 asks for a **CAEN→persona mapping** so the user can pick a CAEN code and get a persona. This
 * module is that map: `personasByCaen` answers a CAEN code with the personas that carry it, and
 * `routePersonaForCaen` answers with the closest one by lineage — see the B-128 section below for why
 * `personaForCaen` alone was not enough.
 *
 * ## Why the map is not a lookup table over a CAEN list
 *
 * `docs/ai/data/CAEN_REV3_PROVENANCE.md` §4 is the reason this file exists in this shape. The nomenclator
 * has **651 classes**, and the project has **nine personas**. A map that looked complete would be a lie,
 * so the map states its own coverage instead:
 *
 * - `caenCoverage()` says how many classes exist, how many any persona carries, and which group and class
 *   ranges are touched at all. It is computed from the nomenclator, not written down, so it cannot drift
 *   when the nomenclator is re-pulled.
 * - `caenUnmappedCount()` is the number the UI has to show next to a hit: **a code with no persona is the
 *   normal case, not an error.** The UI must not offer „alege un persona pentru acest cod" for a class
 *   nobody modelled, and it must not imply the personas cover commerce in general.
 * - The map is keyed on the persona's **own declared** CAEN — `PersonaDefinition.caen` — and nowhere else.
 *   A persona's CAEN is a fact the person declares (ONRC/RTR registers it, the fiscal rules read it, and
 *   D-COM-2 refuses to infer the accommodation questions from it), so the map reads the same fact rather
 *   than a second copy of it.
 *
 * ## The two cases a naive map gets wrong
 *
 * - **No CAEN at all.** The passive investor is not a PFA and has no obiect de activitate. They are in
 *   `personas` and in every UI list, and they are absent from `personasByCaen` — which is the correct
 *   answer to „what persona for this code?", not a null to be papered over.
 * - **A code that fits several personas.** Secondary codes overlap: 5520 is the short-term host's secondary
 *   and the long-term landlord's secondary, and 6820 is the landlord's principal and the host's secondary.
 *   The map keeps every persona for a code, ranked principal first, so the UI can show the choice instead of
 *   silently picking one. Silently picking is how a CAEN→persona map becomes a CAEN→persona *guess*.
 *
 * ## B-128 — a code nobody declares still has to land somewhere
 *
 * `personaForCaen` used to answer `undefined` for any class outside the persona set. That is an honest
 * answer and it is no longer the right one: a person whose activity is `4931` should see a working demo.
 * `routePersonaForCaen` routes by **the nomenclator's own lineage** — clasă, then grupă (3 cifre), then
 * diviziune (2 cifre), then secțiune (letter) — and stops at the first level that yields any persona. It
 * never guesses: there is no fuzzy matching on denominations and no synonym table, because a CAEN code is a
 * statistical label (HG 656/1997 art. 4 alin. (1)) and the only thing that makes a lineage route defensible
 * is that every step of it is a fact printed in MO 385. The level is part of the answer, because a
 * secțiune-level route must not be rendered like an exact one.
 *
 * **The lineage runs out at secțiune, and for 153 of the 651 clase it does.** The nine personas declare
 * codes in only 11 of the 22 secțiuni, so mining (B), utilities (D, E), construction (F), financial
 * intermediation (L), public administration (P), education (Q), health (R), other services (T, U) and
 * extraterritorial activities (V) have no ancestor in common with any persona. Those clase return
 * `matchLevel: 'none'` with a stated reason — and, so the user does not dead-end, a **`sample`**.
 *
 * `sample` is deliberately a different kind of object from `candidates`, not a fifth rung of the ladder.
 * A match claims *this persona resembles your activity*. A sample claims only *here is the app working on
 * somebody's data*. Putting the fallback in the same ladder as clasă/grupă/diviziune would have handed it
 * their authority; keeping it in a separate field is what stops a mining CAEN from being shown an IT demo as
 * if it were a closest match. The coverage gap itself is minted as **B-131** and is not papered over.
 *
 * ## Why there are nine and not eight
 *
 * Brief 64 fixes eight, and the eight are the first eight below. The ninth, `agricultural-norma`, exists
 * because the eight left the art. 170 alin. (4) lit. f) normă measurement unexercised — a field no demo
 * ever sets is a field that ships unread, and the ladder's whole effect (declared income replaced by a
 * rung) is invisible without it. It cannot be folded into the agricultural persona without representing the
 * same money twice; see that file's header.
 */
import {
  CAEN_ENTRIES,
  CAEN_LEVEL_LABELS,
  CAEN_NOMENCLATOR_COUNTS,
  caenByCod,
} from '../caenRev3';
import { agriculturalNormaPersona } from './persona9NormaVenit';
import { agriculturalProducerPersona } from './persona7Agricultural';
import { constructionFinisherPersona } from './persona10Construction';
import { contentCreatorPersona } from './persona2ContentCreator';
import { hairSalonPersona } from './persona13HairSalon';
import { insuranceAgentPersona } from './persona14InsuranceAgent';
import { itFreelancePersona } from './persona1ItFreelance';
import { longTermLandlordPersona } from './persona5Landlord';
import { musicTeacherPersona } from './persona11MusicTeacher';
import { onlineCommercePersona } from './persona8Commerce';
import { passiveInvestorPersona } from './persona6Investor';
import { physiotherapistPersona } from './persona12Physiotherapist';
import { rideHailingDriverPersona } from './persona3Driver';
import { shortTermHostPersona } from './persona4Host';
import { wasteCollectorPersona } from './persona15WasteCollector';
import type { PersonaDefinition, PersonaId } from './personaTypes';

/** The personas, in the order the UI lists them. */
export const PERSONAS: readonly PersonaDefinition[] = [
  itFreelancePersona,
  contentCreatorPersona,
  rideHailingDriverPersona,
  shortTermHostPersona,
  longTermLandlordPersona,
  passiveInvestorPersona,
  agriculturalProducerPersona,
  onlineCommercePersona,
  agriculturalNormaPersona,
  constructionFinisherPersona,
  musicTeacherPersona,
  physiotherapistPersona,
  hairSalonPersona,
  insuranceAgentPersona,
  wasteCollectorPersona,
];

/** One entry of the CAEN→persona map: a persona, and whether the code is their principal or secondary. */
export interface CaenPersonaMatch {
  persona: PersonaDefinition;
  role: 'principal' | 'secundar';
}

/**
 * CAEN code → the personas that declare it, principal first then secondary.
 *
 * Built from the personas themselves, so adding a persona cannot leave the map behind.
 */
export const personasByCaen: ReadonlyMap<string, readonly CaenPersonaMatch[]> = (() => {
  const map = new Map<string, CaenPersonaMatch[]>();
  for (const persona of PERSONAS) {
    const push = (cod: string, role: 'principal' | 'secundar'): void => {
      if (!cod) return;
      const list = map.get(cod) ?? [];
      list.push({ persona, role });
      map.set(cod, list);
    };
    push(persona.caen.principal, 'principal');
    for (const cod of persona.caen.secondary) push(cod, 'secundar');
  }
  for (const list of map.values()) {
    list.sort((a, b) => (a.role === b.role ? 0 : a.role === 'principal' ? -1 : 1));
  }
  return map;
})();

/**
 * A persona by id, or `undefined` for an id this build does not have.
 *
 * B-134 needs this: the demo toggle persists an **identifier**, and on the next load the store has to turn
 * that identifier back into a dataset. A stale key from a build that had a persona this one dropped must
 * resolve to `undefined` so the store can fall back to the user's own data instead of rendering a badge
 * that names a profile with no records behind it.
 */
export function personaById(id: string): PersonaDefinition | undefined {
  return PERSONAS.find((p) => p.id === id);
}

/** Every persona that declares this CAEN code, principal first. Empty for the 1,187-odd it does not. */
export function personasForCaen(cod: string): readonly CaenPersonaMatch[] {
  return personasByCaen.get(cod) ?? [];
}

/**
 * The single best **lineage match** for a CAEN code, or `undefined` when the lineage gives nothing.
 *
 * It never returns the `sample`: a caller must not be able to read a generic demo as a match. That also
 * means a caller who stops here dead-ends on the 153 uncovered clase — which is exactly what B-128 was
 * about. `routePersonaForCaen` is the complete answer; this is the convenience on top of it.
 */
export function personaForCaen(cod: string): PersonaDefinition | undefined {
  return routePersonaForCaen(cod).candidates[0]?.persona;
}

// ---------------------------------------------------------------------------
// B-128 — closest-match routing over the nomenclator's own lineage
// ---------------------------------------------------------------------------

/**
 * The four lineage levels, narrowest first. These are the levels CAEN Rev.3 actually has; nothing here is
 * a level the nomenclator does not print.
 */
export type CaenLineageLevel = 'clasa' | 'grupa' | 'diviziune' | 'sectiune';

const LINEAGE_LEVELS: readonly CaenLineageLevel[] = ['clasa', 'grupa', 'diviziune', 'sectiune'];

/**
 * What a route claims. `'none'` is **not** a fifth lineage level — it means the ladder produced nothing and
 * the result carries a `sample` instead of a `candidates` list.
 */
export type CaenMatchLevel = CaenLineageLevel | 'none';

/**
 * Romanian for a match level, built on `CAEN_LEVEL_LABELS` so the three words the nomenclator already
 * spells are not spelled a second way here. The UI renders this; it must not invent its own wording, and it
 * must not render `sectiune` in the same style as `clasa`.
 */
export const CAEN_MATCH_LEVEL_LABELS: Readonly<Record<CaenMatchLevel, string>> = {
  ...CAEN_LEVEL_LABELS,
  sectiune: 'secțiune',
  none: 'fără potrivire',
};

/**
 * The only wording allowed for a sample. It says what a sample claims — that the app is running on somebody
 * else's data — and what it does not claim — that the activity resembles the user's.
 */
export const CAEN_SAMPLE_LABEL = 'Exemplu demonstrativ — nu activitatea dumneavoastră';

/**
 * The persona offered when the lineage gives nothing.
 *
 * `online-commerce` (4791) is designated because its fiscal shape is the most transferable of the nine
 * (cash-basis goods costs, TVA at the plafon, named suppliers including non-EU) and the least likely to be
 * read as a claim about the user's sector. `it-freelance` was rejected for exactly that reason: an IT demo
 * beside a mining CAEN reads as a category error.
 */
export const CAEN_DEMO_SAMPLE_PERSONA_ID: PersonaId = 'online-commerce';

const CAEN_DEMO_SAMPLE_PERSONA: PersonaDefinition =
  PERSONAS.find((p) => p.id === CAEN_DEMO_SAMPLE_PERSONA_ID) ?? PERSONAS[0];

/** The persona offered when the lineage gives nothing. Never a statement about the activity. */
export function caenDemoSamplePersona(): PersonaDefinition {
  return CAEN_DEMO_SAMPLE_PERSONA;
}

/** Why a secțiune has no route, in the app's own words. This is what `missMeaning` became (B-128). */
export function caenNoRouteReason(sectiune: string): string {
  return (
    `Niciun persona demonstrativ nu declară vreo clasă în secțiunea ${sectiune}, deci linia ` +
    'clasă → grupă → diviziune → secțiune nu duce nicăieri. Codul există în CAEN Rev.3; ' +
    'activitatea nu este modelată de niciun persona.'
  );
}

export interface CaenPersonaRoute {
  /** The code as asked for, trimmed. */
  readonly cod: string;
  readonly matchLevel: CaenMatchLevel;
  /**
   * What the level matched on: the clasă, the grupa (3 cifre), the diviziune (2 cifre) or the secțiune
   * letter. Empty for `'none'`. It is here so the UI can name the ancestor instead of just its kind.
   */
  readonly matchedOn: string;
  /** The personas that match at this level, principal first. Empty exactly when `matchLevel === 'none'`. */
  readonly candidates: readonly CaenPersonaMatch[];
  /** More than one persona matched at this level. The UI shows all of them; nothing picks for the user. */
  readonly tie: boolean;
  /** Present only when `matchLevel === 'none'`. A demo to look at, **not** a statement about the activity. */
  readonly sample?: PersonaDefinition;
  /** Romanian: what the route claims, or why it cannot claim anything. */
  readonly reason: string;
}

/** The code/letter a persona's declared class answers to at one lineage level. */
function lineageKey(cod: string, level: CaenLineageLevel, sectiune: string): string {
  switch (level) {
    case 'clasa':
      return cod;
    case 'grupa':
      return cod.slice(0, 3);
    case 'diviziune':
      return cod.slice(0, 2);
    case 'sectiune':
      return sectiune;
  }
}

/**
 * persona code → the personas holding it, at one lineage level.
 *
 * Built from `PersonaDefinition.caen` like `personasByCaen`, from the same declared fact, and keyed on the
 * nomenclator's own prefixes and section letters — never on `parinte`, which the ingest fills with the
 * diviziune even for a clasă. A persona is listed once per key, with its best role.
 */
function buildLineageIndex(level: CaenLineageLevel): ReadonlyMap<string, readonly CaenPersonaMatch[]> {
  const map = new Map<string, CaenPersonaMatch[]>();
  for (const persona of PERSONAS) {
    const bestRole = new Map<string, 'principal' | 'secundar'>();
    const consider = (cod: string, role: 'principal' | 'secundar'): void => {
      if (!cod) return;
      const entry = caenByCod(cod);
      // A persona code that is not in the nomenclator must not open a route. It is already a test failure.
      if (!entry) return;
      const key = lineageKey(cod, level, entry.sectiune);
      if (bestRole.get(key) !== 'principal') bestRole.set(key, role);
    };
    consider(persona.caen.principal, 'principal');
    for (const cod of persona.caen.secondary) consider(cod, 'secundar');
    for (const [key, role] of bestRole) {
      const list = map.get(key) ?? [];
      list.push({ persona, role });
      map.set(key, list);
    }
  }
  for (const list of map.values()) {
    list.sort((a, b) => (a.role === b.role ? 0 : a.role === 'principal' ? -1 : 1));
  }
  return map;
}

const LINEAGE_INDEX: Readonly<Record<CaenLineageLevel, ReadonlyMap<string, readonly CaenPersonaMatch[]>>> = {
  clasa: personasByCaen,
  grupa: buildLineageIndex('grupa'),
  diviziune: buildLineageIndex('diviziune'),
  sectiune: buildLineageIndex('sectiune'),
};

function routeReason(level: CaenLineageLevel, matchedOn: string, candidates: readonly CaenPersonaMatch[]): string {
  const where =
    level === 'clasa'
      ? `Același cod CAEN: ${matchedOn}.`
      : level === 'sectiune'
        ? `Aceeași secțiune: ${matchedOn}. Potrivire slabă — nomenclatorul nu susține nicio asemănare de activitate mai mult decât aceasta.`
        : `Aceeași ${CAEN_LEVEL_LABELS[level]}: ${matchedOn}.`;
  const tieNote =
    candidates.length > 1
      ? ` ${candidates.length} personas se potrivesc la acest nivel; se afișează toate, nu se alege unul.`
      : '';
  return where + tieNote;
}

/**
 * The closest demo persona for a CAEN code, by the nomenclator's own lineage (B-128).
 *
 * The walk is clasă → grupă → diviziune → secțiune and it **stops at the first level that yields any
 * persona**. Stopping at the first *non-empty* level rather than the first with exactly one is deliberate:
 * the candidate sets only grow as you climb, so a grupă that yields two personas can only yield two or more
 * further up. Reporting the tie at the narrowest level where it appears keeps the information; climbing
 * looking for a tiebreak would trade a grupă-level tie for a vaguer secțiune-level one.
 *
 * A code that is not in the nomenclator at all gets `matchLevel: 'none'` and **no sample** — offering a demo
 * for a code that does not exist would paper over an input error, and `caenClassProblem` already refuses
 * such a code at the form.
 */
export function routePersonaForCaen(cod: string): CaenPersonaRoute {
  const asked = cod.trim();
  const entry = caenByCod(asked);
  if (!entry) {
    return {
      cod: asked,
      matchLevel: 'none',
      matchedOn: '',
      candidates: [],
      tie: false,
      reason:
        `${asked === '' ? 'Niciun cod' : `Codul ${asked}`} nu există în CAEN Rev.3 (Ordinul INS 377/2024), ` +
        'așa că nu există nicio linie de urmat.',
    };
  }
  for (const level of LINEAGE_LEVELS) {
    const matchedOn = lineageKey(asked, level, entry.sectiune);
    const candidates = LINEAGE_INDEX[level].get(matchedOn) ?? [];
    if (candidates.length === 0) continue;
    return {
      cod: asked,
      matchLevel: level,
      matchedOn,
      candidates,
      tie: candidates.length > 1,
      reason: routeReason(level, matchedOn, candidates),
    };
  }
  return {
    cod: asked,
    matchLevel: 'none',
    matchedOn: '',
    candidates: [],
    tie: false,
    sample: CAEN_DEMO_SAMPLE_PERSONA,
    reason: caenNoRouteReason(entry.sectiune),
  };
}

/** How much of the nomenclator the personas actually cover. Computed, so it cannot go stale. */
export interface CaenCoverage {
  /** Classes in the verified nomenclator — 1,195. */
  totalClasses: number;
  /** Classes any persona declares, principal or secondary. */
  mappedClasses: number;
  /** `totalClasses - mappedClasses`. The normal answer to a CAEN search. */
  unmappedClasses: number;
  /** Groups touched at all, as `xx` codes. */
  groupsCovered: string[];
  /** The class codes covered, sorted. */
  coveredClasses: string[];
  /**
   * How many of the 651 clase route at each lineage level. **This distribution is the B-128 deliverable:**
   * it says how much of the nomenclator is genuinely covered and how much is reached only by fallback.
   */
  matchLevelCounts: Record<CaenMatchLevel, number>;
  /** Clase with at least one lineage match. `routedClasses + unroutedClasses === totalClasses`. */
  routedClasses: number;
  /** Clase the lineage cannot reach at all — the B-131 coverage gap, not a routing bug. */
  unroutedClasses: number;
  /** Clase whose narrowest level yields more than one persona. The UI must show all of them. */
  tieClasses: number;
  /** The uncovered clase counted by secțiune letter, so B-131 can be sized without re-deriving it. */
  unroutedBySectiune: Record<string, number>;
  /** Secțiuni with no persona code anywhere. */
  sectiuniWithoutPersona: string[];
  /** Which persona a `matchLevel: 'none'` route offers as a sample. */
  samplePersonaId: PersonaId;
  /**
   * What a miss means, in the app's own words. B-128 did not retire it: a miss is no longer "nobody
   * declares this code" but "the lineage reaches nobody", and the UI still has to say that rather than
   * show an empty list, which reads as „this code does not exist" when the truth is the opposite.
   */
  missMeaning: string;
}

export function caenCoverage(): CaenCoverage {
  const coveredClasses = [...personasByCaen.keys()].sort();
  const groupsCovered = [...new Set(coveredClasses.map((c) => c.slice(0, 2)))].sort();
  const totalClasses = CAEN_NOMENCLATOR_COUNTS.clase;
  return {
    totalClasses,
    mappedClasses: coveredClasses.length,
    unmappedClasses: totalClasses - coveredClasses.length,
    groupsCovered,
    coveredClasses,
    ...measureRouting(),
    sectiuniWithoutPersona: sectiuniWithoutPersona(),
    samplePersonaId: CAEN_DEMO_SAMPLE_PERSONA_ID,
    missMeaning:
      'Un cod primește persona doar dacă linia lui — clasă, grupă, diviziune, secțiune — duce la unul. '
      + `Personas declară ${coveredClasses.length} clase din ${totalClasses} și activează în `
      + `${SECTIONS_WITH_PERSONA.size} din ${CAEN_NOMENCLATOR_COUNTS.sectiuni} secțiuni; un cod fără potrivire `
      + 'înseamnă că nimeni nu a modelat secțiunea respectivă, nu că codul nu există. Ceea ce se afișează '
      + 'atunci este un exemplu demonstrativ, marcat ca atare.',
  };
}

/**
 * The routing distribution, measured by walking every clasă in the shipped nomenclator.
 *
 * Computed, never written down, for the reason the whole file gives: a number typed here would be a claim
 * that goes stale the moment the nomenclator is re-pulled or a persona is added.
 */
function measureRouting(): Pick<
  CaenCoverage,
  'matchLevelCounts' | 'routedClasses' | 'unroutedClasses' | 'tieClasses' | 'unroutedBySectiune'
> {
  const matchLevelCounts: Record<CaenMatchLevel, number> = {
    clasa: 0,
    grupa: 0,
    diviziune: 0,
    sectiune: 0,
    none: 0,
  };
  const unroutedBySectiune: Record<string, number> = {};
  let routedClasses = 0;
  let unroutedClasses = 0;
  let tieClasses = 0;
  for (const entry of CAEN_ENTRIES) {
    if (entry.nivel !== 'clasa') continue;
    const route = routePersonaForCaen(entry.cod);
    matchLevelCounts[route.matchLevel] += 1;
    if (route.matchLevel === 'none') {
      unroutedClasses += 1;
      unroutedBySectiune[entry.sectiune] = (unroutedBySectiune[entry.sectiune] ?? 0) + 1;
    } else {
      routedClasses += 1;
      if (route.tie) tieClasses += 1;
    }
  }
  return { matchLevelCounts, routedClasses, unroutedClasses, tieClasses, unroutedBySectiune };
}

const SECTIONS_WITH_PERSONA: ReadonlySet<string> = new Set(
  PERSONAS.flatMap((p) => [p.caen.principal, ...p.caen.secondary])
    .filter(Boolean)
    .map((cod) => caenByCod(cod)?.sectiune ?? '')
    .filter(Boolean),
);

/** Every secțiune letter the nomenclator prints, A–V. */
function allSectiuni(): string[] {
  return [...new Set(CAEN_ENTRIES.map((e) => e.sectiune))].sort();
}

/** The B-131 gap stated as letters: secțiuni where no persona declares anything at all. */
function sectiuniWithoutPersona(): string[] {
  return allSectiuni().filter((s) => !SECTIONS_WITH_PERSONA.has(s));
}

/**
 * The CAEN class behind a code, straight from the verified nomenclator — so a persona card can show the
 * official class text beside the code instead of a paraphrase of it.
 */
export function caenInfo(cod: string) {
  return caenByCod(cod);
}

export type { PersonaDefinition, PersonaId } from './personaTypes';
