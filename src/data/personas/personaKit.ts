/**
 * Step 11 / Part C — the shared builders behind the eight demo personas.
 *
 * ## What this file is for
 *
 * A persona is a whole `AppData`: twelve months of dated documents, named counterparties, declared fiscal
 * facts. Written out longhand, eight of them would be ~4,000 lines of literals in which a wrong month or a
 * mistyped VAT figure is invisible. The helpers below exist so each persona file states the **facts** —
 * who paid, when, how much, under which article — and the arithmetic that follows from a VAT-registered
 * profile is computed once, here, rather than typed eight times.
 *
 * ## What this file is NOT
 *
 * It is not a fixture factory that invents fiscal facts. Every helper takes its fiscal content as an
 * argument: the category, the income category, the tenant's legal nature, the room count. Nothing here
 * defaults a declared fact, because in this codebase absence is a third state and a default would be the
 * app answering a question the taxpayer never answered. The one computed quantity is output VAT, and it is
 * computed only from the VAT registration state the persona itself declares — see `invoice`.
 *
 * ## Identity (D-DEMO-2, B-110)
 *
 * `personaIdentity()` builds a `PfaIdentity` from a `PersonaIdentity`. The two types are deliberately
 * different: a persona's identity belongs to the **persona**, and the account's identity belongs to the
 * **account**. `applyPersonaToAccount()` is the seam between them — applying a persona to a real account
 * replaces every identity field with the person's own and keeps only the activity data. Conflating them
 * would put an invented name on a real taxpayer's Declarația Unică.
 *
 * Every identifier in the persona set is invented and **visibly** fake: CNPs carry month `00` and day `00`,
 * which no civil register contains, and every CUI fails both published control-digit keys. That is enforced
 * mechanically by `src/data/seed.identityHygiene.test.ts`, which scans all of `src/` and `e2e/`.
 */
import type {
  AppData,
  Client,
  CompanyDocument,
  Expense,
  OccupancySheet,
  OccupancyStay,
  Revenue,
  SettingsState,
} from '../types';
import { eur, lei, money, ron, type Bani, type CurrencyCode, type Money } from '../../domain/money';
import { caenByCod } from '../caenRev3';
import type {
  CaenCode,
  CassLadderYear,
  PfaIdentity,
  PfaProfile,
} from '../../domain/models';
import type { PersonaIdentity } from './personaTypes';
import type { ExpenseCategory } from '../../domain/fiscal/deductibility';
import type { DpiContractType, IncomeCategory } from '../../domain/dpi';
import type { FxRateRecord } from '../../domain/fx/rates';

/** The fiscal year every persona is authored for, and the only year this build has a rule package for. */
export const PERSONA_FISCAL_YEAR = 2026;

/** The instant every persona is authored as of — the same pinned date the whole suite uses. */
export const PERSONA_AS_OF = '2026-10-31';

/** The standard VAT rate the personas that charge VAT show on their invoices (CF art. 291 alin. (1) lit. a)). */
export const STANDARD_VAT_RATE = 0.19;

/** The money date for a persona document: money and paper move together unless the persona says otherwise. */
function moneyDate(documentDate: string, offsetDays = 0): string {
  if (offsetDays === 0) return documentDate;
  const d = new Date(`${documentDate}T00:00:00`);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/** `2026-03-14` for month 3 and day 14. One place, so no persona writes a malformed date. */
export function day(month: number, dayOfMonth: number, year = PERSONA_FISCAL_YEAR): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`;
}

/** Lei → integer bani, with the same exactness rule `lei()` enforces. */
export function leiToBani(amountInLei: number): Bani {
  return lei(amountInLei);
}

/** The currency constructor for a persona's foreign amounts. */
export function foreign(currency: CurrencyCode, amountInMajorUnits: number): Money {
  if (currency === 'RON') return ron(amountInMajorUnits);
  if (currency === 'EUR') return eur(amountInMajorUnits);
  // `money()` takes integer minor units, and `lei()` scales a major-unit amount the same way for every
  // currency — there is no per-currency constructor for USD/GBP/HUF in the money layer, and inventing one
  // here would be a second scaling rule for the same datum.
  return money(lei(amountInMajorUnits), currency);
}

/**
 * One named counterparty. `kind` is not decoration: a platform that withholds, a corporate client, a
 * natural-person tenant and a non-EU supplier are four different fiscal shapes, and the demo has to show
 * which one a row is (D-DEMO-4).
 */
export interface PartySpec {
  id: string;
  denumire: string;
  cui: string;
  email?: string;
  telefon?: string;
  oras?: string;
  /** Country, in Romanian. "România" is stated too — "domestic, in lei" is itself the point (D-DEMO-4). */
  tara: string;
  /** How often money actually moves, in the persona's own words. */
  cadenta: string;
  kind: PartyKind;
}

export type PartyKind =
  | 'client_corporate_ro'
  | 'client_corporate_foreign'
  | 'client_person_ro'
  | 'platform_withholding'
  | 'platform_intermediary'
  | 'supplier_ro'
  | 'supplier_foreign'
  | 'bank'
  | 'administrator';

/**
 * The `Client` record the register links a receipt to.
 *
 * `tara` is not a `Client` field — the stored entity has no country — so the country travels in the
 * persona's own counterparty table (`PersonaDefinition.counterparties`), where the demo can show it, and
 * the `Client` row keeps only the fields the app can actually store.
 */
export function clientRecord(spec: PartySpec): Client {
  return {
    id: spec.id,
    denumire: spec.denumire,
    cui: spec.cui,
    ...(spec.email !== undefined ? { email: spec.email } : {}),
    ...(spec.telefon !== undefined ? { telefon: spec.telefon } : {}),
    ...(spec.oras !== undefined ? { oras: spec.oras } : {}),
  };
}

/** One month of billing for one counterparty: `[month, day, netLei]`. */
export type BillingLine = readonly [month: number, dayOfMonth: number, netInMajorUnits: number];

export interface InvoiceOptions {
  /** The counterparty the row names. */
  party: PartySpec;
  /** Invoice-number prefix; the sequence number is the position in the list, zero-padded. */
  prefix: string;
  /** Whether this profile charges VAT on the invoice. Read from the persona's declared registration. */
  vat: boolean;
  /** Currency of the amounts. A foreign currency only where the activity genuinely bills in one. */
  currency?: CurrencyCode;
  /** The income category — CF art. 67 vs art. 70. Absent means the record's default, art. 67. */
  incomeCategory?: IncomeCategory;
  /** The object of the contract, for a DPI receipt (Legea 8/1996 art. 40 vs art. 47). */
  dpiContractType?: DpiContractType;
  /** Collection offset in days after the document date; `0` means money and paper move together. */
  collectOffsetDays?: number;
  /** Override the status for individual rows (the demo shows a rejected or pending row where real life does). */
  status?: (index: number) => Revenue['status'] | undefined;
  /** e-Factura status; personas that are VAT-registered show accepted rows, the rest show none. */
  eFactura?: boolean;
  /** Start the sequence after this number — how a persona splits one client's year at a registration date. */
  numberOffset?: number;
  /** A per-row note the register can carry. */
  statusDetail?: (index: number) => string | undefined;
}

/**
 * A run of invoices from one counterparty, one per month, in date order.
 *
 * Output VAT is computed, not typed: a persona that declares `vat: true` charges 19 % on every line, and a
 * persona in the art. 310 scutire shows no VAT at all. That is the only arithmetic in this file, and it is
 * arithmetic the invoice itself states.
 */
export function invoices(lines: readonly BillingLine[], opts: InvoiceOptions): Revenue[] {
  const currency = opts.currency ?? 'RON';
  return lines.map((line, index) => {
    const [month, dayOfMonth, net] = line;
    const date = day(month, dayOfMonth);
    const netMoney = foreign(currency, net);
    const vatBani = opts.vat ? lei(Math.round(net * STANDARD_VAT_RATE)) : lei(0);
    const rowStatus = opts.status?.(index);
    return {
      id: `${opts.prefix}-${index + 1 + (opts.numberOffset ?? 0)}`,
      tip: 'factura' as const,
      nr: `${opts.prefix}-${String(index + 1 + (opts.numberOffset ?? 0)).padStart(3, '0')}`,
      date,
      // A pending or rejected row has no money on it, so it carries no collection date. That absence is the
      // fact persona 8 exists to show: an invoice issued and delivered but not yet collected is a delivery
      // for Titlul II and not income for Titlul IV, and it is the missing field — not a note beside it —
      // that makes the two series diverge.
      ...(rowStatus === 'in-asteptare' || rowStatus === 'respinsa'
        ? {}
        : { collected: moneyDate(date, opts.collectOffsetDays ?? 0) }),
      client: opts.party.denumire,
      cui: opts.party.cui,
      valoareFaraTva: netMoney,
      tva: money(vatBani, currency),
      status: rowStatus ?? 'inregistrata',
      ...(rowStatus === 'respinsa' && opts.statusDetail?.(index)
        ? { statusDetail: opts.statusDetail(index) as string }
        : {}),
      ...(opts.eFactura ? { eFacturaStatus: 'Acceptată' as const } : {}),
      ...(opts.incomeCategory ? { incomeCategory: opts.incomeCategory } : {}),
      ...(opts.dpiContractType ? { dpiContractType: opts.dpiContractType } : {}),
    } satisfies Revenue;
  });
}

/** One month of purchasing for one supplier: `[month, day, netLei]`. */
export interface CostOptions {
  party: PartySpec;
  prefix: string;
  vat: boolean;
  category: ExpenseCategory;
  currency?: CurrencyCode;
  /** The car the cost belongs to, when the persona has one (D-VEH-3). */
  vehicleId?: string;
  payOffsetDays?: number;
  /** A per-row document type — a courier's fuel is often a bon fiscal, not a factură. */
  tip?: (index: number) => Expense['tip'];
  /** Start the sequence after this number. */
  numberOffset?: number;
}

export function costs(lines: readonly BillingLine[], opts: CostOptions): Expense[] {
  const currency = opts.currency ?? 'RON';
  return lines.map((line, index) => {
    const [month, dayOfMonth, net] = line;
    const date = day(month, dayOfMonth);
    const netMoney = foreign(currency, net);
    const vatBani = opts.vat ? lei(Math.round(net * STANDARD_VAT_RATE)) : lei(0);
    return {
      id: `${opts.prefix}-${index + 1 + (opts.numberOffset ?? 0)}`,
      tip: opts.tip?.(index) ?? 'factura',
      nr: `${opts.prefix}-${String(index + 1 + (opts.numberOffset ?? 0)).padStart(3, '0')}`,
      date,
      paid: moneyDate(date, opts.payOffsetDays ?? 0),
      furnizor: opts.party.denumire,
      cui: opts.party.cui,
      valoareFaraTva: netMoney,
      tva: money(vatBani, currency),
      status: 'inregistrata' as const,
      category: opts.category,
      ...(opts.vehicleId !== undefined ? { vehicleId: opts.vehicleId } : {}),
    } satisfies Expense;
  });
}

/**
 * A fixture exchange rate.
 *
 * **These numbers are invented, and the record says so in three separate fields.** A rate is a legal datum
 * (BNR's own series, with a date it anchors to), and the plain demo fixture therefore carries none at all.
 * A persona that bills in EUR or USD cannot cross a lei threshold without a conversion, so the persona set
 * supplies rates that are marked `entryMode: 'manual'`, `provisional: true` and a series code that
 * `seriesCodeStatus()` reports as **unverified**, with a source URL on an RFC-2606 reserved domain.
 *
 * The consequence is visible rather than hidden: every conversion these rates produce is labelled
 * provisional and unverified on the ledger disclosure, exactly as a hand-typed rate in a real install
 * would be. A real install fetches the BNR series and replaces them.
 */
export function fixtureRates(
  currency: 'EUR' | 'USD',
  rate: string,
  dates: readonly string[],
): FxRateRecord[] {
  return dates.map((rateDate) => fixtureRate(currency, rateDate, rate));
}

export function fixtureRate(
  currency: 'EUR' | 'USD',
  rateDate: string,
  rate: string,
): FxRateRecord {
  return {
    currency,
    rate,
    rateKind: 'daily_reference',
    rateDate,
    seriesCode: currency === 'EUR' ? 'DEMO_EUR_DAILY' : 'DEMO_USD_DAILY',
    sourceUrl: 'https://example.org/curs-valutar-de-demo',
    fetchedAt: `${PERSONA_AS_OF}T09:00:00.000Z`,
    provisional: true,
    entryMode: 'manual',
  };
}

/**
 * A CAEN Rev.3 class, resolved against the shipped nomenclator rather than typed from memory.
 *
 * The denomination is copied out of `docs/ai/data/caen_rev3.csv` at build time, so the persona's CAEN list
 * and the list the Settings type-ahead offers cannot drift, and a Rev.2 code (the plain fixture's old
 * `6201`) shows up as an empty denomination that `personas.test.ts` fails. Brief 64's whole warning about
 * CAEN codes was that they were written from memory; this is the mechanical answer to it.
 */
export function caenClass(cod: string): CaenCode {
  const entry = caenByCod(cod);
  return { cod, descriere: entry?.denumire ?? '' };
}

/** The persona's identity, as the app stores it. `caen` is positional: index 0 is the ONRC principal class. */
export function personaIdentity(id: PersonaIdentity, caen: readonly CaenCode[]): PfaIdentity {
  return {
    nume: id.nume,
    cnp: id.cnp,
    adresa: id.adresa,
    telefon: id.telefon,
    email: id.email,
    denumire: id.denumire,
    cui: id.cui,
    formaJuridica: id.formaJuridica,
    numarRegComert: id.numarRegComert,
    adresaSocietate: id.adresa,
    telefonSocietate: id.telefon,
    emailSocietate: id.email,
    contBancar: id.contBancar,
    banca: id.banca,
    ...(id.codTvaIntra !== undefined ? { codTvaIntra: id.codTvaIntra } : {}),
    caen: [...caen],
    mentiuniFactura: 'Date de demonstratie — profil inventat, nu un contribuabil real.',
  };
}

/**
 * The legacy `settings` block, mirrored from the profile identity.
 *
 * It is mirrored rather than left empty because `legacyProfileFromSettings` absorbs from it, and a payload
 * whose two blocks disagree is the contradiction Phase 7 removed from the plain fixture. `codCAEN` carries
 * the **Rev.3** principal class — the plain fixture's `6201` was a Rev.2 code and is not offered by the
 * app's own type-ahead.
 */
export function personaSettings(id: PersonaIdentity, caen: readonly CaenCode[]): SettingsState {
  return {
    cotaTva: 9,
    company: {
      denumire: id.denumire,
      cui: id.cui,
      numarRegComert: id.numarRegComert,
      adresa: id.adresa,
      cnp: id.cnp,
      formaJuridica: id.formaJuridica,
      codFiscal: id.cui,
      codCAEN: caen[0]?.cod ?? '',
      regComerț: id.numarRegComert,
      telefon: id.telefon,
      email: id.email,
      contBancar: id.contBancar,
      banca: id.banca,
      caen: caen.map((c) => ({ cod: c.cod, descriere: c.descriere })),
    },
    personal: {
      nume: id.nume,
      cnp: id.cnp,
      adresa: id.adresa,
      telefon: id.telefon,
      email: id.email,
    },
    bankAccounts: [{ id: 'ba-1', banca: id.banca, moneda: 'RON' }],
    eFactura: { trimitere: 'manual', dateContact: `${PERSONA_FISCAL_YEAR}-01-10` },
  };
}

export type PersonaProfileParts = Partial<Omit<PfaProfile, 'id' | 'identity' | 'updatedAt'>>;

/**
 * The profile every persona starts from: a 2026-start PFA în sistem real, with the facts that are the same
 * for all eight stated once. Everything that differs — activity family, VAT registration, the ladder, the
 * lease facts, the room counts — comes in through `parts`, and nothing here supplies a fiscal answer a
 * persona has not given.
 */
export function personaProfile(
  id: string,
  identity: PersonaIdentity,
  caen: readonly CaenCode[],
  parts: PersonaProfileParts,
): PfaProfile {
  return {
    id,
    pfaStartYear: parts.pfaStartYear ?? PERSONA_FISCAL_YEAR,
    pfaStartDate: parts.pfaStartDate ?? `${PERSONA_FISCAL_YEAR}-01-10`,
    fiscalYear: PERSONA_FISCAL_YEAR,
    regime: parts.regime ?? 'impozit_pe_venit',
    salaryStatus: parts.salaryStatus ?? 'nu',
    ...(parts.salaryIncomeLei !== undefined ? { salaryIncomeLei: parts.salaryIncomeLei } : {}),
    pensionerStatus: parts.pensionerStatus ?? 'nu',
    ...(parts.pensionReceiptYears !== undefined ? { pensionReceiptYears: parts.pensionReceiptYears } : {}),
    ...(parts.cassLadderYears !== undefined ? { cassLadderYears: parts.cassLadderYears } : {}),
    ...(parts.activityFamily !== undefined ? { activityFamily: parts.activityFamily } : {}),
    ...(parts.accommodationRoomCounts !== undefined
      ? { accommodationRoomCounts: parts.accommodationRoomCounts }
      : {}),
    ...(parts.accommodationCommissionReading !== undefined
      ? { accommodationCommissionReading: parts.accommodationCommissionReading }
      : {}),
    ...(parts.accommodationTourismEligibility !== undefined
      ? { accommodationTourismEligibility: parts.accommodationTourismEligibility }
      : {}),
    ...(parts.leaseFactsYears !== undefined ? { leaseFactsYears: parts.leaseFactsYears } : {}),
    socialInsuranceStatus: parts.socialInsuranceStatus ?? 'obligatoriu',
    ...(parts.vatRegistration !== undefined ? { vatRegistration: parts.vatRegistration } : {}),
    ...(parts.vatPeriodicityYears !== undefined ? { vatPeriodicityYears: parts.vatPeriodicityYears } : {}),
    ...(parts.vatExceedanceDate !== undefined ? { vatExceedanceDate: parts.vatExceedanceDate } : {}),
    cashFloorLei: parts.cashFloorLei ?? lei(0),
    identity: personaIdentity(identity, caen),
    updatedAt: `${PERSONA_AS_OF}T09:00:00.000Z`,
  };
}

/**
 * The dataset shell. Collections that a persona does not declare are **empty, not absent**, because a
 * persona is a whole stored dataset; the fiscal meaning of "this persona has no car" is carried by the
 * persona's own vehicle list being empty and by the register naming no `vehicleId`.
 *
 * `filings`, `vatReturns` and `snapshots` are empty for every persona and that is deliberate: the FY2026
 * Declarația Unică is due 25 May 2027 and has not been filed at the persona's own date, and PG-6g's rule
 * that a fixture must not mint a filed decont still holds (B-96's cadence fix is the registration facts,
 * not a seeded return).
 */
export function personaDataset(profile: PfaProfile, parts: {
  revenues?: Revenue[];
  expenses?: Expense[];
  clients?: PartySpec[];
  occupancySheets?: OccupancySheet[];
  vehicles?: AppData['vehicles'];
  fixedAssets?: AppData['fixedAssets'];
  documents?: AppData['documents'];
  companyDocs?: Partial<AppData['companyDocs']>;
  fxRates?: FxRateRecord[];
  reservedAmount?: Bani | null;
}): AppData {
  return {
    profile,
    revenues: parts.revenues ?? [],
    expenses: parts.expenses ?? [],
    clients: (parts.clients ?? []).map(clientRecord),
    filings: [],
    vatReturns: [],
    occupancySheets: parts.occupancySheets ?? [],
    vehicles: parts.vehicles ?? [],
    fixedAssets: parts.fixedAssets ?? [],
    documents: parts.documents ?? [],
    companyDocs: {
      im: [],
      cs: [],
      tva: [],
      facturi: parts.companyDocs?.facturi ?? [],
    },
    statements: [],
    snapshots: [],
    settings: personaSettings(profile.identity as PersonaIdentity, profile.identity.caen ?? []),
    reservedAmount: parts.reservedAmount ?? null,
    ...(parts.fxRates !== undefined ? { fxRates: parts.fxRates } : {}),
  };
}

/** A retained document row, so the register is not the only place a persona's paper exists. */
export function docRow(id: string, nume: string, data: string, categoria: string): AppData['documents'][number] {
  return { id, nume, data, categoria };
}

export function invoiceDoc(id: string, nume: string, data: string): CompanyDocument {
  return {
    id,
    nume,
    tip: 'factura',
    content: `data:text/plain;base64,${btoa(nume)}`,
    marime: 8_000 + nume.length * 10,
    data,
  };
}

/**
 * A synthetic occupancy stay.
 *
 * D-OCC-1 item 5 forbids guest data in a fixture that leaves the machine, and a persona ships inside the
 * bundle — so **no persona dataset carries a stay**. The host persona's e2e spec adds one through the UI,
 * from `src/test/occupancyFixtures.ts`, where the identity is explicitly synthetic. This helper exists so
 * that spec builds the stay through the same shape the store writes.
 */
export function syntheticStay(stay: Omit<OccupancyStay, 'id'> & { id: string }): OccupancyStay {
  return { ...stay };
}

/** A declared ladder year, with only the categories the persona actually states. */
export function ladderYear(facts: CassLadderYear): CassLadderYear {
  return { ...facts };
}
