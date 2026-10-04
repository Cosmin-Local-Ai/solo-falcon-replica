import { z } from 'zod';
import { parsePfaProfile } from '../domain/schema';
import type { PfaProfile } from '../domain/models';
import type { RuleRelease } from '../domain/fiscal/rules';
import type { TaxCalculationSnapshot } from '../domain/snapshots/types';
import type {
  BankAccount,
  Client,
  CompanyDocument,
  Declaration,
  DocTypeCode,
  DocumentItem,
  Expense,
  Revenue,
  SettingsState,
  TaxStatement,
} from './types';

/**
 * Zod schemas for the persisted application dataset (localStorage).
 *
 * Each collection schema's output type is exactly the existing domain type —
 * verified at compile time by the `Equal` assertions at the bottom of this
 * file. `parseAppData` is the single entry point used by the load path:
 * it returns a validated `PersistedAppData`, or `null` when the stored
 * payload is corrupt (bad JSON, wrong types, invalid numbers, missing
 * required collections, invalid profile / settings / snapshots).
 *
 * Optional collections (`profile`, `snapshots`, and the secondary
 * collections) are tolerated as missing — the load path backfills them.
 * `revenues` and `settings` are the required core of the dataset.
 */

const nonEmptyString = z.string().min(1);
const nonNegative = z.number().min(0);

export const revenueSchema = z.object({
  id: nonEmptyString,
  tip: z.enum(['factura', 'notafactura']),
  nr: z.string(),
  date: z.string(),
  client: z.string(),
  cui: z.string(),
  valoareFaraTva: nonNegative,
  tva: nonNegative,
  status: z.enum(['inregistrata', 'in-asteptare', 'respinsa']),
  statusDetail: z.string().optional(),
  eFacturaStatus: z.enum(['Acceptată', 'În așteptare', 'Respinsă']).optional(),
});

export const expenseSchema = z.object({
  id: nonEmptyString,
  tip: z.enum(['factura', 'bon-fiscal']),
  nr: z.string(),
  date: z.string(),
  furnizor: z.string(),
  cui: z.string(),
  valoareFaraTva: nonNegative,
  tva: nonNegative,
  status: z.enum(['inregistrata', 'respinsa']),
  statusDetail: z.string().optional(),
});

export const clientSchema = z.object({
  id: nonEmptyString,
  denumire: nonEmptyString,
  cui: z.string(),
  email: z.string().optional(),
  telefon: z.string().optional(),
  oras: z.string().optional(),
});

export const declarationSchema = z.object({
  id: nonEmptyString,
  an: z.number().int(),
  luna: z.number().int().min(1).max(12),
  venituri: nonNegative,
  cheltuieli: nonNegative,
  status: z.enum(['inregistrata', 'in-asteptare', 'transmisa', 'respinsa']),
  dataInregistrare: z.string(),
  dataTrimitere: z.string().optional(),
});

export const documentItemSchema = z.object({
  id: nonEmptyString,
  nume: nonEmptyString,
  data: z.string(),
  categoria: z.string(),
});

export const companyDocumentSchema = z.object({
  id: nonEmptyString,
  nume: nonEmptyString,
  tip: z.enum(['factura', 'notafactura', 'bon-fiscal', 'pdf', 'png', 'jpg']),
  content: z.string(),
  marime: z.number().int().min(0),
  data: z.string(),
  dataDepunere: z.string().optional(),
  depunere: z.string().optional(),
  perioada: z.string().optional(),
});

export const taxStatementSchema = z.object({
  id: nonEmptyString,
  tip: z.string(),
  perioada: z.string(),
  depunere: z.enum(['SOLO', 'personală']),
  dataDepunere: z.string().optional(),
  nume: z.string().optional(),
  content: z.string().optional(),
});

export const ruleReleaseSchema = z.object({
  releaseId: nonEmptyString,
  name: z.string(),
  jurisdiction: z.string(),
  entityType: z.string(),
  taxYear: z.number().int(),
  ruleIds: z.array(z.string()),
  status: z.enum(['SAFE_ACTIVATION', 'REVIEW_REQUIRED']),
  effectiveFrom: z.string(),
  createdAt: z.string(),
  evidence: z.array(z.string()),
  notes: z.string().optional(),
});

/** The profile field reuses the domain parser, so persisted profiles are
 *  validated exactly like domain-profile input. */
const profileSchema = z.custom<PfaProfile>((value) => parsePfaProfile(value) !== null);

export const taxCalculationSnapshotSchema = z.object({
  calculationId: nonEmptyString,
  taxYear: z.number().int(),
  calculatedAt: z.string(),
  ruleRelease: ruleReleaseSchema,
  inputSnapshot: z.object({
    profile: profileSchema,
    revenues: z.number(),
    expenses: z.number(),
  }),
  inputsHash: z.string(),
  calculationLines: z.array(z.object({ label: z.string(), value: z.number() })),
  output: z.object({ total: z.number() }),
  status: z.enum(['computed', 'superseded', 'void']),
});

const companyCaenSchema = z.object({ cod: z.string(), descriere: z.string() });

const settingsCompanySchema = z.object({
  denumire: z.string(),
  cui: z.string(),
  numarRegComert: z.string(),
  adresa: z.string(),
  codTvaIntra: z.string().optional(),
  caen: z.array(companyCaenSchema),
  mentiuniFactura: z.string().optional(),
  cnp: z.string().optional(),
  formaJuridica: z.string().optional(),
  codFiscal: z.string().optional(),
  codCAEN: z.string().optional(),
  'regComerț': z.string().optional(),
  telefon: z.string().optional(),
  email: z.string().optional(),
  contBancar: z.string().optional(),
  banca: z.string().optional(),
});

const settingsPersonalSchema = z.object({
  nume: z.string(),
  cnp: z.string(),
  adresa: z.string(),
  telefon: z.string(),
  email: z.string(),
});

const bankAccountSchema = z.object({
  id: nonEmptyString,
  banca: z.string(),
  moneda: z.string(),
});

const eFacturaSchema = z.object({
  trimitere: z.enum(['manual', 'automat']),
  dateContact: z.string(),
});

export const settingsSchema = z.object({
  cotaTva: z.number().int().min(0).max(100),
  company: settingsCompanySchema,
  personal: settingsPersonalSchema,
  bankAccounts: z.array(bankAccountSchema),
  eFactura: eFacturaSchema,
});

/**
 * The persisted (legacy-tolerant) shape of the stored dataset.
 *
 * Required: `revenues` + `settings` (the core of the dataset — a payload
 * missing them is corrupt and must recover to seed data).
 * Optional: `profile` (pre-profile-collection payloads), `snapshots`
 * (pre-snapshot-feature payloads), and the secondary collections, which the
 * load path backfills to empty values.
 */
export interface PersistedAppData {
  profile?: PfaProfile;
  revenues: Revenue[];
  expenses?: Expense[];
  clients?: Client[];
  declarations?: Declaration[];
  documents?: DocumentItem[];
  companyDocs?: Record<DocTypeCode, CompanyDocument[]>;
  statements?: TaxStatement[];
  snapshots?: TaxCalculationSnapshot[];
  settings: SettingsState;
}

export const persistedAppDataSchema = z.object({
  profile: profileSchema.optional(),
  revenues: z.array(revenueSchema),
  expenses: z.array(expenseSchema).optional(),
  clients: z.array(clientSchema).optional(),
  declarations: z.array(declarationSchema).optional(),
  documents: z.array(documentItemSchema).optional(),
  companyDocs: z
    .record(z.enum(['im', 'cs', 'tva', 'facturi']), z.array(companyDocumentSchema))
    .optional(),
  statements: z.array(taxStatementSchema).optional(),
  snapshots: z.array(taxCalculationSnapshotSchema).optional(),
  settings: settingsSchema,
});

/**
 * Parse a raw localStorage payload into a validated `PersistedAppData`.
 * Returns `null` for anything that is not a valid dataset: unparseable
 * JSON, non-object JSON, missing required collections, wrong types,
 * invalid numbers, invalid profile / settings / snapshot entries.
 */
export function parseAppData(raw: string): PersistedAppData | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = persistedAppDataSchema.safeParse(parsed);
  return result.success ? result.data : null;
}

// ---------------------------------------------------------------------------
// Compile-time guarantees: every schema output is exactly the existing
// domain type (no parallel type system).
// ---------------------------------------------------------------------------
type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

type _checks = [
  Expect<Equal<z.output<typeof revenueSchema>, Revenue>>,
  Expect<Equal<z.output<typeof expenseSchema>, Expense>>,
  Expect<Equal<z.output<typeof clientSchema>, Client>>,
  Expect<Equal<z.output<typeof declarationSchema>, Declaration>>,
  Expect<Equal<z.output<typeof documentItemSchema>, DocumentItem>>,
  Expect<Equal<z.output<typeof companyDocumentSchema>, CompanyDocument>>,
  Expect<Equal<z.output<typeof taxStatementSchema>, TaxStatement>>,
  Expect<Equal<z.output<typeof ruleReleaseSchema>, RuleRelease>>,
  Expect<Equal<z.output<typeof taxCalculationSnapshotSchema>, TaxCalculationSnapshot>>,
  Expect<Equal<z.output<typeof settingsSchema>, SettingsState>>,
  Expect<Equal<z.output<typeof persistedAppDataSchema>, PersistedAppData>>,
];
