import { z } from 'zod';
import { isoCalendarDateProblem } from '../domain/date';
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
  // Phase 9: the fiscal date for a revenue is the date it was COLLECTED (CF art. 68 alin. (2) lit. a).
  // Optional — a legacy payload has only `date`, and no migration invents this value.
  collected: z.string().optional(),
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
  // Phase 9: the fiscal date for an expense is the date it was PAID (CF art. 68 alin. (4) lit. b).
  // Optional — a legacy payload has only `date`, and no migration invents this value.
  paid: z.string().optional(),
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
  // Phase 7: the digest carried before a data migration rewrote the embedded
  // profile. Optional, so snapshots written before AND after Phase 7 both parse.
  preMigrationInputsHash: z.string().optional(),
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
 *
 * `version` is optional and its ABSENCE is meaningful: a payload with no
 * `version` key is the base of the migration chain (version 0), i.e. a payload
 * written before Phase 7 introduced versioning. It is deliberately not given a
 * zod `.default()`, so the migration can tell "absent" from "explicitly 0" —
 * both map to the same chain entry, and neither is a guess.
 */
export interface PersistedAppData {
  version?: number;
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
  // Absent === DATA_VERSION_BASE (see PersistedAppData above). A version higher
  // than the chain's current version is rejected by the load path, not guessed
  // at — see `readStoredVersion` in data/migration.ts.
  version: z.number().int().min(0).optional(),
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
 *
 * `parseAppDataResult` is the form the load path uses — it keeps WHY the payload
 * was rejected so the quarantine record (D-3) can carry a real reason instead of
 * "something was wrong". This wrapper stays because it is the shape the schema
 * tests and callers already use.
 */
export type ParseAppDataResult =
  | { ok: true; data: PersistedAppData }
  | { ok: false; reason: 'unparseable-json' | 'schema-invalid'; detail: string };

export function parseAppDataResult(raw: string): ParseAppDataResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      ok: false,
      reason: 'unparseable-json',
      detail: err instanceof Error ? err.message : String(err),
    };
  }
  const result = persistedAppDataSchema.safeParse(parsed);
  if (result.success) return { ok: true, data: result.data };
  // Bounded on purpose: a payload that fails everywhere would otherwise produce
  // an unreadable wall of text in the banner and in localStorage.
  const detail = result.error.issues
    .slice(0, 12)
    .map(issue => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
  return { ok: false, reason: 'schema-invalid', detail };
}

export function parseAppData(raw: string): PersistedAppData | null {
  const result = parseAppDataResult(raw);
  return result.ok ? result.data : null;
}

// ---------------------------------------------------------------------------
// B-21 — the WRITE-path date validator. This is the schema boundary for input that
// is about to be stored; it is deliberately NOT wired into `persistedAppDataSchema`.
//
// Why not: `persistedAppDataSchema` is the LOAD gate, and its failure mode is
// `store.tsx` → `rejected()` → quarantine the payload and hand back `seedData`. Adding a
// date-shape rule there would mean one legacy record with a bad date destroys every other
// record in the dataset — mass silent data loss, the opposite of what B-21 asks for. The
// precedent is already written down at `domain/schema.ts:43-49`: format validation is kept
// out of the persisted gate precisely because it would itself be a data-loss event.
// So NEW input is refused here, loudly; values ALREADY persisted are reported by
// `domain/aggregation.ts` → `auditFiscalDates` as `review_required`, never rewritten.
// ---------------------------------------------------------------------------

export type RecordKind = 'revenue' | 'expense' | 'declaration' | 'companyDocument' | 'statement';

interface DateFieldSpec {
  /** Property name on the record. */
  field: string;
  /** Romanian label, for the message the user sees. */
  label: string;
  /** Absent/undefined is acceptable only when this is false. */
  required: boolean;
}

export interface DateFieldViolation {
  field: string;
  label: string;
  value: string;
  /** Problem code from `domain/date.ts` (`missing`, `not zero-padded`, …). */
  reason: string;
}

/**
 * Every date field a stored record carries, per record kind.
 *
 * `CompanyDocument.perioada` and `TaxStatement.perioada` are deliberately ABSENT: they are
 * free text the user types (`'Q2 2026'`, `'2026-Q2'`), not calendar dates, and validating
 * them as dates would reject data the app is meant to keep. `DocumentItem.data` is written
 * only from `todayISO()`, never from a user field, so it cannot carry a malformed value.
 */
const RECORD_DATE_FIELDS: Record<RecordKind, readonly DateFieldSpec[]> = {
  revenue: [
    { field: 'date', label: 'data', required: true },
    { field: 'collected', label: 'data încasării', required: false },
  ],
  expense: [
    { field: 'date', label: 'data', required: true },
    { field: 'paid', label: 'data plății', required: false },
  ],
  declaration: [
    { field: 'dataInregistrare', label: 'data înregistrării', required: true },
    { field: 'dataTrimitere', label: 'data trimiterii', required: false },
  ],
  companyDocument: [
    { field: 'data', label: 'data', required: true },
    { field: 'dataDepunere', label: 'data depunerii', required: false },
  ],
  statement: [{ field: 'dataDepunere', label: 'data depunerii', required: false }],
};

/**
 * Anything this app can write that carries a date field. A union of the real record types
 * (plus their pre-id shapes) rather than a loose bag, so a call site cannot pass the wrong
 * record for the kind it names.
 */
export type DateBearingRecord =
  | Revenue
  | Omit<Revenue, 'id'>
  | Expense
  | Omit<Expense, 'id'>
  | Declaration
  | Omit<Declaration, 'id'>
  | CompanyDocument
  | Omit<CompanyDocument, 'id'>
  | TaxStatement
  | Omit<TaxStatement, 'id'>;

/**
 * The date fields of `record` that are not usable ISO calendar dates. Empty array = acceptable.
 * Fields are read structurally because callers hold both `Omit<T,'id'>` and `T`; the kind selects
 * which fields exist, so the only cast is the one from a real record type to a property bag.
 */
export function validateRecordDates(kind: RecordKind, record: DateBearingRecord): DateFieldViolation[] {
  const source = record as Record<string, unknown>;
  const violations: DateFieldViolation[] = [];
  for (const spec of RECORD_DATE_FIELDS[kind]) {
    const raw = source[spec.field];
    if (raw === undefined || raw === null) {
      if (spec.required) violations.push({ field: spec.field, label: spec.label, value: '', reason: 'missing' });
      continue;
    }
    if (typeof raw !== 'string') {
      violations.push({ field: spec.field, label: spec.label, value: String(raw), reason: 'not a string' });
      continue;
    }
    const problem = isoCalendarDateProblem(raw);
    if (problem !== null) violations.push({ field: spec.field, label: spec.label, value: raw, reason: problem });
  }
  return violations;
}

// ---------------------------------------------------------------------------
// Compile-time guarantees: every schema output is exactly the existing
// domain type (no parallel type system).
// ---------------------------------------------------------------------------
type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

// Exported so the assertion is a live part of the module (an unexported type
// alias is reported as unused); it still exists only to fail the build on drift.
export type _checks = [
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
