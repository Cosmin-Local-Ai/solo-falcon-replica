/**
 * Persona 5 — **long-term landlord** (CAEN 6820 principal; 6811, 6812, 6831, 5520 secondary).
 *
 * ## What this person is
 *
 * Someone who lets three apartments to **named individuals** on twelve-month contracts. All domestic, all
 * in lei — a long-term landlord renting to people who live there has no foreign counterparty, and padding
 * one in would be a fiction (D-DEMO-4).
 *
 * ## Why the tenant, not the landlord, decides the article
 *
 * art. 84 alin. (1) opens *„altele decât veniturile plătite de persoane juridice sau alte entități care au
 * obligația de a conduce evidență contabilă"*, and art. 84¹ takes that excluded population and gives it a
 * withholding regime. So the fact that splits the two regimes is **the tenant's legal nature**, declared by
 * the person in `LeaseFactsYear.tenantNature` — never read off a CUI on a receipt or off a supplier name.
 * This persona's tenants are individuals, so the year runs **art. 84**: the gross is the contract rent
 * measured *indiferent de momentul încasării*, the expense ratio is 20 %, the tax is 10 % and the landlord
 * files the Declarația Unică for it.
 *
 * The art. 84¹ side of the pair is carried by persona 6, whose tenant is a company. One profile-year runs
 * exactly one income determination method, so no single persona can show both — and the pair is what makes
 * the difference legible: same 20 % ratio, different gross measure, different FX anchor, different
 * declaration duty.
 *
 * ## Why `contractRentAnnual` is deliberately not declared
 *
 * art. 84 alin. (2) measures „chiria prevăzută în contract", and the register measures the rent documents
 * issued in the year. Those are two producers of one number, and `selectCedareGross` refuses when they
 * disagree rather than choosing — correctly, because at the persona's own date ten months of a twelve-month
 * year have been invoiced and the contract figure is a full year. Declaring both would make this persona
 * refuse, and a demo that refuses demonstrates nothing. So the persona declares the contract's **date**,
 * its **registration**, and the **tenant's nature**, and lets the register supply the gross. The refusal
 * itself is already covered by `e2e/cedare-lease-facts.spec.ts`.
 *
 * ## The rung it changes
 *
 * The art. 84 net is *cedarea folosinței* income — art. 155 alin. (1) **lit. e)** — so it never joins the
 * CAS cumulation and CAS is 0. The CASS ladder cumulates it onto the **24-smn rung** (base 97.200 lei,
 * CASS 9.720 lei).
 *
 * ## B-122 stays visible
 *
 * Brief 64 Part D item 1: arendă and asocieri are withholding sources under art. 174¹ alin. (3) and the
 * engine does not model them. This persona does not route around that — it is the persona that would land
 * on it, and `personas.test.ts` records the gap rather than papering over it.
 */
import { lei } from '../../domain/money';
import type { PersonaDefinition } from './personaTypes';
import {
  caenClass,
  invoices,
  ladderYear,
  personaDataset,
  personaProfile,
  type PartySpec,
} from './personaKit';

const IDENTITY = {
  nume: 'Mărășanu Gheorghe-Dan',
  cnp: '1680000275522',
  adresa: 'Bd. Eroilor 118, Sibiu',
  telefon: '0744 220 561',
  email: 'dan@marasanuproprietati.example',
  denumire: 'Mărășanu Gheorghe-Dan PFA',
  cui: 'RO12345670',
  formaJuridica: 'Persoană fizică autorizată',
  numarRegComert: 'J32/0210/2015',
  contBancar: 'RO44 CARP 0000 0000 3202 1004 9005',
  banca: 'Banca Carpatică',
};

const TENANT_SORIN: PartySpec = {
  id: 'p5-tenant-sorin',
  denumire: 'Enache Sorin',
  cui: '1234567890123',
  email: 'sorin@enache.example',
  oras: 'Sibiu',
  tara: 'România',
  kind: 'client_person_ro',
  cadenta: 'chirie lunară, transfer pe 3 a fiecărei luni',
};

const TENANT_CRISTINA: PartySpec = {
  id: 'p5-tenant-cristina',
  denumire: 'Barbu Cristina',
  cui: '9876543210987',
  email: 'cristina@barbu.example',
  oras: 'Sibiu',
  tara: 'România',
  kind: 'client_person_ro',
  cadenta: 'chirie lunară, transfer pe 5 a fiecărei luni',
};

const TENANT_TOMA: PartySpec = {
  id: 'p5-tenant-toma',
  denumire: 'Toma Alexandra',
  cui: '3876543210988',
  email: 'alexandra@toma.example',
  oras: 'Mediaș',
  tara: 'România',
  kind: 'client_person_ro',
  cadenta: 'chirie lunară, transfer pe 8 a fiecărei luni',
};

const ADMIN: PartySpec = {
  id: 'p5-admin',
  denumire: 'Administrare Domus SRL',
  cui: 'RO46802579',
  email: 'facturi@domusadministrare.example',
  oras: 'Sibiu',
  tara: 'România',
  kind: 'supplier_ro',
  cadenta: 'administrare și relația cu chiriașii, lunar',
};

const profile = personaProfile('persona-long-term-landlord', IDENTITY, [
  caenClass('6820'),
  caenClass('6811'),
  caenClass('6812'),
  caenClass('6831'),
  caenClass('5520'),
], {
  pfaStartYear: 2015,
  pfaStartDate: '2015-02-11',
  activityFamily: 'other',
  // The fact that selects art. 84 over art. 84^1. Declared, never inferred.
  leaseFactsYears: [
    {
      fiscalYear: 2026,
      tenantNature: 'persoana_fizica',
      contractDate: '2025-12-15',
      contractRegistered: 'da',
      rentPaidExclusivelyInKind: 'nu',
      guaranteeAppliedToRent: 'nu',
    },
  ],
  // The CASS ladder sums over all six art. 155 alin. (1) lit. c)-h) categories, and a category with no
  // answer makes the sum unknown rather than smaller — so the five the landlord has no income from are
  // declared zeros, which is a fact the person states. The letting net joins as lit. e) from the art. 84
  // leg; `cedareaSursa` is the art. 83 alin. (1) gate that keeps it there (D-OTH-2).
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

export const longTermLandlordPersona: PersonaDefinition = {
  id: 'long-term-landlord',
  label: 'Proprietar de chirii pe termen lung',
  summary:
    'Trei apartamente închiriate pe contracte de doisprezece luni unor persoane fizice. 324.000 lei chirie '
    + 'în 2026, toate în lei.',
  teaches: [
    'art. 84 alin. (2): venitul brut se măsoară din chiria prevăzută în contract, indiferent de încasare',
    'Cheltuieli forfetare 20 % și impozit 10 % stabilit de contribuabil, cu Declarația Unică pentru venit',
    'CASS pe art. 155 alin. (1) lit. e) și scara de la art. 170 alin. (2)-(4), nu CAS',
    'Partea ce lipsește: reținerea la sursă pentru arendă (art. 174^1 alin. (3)) nu este modelată — B-122',
    'Contractul de închiriere înregistrat și data lui, care alimentează un termen de depunere',
  ],
  identity: IDENTITY,
  caen: { principal: '6820', secondary: ['6811', '6812', '6831', '5520'] },
  counterparties: [
    { name: TENANT_SORIN.denumire, kind: TENANT_SORIN.kind, tara: TENANT_SORIN.tara, cadenta: TENANT_SORIN.cadenta },
    { name: TENANT_CRISTINA.denumire, kind: TENANT_CRISTINA.kind, tara: TENANT_CRISTINA.tara, cadenta: TENANT_CRISTINA.cadenta },
    { name: TENANT_TOMA.denumire, kind: TENANT_TOMA.kind, tara: TENANT_TOMA.tara, cadenta: TENANT_TOMA.cadenta },
    { name: ADMIN.denumire, kind: ADMIN.kind, tara: ADMIN.tara, cadenta: ADMIN.cadenta },
  ],
  data: personaDataset(profile, {
    revenues: [
      ...invoices(Array.from({ length: 12 }, (_, i) => [i + 1, 3, 10000] as const), {
        party: TENANT_SORIN, prefix: 'CHIR-A', vat: false,
      }),
      ...invoices(Array.from({ length: 12 }, (_, i) => [i + 1, 5, 9000] as const), {
        party: TENANT_CRISTINA, prefix: 'CHIR-B', vat: false,
      }),
      ...invoices(Array.from({ length: 12 }, (_, i) => [i + 1, 8, 8000] as const), {
        party: TENANT_TOMA, prefix: 'CHIR-C', vat: false,
      }),
    ],
    expenses: [],
    clients: [TENANT_SORIN, TENANT_CRISTINA, TENANT_TOMA, ADMIN],
  }),
};
