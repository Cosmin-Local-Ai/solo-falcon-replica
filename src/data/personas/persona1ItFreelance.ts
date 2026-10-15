/**
 * Persona 1 — **IT freelance** (CAEN 6210 principal; 6220, 6290, 6310, 5829 secondary).
 *
 * ## What this person is
 *
 * A contract software developer billing three counterparties: a Dutch software house and a British systems
 * company in euro, and one Romanian client in lei. The business is real-sized — **563.000 lei of collected
 * income across twelve months** — because the point of the persona is that the engine can hold a business,
 * not a hobby (D-DEMO-4).
 *
 * ## The three thresholds it crosses, and the one moment the year changes
 *
 * | Threshold | FY2026 value | Where this persona lands |
 * |---|---|---|
 * | TVA — plafonul de înregistrare (art. 310 alin. (1)) | 395.000 lei | crossed on **10 Septembrie 2026**, mid-year, by the Northwind collection |
 * | CAS — pragul de 24 salarii minime (art. 148 alin. (2) lit. b)) | 97.200 lei | far above it → the 24-SM rung, CAS 24.300 lei |
 * | CASS — plafonul de 72 salarii minime (art. 170 alin. (11)) | 291.600 lei | above it → the base is capped and CASS stops at 29.160 lei |
 *
 * The VAT crossing is the teaching case, and it is the reason **B-96** was minted: the plain demo fixture
 * declared itself registered on 9.700 lei of turnover, which is legal but teaches a shape almost nobody
 * has. Here registration is **forced by law**, with the exceedance date, the effective date and the
 * registration route all declared — because a declared VAT *status* does not establish a *cadence* (B-96,
 * B-100). The art. 322 alin. (4) facts are declared too, so the fiscal period is **derived** rather than
 * asked for: annualised turnover for the registration stub against the full 100.000-euro cap, which lands
 * on the month.
 *
 * ## What it does NOT carry
 *
 * No `vatReturns` row — PG-6g's rule that a fixture must not mint a filed decont still holds, and the
 * cadence is now carried by the registration facts instead. No prior-year loss (B-121's operand is not
 * implemented). No lifecycle stage derived from `pfaStartDate` — B-127 is out of this step (D-DEMO-3).
 *
 * ## FX
 *
 * Euro receipts convert at the fixture rate on their own collection date, and the 100.000-euro cap converts
 * at the rate anchored to **31 Decembrie 2025** (Normele pct. 103 alin. (2)) — two different rate dates for
 * two different rules, which is B-105's lesson. Both rates are invented and marked as such; see
 * `fixtureRate` in `./personaKit`.
 */
import { lei } from '../../domain/money';
import type { PersonaDefinition } from './personaTypes';
import {
  PERSONA_FISCAL_YEAR,
  caenClass,
  costs,
  day,
  fixtureRate,
  fixtureRates,
  invoices,
  personaDataset,
  personaProfile,
  type PartySpec,
} from './personaKit';

const IDENTITY = {
  nume: 'Luntea Radu-Andrei',
  // Month `00`, day `00`: a birth date no civil register contains. B-110 requires the fake to be visible.
  cnp: '1770000401201',
  adresa: 'Str. Fermei 8, Cluj-Napoca',
  telefon: '0751 204 118',
  email: 'radu@lunteadev.example',
  denumire: 'Luntea Radu-Andrei PFA',
  cui: 'RO41277301',
  formaJuridica: 'Persoană fizică autorizată',
  numarRegComert: 'J12/0418/2021',
  contBancar: 'RO44 CARP 0000 0000 2211 4455 9001',
  banca: 'Banca Carpatică',
};

const NORTHWIND: PartySpec = {
  id: 'p1-northwind',
  denumire: 'Northwind Digital BV',
  cui: 'NL854670921B01',
  email: 'accounts@northwind.example',
  oras: 'Amsterdam',
  tara: 'Olanda (UE)',
  kind: 'client_corporate_foreign',
  cadenta: 'retainer lunar, factură pe 5, plată pe 10',
};

const HARROWGATE: PartySpec = {
  id: 'p1-harrowgate',
  denumire: 'Harrowgate Systems Ltd',
  cui: 'GB402211873',
  email: 'billing@harrowgate.example',
  oras: 'Leeds',
  tara: 'Regatul Unit (în afara UE)',
  kind: 'client_corporate_foreign',
  cadenta: 'proiecte la comandă, factură la predare, plată la 30 zile',
};

const CODEXA: PartySpec = {
  id: 'p1-codexa',
  denumire: 'Codexa SRL',
  cui: 'RO12345678',
  email: 'contact@codexa.example',
  oras: 'București',
  tara: 'România',
  kind: 'client_corporate_ro',
  cadenta: 'retainer lunar, factură pe 20, plată pe 25',
};

const CONECTICA: PartySpec = {
  id: 'p1-conectica',
  denumire: 'Conectica SRL',
  cui: 'RO87654321',
  email: 'facturi@conectica.example',
  oras: 'București',
  tara: 'România',
  kind: 'supplier_ro',
  cadenta: 'abonament lunar de hosting și conectivitate',
};

const RENTIUM: PartySpec = {
  id: 'p1-rentium',
  denumire: 'Rentium Imobiliare SRL',
  cui: 'RO26190475',
  email: 'chirie@rentium.example',
  oras: 'Cluj-Napoca',
  tara: 'România',
  kind: 'supplier_ro',
  cadenta: 'chirie spațiu de birou, plată pe 5 a fiecărei luni',
};

const PETROLINA: PartySpec = {
  id: 'p1-petrolina',
  denumire: 'Petrolina SRL',
  cui: 'RO37261584',
  oras: 'Cluj-Napoca',
  tara: 'România',
  kind: 'supplier_ro',
  cadenta: 'realimentare și service auto, săptămânal',
};

const PAPETARIA: PartySpec = {
  id: 'p1-papetaria',
  denumire: 'Papetaria SRL',
  cui: 'RO55667788',
  email: 'facturi@papetaria.example',
  oras: 'Cluj-Napoca',
  tara: 'România',
  kind: 'supplier_ro',
  cadenta: 'rechizite și consumabile, la nevoie',
};

/**
 * The EUR→RON fixture rate for 2026, and the one anchored to 31 Decembrie 2025.
 *
 * They are deliberately round so every lei figure in this persona is hand-checkable, and they are
 * deliberately different dates: art. 9 alin. (3) lit. b) converts a receipt on the day it is collected,
 * while Normele pct. 103 alin. (2) converts the 100.000-euro VAT cap at the previous year's last day.
 */
const EUR_RATE_2026 = '5.0000';
const EUR_RATE_CAP_ANCHOR = '4.5000';
const CAP_ANCHOR_DATE = '2025-12-31';

/** The twelve monthly Northwind retainers, 5.500 EUR each, collected on the 10th. */
const NORTHWIND_LINES = Array.from({ length: 12 }, (_, i) => [i + 1, 10, 5500] as const);
/** Codexa's retainer in lei, collected on the 25th. */
const CODEXA_LINES = Array.from({ length: 12 }, (_, i) => [i + 1, 25, 4000] as const);
/** Harrowgate's project invoices: March, June, November. */
const HARROWGATE_LINES = [[3, 20, 9000], [6, 20, 10000], [11, 20, 12000]] as const;

/**
 * The registration date is the fact the whole VAT half of this persona turns on.
 *
 * The plafon is crossed by the Northwind collection of 10 Septembrie; art. 316 alin. (1^1) makes the
 * registration produce effects from the start of the following month, so October is the first month in
 * which the invoices carry TVA. The invoices below follow that date exactly.
 */
const EXCEEDANCE_DATE = '2026-09-10';
const REGISTRATION_EFFECTIVE_FROM = '2026-10-01';

const northwindBefore = invoices(NORTHWIND_LINES.slice(0, 9), {
  party: NORTHWIND,
  prefix: 'NWD',
  currency: 'EUR',
  vat: false,
  eFactura: false,
});
const northwindAfter = invoices(NORTHWIND_LINES.slice(9), {
  party: NORTHWIND,
  prefix: 'NWD',
  currency: 'EUR',
  vat: true,
  eFactura: true,
  numberOffset: 9,
});

const codexaBefore = invoices(CODEXA_LINES.slice(0, 9), {
  party: CODEXA,
  prefix: 'CDX',
  vat: false,
});
const codexaAfter = invoices(CODEXA_LINES.slice(9), {
  party: CODEXA,
  prefix: 'CDX',
  vat: true,
  eFactura: true,
  numberOffset: 9,
});

const harrowgateBefore = invoices(HARROWGATE_LINES.slice(0, 2), {
  party: HARROWGATE,
  prefix: 'HGS',
  currency: 'EUR',
  vat: false,
});
const harrowgateAfter = invoices(HARROWGATE_LINES.slice(2), {
  party: HARROWGATE,
  prefix: 'HGS',
  currency: 'EUR',
  vat: true,
  eFactura: true,
  numberOffset: 2,
});

const profile = personaProfile('persona-it-freelance', IDENTITY, [
  caenClass('6210'),
  caenClass('6220'),
  caenClass('6290'),
  caenClass('6310'),
  caenClass('5829'),
], {
  pfaStartYear: 2021,
  pfaStartDate: '2021-03-08',
  // A declared activity family, not a default — `createDefaultProfile` leaves it absent on purpose.
  activityFamily: 'other',
  vatRegistration: { status: 'plafon_depasit', effectiveFrom: REGISTRATION_EFFECTIVE_FROM },
  vatExceedanceDate: EXCEEDANCE_DATE,
  // B-96 / B-100: the cadence is derived from declared facts, never from the status string. alin. (4)
  // applies because this person came from the art. 310 scutire; the figure is the turnover obtained from
  // the registration date to year end, over the months it covers.
  vatPeriodicityYears: [
    {
      year: PERSONA_FISCAL_YEAR,
      registrationEffectiveFrom: REGISTRATION_EFFECTIVE_FROM,
      registrationRoute: 'b',
      inArt310BeforeRegistration: 'da',
      actualTurnover: lei(162000),
      actualActivityMonths: 3,
      actualTurnoverScope: 'doar_cu_cod_de_tva',
      aicGoodsBeforeRegistration: 'nu',
    },
  ],
});

export const itFreelancePersona: PersonaDefinition = {
  id: 'it-freelance',
  label: 'Freelancer IT — contractări în euro',
  summary:
    'Dezvoltator pe contract cu două firme din UE/UK și una din România. Încasări de 563.000 lei în '
    + '2026, depășește plafonul de TVA la 10 septembrie și devine înregistrat din 1 octombrie.',
  teaches: [
    'TVA: depășirea plafonului de 395.000 lei la mijlocul anului, cu data de depășire, data efectelor și ruta de înregistrare',
    'Perioada fiscală TVA derivată din art. 322 alin. (4), nu declarată de aplicație',
    'CAS pe treapta de 24 de salarii minime și CASS plafonată la 72 de salarii minime',
    'Convertirea în lei la data încasării, cu o a doua dată de curs pentru plafonul de 100.000 euro',
    'Un autoturism de 60.000 lei cu grafic de amortizare pe mai mulți ani și regula „un singur autoturism”',
  ],
  identity: IDENTITY,
  caen: { principal: '6210', secondary: ['6220', '6290', '6310', '5829'] },
  counterparties: [
    { name: NORTHWIND.denumire, kind: NORTHWIND.kind, tara: NORTHWIND.tara, cadenta: NORTHWIND.cadenta },
    { name: HARROWGATE.denumire, kind: HARROWGATE.kind, tara: HARROWGATE.tara, cadenta: HARROWGATE.cadenta },
    { name: CODEXA.denumire, kind: CODEXA.kind, tara: CODEXA.tara, cadenta: CODEXA.cadenta },
    { name: CONECTICA.denumire, kind: CONECTICA.kind, tara: CONECTICA.tara, cadenta: CONECTICA.cadenta },
    { name: RENTIUM.denumire, kind: RENTIUM.kind, tara: RENTIUM.tara, cadenta: RENTIUM.cadenta },
    { name: PETROLINA.denumire, kind: PETROLINA.kind, tara: PETROLINA.tara, cadenta: PETROLINA.cadenta },
    { name: PAPETARIA.denumire, kind: PAPETARIA.kind, tara: PAPETARIA.tara, cadenta: PAPETARIA.cadenta },
  ],
  data: personaDataset(profile, {
    revenues: [
      ...northwindBefore,
      ...northwindAfter,
      ...codexaBefore,
      ...codexaAfter,
      ...harrowgateBefore,
      ...harrowgateAfter,
    ],
    expenses: [
      ...costs(Array.from({ length: 12 }, (_, i) => [i + 1, 3, 250] as const), {
        party: CONECTICA, prefix: 'CON', vat: false, category: 'postal_and_telecom',
      }),
      ...costs(Array.from({ length: 12 }, (_, i) => [i + 1, 5, 1200] as const), {
        party: RENTIUM, prefix: 'REN', vat: false, category: 'rent_business_space',
      }),
      ...costs(Array.from({ length: 12 }, (_, i) => [i + 1, 14, 450] as const), {
        party: PETROLINA, prefix: 'PET', vat: false, category: 'vehicle_related', vehicleId: 'p1-car',
        tip: (i) => (i % 3 === 0 ? 'bon-fiscal' : 'factura'),
      }),
      ...costs([[4, 18, 400], [9, 22, 400]] as const, {
        party: PAPETARIA, prefix: 'PAP', vat: false, category: 'business_space_upkeep',
      }),
    ],
    clients: [NORTHWIND, HARROWGATE, CODEXA, CONECTICA, RENTIUM, PETROLINA, PAPETARIA],
    vehicles: [
      {
        id: 'p1-car',
        label: 'Autoturism personal folosit la vizitele la clienți',
        plate: 'CJ 00 DEM',
        years: [
          {
            fiscalYear: PERSONA_FISCAL_YEAR,
            // Declared, not inferred: the taxpayer uses the car, and does not evidence exclusive use, so
            // art. 68 alin. (7) lit. k) cuts the running costs to 50 %.
            usedByPerson: 'da',
            use: 'mixed',
            designatedForRunningCosts: 'da',
          },
        ],
        vatYears: [{ fiscalYear: PERSONA_FISCAL_YEAR, use: 'mixed', seats: 5, massMaxKg: 1450 }],
      },
    ],
    fixedAssets: [
      {
        id: 'p1-asset-car',
        label: 'Autoturism achiziționat în 2024',
        entryDate: '2024-03-15',
        putInFunctionDate: '2024-04-01',
        fiscalValue: lei(60000),
        normalLifeMonths: 60,
        method: 'liniar',
        acquisition: 'cumparare',
        paymentState: 'achitat',
        paidOn: '2024-03-20',
        isM1Vehicle: true,
      },
    ],
    fxRates: [
      fixtureRate('EUR', CAP_ANCHOR_DATE, EUR_RATE_CAP_ANCHOR),
      ...fixtureRates('EUR', EUR_RATE_2026, [
        ...NORTHWIND_LINES.map((l) => day(l[0], l[1])),
        ...HARROWGATE_LINES.map((l) => day(l[0], l[1])),
      ]),
    ],
  }),
};
