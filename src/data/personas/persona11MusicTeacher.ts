/**
 * Persona 11 — **music teacher, private lessons and online courses** (CAEN 8552 principal; 8559, 8569
 * secondary).
 *
 * ## Why this persona exists — B-131
 *
 * Secțiunea **Q (învățământ)** had no persona: all 12 education clase could only reach a demo through the
 * secțiune-level route. The persona the secțiune calls for is the one a Romanian PFA actually runs — private
 * music lessons and non-formal courses — not a school. **The clase that stay out of this persona are the
 * school clase** (8510 preșcolar, 8520 primar, 8531/8532/8533 secundar și post-secundar, 8540 superior):
 * those are units of the education system, and a PFA does not run one. The three clase this persona does
 * declare are the non-formal ones, where ONRC registration is the whole of the entry condition.
 *
 * ## What this person is
 *
 * A piano teacher with three income streams: individual lessons paid by families, a weekly timetable
 * subcontracted by a private school, and pre-recorded courses sold through a UK platform in euro. The
 * foreign counterparty is here because the activity genuinely has one — a course catalogue sells abroad —
 * and it is what makes the FY2026 thresholds measurable in lei at all: an EUR receipt has to cross a rate
 * date before it can be compared with a 24-smn rung.
 *
 * ## The two caps this persona carries — and the one the app refuses to strike
 *
 * - **art. 68 alin. (5) lit. g) — contribuții private de pensii, „în limita echivalentului în lei a 400 euro
 *   anual pentru fiecare persoană".** 3.000 lei paid by 31 October. The ceiling is stated in euro and **the
 *   app does not convert it**: HG 1/2016 Norme, Titlul IV, Cap. II, Secțiunea a 2-a, pct. 7 alin. (6) asks
 *   for the BNR *average for the year of payment*, CF art. 9 alin. (3) lit. b) and alin. (4) point at the
 *   BNR rate *on the payment date*, and no primary text reconciles them. The ten contribution rows are
 *   therefore excluded as `cap_unresolved`, with both rules quoted — not deducted at a guessed rate, not
 *   silently zeroed. The register does hold EUR rates (the platform receipts enter the lei base through
 *   them, twelve conversions), which is what makes the refusal legible rather than a missing datum: the app
 *   has daily rates and still will not invent an annual average, and will not choose between the two.
 * - **art. 68 alin. (5) lit. i) — cheltuiala comună a biroului de acasă.** The studio is the flat: the law
 *   allows „partea de cheltuială care este aferentă activității" and gives **no method at all** for the
 *   split. The two utility rows are therefore recorded and left `undetermined` — the app refuses to invent
 *   a percentage, which is the whole point of that rule.
 *
 * ## Thresholds it crosses
 *
 * **CAS 24-smn rung (97.200 lei)** engaged. The 400-euro private-pension ceiling is *reached* in money terms
 * and **not struck**, for the conversion reason above — the rows are reported, not deducted. The TVA plafon
 * is deliberately not reached: a one-person teaching practice does not invoice 395.000 lei, and a persona
 * that pretends otherwise would be padding.
 */
import type { PersonaDefinition } from './personaTypes';
import {
  caenClass,
  costs,
  fixtureRates,
  invoices,
  personaDataset,
  personaProfile,
  type PartySpec,
} from './personaKit';

const IDENTITY = {
  nume: 'Iancu Mihaela',
  cnp: '2680000417035',
  adresa: 'Str. Foisorului 7, Cluj-Napoca',
  telefon: '0748 331 206',
  email: 'mihaela@iancupianoforte.example',
  denumire: 'Iancu Mihaela PFA',
  cui: 'RO83940516',
  formaJuridica: 'Persoană fizică autorizată',
  numarRegComert: 'J12/1846/2017',
  contBancar: 'RO44 CARP 0000 0000 1218 4602 9012',
  banca: 'Banca Carpatică',
};

const FAMILII: PartySpec = {
  id: 'p11-familii',
  denumire: 'Părinți — lecții particulare',
  cui: 'RO00000000',
  oras: 'Cluj-Napoca',
  tara: 'România',
  kind: 'client_person_ro',
  cadenta: 'plată lunară pe oră de lecție, cursuri în anul școlar',
};

const SCOALA: PartySpec = {
  id: 'p11-arpeggio',
  denumire: 'Școala de Muzică Arpeggio SRL',
  cui: 'RO92930415',
  email: 'directiune@arpeggio.example',
  oras: 'Cluj-Napoca',
  tara: 'România',
  kind: 'client_corporate_ro',
  cadenta: 'normă lunară de ore, factură la sfârșitul lunii, plată la 15 zile',
};

const PLATFORMA: PartySpec = {
  id: 'p11-cantabile',
  denumire: 'Cantabile Learning Ltd',
  cui: 'UK-DEMO-0002',
  email: 'payouts@cantabilllearning.example',
  oras: 'Londra',
  tara: 'Marea Britanie (în afara UE)',
  kind: 'client_corporate_foreign',
  cadenta: 'încasări lunare din abonamente, virament în euro la începutul lunii următoare',
};

const STUDIO: PartySpec = {
  id: 'p11-studio',
  denumire: 'Imobiliara Centru SRL',
  cui: 'RO13142536',
  email: 'inchirieri@imobiliaracentru.example',
  oras: 'Cluj-Napoca',
  tara: 'România',
  kind: 'supplier_ro',
  cadenta: 'chirie lunară pentru sala de lecții, contract pe 3 ani',
};

const PIANARIA: PartySpec = {
  id: 'p11-pianaria',
  denumire: 'Pianoseria Transilvană SRL',
  cui: 'RO25263748',
  oras: 'Cluj-Napoca',
  tara: 'România',
  kind: 'supplier_ro',
  cadenta: 'tunaj și reglaj, de trei ori pe an',
};

const TELECOM: PartySpec = {
  id: 'p11-telecom',
  denumire: 'Rețeaua Carpaților SRL',
  cui: 'RO36374859',
  email: 'relatii@reteauacarpatilor.example',
  oras: 'Cluj-Napoca',
  tara: 'România',
  kind: 'supplier_ro',
  cadenta: 'internet și platforma de cursuri, factură lunară',
};

const FUND: PartySpec = {
  id: 'p11-fund',
  denumire: 'Fundul de Pensii Carpatic SAI',
  cui: 'RO58596071',
  email: 'clienti@fondulcarpatic.example',
  oras: 'București',
  tara: 'România',
  kind: 'supplier_ro',
  cadenta: 'contribuție privată de pensii, plată lunară prin debit direct',
};

const UTILITATI: PartySpec = {
  id: 'p11-utilitati',
  denumire: 'Cittatea Utilități SRL',
  cui: 'RO70718293',
  oras: 'Cluj-Napoca',
  tara: 'România',
  kind: 'supplier_ro',
  cadenta: 'încălzire și energie pentru sala lucrată din locuință, factură bimonthrială',
};

/** The school-year shape a teaching practice has: autumn and spring full, July–August almost empty. */
const LECTII = [9500, 9000, 10000, 11000, 10500, 7000, 5000, 5500, 11500, 12000, 11500, 10000] as const;
const ORE_SCOALA = [3000, 3000, 3500, 3500, 3500, 2000, 1500, 2000, 4000, 4000, 4000, 3500] as const;
const CURSURI_EUR = [700, 700, 800, 900, 850, 500, 400, 450, 900, 950, 900, 850] as const;

const EUR_RATE_IN_FIXTURE = '5.0000';

const profile = personaProfile('persona-music-teacher', IDENTITY, [
  caenClass('8552'),
  caenClass('8559'),
  caenClass('8569'),
], {
  pfaStartYear: 2017,
  pfaStartDate: '2017-09-11',
  activityFamily: 'other',
  vatRegistration: { status: 'scutit_art310' },
});

export const musicTeacherPersona: PersonaDefinition = {
  id: 'music-teacher',
  label: 'Profesoară de muzică — lecții și cursuri online',
  summary:
    'Lecții particulare, ore subcontractate unei școli private și cursuri vândute unei platforme din Marea '
    + 'Britanie. 187.250 lei în 2026, contribuții private de pensii peste plafonul de 400 EUR.',
  teaches: [
    'Secțiunea Q modelată prin clasele non-formale (8552, 8559, 8569); clasele de învățământ de stat rămân în afara setului',
    'art. 68 alin. (5) lit. g): plafonul de 400 euro anual la contribuțiile private de pensii nu poate fi lovit — aplicația numește conflictul dintre media BNR pe an și cursul de la data plății și exclude cheltuiala, în loc s-o deducă la un curs inventat',
    'art. 68 alin. (5) lit. i): cheltuiala comună a biroului de acasă rămâne `undetermined`, pentru că legea nu dă nicio metodă de împărțire',
    'Încasări în euro de la o platformă din afara UE: pragurile în lei se compară abia după o dată de conversie',
    'Sezon real: anul școlar umple iarna, vara statamentul cade la o treime',
  ],
  identity: IDENTITY,
  caen: { principal: '8552', secondary: ['8559', '8569'] },
  counterparties: [
    { name: FAMILII.denumire, kind: FAMILII.kind, tara: FAMILII.tara, cadenta: FAMILII.cadenta },
    { name: SCOALA.denumire, kind: SCOALA.kind, tara: SCOALA.tara, cadenta: SCOALA.cadenta },
    { name: PLATFORMA.denumire, kind: PLATFORMA.kind, tara: PLATFORMA.tara, cadenta: PLATFORMA.cadenta },
    { name: STUDIO.denumire, kind: STUDIO.kind, tara: STUDIO.tara, cadenta: STUDIO.cadenta },
    { name: PIANARIA.denumire, kind: PIANARIA.kind, tara: PIANARIA.tara, cadenta: PIANARIA.cadenta },
    { name: TELECOM.denumire, kind: TELECOM.kind, tara: TELECOM.tara, cadenta: TELECOM.cadenta },
    { name: FUND.denumire, kind: FUND.kind, tara: FUND.tara, cadenta: FUND.cadenta },
    { name: UTILITATI.denumire, kind: UTILITATI.kind, tara: UTILITATI.tara, cadenta: UTILITATI.cadenta },
  ],
  data: personaDataset(profile, {
    revenues: [
      ...invoices(LECTII.map((v, i) => [i + 1, 28, v] as const), { party: FAMILII, prefix: 'LECT', vat: false }),
      ...invoices(ORE_SCOALA.map((v, i) => [i + 1, 30, v] as const), { party: SCOALA, prefix: 'ARP', vat: false }),
      ...invoices(CURSURI_EUR.map((v, i) => [i + 1, 5, v] as const), {
        party: PLATFORMA, prefix: 'CANT', vat: false, currency: 'EUR',
      }),
    ],
    expenses: [
      ...costs(Array.from({ length: 12 }, (_, i) => [i + 1, 4, 2200] as const), {
        party: STUDIO, prefix: 'CHIR', vat: false, category: 'rent_business_space',
      }),
      ...costs([[2, 14, 600], [6, 10, 600], [11, 7, 600]] as const, {
        party: PIANARIA, prefix: 'TUN', vat: false, category: 'business_space_upkeep',
      }),
      ...costs(Array.from({ length: 12 }, (_, i) => [i + 1, 9, 180] as const), {
        party: TELECOM, prefix: 'TEL', vat: false, category: 'postal_and_telecom',
      }),
      // 300 lei a month: 3.600 lei for the year, against a 400-EUR ceiling. The ceiling is what cuts.
      ...costs(Array.from({ length: 12 }, (_, i) => [i + 1, 5, 300] as const), {
        party: FUND, prefix: 'PENS', vat: false, category: 'private_pension_contribution',
      }),
      // The shared-cost rows the law allows but does not measure. They stay in the register and out of the
      // base: `undetermined` is the answer, not a guessed percentage.
      ...costs([[1, 20, 1200], [7, 22, 1200]] as const, {
        party: UTILITATI, prefix: 'UTIL', vat: false, category: 'home_office_shared_cost',
      }),
    ],
    clients: [FAMILII, SCOALA, PLATFORMA, STUDIO, PIANARIA, TELECOM, FUND, UTILITATI],
    fxRates: fixtureRates('EUR', EUR_RATE_IN_FIXTURE, CURSURI_EUR.map((_, i) => `2026-${String(i + 1).padStart(2, '0')}-05`)),
  }),
};
