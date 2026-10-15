/**
 * Persona 14 — **insurance agent** (CAEN 6622 principal; 6629 secondary).
 *
 * ## Why this persona exists — B-131, and why it is the *only* class in L worth a persona
 *
 * Secțiunea **L (intermedieri financiare și asigurări)** is the secțiune the brief told me not to write off
 * wholesale, and it does not deserve to be written off wholesale: **6622 „Activități ale agenților și
 * broker-ilor de asigurări"** is a stock Romanian PFA activity — an insurance agent is an authorised person
 * registered as an intermediary, not a bank. What is genuinely out is the rest of the secțiune:
 *
 * - **Out:** 6411 (banca centrală), 6419 (intermedieri monetare), 6421 / 6422 (holdinguri, canale de
 *   finanțare), 6431 / 6432 (fonduri de investiții și fonduri mutuale), 6491 (leasing financiar), 6492
 *   (creditare), 6499, 6511 / 6512 / 6520 / 6530 (asigurări, reasigurări, fonduri de pensii — *underwriting*,
 *   not intermediation), 6611 (administrarea piețelor financiare), 6612 (intermedierea tranzacțiilor
 *   financiare), 6630 (administrarea fondurilor). Those are authorised-and-supervised financial activities;
 *   the authorisation is the business, and a PFA demo of one would imply an authorisation the user does not
 *   have. **This is a product-scope judgement, not a verified citation** — see the B-131 register row.
 * - **In:** 6622, plus 6629 (alte activități auxiliare de asigurări) as the secondary class the same agent
 *   declares for the assistance work around the policies.
 *
 * ## What this person is
 *
 * An agent with two carrier portfolios and a participation in a broker's book. Commissions, not invoices to
 * clients: the carrier pays a statement, and the counterparty type is a corporate payer, not a platform that
 * withholds. The register is deliberately thin on costs — this is a desk, a phone and a car.
 *
 * ## Thresholds it crosses
 *
 * - **CAS 24-smn rung (97.200 lei)** — engaged, and the net is high enough that the CASS 72-smn ceiling is
 *   *approached* without being crossed: the set already has a commerce persona that approaches it, and this
 *   one shows what "close" looks like on a contribution base of its own.
 * - **art. 68 alin. (7) lit. k) — 50 % on the car**, because the car is `mixed` and there is no *foaie de
 *   parcurs*. The cap bites: 7.200 lei of fuel and service, 3.600 lei deductible.
 * - **art. 68 alin. (5) lit. q) in its euro form — 900 lei of union dues leave the base.** The category here
 *   is `professional_body_dues`, whose ceiling the rule states as **4.000 euro anual**, and a euro ceiling
 *   cannot be struck while the conversion rule is contested — so the dues are excluded as `cap_unresolved`.
 *   Persona 12's `mandatory_professional_contribution` is the neighbouring category with a **lei** ceiling
 *   (5 % din venitul brut) and is allowed in full. Same kind of expense, opposite outcome, and the reason is
 *   in the rule, not in the data: that is the difference this persona is here to show.
 * - **TVA 395.000 lei** — the year ends just under the plafon, so the row stays a level being watched rather
 *   than a duty already triggered. That is a deliberate choice, not an oversight: an agent who crossed it
 *   would be a VAT-registered persona, and the set already has one.
 */
import { lei } from '../../domain/money';
import type { PersonaDefinition } from './personaTypes';
import {
  PERSONA_FISCAL_YEAR,
  caenClass,
  costs,
  invoices,
  personaDataset,
  personaProfile,
  type PartySpec,
} from './personaKit';

const IDENTITY = {
  nume: 'Munteanu Daniel',
  cnp: '1660000417057',
  adresa: 'Str. Văcărești 9, București',
  telefon: '0744 502 331',
  email: 'daniel@munteanuasigurari.example',
  denumire: 'Munteanu Daniel PFA',
  cui: 'RO26273849',
  formaJuridica: 'Persoană fizică autorizată',
  numarRegComert: 'J40/11294/2015',
  contBancar: 'RO44 CARP 0000 0000 4011 2940 9015',
  banca: 'Banca Carpatică',
};

const DANUBIA: PartySpec = {
  id: 'p14-danubia',
  denumire: 'Danubia Asigurări SA',
  cui: 'RO92930416',
  email: 'agenti@danubia.example',
  oras: 'București',
  tara: 'România',
  kind: 'client_corporate_ro',
  cadenta: 'statament lunar de comisioane, virament la 20 de zile de la închiderea statamentului',
};

const CARPATICA: PartySpec = {
  id: 'p14-carpatica',
  denumire: 'Carpatica Asigurări SA',
  cui: 'RO13142537',
  email: 'retea@carpaticaasigurari.example',
  oras: 'București',
  tara: 'România',
  kind: 'client_corporate_ro',
  cadenta: 'statament lunar, virament la 30 de zile; comisioanele de renewal se virează în ianuarie',
};

const BROKER: PartySpec = {
  id: 'p14-broker',
  denumire: 'Group Broker Dunărea SRL',
  cui: 'RO25263749',
  email: 'parteneri@groupbroker.example',
  oras: 'Constanța',
  tara: 'România',
  kind: 'client_corporate_ro',
  cadenta: 'cotă din portofoliul de persoane juridice, decontare lunară',
};

const BIROU: PartySpec = {
  id: 'p14-birou',
  denumire: 'Biroul Central SRL',
  cui: 'RO36374860',
  email: 'inchirieri@biroulcentral.example',
  oras: 'București',
  tara: 'România',
  kind: 'supplier_ro',
  cadenta: 'chirie lunară pentru biroul de două birouri',
};

const TELECOM: PartySpec = {
  id: 'p14-telecom',
  denumire: 'Rețeaua Carpaților SRL',
  cui: 'RO36374859',
  email: 'relatii@reteauacarpatilor.example',
  oras: 'București',
  tara: 'România',
  kind: 'supplier_ro',
  cadenta: 'telefonie și date, factură lunară',
};

const PETROLINA: PartySpec = {
  id: 'p14-petrolina',
  denumire: 'Petrolina SRL',
  cui: 'RO37261584',
  oras: 'București',
  tara: 'România',
  kind: 'supplier_ro',
  cadenta: 'realimentare, la vizitele la clienți',
};

const UNIUNEA: PartySpec = {
  id: 'p14-uniunea',
  denumire: 'Uniunea Agenților de Asigurări Carpați',
  cui: 'RO47485961',
  oras: 'București',
  tara: 'România',
  kind: 'supplier_ro',
  cadenta: 'cotizație anuală de membru, plată în martie',
};

/** Commissions follow the renewal calendar, not the weather: autumn and December above winter. */
const DANUBIA_STATAMENTE = [15000, 14500, 16000, 17500, 18000, 17000, 15500, 15000, 19000, 19500, 19000, 18000] as const;
const CARPATICA_STATAMENTE = [10500, 10000, 11500, 12500, 13000, 12000, 11000, 10500, 13500, 14000, 13500, 13000] as const;
const COTA_BROKER = Array.from({ length: 12 }, () => 2000) as number[];

const profile = personaProfile('persona-insurance-agent', IDENTITY, [
  caenClass('6622'),
  caenClass('6629'),
], {
  pfaStartYear: 2015,
  pfaStartDate: '2015-11-02',
  activityFamily: 'other',
  vatRegistration: { status: 'scutit_art310' },
});

export const insuranceAgentPersona: PersonaDefinition = {
  id: 'insurance-agent',
  label: 'Agent de asigurări',
  summary:
    'Două portofolii de asigurător și o cotă dintr-un portofoliu de broker. 364.000 lei comisioane în 2026 — '
    + 'singura clasă din secțiunea L pe care un PFA o poate face.',
  teaches: [
    'Secțiunea L nu e în totalitate în afara produsului: 6622 (agent și broker de asigurări) este o activitate PFA; underwriting-ul, creditarea, leasingul și administrarea de fonduri rămân în afară',
    'Comisionul plătit de asigurător nu e venit de pe o platformă cu reținere: e un plătitor corporate cu statament',
    'art. 68 alin. (7) lit. k): mașină cu utilizare mixtă, fără foaie de parcurs — 50 %, plafonul taie (7.200 lei cheltuieli, 3.600 deductibili)',
    'Plafonul în euro nu se poate lovi nici aici: 900 lei de cotizație de sindicat ies din bază ca `cap_unresolved`, în timp ce contribuția profesională cu plafon în lei (persona 12) rămâne deductibilă',
    'Venit anual aproape de plafonul de 395.000 lei, dar sub el: rândul TVA rămâne un nivel urmărit, nu o obligație apărută',
    'CAS pe treapta de 24 de salarii minime, cu o bază de contribuție mare și cheltuieli puține',
  ],
  identity: IDENTITY,
  caen: { principal: '6622', secondary: ['6629'] },
  counterparties: [
    { name: DANUBIA.denumire, kind: DANUBIA.kind, tara: DANUBIA.tara, cadenta: DANUBIA.cadenta },
    { name: CARPATICA.denumire, kind: CARPATICA.kind, tara: CARPATICA.tara, cadenta: CARPATICA.cadenta },
    { name: BROKER.denumire, kind: BROKER.kind, tara: BROKER.tara, cadenta: BROKER.cadenta },
    { name: BIROU.denumire, kind: BIROU.kind, tara: BIROU.tara, cadenta: BIROU.cadenta },
    { name: TELECOM.denumire, kind: TELECOM.kind, tara: TELECOM.tara, cadenta: TELECOM.cadenta },
    { name: PETROLINA.denumire, kind: PETROLINA.kind, tara: PETROLINA.tara, cadenta: PETROLINA.cadenta },
    { name: UNIUNEA.denumire, kind: UNIUNEA.kind, tara: UNIUNEA.tara, cadenta: UNIUNEA.cadenta },
  ],
  data: personaDataset(profile, {
    revenues: [
      ...invoices(DANUBIA_STATAMENTE.map((v, i) => [i + 1, 20, v] as const), { party: DANUBIA, prefix: 'DAN', vat: false }),
      ...invoices(CARPATICA_STATAMENTE.map((v, i) => [i + 1, 22, v] as const), { party: CARPATICA, prefix: 'CAR', vat: false }),
      ...invoices(COTA_BROKER.map((v, i) => [i + 1, 27, v] as const), { party: BROKER, prefix: 'GBD', vat: false }),
    ],
    expenses: [
      ...costs(Array.from({ length: 12 }, (_, i) => [i + 1, 2, 1500] as const), {
        party: BIROU, prefix: 'CHIR', vat: false, category: 'rent_business_space',
      }),
      ...costs(Array.from({ length: 12 }, (_, i) => [i + 1, 6, 200] as const), {
        party: TELECOM, prefix: 'TEL', vat: false, category: 'postal_and_telecom',
      }),
      // Mixed use, no logbook: the 50 % default of art. 68 alin. (7) lit. k) is what applies here.
      ...costs(Array.from({ length: 12 }, (_, i) => [i + 1, 12, 500] as const), {
        party: PETROLINA, prefix: 'PET', vat: false, category: 'vehicle_related', vehicleId: 'p14-car',
        tip: () => 'bon-fiscal',
      }),
      ...costs([[5, 16, 1200]] as const, {
        party: PETROLINA, prefix: 'REV', vat: false, category: 'vehicle_related', vehicleId: 'p14-car',
      }),
      ...costs([[3, 18, 900]] as const, {
        party: UNIUNEA, prefix: 'COT', vat: false, category: 'professional_body_dues',
      }),
    ],
    clients: [DANUBIA, CARPATICA, BROKER, BIROU, TELECOM, PETROLINA, UNIUNEA],
    vehicles: [
      {
        id: 'p14-car',
        label: 'Autoturismul cu care merg la clienți (M1, 5 locuri)',
        plate: 'B 00 DEM4',
        years: [
          {
            fiscalYear: PERSONA_FISCAL_YEAR,
            usedByPerson: 'da',
            use: 'mixed',
            designatedForRunningCosts: 'da',
          },
        ],
      },
    ],
    fixedAssets: [
      {
        id: 'p14-asset-birou',
        label: 'Echipamente de birou și sistem de emitere polițe',
        entryDate: '2023-03-06',
        putInFunctionDate: '2023-04-01',
        fiscalValue: lei(18000),
        normalLifeMonths: 72,
        method: 'liniar',
        acquisition: 'cumparare',
        paymentState: 'achitat',
        paidOn: '2023-03-10',
        isM1Vehicle: false,
      },
    ],
  }),
};
