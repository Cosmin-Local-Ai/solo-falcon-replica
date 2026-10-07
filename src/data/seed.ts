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
    pensionStatus: 'nu',
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
      denumire: 'Popescu Consulting SRL',
      cui: 'RO4455667788990',
      formaJuridica: 'SRL',
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
    { id: 'e1', tip: 'factura', nr: 'FCT-PRO-118', date: '2026-09-05', furnizor: 'CloudHost SRL', cui: 'RO87654321', valoareFaraTva: lei(120), tva: lei(25.2), status: 'inregistrata' },
    { id: 'e2', tip: 'bon-fiscal', nr: 'BF-4471', date: '2026-09-12', furnizor: 'Carrefour', cui: 'RO11223344', valoareFaraTva: lei(85.5), tva: lei(17.96), status: 'inregistrata' },
    { id: 'e3', tip: 'factura', nr: 'FCT-PRO-121', date: '2026-09-20', furnizor: 'Office Supplies SA', cui: 'RO55667788', valoareFaraTva: lei(340), tva: lei(71.4), status: 'respinsa', statusDetail: 'Document neconform' },
  ],
  clients: [
    { id: 'c1', denumire: 'Presta Consulting SRL', cui: 'RO12345678', email: 'contact@presta.ro', telefon: '0721 111 222', oras: 'București' },
    { id: 'c2', denumire: 'Andrei Popescu', cui: '1234567890123', email: 'andrei.popescu@mail.ro', telefon: '0731 333 444', oras: 'Cluj-Napoca' },
    { id: 'c3', denumire: 'Marius Ionescu', cui: '9876543210987', email: 'm.ionescu@mail.ro', telefon: '0742 555 666', oras: 'Timișoara' },
  ],
  declarations: [
    { id: 'd1', an: 2026, luna: 3, venituri: lei(12500), cheltuieli: lei(1800), status: 'transmisa', dataInregistrare: '2026-04-10', dataTrimitere: '2026-04-15' },
    { id: 'd2', an: 2026, luna: 6, venituri: lei(14200), cheltuieli: lei(2100), status: 'in-asteptare', dataInregistrare: '2026-07-08' },
    { id: 'd3', an: 2026, luna: 9, venituri: lei(9680), cheltuieli: lei(546), status: 'inregistrata', dataInregistrare: '2026-09-28' },
  ],
  documents: [
    { id: 'doc1', nume: 'FCT-2026-001.pdf', data: '2026-09-02', categoria: 'Facturi' },
    { id: 'doc2', nume: 'Declarația 220 – Q2 2026.pdf', data: '2026-07-10', categoria: 'Declarații' },
    { id: 'doc3', nume: 'Contract Presta Consulting.pdf', data: '2026-08-20', categoria: 'Contracte' },
  ],
  companyDocs: {
    im: [
      { id: 'im1', nume: 'Declarația 100 – Q2 2026.pdf', tip: 'factura', content: 'data:text/plain;base64,SW1wb3ppdCBwZSB2ZW5pdQ==', marime: 48210, data: '2026-07-05', dataDepunere: '2026-07-05', depunere: 'ANAF', perioada: 'Q2 2026' },
    ],
    cs: [
      { id: 'cs1', nume: 'Declarația 220 – Q2 2026.pdf', tip: 'factura', content: 'data:text/plain;base64,Q29udHJpYnV0aWkgc29jaWFsZQ==', marime: 51340, data: '2026-07-10', dataDepunere: '2026-07-10', depunere: 'ANAF', perioada: 'Q2 2026' },
    ],
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
    { id: 's1', tip: '100', perioada: '2026-Q2', depunere: 'SOLO', dataDepunere: '2026-07-05' },
    { id: 's2', tip: '220', perioada: '2026-Q2', depunere: 'SOLO', dataDepunere: '2026-07-10' },
    { id: 's3', tip: '300', perioada: '2026-08', depunere: 'personală', dataDepunere: '2026-09-15' },
  ],
  snapshots: [],
  settings: {
    cotaTva: 9,
    company: {
      denumire: 'Popescu Consulting SRL',
      cui: 'RO4455667788990',
      numarRegComert: 'J40/1234/2020',
      adresa: 'Str. Libertății 12, Cluj-Napoca',
      cnp: 'RO4455667788990',
      formaJuridica: 'SRL',
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
};
