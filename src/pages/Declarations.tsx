import { useMemo, useState } from 'react';
import { formatBaniRON, leiInputValue, parseLeiInput } from '../domain/money';
import { useStore } from '../data/store';
import { fmtDate, declarationNet, statusBadge } from '../data/types';
import type { Declaration, DeclStatus } from '../data/types';
import { Card, Badge, Modal, Empty, Pagination } from '../components/ui';
import { copy, declarations as declarationsCopy, empty, fields, recordStatus, validation } from '../ui/copy';

const TABS = [
  { key: 'inregistrata', label: recordStatus.tabs.inregistrata },
  { key: 'in-asteptare', label: recordStatus.tabs['in-asteptare'] },
  { key: 'transmisa', label: recordStatus.tabs.transmisa },
  { key: 'respinsa', label: recordStatus.tabs.respinsa },
] as const;

const LUNILE: readonly string[] = declarationsCopy.months;
const PAGE_SIZE = 8;

function DeclForm({ initial, onSave, onClose }: {
  initial?: Declaration;
  onSave: (d: Omit<Declaration, 'id'>) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState({
    an: initial?.an ?? 2025,
    luna: initial?.luna ?? 9,
    // `leiInputValue`, not `String(...)`: stored money is integer bani; an input is a screen.
    venituri: initial ? leiInputValue(initial.venituri) : '',
    cheltuieli: initial ? leiInputValue(initial.cheltuieli) : '',
    status: initial?.status ?? 'inregistrata',
    dataInregistrare: initial?.dataInregistrare ?? new Date().toISOString().slice(0, 10),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: string, v: string | number) => setF(p => ({ ...p, [k]: v }));

  const submit = () => {
    const e: Record<string, string> = {};
    if (!f.dataInregistrare) e.dataInregistrare = validation.dateRequired;
    // Phase 10: form in lei, storage in bani; `parseLeiInput` refuses sub-ban precision rather than rounding.
    const v = parseLeiInput(String(f.venituri));
    const c = parseLeiInput(String(f.cheltuieli));
    if (v === null || v < 0) e.venituri = validation.amountInvalid;
    if (c === null || c < 0) e.cheltuieli = validation.amountInvalid;
    setErrors(e);
    if (Object.keys(e).length) return;
    if (v === null || c === null) return; // unreachable; narrows without a cast
    onSave({
      an: f.an, luna: f.luna, venituri: v, cheltuieli: c,
      status: f.status as DeclStatus, dataInregistrare: f.dataInregistrare,
    });
  };

  return (
    <Modal
      title={initial ? declarationsCopy.editTitle(`${initial.an}-${String(initial.luna).padStart(2, '0')}`) : declarationsCopy.addTitle}
      onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>{copy.ui.cancel}</button>
        <button className="btn btn-primary" onClick={submit}>{initial ? copy.ui.save : copy.ui.add}</button>
      </>}
    >
      <div className="form-grid">
        <div className="field">
          <label>{declarationsCopy.year} <span className="req">*</span></label>
          <select value={f.an} onChange={e => set('an', Number(e.target.value))}>
            {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="field">
          <label>{declarationsCopy.month} <span className="req">*</span></label>
          <select value={f.luna} onChange={e => set('luna', Number(e.target.value))}>
            {LUNILE.map((l, i) => <option key={i + 1} value={i + 1}>{l}</option>)}
          </select>
        </div>
        <div className="field">
          <label>{declarationsCopy.revenue} <span className="req">*</span></label>
          <input className={errors.venituri ? 'invalid' : ''} value={f.venituri} onChange={e => set('venituri', e.target.value)} placeholder={fields.amountPlaceholder} />
          {errors.venituri && <span className="error">{errors.venituri}</span>}
        </div>
        <div className="field">
          <label>{declarationsCopy.expenses} <span className="req">*</span></label>
          <input className={errors.cheltuieli ? 'invalid' : ''} value={f.cheltuieli} onChange={e => set('cheltuieli', e.target.value)} placeholder={fields.amountPlaceholder} />
          {errors.cheltuieli && <span className="error">{errors.cheltuieli}</span>}
        </div>
        <div className="field">
          <label>{fields.status}</label>
          <select value={f.status} onChange={e => set('status', e.target.value)}>
            <option value="inregistrata">{recordStatus.labels.inregistrata}</option>
            <option value="in-asteptare">{recordStatus.labels['in-asteptare']}</option>
            <option value="transmisa">{recordStatus.labels.transmisa}</option>
            <option value="respinsa">{recordStatus.labels.respinsa}</option>
          </select>
        </div>
        <div className="field">
          <label>{declarationsCopy.registrationDate} <span className="req">*</span></label>
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
          <h1>{declarationsCopy.title}</h1>
          <div className="sub">{declarationsCopy.subtitle}</div>
        </div>
        <div className="actions">
          <input
            placeholder={declarationsCopy.searchPlaceholder}
            style={{ border: '1px solid var(--border-strong)', borderRadius: 6, padding: '7px 10px', fontSize: 13, width: 200 }}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
          <button className="btn btn-primary" onClick={() => setEditing('new')}>+ {declarationsCopy.add}</button>
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
            title={declarationsCopy.emptyTitle}
            text={search ? empty.noSearchResults : declarationsCopy.emptyBody}
            action={<button className="btn btn-primary" onClick={() => setEditing('new')}>+ {declarationsCopy.add}</button>}
          />
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>{declarationsCopy.columns.period}</th><th>{declarationsCopy.columns.year}</th><th>{declarationsCopy.columns.month}</th>
                  <th className="amount">{declarationsCopy.columns.revenue}</th><th className="amount">{declarationsCopy.columns.expenses}</th>
                  <th className="amount">{declarationsCopy.columns.taxableBase}</th>
                  <th>{declarationsCopy.columns.status}</th><th />
                </tr>
              </thead>
              <tbody>
                {pageRows.map(d => (
                  <tr key={d.id} className="clickable" onClick={() => setEditing(d)}>
                    <td style={{ fontWeight: 500, color: 'var(--text)' }}>{d.an}-{String(d.luna).padStart(2, '0')}</td>
                    <td>{d.an}</td>
                    <td>{LUNILE[d.luna - 1]}</td>
                    <td className="amount">{formatBaniRON(d.venituri)}</td>
                    <td className="amount">{formatBaniRON(d.cheltuieli)}</td>
                    <td className="amount">{formatBaniRON(declarationNet(d))}</td>
                    <td>
                      <Badge kind={statusBadge(d.status)}>{recordStatus.labels[d.status]}</Badge>
                      {d.dataTrimitere && <div className="text-sm muted" style={{ marginTop: 3 }}>{declarationsCopy.submittedOn} {fmtDate(d.dataTrimitere)}</div>}
                    </td>
                    <td>
                      <div className="row-actions">
                        {d.status === 'inregistrata' || d.status === 'in-asteptare' ? (
                          <button className="btn btn-sm btn-primary" onClick={e => { e.stopPropagation(); sendDeclaration(d.id); toast('success', declarationsCopy.submitted(`${d.an}-${String(d.luna).padStart(2, '0')}`)); }}>
                            {declarationsCopy.submit}
                          </button>
                        ) : (
                          <button className="btn btn-sm btn-ghost" onClick={e => { e.stopPropagation(); setEditing(d); }}>{copy.ui.edit}</button>
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
              toast('success', declarationsCopy.updated(`${d.an}-${String(d.luna).padStart(2, '0')}`));
            } else {
              addDeclaration(d);
              toast('success', declarationsCopy.added(`${d.an}-${String(d.luna).padStart(2, '0')}`));
            }
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
