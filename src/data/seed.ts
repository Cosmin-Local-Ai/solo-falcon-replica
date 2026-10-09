import type { AppData } from './types';
import { lei } from '../domain/money';

export const seedData: AppData = {
  profile: {
    id: 'profile-1',
    pfaStartYear: 2020,
    fiscalYear: 2026,
    regime: 'impozit_pe_venit',
    // Phase 7 (D-1): CAEN lives in `identity.caen`; the deprecated `profile.caen`
    // string is not seeded any more.
    salaryStatus: 'nu',
    // TASK 5: the pension facts are split. The seed records the STATUS (the CAS key under CF art. 150
    // alin. (1)) and deliberately records NO receipt fact: whether pension sums were received in 2026 is
    // something this demo user never stated, and inventing it would either grant or refuse the art. 174
    // alin. (7) lit. c) relief out of nothing.
    pensionerStatus: 'nu',
    otherIncome: [],
    socialInsuranceStatus: 'obligatoriu',
    vatExempt: false,
    cashFloorLei: lei(0),
    identity: {
      nume: 'Popescu Andrei',
      cnp: '1234567890123',
      adresa: 'Str. Libertății 12, Cluj-Napoca',
      telefon: '0750 123 456',
      email: 'andrei@popescuconsulting.ro',
      // TASK 9 (identity hygiene): this block described an SRL — `denumire: 'Popescu Consulting SRL'`,
      // `formaJuridica: 'SRL'` — while every rule, deadline, threshold and estimate in the app resolves
      // the profile as a persoană fizică autorizată (`regime: 'impozit_pe_venit'`, CF Titlul VI in
      // sistem real, CAS/CASS under art. 150/174, the D212). A demo that names the taxpayer an SRL
      // teaches a form the rest of the app contradicts, and an SRL does not file a D212 at all. The
      // trading name of a PFA is the person's own name; `numarRegComert` stays because a PFA IS registered
      // at ONRC, and `J40/1234/2020` is what makes `pfaStartYear: 2020` coherent rather than a stray year.
      denumire: 'Popescu Andrei PFA',
      cui: 'RO4455667788990',
      formaJuridica: 'Persoană fizică autorizată',
      numarRegComert: 'J40/1234/2020',
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
    updatedAt: '2026-09-28T10:00:00.000Z',
  },
  revenues: [
    { id: 'r1', tip: 'factura', nr: 'FCT-2026-001', date: '2026-09-02', client: 'Presta Consulting SRL', cui: 'RO12345678', valoareFaraTva: lei(4500), tva: lei(945), status: 'inregistrata', eFacturaStatus: 'Acceptată' },
    { id: 'r2', tip: 'factura', nr: 'FCT-2026-002', date: '2026-09-10', client: 'Andrei Popescu', cui: '1234567890123', valoareFaraTva: lei(1200), tva: lei(252), status: 'in-asteptare', eFacturaStatus: 'În așteptare' },
    { id: 'r3', tip: 'notafactura', nr: 'NF-2026-003', date: '2026-09-18', client: 'Marius Ionescu', cui: '9876543210987', valoareFaraTva: lei(800), tva: lei(168), status: 'respinsa', statusDetail: 'CUI nevalid', eFacturaStatus: 'Respinsă' },
    { id: 'r4', tip: 'factura', nr: 'FCT-2026-004', date: '2026-09-25', client: 'Presta Consulting SRL', cui: 'RO12345678', valoareFaraTva: lei(3200), tva: lei(672), status: 'inregistrata', eFacturaStatus: 'Acceptată' },
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
    { id: 'e1', tip: 'factura', nr: 'FCT-PRO-118', date: '2026-09-05', furnizor: 'CloudHost SRL', cui: 'RO87654321', valoareFaraTva: lei(120), tva: lei(25.2), status: 'inregistrata', category: 'postal_and_telecom' },
    { id: 'e2', tip: 'bon-fiscal', nr: 'BF-4471', date: '2026-09-12', furnizor: 'Carrefour', cui: 'RO11223344', valoareFaraTva: lei(85.5), tva: lei(17.96), status: 'inregistrata', category: 'personal_or_family_use' },
    { id: 'e3', tip: 'factura', nr: 'FCT-PRO-121', date: '2026-09-20', furnizor: 'Office Supplies SA', cui: 'RO55667788', valoareFaraTva: lei(340), tva: lei(71.4), status: 'respinsa', statusDetail: 'Document neconform', category: 'business_space_upkeep' },
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
  declarations: [],
  documents: [
    { id: 'doc1', nume: 'FCT-2026-001.pdf', data: '2026-09-02', categoria: 'Facturi' },
    { id: 'doc2', nume: 'Declarația 212 – venitul anului 2025.pdf', data: '2026-05-20', categoria: 'Declarații' },
    { id: 'doc3', nume: 'Contract Presta Consulting.pdf', data: '2026-08-20', categoria: 'Contracte' },
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
    // What replaces them is the one return this profile actually files: the D212 for the 2025 year,
    // filed inside the 25 May 2026 term (CF art. 122 alin. (3)). It sits under `im` because it is one
    // form covering the income AND the social contributions — `cs` is left empty rather than given a
    // second copy of the same document, and an empty section renders its own empty state.
    im: [
      { id: 'im1', nume: 'Declarația 212 – venitul anului 2025.pdf', tip: 'factura', content: 'data:text/plain;base64,SW1wb3ppdCBwZSB2ZW5pdQ==', marime: 48210, data: '2026-05-20', dataDepunere: '2026-05-20', depunere: 'ANAF', perioada: '2025' },
    ],
    cs: [],
    tva: [
      { id: 'tva1', nume: 'Declarația 300 – August 2026.pdf', tip: 'factura', content: 'data:text/plain;base64,VERWQSBkZWNsYXJhdGlvbg==', marime: 39870, data: '2026-09-15', dataDepunere: '2026-09-15', depunere: 'ANAF', perioada: 'August 2026' },
    ],
    facturi: [
      { id: 'f1', nume: 'FCT-2026-001.pdf', tip: 'factura', content: 'data:text/plain;base64,GmFjdHVyYQ==', marime: 12480, data: '2026-09-02' },
      { id: 'f2', nume: 'NF-2026-003.pdf', tip: 'notafactura', content: 'data:text/plain;base64,Tm90YSBmYXJhIGZhY3R1cmE=', marime: 9210, data: '2026-09-18' },
      { id: 'f3', nume: 'BF-4471.pdf', tip: 'bon-fiscal', content: 'data:text/plain;base64,Bm9uIGZpc2NhbA==', marime: 4102, data: '2026-09-12' },
    ],
  },
  statements: [
    // TASK 9: the two quarterly statements (tip '100' and tip '220', both '2026-Q2', both filed 'SOLO')
    // recorded the same two obligations the companyDocs entry above records — see the note there for why
    // neither is an obligation of this profile. One entry remains: the annual D212 for the 2025 year.
    // `depunere: 'personală'` because a persoană fizică files the D212 in their own name; 'SOLO' is the
    // payroll/employer transmission channel.
    // The D300 row below is NOT touched by this task, and that is a deliberate non-fix: CF art. 322
    // alin. (1)-(4) makes the fiscal period the QUARTER for a taxpayer whose previous-year taxable
    // supplies stayed under the 100.000 € equivalent, and the month only otherwise. Which of those this
    // profile is depends on its VAT registration date and prior-year turnover — facts the seed does not
    // record anywhere. Changing 'August 2026' to a quarter would invent one half of that choice; leaving
    // it is the honest state of a demo whose input fact is missing. Registered as a finding in
    // docs/ai/phases/23_provenance_hygiene.md §5.
    { id: 's1', tip: '212', perioada: '2025', depunere: 'personală', dataDepunere: '2026-05-20' },
    { id: 's3', tip: '300', perioada: '2026-08', depunere: 'personală', dataDepunere: '2026-09-15' },
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
      numarRegComert: 'J40/1234/2020',
      adresa: 'Str. Libertății 12, Cluj-Napoca',
      // A CUI in a CNP field. Nothing in src/ reads `settings.company.cnp` — `identity.cnp` is absorbed
      // from `settings.personal.cnp` — but a PFA has no legal personality separate from the person, so
      // the only CNP this block could honestly carry is the person's.
      cnp: '1234567890123',
      formaJuridica: 'Persoană fizică autorizată',
      codFiscal: 'RO4455667788990',
      codCAEN: '6201',
      regComerț: 'J40/1234/2020',
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
      dateContact: '2026-09-01',
    },
  },
  // TASK 3: the seed records no reserve. `null` is the honest state — nothing has been set aside that
  // anyone recorded — and it is what the seed dashboard renders („Nicio sumă înregistrată”). Seeding
  // `0` would assert an explicit zero the seed has no basis for, and would change the reserve figures
  // every e2e pin depends on.
  reservedAmount: null,
};
