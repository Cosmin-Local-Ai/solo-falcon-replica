import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../data/store';
import {
  DOC_SECTIONS, DOC_SECTION_MAP, MAX_DOC_BYTES,
  docTipFromName, formatBytes, fmtDate, todayISO,
  downloadDataUrl, downloadText, total,
} from '../data/types';
import type { DocTypeCode, CompanyDocument, TaxStatement } from '../data/types';
import { Card, Badge, Modal, Empty } from '../components/ui';

// Canonical route hash keys — mirror the original SOLO Documents feature:
//   documents.company     → "Documente PFA"  (registration documents, real uploads)
//   documents.statements  → "Declarații"     (local registry of filed tax declarations)
//   documents.reports     → "Rapoarte"       (RJIP cashflow registers, CSV download)
const TABS = [
  { key: 'company', label: 'Documente PFA' },
  { key: 'statements', label: 'Declarații' },
  { key: 'reports', label: 'Rapoarte' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

const TIP_ICON: Partial<Record<CompanyDocument['tip'], string>> = {
  pdf: '📄', jpg: '🖼', png: '🖼',
};

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
      toast('error', 'Format acceptat: PDF, JPG, PNG');
      return;
    }
    if (file.size > MAX_DOC_BYTES) {
      toast('error', 'Fișierul depășește 2 MB — stocarea locală nu e suficientă');
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
      toast('success', `„${file.name}" a fost încărcat`);
    } catch {
      toast('error', 'Nu am putut citi fișierul');
    }
  }

  return (
    <Card>
      <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            {def.title}
            {def.allowMultiple && (
              <span title="Se pot încărca mai multe documente" style={{ marginLeft: 8, cursor: 'help' }}>ⓘ</span>
            )}
          </div>
          {def.helper && (
            <div style={{ marginTop: 4 }}>
              <button
                className="btn btn-ghost"
                style={{ padding: '2px 8px', fontSize: 12 }}
                onClick={() => setHelperOpen(o => !o)}
              >
                {helperOpen ? 'Ascunde exemplele' : 'Vezi exemple'}
              </button>
              {helperOpen && (
                <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--text-3)' }}>
                  {def.helper}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="actions">
          <button className="btn btn-primary" onClick={() => fileRef.current?.click()}>
            {files.length ? 'Încarcă alt document' : 'Încarcă document'}
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
                  Previzualizează
                </button>
              )}
              {f.content && (
                <button
                  className="btn btn-ghost"
                  style={{ padding: '4px 10px', fontSize: 12.5 }}
                  onClick={() => downloadDataUrl(f.content!, f.nume)}
                >
                  Descarcă
                </button>
              )}
              <button
                className="btn btn-ghost"
                style={{ padding: '4px 10px', fontSize: 12.5, color: 'var(--danger)' }}
                onClick={() => {
                  deleteDocument(code, f.id);
                  toast('info', `„${f.nume}" a fost șters`);
                }}
              >
                Șterge
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
      setErrors(p => ({ ...p, fisier: 'Doar fișiere PDF' }));
      return;
    }
    if (file.size > MAX_DOC_BYTES) {
      setErrors(p => ({ ...p, fisier: 'Maxim 2 MB' }));
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
    if (!f.tip.trim()) e.tip = 'Tipul declarației este obligatoriu';
    if (!f.perioada.trim()) e.perioada = 'Perioada este obligatorie';
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
      title="Adaugă declarație depusă"
      onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Anulează</button>
        <button className="btn btn-primary" onClick={submit}>Salvează</button>
      </>}
    >
      <div className="form-grid">
        <div className="field">
          <label>Tip declarație *</label>
          <input
            value={f.tip}
            onChange={e => set('tip', e.target.value)}
            placeholder="ex. D101, D112, D200, 220, 221…"
          />
          {errors.tip && <span className="error">{errors.tip}</span>}
        </div>
        <div className="field">
          <label>Perioadă *</label>
          <input
            value={f.perioada}
            onChange={e => set('perioada', e.target.value)}
            placeholder="ex. I–IV 2025, luna martie 2025"
          />
          {errors.perioada && <span className="error">{errors.perioada}</span>}
        </div>
        <div className="field">
          <label>Mod de depunere</label>
          <select value={f.depunere} onChange={e => set('depunere', e.target.value)}>
            <option value="SOLO">Prin SOLO</option>
            <option value="personală">Personală</option>
          </select>
        </div>
        <div className="field">
          <label>Data depunerii</label>
          <input type="date" value={f.dataDepunere} onChange={e => set('dataDepunere', e.target.value)} />
        </div>
        <div className="field full">
          <label>Fișier PDF atașat (opțional)</label>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf"
            style={{ display: 'none' }}
            onChange={onFile}
          />
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
            {f.nume ? `Schimbă: ${f.nume}` : 'Alege un PDF'}
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
                <th style={{ padding: '10px 12px' }}>Tip</th>
                <th style={{ padding: '10px 12px' }}>Perioadă</th>
                <th style={{ padding: '10px 12px' }}>Depunere</th>
                <th style={{ padding: '10px 12px' }}>Data</th>
                <th style={{ padding: '10px 12px' }}>Fișier</th>
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
                      {s.depunere}
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
                      Șterge
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
            title="Nicio declarație înregistrată"
            text="Înregistrează aici declarațiile fiscale depuse (D101, D112, 220, 221…) cu perioada și modul de depunere."
            action={<button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Adaugă declarație</button>}
          />
        </div>
      )}
      {rows.length > 0 && (
        <div style={{ padding: '12px 18px', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Adaugă declarație</button>
        </div>
      )}

      {showAdd && (
        <StatementForm
          onClose={() => setShowAdd(false)}
          onSave={s => {
            addStatement(s);
            toast('success', `Declarația ${s.tip} (${s.perioada}) a fost înregistrată`);
            setShowAdd(false);
          }}
        />
      )}

      {confirmDelete && (
        <Modal
          title="Șterge declarația?"
          onClose={() => setConfirmDelete(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>Anulează</button>
            <button
              className="btn btn-danger"
              onClick={() => {
                deleteStatement(confirmDelete.id);
                toast('info', 'Declarația a fost ștearsă');
                setConfirmDelete(null);
              }}
            >
              Șterge
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

function rjipCsv(year: number, rows: { data: string; descriere: string; venit: number; cheltuiala: number }[]): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = [
    'Data;Descriere;Venit (RON);Cheltuiala (RON)',
    ...rows.map(r =>
      [r.data, esc(r.descriere), r.venit.toFixed(2).replace('.', ','), r.cheltuiala.toFixed(2).replace('.', ',')].join(';'),
    ),
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
    const out: { data: string; descriere: string; venit: number; cheltuiala: number }[] = [];
    for (const r of revenues) {
      if (r.date.slice(0, 4) === String(year)) {
        out.push({
          data: r.date,
          descriere: `${r.tip === 'factura' ? 'Factură' : 'Notă de factură'} ${r.nr} – ${r.client}`,
          venit: total(r),
          cheltuiala: 0,
        });
      }
    }
    for (const e of expenses) {
      if (e.date.slice(0, 4) === String(year)) {
        out.push({
          data: e.date,
          descriere: `${e.tip === 'factura' ? 'Factură' : 'Bon fiscal'} ${e.nr} – ${e.furnizor}`,
          venit: 0,
          cheltuiala: total(e),
        });
      }
    }
    return out.sort((a, b) => a.data.localeCompare(b.data));
  }, [revenues, expenses, year]);

  const venit = rows.reduce((s, r) => s + r.venit, 0);
  const chelt = rows.reduce((s, r) => s + r.cheltuiala, 0);

  function download() {
    if (!rows.length) {
      toast('info', `Niciun flux de trezorerie pentru ${year}`);
      return;
    }
    downloadText(rjipCsv(year, rows), `RJIP_${year}.csv`);
    toast('success', `RJIP ${year} a fost generat (${rows.length} rânduri)`);
  }

  return (
    <Card>
      <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13.5 }}>
          Raport de mișcări de trezorerie (RJIP) — generat din datele din Venituri și Cheltuieli.
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
          <button className="btn btn-primary" onClick={download}>⬇ Descarcă CSV</button>
        </div>
      </div>
      <div style={{ borderTop: '1px solid var(--border)', padding: '14px 18px', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Venituri {year}</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{venit.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} RON</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Cheltuieli {year}</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{chelt.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} RON</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Sold</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: venit - chelt >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {(venit - chelt).toLocaleString('ro-RO', { minimumFractionDigits: 2 })} RON
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Rânduri</div>
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
          <h1>Documente</h1>
          <div className="sub">Documente de înregistrare, declarații fiscale și rapoarte de trezorerie — stocate local.</div>
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
