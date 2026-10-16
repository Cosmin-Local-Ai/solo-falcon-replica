/**
 * Persona 3 — **rideshare and courier driver** (CAEN 4933 principal; 4932, 5320, 4941, 7711 secondary).
 *
 * ## What this person is
 *
 * A driver who works through two platforms: a ride-hailing app (CAEN 4933 — *„transporturi terestre de
 * pasageri cu vehicule cu șofer, pe bază de comandă"*, which is the ride-hailing class, not 4932
 * „ocazionale") and a courier app (CAEN 5320). The counterparty is a **platform**, and a platform is its own
 * fiscal shape: it states a payout net of commission, it reports the person to ANAF, and the register shows
 * a payout rather than an invoice to a named client. There are no foreign clients here, because this
 * activity does not have any — the counterparties are domestic and everything is in lei (D-DEMO-4).
 *
 * ## The two vehicle rules, and why this persona carries **two** cars
 *
 * This is the persona that shows the vehicle rules actually biting rather than being present:
 *
 * - **art. 68 alin. (7) lit. k)** — the car the taxpayer drives is used for the activity but exclusive use
 *   is not evidenced (no *foaie de parcurs*), so the running costs are deductible at **50 %**. That is the
 *   statutory default, not an app guess (D-VEH-1), and on this persona it removes about half of the fuel,
 *   service and tyre costs from the base.
 * - **art. 68 alin. (5) lit. j)** — *„cel mult un singur autoturism aferent fiecărei persoane"*. The person
 *   has a second car they also drive. The law supplies **no selection criterion**, so the app asks and the
 *   person designates one (D-VEH-2); the other car's costs stay `review_required` with both readings shown.
 *   A persona with one car cannot show the limit at all — „cel mult unul" excludes nothing when there is
 *   only one — which is why this one has two.
 * - **art. 28 alin. (14)** — the car is a category M1 passenger vehicle, so its amortisation is capped at
 *   1.500 lei/lună. At 78.000 lei over a declared *durata normală* of 48 months the raw charge is 1.625
 *   lei/lună, so **the cap bites and 125 lei a month is lost definitively** — not carried, not recoverable.
 *
 * ## The car leaves the register on 20 Octombrie 2026 — and that puts two ceilings on one number
 *
 * A driver rotates cars, so the same M1 that shows the monthly cap is also the car this person sells. The
 * disposal is declared with the two facts the register needs: `disposedOn` and the **price actually
 * realised**, `disposalProceeds` (40.000 lei — a transaction price, not a figure derivable from the fiscal
 * value). Two provisions then bound the same unamortised residual:
 *
 * - **Titlul II norm pct. 27** — the residual is deductible „în limita a 1.500 lei înmulțit cu numărul de
 *   luni rămase de amortizat din durata normală de funcționare stabilită de contribuabil”. 37 months of the
 *   declared 48 were used by 20 Octombrie, so **11 luni rămase** and a ceiling of **16.500 lei**.
 * - **Titlul IV norm pct. 7 alin. (5) lit. o)** — the same residual is capped „la nivelul venitului realizat
 *   din înstrăinare”. The price is 40.000 lei, above the pct. 27 figure, so **the pct. 27 ceiling is the one
 *   that cuts** — and the app can only *say* that because the price is recorded. Without it the second limit
 *   cannot be measured at all, and the figure on screen is a ceiling and nothing more.
 *
 * The residual itself is 17.875 lei (78.000 − 37 × 1.625), so 1.375 lei of it is lost at the exit. **None of
 * this enters the estimate**: B-153 is still open, the schedule keeps amortising past the disposal month
 * while `disposalFigure` counts only the months actually used, and the two month-counts are both on the
 * card. The figure is reported, not posted.
 * - **art. 298** — the VAT status of the same car is a separate question with its own per-year facts
 *   (seats, MTMA, use, logbook), held in `vatYears` beside the income-tax facts and never merged with them.
 *
 * ## Thresholds it crosses
 *
 * CAS moves onto the **24-smn rung** (97.200 lei) once the 50 % vehicle cut and the capped amortisation are
 * taken out — the point being that the rung is reached *after* the caps, not before them. The CASS floor
 * (art. 174 alin. (6)) is long engaged. It stays inside the art. 310 scutire.
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
  nume: 'Codrea Sergiu-Vlad',
  cnp: '1850000354013',
  adresa: 'Str. Răsăritului 44, Brașov',
  telefon: '0733 902 114',
  email: 'sergiu@codreashofer.example',
  denumire: 'Codrea Sergiu-Vlad PFA',
  cui: 'RO48372610',
  formaJuridica: 'Persoană fizică autorizată',
  numarRegComert: 'J08/1177/2022',
  contBancar: 'RO44 CARP 0000 0000 0811 7702 9003',
  banca: 'Banca Carpatică',
};

const CORIO: PartySpec = {
  id: 'p3-corio',
  denumire: 'Corio Mobilitate SRL',
  cui: 'RO59483721',
  email: 'soferi@coriomobilitate.example',
  oras: 'București',
  tara: 'România',
  kind: 'platform_withholding',
  cadenta: 'statament săptămânal, virament marți; reține și raportează conform art. 151 alin. (5)-(11)',
};

const MESANGERUL: PartySpec = {
  id: 'p3-mesangerul',
  denumire: 'Mesangerul Express SRL',
  cui: 'RO12345670',
  email: 'parteneri@mesangerul.example',
  oras: 'Brașov',
  tara: 'România',
  kind: 'platform_withholding',
  cadenta: 'statament săptămânal, virament vineri',
};

const PETROLINA: PartySpec = {
  id: 'p3-petrolina',
  denumire: 'Petrolina SRL',
  cui: 'RO37261584',
  oras: 'Brașov',
  tara: 'România',
  kind: 'supplier_ro',
  cadenta: 'realimentare, la fiecare tură',
};

const MECANICA: PartySpec = {
  id: 'p3-mecanica',
  denumire: 'Mecanica Carpatina SRL',
  cui: 'RO23456781',
  email: 'service@mecanicacarpatina.example',
  oras: 'Brașov',
  tara: 'România',
  kind: 'supplier_ro',
  cadenta: 'revizii la 15.000 km',
};

const ANVELOPA: PartySpec = {
  id: 'p3-anvelopa',
  denumire: 'Anvelopa Carpatia SRL',
  cui: 'RO34567892',
  oras: 'Brașov',
  tara: 'România',
  kind: 'supplier_ro',
  cadenta: 'anvelope, două schimburi pe an',
};

/** Seasonality a driver actually has: summer and the autumn season above winter. */
const CORIO_PAYOUTS = [9000, 8600, 9500, 10500, 11500, 12500, 13500, 14000, 12000, 10500, 9500, 10500] as const;

const profile = personaProfile('persona-ride-hailing-driver', IDENTITY, [
  caenClass('4933'),
  caenClass('4932'),
  caenClass('5320'),
  caenClass('4941'),
  caenClass('7711'),
], {
  pfaStartYear: 2022,
  pfaStartDate: '2022-05-16',
  activityFamily: 'other',
  vatRegistration: { status: 'scutit_art310' },
});

export const rideHailingDriverPersona: PersonaDefinition = {
  id: 'ride-hailing-driver',
  label: 'Șofer de transport persoane și curierat',
  summary:
    'Șofer pe două platforme: transport de persoane (CAEN 4933) și curierat. 168.000 lei în 2026, două '
    + 'autoturisme, amortizare plafonată, cheltuieli auto la 50 % și un autoturism scos din gestiune în '
    + 'octombrie, cu cele două plafoane ale scăderii din gestiune.',
  teaches: [
    'Platforma ca plătitor de venit: statament, reținere și raportare — nu client corporate cu factură',
    'art. 68 alin. (7) lit. k): cheltuielile auto se deduc 50 % când utilizarea exclusivă nu este justificată',
    'art. 68 alin. (5) lit. j): „cel mult un singur autoturism” — a doua mașină rămâne de verificat',
    'art. 28 alin. (14): plafonul de 1.500 lei/lună la un autoturism M1, cu pierderea definitivă a excesului',
    'art. 298: starea TVA a aceluiași autoturism, ținută separat de faptele de la art. 68',
    'pct. 27 și pct. 7 alin. (5) lit. o): două plafoane peste aceeași valoare neamortizată; al doilea se poate măsura doar dacă prețul înstrăinării este înregistrat',
  ],
  identity: IDENTITY,
  caen: { principal: '4933', secondary: ['4932', '5320', '4941', '7711'] },
  counterparties: [
    { name: CORIO.denumire, kind: CORIO.kind, tara: CORIO.tara, cadenta: CORIO.cadenta },
    { name: MESANGERUL.denumire, kind: MESANGERUL.kind, tara: MESANGERUL.tara, cadenta: MESANGERUL.cadenta },
    { name: PETROLINA.denumire, kind: PETROLINA.kind, tara: PETROLINA.tara, cadenta: PETROLINA.cadenta },
    { name: MECANICA.denumire, kind: MECANICA.kind, tara: MECANICA.tara, cadenta: MECANICA.cadenta },
    { name: ANVELOPA.denumire, kind: ANVELOPA.kind, tara: ANVELOPA.tara, cadenta: ANVELOPA.cadenta },
  ],
  data: personaDataset(profile, {
    revenues: [
      ...invoices(CORIO_PAYOUTS.map((v, i) => [i + 1, 6, v] as const), {
        party: CORIO, prefix: 'COR', vat: false,
      }),
      ...invoices(Array.from({ length: 12 }, (_, i) => [i + 1, 2, 3000] as const), {
        party: MESANGERUL, prefix: 'MES', vat: false,
      }),
    ],
    expenses: [
      ...costs(Array.from({ length: 12 }, (_, i) => [i + 1, 12, 2200] as const), {
        party: PETROLINA, prefix: 'PET', vat: false, category: 'vehicle_related', vehicleId: 'p3-car-a',
        tip: (i) => (i % 2 === 0 ? 'bon-fiscal' : 'factura'),
      }),
      ...costs([[2, 21, 1600], [5, 19, 1600], [8, 25, 1600], [10, 14, 1600]] as const, {
        party: MECANICA, prefix: 'MEC', vat: false, category: 'vehicle_related', vehicleId: 'p3-car-a',
      }),
      ...costs([[3, 9, 1400], [10, 18, 1400]] as const, {
        party: ANVELOPA, prefix: 'ANE', vat: false, category: 'vehicle_related', vehicleId: 'p3-car-a',
      }),
      // The second car's fuel. The person designated car A for the running costs, so these rows are not
      // silently dropped and not silently deducted either — they come back `review_required`.
      ...costs(Array.from({ length: 12 }, (_, i) => [i + 1, 20, 600] as const), {
        party: PETROLINA, prefix: 'PETB', vat: false, category: 'vehicle_related', vehicleId: 'p3-car-b',
        tip: () => 'bon-fiscal',
      }),
    ],
    clients: [CORIO, MESANGERUL, PETROLINA, MECANICA, ANVELOPA],
    vehicles: [
      {
        id: 'p3-car-a',
        label: 'Autoturismul pe care lucrează (M1, 5 locuri)',
        plate: 'BV 00 DEM',
        years: [
          {
            fiscalYear: PERSONA_FISCAL_YEAR,
            usedByPerson: 'da',
            // Declared: mixed use, no logbook. The 50 % default is the law's answer to exactly this case.
            use: 'mixed',
            designatedForRunningCosts: 'da',
          },
        ],
        vatYears: [
          {
            fiscalYear: PERSONA_FISCAL_YEAR,
            use: 'mixed',
            seats: 5,
            massMaxKg: 1320,
            logbook: 'nu',
          },
        ],
      },
      {
        id: 'p3-car-b',
        label: 'A doua mașină a familiei, folosită și ea de contribuabil',
        plate: 'BV 00 DEM2',
        years: [
          {
            fiscalYear: PERSONA_FISCAL_YEAR,
            usedByPerson: 'da',
            use: 'mixed',
            // The person's own answer to the question the law does not answer (D-VEH-2).
            designatedForRunningCosts: 'nu',
          },
        ],
      },
    ],
    fixedAssets: [
      {
        id: 'p3-asset-car-a',
        label: 'Autoturism M1 achiziționat în 2023',
        entryDate: '2023-09-10',
        putInFunctionDate: '2023-10-01',
        fiscalValue: lei(78000),
        normalLifeMonths: 48,
        method: 'liniar',
        acquisition: 'cumparare',
        paymentState: 'achitat',
        paidOn: '2023-09-15',
        isM1Vehicle: true,
        // Brief 77 — the car is sold. The date is inside the recorded period and after the last fuel,
        // service and tyre row for this car (12, 14 and 18 Octombrie), so the register does not claim fuel
        // for a car the person no longer holds.
        disposedOn: '2026-10-20',
        disposalKind: 'vanzare',
        // The transaction price, declared. Nothing in the register derives it: it is not the fiscal value,
        // not the residual and not a residual ratio, and Titlul IV pct. 7 alin. (5) lit. o) measures the
        // second ceiling against exactly this number.
        disposalProceeds: lei(40000),
      },
    ],
  }),
};
