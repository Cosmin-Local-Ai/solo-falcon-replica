import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../data/store';
import {
  DOC_SECTIONS, DOC_SECTION_MAP, MAX_DOC_BYTES,
  docTipFromName, formatBytes, fmtDate, todayISO,
  downloadDataUrl, downloadText, total,
} from '../data/types';
import type { AppData } from '../data/types';
import type { DocTypeCode, CompanyDocument, TaxStatement } from '../data/types';
import { type Bani, formatBani, formatBaniRON, requireRon, sumBani, subBani } from '../domain/money';
import { expenseFiscalDate, revenueFiscalDate } from '../domain/aggregation';
import { localYear, localDateISO, now } from '../domain/date';
import { getLedgerDisclosure, type LedgerDisclosure } from '../data/dashboard';
import { Card, Badge, Modal, Empty } from '../components/ui';
import { copy, documents as documentsCopy, expenses as expensesCopy, moneyDate, occupancy as occupancyCopy, assets as assetsCopy } from '../ui/copy';
import { resolveBlobContent, getBlobStore } from '../data/blobStore';
import { isoCalendarDateProblem } from '../domain/date';
import {
  occupancyStayExceedsShortTermCeiling, isCnpShaped,
  type OccupancySheet, type GuestIdentifierKind,
} from '../data/types';
import {
  inventoryRegisterCsv, assetFicheCsv, retentionFor, retentionText,
} from '../data/fixedAssetDocuments';
import { selectRuleSet } from '../domain/fiscal';
import type { FiscalRule } from '../domain/fiscal/rules';
import { FISCAL_DEPRECIATION_RULE_ID } from '../domain/fiscal/depreciation';

// Canonical route hash keys — mirror the original SOLO Documents feature:
//   documents.company     → "Documente PFA"  (registration documents, real uploads)
//   documents.statements  → "Declarații"     (local registry of filed tax declarations)
//   documents.reports     → "Rapoarte"       (RJIP cashflow registers, CSV download)
// PG-6h-3 adds a fourth: the occupancy sheet. It is a retained document, so it belongs on this page and
// nowhere else — and it is deliberately NOT folded into "Rapoarte", because a report is something the app
// produces from the register, while the fișă is something the taxpayer completes by hand and keeps.
const TABS = [
  { key: 'company', label: documentsCopy.tabs.pfa },
  { key: 'statements', label: documentsCopy.tabs.declarations },
  { key: 'reports', label: documentsCopy.tabs.reports },
  { key: 'occupancy', label: occupancyCopy.title },
  // PG-6e (D-FA-2): the two retained documents the fixed-asset register owes. They live on this page and
  // not on /assets, because they are documents the taxpayer keeps rather than facts they enter — the same
  // division that puts the occupancy sheet here.
  { key: 'fixed-assets', label: assetsCopy.documents.tabTitle },
] as const;
type TabKey = (typeof TABS)[number]['key'];

const TIP_ICON: Partial<Record<CompanyDocument['tip'], string>> = {
  pdf: '📄', jpg: '🖼', png: '🖼',
};

// The size limit the upload messages state. Derived from the constant the check actually uses, so the
// number a person reads cannot drift away from the number the code enforces (it had: copy said 2 MB,
// MAX_DOC_BYTES is 5 MB).
const MAX_MB = MAX_DOC_BYTES / (1024 * 1024);

// ---------- file helpers ----------

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error('read failed'));
    r.readAsDataURL(file);
  });
}

// ---------- Company tab: document sections ----------

function DocumentSection({ code }: { code: DocTypeCode }) {
  const { companyDocs, uploadDocument, deleteDocument, toast } = useStore();
  const def = DOC_SECTION_MAP[code];
  const words = documentsCopy.sections[code];
  const files = companyDocs[code] ?? [];
  const [helperOpen, setHelperOpen] = useState(false);
  // PG-11: the preview holds resolved bytes, not the record. A record's bytes may live in the blob store,
  // and an `<img src>` cannot be awaited — so the modal is handed what was read, or it is not opened.
  const [preview, setPreview] = useState<{ nume: string; content: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /**
   * PG-11 — open a document: the inline copy if it still has one, otherwise the blob.
   *
   * A record that points at bytes the store cannot produce is reported, not downloaded empty. A truncated
   * or empty file that opens without complaint is how a taxpayer discovers a document is gone months later,
   * on the day they need to produce it.
   */
  async function openDocument(doc: CompanyDocument) {
    const bytes = await resolveBlobContent({ kind: 'document', code, record: doc }, getBlobStore());
    if (!bytes) {
      toast('error', documentsCopy.bytesUnavailable(doc.nume));
      return;
    }
    downloadDataUrl(bytes, doc.nume);
  }

  async function showPreview(doc: CompanyDocument) {
    const bytes = await resolveBlobContent({ kind: 'document', code, record: doc }, getBlobStore());
    if (!bytes) {
      toast('error', documentsCopy.bytesUnavailable(doc.nume));
      return;
    }
    setPreview({ nume: doc.nume, content: bytes });
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    const tip = docTipFromName(file.name);
    if (!tip) {
      toast('error', documentsCopy.acceptedFormats);
      return;
    }
    if (file.size > MAX_DOC_BYTES) {
      toast('error', documentsCopy.tooLarge(MAX_MB));
      return;
    }
    try {
      const content = await readFileAsDataUrl(file);
      uploadDocument(code, {
        nume: file.name,
        tip,
        marime: file.size,
        data: todayISO(),
        content,
      });
      toast('success', documentsCopy.uploaded(file.name));
    } catch {
      toast('error', documentsCopy.readFailed);
    }
  }

  return (
    <Card>
      <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            {words.title}
            {def.allowMultiple && (
              <span title={documentsCopy.uploadManyHint} style={{ marginLeft: 8, cursor: 'help' }}>ⓘ</span>
            )}
          </div>
          {words.helper && (
            <div style={{ marginTop: 4 }}>
              <button
                className="btn btn-ghost"
                style={{ padding: '2px 8px', fontSize: 12 }}
                onClick={() => setHelperOpen(o => !o)}
              >
                {helperOpen ? documentsCopy.hideExamples : documentsCopy.showExamples}
              </button>
              {helperOpen && (
                <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--text-3)' }}>
                  {words.helper}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="actions">
          <button className="btn btn-primary" onClick={() => fileRef.current?.click()}>
            {files.length ? documentsCopy.uploadOther : documentsCopy.upload}
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          style={{ display: 'none' }}
          onChange={onFile}
        />
      </div>

      {files.length ? (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {files.map(f => (
            <div
              key={f.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 18px', borderBottom: '1px solid var(--border)',
              }}
            >
              <span style={{ fontSize: 18 }}>{TIP_ICON[f.tip] ?? '📄'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.nume}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  {formatBytes(f.marime)} · {fmtDate(f.data)}
                </div>
              </div>
              {(f.tip === 'jpg' || f.tip === 'png') && (f.content || f.blobRef) && (
                <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12.5 }} onClick={() => void showPreview(f)}>
                  {documentsCopy.preview}
                </button>
              )}
              {(f.content || f.blobRef) && (
                <button
                  className="btn btn-ghost"
                  style={{ padding: '4px 10px', fontSize: 12.5 }}
                  onClick={() => void openDocument(f)}
                >
                  {documentsCopy.download}
                </button>
              )}
              <button
                className="btn btn-ghost"
                style={{ padding: '4px 10px', fontSize: 12.5, color: 'var(--danger)' }}
                onClick={() => {
                  deleteDocument(code, f.id);
                  toast('info', documentsCopy.deleted(f.nume));
                }}
              >
                {copy.ui.remove}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: '14px 18px', fontSize: 13, color: 'var(--text-3)' }}>
          {documentsCopy.empty}
        </div>
      )}

      {preview && (
        <Modal title={preview.nume} onClose={() => setPreview(null)} wide>
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <img
              src={preview.content}
              alt={preview.nume}
              style={{ maxWidth: '100%', maxHeight: '65vh', borderRadius: 6, border: '1px solid var(--border)' }}
            />
          </div>
        </Modal>
      )}
    </Card>
  );
}

// ---------- Statements tab: filed tax declarations ----------

function StatementForm({ onSave, onClose }: {
  onSave: (s: Omit<TaxStatement, 'id'>) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState({
    tip: '',
    perioada: '',
    depunere: 'SOLO' as TaxStatement['depunere'],
    dataDepunere: todayISO(),
    nume: '',
    content: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.name.toLowerCase().endsWith('.pdf') === false) {
      setErrors(p => ({ ...p, fisier: documentsCopy.pdfOnly }));
      return;
    }
    if (file.size > MAX_DOC_BYTES) {
      setErrors(p => ({ ...p, fisier: documentsCopy.maxSizeMb(MAX_MB) }));
      return;
    }
    setErrors(p => ({ ...p, fisier: '' }));
    readFileAsDataUrl(file).then(content =>
      setF(p => ({ ...p, nume: file.name, content })),
    );
  }

  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  function submit() {
    const e: Record<string, string> = {};
    if (!f.tip.trim()) e.tip = documentsCopy.declaration.typeRequired;
    if (!f.perioada.trim()) e.perioada = documentsCopy.declaration.periodRequired;
    setErrors(e);
    if (Object.keys(e).length) return;
    onSave({
      tip: f.tip.trim(),
      perioada: f.perioada.trim(),
      depunere: f.depunere,
      dataDepunere: f.dataDepunere || undefined,
      nume: f.nume || undefined,
      content: f.content || undefined,
    });
  }

  return (
    <Modal
      title={documentsCopy.declaration.addTitle}
      onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>{copy.ui.cancel}</button>
        <button className="btn btn-primary" onClick={submit}>{copy.ui.save}</button>
      </>}
    >
      <div className="form-grid">
        <div className="field">
          <label>{documentsCopy.declaration.type}</label>
          <input
            value={f.tip}
            onChange={e => set('tip', e.target.value)}
            placeholder={documentsCopy.declaration.typePlaceholder}
          />
          {errors.tip && <span className="error">{errors.tip}</span>}
        </div>
        <div className="field">
          <label>{documentsCopy.declaration.period}</label>
          <input
            value={f.perioada}
            onChange={e => set('perioada', e.target.value)}
            placeholder={documentsCopy.declaration.periodPlaceholder}
          />
          {errors.perioada && <span className="error">{errors.perioada}</span>}
        </div>
        <div className="field">
          <label>{documentsCopy.declaration.method}</label>
          <select value={f.depunere} onChange={e => set('depunere', e.target.value)}>
            <option value="SOLO">{documentsCopy.declaration.methodSolo}</option>
            <option value="personală">{documentsCopy.declaration.methodPersonal}</option>
          </select>
        </div>
        <div className="field">
          <label>{documentsCopy.declaration.depunereDate}</label>
          <input type="date" value={f.dataDepunere} onChange={e => set('dataDepunere', e.target.value)} />
        </div>
        <div className="field full">
          <label>{documentsCopy.declaration.pdfLabel}</label>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf"
            style={{ display: 'none' }}
            onChange={onFile}
          />
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
            {f.nume ? documentsCopy.declaration.changeFile(f.nume) : documentsCopy.declaration.choosePdf}
          </button>
          {errors.fisier && <span className="error">{errors.fisier}</span>}
        </div>
      </div>
    </Modal>
  );
}

function StatementsTab() {
  const { statements, addStatement, deleteStatement, toast } = useStore();
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<TaxStatement | null>(null);

  /** PG-11: same resolution as the company documents — inline copy first, then the blob. A statement that
   *  points at bytes the store cannot produce is reported, never downloaded empty. */
  async function openStatement(statement: TaxStatement) {
    const bytes = await resolveBlobContent({ kind: 'statement', record: statement }, getBlobStore());
    if (!bytes) {
      toast('error', documentsCopy.bytesUnavailable(statement.nume ?? statement.tip));
      return;
    }
    downloadDataUrl(bytes, statement.nume ?? statement.tip);
  }

  const rows = useMemo(
    () => [...statements].sort((a, b) => b.perioada.localeCompare(a.perioada, 'ro')),
    [statements],
  );

  return (
    <Card>
      <div style={{ padding: '0 18px' }}>
        <div className="table-wrap" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border-strong)' }}>
                <th style={{ padding: '10px 12px' }}>{documentsCopy.declaration.columns.type}</th>
                <th style={{ padding: '10px 12px' }}>{documentsCopy.declaration.columns.period}</th>
                <th style={{ padding: '10px 12px' }}>{documentsCopy.declaration.columns.method}</th>
                <th style={{ padding: '10px 12px' }}>{documentsCopy.declaration.columns.date}</th>
                <th style={{ padding: '10px 12px' }}>{documentsCopy.declaration.columns.file}</th>
                <th style={{ padding: '10px 12px' }} />
              </tr>
            </thead>
            <tbody>
              {rows.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{s.tip}</td>
                  <td style={{ padding: '10px 12px' }}>{s.perioada}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <Badge kind={s.depunere === 'SOLO' ? 'badge-success' : 'badge-neutral'}>
                      {s.depunere === 'SOLO' ? documentsCopy.declaration.methodSolo : documentsCopy.declaration.methodPersonal}
                    </Badge>
                  </td>
                  <td style={{ padding: '10px 12px' }}>{s.dataDepunere ? fmtDate(s.dataDepunere) : '—'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    {s.nume && (s.content || s.blobRef) ? (
                      <button
                        className="btn btn-ghost"
                        style={{ padding: '3px 8px', fontSize: 12.5 }}
                        data-statement-download={s.id}
                        onClick={() => void openStatement(s)}
                      >
                      ⬇ {s.nume}
                      </button>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                    <button
                      className="btn btn-ghost"
                      style={{ padding: '3px 8px', fontSize: 12.5, color: 'var(--danger)' }}
                      onClick={() => setConfirmDelete(s)}
                    >
                      {copy.ui.remove}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {rows.length === 0 && (
        <div style={{ padding: '20px 18px' }}>
          <Empty
            icon="🧾"
            title={documentsCopy.declaration.emptyTitle}
            text={documentsCopy.declaration.emptyBody}
            action={<button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ {documentsCopy.declaration.add}</button>}
          />
        </div>
      )}
      {rows.length > 0 && (
        <div style={{ padding: '12px 18px', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ {documentsCopy.declaration.add}</button>
        </div>
      )}

      {showAdd && (
        <StatementForm
          onClose={() => setShowAdd(false)}
          onSave={s => {
            addStatement(s);
            toast('success', documentsCopy.declaration.registered(s.tip, s.perioada));
            setShowAdd(false);
          }}
        />
      )}

      {confirmDelete && (
        <Modal
          title={documentsCopy.declaration.deleteTitle}
          onClose={() => setConfirmDelete(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>{copy.ui.cancel}</button>
            <button
              className="btn btn-danger"
              onClick={() => {
                deleteStatement(confirmDelete.id);
                toast('info', documentsCopy.declaration.deleted);
                setConfirmDelete(null);
              }}
            >
              {copy.ui.remove}
            </button>
          </>}
        >
          <p style={{ fontSize: 13.5 }}>
            {confirmDelete.tip} · {confirmDelete.perioada}
          </p>
        </Modal>
      )}
    </Card>
  );
}

// ---------- Reports tab: RJIP cashflow registers ----------

/**
 * Exported so the money rendering of an exported register can be pinned directly (B-17 class defect).
 *
 * Takes only the rows. The fiscal year belongs to the **filename** (`RJIP_${year}.csv`) and the toast, not to
 * the register body — the header row is fixed by the register format, so there is nowhere for a year to go
 * inside the file. It used to take a `year` parameter it never read.
 */
export function rjipCsv(
  rows: { data: string; descriere: string; venit: Bani; cheltuiala: Bani }[],
): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = [
    documentsCopy.rjip.csvHeader,
    // `formatBani`, not `toFixed(2)`: these are BANI. `14250..toFixed(2)` exported 142,50 lei as
    // "14250,00" — a 100× error in a register the tax office reads, and an exported file is exactly
    // where a raw stored unit must not leak.
    ...rows.map((r) => [r.data, esc(r.descriere), formatBani(r.venit), formatBani(r.cheltuiala)].join(';')),
  ];
  // BOM so Excel opens the semicolon CSV with proper encoding.
  return '\uFEFF' + lines.join('\r\n');
}

/** One line of the register: the posting date, the document it rests on, and the two leu columns. */
export interface RjipRow {
  data: string;
  descriere: string;
  venit: Bani;
  cheltuiala: Bani;
}

export interface RjipRegister {
  rows: RjipRow[];
  /**
   * How many of this year's rows were posted on the document date because the record carries no money
   * date. Stated on the surface, because the file itself cannot say it: the register has one date column
   * and it is the money date.
   */
  postedOnDocumentDate: number;
  /** How many of this year's records the leu register could not hold, because no rate converted them. */
  unconverted: number;
}

/**
 * PG-2 (B-66, B-70) — one fiscal year of the RJIP, built the way the register is required to be kept.
 *
 * OMFP 170/2015 cap. V, Secțiunea a 2-a: „fiecare operațiune economico-financiară se va înregistra în
 * ordine cronologică, **în funcție de data efectuării operațiunii de încasare/plată**”, and the mandatory
 * information list opens with „data efectuării operațiunii de încasare/plată”, followed by „denumirea și
 * numărul documentului justificativ care stă la baza înregistrării” — the money date is the register's
 * date column and the document is a separate cross-reference, which is what `descriere` carries. Before
 * PG-2 this file filtered the year with `date.slice(0, 4)` and stamped the row with `r.date` / `e.date`,
 * never reading `collected` / `paid`: a sum collected on 10 Jan 2027 was exported into the **2026**
 * register, under a date on which nothing was collected. An exported register is a document the tax
 * office reads, so that was not a display bug.
 *
 * The date now comes from `domain/aggregation.ts revenueFiscalDate` / `expenseFiscalDate` — the same two
 * functions the estimate and the FX anchor use — so the register and the money figure cannot disagree
 * about which year a record belongs to. The fallback to the document date is the Phase 9 decision, not a
 * legal one (research/37 §4.4 found no statutory presumption that fills in a missing money date), and the
 * surface says how many rows rest on it.
 *
 * The leu amounts come from `getLedgerDisclosure` rather than from a local `isRon` filter: a foreign
 * record that a recorded BNR rate converted now enters the register at its lei amount, exactly as it
 * enters the dashboard's totals, and a record with no rate stays out because a leu register has nowhere
 * to put an unconverted sum. That was the one place in the app answering the currency question without
 * the disclosure Phase 10c built.
 */
export function buildRjipRegister(data: AppData, year: number): RjipRegister {
  const ledger = getLedgerDisclosure(data);
  const convertedLei = new Map<string, Bani>(
    ledger.conversions.map(c => [c.recordId, sumBani([c.netLei, c.vatLei])]),
  );
  const unconvertedIds = new Set(ledger.unconverted.map(u => u.id));
  const yearKey = String(year);

  /** The leu amount of a record, or `null` when the ledger holds none for it. Never a re-derivation. */
  const leiOf = (record: { id: string }, fallback: () => Bani): Bani | null => {
    const converted = convertedLei.get(record.id);
    if (converted !== undefined) return converted;
    return unconvertedIds.has(record.id) ? null : fallback();
  };

  const rows: RjipRow[] = [];
  let postedOnDocumentDate = 0;
  let unconverted = 0;

  for (const r of data.revenues) {
    const on = revenueFiscalDate(r);
    if (on.slice(0, 4) !== yearKey) continue;
    if (r.collected === undefined) postedOnDocumentDate += 1;
    const lei = leiOf(r, () => requireRon(total(r), `revenue ${r.id}`));
    if (lei === null) {
      unconverted += 1;
      continue;
    }
    rows.push({
      data: on,
      descriere: `${r.tip === 'factura' ? documentsCopy.rjip.invoiceKind.factura : documentsCopy.rjip.invoiceKind.nota} ${r.nr} – ${r.client}`,
      venit: lei,
      cheltuiala: 0 as Bani,
    });
  }
  for (const e of data.expenses) {
    const on = expenseFiscalDate(e);
    if (on.slice(0, 4) !== yearKey) continue;
    if (e.paid === undefined) postedOnDocumentDate += 1;
    const lei = leiOf(e, () => requireRon(total(e), `expense ${e.id}`));
    if (lei === null) {
      unconverted += 1;
      continue;
    }
    rows.push({
      data: on,
      descriere: `${e.tip === 'factura' ? expensesCopy.documentTypeCell.factura : expensesCopy.documentTypeCell.bon} ${e.nr} – ${e.furnizor}`,
      venit: 0 as Bani,
      cheltuiala: lei,
    });
  }
  // „în ordine cronologică” — by the money date, which is the column the order is defined on.
  return { rows: rows.sort((a, b) => a.data.localeCompare(b.data)), postedOnDocumentDate, unconverted };
}

function ReportsTab() {
  const store = useStore();
  const { revenues, expenses, toast } = store;
  // PG-2: the year the selector opens on comes from the app's own clock seam, not from a raw
  // `new Date().getFullYear()` beside it.
  const currentYear = localYear();

  // PG-2 (B-66): the years offered are the years the OPERATIONS fall into, which is the money date's
  // year — a collection on 10 Jan 2027 has to make 2027 selectable, or the register for the year the
  // money actually moved cannot be produced at all.
  const years = useMemo(() => {
    const ys = new Set<number>([currentYear]);
    for (const r of revenues) ys.add(Number(revenueFiscalDate(r).slice(0, 4)));
    for (const e of expenses) ys.add(Number(expenseFiscalDate(e).slice(0, 4)));
    return [...ys].sort((a, b) => b - a);
  }, [revenues, expenses, currentYear]);

  const [year, setYear] = useState(currentYear);

  const register = useMemo(() => buildRjipRegister(store, year), [store, year]);
  const { rows, postedOnDocumentDate, unconverted: foreignCount } = register;

  // Money arithmetic belongs in the domain, not in JSX: `rows.reduce((s, r) => s + r.venit, 0)` starts
  // from an unbranded 0 and widens every Bani addend to a plain number on the way through.
  const venit = sumBani(rows.map((r) => r.venit));
  const chelt = sumBani(rows.map((r) => r.cheltuiala));
  const sold = subBani(venit, chelt);

  function download() {
    if (!rows.length) {
      toast('info', documentsCopy.rjip.noCashflow(year));
      return;
    }
    downloadText(rjipCsv(rows), `RJIP_${year}.csv`);
    toast('success', documentsCopy.rjip.generated(year, rows.length));
  }

  return (
    <Card>
      <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13.5 }}>
          {documentsCopy.rjip.description}
          {/* PG-2: the register names the date column it posts on, and how much of this year rests on the
              document-date fallback because no money date was recorded. */}
          <div className="text-sm muted">{documentsCopy.rjip.postedOn}</div>
          {/* The legal half of the same statement, in the sentence research/37 §5 cleared: the register
              posts on the money date because the fiscal year is the money date’s, not the document’s. */}
          <div className="text-sm muted">{moneyDate.rule}</div>
          {postedOnDocumentDate > 0 && (
            <div className="text-sm muted">{documentsCopy.rjip.postedOnDocumentDate(postedOnDocumentDate)}</div>
          )}
          {foreignCount > 0 && (
            <div className="text-sm muted">{documentsCopy.rjip.foreignCurrencyExcluded(foreignCount)}</div>
          )}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <select
            style={{ border: '1px solid var(--border-strong)', borderRadius: 6, padding: '7px 10px', fontSize: 13 }}
            value={year}
            onChange={e => setYear(Number(e.target.value))}
          >
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={download}>{documentsCopy.rjip.downloadCsv}</button>
        </div>
      </div>
      <div style={{ borderTop: '1px solid var(--border)', padding: '14px 18px', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{documentsCopy.rjip.revenue(year)}</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{formatBaniRON(venit)}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{documentsCopy.rjip.expenses(year)}</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{formatBaniRON(chelt)}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{documentsCopy.rjip.balance}</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: sold >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {formatBaniRON(sold)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{documentsCopy.rjip.rows}</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{rows.length}</div>
        </div>
      </div>
    </Card>
  );
}

// ---------- Occupancy sheet (PG-6h-3, OPANAF 381/2026) ----------

/**
 * The taxpayer's own copy of one fișă, as a file.
 *
 * This is the **only** path in the application that writes a guest name or a guest identifier outside
 * localStorage, and it exists only because a retention obligation has to be producible on paper or in a
 * spreadsheet to be kept at all. It is not a report: it takes one sheet the person completed and prints
 * that sheet. It is reached from one button on that sheet, never from the register export, never
 * automatically, and never for more than the one form the person is looking at.
 *
 * Same file shape the RJIP register uses and the tests pin — BOM, semicolons, CRLF — because Romanian
 * Excel is the reader. Every field is quoted, because an address contains a comma and a name may contain
 * a semicolon.
 *
 * There is deliberately **no money column**. The sheet is not a revenue source, and a column that could
 * hold one would be the first step towards the thing D-OCC-1 forbids.
 */
export function occupancyCsv(sheet: OccupancySheet): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = [
    occupancyCopy.export.csvHeader,
    ...sheet.stays.map(stay => [
      String(sheet.fiscalYear),
      esc(sheet.propertyAddress),
      esc(sheet.roomLabel),
      esc(stay.guestName),
      esc(stay.guestIdentifier),
      esc(stay.identifierKind === 'cnp'
        ? occupancyCopy.form.identifierKindCnp
        : occupancyCopy.form.identifierKindId),
      stay.firstDay,
      stay.lastDay,
    ].join(';')),
  ];
  return '\uFEFF' + lines.join('\r\n');
}

/** A stay is only as good as its dates; a malformed one is flagged, never silently repaired. */
function stayDateProblems(stay: { firstDay: string; lastDay: string }): string[] {
  const problems: string[] = [];
  for (const value of [stay.firstDay, stay.lastDay]) {
    if (value === '') problems.push(occupancyCopy.validation.dateRequired);
    else {
      const problem = isoCalendarDateProblem(value);
      if (problem !== null) problems.push(occupancyCopy.validation.dateInvalid(value));
    }
  }
  if (problems.length === 0 && stay.lastDay < stay.firstDay) problems.push(occupancyCopy.validation.dateOrder);
  return problems;
}

function StayForm({ sheetId, onDone }: { sheetId: string; onDone: () => void }) {
  const { addOccupancyStay } = useStore();
  const [f, setF] = useState({
    guestName: '',
    guestIdentifier: '',
    identifierKind: 'cnp' as GuestIdentifierKind,
    firstDay: '',
    lastDay: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function save() {
    const next: Record<string, string> = {};
    if (f.guestName.trim() === '') next.guestName = occupancyCopy.validation.guestNameRequired;
    if (f.guestIdentifier.trim() === '') next.guestIdentifier = occupancyCopy.validation.identifierRequired;
    for (const p of stayDateProblems(f)) next.dates = p;
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    // The identifier is stored exactly as typed — trimmed of surrounding space only. No checksum, no
    // reformatting, no refusal of a suspect value: the app records what the taxpayer recorded.
    addOccupancyStay(sheetId, {
      guestName: f.guestName.trim(),
      guestIdentifier: f.guestIdentifier.trim(),
      identifierKind: f.identifierKind,
      firstDay: f.firstDay,
      lastDay: f.lastDay,
    });
    onDone();
  }

  const field = (key: keyof typeof f, label: string, type = 'text') => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5 }}>
      <span>{label}</span>
      <input
        type={type}
        value={f[key] as string}
        data-testid={`occ-stay-${key}`}
        onChange={e => setF(prev => ({ ...prev, [key]: e.target.value }))}
      />
    </label>
  );

  return (
    <div data-testid="occ-stay-form" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        {field('guestName', occupancyCopy.form.guestName)}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5 }}>
          <span>{occupancyCopy.form.identifierKind}</span>
          <select
            value={f.identifierKind}
            data-testid="occ-stay-identifierKind"
            onChange={e => setF(prev => ({ ...prev, identifierKind: e.target.value as GuestIdentifierKind }))}
          >
            <option value="cnp">{occupancyCopy.form.identifierKindCnp}</option>
            <option value="act_de_identitate">{occupancyCopy.form.identifierKindId}</option>
          </select>
        </label>
        {field('guestIdentifier', occupancyCopy.form.identifier)}
        {field('firstDay', occupancyCopy.form.firstDay, 'date')}
        {field('lastDay', occupancyCopy.form.lastDay, 'date')}
      </div>
      {errors.guestName && <div className="text-sm" style={{ color: 'var(--danger)' }}>{errors.guestName}</div>}
      {errors.guestIdentifier && <div className="text-sm" style={{ color: 'var(--danger)' }}>{errors.guestIdentifier}</div>}
      {errors.dates && <div className="text-sm" style={{ color: 'var(--danger)' }}>{errors.dates}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" onClick={save} data-testid="occ-save-stay">{occupancyCopy.form.addStay}</button>
        <button className="btn btn-ghost" onClick={onDone}>{copy.ui.cancel}</button>
      </div>
    </div>
  );
}

function SheetCard({ sheet }: { sheet: OccupancySheet }) {
  const { deleteOccupancySheet, deleteOccupancyStay, toast } = useStore();
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function download() {
    if (sheet.stays.length === 0) {
      toast('info', occupancyCopy.export.nothingToExport);
      return;
    }
    downloadText(
      occupancyCsv(sheet),
      occupancyCopy.export.fileName(sheet.fiscalYear, sheet.roomLabel),
    );
    toast('success', occupancyCopy.export.generated(sheet.fiscalYear, sheet.stays.length));
  }

  return (
    <Card>
      <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <strong data-testid="occ-sheet-heading">{occupancyCopy.form.sheetHeading(sheet.fiscalYear, sheet.roomLabel)}</strong>
          <span className="muted text-sm">{occupancyCopy.form.staysCount(sheet.stays.length)}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={download} data-testid="occ-download">
              {occupancyCopy.form.download}
            </button>
            <button className="btn btn-ghost" onClick={() => setAdding(v => !v)} data-testid="occ-add-stay">
              {occupancyCopy.form.addStay}
            </button>
            <button className="btn btn-ghost" onClick={() => setConfirmDelete(true)} data-testid="occ-delete-sheet">
              {occupancyCopy.form.deleteSheet}
            </button>
          </div>
        </div>

        <div className="text-sm muted" data-testid="occ-sheet-address">
          {occupancyCopy.form.sectionOne}: {sheet.propertyAddress}
        </div>

        {sheet.stays.length === 0 ? (
          <div className="text-sm muted">{occupancyCopy.form.noStays}</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <caption className="text-sm muted" style={{ textAlign: 'left', paddingBottom: 6 }}>
              {occupancyCopy.form.sectionTwo}
            </caption>
            <thead>
              <tr>
                <th scope="col" style={{ textAlign: 'left' }}>{occupancyCopy.form.guestName}</th>
                <th scope="col" style={{ textAlign: 'left' }}>{occupancyCopy.form.identifier}</th>
                <th scope="col" style={{ textAlign: 'left' }}>{occupancyCopy.form.firstDay}</th>
                <th scope="col" style={{ textAlign: 'left' }}>{occupancyCopy.form.lastDay}</th>
                <th scope="col"><span className="visually-hidden">{occupancyCopy.form.deleteStay}</span></th>
              </tr>
            </thead>
            <tbody>
              {sheet.stays.map(stay => {
                const dateProblems = stayDateProblems(stay);
                // A flag, never a correction and never a block. The app records what the taxpayer
                // recorded; it has no authority over a document it did not issue.
                const suspectIdentifier = stay.identifierKind === 'cnp' && !isCnpShaped(stay.guestIdentifier);
                const beyondCeiling = occupancyStayExceedsShortTermCeiling(stay);
                return (
                  <tr key={stay.id} data-testid={`occ-stay-${stay.id}`}>
                    <td>{stay.guestName}</td>
                    <td>
                      {stay.guestIdentifier}
                      {suspectIdentifier && (
                        <div className="text-sm muted" data-testid="occ-suspect">{occupancyCopy.identifier.suspect}</div>
                      )}
                      {beyondCeiling && (
                        <div className="text-sm muted" data-testid="occ-over-ceiling">
                          {occupancyCopy.definition.overCeiling(
                            Math.round(
                              (Date.parse(`${stay.lastDay}T00:00:00Z`) - Date.parse(`${stay.firstDay}T00:00:00Z`)) / 86_400_000,
                            ) + 1,
                          )}
                        </div>
                      )}
                      {dateProblems.length > 0 && (
                        <div className="text-sm muted" data-testid="occ-stay-days-warning">{dateProblems[0]}</div>
                      )}
                    </td>
                    <td>{stay.firstDay}</td>
                    <td>{stay.lastDay}</td>
                    <td>
                      <button
                        className="btn btn-ghost"
                        onClick={() => deleteOccupancyStay(sheet.id, stay.id)}
                        data-testid={`occ-delete-stay-${stay.id}`}
                      >
                        {occupancyCopy.form.deleteStay}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {adding && <StayForm sheetId={sheet.id} onDone={() => setAdding(false)} />}

        {confirmDelete && (
          <Modal title={occupancyCopy.form.deleteSheet} onClose={() => setConfirmDelete(false)}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p>{occupancyCopy.retention.deletion}</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-danger"
                  data-testid="occ-confirm-delete"
                  onClick={() => {
                    deleteOccupancySheet(sheet.id);
                    toast('info', occupancyCopy.retention.deleted);
                  }}
                >
                  {occupancyCopy.form.deleteSheet}
                </button>
                <button className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>{copy.ui.cancel}</button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </Card>
  );
}

function OccupancyTab() {
  const { occupancySheets, addOccupancySheet, toast } = useStore();
  // The year the form opens on comes from the app's own clock seam — a raw `new Date().getFullYear()`
  // here would seed the wrong year at 00:30 on 1 January, which is the B-46 defect class.
  const currentYear = localYear();
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({
    fiscalYear: String(currentYear),
    propertyAddress: '',
    roomLabel: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function save() {
    const year = Number(f.fiscalYear);
    const next: Record<string, string> = {};
    if (!Number.isInteger(year) || year < 1990 || year > 2100) next.fiscalYear = occupancyCopy.validation.yearRequired;
    if (f.propertyAddress.trim() === '') next.propertyAddress = occupancyCopy.validation.addressRequired;
    if (f.roomLabel.trim() === '') next.roomLabel = occupancyCopy.validation.roomRequired;
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    addOccupancySheet({
      fiscalYear: year,
      propertyAddress: f.propertyAddress.trim(),
      roomLabel: f.roomLabel.trim(),
      stays: [],
    });
    setF({ fiscalYear: String(currentYear), propertyAddress: '', roomLabel: '' });
    setErrors({});
    setAdding(false);
    toast('success', occupancyCopy.form.addSheet);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* The three sentences that make this page unlike every other page in the app. They are placed
          above the data, not under it, because each one changes what a reasonable reader would otherwise
          assume: that a form in a tax app is a filing, that a delete removes an obligation, and that data
          in an app lives on somebody's server. */}
      <Card>
        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <strong data-testid="occ-retention">{occupancyCopy.retention.heading}</strong>
          <div className="text-sm">{occupancyCopy.retention.body}</div>
          <div className="text-sm muted">{occupancyCopy.retention.ownCopy}</div>
          <div className="text-sm muted">{occupancyCopy.retention.deletion}</div>
        </div>
      </Card>
      <Card>
        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <strong data-testid="occ-privacy">{occupancyCopy.privacy.heading}</strong>
          <div className="text-sm">{occupancyCopy.privacy.body}</div>
          <div className="text-sm muted">{occupancyCopy.privacy.exportIsExplicit}</div>
        </div>
      </Card>
      <Card>
        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="occ-scope">
          <strong>{occupancyCopy.scope.heading}</strong>
          <div className="text-sm">{occupancyCopy.scope.body}</div>
          <div className="text-sm muted">{occupancyCopy.scope.notGatedOnTitle}</div>
          <div className="text-sm muted" data-testid="occ-definition">{occupancyCopy.definition.shortTerm}</div>
          <div className="text-sm muted">{occupancyCopy.definition.fractionOfDay}</div>
          <div className="text-sm muted">{occupancyCopy.definition.citation}</div>
        </div>
      </Card>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="btn btn-primary" onClick={() => setAdding(v => !v)} data-testid="occ-add-sheet">
          {occupancyCopy.form.addSheet}
        </button>
      </div>

      {adding && (
        <Card>
          <div data-testid="occ-sheet-form" style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5 }}>
                <span>{occupancyCopy.form.year}</span>
                <input value={f.fiscalYear} data-testid="occ-field-fiscalYear"
                  onChange={e => setF(prev => ({ ...prev, fiscalYear: e.target.value }))} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5 }}>
                <span>{occupancyCopy.form.address}</span>
                <input value={f.propertyAddress} data-testid="occ-field-propertyAddress"
                  onChange={e => setF(prev => ({ ...prev, propertyAddress: e.target.value }))} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5 }}>
                <span>{occupancyCopy.form.room}</span>
                <input value={f.roomLabel} data-testid="occ-field-roomLabel"
                  onChange={e => setF(prev => ({ ...prev, roomLabel: e.target.value }))} />
              </label>
            </div>
            {Object.values(errors).map(msg => (
              <div key={msg} className="text-sm" style={{ color: 'var(--danger)' }}>{msg}</div>
            ))}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={save} data-testid="occ-save-sheet">{occupancyCopy.form.addSheet}</button>
              <button className="btn btn-ghost" onClick={() => setAdding(false)}>{copy.ui.cancel}</button>
            </div>
          </div>
        </Card>
      )}

      {occupancySheets.length === 0 ? (
        <div style={{ padding: '20px 18px' }}>
          <Empty icon="📌" title={occupancyCopy.form.emptyTitle} text={occupancyCopy.form.empty} />
        </div>
      ) : (
        occupancySheets.map(sheet => <SheetCard key={sheet.id} sheet={sheet} />)
      )}
    </div>
  );
}

// ---------- Fixed-asset retained documents (PG-6e, D-FA-2) ----------

// The rule the generated documents read their depreciation figures from — **selected, never imported by
// year name**, for the reason `domain/fiscal/registry.test.ts` enforces and `Expenses.tsx` records: a call
// site that names the year can only ever ask for that year. The year comes from the profile the store holds.
function depreciationRule(fiscalYear: number): FiscalRule | undefined {
  const asOf = localDateISO(now());
  const selection = selectRuleSet(fiscalYear, asOf);
  return selection ? selection.rules.find(r => r.ruleId === FISCAL_DEPRECIATION_RULE_ID) : undefined;
}

/**
 * The two documents OMFP 170/2015 requires a partidă simplă taxpayer to keep for their fixed assets, built
 * from the register on /assets. Nothing here is a filing surface: there is no upload, no "send to ANAF" and
 * no deadline widget, because the obligation is păstrare — and the retention sentences below are the
 * current ones, after OMF 1.447/2023 abrogated the 10-year rule people remember.
 */
function FixedAssetsTab() {
  const { fixedAssets, toast, profile } = useStore();
  const rule = depreciationRule(profile.fiscalYear);

  if (fixedAssets.length === 0) {
    return (
      <Card>
        <div style={{ padding: '20px 18px' }}>
          <Empty icon="🏷" title={assetsCopy.documents.emptyTitle} text={assetsCopy.documents.empty} />
        </div>
      </Card>
    );
  }

  const registerCsv = rule ? inventoryRegisterCsv(fixedAssets, rule) : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card>
        <div style={{ padding: '4px 2px' }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{assetsCopy.documents.heading}</div>
          <div className="text-sm">{assetsCopy.documents.body}</div>
        </div>
      </Card>

      <Card title={`${assetsCopy.documents.registerTitle} (${assetsCopy.documents.registerCode})`}>
        <div style={{ padding: '4px 2px' }}>
          <div className="text-sm muted">{assetsCopy.documents.registerCitation}</div>
          <div className="text-sm" style={{ marginTop: 8 }}>{assetsCopy.documents.retentionRegister}</div>
          <button
            className="btn btn-primary"
            style={{ marginTop: 10 }}
            data-testid="fa-download-register"
            disabled={!rule}
            onClick={() => {
              if (!registerCsv) {
                toast('info', assetsCopy.documents.nothingToExport);
                return;
              }
              downloadText(registerCsv, 'Registrul-inventar-14-1-2b.csv');
              toast('success', assetsCopy.documents.generated);
            }}
          >
            {assetsCopy.documents.downloadRegister}
          </button>
        </div>
      </Card>

      {fixedAssets.map(asset => {
        // The fișa's own retention is inferred, not quoted — `retentionFor` says so in the sentence it
        // returns, and the inference is recorded in research/36 §14.3.
        const retention = retentionText(retentionFor(asset));
        return (
          <Card key={asset.id} title={`${assetsCopy.documents.ficheTitle} — ${asset.label}`}>
            <div style={{ padding: '4px 2px' }}>
              <div className="text-sm muted">{assetsCopy.documents.ficheCitation}</div>
              <div className="text-sm muted" style={{ marginTop: 6 }}>{assetsCopy.documents.ficheInferred}</div>
              <div className="text-sm" style={{ marginTop: 8 }} data-testid={`fa-retention-${asset.id}`}>
                {retention}
              </div>
              <button
                className="btn btn-primary"
                style={{ marginTop: 10 }}
                data-testid={`fa-download-fiche-${asset.id}`}
                disabled={!rule}
                onClick={() => {
                  if (!rule) {
                    toast('info', assetsCopy.documents.nothingToExport);
                    return;
                  }
                  downloadText(
                    assetFicheCsv(asset, rule),
                    `Fisa-mijlocului-fix-14-2-2-${asset.label}.csv`,
                  );
                  toast('success', assetsCopy.documents.generated);
                }}
              >
                {assetsCopy.documents.downloadFiche}
              </button>
            </div>
          </Card>
        );
      })}

      <Card>
        <div style={{ padding: '4px 2px' }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{assetsCopy.documents.retentionHeading}</div>
          <div className="text-sm">{assetsCopy.documents.retentionProvenance}</div>
          <div className="text-sm" style={{ marginTop: 8 }}>{assetsCopy.documents.retentionAbrogated}</div>
          <div className="text-sm muted" style={{ marginTop: 8 }}>{assetsCopy.documents.retentionOwnCopy}</div>
          <div className="text-sm muted" style={{ marginTop: 6 }}>{assetsCopy.documents.retentionDeletion}</div>
        </div>
      </Card>
    </div>
  );
}

// ---------- page ----------

interface DocumentsProps {
  initialTab?: string;
  onTabChange?: (tab: string) => void;
}

export default function Documents({ initialTab, onTabChange }: DocumentsProps) {
  const [tab, setTab] = useState<TabKey>(
    initialTab && TABS.some(t => t.key === initialTab) ? (initialTab as TabKey) : 'company',
  );

  // Sync tab when the URL changes (back/forward navigation).
  useEffect(() => {
    if (initialTab && TABS.some(t => t.key === initialTab) && initialTab !== tab) {
      setTab(initialTab as TabKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTab]);

  function switchTab(t: TabKey) {
    setTab(t);
    onTabChange?.(t);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{documentsCopy.title}</h1>
          <div className="sub">{documentsCopy.subtitle}</div>
        </div>
      </div>

      <div className="tabs">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`tab${tab === t.key ? ' active' : ''}`}
            onClick={() => switchTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'company' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {DOC_SECTIONS.map(s => (
            <DocumentSection key={s.code} code={s.code} />
          ))}
        </div>
      )}
      {tab === 'statements' && <StatementsTab />}
      {tab === 'reports' && <ReportsTab />}
      {tab === 'occupancy' && <OccupancyTab />}
      {tab === 'fixed-assets' && <FixedAssetsTab />}
    </div>
  );
}
