/**
 * Persona 7 — **agricultural producer** (CAEN 0125 principal; 0113, 0161, 1039, 4721 secondary).
 *
 * ## What this person is
 *
 * An orchard and smallholding: stone fruit and berries (0125), some vegetables (0113), auxiliary crop
 * activities (0161), and direct retail of what they grow (4721). Everything domestic, everything in lei —
 * a grower selling at the county market and to two local buyers has no foreign counterparty, and inventing
 * one would be padding (D-DEMO-4).
 *
 * ## The calendar is the point
 *
 * Agriculture is the persona with the strongest real seasonality in the set: a January that brings in
 * 4.000 lei and an August that brings in 32.000. Twelve identical months would make the chart a lie, and
 * the CASS ladder is an **annual** test, so the shape of the year is what makes the rung meaningful.
 *
 * ## Why this persona's lit. f) is a declared zero, and where the normă lives
 *
 * art. 170 alin. (4) lit. f) accepts „venitul net **sau** norma de venit, după caz", and `CassLadderYear`
 * models that choice as `activitatiAgricoleBaza`. This persona does **not** travel that limb: its farming
 * is the PFA's own independent activity, determined in sistem real, so its CASS limb is art. 155 alin. (1)
 * **lit. b)** on the same net the estimate computes — and art. 83 alin. (1) keeps income from an
 * independent activity out of the ladder altogether. Declaring the same money a second time under lit. f)
 * would be a double representation, so lit. f) is a **declared zero**: the person states they have no
 * agricultural income outside the activity.
 *
 * The normă limb is carried by persona 9, `agricultural-norma`, which declares a normă figure the taxpayer
 * reads off their own act and never lets the app compute one. That is how D-NORMA-2 is handled rather than
 * answered: the *choice* between the two art. 170 alin. (4) lit. f) measurements is exercised and visible,
 * while the *norm tables themselves* stay unverified and unshipped. `personas.test.ts` asserts that no
 * persona derives a normă — only that one declares it.
 *
 * ## The pension case
 *
 * This is the persona that carries art. 150 alin. (1): a pensioner who farms owes **no CAS at all**, and
 * the two CAS rows come back `not_applicable` with the provision named rather than as a zero that looks
 * like a computation. Brief 64 put the pension case on personas 2 and 6; it moved here because persona 2
 * has to keep a live CAS rung to satisfy D-DEMO-4 („a persona that loads without changing a rung is not
 * finished"), and a pensioner farmer is the commonest real instance of the exemption anyway. The salary
 * case stays on persona 6.
 *
 * ## The rung it changes
 *
 * The **CASS floor** (art. 174 alin. (6), 24.300 lei) moves from not-engaged to engaged on this profile's
 * own net, and both CAS rows move from a computed figure to `not_applicable` by status rather than by
 * arithmetic. The CASS ladder is entered and complete — six categories answered, five of them zeros — which
 * is the state the ladder refuses to guess its way into.
 */
import { lei } from '../../domain/money';
import type { PersonaDefinition } from './personaTypes';
import {
  caenClass,
  costs,
  invoices,
  ladderYear,
  personaDataset,
  personaProfile,
  type PartySpec,
} from './personaKit';

const IDENTITY = {
  nume: 'Țurcaș Vasile-Mihai',
  cnp: '1490000213013',
  adresa: 'Sat Merișoru 88, județul Sibiu',
  telefon: '0748 330 217',
  email: 'vasile@turcaslivada.example',
  denumire: 'Țurcaș Vasile-Mihai PFA',
  cui: 'RO34567892',
  formaJuridica: 'Persoană fizică autorizată',
  numarRegComert: 'J32/1904/2016',
  contBancar: 'RO44 CARP 0000 0000 3219 0402 9007',
  banca: 'Banca Carpatică',
};

const FRUCTUS: PartySpec = {
  id: 'p7-fructus',
  denumire: 'Depozitul Fructus SRL',
  cui: 'RO58369471',
  email: 'achizitii@fructusdepozit.example',
  oras: 'Sibiu',
  tara: 'România',
  kind: 'client_corporate_ro',
  cadenta: 'lote la cules, plată la 15 zile de la livrare',
};

const COOPERATIVA: PartySpec = {
  id: 'p7-cooperativa',
  denumire: 'Cooperativa Ardeal Verde',
  cui: 'RO69471583',
  email: 'livratii@ardealverde.example',
  oras: 'Mediaș',
  tara: 'România',
  kind: 'client_corporate_ro',
  cadenta: 'livrări săptămânale în sezon, plată lunară',
};

const PIAȚA: PartySpec = {
  id: 'p7-piata',
  denumire: 'Piața Legumicolă SRL',
  cui: 'RO13579247',
  oras: 'Sibiu',
  tara: 'România',
  kind: 'client_person_ro',
  cadenta: 'vânzare directă în piață, încasare zilnică în sezon',
};

const FERTILIZERRA: PartySpec = {
  id: 'p7-fertilizerra',
  denumire: 'Fertilizerra SRL',
  cui: 'RO41277301',
  email: 'comenzi@fertilizerra.example',
  oras: 'Sibiu',
  tara: 'România',
  kind: 'supplier_ro',
  cadenta: 'fertilizanți și tratamente, două campanii pe an',
};

const SEMINCERA: PartySpec = {
  id: 'p7-semincera',
  denumire: 'Semincera SRL',
  cui: 'RO15480293',
  oras: 'Avrig',
  tara: 'România',
  kind: 'supplier_ro',
  cadenta: 'material săditor și rădăcini, o dată pe an',
};

const IRIGATIA: PartySpec = {
  id: 'p7-irigatia',
  denumire: 'Apometrana SRL',
  cui: 'RO26190475',
  email: 'facturi@apometrana.example',
  oras: 'Sibiu',
  tara: 'România',
  kind: 'supplier_ro',
  cadenta: 'apă pentru irigat, factură lunară în sezon',
};

/** The orchard calendar: a bare winter, a working spring, and a July-to-September that carries the year. */
const HARVEST_SALES = [4000, 4000, 6000, 10000, 16000, 22000, 28000, 32000, 30000, 24000, 14000, 10000] as const;

const profile = personaProfile('persona-agricultural-producer', IDENTITY, [
  caenClass('0125'),
  caenClass('0113'),
  caenClass('0161'),
  caenClass('1039'),
  caenClass('4721'),
], {
  pfaStartYear: 2016,
  pfaStartDate: '2016-03-21',
  activityFamily: 'other',
  // art. 150 alin. (1): the status, not the receipt fact, is the CAS key. Both are recorded, because they
  // are two different facts and the CASS relief at art. 174 alin. (7) lit. c) keys on the second one.
  pensionerStatus: 'da',
  pensionReceiptYears: [{ fiscalYear: 2026, received: 'da' }],
  cassLadderYears: [
    ladderYear({
      fiscalYear: 2026,
      activitatiAgricole: lei(0),
      cedareaFolosinteiBunurilor: lei(0),
      proprietateIntelectuala: lei(0),
      asocierePersoanaJuridica: lei(0),
      investitii: lei(0),
      alteSurse: lei(0),
      alteSurseArt114: 'da',
    }),
  ],
  vatRegistration: { status: 'scutit_art310' },
});

export const agriculturalProducerPersona: PersonaDefinition = {
  id: 'agricultural-producer',
  label: 'Producător agricol — livadă și legume',
  summary:
    'Livadă de sâmburoase și păducri, legume și vânzare directă în piață. 200.000 lei în 2026, cu '
    + 'sezon real: august de opt ori cât ianuarie. Pensionat, deci fără CAS.',
  teaches: [
    'CASS pe art. 155 alin. (1) lit. b) pentru activitatea agricolă în sistem real, nu pe lit. f)',
    'Scara CASS completă: șase categorii răspunse, cinci dintre ele zero declarat — nu zero inventat',
    'art. 150 alin. (1): pensionatul nu datorează CAS — cele două rânduri CAS devin neaplicabile, nu zero calculat',
    'Sezon real pe doisprezece luni, care face graficul și testul anual al CASS săsemneze',
    'Counterparties exclusiv interne, în lei — un producător care vinde în piață nu are furnizor extern',
  ],
  identity: IDENTITY,
  caen: { principal: '0125', secondary: ['0113', '0161', '1039', '4721'] },
  counterparties: [
    { name: FRUCTUS.denumire, kind: FRUCTUS.kind, tara: FRUCTUS.tara, cadenta: FRUCTUS.cadenta },
    { name: COOPERATIVA.denumire, kind: COOPERATIVA.kind, tara: COOPERATIVA.tara, cadenta: COOPERATIVA.cadenta },
    { name: PIAȚA.denumire, kind: PIAȚA.kind, tara: PIAȚA.tara, cadenta: PIAȚA.cadenta },
    { name: FERTILIZERRA.denumire, kind: FERTILIZERRA.kind, tara: FERTILIZERRA.tara, cadenta: FERTILIZERRA.cadenta },
    { name: SEMINCERA.denumire, kind: SEMINCERA.kind, tara: SEMINCERA.tara, cadenta: SEMINCERA.cadenta },
    { name: IRIGATIA.denumire, kind: IRIGATIA.kind, tara: IRIGATIA.tara, cadenta: IRIGATIA.cadenta },
  ],
  data: personaDataset(profile, {
    revenues: [
      ...invoices(
        HARVEST_SALES.map((v, i) => [i + 1, 20, Math.round(v * 0.55)] as const),
        { party: FRUCTUS, prefix: 'LIV-F', vat: false },
      ),
      ...invoices(
        HARVEST_SALES.map((v, i) => [i + 1, 24, Math.round(v * 0.3)] as const),
        { party: COOPERATIVA, prefix: 'LIV-C', vat: false },
      ),
      ...invoices(
        HARVEST_SALES.map((v, i) => [i + 1, 27, Math.round(v * 0.15)] as const),
        { party: PIAȚA, prefix: 'PCT', vat: false },
      ),
    ],
    expenses: [
      ...costs([[3, 14, 3500], [4, 18, 3500], [5, 12, 3500], [6, 16, 3500], [8, 19, 3500], [9, 15, 3500]] as const, {
        party: FERTILIZERRA, prefix: 'FER', vat: false, category: 'business_space_upkeep',
      }),
      ...costs([[2, 11, 4000], [11, 8, 4000]] as const, {
        party: SEMINCERA, prefix: 'SEM', vat: false, category: 'business_space_upkeep',
      }),
      ...costs([[5, 5, 700], [6, 5, 900], [7, 5, 1100], [8, 5, 1100], [9, 5, 800]] as const, {
        party: IRIGATIA, prefix: 'APIR', vat: false, category: 'energy_and_water',
      }),
    ],
    clients: [FRUCTUS, COOPERATIVA, PIAȚA, FERTILIZERRA, SEMINCERA, IRIGATIA],
  }),
};
