import { useEffect, useMemo, useState } from 'react';
import { ENTRY_CURRENCIES, formatMoney, moneyInputValue, parseMoneyInput, type CurrencyCode } from '../domain/money';
import { useStore } from '../data/store';
import { fmtDate, total, statusBadge } from '../data/types';
import type { Revenue } from '../data/types';
import { Card, Badge, Modal, Empty, Pagination } from '../components/ui';
import { getLedgerDisclosure } from '../data/dashboard';
import type { CoverageReason } from '../domain/estimateBasis';
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

/**
 * PG-1 — the per-record half of the estimate's coverage, on the revenue side.
 *
 * A revenue leaves the estimate for the one reason this app can name: it is written in a currency for
 * which the store holds no rate, so there is no lei amount to add. That is the Phase 10c ledger
 * disclosure's own finding, and it is read from `getLedgerDisclosure` — the same pass the dashboard's
 * money surfaces read — rather than from a second walk of the register looking for foreign amounts.
 */
function OutOfEstimateNote({ reason }: { reason: CoverageReason | undefined }) {
  if (reason === undefined) return null;
  return (
    <div className="text-sm muted" data-not-in-estimate style={{ marginTop: 3 }}>
      {recordStatus.notInEstimate}: {copy.dashboard.estimate.coverage.reasonLabels[reason]}
    </div>
  );
}

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
    // `moneyInputValue`, not `String(...)`: the stored amount is integer minor units, and an input is a screen.
    // `String(450000)` would show a user 450 000 for 4 500 lei.
    valoare: initial ? moneyInputValue(initial.valoareFaraTva) : '',
    tva: initial ? moneyInputValue(initial.tva) : '',
    // TASK 10a: the currency is part of the amount, so it is a field the user can see and set. It defaults
    // to RON because that is what every existing record was written in.
    currency: (initial?.valoareFaraTva.currency ?? 'RON') as CurrencyCode,
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
    // Phase 10: the form speaks major units, storage speaks minor units. `parseMoneyInput` is the one
    // boundary, and it REFUSES sub-minor-unit precision (`85.555`) instead of rounding it — rounding on the
    // way into a ledger is the silent money change this codebase forbids. The existing messages are
    // unchanged. TASK 10a: the parse is done in the currency the form is set to, so the stored amount and
    // the currency can never disagree.
    const v = parseMoneyInput(f.valoare, f.currency);
    const t = parseMoneyInput(f.tva, f.currency);
    if (v === null || v.amount < 0) e.valoare = validation.amountInvalid;
    if (t === null || t.amount < 0) e.tva = validation.vatInvalid;
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
          <label>{fields.currency} <span className="req">*</span></label>
          <select value={f.currency} onChange={e => set('currency', e.target.value)}>
            {ENTRY_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
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
  /**
   * TASK 8 — the record an attention item pointed at (`/revenues#!/rejected?f=r3`). The page jumps to
   * the page of rows that holds it and marks the row, so the link lands on the document the dashboard
   * named rather than on a list the user has to search.
   */
  focusRecord?: string;
}

export default function Revenues({ initialTab, onTabChange, focusRecord }: RevenuesProps) {
  const store = useStore();
  const { revenues, addRevenue, updateRevenue, deleteRevenue, toast } = store;
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

  // PG-1, landmine 2: the ledger is read through the one disclosure boundary, not re-walked here. The
  // pass is idempotent (`domain/fx/ledger.ts`), so this cannot disagree with the totals the dashboard
  // shows — a local `revenues.filter(r => r.valoareFaraTva.currency !== 'RON')` would have been a second
  // answer to the same question, and the first one to drift.
  const outOfEstimateById = useMemo(() => {
    const map = new Map<string, CoverageReason>();
    for (const u of getLedgerDisclosure(store).unconverted) map.set(u.id, 'missing_fx_rate');
    return map;
  }, [store]);

  // TASK 8: land the focused record on screen, whatever page of the register it sits on.
  const focusIndex = focusRecord ? rows.findIndex(r => r.id === focusRecord) : -1;
  useEffect(() => {
    if (focusIndex >= 0) setPage(Math.floor(focusIndex / PAGE_SIZE) + 1);
  }, [focusIndex]);

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
                  <th>{revenuesCopy.columns.document}</th><th>{revenuesCopy.columns.type}</th><th>{revenuesCopy.columns.client}</th><th>{revenuesCopy.columns.cui}</th><th>{revenuesCopy.columns.date}</th><th>{revenuesCopy.columns.currency}</th>
                  <th className="amount">{revenuesCopy.columns.withoutVat}</th><th className="amount">{revenuesCopy.columns.vat}</th><th className="amount">{revenuesCopy.columns.total}</th>
                  <th>{revenuesCopy.columns.status}</th><th />
                </tr>
              </thead>
              <tbody>
                {pageRows.map(r => (
                  <tr
                    key={r.id}
                    data-record-id={r.id}
                    className={`clickable${r.id === focusRecord ? ' row-focus' : ''}`}
                    onClick={() => setEditing(r)}
                  >
                    <td style={{ fontWeight: 500, color: 'var(--text)' }}>{r.nr}</td>
                    <td>{r.tip === 'factura' ? revenuesCopy.documentTypeCell.factura : revenuesCopy.documentTypeCell.nota}</td>
                    <td>{r.client}</td>
                    <td className="muted">{r.cui}</td>
                    <td>{fmtDate(r.date)}</td>
                    <td>{r.valoareFaraTva.currency}</td>
                    <td className="amount">{formatMoney(r.valoareFaraTva)}</td>
                    <td className="amount">{formatMoney(r.tva)}</td>
                    <td className="amount">{formatMoney(total(r))}</td>
                    <td>
                      <Badge kind={statusBadge(r.status)}>{recordStatus.revenueLabels[r.status]}</Badge>
                      {r.statusDetail && <div className="text-sm muted" style={{ marginTop: 3 }}>{r.statusDetail}</div>}
                      <OutOfEstimateNote reason={outOfEstimateById.get(r.id)} />
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
