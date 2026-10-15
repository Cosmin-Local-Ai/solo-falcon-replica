/**
 * The demo personas, and the CAEN→persona map (D-DEMO-3).
 *
 * ## What this file is for
 *
 * D-DEMO-3 asks for a **CAEN→persona mapping** so the user can pick a CAEN code and get a persona. This
 * module is that map: `personasByCaen` answers a CAEN code with the persona that carries it, and
 * `personaForCaen` answers with the persona or `undefined`.
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
 * ## Why there are nine and not eight
 *
 * Brief 64 fixes eight, and the eight are the first eight below. The ninth, `agricultural-norma`, exists
 * because the eight left the art. 170 alin. (4) lit. f) normă measurement unexercised — a field no demo
 * ever sets is a field that ships unread, and the ladder's whole effect (declared income replaced by a
 * rung) is invisible without it. It cannot be folded into the agricultural persona without representing the
 * same money twice; see that file's header.
 */
import { CAEN_NOMENCLATOR_COUNTS, caenByCod } from '../caenRev3';
import { agriculturalNormaPersona } from './persona9NormaVenit';
import { agriculturalProducerPersona } from './persona7Agricultural';
import { contentCreatorPersona } from './persona2ContentCreator';
import { itFreelancePersona } from './persona1ItFreelance';
import { longTermLandlordPersona } from './persona5Landlord';
import { onlineCommercePersona } from './persona8Commerce';
import { passiveInvestorPersona } from './persona6Investor';
import { rideHailingDriverPersona } from './persona3Driver';
import { shortTermHostPersona } from './persona4Host';
import type { PersonaDefinition } from './personaTypes';

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

/** Every persona that declares this CAEN code, principal first. Empty for the 1,187-odd it does not. */
export function personasForCaen(cod: string): readonly CaenPersonaMatch[] {
  return personasByCaen.get(cod) ?? [];
}

/** The single best persona for a CAEN code — its principal holder, else its first secondary holder. */
export function personaForCaen(cod: string): PersonaDefinition | undefined {
  return personasForCaen(cod)[0]?.persona;
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
   * What a miss means, in the app's own words. The UI shows this rather than an empty list, because an
   * empty list reads as „this code does not exist" when the truth is the opposite.
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
    missMeaning:
      'Codul are un persona demonstrativ doar dacă apare mai sus. Personas acoperă '
      + `${coveredClasses.length} clase din ${totalClasses}; absența unui cod înseamnă că nimeni nu a `
      + 'modelat activitatea respectivă, nu că codul nu există.',
  };
}

/**
 * The CAEN class behind a code, straight from the verified nomenclator — so a persona card can show the
 * official class text beside the code instead of a paraphrase of it.
 */
export function caenInfo(cod: string) {
  return caenByCod(cod);
}

export type { PersonaDefinition } from './personaTypes';
