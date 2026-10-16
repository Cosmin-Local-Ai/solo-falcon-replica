/**
 * Persona 10 — **construction finishes** (CAEN 4334 principal; 4332, 4333, 4335, 4331 secondary).
 *
 * ## Why this persona exists — B-131
 *
 * Secțiunea **F (construcții)** had no persona at all: none of the nine original personas declared a single
 * class in it, so all 26 construction clase could only ever reach a demo through the secțiune-level route.
 * A finishes contractor is the highest-frequency PFA activity in that secțiune — zugrăveli, gips-carton,
 * faianță, tâmplărie de finisaj — so it is the persona the coverage gap actually calls for, not a class
 * chosen to fill a grid cell.
 *
 * ## What this person is
 *
 * A one-person finishes contractor working mainly for one developer (a monthly situation of works, paid at
 * 30 days) and for private households in smaller bursts. The scale comes from **subcontracting to another
 * PFA**, not from payroll: a PFA's register in this build carries no employees, so the second pair of hands
 * is a supplier with its own invoice (`Cotorean Vasile PFA`). That is a real Romanian arrangement and it is
 * the only honest way this profile can be a three-person job site without inventing a payroll the app does
 * not model.
 *
 * ## The vehicle rules, from the other side of persona 3
 *
 * Persona 3 shows the **50 % default** of art. 68 alin. (7) lit. k). This one shows the two ways out of it,
 * and neither of them is the one-car limit:
 *
 * - `use: 'exclusive'` — the van is used only for the activity and the *foaie de parcurs* exists, so the
 *   running costs are 100 % deductible on the evidence leg.
 * - **art. 68 alin. (5) lit. j) excludes nothing here**: there is one vehicle, so „cel mult un singur
 *   autoturism” has no second car to exclude, and the status the resolver returns is `sole_candidate`. The
 *   limit is shown **at its boundary**, which is the honest way to show a limit that does not bite.
 * - **art. 28 alin. (14) does not reach this vehicle either**: the 1.500-lei/lună ceiling is stated for
 *   category **M1** passenger cars, and a dubă is not one, so the whole 1.033,33 lei/lună stays deductible.
 *   Persona 3's car loses 125 lei a month to that ceiling; this one loses nothing, and the pair is what
 *   makes the ceiling legible.
 *
 * ## Thresholds it crosses
 *
 * - **CAS 24-smn rung (97.200 lei)** — engaged, with the rung reached *after* the protocol cap and the
 *   depreciation leg, not before them.
 * - **art. 68 alin. (5) protocol cap (2 % of the art. 68 alin. (6) base)** — it **bites**: 3.300 lei of
 *   protocol are recorded by 31 October (4.900 lei for the year), and the ceiling admits **2.858 lei** —
 *   2 % of a base of 142.900 lei. The 442 lei over it are not deferred and not recoverable next year; they
 *   are simply not a deductible expense.
 * - **TVA 395.000 lei** — deliberately *not* crossed: the profile sits just under the plafon, so the set
 *   keeps a construction profile that is still in the art. 310 scutire and can watch the level approach.
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
  nume: 'Bârlea Adrian-Nicolae',
  cnp: '1720000217042',
  adresa: 'Str. Făgetului 18, Bistrița',
  telefon: '0745 210 883',
  email: 'adrian@barleafinisaje.example',
  denumire: 'Bârlea Adrian-Nicolae PFA',
  cui: 'RO72839405',
  formaJuridica: 'Persoană fizică autorizată',
  numarRegComert: 'J06/0417/2019',
  contBancar: 'RO44 CARP 0000 0000 0604 1704 9011',
  banca: 'Banca Carpatică',
};

const DEVELOPATOR: PartySpec = {
  id: 'p10-constructura',
  denumire: 'Constructura Carpaților SRL',
  cui: 'RO48495061',
  email: 'santier@constructura.example',
  oras: 'Bistrița',
  tara: 'România',
  kind: 'client_corporate_ro',
  cadenta: 'situție de lucrări lunară, factură la sfârșitul lunii, plată la 30 zile',
};

const ROSU: PartySpec = {
  id: 'p10-rosu',
  denumire: 'Roșu Valentin',
  cui: 'RO00000000',
  oras: 'Bistrița',
  tara: 'România',
  kind: 'client_person_ro',
  cadenta: 'avans la semnare, restul la recepție',
};

const TOMA: PartySpec = {
  id: 'p10-toma',
  denumire: 'Toma Ioana',
  cui: 'RO00000000',
  oras: 'Bistrița',
  tara: 'România',
  kind: 'client_person_ro',
  cadenta: 'plată pe etape de finisaj',
};

const PETRISOR: PartySpec = {
  id: 'p10-petrisor',
  denumire: 'Petrișor Dan',
  cui: 'RO00000000',
  oras: 'Bistrița',
  tara: 'România',
  kind: 'client_person_ro',
  cadenta: 'factură la finalizare, plată în 15 zile',
};

const DEPOT: PartySpec = {
  id: 'p10-depot',
  denumire: 'Depozitul Material Mixt SRL',
  cui: 'RO59506172',
  email: 'comenzi@materialmixt.example',
  oras: 'Bistrița',
  tara: 'România',
  kind: 'supplier_ro',
  cadenta: 'materiale la fiecare șantier, plată ramburs la descărcare',
};

const SUBANTREPRENOR: PartySpec = {
  id: 'p10-cotorean',
  denumire: 'Cotorean Vasile PFA',
  cui: 'RO60617283',
  oras: 'Bistrița',
  tara: 'România',
  kind: 'supplier_ro',
  cadenta: 'factură pe zile lucrate, plată la 15 zile — un alt PFA, nu un salariat',
};

const HALA: PartySpec = {
  id: 'p10-hala',
  denumire: 'Imobiliara Someș SRL',
  cui: 'RO71728394',
  email: 'inchirieri@imobiliarasomes.example',
  oras: 'Bistrița',
  tara: 'România',
  kind: 'supplier_ro',
  cadenta: 'chirie lunară pentru atelierul depozitat, contract multianual',
};

const PETROLINA: PartySpec = {
  id: 'p10-petrolina',
  denumire: 'Petrolina SRL',
  cui: 'RO37261584',
  oras: 'Bistrița',
  tara: 'România',
  kind: 'supplier_ro',
  cadenta: 'realimentare dubă, la fiecare deplasare pe șantier',
};

const SERVICE: PartySpec = {
  id: 'p10-service',
  denumire: 'Mecanica Carpatina SRL',
  cui: 'RO23456781',
  email: 'service@mecanicacarpatina.example',
  oras: 'Bistrița',
  tara: 'România',
  kind: 'supplier_ro',
  cadenta: 'revizii la 20.000 km',
};

/** Seasonality a finishes contractor actually has: the site season is May–September. */
const SITUATII = [18000, 17000, 20000, 25000, 29000, 31000, 32000, 30000, 27000, 24000, 19000, 16000] as const;
const MATERIALE = [5500, 5000, 6000, 7500, 8500, 9000, 9500, 9000, 8000, 7000, 5500, 5000] as const;
const SUBANTREPRESA = [2500, 2500, 3500, 4500, 5500, 6000, 6000, 5500, 4500, 3500, 2500, 2000] as const;

const profile = personaProfile('persona-construction-finisher', IDENTITY, [
  caenClass('4334'),
  caenClass('4332'),
  caenClass('4333'),
  caenClass('4335'),
  caenClass('4331'),
], {
  pfaStartYear: 2019,
  pfaStartDate: '2019-03-04',
  activityFamily: 'other',
  vatRegistration: { status: 'scutit_art310' },
});

export const constructionFinisherPersona: PersonaDefinition = {
  id: 'construction-finisher',
  label: 'Constructor de finisaje — șantier mic',
  summary:
    'Finisaje interioare pentru un dezvoltator și pentru apartamente private. 337.100 lei în 2026, o dubă, '
    + 'protocol plafonat și un alt PFA ca subcontractant — fără salariați.',
  teaches: [
    'art. 68 alin. (5) lit. g): cheltuiala de protocol se deduce în limita a 2 % din baza de la alin. (6) — aici plafonul taie',
    'art. 68 alin. (7) lit. k): utilizare exclusivă cu foaie de parcurs — 100 %, nu 50 %, ca la persona 3',
    'art. 68 alin. (5) lit. j): „cel mult un singur autoturism” arătat la limită — un singur vehicul, nimic de exclus',
    'art. 28 alin. (14): plafonul de 1.500 lei/lună este pentru M1; o dubă nu este M1 și nu pierde nimic',
    'Capacitatea fără salariați: a doua pereche de mâini este un alt PFA, cu factură proprie',
  ],
  identity: IDENTITY,
  caen: { principal: '4334', secondary: ['4332', '4333', '4335', '4331'] },
  counterparties: [
    { name: DEVELOPATOR.denumire, kind: DEVELOPATOR.kind, tara: DEVELOPATOR.tara, cadenta: DEVELOPATOR.cadenta },
    { name: ROSU.denumire, kind: ROSU.kind, tara: ROSU.tara, cadenta: ROSU.cadenta },
    { name: TOMA.denumire, kind: TOMA.kind, tara: TOMA.tara, cadenta: TOMA.cadenta },
    { name: PETRISOR.denumire, kind: PETRISOR.kind, tara: PETRISOR.tara, cadenta: PETRISOR.cadenta },
    { name: DEPOT.denumire, kind: DEPOT.kind, tara: DEPOT.tara, cadenta: DEPOT.cadenta },
    { name: SUBANTREPRENOR.denumire, kind: SUBANTREPRENOR.kind, tara: SUBANTREPRENOR.tara, cadenta: SUBANTREPRENOR.cadenta },
    { name: HALA.denumire, kind: HALA.kind, tara: HALA.tara, cadenta: HALA.cadenta },
    { name: PETROLINA.denumire, kind: PETROLINA.kind, tara: PETROLINA.tara, cadenta: PETROLINA.cadenta },
    { name: SERVICE.denumire, kind: SERVICE.kind, tara: SERVICE.tara, cadenta: SERVICE.cadenta },
  ],
  data: personaDataset(profile, {
    revenues: [
      ...invoices(SITUATII.map((v, i) => [i + 1, 27, v] as const), {
        party: DEVELOPATOR, prefix: 'CON', vat: false,
      }),
      ...invoices([[3, 12, 6500], [5, 20, 4800]] as const, { party: ROSU, prefix: 'RO', vat: false }),
      ...invoices([[6, 9, 7200], [7, 24, 5400]] as const, { party: TOMA, prefix: 'TO', vat: false }),
      ...invoices([[9, 15, 9000], [10, 21, 6200]] as const, { party: PETRISOR, prefix: 'PE', vat: false }),
    ],
    expenses: [
      // Materials and the subcontracted PFA. `business_space_upkeep` is the category the vocabulary
      // carries for a cost of this kind; the app has no "materials" category, and inventing one would be
      // a second vocabulary for the same fact (the B-70 defect class).
      ...costs(MATERIALE.map((v, i) => [i + 1, 8, v] as const), {
        party: DEPOT, prefix: 'MAT', vat: false, category: 'business_space_upkeep',
      }),
      ...costs(SUBANTREPRESA.map((v, i) => [i + 1, 5, v] as const), {
        party: SUBANTREPRENOR, prefix: 'SUB', vat: false, category: 'business_space_upkeep',
      }),
      ...costs(Array.from({ length: 12 }, (_, i) => [i + 1, 3, 2000] as const), {
        party: HALA, prefix: 'CHIR', vat: false, category: 'rent_business_space',
      }),
      ...costs(Array.from({ length: 12 }, (_, i) => [i + 1, 16, 700] as const), {
        party: PETROLINA, prefix: 'PET', vat: false, category: 'vehicle_related', vehicleId: 'p10-van',
        tip: () => 'bon-fiscal',
      }),
      ...costs([[4, 18, 1800], [9, 22, 1400]] as const, {
        party: SERVICE, prefix: 'REV', vat: false, category: 'vehicle_related', vehicleId: 'p10-van',
      }),
      // Protocol: meals and gifts for the developer's site team. The 2 % ceiling of art. 68 alin. (5)
      // lit. g) is measured on the art. 68 alin. (6) base, and on these figures it cuts.
      ...costs([[2, 14, 1500], [6, 25, 1800], [12, 18, 1600]] as const, {
        party: DEVELOPATOR, prefix: 'PROT', vat: false, category: 'protocol',
      }),
    ],
    clients: [DEVELOPATOR, ROSU, TOMA, PETRISOR, DEPOT, SUBANTREPRENOR, HALA, PETROLINA, SERVICE],
    vehicles: [
      {
        id: 'p10-van',
        label: 'Dubă (N1) — folosită exclusiv pe șantier, cu foaie de parcurs',
        plate: 'BN 00 DEM3',
        years: [
          {
            fiscalYear: PERSONA_FISCAL_YEAR,
            usedByPerson: 'da',
            // Declared, and evidenced: the *foaie de parcurs* exists, which is the fact art. 68 alin. (7)
            // lit. k) asks for. Persona 3's car is `mixed` and takes the 50 % default; this one does not.
            use: 'exclusive',
            designatedForRunningCosts: 'da',
          },
        ],
      },
    ],
    fixedAssets: [
      {
        id: 'p10-asset-van',
        label: 'Autoutilitară achiziționată în 2024',
        entryDate: '2024-02-12',
        putInFunctionDate: '2024-03-01',
        fiscalValue: lei(62000),
        normalLifeMonths: 60,
        method: 'liniar',
        acquisition: 'cumparare',
        paymentState: 'achitat',
        paidOn: '2024-02-15',
        // Not an M1 passenger car: the 1.500-lei/lună ceiling of art. 28 alin. (14) is stated for M1, so
        // the raw 1.033,33 lei/lună is charged in full.
        isM1Vehicle: false,
      },
    ],
  }),
};
