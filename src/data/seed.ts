/**
 * Phase 11 / PG-3 — this module holds two things, and the difference between them is the whole point.
 *
 *   `emptyData()`  what a first run gets. No records, no name, no start date. It is the initial state
 *                  of a fresh install, and it is what a rejected payload falls back to.
 *   `seedData`     a FIXTURE. A 2026-start PFA with a coherent year, used by the test suite and by the
 *                  opt-in demo sandbox. It is never a first run (D-SEED-2, D-RUN-1).
 *
 * Before Phase 11 the second one was also the first: `store.tsx` handed a fresh browser `seedData` with
 * `dataOrigin: 'seed'`, and nothing rendered a banner for it, so a new install opened on "Popescu Andrei"
 * with four invoices nobody filed. That is defect D1, and it is closed here rather than labelled.
 *
 * The fixture is a **2026** PFA: `pfaStartYear: 2026`, `pfaStartDate: '2026-01-19'`, and every recorded
 * document dated after that start date. It carries no prior-year filing, because a PFA that started in
 * 2026 has no prior year to file for, and it carries no SRL remnant, because every rule, deadline,
 * threshold and estimate in this app resolves it as a persoană fizică autorizată.
 *
 * It carries **no FX rate**. A rate is a legal datum — the rate a conversion uses has a source, a series
 * and a date it anchors to — and a seeded rate would be a fabricated one. That is why `fxRates` is absent
 * here rather than empty, and why no migration step backfills it either.
 */
import type { AppData, SettingsState } from './types';
import { createDefaultProfile } from '../domain/profile';
import { lei, ron } from '../domain/money';

/** The empty identity block. Every field is present and empty: absence, not a value. */
const EMPTY_IDENTITY = {
  nume: '',
  cnp: '',
  adresa: '',
  telefon: '',
  email: '',
  denumire: '',
  cui: '',
  formaJuridica: '',
  numarRegComert: '',
  adresaSocietate: '',
  telefonSocietate: '',
  emailSocietate: '',
  contBancar: '',
  banca: '',
  codTvaIntra: '',
  caen: [],
  mentiuniFactura: '',
};

/**
 * The settings block of a first run. `company` and `personal` are the legacy blocks kept parseable for
 * pre-Phase-7 payloads (D-1); on a first run they hold nothing, and nothing reads them — the live
 * identity is `profile.identity`.
 *
 * `cotaTva` is an inert settings field: grep finds no reader in the calculation path, only the schema
 * bound and the schema tests. It is carried at the same value the shipped fixture used so that turning a
 * first run into an empty one does not also mint a new rate nobody asked for.
 */
const EMPTY_SETTINGS: SettingsState = {
  cotaTva: 9,
  company: {
    denumire: '',
    cui: '',
    numarRegComert: '',
    adresa: '',
    cnp: '',
    formaJuridica: '',
    codFiscal: '',
    codCAEN: '',
    'regComerț': '',
    telefon: '',
    email: '',
    contBancar: '',
    banca: '',
    caen: [],
  },
  personal: { nume: '', cnp: '', adresa: '', telefon: '', email: '' },
  bankAccounts: [],
  eFactura: { trimitere: 'manual', dateContact: '' },
};

/**
 * The dataset a fresh install starts from: one default profile with no facts in it, and nothing else.
 *
 * A FUNCTION, not a module constant, on purpose. `createDefaultProfile` derives `pfaStartYear`,
 * `fiscalYear` and `updatedAt` from the clock, and a module-level constant would freeze them at import
 * time — before any test has pinned the clock. Called from `loadInitial()`, it reads the clock at the
 * moment the app loads, which is the fact being modelled.
 */
export function emptyData(): AppData {
  return {
    profile: createDefaultProfile({ identity: { ...EMPTY_IDENTITY } }),
    revenues: [],
    expenses: [],
    clients: [],
    filings: [],
    // PG-6h-3: the seed declares **no** occupancy sheet, and therefore holds no third-party personal data
    // at all. A demo fixture carrying a guest name and CNP would put invented identities on a document
    // whose whole purpose is to record real ones, and the fixture ships inside the bundle. Absence here is
    // the same discipline as `filings: []` — the app never mints a document nobody made.
    occupancySheets: [],
    // PG-6c (D-VEH-3): the empty dataset declares **no** vehicle. A seeded car would mint a fact the
    // taxpayer never stated and would place a vehicle inside or outside art. 68 alin. (5) lit. j) by
    // accident rather than by an answer.
    vehicles: [],
    // PG-6e (B-31, D-FA-1): the empty dataset declares **no** fixed asset. A seeded asset would mint an
    // entry into the patrimony, a *punerea în funcțiune* and a duration nobody chose, and would start
    // amortising an asset the taxpayer never bought.
    fixedAssets: [],
    documents: [],
    companyDocs: { im: [], cs: [], tva: [], facturi: [] },
    statements: [],
    snapshots: [],
    settings: {
      ...EMPTY_SETTINGS,
      bankAccounts: [],
      eFactura: { ...EMPTY_SETTINGS.eFactura },
      company: { ...EMPTY_SETTINGS.company, caen: [] },
      personal: { ...EMPTY_SETTINGS.personal },
    },
    // `null` is „no reserve recorded”, not zero. A first run has recorded nothing.
    reservedAmount: null,
    // `fxRates` is deliberately absent rather than `[]`: „no rate has been recorded" and „rates were
    // fetched and none exist" are different facts, and a seeded rate would be a fabricated legal figure.
  };
}

/**
 * The demo fixture — a 2026-start PFA with a coherent year.
 *
 * TEST FIXTURE and OPT-IN SANDBOX ONLY. It is not a first run and it is not what a fresh install
 * receives; see the header. Everything downstream that pins a figure (the deductible 120,00 / 144,00 lei,
 * VNA 9.096,00, the e2e 3.249,00 lei) reaches these records through the test path, so the figures survive
 * the separation — what dies is the shipped demo bundle.
 */
export const seedData: AppData = {
  profile: {
    id: 'profile-1',
    // Phase 11 (PG-3): the fixture is the product scenario, not a 2020 PFA. `pfaStartYear` and
    // `pfaStartDate` now agree with each other and with every document below — the start date is the
    // fact the engine reads for the CF art. 118 alin. (3) fraction-of-a-year case, and a start year with
    // no date behind it is the half-fact Phase 12 will need.
    pfaStartYear: 2026,
    pfaStartDate: '2026-01-19',
    fiscalYear: 2026,
    regime: 'impozit_pe_venit',
    // Phase 7 (D-1): CAEN lives in `identity.caen`; the deprecated `profile.caen` string is not seeded.
    salaryStatus: 'nu',
    // TASK 5: the pension facts are split. The fixture records the STATUS (the CAS key under CF art. 150
    // alin. (1)) and deliberately records NO receipt fact: whether pension sums were received in 2026 is
    // something this demo user never stated, and inventing it would either grant or refuse the art. 174
    // alin. (7) lit. c) relief out of nothing.
    pensionerStatus: 'nu',
    // PG-6d (D-LEG-1, B-41): the demo profile records NO amounts for the art. 155 alin. (1) lit. c)-h)
    // categories. The old `otherIncome: []` said only that the demo user had no boxes ticked, which is not
    // a fact the engine can use; six declared zeros would say something far stronger — that this person had
    // no income in any of the six categories — and nobody said it. Leaving the year unanswered keeps the
    // ladder unasked, which is the state the seed estimate has always computed under.
    // PG-6b (B-29): the demo profile DECLARES its activity family. This is a fixture answering a question,
    // not a default — `domain/profile.ts createDefaultProfile` deliberately leaves the field absent, and an
    // absent field stays an unanswered question (`scenarios.ts activity-family-undeclared` → a
    // `fact_missing` coverage row). Leaving the fixture unanswered would have made every test that reads
    // the demo profile assert an incomplete estimate for a reason unrelated to what that test is about.
    activityFamily: 'other',
    socialInsuranceStatus: 'obligatoriu',
    vatExempt: false,
    // No `vatExceedanceDate`: this PFA is VAT-registered from the start rather than by exceeding the
    // art. 310 alin. (1) ceiling, so there is no exceedance date to record. The absence is the honest
    // state and `VAT_REGISTRATION_DEADLINE_2026` correctly resolves to nothing.
    cashFloorLei: lei(0),
    identity: {
      nume: 'Popescu Andrei',
      cnp: '1234567890123',
      adresa: 'Str. Libertății 12, Cluj-Napoca',
      telefon: '0750 123 456',
      email: 'andrei@popescuconsulting.ro',
      // TASK 9 (identity hygiene): the block used to describe an SRL while every rule, deadline,
      // threshold and estimate in the app resolves this profile as a persoană fizică autorizată. A PFA
      // has no legal personality separate from the person, and an SRL does not file a D212 at all. The
      // trading name of a PFA is the person's own name; `numarRegComert` stays because a PFA IS
      // registered at ONRC (OUG 44/2008 art. 7 alin. (1)), and `J40/1234/2026` is what makes
      // `pfaStartYear: 2026` coherent rather than a stray year.
      denumire: 'Popescu Andrei PFA',
      cui: 'RO4455667788990',
      formaJuridica: 'Persoană fizică autorizată',
      numarRegComert: 'J40/1234/2026',
      adresaSocietate: 'Str. Libertății 12, Cluj-Napoca',
      telefonSocietate: '0750 123 456',
      emailSocietate: 'contact@popescuconsulting.ro',
      contBancar: 'RO44 BACX 0000 0000 1234 5678 9000',
      banca: 'BCR',
      // Phase 7 (D-1): the fields that used to live only in settings.company.
      codTvaIntra: 'RO4455667788990',
      caen: [{ cod: '6201', descriere: 'Activități de programare computerizate' }],
      mentiuniFactura: 'Mulțumesc pentru colaborare.',
    },
    updatedAt: '2026-10-05T10:00:00.000Z',
  },
  // Phase 11 (PG-3): the six documents are dated across the year that follows the start date — February
  // to September 2026 — instead of all clustering in one September. A 2026-start PFA whose entire year is
  // one month is a fixture that teaches a shape the calendar contradicts. The AMOUNTS are unchanged, so
  // every aggregate, cap and estimate pinned downstream is unchanged; only the month each record lands in
  // moved, and the invoice numbers stay in date order.
  revenues: [
    { id: 'r1', tip: 'factura', nr: 'FCT-2026-001', date: '2026-02-02', client: 'Presta Consulting SRL', cui: 'RO12345678', valoareFaraTva: ron(4500), tva: ron(945), status: 'inregistrata', eFacturaStatus: 'Acceptată' },
    { id: 'r2', tip: 'factura', nr: 'FCT-2026-002', date: '2026-04-10', client: 'Andrei Popescu', cui: '1234567890123', valoareFaraTva: ron(1200), tva: ron(252), status: 'in-asteptare', eFacturaStatus: 'În așteptare' },
    { id: 'r3', tip: 'notafactura', nr: 'NF-2026-003', date: '2026-06-18', client: 'Marius Ionescu', cui: '9876543210987', valoareFaraTva: ron(800), tva: ron(168), status: 'respinsa', statusDetail: 'CUI nevalid', eFacturaStatus: 'Respinsă' },
    { id: 'r4', tip: 'factura', nr: 'FCT-2026-004', date: '2026-09-25', client: 'Presta Consulting SRL', cui: 'RO12345678', valoareFaraTva: ron(3200), tva: ron(672), status: 'inregistrata', eFacturaStatus: 'Acceptată' },
  ],
  expenses: [
    // TASK 2b — seed records are FIXTURES, not user data, so they carry explicit categories; migrated
    // user data stays uncategorised and classifies as `undetermined` (see `migrateExpenseCategoryV6`).
    // The three tokens are chosen so the demo shows all three fates, and each is the honest reading of
    // the document the fixture depicts — none is chosen to make a figure land somewhere:
    //   e1  CloudHost SRL, factură de hosting/conectivitate → `postal_and_telecom`, deductibilă
    //       (Normele HG 1/2016 pct. 7 alin. (5) lit. j)).
    //   e2  Carrefour, bon fiscal de la un supermarket → `personal_or_family_use`, expres nedeductibil
    //       (CF art. 68 alin. (7) lit. a): „cheltuielile efectuate în interes personal sau de familie”).
    //   e3  Office Supplies SA, factură de rechizite → `business_space_upkeep`, deductibilă ca categorie,
    //       dar exclusă oricum de `status: 'respinsa'` — care nu ajunge niciodată în agregat.
    // Consequence for every pinned figure downstream: the deductible base is no longer „all expenses”.
    //   before: expenseNet = 120,00 + 85,50 = 205,50 lei (20.550 bani) — every 'inregistrata' record
    //   after:  expenseNet = 120,00 lei (12.000 bani) — only e1 survives classification
    //   and VAT-inclusive: 12.000 + 2.520 = 14.520 bani, down from 24.866 bani.
    { id: 'e1', tip: 'factura', nr: 'FCT-PRO-118', date: '2026-03-05', furnizor: 'CloudHost SRL', cui: 'RO87654321', valoareFaraTva: ron(120), tva: ron(25.2), status: 'inregistrata', category: 'postal_and_telecom' },
    { id: 'e2', tip: 'bon-fiscal', nr: 'BF-4471', date: '2026-05-12', furnizor: 'Carrefour', cui: 'RO11223344', valoareFaraTva: ron(85.5), tva: ron(17.96), status: 'inregistrata', category: 'personal_or_family_use' },
    { id: 'e3', tip: 'factura', nr: 'FCT-PRO-121', date: '2026-07-20', furnizor: 'Office Supplies SA', cui: 'RO55667788', valoareFaraTva: ron(340), tva: ron(71.4), status: 'respinsa', statusDetail: 'Document neconform', category: 'business_space_upkeep' },
  ],
  clients: [
    { id: 'c1', denumire: 'Presta Consulting SRL', cui: 'RO12345678', email: 'contact@presta.ro', telefon: '0721 111 222', oras: 'București' },
    { id: 'c2', denumire: 'Andrei Popescu', cui: '1234567890123', email: 'andrei.popescu@mail.ro', telefon: '0731 333 444', oras: 'Cluj-Napoca' },
    { id: 'c3', denumire: 'Marius Ionescu', cui: '9876543210987', email: 'm.ionescu@mail.ro', telefon: '0742 555 666', oras: 'Timișoara' },
  ],
  // TASK 9 (seed hygiene) — the three monthly declaration records that used to sit here (2026-03
  // „transmisa”, 2026-06 „in-asteptare”, 2026-09 „inregistrata”) are GONE, and deliberately so.
  //
  // They recorded filings that do not exist. For a PFA în sistem real the statutory return is the
  // Declarația Unică 212, ONCE a year, by 25 May of the following year — CF art. 122 alin. (3); and
  // art. 120 / 120¹, the estimated-advance filings, were abrogated by OUG 128/2024 from 01-01-2025
  // (docs/ai/research/12_quarterly_payment_deadlines_2026.md §6 rates `d212_filing` „the *only* real
  // deadline” of the six the app once modelled). There is no monthly, quarterly or nil-return filing
  // obligation for this profile for these rows to be a record OF.
  //
  // They were also the only place in the demo whose figures contradicted the registers: 2026-09 claimed
  // venituri 9.680,00 lei and cheltuieli 546,00 lei, while September's recorded documents total 7.700,00
  // lei net revenue and 205,50 lei of expenses. A "summary" that does not summarise is a fabricated fact.
  //
  // NOT replaced by anything. A nil return would be a filing that was never due — the same mistake in a
  // cleaner uniform — and the annual D212 for FY2026 cannot be stored honestly in a monthly `{an, luna}`
  // shape at all. That shape is the model defect: recorded in docs/ai/phases/23_provenance_hygiene.md §5
  // and left for a later phase, not patched here. The deadline itself is untouched and correct — the
  // rule-driven engine emits `PFA_DEADLINE_2026` / `d212_filing` at 2027-05-25, and no seed record is
  // allowed to become a second source of a deadline.
  //
  // PG-5 (B-34) closed that shape: the record type is now annual (`AnnualFiling`, keyed by the fiscal
  // year it DECLARES). PG-5b removed the monthly shape from the application altogether — the v10→v11 step
  // now drops a pre-v11 payload's monthly rows instead of preserving them, because D-USER-1 records that
  // no stored payload exists to protect. What is still NOT here is an annual filing. This profile's first
  // Declarația Unică is the FY2026 return, due 2027-05-25; at the demo's own date it has not been filed,
  // so `filings` is empty and the deadline says so. Seeding a filing would be seeding a fact the demo
  // cannot support — the same mistake TASK 9 removed, in a tidier shape.
  filings: [],
  // PG-6h-3 (D-OCC-1): the demo fixture holds **no** occupancy sheet, so it carries no data about any
  // person who is not the demo taxpayer. A fixture guest with a name and a CNP would be an invented
  // identity written onto a document whose only purpose is to record real ones — and this object ships
  // inside the bundle and is loaded by e2e specs. Any fixture that needs a sheet builds its own, clearly
  // commented as synthetic.
  occupancySheets: [],
  // PG-6c (D-VEH-3): the demo fixture declares **no** vehicle, so no expense in it is attributed to a car
  // and no car sits inside or outside the one-car limit by our choice rather than the demo taxpayer's.
  // A fixture that needs a vehicle builds its own.
  vehicles: [],
  // PG-6e (B-31, D-FA-1): the demo fixture declares **no** fixed asset, so the seed estimate stays exactly
  // 311.200 bani — no depreciation figure enters it, and no asset fact is asserted on the demo taxpayer's
  // behalf. A fixture that needs an asset builds its own.
  fixedAssets: [],
  documents: [
    { id: 'doc1', nume: 'FCT-2026-001.pdf', data: '2026-02-02', categoria: 'Facturi' },
    { id: 'doc3', nume: 'Contract Presta Consulting.pdf', data: '2026-01-26', categoria: 'Contracte' },
    // Phase 11 (PG-3): „Declarația 212 – venitul anului 2025.pdf” is gone. A PFA that started on
    // 2026-01-19 has no 2025 income year, so a 2025 return is not a document it holds — it is a
    // prior-year filing the fixture cannot have. Same reason the `im` section and the `212` statement
    // below are empty.
  ],
  companyDocs: {
    // TASK 9 (seed hygiene): the quarterly D100 and D220 artefacts are gone.
    //   D100 is the return for payroll obligations (rețineri pe venit și contribuții pentru personal
    //   angajat). This profile records no employees anywhere in AppData, so it owes no D100; and
    //   research/12 §3 puts it beside D112 (CF art. 147): the payroll return „does not apply to a PFA's
    //   own CAS”.
    //   D220 no longer exists: Declarația Unică 212 replaced form 232 (venit) and form 220
    //   (contribuții sociale) with effect from 1 April 2018 (docs/ai/research/06_2026_fiscal_research.md
    //   §3 row 1). A 2026 D220 is a form that has not existed for eight years.
    //
    // Phase 11 (PG-3): what replaced them — the D212 for the 2025 year, filed 2026-05-20 — is gone too.
    // It was the correct return for the OLD 2020-start fixture and it is an impossible document for a
    // PFA that began on 2026-01-19: there is no 2025 income year to declare. The first return this
    // profile files is the D212 for FY2026, due 2027-05-25, and it has not been filed, so nothing here
    // records it. The deadline for it is emitted by the rule engine, not by a fixture.
    im: [],
    cs: [],
    // PG-5 (B-35): the D300 document that used to sit here is gone, and it is the CLAIM that went with
    // it. The row recorded a Declarația 300 for „August 2026”, filed 2026-09-15 — a MONTHLY period. CF
    // art. 322 alin. (1)-(4) makes the VAT fiscal period the quarter for a taxpayer whose previous-year
    // taxable supplies stayed under the 100.000 € equivalent and the month only otherwise, and which of
    // those this profile is depends on its VAT registration date and prior-year taxable supplies — facts
    // no field anywhere in this dataset records (`vatExempt: false` is not a registration fact, and
    // `vatExceedanceDate` is absent). So the row was not a filing this demo could evidence; it was the
    // cadence assertion wearing a document's clothes. Keeping it and editing only the period would have
    // picked a quarter nobody recorded, which is the same invention in the other direction.
    //
    // What stops being represented, stated plainly: the demo no longer shows ANY filed VAT return, and
    // the `tva` section of the company documents is empty. That is the honest state of a fixture whose
    // input fact is missing — see the completeness row for the VAT filing period, which now says so.
    tva: [],
    facturi: [
      { id: 'f1', nume: 'FCT-2026-001.pdf', tip: 'factura', content: 'data:text/plain;base64,GmFjdHVyYQ==', marime: 12480, data: '2026-02-02' },
      { id: 'f2', nume: 'NF-2026-003.pdf', tip: 'notafactura', content: 'data:text/plain;base64,Tm90YSBmYXJhIGZhY3R1cmE=', marime: 9210, data: '2026-06-18' },
      { id: 'f3', nume: 'BF-4471.pdf', tip: 'bon-fiscal', content: 'data:text/plain;base64,Bm9uIGZpc2NhbA==', marime: 4102, data: '2026-05-12' },
    ],
  },
  statements: [
    // TASK 9: the two quarterly statements (tip '100' and tip '220', both '2026-Q2', both filed 'SOLO')
    // recorded the same two obligations the companyDocs entry above records — see the note there for why
    // neither is an obligation of this profile.
    //
    // Phase 11 (PG-3): the `212` row for the 2025 year is gone with the document that evidenced it — see
    // the `im` note above.
    //
    // PG-5 (B-35): the last row, tip '300' / perioada '2026-08', is gone for the reason given on the
    // `tva` entry above — a monthly D300 period is a cadence this fixture cannot support, and the
    // register is where that cadence was being asserted. The register is now empty, and the completeness
    // check for tax statements says so instead of the fixture implying an answer to a question the app
    // has never been given the facts to ask.
  ],
  snapshots: [],
  settings: {
    cotaTva: 9,
    company: {
      // TASK 9: the legacy block, kept parseable for pre-Phase-7 payloads (decision D-1) and the source
      // `legacyProfileFromSettings` absorbs from. It carried the same SRL/PFA contradiction as
      // `profile.identity`, so it is corrected to match — `store.migration.chain.test.tsx` asserts the
      // migrated identity against these very fields, so the two blocks cannot disagree.
      denumire: 'Popescu Andrei PFA',
      cui: 'RO4455667788990',
      numarRegComert: 'J40/1234/2026',
      adresa: 'Str. Libertății 12, Cluj-Napoca',
      // A CUI in a CNP field. Nothing in src/ reads `settings.company.cnp` — `identity.cnp` is absorbed
      // from `settings.personal.cnp` — but a PFA has no legal personality separate from the person, so
      // the only CNP this block could honestly carry is the person's.
      cnp: '1234567890123',
      formaJuridica: 'Persoană fizică autorizată',
      codFiscal: 'RO4455667788990',
      codCAEN: '6201',
      regComerț: 'J40/1234/2026',
      telefon: '0750 123 456',
      email: 'contact@popescuconsulting.ro',
      contBancar: 'RO44 BACX 0000 0000 1234 5678 9000',
      banca: 'BCR',
      caen: [{ cod: '6201', descriere: 'Activități de programare computerizate' }],
    },
    personal: {
      nume: 'Popescu Andrei',
      cnp: '1234567890123',
      adresa: 'Str. Libertății 12, Cluj-Napoca',
      telefon: '0750 123 456',
      email: 'andrei@popescuconsulting.ro',
    },
    bankAccounts: [
      { id: 'ba-1', banca: 'BCR', moneda: 'RON' },
    ],
    eFactura: {
      trimitere: 'manual',
      dateContact: '2026-01-26',
    },
  },
  // TASK 3: the fixture records no reserve. `null` is the honest state — nothing has been set aside that
  // anyone recorded — and it is what the sandbox dashboard renders („Nicio sumă înregistrată”). Seeding
  // `0` would assert an explicit zero the fixture has no basis for, and would change the reserve figures
  // every e2e pin depends on.
  reservedAmount: null,
  // Phase 11 / landmine 4: NO `fxRates`. A rate is a legal datum with a source, a series and an anchor
  // date; seeding one would fabricate it. The sandbox therefore shows the unconverted-record disclosure
  // for any foreign amount, exactly as a real install would.
};
