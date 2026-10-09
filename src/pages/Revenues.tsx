import { useEffect, useMemo, useState } from 'react';
import { formatBaniRON, leiInputValue, parseLeiInput } from '../domain/money';
import { useStore } from '../data/store';
import { fmtDate, total, statusBadge } from '../data/types';
import type { Revenue } from '../data/types';
import { Card, Badge, Modal, Empty, Pagination } from '../components/ui';
import { copy, empty, fields, recordStatus, revenues as revenuesCopy, validation } from '../ui/copy';

// Canonical route hash keys (English) mapped to the Romanian data statuses.
const TABS = [
  { key: 'registered', label: recordStatus.tabs.inregistrata, status: 'inregistrata' },
  { key: 'pending', label: recordStatus.tabs['in-asteptare'], status: 'in-asteptare' },
  { key: 'rejected', label: recordStatus.tabs.respinsa, status: 'respinsa' },
] as const;

const statusFor = (tab: (typeof TABS)[number]['key']) =>
  TABS.find(t => t.key === tab)!.status;

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
    // `leiInputValue`, not `String(...)`: the stored amount is integer bani, and an input is a screen.
    // `String(450000)` would show a user 450 000 for 4 500 lei.
    valoare: initial ? leiInputValue(initial.valoareFaraTva) : '',
    tva: initial ? leiInputValue(initial.tva) : '',
    status: initial?.status ?? 'inregistrata',
    statusDetail: initial?.statusDetail ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  const submit = () => {
    const e: Record<string, string> = {};
    if (!f.nr.trim()) e.nr = validation.documentNumberRequired;
    if (!f.date) e.date = validation.dateRequired;
    if (!f.client.trim()) e.client = validation.clientRequired;
    // Phase 10: the form speaks lei, storage speaks bani. `parseLeiInput` is the one boundary, and it
    // REFUSES sub-ban precision (`85.555`) instead of rounding it — rounding on the way into a ledger is the
    // silent money change this phase forbids. The existing messages are unchanged.
    const v = parseLeiInput(f.valoare);
    const t = parseLeiInput(f.tva);
    if (v === null || v < 0) e.valoare = validation.amountInvalid;
    if (t === null || t < 0) e.tva = validation.vatInvalid;
    setErrors(e);
    if (Object.keys(e).length) return;
    // Unreachable — the two checks above already recorded an error for a null. It exists so the compiler
    // knows the values are non-null below, without a cast that could hide a real null.
    if (v === null || t === null) return;
    onSave({
      tip: f.tip as Revenue['tip'], nr: f.nr, date: f.date, client: f.client, cui: f.cui,
      valoareFaraTva: v, tva: t, status: f.status as Revenue['status'],
      statusDetail: f.statusDetail || undefined,
      eFacturaStatus: f.status === 'inregistrata' ? 'Acceptată' : f.status === 'in-asteptare' ? 'În așteptare' : 'Respinsă',
    });
  };

  return (
    <Modal
      title={initial ? revenuesCopy.editTitle(initial.nr) : revenuesCopy.addTitle}
      onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>{copy.ui.cancel}</button>
        <button className="btn btn-primary" onClick={submit}>{initial ? copy.ui.save : copy.ui.add}</button>
      </>}
    >
      <div className="form-grid">
        <div className="field">
          <label>{fields.documentType} <span className="req">*</span></label>
          <select value={f.tip} onChange={e => set('tip', e.target.value)}>
            <option value="factura">{revenuesCopy.documentTypes.factura}</option>
            <option value="notafactura">{revenuesCopy.documentTypes.nota}</option>
          </select>
        </div>
        <div className="field">
          <label>{fields.documentNumber} <span className="req">*</span></label>
          <input className={errors.nr ? 'invalid' : ''} value={f.nr} onChange={e => set('nr', e.target.value)} placeholder={revenuesCopy.documentNumberPlaceholder} />
          {errors.nr && <span className="error">{errors.nr}</span>}
        </div>
        <div className="field">
          <label>{fields.date} <span className="req">*</span></label>
          <input type="date" className={errors.date ? 'invalid' : ''} value={f.date} onChange={e => set('date', e.target.value)} />
          {errors.date && <span className="error">{errors.date}</span>}
        </div>
        <div className="field">
          <label>{revenuesCopy.columns.client} <span className="req">*</span></label>
          <select className={errors.client ? 'invalid' : ''} value={f.client} onChange={e => {
            const c = clients.find(x => x.denumire === e.target.value);
            setF(p => ({ ...p, client: e.target.value, cui: c?.cui ?? p.cui }));
          }}>
            <option value="">{revenuesCopy.clientSelectPlaceholder}</option>
            {clients.map(c => <option key={c.id} value={c.denumire}>{c.denumire}</option>)}
          </select>
          {errors.client && <span className="error">{errors.client}</span>}
        </div>
        <div className="field">
          <label>{fields.cui}</label>
          <input value={f.cui} onChange={e => set('cui', e.target.value)} placeholder={fields.cuiPlaceholder} />
        </div>
        <div className="field">
          <label>{fields.amountWithoutVat} <span className="req">*</span></label>
          <input className={errors.valoare ? 'invalid' : ''} value={f.valoare} onChange={e => set('valoare', e.target.value)} placeholder={fields.amountPlaceholder} />
          {errors.valoare && <span className="error">{errors.valoare}</span>}
        </div>
        <div className="field">
          <label>{fields.vatAmount} <span className="req">*</span></label>
          <input className={errors.tva ? 'invalid' : ''} value={f.tva} onChange={e => set('tva', e.target.value)} placeholder={fields.amountPlaceholder} />
          {errors.tva && <span className="error">{errors.tva}</span>}
        </div>
        <div className="field">
          <label>{fields.status}</label>
          <select value={f.status} onChange={e => set('status', e.target.value)}>
            <option value="inregistrata">{recordStatus.labels.inregistrata}</option>
            <option value="in-asteptare">{recordStatus.labels['in-asteptare']}</option>
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
    initialTab && TABS.some(t => t.key === initialTab) ? initialTab : 'registered'
  );

  // Sync tab when the URL changes (back/forward navigation). When the URL has no
  // valid tab key (bare /revenues), reset to the canonical default `registered`.
  useEffect(() => {
    const next = initialTab && TABS.some(t => t.key === initialTab) ? initialTab : 'registered';
    if (next !== tab) {
      setTab(next);
      setPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTab]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Revenue | 'new' | null>(null);

  const rows = useMemo(() =>
    revenues
      .filter(r => r.status === statusFor(tab))
      .filter(r => !search || (r.nr + r.client).toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => b.date.localeCompare(a.date)),
  [revenues, tab, search]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const counts = (k: (typeof TABS)[number]['key']) =>
    revenues.filter(r => r.status === statusFor(k)).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{revenuesCopy.title}</h1>
          <div className="sub">{revenuesCopy.subtitle}</div>
        </div>
        <div className="actions">
          <input
            placeholder={revenuesCopy.searchPlaceholder}
            style={{ border: '1px solid var(--border-strong)', borderRadius: 6, padding: '7px 10px', fontSize: 13, width: 220 }}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
          <button className="btn btn-primary" onClick={() => setEditing('new')}>+ {revenuesCopy.add}</button>
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
            title={revenuesCopy.emptyTitle}
            text={search ? empty.noSearchResults : revenuesCopy.emptyBody}
            action={<button className="btn btn-primary" onClick={() => setEditing('new')}>+ {revenuesCopy.add}</button>}
          />
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>{revenuesCopy.columns.document}</th><th>{revenuesCopy.columns.type}</th><th>{revenuesCopy.columns.client}</th><th>{revenuesCopy.columns.cui}</th><th>{revenuesCopy.columns.date}</th>
                  <th className="amount">{revenuesCopy.columns.withoutVat}</th><th className="amount">{revenuesCopy.columns.vat}</th><th className="amount">{revenuesCopy.columns.total}</th>
                  <th>{revenuesCopy.columns.status}</th><th />
                </tr>
              </thead>
              <tbody>
                {pageRows.map(r => (
                  <tr key={r.id} className="clickable" onClick={() => setEditing(r)}>
                    <td style={{ fontWeight: 500, color: 'var(--text)' }}>{r.nr}</td>
                    <td>{r.tip === 'factura' ? revenuesCopy.documentTypeCell.factura : revenuesCopy.documentTypeCell.nota}</td>
                    <td>{r.client}</td>
                    <td className="muted">{r.cui}</td>
                    <td>{fmtDate(r.date)}</td>
                    <td className="amount">{formatBaniRON(r.valoareFaraTva)}</td>
                    <td className="amount">{formatBaniRON(r.tva)}</td>
                    <td className="amount">{formatBaniRON(total(r))}</td>
                    <td>
                      <Badge kind={statusBadge(r.status)}>{recordStatus.revenueLabels[r.status]}</Badge>
                      {r.statusDetail && <div className="text-sm muted" style={{ marginTop: 3 }}>{r.statusDetail}</div>}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="btn btn-sm btn-ghost" onClick={e => { e.stopPropagation(); deleteRevenue(r.id); toast('success', revenuesCopy.deleted(r.nr)); }}>{copy.ui.remove}</button>
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
            if (editing === 'new') { addRevenue(r); toast('success', revenuesCopy.added(r.nr)); }
            else { updateRevenue({ ...r, id: editing.id }); toast('success', revenuesCopy.updated(r.nr)); }
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
