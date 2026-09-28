import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../data/store';
import { fmtRON, fmtDate, total, REV_STATUS_LABEL, statusBadge } from '../data/types';
import type { Revenue } from '../data/types';
import { Card, Badge, Modal, Empty, Pagination } from '../components/ui';

const TABS = [
  { key: 'inregistrata', label: 'Înregistrate' },
  { key: 'in-asteptare', label: 'În așteptare' },
  { key: 'respinsa', label: 'Respinse' },
] as const;

const PAGE_SIZE = 8;

function RevenueForm({ initial, onSave, onClose }: {
  initial?: Revenue;
  onSave: (r: Omit<Revenue, 'id'>) => void;
  onClose: () => void;
}) {
  const { clients } = useStore();
  const [f, setF] = useState({
    tip: initial?.tip ?? 'factura',
    nr: initial?.nr ?? '',
    date: initial?.date ?? new Date().toISOString().slice(0, 10),
    client: initial?.client ?? '',
    cui: initial?.cui ?? '',
    valoare: initial ? String(initial.valoareFaraTva) : '',
    tva: initial ? String(initial.tva) : '',
    status: initial?.status ?? 'inregistrata',
    statusDetail: initial?.statusDetail ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  const submit = () => {
    const e: Record<string, string> = {};
    if (!f.nr.trim()) e.nr = 'Numărul documentului este obligatoriu';
    if (!f.date) e.date = 'Data este obligatorie';
    if (!f.client.trim()) e.client = 'Clientul este obligatoriu';
    const v = parseFloat(f.valoare.replace(',', '.'));
    const t = parseFloat(f.tva.replace(',', '.'));
    if (!isFinite(v) || v < 0) e.valoare = 'Introduceți o valoare validă';
    if (!isFinite(t) || t < 0) e.tva = 'Introduceți un TVA valid';
    setErrors(e);
    if (Object.keys(e).length) return;
    onSave({
      tip: f.tip as Revenue['tip'], nr: f.nr, date: f.date, client: f.client, cui: f.cui,
      valoareFaraTva: v, tva: t, status: f.status as Revenue['status'],
      statusDetail: f.statusDetail || undefined,
      eFacturaStatus: f.status === 'inregistrata' ? 'Acceptată' : f.status === 'in-asteptare' ? 'În așteptare' : 'Respinsă',
    });
  };

  return (
    <Modal
      title={initial ? `Editează ${initial.nr}` : 'Adaugă venit'}
      onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Anulează</button>
        <button className="btn btn-primary" onClick={submit}>{initial ? 'Salvează' : 'Adaugă'}</button>
      </>}
    >
      <div className="form-grid">
        <div className="field">
          <label>Tip document <span className="req">*</span></label>
          <select value={f.tip} onChange={e => set('tip', e.target.value)}>
            <option value="factura">Factură</option>
            <option value="notafactura">Notă fără factură</option>
          </select>
        </div>
        <div className="field">
          <label>Număr document <span className="req">*</span></label>
          <input className={errors.nr ? 'invalid' : ''} value={f.nr} onChange={e => set('nr', e.target.value)} placeholder="FCT-2025-0045" />
          {errors.nr && <span className="error">{errors.nr}</span>}
        </div>
        <div className="field">
          <label>Data <span className="req">*</span></label>
          <input type="date" className={errors.date ? 'invalid' : ''} value={f.date} onChange={e => set('date', e.target.value)} />
          {errors.date && <span className="error">{errors.date}</span>}
        </div>
        <div className="field">
          <label>Client <span className="req">*</span></label>
          <select className={errors.client ? 'invalid' : ''} value={f.client} onChange={e => {
            const c = clients.find(x => x.denumire === e.target.value);
            setF(p => ({ ...p, client: e.target.value, cui: c?.cui ?? p.cui }));
          }}>
            <option value="">— alege clientul —</option>
            {clients.map(c => <option key={c.id} value={c.denumire}>{c.denumire}</option>)}
          </select>
          {errors.client && <span className="error">{errors.client}</span>}
        </div>
        <div className="field">
          <label>CUI</label>
          <input value={f.cui} onChange={e => set('cui', e.target.value)} placeholder="RO…" />
        </div>
        <div className="field">
          <label>Valoare fără TVA (RON) <span className="req">*</span></label>
          <input className={errors.valoare ? 'invalid' : ''} value={f.valoare} onChange={e => set('valoare', e.target.value)} placeholder="0,00" />
          {errors.valoare && <span className="error">{errors.valoare}</span>}
        </div>
        <div className="field">
          <label>TVA (RON) <span className="req">*</span></label>
          <input className={errors.tva ? 'invalid' : ''} value={f.tva} onChange={e => set('tva', e.target.value)} placeholder="0,00" />
          {errors.tva && <span className="error">{errors.tva}</span>}
        </div>
        <div className="field">
          <label>Status</label>
          <select value={f.status} onChange={e => set('status', e.target.value)}>
            <option value="inregistrata">Înregistrată</option>
            <option value="in-asteptare">În așteptare</option>
            <option value="respinsa">Respinsă</option>
          </select>
        </div>
        {f.status !== 'inregistrata' && (
          <div className="field full">
            <label>Detaliu status</label>
            <input value={f.statusDetail} onChange={e => set('statusDetail', e.target.value)} placeholder="motivul respingerii…" />
          </div>
        )}
      </div>
    </Modal>
  );
}

interface RevenuesProps {
  initialTab?: (typeof TABS)[number]['key'];
  onTabChange?: (tab: (typeof TABS)[number]['key']) => void;
}

export default function Revenues({ initialTab, onTabChange }: RevenuesProps) {
  const { revenues, addRevenue, updateRevenue, deleteRevenue, toast } = useStore();
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>(
    initialTab && TABS.some(t => t.key === initialTab) ? initialTab : 'inregistrata'
  );

  // Sync tab when the URL changes (back/forward navigation).
  useEffect(() => {
    if (initialTab && TABS.some(t => t.key === initialTab) && initialTab !== tab) {
      setTab(initialTab);
      setPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTab]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Revenue | 'new' | null>(null);

  const rows = useMemo(() =>
    revenues
      .filter(r => r.status === tab)
      .filter(r => !search || (r.nr + r.client).toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => b.date.localeCompare(a.date)),
  [revenues, tab, search]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const counts = (k: string) => revenues.filter(r => r.status === k).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Venituri</h1>
          <div className="sub">Facturi și notele fără factură emise de către dvs.</div>
        </div>
        <div className="actions">
          <input
            placeholder="Caută după nr. sau client…"
            style={{ border: '1px solid var(--border-strong)', borderRadius: 6, padding: '7px 10px', fontSize: 13, width: 220 }}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
          <button className="btn btn-primary" onClick={() => setEditing('new')}>+ Adaugă venit</button>
        </div>
      </div>

      <Card>
        <div style={{ padding: '0 18px' }}>
          <div className="tabs">
            {TABS.map(t => (
              <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => { setTab(t.key); setPage(1); onTabChange?.(t.key); }}>
                {t.label}<span className="count">{counts(t.key)}</span>
              </button>
            ))}
          </div>
        </div>
        {pageRows.length === 0 ? (
          <Empty
            title="Niciun venit în această categorie"
            text={search ? 'Niciun rezultat pentru căutare.' : 'Adăugați primul venit pentru a-l vedea aici.'}
            action={<button className="btn btn-primary" onClick={() => setEditing('new')}>+ Adaugă venit</button>}
          />
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Document</th><th>Tip</th><th>Client</th><th>CUI</th><th>Data</th>
                  <th className="amount">Fără TVA</th><th className="amount">TVA</th><th className="amount">Total</th>
                  <th>Status</th><th />
                </tr>
              </thead>
              <tbody>
                {pageRows.map(r => (
                  <tr key={r.id} className="clickable" onClick={() => setEditing(r)}>
                    <td style={{ fontWeight: 500, color: 'var(--text)' }}>{r.nr}</td>
                    <td>{r.tip === 'factura' ? 'Factură' : 'Notă f. factură'}</td>
                    <td>{r.client}</td>
                    <td className="muted">{r.cui}</td>
                    <td>{fmtDate(r.date)}</td>
                    <td className="amount">{fmtRON(r.valoareFaraTva)}</td>
                    <td className="amount">{fmtRON(r.tva)}</td>
                    <td className="amount">{fmtRON(total(r))}</td>
                    <td>
                      <Badge kind={statusBadge(r.status)}>{REV_STATUS_LABEL[r.status]}</Badge>
                      {r.statusDetail && <div className="text-sm muted" style={{ marginTop: 3 }}>{r.statusDetail}</div>}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="btn btn-sm btn-ghost" onClick={e => { e.stopPropagation(); deleteRevenue(r.id); toast('success', `${r.nr} a fost ștearsă`); }}>Șterge</button>
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
        <RevenueForm
          initial={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSave={r => {
            if (editing === 'new') { addRevenue(r); toast('success', `Venitul ${r.nr} a fost adăugat`); }
            else { updateRevenue({ ...r, id: editing.id }); toast('success', `Venitul ${r.nr} a fost actualizat`); }
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
