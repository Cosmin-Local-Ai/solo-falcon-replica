/**
 * Persona 12 — **physiotherapy cabinet** (CAEN 8695 principal; 8699 secondary).
 *
 * ## Why this persona exists — B-131
 *
 * Secțiunea **R (sănătate și asistență socială)** had no persona at all. It is a secțiune where a persona is
 * warranted **and** a secțiune where a large part must stay unmodelled, so it is the clearest „partial"
 * verdict in B-131:
 *
 * - **Modelled:** the ambulatory practice clase — 8695 (fizioterapie) and 8699 (alte activități referitoare
 *   la sănătatea umană n.c.a.). A physiotherapist with a cabinet is one of the commonest regulated-PFA
 *   profiles in Romania.
 * - **Deliberately not modelled:** 8610 (asistență spitalicească), 8710 / 8720 / 8730 (centre de îngrijire
 *   și cămine, cu cazare), 8691 (imagistică și laboratoare medicale), 8692 (transport ambulanță). Those are
 * *units* with an authorisation and a licensing regime of their own, not an activity one authorised person
 *   performs. They route through the secțiune like everything else, and the register says they are not
 *   genuinely covered.
 *
 * ## What this person is
 *
 * A physiotherapist with a two-room cabinet: patients pay per series of sessions, and a sports club buys a
 * monthly block of recovery sessions for its members. There is **no vehicle** in this register — the practice
 * is walkable and the persona is the honest empty case, `vehicles: []`, rather than a car added for symmetry.
 *
 * ## The two contribution-shaped expenses — one ceiling struck, one ceiling refused
 *
 * - **art. 68 alin. (5) lit. h) — prime de asigurare voluntară de sănătate, „în limita echivalentului în lei
 *   a 400 euro anual pentru fiecare persoană".** 3.000 lei of premium by 31 October. The row is the express
 *   exception to the art. 68 alin. (7) lit. d) exclusion of insurance premiums — the two letters have to be
 *   read together, and the classification does read them: the category is found, treated as `capped`, and
 *   then **the ceiling itself cannot be struck**, because it is stated in euro and the conversion rule is
 *   contested (pct. 7 alin. (6)'s annual BNR average against CF art. 9 alin. (3) lit. b)'s rate at the
 *   payment date). The ten premium rows are excluded as `cap_unresolved`, with both rules quoted. This is
 *   the same unresolved point persona 11 shows, reached from a different litera.
 * - **art. 68 alin. (5) lit. q) — contribuții profesionale obligatorii, plafon 5 % din venitul brut.** Here
 *   the ceiling is a **percentage of a lei figure**, so it is measurable: the assembler strikes it, the
 *   1.200-lei coleg contribution is inside it, and it is deductible in full. A cap that does not cut is a
 *   different showcase from a cap that cannot be computed, and this persona carries both.
 *
 * ## Thresholds it crosses
 *
 * **CAS 24-smn rung (97.200 lei)** engaged. The 400-euro health-premium ceiling is reached in money terms and
 * **not struck** — the premiums are excluded with the conversion conflict named. The CASS 72-smn ceiling is
 * not reached (the cabinet's net is nowhere near 291.600 lei) and the TVA plafon is not reached either.
 */
import { lei } from '../../domain/money';
import type { PersonaDefinition } from './personaTypes';
import {
  caenClass,
  costs,
  invoices,
  personaDataset,
  personaProfile,
  type PartySpec,
} from './personaKit';

const IDENTITY = {
  nume: 'Drăgan Andreea',
  cnp: '2710000217028',
  adresa: 'Str. Zimbrului 22, Iași',
  telefon: '0747 602 118',
  email: 'andreea@dragankinetoterapie.example',
  denumire: 'Drăgan Andreea PFA',
  cui: 'RO94051627',
  formaJuridica: 'Persoană fizică autorizată',
  numarRegComert: 'J10/2291/2016',
  contBancar: 'RO44 CARP 0000 0000 1022 9104 9013',
  banca: 'Banca Carpatică',
};

const PACIENTI: PartySpec = {
  id: 'p12-pacienti',
  denumire: 'Pacienți cabinet — serii de ședințe',
  cui: 'RO00000000',
  oras: 'Iași',
  tara: 'România',
  kind: 'client_person_ro',
  cadenta: 'plată per serie de 10 ședințe, la începutul seriei',
};

const CLUB: PartySpec = {
  id: 'p12-club',
  denumire: 'Club Sportiv Carpații SRL',
  cui: 'RO82839405',
  email: 'medical@cscarpatii.example',
  oras: 'Iași',
  tara: 'România',
  kind: 'client_corporate_ro',
  cadenta: 'bloc lunar de ședințe pentru sportivii clubului, factură lunară, plată la 15 zile',
};

const CABINET: PartySpec = {
  id: 'p12-cabinet',
  denumire: 'Proprietatea Centrală SRL',
  cui: 'RO81829304',
  email: 'inchirieri@proprietateacentrala.example',
  oras: 'Iași',
  tara: 'România',
  kind: 'supplier_ro',
  cadenta: 'chirie lunară pentru cele două săli de kinetoterapie',
};

const CONSUMABILE: PartySpec = {
  id: 'p12-medicala',
  denumire: 'Medicala Carpatică SRL',
  cui: 'RO93940516',
  email: 'comenzi@medicalacarpatica.example',
  oras: 'Iași',
  tara: 'România',
  kind: 'supplier_ro',
  cadenta: 'consumabile și electrozi, comandă lunară',
};

const ASIGURARE: PartySpec = {
  id: 'p12-asigurare',
  denumire: 'Danubia Asigurări de Sănătate SA',
  cui: 'RO26273849',
  email: 'clienti@danubiasanatate.example',
  oras: 'București',
  tara: 'România',
  kind: 'supplier_ro',
  cadenta: 'primă lunară pentru polița voluntară de sănătate',
};

const COLEGIUL: PartySpec = {
  id: 'p12-colegiul',
  denumire: 'Colegiul Kinetoterapeuților Carpați',
  cui: 'RO15162738',
  oras: 'București',
  tara: 'România',
  kind: 'supplier_ro',
  cadenta: 'contribuție profesională obligatorie, plată anuală în februarie',
};

/** A cabinet's real season: spring and autumn busy, August thin. */
const SEDINTE_PACIENTI = [19000, 18000, 20000, 21000, 22000, 20000, 16000, 15000, 22000, 23000, 22000, 21000] as const;
const BLOC_CLUB = [3000, 3000, 3500, 3500, 3500, 3000, 2000, 2000, 4000, 4000, 4000, 3500] as const;

const profile = personaProfile('persona-physiotherapist', IDENTITY, [
  caenClass('8695'),
  caenClass('8699'),
], {
  pfaStartYear: 2016,
  pfaStartDate: '2016-02-15',
  activityFamily: 'other',
  vatRegistration: { status: 'scutit_art310' },
});

export const physiotherapistPersona: PersonaDefinition = {
  id: 'physiotherapist',
  label: 'Cabinet de fizioterapie',
  summary:
    'Kinetoterapie într-un cabinet cu două săli: pacienți plătitori și un bloc lunar de ședințe pentru un '
    + 'club sportiv. 274.000 lei în 2026, primă de sănătate peste plafonul de 400 EUR.',
  teaches: [
    'Secțiunea R modelată prin clasele ambulatorii (8695, 8699); spitalul, centrele cu cazare, imagistica și ambulanța rămân în afara setului',
    'art. 68 alin. (5) lit. h): primele de asigurare voluntară de sănătate sunt excepție expresă de la art. 68 alin. (7) lit. d) — regula le găsește, dar plafonul în euro nu poate fi lovit, deci cheltuiala iese din bază cu motivul spus',
    'art. 68 alin. (5) lit. q): contribuția profesională obligatorie, plafon 5 % din venitul brut — plafon în lei, deci se poate lovi; aici nu taie, și cei 1.200 de lei rămân deductibili',
    'Un registru fără niciun vehicul: `vehicles: []` este o stare reală, nu o completare uitată',
    'CAS pe treapta de 24 de salarii minime, cu cheltuielile deduse înainte de treaptă',
  ],
  identity: IDENTITY,
  caen: { principal: '8695', secondary: ['8699'] },
  counterparties: [
    { name: PACIENTI.denumire, kind: PACIENTI.kind, tara: PACIENTI.tara, cadenta: PACIENTI.cadenta },
    { name: CLUB.denumire, kind: CLUB.kind, tara: CLUB.tara, cadenta: CLUB.cadenta },
    { name: CABINET.denumire, kind: CABINET.kind, tara: CABINET.tara, cadenta: CABINET.cadenta },
    { name: CONSUMABILE.denumire, kind: CONSUMABILE.kind, tara: CONSUMABILE.tara, cadenta: CONSUMABILE.cadenta },
    { name: ASIGURARE.denumire, kind: ASIGURARE.kind, tara: ASIGURARE.tara, cadenta: ASIGURARE.cadenta },
    { name: COLEGIUL.denumire, kind: COLEGIUL.kind, tara: COLEGIUL.tara, cadenta: COLEGIUL.cadenta },
  ],
  data: personaDataset(profile, {
    revenues: [
      ...invoices(SEDINTE_PACIENTI.map((v, i) => [i + 1, 24, v] as const), { party: PACIENTI, prefix: 'PAC', vat: false }),
      ...invoices(BLOC_CLUB.map((v, i) => [i + 1, 6, v] as const), { party: CLUB, prefix: 'CSC', vat: false }),
    ],
    expenses: [
      ...costs(Array.from({ length: 12 }, (_, i) => [i + 1, 2, 3500] as const), {
        party: CABINET, prefix: 'CHIR', vat: false, category: 'rent_business_space',
      }),
      ...costs(Array.from({ length: 12 }, (_, i) => [i + 1, 13, 900] as const), {
        party: CONSUMABILE, prefix: 'CONS', vat: false, category: 'business_space_upkeep',
      }),
      // 250 lei a month of voluntary health insurance: 3.000 lei against a 400-EUR ceiling.
      ...costs(Array.from({ length: 12 }, (_, i) => [i + 1, 8, 250] as const), {
        party: ASIGURARE, prefix: 'SAN', vat: false, category: 'voluntary_health_insurance',
      }),
      ...costs([[2, 26, 1200]] as const, {
        party: COLEGIUL, prefix: 'COL', vat: false, category: 'mandatory_professional_contribution',
      }),
    ],
    clients: [PACIENTI, CLUB, CABINET, CONSUMABILE, ASIGURARE, COLEGIUL],
    fixedAssets: [
      {
        id: 'p12-asset-aparat',
        label: 'Aparat de electroterapie și ultrasonoterapie',
        entryDate: '2024-11-08',
        putInFunctionDate: '2024-12-01',
        fiscalValue: lei(26000),
        normalLifeMonths: 60,
        method: 'liniar',
        acquisition: 'cumparare',
        paymentState: 'achitat',
        paidOn: '2024-11-12',
        isM1Vehicle: false,
      },
    ],
  }),
};
