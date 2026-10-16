/**
 * CAEN Rev.3 — the official classification, loaded as application reference data.
 *
 * ## ⛔ Read this before wiring CAEN into any calculation
 *
 * **HG 656/1997 art. 4 alin. (1): „încadrarea activităților … nu presupune crearea de
 * drepturi sau obligații".** A CAEN code is a statistical label the state puts on an
 * activity. It is **not** a tax fact and it must not become one: nothing in this module may
 * be read by a calculator, a ladder, a rate or a deadline. The classification may *suggest*
 * a demo persona or *prompt* a question — it may never *set* a fiscal outcome. The only
 * places a CAEN code is operative in law are the texts that name it explicitly (Codul fiscal
 * art. 68 alin. (5) lit. r) names 9311/9312/9313; the Normele metodologice pct. 3 list names
 * the art. 60 pct. 4 scutire; ONRC runs its authorisation regime on it). Everywhere else it
 * is decoration. `docs/ai/research/51_caen_rev3_and_cash_basis_fy2026.md` re-tested the
 * "CAEN tells you the taxpayer type" claim and it does not hold.
 *
 * ## Where the data comes from
 *
 * The rows are **not** hand-typed and are **not** a curated subset. They are parsed at
 * module load from `docs/ai/data/caen_rev3.csv`, which is the generated output of
 * `docs/ai/data/ingest_caen_rev3.py` — a deterministic, idempotent pipeline that starts
 * from a verbatim paste of the official table in **Ordinul președintelui INS nr. 377/2024,
 * MO I 385/25.04.2024** and applies a recorded correction table. Read
 * `docs/ai/data/CAEN_REV3_PROVENANCE.md` before touching any of it.
 *
 * The app imports that one file rather than keeping a copy of its own, so the nomenclator
 * the user sees and the nomenclator the ingest script verifies cannot drift apart. If the
 * counts asserted in `caenRev3.test.ts` ever disagree with the numbers below, the dataset
 * changed — fix the dataset, do not edit the test.
 *
 * ## Why Rev.2 lists are a live trap
 *
 * Rev.3 **adds `5540` „Intermedieri pentru servicii de cazare"** and **dissolved Rev.2's
 * division `45`** (auto trade and repair) into `467` / `478` / `953`, and `04` into `07`.
 * A code copied from a Rev.2 source is silently wrong, and `6201` — the code this app's own
 * seed used until step 11 — is one of them: it does not exist in Rev.3, whose IT class is
 * `6210`. That is why `caenClassProblem()` below is a hard gate rather than a warning.
 */

import caenRev3Csv from '../../docs/ai/data/caen_rev3.csv?raw';

/** The three coded levels the CSV carries. A secțiune is a letter, not a code. */
export type CaenLevel = 'diviziune' | 'grupa' | 'clasa';

export interface CaenEntry {
  /** The code as printed in MO 385: 2 digits (diviziune), 3 (grupa), 4 (clasă). */
  readonly cod: string;
  readonly nivel: CaenLevel;
  /** Parent code: a clasă points at its grupa, a grupa at its diviziune, a diviziune at nothing. */
  readonly parinte: string;
  /** The secțiune letter, A–V. Present on every row, which is what makes the fourth level linkable. */
  readonly sectiune: string;
  /** The official Romanian denomination, comma-below `ș ț` throughout. */
  readonly denumire: string;
}

/**
 * The version marker. It ships with the data and is rendered in the UI, because "CAEN"
 * without a revision is not a citation — Rev.2 and Rev.3 share most codes and differ in the
 * ones that matter here.
 *
 * The brief suggested ONRC's `n_versiune_caen.csv` string `3^Versiunea 2025` for this. That
 * file was **never retrieved** (`CAEN_REV3_PROVENANCE.md` → „Not obtained"), so the marker
 * states the revision and the in-force date from the primary act we actually hold, instead
 * of quoting a file this repo does not have.
 */
export const CAEN_NOMENCLATOR_VERSION = {
  rev: 3,
  denumire: 'CAEN Rev.3',
  act: 'Ordinul președintelui INS nr. 377/2024',
  monitor: 'MO I 385/25.04.2024',
  inVigoareDeLa: '2025-01-01',
  /** What the user is entitled to know before trusting a code picked from the list. */
  atribuire:
    'Clasificare INS — Ordinul președintelui INS nr. 377/2024, MO I 385/25.04.2024, în vigoare de la 1 ianuarie 2025.',
  sourceFile: 'docs/ai/data/caen_rev3.csv',
} as const;

/** The counts the ingest script enforces. Asserted again in `caenRev3.test.ts`. */
export const CAEN_NOMENCLATOR_EXPECTED_COUNTS = {
  sectiuni: 22,
  diviziuni: 87,
  grupe: 287,
  clase: 651,
} as const;

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * The CSV is flat: one record per line, no embedded newlines (verified by the row count),
 * and only `denumire` is ever quoted, because it can hold a comma. That is a narrower job
 * than a general CSV reader, so the parser is written out rather than pulled in — a
 * dependency here would be a way for the nomenclator to change shape silently.
 */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (ch === ',' && !quoted) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

const LEVELS: readonly CaenLevel[] = ['diviziune', 'grupa', 'clasa'];

/** The code length that defines the level: 2 / 3 / 4 digits. */
const LEVEL_CODE_LENGTH: Record<CaenLevel, number> = { diviziune: 2, grupa: 3, clasa: 4 };

/**
 * Romanian for a level, for anything a person reads.
 *
 * The CSV's `nivel` column stores the parser's ASCII token — `grupa`, `clasa` — because a
 * data file should not depend on an encoding. Shown to a user those tokens are misspelled
 * Romanian, and a form that misspells the word it is explaining loses the argument.
 */
export const CAEN_LEVEL_LABELS: Record<CaenLevel, string> = {
  diviziune: 'diviziune',
  grupa: 'grupă',
  clasa: 'clasă',
};

function parseCaenCsv(csv: string): CaenEntry[] {
  // The ingest writes with Python's `csv` module, which emits CRLF, and a file read through
  // Vite can carry a BOM. Normalising here rather than at the call site is what keeps a
  // stray `\r` from ending up inside a denomination the user reads on screen.
  const lines = csv.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  const header = lines[0];
  if (header !== 'cod,nivel,parinte,sectiune,denumire') {
    // A header that moved means the ingest changed shape. Refusing beats parsing the wrong
    // column as a denomination and shipping it to users.
    throw new Error(`caen_rev3.csv: unexpected header: ${header}`);
  }
  const entries: CaenEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line === '') continue;
    const [cod, nivel, parinte, sectiune, ...rest] = splitCsvLine(line);
    if (!LEVELS.includes(nivel as CaenLevel)) {
      throw new Error(`caen_rev3.csv line ${i + 1}: unknown nivel ${JSON.stringify(nivel)}`);
    }
    if (cod.length !== LEVEL_CODE_LENGTH[nivel as CaenLevel]) {
      // diviziune = 2 chars, grupa = 3, clasa = 4. The code length IS the level; if those
      // ever disagree the dataset is internally inconsistent.
      throw new Error(`caen_rev3.csv line ${i + 1}: cod ${cod} does not match nivel ${nivel}`);
    }
    entries.push({
      cod,
      nivel: nivel as CaenLevel,
      parinte,
      sectiune,
      denumire: rest.join(','),
    });
  }
  return entries;
}

/** Every entry in MO 385's table: 87 diviziuni + 287 grupe + 651 clase = 1.025 rows. */
export const CAEN_ENTRIES: readonly CaenEntry[] = parseCaenCsv(caenRev3Csv);

const BY_COD = new Map<string, CaenEntry>(CAEN_ENTRIES.map((e) => [e.cod, e]));

/** Counts measured from the loaded data, not restated from the doc. */
export const CAEN_NOMENCLATOR_COUNTS = {
  sectiuni: new Set(CAEN_ENTRIES.map((e) => e.sectiune)).size,
  diviziuni: CAEN_ENTRIES.filter((e) => e.nivel === 'diviziune').length,
  grupe: CAEN_ENTRIES.filter((e) => e.nivel === 'grupa').length,
  clase: CAEN_ENTRIES.filter((e) => e.nivel === 'clasa').length,
};

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

export function caenByCod(cod: string): CaenEntry | undefined {
  return BY_COD.get(cod.trim());
}

export interface CaenLineage {
  readonly entry: CaenEntry;
  readonly diviziune?: CaenEntry;
  readonly grupa?: CaenEntry;
}

/**
 * What a class sits under. A user who types `47` and lands on `4791` is shown the diviziune
 * and the grupa, because a four-digit code with no parent is a number, not an activity.
 */
export function caenLineage(cod: string): CaenLineage | undefined {
  const entry = caenByCod(cod);
  if (!entry) return undefined;
  const grupa = entry.cod.length === 4 ? BY_COD.get(entry.cod.slice(0, 3)) : undefined;
  const diviziune = BY_COD.get(entry.cod.slice(0, 2));
  return { entry, ...(grupa ? { grupa } : {}), ...(diviziune ? { diviziune } : {}) };
}

/** The row label the type-ahead and the saved list both use: `4791 — Intermedieri …`. */
export function caenLabel(entry: CaenEntry): string {
  return `${entry.cod} — ${entry.denumire}`;
}

/** The context line under a row: `Secțiunea G · 47 Comerț cu ridicata … › 479 Comerț cu amănuntul …`. */
export function caenLineageLabel(cod: string): string {
  const lineage = caenLineage(cod);
  if (!lineage) return '';
  const parts: string[] = [`Secțiunea ${lineage.entry.sectiune}`];
  if (lineage.diviziune) parts.push(`${lineage.diviziune.cod} ${lineage.diviziune.denumire}`);
  if (lineage.grupa) parts.push(`${lineage.grupa.cod} ${lineage.grupa.denumire}`);
  return parts.join(' › ');
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

const DIACRITICS: ReadonlyMap<string, string> = new Map(
  Object.entries({
    ă: 'a', Ă: 'a', â: 'a', Â: 'a',
    î: 'i', Î: 'i',
    ș: 's', Ş: 's', ş: 's',
    ț: 't', Ț: 't', ţ: 't',
  }),
);

/**
 * Fold case and diacritics for MATCHING only — never for display.
 *
 * The official PDF mixes comma-above `ş ţ` with comma-below `ș ț`, and the ingest normalises
 * to comma-below. A person typing on a plain keyboard writes `comert`, `programare`,
 * `cazare`. If the search compared the stored diacritics to what they typed, the type-ahead
 * would fail on the very word printed on the row above it.
 */
export function foldCaenText(text: string): string {
  let out = '';
  for (const ch of text) {
    out += DIACRITICS.get(ch) ?? ch;
  }
  return out.toLowerCase();
}

/**
 * A row in the type-ahead.
 *
 * **Only a `clasă` can be picked.** CAEN Rev.3 has exactly four levels — secțiune
 * (letter), diviziune (2), grupa (3), clasă (4) — there is no 5–6 digit sub-class,
 * and registration is always at the 4-digit class. A diviziune or grupa appears in
 * the list only as a **header the class sits under**, never as something to select.
 */
export interface CaenMatch {
  readonly entry: CaenEntry;
  readonly selectable: boolean;
  /** True when the row matched the query itself; false when it is shown as context. */
  readonly direct: boolean;
}

function scoreEntry(entry: CaenEntry, query: string, codeQuery: boolean, folded: string): number {
  let score = 0;
  if (codeQuery) {
    if (entry.cod === query) score = 1000;
    else if (entry.cod.startsWith(query)) score = 900 - (entry.cod.length - query.length);
    else if (entry.cod.includes(query)) score = 500;
  }
  if (score === 0) {
    const name = foldCaenText(entry.denumire);
    if (name.startsWith(folded)) score = 400;
    else if (new RegExp(`(^|[\s(,;./-])${escapeRegExp(folded)}`).test(name)) score = 300;
    else if (name.includes(folded)) score = 200;
  }
  if (score > 0 && codeQuery && entry.cod.startsWith(query)) score += 50;
  return score;
}

/**
 * Search the nomenclator on **code AND description**, at every level.
 *
 * `47` works on a partial code, `4791` on an exact one, and `programare` / `cazare` /
 * `intermedieri` on a phrase — including typed without diacritics. The phrase case is the
 * one that forces the two-tier result: **no CAEN Rev.3 *clasă* contains the word
 * „programare“** — it is in the name of diviziunea `62` and grupa `621`. A class-only
 * search would answer a perfectly ordinary question with an empty list, so a match at a
 * higher level expands into the classes under it instead of disappearing.
 */
export function searchCaen(query: string, limit = 12): CaenMatch[] {
  const q = query.trim();
  if (q === '') return [];
  const codeQuery = /^\d+$/.test(q);
  const folded = foldCaenText(q);

  const directClase: CaenEntry[] = [];
  const directParents: CaenEntry[] = [];
  for (const entry of CAEN_ENTRIES) {
    const score = scoreEntry(entry, q, codeQuery, folded);
    if (score === 0) continue;
    (entry.nivel === 'clasa' ? directClase : directParents).push(entry);
  }

  // Rank: best match first, and a shorter code first inside one grupa so `4711` precedes `4791`.
  const byScore = (a: CaenEntry, b: CaenEntry) =>
    scoreEntry(b, q, codeQuery, folded) - scoreEntry(a, q, codeQuery, folded) ||
    a.cod.localeCompare(b.cod);
  directClase.sort(byScore);
  directParents.sort(byScore);

  if (directClase.length > 0) {
    return directClase.slice(0, limit).map((entry) => ({ entry, selectable: true, direct: true }));
  }

  // Nothing matched a class: show the matching diviziuni/grupe as headers and expand them.
  // Grupa first, because it is nearer to a class and expands to fewer rows.
  directParents.sort(
    (a, b) =>
      (a.nivel === 'grupa' ? 0 : 1) - (b.nivel === 'grupa' ? 0 : 1) ||
      a.cod.localeCompare(b.cod),
  );

  const rows: CaenMatch[] = [];
  const emitted = new Set<string>();
  for (const parent of directParents) {
    if (rows.length >= limit) break;
    const children = CAEN_ENTRIES.filter(
      (e) => e.nivel === 'clasa' && e.cod.startsWith(parent.cod) && !emitted.has(e.cod),
    ).slice(0, Math.max(1, Math.min(4, limit - rows.length - 1)));
    if (children.length === 0) continue;
    rows.push({ entry: parent, selectable: false, direct: true });
    for (const child of children) {
      emitted.add(child.cod);
      rows.push({ entry: child, selectable: true, direct: false });
    }
  }
  return rows.slice(0, limit * 2);
}

/** Classes only, in the order the search would show them. Used by tests and by persona tooling. */
export function searchCaenClasses(query: string, limit = 12): CaenEntry[] {
  return searchCaen(query, limit)
    .filter((m) => m.selectable)
    .map((m) => m.entry);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// Validation — free text is not a CAEN
// ---------------------------------------------------------------------------

/**
 * Why a typed value is not an acceptable CAEN class, or `null` when it is.
 *
 * This is **input-level** validation and deliberately lives outside the zod schemas. The
 * persisted-data gate in `src/domain/schema.ts:61-65` states the reason better than a
 * comment here would: shape checks at that boundary would reject values accepted before,
 * i.e. they would themselves be a data-loss event. So a profile that already carries a
 * Rev.2 code still loads; the form is where a new one is refused.
 */
export function caenClassProblem(value: string): string | null {
  const cod = value.trim();
  if (cod === '') return null; // absence is legal and means "not recorded"
  if (cod.length !== 4 || !/^\d{4}$/.test(cod)) {
    const near = caenByCod(cod);
    if (near) {
      return (
        `CAEN Rev.3 înregistrează activitatea la clasă, adică 4 cifre. ` +
        `${near.cod} este ${CAEN_LEVEL_LABELS[near.nivel]}, nu clasă.`
      );
    }
    return 'Un cod CAEN Rev.3 are 4 cifre.';
  }
  const entry = caenByCod(cod);
  if (!entry) {
    return `${cod} nu există în CAEN Rev.3 (Ordinul INS 377/2024). Caută după cod sau după denumire.`;
  }
  if (entry.nivel !== 'clasa') {
    return (
      `${cod} este ${CAEN_LEVEL_LABELS[entry.nivel]} în CAEN Rev.3, nu clasă. ` +
      'Înregistrarea se face la clasă (4 cifre).'
    );
  }
  return null;
}

/** True only for a code that is a clasă in the shipped nomenclator. */
export function isCaenClass(value: string): boolean {
  return caenClassProblem(value) === null;
}
