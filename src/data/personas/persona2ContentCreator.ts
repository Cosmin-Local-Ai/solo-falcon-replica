/**
 * Persona 2 — **content creator / author** (CAEN 9011 principal; 5811, 5920, 6391, 7420 secondary).
 *
 * ## What this person is
 *
 * A writer and composer who sells two different things under two different articles, which is exactly the
 * case the app used to be unable to represent at all:
 *
 * - **comandă work** — paid to produce and deliver, no rights transferred → CF art. 67, *activități
 *   independente*. Twelve monthly invoices plus four project invoices, in lei.
 * - **cesie / licență** — paid for the patrimonial copyright itself → CF art. 70, *drepturi de proprietate
 *   intelectuală*. **150.000 lei of DPI gross** across the year, from a UK licensing platform and two
 *   Romanian ones.
 *
 * The distinction is the object of the contract, not the label on the paper and not the fact of holding a
 * PFA (`src/domain/dpi.ts`, ÎCCJ dec. 1793/2021), so every DPI record here carries
 * `dpiContractType: 'cesiune_licenta'` beside its income category, and the pair is what the app checks.
 *
 * ## Why B-123 closes here
 *
 * B-123 was: *B-112 shipped four stages and 2,526 unit tests with zero demo data and zero e2e coverage.*
 * This persona is the demo data, and `e2e/persona-2-content-creator.spec.ts` is the e2e coverage: DPI
 * receipts entered as art. 70 in the register, the register showing the category, and the estimate saying
 * out loud which part of the year it does not yet cover.
 *
 * ## What the engine does with DPI today, stated rather than hidden
 *
 * `estimateBasis.ts` scopes recorded DPI receipts **out** of the sistem-real engine — running an art. 70
 * receipt through the art. 68 calculator would be the B-112 defect in a quieter uniform — and reports each
 * one as a coverage gap that names the 40 % forfetară quota the rule declares. That is the honest current
 * state, and a persona that made it look computed would turn a known gap into an invisible one (brief 64
 * Part D). The DPI **contribution** path — CAS art. 137 alin. (1) lit. b¹), CASS art. 155 alin. (1)
 * lit. c), and the reținere la sursă of art. 151 alin. (5)-(11) / art. 174¹ alin. (3)-(9)) — is carried by
 * persona 6, which declares the DPI net on the art. 170 alin. (4) ladder instead of recording the receipts.
 * Both routes to one number cannot be held by one persona: `dpiDoubleRepresentation` exists precisely to
 * refuse that, and a demo whose headline figure is a refusal demonstrates nothing.
 *
 * ## Thresholds it crosses
 *
 * CAS moves onto the **24-smn rung** (art. 148 alin. (2) lit. b), 97.200 lei) on its art. 67 net alone,
 * and the CASS floor (art. 174 alin. (6), 24.300 lei) is long since engaged. It stays in the art. 310
 * scutire — 116.000 lei of VAT-exclusive turnover against a 395.000-lei plafon — because a persona set
 * where everyone is VAT-registered would teach the exemption to nobody.
 */
import { lei } from '../../domain/money';
import type { PersonaDefinition } from './personaTypes';
import {
  caenClass,
  costs,
  day,
  fixtureRates,
  invoices,
  personaDataset,
  personaProfile,
  type PartySpec,
} from './personaKit';

const IDENTITY = {
  nume: 'Barnea Ioana-Leticia',
  cnp: '2810000213007',
  adresa: 'Str. Lotreanului 21, Iași',
  telefon: '0745 118 902',
  email: 'ioana@barneacreatie.example',
  denumire: 'Barnea Ioana-Leticia PFA',
  cui: 'RO15480293',
  formaJuridica: 'Persoană fizică autorizată',
  numarRegComert: 'J10/0922/2019',
  contBancar: 'RO44 CARP 0000 0000 1092 2210 9002',
  banca: 'Banca Carpatică',
};

// ── art. 67: contract de comandă / antrepriză (Legea 8/1996 art. 47) ──────────────────────────
const MERIDIAN: PartySpec = {
  id: 'p2-meridian',
  denumire: 'Studioul Meridian SRL',
  cui: 'RO26150394',
  email: 'productii@meridianstudio.example',
  oras: 'București',
  tara: 'România',
  kind: 'client_corporate_ro',
  cadenta: 'contract de comandă lunar pentru scenarii, plată pe 15',
};

const DELEPORTE: PartySpec = {
  id: 'p2-deleporte',
  denumire: 'Agenția Deleporte SRL',
  cui: 'RO37261504',
  email: 'comenzi@deleporte.example',
  oras: 'Timișoara',
  tara: 'România',
  kind: 'client_corporate_ro',
  cadenta: 'proiecte de publicitate, factură la predare, plată la 30 zile',
};

// ── art. 70: cesiune / licență de drepturi patrimoniale (Legea 8/1996 art. 40) ────────────────
const CANTUS: PartySpec = {
  id: 'p2-cantus',
  denumire: 'Cantus Digital Ltd',
  cui: 'GB331188024',
  email: 'royalties@cantusdigital.example',
  oras: 'Londra',
  tara: 'Regatul Unit (în afara UE)',
  kind: 'platform_withholding',
  cadenta: 'licențe muzicale trimestriale, statament pe 1, plată pe 15',
};

const FONOTECA: PartySpec = {
  id: 'p2-fonoteca',
  denumire: 'Fonoteca Virtuală SRL',
  cui: 'RO48372615',
  email: 'licente@fonoteca.example',
  oras: 'Cluj-Napoca',
  tara: 'România',
  kind: 'platform_withholding',
  cadenta: 'redare lunară, statament pe 28, plată pe 5 a lunii următoare',
};

const FILIMON: PartySpec = {
  id: 'p2-filimon',
  denumire: 'Revista Filimon SRL',
  cui: 'RO59483726',
  email: 'redactie@filimon.example',
  oras: 'Iași',
  tara: 'România',
  kind: 'client_corporate_ro',
  cadenta: 'cesiune de articol, două volume pe an',
};

const CONECTICA: PartySpec = {
  id: 'p2-conectica',
  denumire: 'Conectica SRL',
  cui: 'RO87654321',
  email: 'facturi@conectica.example',
  oras: 'București',
  tara: 'România',
  kind: 'supplier_ro',
  cadenta: 'abonament lunar de hosting pentru arhiva personală',
};

const STUDIOCHIR: PartySpec = {
  id: 'p2-studiochir',
  denumire: 'Studiochir SRL',
  cui: 'RO14725836',
  email: 'facturi@studiochir.example',
  oras: 'Iași',
  tara: 'România',
  kind: 'supplier_ro',
  cadenta: 'închiriere de studio înregistrare, la proiect',
};

const EUR_RATE = '5.0000';

const DPI = {
  incomeCategory: 'drepturi_de_proprietate_intelectuala' as const,
  dpiContractType: 'cesiune_licenta' as const,
};

const profile = personaProfile('persona-content-creator', IDENTITY, [
  caenClass('9011'),
  caenClass('5811'),
  caenClass('5920'),
  caenClass('6391'),
  caenClass('7420'),
], {
  pfaStartYear: 2019,
  pfaStartDate: '2019-06-03',
  activityFamily: 'other',
  // In the art. 310 scutire, and declared as such: the measure the estimate uses depends on it, and an
  // undeclared registration makes the estimate refuse rather than guess the money measure.
  vatRegistration: { status: 'scutit_art310' },
});

export const contentCreatorPersona: PersonaDefinition = {
  id: 'content-creator',
  label: 'Creator de conținut și autor',
  summary:
    'Scriitoare și compozitoare: contracte de comandă în lei și licențe de drepturi de autor, inclusiv o '
    + 'platformă din UK. 150.000 lei brut din DPI în 2026, alături de 116.000 lei din activitate independentă.',
  teaches: [
    'Veniturile art. 67 și cele art. 70 în același registru, separate prin categoria de venit și prin obiectul contractului',
    'Cota forfetară de 40 % (art. 72 alin. (2) / art. 72^1 alin. (1)) și ce acoperă aplicația astăzi din calea DPI',
    'Reținerea impozitului de către plătitorul de venit (art. 72 alin. (4)-(5)) ca faptă a statamentului, nu a declarației',
    'CAS pe treapta de 24 de salarii minime, cu CASS pe art. 170 alin. (1)',
    'Scutirea de TVA de la art. 310: un profil care nu depășește plafonul și o spune',
  ],
  identity: IDENTITY,
  caen: { principal: '9011', secondary: ['5811', '5920', '6391', '7420'] },
  counterparties: [
    { name: MERIDIAN.denumire, kind: MERIDIAN.kind, tara: MERIDIAN.tara, cadenta: MERIDIAN.cadenta },
    { name: DELEPORTE.denumire, kind: DELEPORTE.kind, tara: DELEPORTE.tara, cadenta: DELEPORTE.cadenta },
    { name: CANTUS.denumire, kind: CANTUS.kind, tara: CANTUS.tara, cadenta: CANTUS.cadenta },
    { name: FONOTECA.denumire, kind: FONOTECA.kind, tara: FONOTECA.tara, cadenta: FONOTECA.cadenta },
    { name: FILIMON.denumire, kind: FILIMON.kind, tara: FILIMON.tara, cadenta: FILIMON.cadenta },
    { name: CONECTICA.denumire, kind: CONECTICA.kind, tara: CONECTICA.tara, cadenta: CONECTICA.cadenta },
    { name: STUDIOCHIR.denumire, kind: STUDIOCHIR.kind, tara: STUDIOCHIR.tara, cadenta: STUDIOCHIR.cadenta },
  ],
  data: personaDataset(profile, {
    revenues: [
      // art. 67 — activitate independentă. The contract type is recorded beside the category because the
      // pair is what the app checks (`dpiRecordConflict`), not because the category needs decoration.
      ...invoices(Array.from({ length: 12 }, (_, i) => [i + 1, 15, 8500] as const), {
        party: MERIDIAN, prefix: 'MER', vat: false, dpiContractType: 'contract_de_comanda',
      }),
      ...invoices([[3, 28, 8000], [6, 27, 8000], [9, 26, 8000], [11, 24, 8000]] as const, {
        party: DELEPORTE, prefix: 'DEL', vat: false, dpiContractType: 'contract_de_comanda',
      }),
      // art. 70 — DPI. Marked on the record, never inferred from the counterparty's name.
      ...invoices([[2, 15, 3000], [5, 15, 3000], [8, 15, 3000], [11, 15, 3000]] as const, {
        party: CANTUS, prefix: 'LIC', currency: 'EUR', vat: false, ...DPI,
      }),
      ...invoices(Array.from({ length: 12 }, (_, i) => [i + 1, 5, 2500] as const), {
        party: FONOTECA, prefix: 'FON', vat: false, ...DPI,
      }),
      ...invoices([[5, 12, 30000], [10, 14, 30000]] as const, {
        party: FILIMON, prefix: 'CES', vat: false, ...DPI,
      }),
    ],
    expenses: [
      ...costs(Array.from({ length: 12 }, (_, i) => [i + 1, 3, 120] as const), {
        party: CONECTICA, prefix: 'CON', vat: false, category: 'postal_and_telecom',
      }),
      ...costs([[2, 9, 900], [4, 11, 900], [7, 8, 900], [9, 10, 900], [11, 12, 900], [12, 15, 900]] as const, {
        party: STUDIOCHIR, prefix: 'STD', vat: false, category: 'rent_business_space',
      }),
    ],
    clients: [MERIDIAN, DELEPORTE, CANTUS, FONOTECA, FILIMON, CONECTICA, STUDIOCHIR],
    fxRates: fixtureRates('EUR', EUR_RATE, [
      day(2, 15), day(5, 15), day(8, 15), day(11, 15),
    ]),
  }),
};

/** The DPI gross this persona states, in lei, for the coverage test to pin against. */
export const CONTENT_CREATOR_DPI_GROSS_LEI = lei(150000);
