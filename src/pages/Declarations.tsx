import { useMemo, useState } from 'react';
import { useStore } from '../data/store';
import { fmtRON, fmtDate, DECL_STATUS_LABEL, statusBadge } from '../data/types';
import type { Declaration, DeclStatus } from '../data/types';
import { Card, Badge, Modal, Empty, Pagination } from '../components/ui';

const TABS = [
  { key: 'inregistrata', label: 'Înregistrate' },
  { key: 'in-asteptare', label: 'În așteptare' },
  { key: 'transmisa', label: 'Transmise' },
  { key: 'respinsa', label: 'Respinse' },
] as const;

const LUNILE = ['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie'];
const PAGE_SIZE = 8;

function DeclForm({ initial, onSave, onClose }: {
  initial?: Declaration;
  onSave: (d: Omit<Declaration, 'id'>) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState({
    an: initial?.an ?? 2025,
    luna: initial?.luna ?? 9,
    venituri: initial ? String(initial.venituri) : '',
    cheltuieli: initial ? String(initial.cheltuieli) : '',
    status: initial?.status ?? 'inregistrata',
    dataInregistrare: initial?.dataInregistrare ?? new Date().toISOString().slice(0, 10),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: string, v: string | number) => setF(p => ({ ...p, [k]: v }));

  const submit = () => {
    const e: Record<string, string> = {};
    if (!f.dataInregistrare) e.dataInregistrare = 'Data este obligatorie';
    const v = parseFloat(String(f.venituri).replace(',', '.'));
    const c = parseFloat(String(f.cheltuieli).replace(',', '.'));
    if (!isFinite(v) || v < 0) e.venituri = 'Introduceți o valoare validă';
    if (!isFinite(c) || c < 0) e.cheltuieli = 'Introduceți o valoare validă';
    setErrors(e);
    if (Object.keys(e).length) return;
    onSave({
      an: f.an, luna: f.luna, venituri: v, cheltuieli: c,
      status: f.status as DeclStatus, dataInregistrare: f.dataInregistrare,
    });
  };

  return (
    <Modal
      title={initial ? `Editează declarația ${initial.an}-${String(initial.luna).padStart(2, '0')}` : 'Adaugă declarație'}
      onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Anulează</button>
        <button className="btn btn-primary" onClick={submit}>{initial ? 'Salvează' : 'Adaugă'}</button>
      </>}
    >
      <div className="form-grid">
        <div className="field">
          <label>An <span className="req">*</span></label>
          <select value={f.an} onChange={e => set('an', Number(e.target.value))}>
            {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Lună <span className="req">*</span></label>
          <select value={f.luna} onChange={e => set('luna', Number(e.target.value))}>
            {LUNILE.map((l, i) => <option key={i + 1} value={i + 1}>{l}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Venituri (RON) <span className="req">*</span></label>
          <input className={errors.venituri ? 'invalid' : ''} value={f.venituri} onChange={e => set('venituri', e.target.value)} placeholder="0,00" />
          {errors.venituri && <span className="error">{errors.venituri}</span>}
        </div>
        <div className="field">
          <label>Cheltuieli (RON) <span className="req">*</span></label>
          <input className={errors.cheltuieli ? 'invalid' : ''} value={f.cheltuieli} onChange={e => set('cheltuieli', e.target.value)} placeholder="0,00" />
          {errors.cheltuieli && <span className="error">{errors.cheltuieli}</span>}
        </div>
        <div className="field">
          <label>Status</label>
          <select value={f.status} onChange={e => set('status', e.target.value)}>
            <option value="inregistrata">Înregistrată</option>
            <option value="in-asteptare">În așteptare</option>
            <option value="transmisa">Transmisa</option>
            <option value="respinsa">Respinsă</option>
          </select>
        </div>
        <div className="field">
          <label>Data înregistrării <span className="req">*</span></label>
          <input type="date" className={errors.dataInregistrare ? 'invalid' : ''} value={f.dataInregistrare} onChange={e => set('dataInregistrare', e.target.value)} />
          {errors.dataInregistrare && <span className="error">{errors.dataInregistrare}</span>}
        </div>
      </div>
    </Modal>
  );
}

export default function Declarations() {
  const { declarations, addDeclaration, updateDeclaration, sendDeclaration, toast } = useStore();
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('inregistrata');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Declaration | 'new' | null>(null);

  const rows = useMemo(() =>
    declarations
      .filter(d => d.status === tab)
      .filter(d => !search || `${d.an}-${String(d.luna).padStart(2, '0')}`.includes(search))
      .sort((a, b) => (b.an * 100 + b.luna) - (a.an * 100 + a.luna)),
  [declarations, tab, search]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const counts = (k: string) => declarations.filter(d => d.status === k).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Declarații</h1>
          <div className="sub">Declarații fiscale lunare — IM, CS, TVA</div>
        </div>
        <div className="actions">
          <input
            placeholder="Caută după perioadă…"
            style={{ border: '1px solid var(--border-strong)', borderRadius: 6, padding: '7px 10px', fontSize: 13, width: 200 }}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
          <button className="btn btn-primary" onClick={() => setEditing('new')}>+ Adaugă declarație</button>
        </div>
      </div>

      <Card>
        <div style={{ padding: '0 18px' }}>
          <div className="tabs">
            {TABS.map(t => (
              <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => { setTab(t.key); setPage(1); }}>
                {t.label}<span className="count">{counts(t.key)}</span>
              </button>
            ))}
          </div>
        </div>
        {pageRows.length === 0 ? (
          <Empty
            icon="📋"
            title="Nicio declarație în această categorie"
            text={search ? 'Niciun rezultat pentru căutare.' : 'Adăugați prima declarație pentru a o vedea aici.'}
            action={<button className="btn btn-primary" onClick={() => setEditing('new')}>+ Adaugă declarație</button>}
          />
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Perioadă</th><th>An</th><th>Lună</th>
                  <th className="amount">Venituri</th><th className="amount">Cheltuieli</th>
                  <th className="amount">Baza impozabilă</th>
                  <th>Status</th><th />
                </tr>
              </thead>
              <tbody>
                {pageRows.map(d => (
                  <tr key={d.id} className="clickable" onClick={() => setEditing(d)}>
                    <td style={{ fontWeight: 500, color: 'var(--text)' }}>{d.an}-{String(d.luna).padStart(2, '0')}</td>
                    <td>{d.an}</td>
                    <td>{LUNILE[d.luna - 1]}</td>
                    <td className="amount">{fmtRON(d.venituri)}</td>
                    <td className="amount">{fmtRON(d.cheltuieli)}</td>
                    <td className="amount">{fmtRON(Math.max(0, d.venituri - d.cheltuieli))}</td>
                    <td>
                      <Badge kind={statusBadge(d.status)}>{DECL_STATUS_LABEL[d.status]}</Badge>
                      {d.dataTrimitere && <div className="text-sm muted" style={{ marginTop: 3 }}>Trimisă {fmtDate(d.dataTrimitere)}</div>}
                    </td>
                    <td>
                      <div className="row-actions">
                        {d.status === 'inregistrata' || d.status === 'in-asteptare' ? (
                          <button className="btn btn-sm btn-primary" onClick={e => { e.stopPropagation(); sendDeclaration(d.id); toast('success', `Declarația ${d.an}-${String(d.luna).padStart(2, '0')} a fost transmisă`); }}>
                            Transmite
                          </button>
                        ) : (
                          <button className="btn btn-sm btn-ghost" onClick={e => { e.stopPropagation(); setEditing(d); }}>Editează</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} pages={pages} total={rows.length} onPage={setPage} />
          </>
        )}
      </Card>

      {editing && (
        <DeclForm
          initial={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSave={d => {
            if (editing !== 'new') {
              updateDeclaration({ ...editing, ...d });
              toast('success', `Declarația ${d.an}-${String(d.luna).padStart(2, '0')} a fost actualizată`);
            } else {
              addDeclaration(d);
              toast('success', `Declarația ${d.an}-${String(d.luna).padStart(2, '0')} a fost adăugată`);
            }
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
