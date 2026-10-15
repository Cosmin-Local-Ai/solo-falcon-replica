/**
 * Persona 8 — **online commerce** (CAEN 4791 principal; 4792, 5210, 5320, 6310 secondary).
 *
 * ## What this person is
 *
 * An online retailer: goods bought from a non-EU supplier and from a Romanian wholesaler, stored (5210),
 * sold through a marketplace and through their own shop (6310), delivered by courier (5320). The largest
 * persona in the set by turnover — **650.000 lei planned for the year** — because commerce is where the
 * platform's VAT machinery has the most to say.
 *
 * `4791` is *„Intermedieri în comerțul cu amănuntul nespecializat"*, not „comerț cu amănuntul". That is the
 * class ONRC uses for online commerce and it is what the verified nomenclator contains; the code I first
 * wrote for this persona carried the wrong meaning, which is exactly the failure brief 64's CAEN warning
 * was about.
 *
 * ## The trap this persona exists to show: cash income is not VAT deliveries
 *
 * Titlul IV is **cash basis** — art. 68 alin. (2) lit. a) measures „sumele încasate", and alin. (4) lit. b)
 * assigns a cost to the year it was **paid** (`research/51`). Titlul II measures *livrări efectuate*. So a
 * delivery invoiced but not yet collected is a VAT event and not an income event, and the two series
 * diverge by exactly the stock movement.
 *
 * Before `research/51` this persona looked like it needed a stock model. **It does not.** What it needs is
 * what it has: three invoices issued and delivered but still uncollected (`status: 'in-asteptare'`, no
 * `collected` date), which the income measure excludes and the delivery measure includes. The divergence is
 * then a visible gap between two series rather than an assertion in a document.
 *
 * ## Goods costs, and perisabilități
 *
 * Goods costs are cash-basis purchases — no stock account, no capitalisation, nothing to reconcile. The
 * shortage rows are recorded under the category the vocabulary actually has
 * (`inventory_shortage_uncovered`), which the classifier treats as expressly non-deductible; art. 68 alin.
 * (5) lit. d) perisabilități *within* the norms are a different thing, and the persona shows the category
 * that exists rather than inventing one that would make the deduction look settled.
 *
 * ## Thresholds it crosses
 *
 * The **395.000-lei TVA plafon**, crossed in August, with the exceedance date, the effective date and the
 * registration route declared so the fiscal period is derived rather than assumed (B-96, B-100). CAS moves
 * onto the 24-smn rung and the CASS 72-smn cap is approached but not crossed — deliberately, so the set
 * contains a commerce profile whose CASS is still computed on its own net.
 */
import { lei } from '../../domain/money';
import type { PersonaDefinition } from './personaTypes';
import {
  caenClass,
  costs,
  fixtureRate,
  fixtureRates,
  invoices,
  personaDataset,
  personaProfile,
  type PartySpec,
} from './personaKit';

const IDENTITY = {
  nume: 'Zabava Andreea-Ioana',
  cnp: '2930000354007',
  adresa: 'Str. Prundului 3, Timișoara',
  telefon: '0739 448 120',
  email: 'andreea@zabavashop.example',
  denumire: 'Zabava Andreea-Ioana PFA',
  cui: 'RO56789014',
  formaJuridica: 'Persoană fizică autorizată',
  numarRegComert: 'J35/2288/2020',
  contBancar: 'RO44 CARP 0000 0000 3522 8803 9008',
  banca: 'Banca Carpatică',
};

const TARGUL: PartySpec = {
  id: 'p8-targul',
  denumire: 'Târgul Online SA',
  cui: 'RO67890125',
  email: 'vanzatori@targulonline.example',
  oras: 'București',
  tara: 'România',
  kind: 'platform_intermediary',
  cadenta: 'încasări de la clienți reținute de platformă, virament săptămânal, comision reținut',
};

const MAGAZIN: PartySpec = {
  id: 'p8-magazin',
  denumire: 'Clienți magazin propriu',
  cui: 'RO00000000',
  oras: '—',
  tara: 'România',
  kind: 'client_person_ro',
  cadenta: 'plată cu cardul la comandă, încasare imediată',
};

const YUANHUA: PartySpec = {
  id: 'p8-yuanhua',
  denumire: 'Yuanhua Trading Co., Ltd',
  cui: 'CNI-DEMO-0001',
  email: 'export@yuanhuatrading.example',
  oras: 'Shenzhen',
  tara: 'China (în afara UE)',
  kind: 'supplier_foreign',
  cadenta: 'comenzi trimestriale, plată la confirmarea transportului maritim',
};

const WHOLESALE: PartySpec = {
  id: 'p8-wholesale',
  denumire: 'En gross Carpatic SRL',
  cui: 'RO78901237',
  email: 'comenzi@engrosscarpatic.example',
  oras: 'Timișoara',
  tara: 'România',
  kind: 'supplier_ro',
  cadenta: 'aprovizionare lunară, plată la 15 zile',
};

const DEPOZIT: PartySpec = {
  id: 'p8-depozit',
  denumire: 'Depozitaul Carpatic SRL',
  cui: 'RO89012347',
  email: 'logistica@depozitcarpatic.example',
  oras: 'Timișoara',
  tara: 'România',
  kind: 'supplier_ro',
  cadenta: 'depozitare și picking, factură lunară',
};

const CURIERAT: PartySpec = {
  id: 'p8-curierat',
  denumire: 'Mesangerul Express SRL',
  cui: 'RO12345670',
  email: 'conturi@mesangerul.example',
  oras: 'Timișoara',
  tara: 'România',
  kind: 'supplier_ro',
  cadenta: 'colete livrate, factură lunară',
};

const EUR_RATE_2026 = '5.0000';
const EUR_RATE_CAP_ANCHOR = '4.5000';

/** Sales through the marketplace, with the autumn peak a retailer actually has. */
const MARKETPLACE_SALES = [30000, 32000, 38000, 42000, 48000, 55000, 60000, 62000, 58000, 50000, 45000, 52000] as const;
/** Direct card sales through the own shop. */
const DIRECT_SALES = Array.from({ length: 12 }, () => 8000) as number[];
/** Goods purchased from the non-EU supplier, in euro. */
const IMPORT_PURCHASES = [5000, 5500, 6000, 6500, 7000, 8000, 8500, 9000, 8000, 7000, 6500, 7000] as const;

/**
 * The plafon is crossed by the marketplace transfer of 26 August. Registration produces effects from
 * 1 September, and the invoices from September onwards carry TVA.
 */
const EXCEEDANCE_DATE = '2026-08-26';
const REGISTRATION_EFFECTIVE_FROM = '2026-09-01';

const profile = personaProfile('persona-online-commerce', IDENTITY, [
  caenClass('4791'),
  caenClass('4792'),
  caenClass('5210'),
  caenClass('5320'),
  caenClass('6310'),
], {
  pfaStartYear: 2020,
  pfaStartDate: '2020-04-27',
  activityFamily: 'other',
  vatRegistration: { status: 'plafon_depasit', effectiveFrom: REGISTRATION_EFFECTIVE_FROM },
  vatExceedanceDate: EXCEEDANCE_DATE,
  vatPeriodicityYears: [
    {
      year: 2026,
      registrationEffectiveFrom: REGISTRATION_EFFECTIVE_FROM,
      registrationRoute: 'b',
      inArt310BeforeRegistration: 'da',
      actualTurnover: lei(255000),
      actualActivityMonths: 4,
      actualTurnoverScope: 'doar_cu_cod_de_tva',
      aicGoodsBeforeRegistration: 'nu',
    },
  ],
});

export const onlineCommercePersona: PersonaDefinition = {
  id: 'online-commerce',
  label: 'Comerț online — magazin și marketplace',
  summary:
    'Comerț cu amănuntul prin marketplace și magazin propriu, cu un furnizor din afara UE. 650.000 lei '
    + 'în 2026; depășește plafonul de TVA la 26 august.',
  teaches: [
    'Depășirea plafonului de 395.000 lei la sfârșitul verii, cu perioada fiscală derivată din art. 322 alin. (4)',
    'Cash-basis: venit brut = sumele încasate (art. 68 alin. (2) lit. a)), cheltuieli = plătite în an (alin. (4) lit. b))',
    'Divergența dintre venit și livrările TVA: trei facturi emise și livrate, încă neîncasate',
    'Furnizor din afara UE, plată în euro și conversie la data plății',
    'Stoc fără model de stoc: costul mărfii este cheltuială cash-basis, nu o contabilitate de stocuri',
  ],
  identity: IDENTITY,
  caen: { principal: '4791', secondary: ['4792', '5210', '5320', '6310'] },
  counterparties: [
    { name: TARGUL.denumire, kind: TARGUL.kind, tara: TARGUL.tara, cadenta: TARGUL.cadenta },
    { name: MAGAZIN.denumire, kind: MAGAZIN.kind, tara: MAGAZIN.tara, cadenta: MAGAZIN.cadenta },
    { name: YUANHUA.denumire, kind: YUANHUA.kind, tara: YUANHUA.tara, cadenta: YUANHUA.cadenta },
    { name: WHOLESALE.denumire, kind: WHOLESALE.kind, tara: WHOLESALE.tara, cadenta: WHOLESALE.cadenta },
    { name: DEPOZIT.denumire, kind: DEPOZIT.kind, tara: DEPOZIT.tara, cadenta: DEPOZIT.cadenta },
    { name: CURIERAT.denumire, kind: CURIERAT.kind, tara: CURIERAT.tara, cadenta: CURIERAT.cadenta },
  ],
  data: personaDataset(profile, {
    revenues: [
      // Marketplace sales: January–August without TVA (art. 310 scutire), September onwards with TVA.
      ...invoices(MARKETPLACE_SALES.slice(0, 8).map((v, i) => [i + 1, 26, v] as const), {
        party: TARGUL, prefix: 'TOL', vat: false,
      }),
      ...invoices(MARKETPLACE_SALES.slice(8).map((v, i) => [i + 9, 26, v] as const), {
        party: TARGUL, prefix: 'TOL', vat: true, eFactura: true, numberOffset: 8,
      }),
      ...invoices(DIRECT_SALES.map((v, i) => [i + 1, 14, v] as const).slice(0, 8), {
        party: MAGAZIN, prefix: 'SHOP', vat: false,
      }),
      ...invoices(DIRECT_SALES.map((v, i) => [i + 1, 14, v] as const).slice(8), {
        party: MAGAZIN, prefix: 'SHOP', vat: true, eFactura: true, numberOffset: 8,
      }),
      // The divergence: three invoices issued and delivered, money not yet in. They are deliveries for
      // Titlul II and they are not income for Titlul IV. Absence of `collected` is the fact.
      ...invoices([[7, 22, 14000], [9, 19, 16000], [10, 24, 18000]] as const, {
        party: TARGUL, prefix: 'TOL-NE', vat: true, eFactura: true, numberOffset: 20,
        status: () => 'in-asteptare',
      }),
    ],
    expenses: [
      ...costs(IMPORT_PURCHASES.map((v, i) => [i + 1, 7, v] as const), {
        party: YUANHUA, prefix: 'IMP', vat: false, currency: 'EUR', category: 'business_space_upkeep',
      }),
      ...costs(Array.from({ length: 12 }, (_, i) => [i + 1, 11, 4500] as const), {
        party: WHOLESALE, prefix: 'ENG', vat: false, category: 'business_space_upkeep',
      }),
      ...costs(Array.from({ length: 12 }, (_, i) => [i + 1, 30, 1800] as const), {
        party: DEPOZIT, prefix: 'DEP', vat: false, category: 'business_space_upkeep',
      }),
      ...costs(Array.from({ length: 12 }, (_, i) => [i + 1, 28, 2200] as const), {
        party: CURIERAT, prefix: 'CUR', vat: false, category: 'postal_and_telecom',
      }),
      // Shortages found at inventory count. The category the vocabulary carries says what the app can
      // conclude about them; art. 68 alin. (5) lit. d) perisabilități within the norms is a different
      // finding and this persona does not pretend to have made it.
      ...costs([[6, 30, 3000], [10, 30, 4200]] as const, {
        party: DEPOZIT, prefix: 'LP', vat: false, category: 'inventory_shortage_uncovered',
      }),
    ],
    clients: [TARGUL, MAGAZIN, YUANHUA, WHOLESALE, DEPOZIT, CURIERAT],
    fxRates: [
      fixtureRate('EUR', '2025-12-31', EUR_RATE_CAP_ANCHOR),
      ...fixtureRates('EUR', EUR_RATE_2026, IMPORT_PURCHASES.map((_, i) => `2026-${String(i + 1).padStart(2, '0')}-07`)),
    ],
  }),
};
