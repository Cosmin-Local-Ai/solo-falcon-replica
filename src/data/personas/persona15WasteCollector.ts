/**
 * Persona 15 — **non-hazardous waste collection and material recovery** (CAEN 3811 principal; 3821
 * secondary).
 *
 * ## Why this persona exists — B-131, and why it is not the whole of E
 *
 * Secțiunea **E** is the other secțiune the brief refused to let me write off as „regulated utilities". It
 * is half utility and half small service work, and the verdict is **partial**:
 *
 * - **Modelled:** 3811 (colectarea deșeurilor nepericuloase) and 3821 (recuperarea materialelor reciclabile)
 *   — the two clase a one-truck salubrizare operation declares. This is a real Romanian PFA: a contract
 *   with a town hall, a market, household voluminous waste, and a sale of the sorted material to a recycler.
 * - **Deliberately not modelled:** 3600 (captarea, tratarea și distribuția apei) and 3700 (colectarea și
 *   epurarea apelor uzate) — the water utility, which is a licensed system, not an activity; 3812 (deșeuri
 *   periculoase), 3822 (producerea de energie din deșeuri), 3831 (incinerare), 3832 (gropi de gunoi și
 *   depozite permanente), 3833, 3900 (decontaminare). Those carry an environmental authorisation regime of
 *   their own. **Product-scope judgement, not a verified citation** — see the B-131 register row.
 *
 * ## What this person is
 *
 * One truck, one yard, one person at the wheel. The public authority is a **client**, which is the point: a
 * PFA can hold a salubrizare contract with a town without being a public authority — which is exactly why
 * secțiunea P gets no persona while a public counterparty appears here. The vocabulary has no
 * public-authority party kind, so the town is carried as `client_corporate_ro` and the register says what it
 * is in its own words; inventing a sixth kind for one persona would be a schema change, and chain steps are
 * out of scope for B-131.
 *
 * ## The vehicle rule, from the third side
 *
 * Persona 3 shows the 50 % default; persona 10 shows the evidence route to 100 %. This one shows the
 * **statutory exception category**: `exceptionCategory: 'marfuri_in_scop_comercial'`, the transport of goods
 * for a commercial purpose, which takes the truck out of the 50 % default on its own. The effect is a number,
 * not a label: 22.000 lei of fuel by 31 October enters the base whole, where the mixed-use default would have
 * admitted 11.000 lei. The one-car limit of art. 68 alin. (5) lit. j) again excludes nothing — one vehicle,
 * `sole_candidate`.
 *
 * **art. 28 alin. (14) is shown at the same boundary from the other side.** The truck is charged at 2.000
 * lei/lună of depreciation — **above** the 1.500-lei/lună ceiling — and nothing is lost, because that ceiling
 * is stated for category **M1** passenger cars and a collection truck is not one. Persona 3's car loses 125
 * lei a month to the same ceiling; this truck loses nothing, and the pair is what makes the ceiling's scope
 * legible.
 *
 * ## Thresholds it crosses
 *
 * **CAS 24-smn rung (97.200 lei)** engaged, and the **art. 68 alin. (7) lit. k) exception** applied instead of
 * the 50 % cut — a measurable 11.000 lei of difference. The depreciation ceiling is reached and deliberately
 * not applied, because the asset is not M1. The TVA plafon is not crossed: 304.500 lei of collections is a
 * real year for one truck and it stays inside the art. 310 scutire.
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
  nume: 'Țiplea Vasile',
  cnp: '1550000398024',
  adresa: 'Str. Depozitelor 3, Suceava',
  telefon: '0743 209 615',
  email: 'vasile@tiipleadeseuri.example',
  denumire: 'Țiplea Vasile PFA',
  cui: 'RO37384950',
  formaJuridica: 'Persoană fizică autorizată',
  numarRegComert: 'J30/0884/2021',
  contBancar: 'RO44 CARP 0000 0000 3008 8406 9016',
  banca: 'Banca Carpatică',
};

const PRIMARIA: PartySpec = {
  id: 'p15-primaria',
  denumire: 'Primăria Orașului Valea Carpaților',
  cui: 'RO58596072',
  oras: 'Valea Carpaților',
  tara: 'România',
  kind: 'client_corporate_ro',
  cadenta: 'contract de salubrizare, factură lunară, plată la 45 zile — autoritate publică, nu societate',
};

const PIATA: PartySpec = {
  id: 'p15-piata',
  denumire: 'Piața Centrală SRL',
  cui: 'RO69607183',
  email: 'administratie@piatacentrala.example',
  oras: 'Suceava',
  tara: 'România',
  kind: 'client_corporate_ro',
  cadenta: 'ridicare zilnică în piață, factură lunară, plată la 15 zile',
};

const MENAJ: PartySpec = {
  id: 'p15-menaj',
  denumire: 'Clienți — deșeuri menajere și voluminoase',
  cui: 'RO00000000',
  oras: 'Suceava',
  tara: 'România',
  kind: 'client_person_ro',
  cadenta: 'abonament lunar și ridicări ocazionale la cerere',
};

const RECICLATOR: PartySpec = {
  id: 'p15-reciclator',
  denumire: 'Reciclaj Transilvania SRL',
  cui: 'RO70718294',
  email: 'preluare@reciciajtransilvania.example',
  oras: 'Suceava',
  tara: 'România',
  kind: 'client_corporate_ro',
  cadenta: 'vânzare material sortat (hârtie, plastic, metal), preluare bilunară, plată la 30 zile',
};

const GROAPA: PartySpec = {
  id: 'p15-groapa',
  denumire: 'Ecologicar Carpați SA',
  cui: 'RO81829305',
  email: 'operatiuni@ecologicar.example',
  oras: 'Suceava',
  tara: 'România',
  kind: 'supplier_ro',
  cadenta: 'taxare la punctul de lucru pentru fracțiunea care nu se recuperează, factură lunară',
};

const TEREN: PartySpec = {
  id: 'p15-teren',
  denumire: 'Terenul Industrial SRL',
  cui: 'RO92930417',
  oras: 'Suceava',
  tara: 'România',
  kind: 'supplier_ro',
  cadenta: 'chirie lunară pentru șantierul de sortare',
};

const PETROLINA: PartySpec = {
  id: 'p15-petrolina',
  denumire: 'Petrolina SRL',
  cui: 'RO37261584',
  oras: 'Suceava',
  tara: 'România',
  kind: 'supplier_ro',
  cadenta: 'realimentare camion, la fiecare tură',
};

const SERVICE: PartySpec = {
  id: 'p15-service',
  denumire: 'Mecanica Carpatina SRL',
  cui: 'RO23456781',
  email: 'service@mecanicacarpatina.example',
  oras: 'Suceava',
  tara: 'România',
  kind: 'supplier_ro',
  cadenta: 'revizii și reparații camion, la nevoie',
};

/** A salubrizare year: the market and the town are steady, households peak in spring and at the move season. */
const MENAJ_LUNAR = [3000, 2800, 3200, 3500, 3800, 4000, 3500, 3000, 4200, 4500, 4000, 3500] as const;
const MATERIAL_SORTAT = [4000, 3500, 4500, 5000, 5500, 6000, 5500, 5000, 6500, 7000, 6000, 5500] as const;

const profile = personaProfile('persona-waste-collector', IDENTITY, [
  caenClass('3811'),
  caenClass('3821'),
], {
  pfaStartYear: 2021,
  pfaStartDate: '2021-01-18',
  activityFamily: 'other',
  vatRegistration: { status: 'scutit_art310' },
});

export const wasteCollectorPersona: PersonaDefinition = {
  id: 'waste-collector',
  label: 'Colectare deșeuri și recuperare materiale',
  summary:
    'Un camion, un depozit de sortare: contract de salubrizare cu o primărie, piață, gospodării și vânzarea '
    + 'materialului sortat. 304.500 lei în 2026.',
  teaches: [
    'Secțiunea E modelată prin serviciile de colectare și recuperare (3811, 3821); apa, canalul, deșeurile periculoase, incinerarea și gropile de gunoi rămân în afara setului',
    'O autoritate publică poate fi CLIENT, fără ca PFA-ul să fie autoritate publică — de aceea secțiunea P nu are persona iar contractul apare aici',
    'art. 68 alin. (7) lit. k): categoriile de excepție — transport de marfă în scop comercial — scot vehiculul de la 50 %',
    'art. 28 alin. (14): plafonul de 1.500 lei/lună este pentru M1; un camion N nu are plafonul',
    'Vânzarea materialului sortat este venit din activitate, nu o compensație: apare în registru cu client și CUI',
  ],
  identity: IDENTITY,
  caen: { principal: '3811', secondary: ['3821'] },
  counterparties: [
    { name: PRIMARIA.denumire, kind: PRIMARIA.kind, tara: PRIMARIA.tara, cadenta: PRIMARIA.cadenta },
    { name: PIATA.denumire, kind: PIATA.kind, tara: PIATA.tara, cadenta: PIATA.cadenta },
    { name: MENAJ.denumire, kind: MENAJ.kind, tara: MENAJ.tara, cadenta: MENAJ.cadenta },
    { name: RECICLATOR.denumire, kind: RECICLATOR.kind, tara: RECICLATOR.tara, cadenta: RECICLATOR.cadenta },
    { name: GROAPA.denumire, kind: GROAPA.kind, tara: GROAPA.tara, cadenta: GROAPA.cadenta },
    { name: TEREN.denumire, kind: TEREN.kind, tara: TEREN.tara, cadenta: TEREN.cadenta },
    { name: PETROLINA.denumire, kind: PETROLINA.kind, tara: PETROLINA.tara, cadenta: PETROLINA.cadenta },
    { name: SERVICE.denumire, kind: SERVICE.kind, tara: SERVICE.tara, cadenta: SERVICE.cadenta },
  ],
  data: personaDataset(profile, {
    revenues: [
      ...invoices(Array.from({ length: 12 }, (_, i) => [i + 1, 28, 13000] as const), { party: PRIMARIA, prefix: 'PRM', vat: false }),
      ...invoices(Array.from({ length: 12 }, (_, i) => [i + 1, 4, 3500] as const), { party: PIATA, prefix: 'PIC', vat: false }),
      ...invoices(MENAJ_LUNAR.map((v, i) => [i + 1, 10, v] as const), { party: MENAJ, prefix: 'MEN', vat: false }),
      ...invoices(MATERIAL_SORTAT.map((v, i) => [i + 1, 24, v] as const), { party: RECICLATOR, prefix: 'RCL', vat: false }),
    ],
    expenses: [
      ...costs(Array.from({ length: 12 }, (_, i) => [i + 1, 15, 2200] as const), {
        party: PETROLINA, prefix: 'PET', vat: false, category: 'vehicle_related', vehicleId: 'p15-truck',
        tip: () => 'bon-fiscal',
      }),
      ...costs([[3, 14, 2400], [8, 19, 2100]] as const, {
        party: SERVICE, prefix: 'REV', vat: false, category: 'vehicle_related', vehicleId: 'p15-truck',
      }),
      ...costs(Array.from({ length: 12 }, (_, i) => [i + 1, 26, 3000] as const), {
        party: GROAPA, prefix: 'TAX', vat: false, category: 'business_space_upkeep',
      }),
      ...costs(Array.from({ length: 12 }, (_, i) => [i + 1, 3, 1500] as const), {
        party: TEREN, prefix: 'CHIR', vat: false, category: 'rent_business_space',
      }),
    ],
    clients: [PRIMARIA, PIATA, MENAJ, RECICLATOR, GROAPA, TEREN, PETROLINA, SERVICE],
    vehicles: [
      {
        id: 'p15-truck',
        label: 'Camion de colectare (N) — marfă în scop comercial',
        plate: 'SV 00 DEM5',
        years: [
          {
            fiscalYear: PERSONA_FISCAL_YEAR,
            usedByPerson: 'da',
            // Mixed use, but the exception category of art. 68 alin. (7) lit. k) is declared, and the
            // resolver treats a declared exception exactly as it treats evidenced exclusive use.
            use: 'mixed',
            exceptionCategory: 'marfuri_in_scop_comercial',
            designatedForRunningCosts: 'da',
          },
        ],
      },
    ],
    fixedAssets: [
      {
        id: 'p15-asset-truck',
        label: 'Camion de colectare achiziționat în 2022',
        entryDate: '2022-06-14',
        putInFunctionDate: '2022-07-01',
        fiscalValue: lei(168000),
        normalLifeMonths: 84,
        method: 'liniar',
        acquisition: 'cumparare',
        paymentState: 'achitat',
        paidOn: '2022-06-20',
        // 168.000 lei over 84 months is 2.000 lei a month — above the 1.500-lei/lună ceiling of art. 28 alin.
        // (14). That ceiling is stated for M1 passenger cars, and a collection truck is not one, so the whole
        // 2.000 lei a month is charged. Persona 3's M1 car is the pair that shows the ceiling cutting.
        isM1Vehicle: false,
      },
    ],
  }),
};
