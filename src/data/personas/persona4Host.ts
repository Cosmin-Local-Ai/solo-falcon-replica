/**
 * Persona 4 — **short-term accommodation host** (CAEN 5520 principal; 5540, 5590, 5510, 6820 secondary).
 *
 * ## What this person is
 *
 * Someone who lets **seven** rooms to tourists through two booking platforms. Seven is deliberate: it is
 * the top of the art. 85 band, so the persona sits exactly where the law's own boundary is. art. 83 alin. (4)
 * moves a private person letting **more than 7** rooms into an independent activity measured under
 * art. 68^3; art. 85 alin. (1)-(2) keeps 1–7 rooms in *cedarea folosinței bunurilor* but on the 30 % flat
 * expense basis from 2026 (D-CAZ-1). The room count is the fact the law itself turns on, which is why
 * D-COM-2 keys the accommodation questions to it rather than to a CAEN code.
 *
 * ## The boundary is shown as a boundary
 *
 * The persona's own year runs art. 85. The `>7` side is not seeded as data — one profile-year can only run
 * one income determination method, and seeding nine rooms would silently reclassify this person. It is
 * walked instead in `e2e/persona-4-short-term-host.spec.ts`, which changes the room count in the Settings
 * control and shows the income title and the measuring article change with it. That is the honest shape of
 * „show the boundary": the same persona, one declared fact moved, a different article.
 *
 * ## What the register holds, and what it does not
 *
 * Twelve months of platform payouts with real seasonality — a Black Sea / mountain calendar that triples
 * between February and August. The booking platforms are **intermediaries**, and the art. 68^3 alin. (3)
 * question of whether a platform commission comes out of the gross is genuinely unresolved, so the persona
 * **answers it as its own choice** (`accommodationCommissionReading`) and the app shows which reading it
 * applied beside the alternative (D-COM-1). The tourism-sector eligibility question is answered `nu`, which
 * is what keeps this person on art. 85 rather than art. 68^3.
 *
 * **No occupancy sheet is seeded.** D-OCC-1 item 5 forbids guest data in a fixture that leaves the machine,
 * and a persona ships inside the bundle. The sheet is a document the taxpayer keeps, not one the app may
 * invent, so the e2e spec adds one synthetic stay through the UI instead.
 *
 * ## The rung it changes
 *
 * The art. 85 net is *cedarea folosinței* income — art. 155 alin. (1) **lit. e)** — so it does not join the
 * CAS cumulation at all, and CAS is 0 for this profile. What moves is the **CASS ladder**: the cumulated
 * lit. c)-h) figure lands on the 24-smn rung of art. 170 alin. (3), so the base is 97.200 lei and CASS is
 * 9.720 lei. A persona that changed no rung would not be finished; this one changes the ladder rung and
 * zeroes the CAS leg, and both are asserted.
 */
import { lei } from '../../domain/money';
import type { PersonaDefinition } from './personaTypes';
import {
  PERSONA_FISCAL_YEAR,
  caenClass,
  costs,
  invoices,
  ladderYear,
  personaDataset,
  personaProfile,
  type PartySpec,
} from './personaKit';

const IDENTITY = {
  nume: 'Iancu Viorica-Maria',
  cnp: '2900000180607',
  adresa: 'Str. Dealului 7, Sinaia',
  telefon: '0762 114 880',
  email: 'viorica@iancucazare.example',
  denumire: 'Iancu Viorica-Maria PFA',
  cui: 'RO59483721',
  formaJuridica: 'Persoană fizică autorizată',
  numarRegComert: 'J09/0433/2018',
  contBancar: 'RO44 CARP 0000 0000 0904 3301 9004',
  banca: 'Banca Carpatică',
};

const SEDZARE: PartySpec = {
  id: 'p4-sedzare',
  denumire: 'Sedzare Online SA',
  cui: 'RO14725836',
  email: 'parteneri@sedzareonline.example',
  oras: 'București',
  tara: 'România',
  kind: 'platform_intermediary',
  cadenta: 'rezervări încasate de platformă, virament la 7 zile de la check-out, comision reținut',
};

const CAZAREHUB: PartySpec = {
  id: 'p4-cazarehub',
  denumire: 'Cazare Hub SRL',
  cui: 'RO25836947',
  email: 'gazde@cazarehub.example',
  oras: 'Cluj-Napoca',
  tara: 'România',
  kind: 'platform_intermediary',
  cadenta: 'sejururi de vară, virament lunar',
};

const CURATENIE: PartySpec = {
  id: 'p4-curatenie',
  denumire: 'Curățenie Alba SRL',
  cui: 'RO36947158',
  oras: 'Sinaia',
  tara: 'România',
  kind: 'supplier_ro',
  cadenta: 'curățare între check-inuri, facturat lunar',
};

const LENJERIA: PartySpec = {
  id: 'p4-lenjeria',
  denumire: 'Lenjeria Carpatică SRL',
  cui: 'RO47158369',
  email: 'comenzi@lenjeriacarpatice.example',
  oras: 'Brașov',
  tara: 'România',
  kind: 'supplier_ro',
  cadenta: 'lenjerii și consumabile, lunar în sezon',
};

/**
 * The seasonality of a mountain-and-sea host: a February that barely covers costs and an August three
 * times it. A flat twelve identical months would not exercise the occupancy sheet or the ladder the way a
 * real calendar does.
 */
const SEDZARE_PAYOUTS = [4000, 5000, 9000, 16000, 24000, 34000, 45000, 48000, 32000, 18000, 7000, 12000] as const;
const CAZAREHUB_PAYOUTS = [0, 0, 0, 0, 0, 6000, 9000, 8000, 5000, 0, 0, 0] as const;

const profile = personaProfile('persona-short-term-host', IDENTITY, [
  caenClass('5520'),
  caenClass('5540'),
  caenClass('5590'),
  caenClass('5510'),
  caenClass('6820'),
], {
  pfaStartYear: 2018,
  pfaStartDate: '2018-07-02',
  // Declared, and it is what routes this register to the accommodation branch at all.
  activityFamily: 'cazare',
  accommodationRoomCounts: [{ fiscalYear: PERSONA_FISCAL_YEAR, rooms: 7 }],
  // The person's own answer to the art. 68^3 alin. (1) eligibility gate. Answering `nu` is what keeps
  // this host on art. 85; answering `da` would move them to art. 68^3 even at seven rooms.
  accommodationTourismEligibility: 'nu',
  // D-COM-1: the alin. (3) commission scope is unresolved in every source retrieved, so the app asks and
  // the answer is recorded as the person's, with the alternative reading still shown beside it.
  accommodationCommissionReading: 'reading_a',
  // The CASS ladder sums over ALL SIX art. 155 alin. (1) lit. c)-h) categories, so a category with no
  // answer makes the sum unknown rather than smaller. The host therefore declares the five they have no
  // income from as **declared zeros** — a fact the person states — and the letting net arrives as lit. e)
  // from the art. 85 leg. `cedareaSursa: 'patrimoniu_personal'` is the fact that keeps the letting in
  // lit. e) at all: art. 83 alin. (1) excludes income from an independent activity (D-OTH-2).
  cassLadderYears: [
    ladderYear({
      fiscalYear: 2026,
      cedareaSursa: 'patrimoniu_personal',
      proprietateIntelectuala: lei(0),
      asocierePersoanaJuridica: lei(0),
      activitatiAgricole: lei(0),
      investitii: lei(0),
      alteSurse: lei(0),
      alteSurseArt114: 'da',
    }),
  ],
  vatRegistration: { status: 'scutit_art310' },
});

export const shortTermHostPersona: PersonaDefinition = {
  id: 'short-term-host',
  label: 'Gazdă de cazare pe termen scurt — 7 camere',
  summary:
    'Cazare turistică în 7 camere, prin două platforme de rezervări. 263.000 lei în 2026, cu sezon real: '
    + 'august triplu față de februarie.',
  teaches: [
    'art. 85 alin. (1)-(2): 1–7 camere, cheltuieli forfetare 30 %, impozit 10 % final — la limita superioară a benzii',
    'Pragul art. 83 alin. (4) la mai mult de 7 camere, parcurs în browser prin schimbarea unui singur fapt declarat',
    'Scara CASS pe art. 155 alin. (1) lit. e): venitul net art. 85 nu intră în cumularea CAS, deci CAS este 0',
    'Foaia de populație (OPANAF 381/2026) ca document păstrat de contribuabil, nu ca declarație',
    'Platformele de rezervări ca intermediari, cu comisionul lor ca întrebare deschisă, nu ca fapt',
  ],
  identity: IDENTITY,
  caen: { principal: '5520', secondary: ['5540', '5590', '5510', '6820'] },
  counterparties: [
    { name: SEDZARE.denumire, kind: SEDZARE.kind, tara: SEDZARE.tara, cadenta: SEDZARE.cadenta },
    { name: CAZAREHUB.denumire, kind: CAZAREHUB.kind, tara: CAZAREHUB.tara, cadenta: CAZAREHUB.cadenta },
    { name: CURATENIE.denumire, kind: CURATENIE.kind, tara: CURATENIE.tara, cadenta: CURATENIE.cadenta },
    { name: LENJERIA.denumire, kind: LENJERIA.kind, tara: LENJERIA.tara, cadenta: LENJERIA.cadenta },
  ],
  data: personaDataset(profile, {
    revenues: [
      ...invoices(SEDZARE_PAYOUTS.map((v, i) => [i + 1, 12, v] as const), {
        party: SEDZARE, prefix: 'SED', vat: false,
      }),
      ...invoices(
        CAZAREHUB_PAYOUTS.map((v, i) => [i + 1, 28, v] as const).filter(([, , v]) => v > 0),
        { party: CAZAREHUB, prefix: 'CHB', vat: false },
      ),
    ],
    expenses: [
      ...costs(Array.from({ length: 12 }, (_, i) => [i + 1, 20, 900] as const), {
        party: CURATENIE, prefix: 'CUR', vat: false, category: 'business_space_upkeep',
      }),
      ...costs([[6, 8, 1200], [7, 8, 1500], [8, 8, 1500], [9, 8, 900]] as const, {
        party: LENJERIA, prefix: 'LEN', vat: false, category: 'business_space_upkeep',
      }),
    ],
    clients: [SEDZARE, CAZAREHUB, CURATENIE, LENJERIA],
  }),
};
