/**
 * Persona 9 — **small producer on normă de venit, with a market stall** (CAEN 4721 principal; 4711, 4727,
 * 4724 secondary).
 *
 * ## Why a ninth persona
 *
 * Brief 64 fixes eight, and the eight are here. This one exists because of a hole the eight left: the
 * art. 170 alin. (4) lit. f) choice between „venitul net **sau** norma de venit, după caz" is modelled in
 * `CassLadderYear.activitatiAgricoleBaza`, and **no persona exercised the normă side of it**. A field that
 * no demo ever sets is a field that ships untested and unread.
 *
 * It cannot be folded into persona 7. That persona's farming *is* its PFA activity, determined in sistem
 * real, so its CASS limb is art. 155 alin. (1) **lit. b)** and art. 83 alin. (1) keeps the same money out
 * of the ladder; running it through lit. f) as well would be a double representation. The normă needs a
 * profile where the farming is **not** the registered activity — which is the common Romanian shape: a
 * household plot whose income is assessed by normă, beside a small registered trade.
 *
 * ## What this person is
 *
 * A PFA whose registered object is selling fresh fruit and vegetables from a market stall (CAEN 4721 —
 * *„Comerț cu amănuntul al fructelor și legumelor proaspete"*). Note what is **not** in the CAEN list: no
 * 0113, no 0125. The family orchard and field are not a registered activity class, and that is exactly the
 * fact that puts their income on art. 71 and the ladder rather than on art. 67 and the register. The CAEN
 * list says what the PFA does; it is not a declaration about everything the household earns.
 *
 * ## The normă is declared, never computed (D-NORMA-2)
 *
 * The 102.000-lei normă is a figure the taxpayer **states**, from the act the SPV issues for their locality
 * and activity. The app does not derive it, does not look it up, and does not hold a norm table — none has
 * ever been verified in this project, and shipping one invented would be worse than shipping none. So
 * D-NORMA-2 stays open as a *data* question while the *choice* between the two lit. f) measurements is
 * exercised and visible. `personas.test.ts` asserts that no persona derives a normă; only that one declares
 * it, and that exactly one persona sets `activitatiAgricoleBaza: 'norma_de_venit'`.
 *
 * ## The two CASS limbs, side by side, and why they never merge
 *
 * This is the persona that shows ANAF's own sentence in numbers: *„veniturile din activități independente nu
 * se cumulează cu alte venituri pentru determinarea obligației de plată a CASS."* The stall pays CASS at
 * 10 % of its sistem-real net (art. 155 alin. (1) lit. b), art. 170 alin. (1)); the orchard pays CASS on the
 * **ladder** (art. 170 alin. (2)-(4)), where the declared 102.000 lei is replaced by the **24-smn rung**,
 * 97.200 lei. Two figures, two articles, one taxpayer — and the CAS cumulation of art. 148 alin. (3) takes
 * the stall net and *not* the normă, because art. 71 income is not in that list.
 *
 * ## The rung it changes
 *
 * The **CASS ladder rung**: the normă lands the profile on the 24-smn rung, so the base the app charges is
 * 97.200 lei rather than the 102.000 lei declared. That substitution — declared income replaced by a rung —
 * is the single most consequential thing the ladder does, and until this persona nothing in the demo set
 * showed it.
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
  nume: 'Bujor Nicolae-Alin',
  cnp: '1920000180619',
  adresa: 'Str. Izvorului 12, Pitești',
  telefon: '0741 553 208',
  email: 'nicolae@bujortaraba.example',
  denumire: 'Bujor Nicolae-Alin PFA',
  cui: 'RO67890125',
  formaJuridica: 'Persoană fizică autorizată',
  numarRegComert: 'J03/0771/2021',
  contBancar: 'RO44 CARP 0000 0000 0307 7105 9009',
  banca: 'Banca Carpatică',
};

const EN_GROSS: PartySpec = {
  id: 'p9-engross',
  denumire: 'En gross Carpatic SRL',
  cui: 'RO78901237',
  email: 'comenzi@engrosscarpatic.example',
  oras: 'Pitești',
  tara: 'România',
  kind: 'supplier_ro',
  cadenta: 'marfă de revânzare, două comenzi pe săptămână, plată la 15 zile',
};

const PIAȚA: PartySpec = {
  id: 'p9-piata',
  denumire: 'Piața Centrală Pitești SRL',
  cui: 'RO89012347',
  oras: 'Pitești',
  tara: 'România',
  kind: 'supplier_ro',
  cadenta: 'taxă de tarabă și pază, factură lunară',
};

const CLIENTI: PartySpec = {
  id: 'p9-clienti',
  denumire: 'Clienți la tarabă',
  cui: 'RO00000000',
  oras: '—',
  tara: 'România',
  kind: 'client_person_ro',
  cadenta: 'vânzare cu amănuntul, încasare zilnică în numerar',
};

/** The stall calendar: a thin February, a heavy August. */
const STALL_SALES = [9000, 9200, 10000, 12000, 14000, 16500, 18500, 19000, 16500, 13500, 11000, 12000] as const;

const profile = personaProfile('persona-agricultural-norma', IDENTITY, [
  caenClass('4721'),
  caenClass('4711'),
  caenClass('4727'),
  caenClass('4724'),
], {
  pfaStartYear: 2021,
  pfaStartDate: '2021-03-08',
  activityFamily: 'other',
  // The normă limb of art. 170 alin. (4) lit. f), declared and not derived — see the header. The other
  // five categories are declared zeros, because the ladder sums over all six and an unanswered category
  // makes the sum unknown rather than smaller.
  cassLadderYears: [
    ladderYear({
      fiscalYear: 2026,
      cedareaFolosinteiBunurilor: lei(0),
      proprietateIntelectuala: lei(0),
      asocierePersoanaJuridica: lei(0),
      activitatiAgricole: lei(102000),
      activitatiAgricoleBaza: 'norma_de_venit',
      investitii: lei(0),
      alteSurse: lei(0),
      alteSurseArt114: 'da',
    }),
  ],
  vatRegistration: { status: 'scutit_art310' },
});

export const agriculturalNormaPersona: PersonaDefinition = {
  id: 'agricultural-norma',
  label: 'Producător agricol la normă de venit, cu tarabă în piață',
  summary:
    'Tarabă de legume și fructe (CAEN 4721) ca activitate autorizată, iar livada și terenul de lângă casă '
    + 'ca venit agricol la normă de venit: 102.000 lei declarați, 97.200 lei baza CASS.',
  teaches: [
    'art. 71 și art. 170 alin. (4) lit. f): norma de venit ca măsură alternativă a venitului agricol, declarată de contribuabil',
    'Două limbe CASS care nu se cumulează niciodată: lit. b) pe netul sistemului real și scara pe norma de venit',
    'Scara înlocuiește venitul declarat cu o treaptă: 102.000 lei declarați, bază 97.200 lei (24 de salarii minime)',
    'art. 148 alin. (3): venitul la normă nu intră în cumularea CAS, pentru că art. 71 nu este în listă',
    'Lista CAEN spune ce face PFA-ul, nu tot ce câștigă gospodăria — de aceea aici nu apare 0113 sau 0125',
  ],
  identity: IDENTITY,
  // No 0113 / 0125 in the list: the household plot is not a registered activity class, and that is the
  // fact that puts its income on art. 71 and the ladder instead of on art. 67 and the register.
  caen: { principal: '4721', secondary: ['4711', '4727', '4724'] },
  counterparties: [
    { name: EN_GROSS.denumire, kind: EN_GROSS.kind, tara: EN_GROSS.tara, cadenta: EN_GROSS.cadenta },
    { name: PIAȚA.denumire, kind: PIAȚA.kind, tara: PIAȚA.tara, cadenta: PIAȚA.cadenta },
    { name: CLIENTI.denumire, kind: CLIENTI.kind, tara: CLIENTI.tara, cadenta: CLIENTI.cadenta },
  ],
  data: personaDataset(profile, {
    revenues: invoices(STALL_SALES.map((v, i) => [i + 1, 27, v] as const), {
      party: CLIENTI, prefix: 'TAR', vat: false,
    }),
    expenses: [
      ...costs(Array.from({ length: 12 }, (_, i) => [i + 1, 6, 3800] as const), {
        party: EN_GROSS, prefix: 'ENG9', vat: false, category: 'business_space_upkeep',
        tip: () => 'factura',
      }),
      ...costs(Array.from({ length: 12 }, (_, i) => [i + 1, 1, 600] as const), {
        party: PIAȚA, prefix: 'TARAB', vat: false, category: 'business_space_upkeep',
      }),
    ],
    clients: [EN_GROSS, PIAȚA, CLIENTI],
  }),
};
