/**
 * Step 11 / Part C — what a demo persona *is*, as a type.
 *
 * ## The two identities, kept apart (D-DEMO-2)
 *
 * `PersonaIdentity` is the invented person the persona gallery shows: a name, a CNP, a CUI, an IBAN, all
 * of them visibly fake (B-110). `PfaIdentity` is the identity of **the account** — the taxpayer the app
 * will file a Declarația Unică for. They are different types because they are different things, and the
 * model must not be able to confuse them: a persona applied to a real account supplies activity data, not
 * a name. `applyPersonaToAccount` is the only seam between them, and it replaces every identity field
 * rather than merging them.
 *
 * ## Why the fiscal claims are not on this type
 *
 * A persona is not allowed to *assert* which regimes it exercises. The regime and CASS-ladder coverage is
 * derived from the persona's own data in `src/data/personas/personaCoverage.test.ts`, which runs the real
 * pipeline and reads what actually fired. A `regimes: [...]` field here would be prose wearing a type, and
 * a persona whose data stopped exercising a regime would keep claiming it. That is the failure mode the
 * brief names — „a persona that loads without changing a rung is not finished" — and it is closed by
 * measuring, not by declaring.
 */
import type { AppData } from '../types';
import type { PfaIdentity } from '../../domain/models';
import type { PartyKind } from './personaKit';

export type PersonaId =
  | 'it-freelance'
  | 'content-creator'
  | 'ride-hailing-driver'
  | 'short-term-host'
  | 'long-term-landlord'
  | 'passive-investor'
  | 'agricultural-producer'
  | 'online-commerce'
  | 'agricultural-norma';

/** The order the gallery lists them in, and the order the coverage test walks. */
export const PERSONA_IDS: readonly PersonaId[] = [
  'it-freelance',
  'content-creator',
  'ride-hailing-driver',
  'short-term-host',
  'long-term-landlord',
  'passive-investor',
  'agricultural-producer',
  'online-commerce',
  'agricultural-norma',
];

/**
 * The invented person behind a persona.
 *
 * Every value here is a coinage. The CNP carries month `00` and day `00` — a birth date no civil register
 * contains — and the CUI fails both published control-digit keys. `src/data/seed.identityHygiene.test.ts`
 * scans every literal in `src/` and `e2e/` and fails the build if one of them ever becomes real-looking.
 */
export interface PersonaIdentity {
  nume: string;
  cnp: string;
  adresa: string;
  telefon: string;
  email: string;
  denumire: string;
  cui: string;
  formaJuridica: string;
  numarRegComert: string;
  contBancar: string;
  banca: string;
  codTvaIntra?: string;
}

/**
 * A counterparty as the demo explains it.
 *
 * The register itself stores a name and a CUI; this is the layer that says **what kind of counterparty**
 * it is, because that is what changes what the engine does with the money — a platform that withholds is
 * not a corporate client, and a non-EU supplier is not a Romanian one (D-DEMO-4).
 */
export interface PersonaCounterparty {
  name: string;
  kind: PartyKind;
  /** ISO-ish country words in Romanian; `RO` counterparties say so too, because "domestic, in lei" is the point. */
  tara: string;
  /** How often money actually moves, in the persona's own words. */
  cadenta: string;
}

export interface PersonaDefinition {
  readonly id: PersonaId;
  /** The gallery label, in Romanian. */
  readonly label: string;
  /** One sentence on who this person is, in Romanian. */
  readonly summary: string;
  /** What the persona is there to demonstrate, in Romanian. Read by the gallery, not by the engine. */
  readonly teaches: readonly string[];
  /** The invented person. Never the account's identity — see the header. */
  readonly identity: PersonaIdentity;
  /**
   * The CAEN Rev.3 classes, as the ONRC form states them: one principal plus up to four secondary
   * (OUG 44/2008 art. 16 alin. (1)). Every code is looked up in `docs/ai/data/caen_rev3.csv`; none is
   * typed from memory, and `personas.test.ts` re-checks each one against the shipped nomenclator.
   */
  readonly caen: { readonly principal: string; readonly secondary: readonly string[] };
  readonly counterparties: readonly PersonaCounterparty[];
  /** The dataset the persona loads. Store-only: applying a persona never writes it to storage. */
  readonly data: AppData;
}

/**
 * Apply a persona's **activity data** to an account with its own identity (D-DEMO-2).
 *
 * This is the whole of the separation: the persona supplies the register, the declared fiscal facts and the
 * CAEN classes; the person's own name, CNP, CUI, registration number and bank details replace the invented
 * ones everywhere they appear. Nothing merges the two — a merged identity would put an invented CNP on a
 * real taxpayer's declaration.
 *
 * The CAEN list stays the persona's, because it describes the activity, not the person. A real account is
 * The CAEN list stays the persona's, because it describes the activity, not the person. A real account is
 * expected to correct it in Settings, where the control resolves every code against the nomenclator.
 *
 * **Only `profile.identity` is replaced.** Phase 7 made the identity block the single readable source —
 * `src/data/identity.source.test.ts` fails any file outside the migration path that reads
 * `settings.company` / `settings.personal` — and the legacy block under `settings` survives only so pre-v7
 * payloads still parse. Rewriting it from here would re-create the second identity state that acceptance
 * criterion 6 retired, so this function does not touch it.
 */
export function applyPersonaToAccount(data: AppData, accountIdentity: PfaIdentity): AppData {
  return {
    ...data,
    profile: { ...data.profile, identity: { ...accountIdentity } },
  };
}
