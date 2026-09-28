import type { Revenue, Expense, Client, Declaration, Document } from './types';

export const seedClients: Client[] = [
  { id: 'c1', denumire: 'SC VETRA SRL', cui: 'RO12345678', email: 'contact@vetra.ro', telefon: '0721 111 222', oras: 'Cluj-Napoca' },
  { id: 'c2', denumire: 'IONEL POPESCU (PFA)', cui: 'RO987654321', email: 'ionel.popescu@gmail.com', telefon: '0733 555 666', oras: 'Timișoara' },
  { id: 'c3', denumire: 'SC LOGICOM SRL', cui: 'RO45678912', email: 'office@logicom.ro', telefon: '0744 222 333', oras: 'București' },
  { id: 'c4', denumire: 'ANA MARIN (PFA)', cui: 'RO321654987', email: 'ana.marin@outlook.com', telefon: '0755 999 888', oras: 'Iași' },
];

export const seedRevenues: Revenue[] = [
  { id: 'r1', tip: 'factura', nr: 'FCT-2025-0042', date: '2025-09-02', client: 'SC VETRA SRL', cui: 'RO12345678', valoareFaraTva: 4500, tva: 990, status: 'inregistrata', eFacturaStatus: 'Acceptată' },
  { id: 'r2', tip: 'factura', nr: 'FCT-2025-0043', date: '2025-09-10', client: 'IONEL POPESCU (PFA)', cui: 'RO987654321', valoareFaraTva: 1200, tva: 264, status: 'inregistrata', eFacturaStatus: 'Acceptată' },
  { id: 'r3', tip: 'notafactura', nr: 'NF-2025-0011', date: '2025-09-18', client: 'SC LOGICOM SRL', cui: 'RO45678912', valoareFaraTva: 7800, tva: 1716, status: 'in-asteptare', eFacturaStatus: 'În așteptare' },
  { id: 'r4', tip: 'factura', nr: 'FCT-2025-0044', date: '2025-09-25', client: 'ANA MARIN (PFA)', cui: 'RO321654987', valoareFaraTva: 950, tva: 209, status: 'in-asteptare', eFacturaStatus: 'În așteptare' },
  { id: 'r5', tip: 'factura', nr: 'FCT-2025-0041', date: '2025-08-28', client: 'SC VETRA SRL', cui: 'RO12345678', valoareFaraTva: 3200, tva: 704, status: 'respinsa', statusDetail: 'CUI client nevalidat la ANAF', eFacturaStatus: 'Respinsă' },
  { id: 'r6', tip: 'notafactura', nr: 'NF-2025-0010', date: '2025-08-14', client: 'SC LOGICOM SRL', cui: 'RO45678912', valoareFaraTva: 5400, tva: 1188, status: 'inregistrata', eFacturaStatus: 'Acceptată' },
  { id: 'r7', tip: 'factura', nr: 'FCT-2025-0040', date: '2025-07-30', client: 'IONEL POPESCU (PFA)', cui: 'RO987654321', valoareFaraTva: 2100, tva: 462, status: 'inregistrata', eFacturaStatus: 'Acceptată' },
  { id: 'r8', tip: 'factura', nr: 'FCT-2025-0039', date: '2025-07-12', client: 'ANA MARIN (PFA)', cui: 'RO321654987', valoareFaraTva: 1500, tva: 330, status: 'respinsa', statusDetail: 'Scanare neclară — reîncarcă documentul', eFacturaStatus: 'Respinsă' },
];

export const seedExpenses: Expense[] = [
  { id: 'e1', tip: 'factura', nr: 'FCT-09-112043', date: '2025-09-05', furnizor: 'SC ENERGIA DISTRIBUTIE SA', cui: 'RO10102030', valoareFaraTva: 312.4, tva: 68.73, status: 'inregistrata' },
  { id: 'e2', tip: 'bon-fiscal', nr: 'BF-09-5521', date: '2025-09-12', furnizor: 'SC PETROM AFER TITAN SA', cui: 'RO10102031', valoareFaraTva: 245.8, tva: 54.08, status: 'inregistrata' },
  { id: 'e3', tip: 'factura', nr: 'FCT-09-8812', date: '2025-09-20', furnizor: 'SC ORANGE ROMANIA SA', cui: 'RO10102032', valoareFaraTva: 189.99, tva: 41.8, status: 'inregistrata' },
  { id: 'e4', tip: 'bon-fiscal', nr: 'BF-08-3310', date: '2025-08-22', furnizor: 'SC CARREFOUR ROMANIA SA', cui: 'RO10102033', valoareFaraTva: 86.5, tva: 19.03, status: 'respinsa', statusDetail: 'Bon fiscal fără mențiunea CUI' },
  { id: 'e5', tip: 'factura', nr: 'FCT-08-4471', date: '2025-08-08', furnizor: 'SC DP WORLD SHIPPING RO SA', cui: 'RO10102034', valoareFaraTva: 540, tva: 118.8, status: 'inregistrata' },
  { id: 'e6', tip: 'bon-fiscal', nr: 'BF-07-1180', date: '2025-07-15', furnizor: 'SC ROMPETROL SA', cui: 'RO10102035', valoareFaraTva: 310.2, tva: 68.24, status: 'inregistrata' },
];

export const seedDeclarations: Declaration[] = [
  { id: 'd1', an: 2025, luna: 9, venituri: 15510, cheltuieli: 1384.93, status: 'in-asteptare', dataInregistrare: '2025-10-03' },
  { id: 'd2', an: 2025, luna: 8, venituri: 10212, cheltuieli: 956.7, status: 'transmisa', dataInregistrare: '2025-09-04', dataTrimitere: '2025-09-05' },
  { id: 'd3', an: 2025, luna: 7, venituri: 7722, cheltuieli: 968.44, status: 'transmisa', dataInregistrare: '2025-08-04', dataTrimitere: '2025-08-06' },
  { id: 'd4', an: 2025, luna: 6, venituri: 6100, cheltuieli: 1204.1, status: 'respinsa', dataInregistrare: '2025-07-05', dataTrimitere: '2025-07-07' },
];

export const seedDocuments: Document[] = [
  { id: 'doc1', nume: 'FCT-2025-0042.pdf', tip: 'pdf', marime: '214 KB', data: '2025-09-02', categoria: 'Venituri' },
  { id: 'doc2', nume: 'FCT-2025-0043.pdf', tip: 'pdf', marime: '198 KB', data: '2025-09-10', categoria: 'Venituri' },
  { id: 'doc3', nume: 'NF-2025-0011.pdf', tip: 'pdf', marime: '242 KB', data: '2025-09-18', categoria: 'Venituri' },
  { id: 'doc4', nume: 'FCT-09-112043.pdf', tip: 'pdf', marime: '187 KB', data: '2025-09-05', categoria: 'Cheltuieli' },
  { id: 'doc5', nume: 'BF-09-5521.jpg', tip: 'jpg', marime: '1.2 MB', data: '2025-09-12', categoria: 'Cheltuieli' },
  { id: 'doc6', nume: 'evidenta-2025.xlsx', tip: 'xlsx', marime: '48 KB', data: '2025-09-28', categoria: 'Raport' },
];
