import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../data/store';
import {
  DOC_SECTIONS, DOC_SECTION_MAP, MAX_DOC_BYTES,
  docTipFromName, formatBytes, fmtDate, todayISO,
  downloadDataUrl, downloadText, total,
} from '../data/types';
import type { DocTypeCode, CompanyDocument, TaxStatement } from '../data/types';
import { type Bani, formatBani, formatBaniRON, sumBani, subBani } from '../domain/money';
import { Card, Badge, Modal, Empty } from '../components/ui';
import { copy, documents as documentsCopy, expenses as expensesCopy } from '../ui/copy';

// Canonical route hash keys — mirror the original SOLO Documents feature:
//   documents.company     → "Documente PFA"  (registration documents, real uploads)
//   documents.statements  → "Declarații"     (local registry of filed tax declarations)
//   documents.reports     → "Rapoarte"       (RJIP cashflow registers, CSV download)
const TABS = [
  { key: 'company', label: documentsCopy.tabs.pfa },
  { key: 'statements', label: documentsCopy.tabs.declarations },
  { key: 'reports', label: documentsCopy.tabs.reports },
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
  const [preview, setPreview] = useState<CompanyDocument | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
              {(f.tip === 'jpg' || f.tip === 'png') && f.content && (
                <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12.5 }} onClick={() => setPreview(f)}>
                  {documentsCopy.preview}
                </button>
              )}
              {f.content && (
                <button
                  className="btn btn-ghost"
                  style={{ padding: '4px 10px', fontSize: 12.5 }}
                  onClick={() => downloadDataUrl(f.content!, f.nume)}
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
          Niciun document încărcat.
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
                    {s.nume && s.content ? (
                      <button
                        className="btn btn-ghost"
                        style={{ padding: '3px 8px', fontSize: 12.5 }}
                        onClick={() => downloadDataUrl(s.content!, s.nume!)}
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

function ReportsTab() {
  const { revenues, expenses, toast } = useStore();
  const currentYear = new Date().getFullYear();

  const years = useMemo(() => {
    const ys = new Set<number>([currentYear]);
    for (const r of revenues) ys.add(Number(r.date.slice(0, 4)));
    for (const e of expenses) ys.add(Number(e.date.slice(0, 4)));
    return [...ys].sort((a, b) => b - a);
  }, [revenues, expenses, currentYear]);

  const [year, setYear] = useState(currentYear);

  const rows = useMemo(() => {
    const out: { data: string; descriere: string; venit: Bani; cheltuiala: Bani }[] = [];
    for (const r of revenues) {
      if (r.date.slice(0, 4) === String(year)) {
        out.push({
          data: r.date,
          descriere: `${r.tip === 'factura' ? documentsCopy.rjip.invoiceKind.factura : documentsCopy.rjip.invoiceKind.nota} ${r.nr} – ${r.client}`,
          venit: total(r),
          cheltuiala: 0 as Bani,
        });
      }
    }
    for (const e of expenses) {
      if (e.date.slice(0, 4) === String(year)) {
        out.push({
          data: e.date,
          descriere: `${e.tip === 'factura' ? expensesCopy.documentTypeCell.factura : expensesCopy.documentTypeCell.bon} ${e.nr} – ${e.furnizor}`,
          venit: 0 as Bani,
          cheltuiala: total(e),
        });
      }
    }
    return out.sort((a, b) => a.data.localeCompare(b.data));
  }, [revenues, expenses, year]);

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
    </div>
  );
}
