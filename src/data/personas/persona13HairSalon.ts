/**
 * Persona 13 — **hair and beauty salon** (CAEN 9621 principal; 9622 secondary).
 *
 * ## Why this persona exists — B-131
 *
 * Secțiunea **T (alte activități de servicii)** had no persona. It is a mixed secțiune and the verdict is
 * **partial**:
 *
 * - **Modelled:** 9621 (coafură și frizerie) and 9622 (tratament și înfrumusețare) — the personal-service
 *   clase a PFA salon actually declares.
 * - **Deliberately not modelled:** 9411 / 9412 / 9420 / 9491 / 9492 / 9499 (organizații economice,
 *   profesionale, sindicate, religioase, politice, alte organizații). Those are members' organisations: a
 *   PFA is not one, and a demo persona that looked like a trade association would be a category error in
 *   the opposite direction from the rest of this file.
 * - **Not modelled, but not excluded either:** 9510 / 9521-9529 / 9531 / 9532 (reparații) and 9610
 *   (spălătorie), 9623 (spa), 9630 (pompe funebre), 9691 (servicii personale la domiciliu). Each is a
 *   plausible PFA activity; none is this person's activity. They route through the secțiune and the register
 *   says plainly that this persona does not describe them.
 *
 * ## What this person is
 *
 * A two-chair salon: walk-in clients billed at the counter, plus an event season (nunți și botezuri) from
 * April to October. No vehicle, no foreign counterparty — a neighbourhood salon has neither, and D-DEMO-4
 * forbids padding it with one.
 *
 * ## The date gate this persona carries, and a cap that does cut
 *
 * **art. 68 alin. (5) lit. g^2) — contribuții la PEPP, plafon în euro**, introduced by OUG 8/2026 and
 * applicable to contributions **paid from 1 martie 2026**. The register therefore contains one January
 * contribution and a run of them from March. The two identical 200-lei rows come out **different**, which is
 * the whole point of the date gate: the January row is `undetermined` — no rule in force in January covers
 * the category, and art. 68 alin. (7) lit. l) is an open clause, so an uncited category is never treated as
 * deductible — while the March rows are classified under the PEPP rule and then held out of the base as
 * `cap_unresolved`, because the 400-euro ceiling cannot be converted (pct. 7 alin. (6)'s annual BNR average
 * against CF art. 9 alin. (3) lit. b)'s rate at the payment date). Neither row is quietly dropped.
 *
 * **art. 68 alin. (5) lit. g) — protocol, plafon 2 % din baza art. 68 alin. (6)** is the cap this profile
 * *can* strike, because it is a percentage of a lei figure: 4.000 lei of client refreshments and a bridal-fair
 * stand, against a ceiling of 2.290 lei. The 1.710 lei over it are not deductible, and the app says which
 * base it measured the percentage on.
 *
 * ## Thresholds it crosses
 *
 * **CAS 24-smn rung (97.200 lei)** engaged, and the **protocol ceiling cuts**. The PEPP ceiling is reached in
 * money terms and reported as un-striking, for the conversion reason above. TVA stays inside the art. 310
 * scutire.
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
  nume: 'Cojocaru Alina-Elena',
  cnp: '2840000398026',
  adresa: 'Bd. Tomis 14, Constanța',
  telefon: '0746 815 227',
  email: 'alina@saloncojocaru.example',
  denumire: 'Cojocaru Alina-Elena PFA',
  cui: 'RO15162738',
  formaJuridica: 'Persoană fizică autorizată',
  numarRegComert: 'J13/3312/2018',
  contBancar: 'RO44 CARP 0000 0000 1331 2045 9014',
  banca: 'Banca Carpatică',
};

const CLIENTI: PartySpec = {
  id: 'p13-clienti',
  denumire: 'Clienți salon — servicii la loc',
  cui: 'RO00000000',
  oras: 'Constanța',
  tara: 'România',
  kind: 'client_person_ro',
  cadenta: 'plată la casă, la fiecare programare',
};

const EVENIMENTE: PartySpec = {
  id: 'p13-evenimente',
  denumire: 'Clienți evenimente — nunți și botezuri',
  cui: 'RO00000000',
  oras: 'Constanța',
  tara: 'România',
  kind: 'client_person_ro',
  cadenta: 'avans la rezervare, restul în ziua evenimentului',
};

const SALON: PartySpec = {
  id: 'p13-salon',
  denumire: 'Imobiliara Tomis SRL',
  cui: 'RO37384950',
  email: 'inchirieri@imobiliaratomis.example',
  oras: 'Constanța',
  tara: 'România',
  kind: 'supplier_ro',
  cadenta: 'chirie lunară pentru spațul din parter',
};

const COSMETICE: PartySpec = {
  id: 'p13-cosmetice',
  denumire: 'Cosmetica Carpatică SRL',
  cui: 'RO48495063',
  email: 'comenzi@cosmeticacarpatica.example',
  oras: 'Constanța',
  tara: 'România',
  kind: 'supplier_ro',
  cadenta: 'vopsea și cosmetice, comandă lunară, plată la 15 zile',
};

const UTILITATI: PartySpec = {
  id: 'p13-utilitati',
  denumire: 'Cittatea Utilități SRL',
  cui: 'RO70718293',
  oras: 'Constanța',
  tara: 'România',
  kind: 'supplier_ro',
  cadenta: 'energie și apă pentru salon, factură lunară',
};

const IICP: PartySpec = {
  id: 'p13-iicp',
  denumire: 'Indexul de Pensii Private Carpatic SAI',
  cui: 'RO59506173',
  email: 'clienti@indexpensii.example',
  oras: 'București',
  tara: 'România',
  kind: 'supplier_ro',
  cadenta: 'contribuție la Pilonul III, debit direct lunar din martie 2026',
};

/** A salon's real season: summer events and the December peak above the winter lull. */
const SERVICII_LA_LOC = [15000, 14000, 15500, 16000, 16500, 17000, 15000, 13000, 17000, 18000, 19000, 21000] as const;

const profile = personaProfile('persona-hair-salon', IDENTITY, [
  caenClass('9621'),
  caenClass('9622'),
], {
  pfaStartYear: 2018,
  pfaStartDate: '2018-06-04',
  activityFamily: 'other',
  vatRegistration: { status: 'scutit_art310' },
});

export const hairSalonPersona: PersonaDefinition = {
  id: 'hair-salon',
  label: 'Salon de coafură și înfrumusețare',
  summary:
    'Două locuri în salon și o stagiune de evenimente. 217.500 lei în 2026, cu contribuții PEPP înainte și '
    + 'după 1 martie și cu plafonul de 400 EUR tăind.',
  teaches: [
    'Secțiunea T modelată prin serviciile personale (9621, 9622); organizațiile patronale, profesionale, sindicale și religioase rămân în afara setului',
    'art. 68 alin. (5) lit. g^2) (OUG 8/2026): contribuțiile la PEPP se iau în calcul doar din 1 martie 2026 — rândul din ianuarie rămâne `undetermined` (nicio regulă în vigoare nu acoperă categoria), cele din martie sunt clasificate dar plafonul în euro nu poate fi lovit',
    'art. 68 alin. (5) lit. g): plafonul de protocol, 2 % din baza art. 68 alin. (6) — aici taie, pentru că este o procent dintr-o sumă în lei',
    'Casă de marcat la loc: venit de la persoane fizice, în lei, fără nicio contraparte străină',
    'CAS pe treapta de 24 de salarii minime, după cheltuieli',
  ],
  identity: IDENTITY,
  caen: { principal: '9621', secondary: ['9622'] },
  counterparties: [
    { name: CLIENTI.denumire, kind: CLIENTI.kind, tara: CLIENTI.tara, cadenta: CLIENTI.cadenta },
    { name: EVENIMENTE.denumire, kind: EVENIMENTE.kind, tara: EVENIMENTE.tara, cadenta: EVENIMENTE.cadenta },
    { name: SALON.denumire, kind: SALON.kind, tara: SALON.tara, cadenta: SALON.cadenta },
    { name: COSMETICE.denumire, kind: COSMETICE.kind, tara: COSMETICE.tara, cadenta: COSMETICE.cadenta },
    { name: UTILITATI.denumire, kind: UTILITATI.kind, tara: UTILITATI.tara, cadenta: UTILITATI.cadenta },
    { name: IICP.denumire, kind: IICP.kind, tara: IICP.tara, cadenta: IICP.cadenta },
  ],
  data: personaDataset(profile, {
    revenues: [
      ...invoices(SERVICII_LA_LOC.map((v, i) => [i + 1, 20, v] as const), { party: CLIENTI, prefix: 'SAL', vat: false }),
      ...invoices(
        [[4, 13, 2500], [5, 25, 3000], [6, 15, 3500], [7, 9, 4000], [9, 21, 4500], [10, 19, 3000]] as const,
        { party: EVENIMENTE, prefix: 'EV', vat: false },
      ),
    ],
    expenses: [
      ...costs(Array.from({ length: 12 }, (_, i) => [i + 1, 1, 4000] as const), {
        party: SALON, prefix: 'CHIR', vat: false, category: 'rent_business_space',
      }),
      ...costs(Array.from({ length: 12 }, (_, i) => [i + 1, 11, 1400] as const), {
        party: COSMETICE, prefix: 'COS', vat: false, category: 'business_space_upkeep',
      }),
      ...costs(Array.from({ length: 12 }, (_, i) => [i + 1, 17, 900] as const), {
        party: UTILITATI, prefix: 'UTL', vat: false, category: 'energy_and_water',
      }),
      // The date gate: a January contribution, then the run the rule actually covers from 1 March.
      ...costs([[1, 20, 200]] as const, {
        party: IICP, prefix: 'PEPP-I', vat: false, category: 'pepp_contribution',
      }),
      ...costs(Array.from({ length: 10 }, (_, i) => [i + 3, 20, 200] as const), {
        party: IICP, prefix: 'PEPP', vat: false, category: 'pepp_contribution',
      }),
      // Protocol the salon really has: coffee and pastries at the counter, a stand at the spring bridal
      // fair, an autumn reception for the regular clients. This is the cap the app CAN strike — a percentage
      // of a lei base, not a euro ceiling.
      ...costs([[4, 22, 1200], [7, 12, 900], [10, 26, 1900]] as const, {
        party: CLIENTI, prefix: 'PROT', vat: false, category: 'protocol',
      }),
    ],
    clients: [CLIENTI, EVENIMENTE, SALON, COSMETICE, UTILITATI, IICP],
    fixedAssets: [
      {
        id: 'p13-asset-salon',
        label: 'Dotări salon: chiuvete, frizerie, mobilare',
        entryDate: '2023-08-21',
        putInFunctionDate: '2023-09-01',
        fiscalValue: lei(38000),
        normalLifeMonths: 60,
        method: 'liniar',
        acquisition: 'cumparare',
        paymentState: 'achitat',
        paidOn: '2023-08-25',
        isM1Vehicle: false,
      },
    ],
  }),
};
