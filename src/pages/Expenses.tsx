import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../data/store';
import { fmtRON, fmtDate, total, EXP_STATUS_LABEL, statusBadge } from '../data/types';
import type { Expense } from '../data/types';
import { Card, Badge, Modal, Empty, Pagination } from '../components/ui';

const TABS = [
  { key: 'inregistrata', label: 'Înregistrate' },
  { key: 'respinsa', label: 'Respinse' },
] as const;

const PAGE_SIZE = 8;

function ExpenseForm({ initial, onSave, onClose }: {
  initial?: Expense;
  onSave: (e: Omit<Expense, 'id'>) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState({
    tip: initial?.tip ?? 'factura',
    nr: initial?.nr ?? '',
    date: initial?.date ?? new Date().toISOString().slice(0, 10),
    furnizor: initial?.furnizor ?? '',
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
    if (!f.furnizor.trim()) e.furnizor = 'Furnizorul este obligatoriu';
    const v = parseFloat(f.valoare.replace(',', '.'));
    const t = parseFloat(f.tva.replace(',', '.'));
    if (!isFinite(v) || v < 0) e.valoare = 'Introduceți o valoare validă';
    if (!isFinite(t) || t < 0) e.tva = 'Introduceți un TVA valid';
    setErrors(e);
    if (Object.keys(e).length) return;
    onSave({
      tip: f.tip as Expense['tip'], nr: f.nr, date: f.date, furnizor: f.furnizor, cui: f.cui,
      valoareFaraTva: v, tva: t, status: f.status as Expense['status'],
      statusDetail: f.statusDetail || undefined,
    });
  };

  return (
    <Modal
      title={initial ? `Editează ${initial.nr}` : 'Adaugă cheltuială'}
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
            <option value="bon-fiscal">Bon fiscal</option>
          </select>
        </div>
        <div className="field">
          <label>Număr document <span className="req">*</span></label>
          <input className={errors.nr ? 'invalid' : ''} value={f.nr} onChange={e => set('nr', e.target.value)} placeholder="FCT-09-112043" />
          {errors.nr && <span className="error">{errors.nr}</span>}
        </div>
        <div className="field">
          <label>Data <span className="req">*</span></label>
          <input type="date" className={errors.date ? 'invalid' : ''} value={f.date} onChange={e => set('date', e.target.value)} />
          {errors.date && <span className="error">{errors.date}</span>}
        </div>
        <div className="field">
          <label>Furnizor <span className="req">*</span></label>
          <input className={errors.furnizor ? 'invalid' : ''} value={f.furnizor} onChange={e => set('furnizor', e.target.value)} placeholder="SC … SA" />
          {errors.furnizor && <span className="error">{errors.furnizor}</span>}
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

interface ExpensesProps {
  initialTab?: (typeof TABS)[number]['key'];
  onTabChange?: (tab: (typeof TABS)[number]['key']) => void;
}

export default function Expenses({ initialTab, onTabChange }: ExpensesProps) {
  const { expenses, addExpense, updateExpense, deleteExpense, toast } = useStore();
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
  const [editing, setEditing] = useState<Expense | 'new' | null>(null);

  const rows = useMemo(() =>
    expenses
      .filter(e => e.status === tab)
      .filter(e => !search || (e.nr + e.furnizor).toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => b.date.localeCompare(a.date)),
  [expenses, tab, search]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const counts = (k: string) => expenses.filter(e => e.status === k).length;
  const sum = rows.reduce((s, e) => s + total(e), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Cheltuieli</h1>
          <div className="sub">Facturi și bonuri fiscale primite de la furnizori.</div>
        </div>
        <div className="actions">
          <input
            placeholder="Caută după nr. sau furnizor…"
            style={{ border: '1px solid var(--border-strong)', borderRadius: 6, padding: '7px 10px', fontSize: 13, width: 220 }}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
          <button className="btn btn-primary" onClick={() => setEditing('new')}>+ Adaugă cheltuială</button>
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
            title="Nicio cheltuială în această categorie"
            text={search ? 'Niciun rezultat pentru căutare.' : 'Adăugați prima cheltuială pentru a o vedea aici.'}
            action={<button className="btn btn-primary" onClick={() => setEditing('new')}>+ Adaugă cheltuială</button>}
          />
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Document</th><th>Tip</th><th>Furnizor</th><th>CUI</th><th>Data</th>
                  <th className="amount">Fără TVA</th><th className="amount">TVA</th><th className="amount">Total</th>
                  <th>Status</th><th />
                </tr>
              </thead>
              <tbody>
                {pageRows.map(e => (
                  <tr key={e.id} className="clickable" onClick={() => setEditing(e)}>
                    <td style={{ fontWeight: 500, color: 'var(--text)' }}>{e.nr}</td>
                    <td>{e.tip === 'factura' ? 'Factură' : 'Bon fiscal'}</td>
                    <td>{e.furnizor}</td>
                    <td className="muted">{e.cui}</td>
                    <td>{fmtDate(e.date)}</td>
                    <td className="amount">{fmtRON(e.valoareFaraTva)}</td>
                    <td className="amount">{fmtRON(e.tva)}</td>
                    <td className="amount">{fmtRON(total(e))}</td>
                    <td>
                      <Badge kind={statusBadge(e.status)}>{EXP_STATUS_LABEL[e.status]}</Badge>
                      {e.statusDetail && <div className="text-sm muted" style={{ marginTop: 3 }}>{e.statusDetail}</div>}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="btn btn-sm btn-ghost" onClick={ev => { ev.stopPropagation(); deleteExpense(e.id); toast('success', `${e.nr} a fost ștearsă`); }}>Șterge</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={7} style={{ textAlign: 'right' }} className="muted">Total: {rows.length} documente</td>
                  <td className="amount" style={{ fontWeight: 600 }}>{fmtRON(sum)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
            <Pagination page={page} pages={pages} total={rows.length} onPage={setPage} />
          </>
        )}
      </Card>

      {editing && (
        <ExpenseForm
          initial={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSave={e => {
            if (editing === 'new') { addExpense(e); toast('success', `Cheltuiala ${e.nr} a fost adăugată`); }
            else { updateExpense({ ...e, id: editing.id }); toast('success', `Cheltuiala ${e.nr} a fost actualizată`); }
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
