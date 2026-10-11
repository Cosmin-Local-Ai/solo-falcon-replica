import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../data/store';
import { fmtDate, statusBadge, type AnnualFiling, type Declaration, type FilingStatus } from '../data/types';
import { formatBaniRON } from '../domain/money';
import { Card, Badge, Modal, Empty, Pagination } from '../components/ui';
import { localDateISO } from '../domain/date';
import {
  copy,
  declarations as declarationsCopy,
  empty,
  fields,
  recordStatus,
} from '../ui/copy';

/**
 * PG-5 (B-34) — the annual return register.
 *
 * This page used to be monthly: `{an, luna, venituri, cheltuieli, status}`. That shape could not hold
 * the one return this profile actually owes — a Declarația Unică 212 declares a WHOLE fiscal year and
 * is filed in the year after it (CF art. 122 alin. (3)) — and it let a monthly row stand in for a
 * filing. The record here is `AnnualFiling`: the year it DECLARES, the form, the status, and the date
 * it was actually filed.
 *
 * Two things the page deliberately does not do:
 *
 * - It does not offer to create a monthly declaration. The store no longer exposes `addDeclaration`,
 *   because the app has no evidence of a monthly obligation for this profile and no business creating
 *   records it cannot stand behind.
 * - It does not treat a legacy monthly row as a filing. Those rows are listed below the register,
 *   read-only, under their own heading — kept because they are the only place some of those figures
 *   exist, and labelled because keeping a record readable is not the same as endorsing what it seems
 *   to prove.
 */

const PAGE_SIZE = 8;

const FILING_STATUSES: readonly FilingStatus[] = ['in_pregatire', 'depusa', 'respinsa'];

const FILING_BADGE: Record<FilingStatus, 'badge-neutral' | 'badge-info' | 'badge-success' | 'badge-danger'> = {
  in_pregatire: 'badge-info',
  depusa: 'badge-success',
  respinsa: 'badge-danger',
};

/** The years a return can declare: this view's fiscal year and the four before it. */
function declareableYears(fiscalYear: number): number[] {
  const years: number[] = [];
  for (let y = fiscalYear; y > fiscalYear - 5; y--) years.push(y);
  return years;
}

function FilingForm({
  initial,
  years,
  onSave,
  onClose,
}: {
  initial?: AnnualFiling;
  years: number[];
  onSave: (f: Omit<AnnualFiling, 'id'>) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState({
    taxYear: initial?.taxYear ?? years[0],
    status: initial?.status ?? 'in_pregatire',
    // Absence is the honest default. A filed date is only offered once the status says the return was
    // filed; pre-filling today's date would mint a submission date nobody recorded.
    filedOn: initial?.filedOn ?? '',
    reference: initial?.reference ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: string, v: string | number) => setF(p => ({ ...p, [k]: v }));

  const submit = () => {
    const e: Record<string, string> = {};
    if (!f.status) e.status = declarationsCopy.statusRequired;
    if (f.status === 'depusa' && !f.filedOn) e.filedOn = declarationsCopy.filedOnRequired;
    setErrors(e);
    if (Object.keys(e).length) return;
    onSave({
      taxYear: f.taxYear,
      form: 'D212',
      status: f.status as FilingStatus,
      ...(f.filedOn ? { filedOn: f.filedOn } : {}),
      ...(f.reference.trim() ? { reference: f.reference.trim() } : {}),
    });
  };

  return (
    <Modal
      title={initial ? declarationsCopy.editTitle(initial.taxYear) : declarationsCopy.addTitle}
      onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>{copy.ui.cancel}</button>
        <button className="btn btn-primary" onClick={submit}>{initial ? copy.ui.save : copy.ui.add}</button>
      </>}
    >
      <div className="form-grid">
        <div className="field">
          <label>{declarationsCopy.taxYear} <span className="req">*</span></label>
          <select value={f.taxYear} onChange={e => set('taxYear', Number(e.target.value))}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="field">
          <label>{declarationsCopy.form}</label>
          {/* The form is not a free field: D212 is the return this profile files. A select with one
              option would be a control that can only be answered one way. */}
          <input value="D212" readOnly />
        </div>
        <div className="field">
          <label>{fields.status} <span className="req">*</span></label>
          <select value={f.status} onChange={e => set('status', e.target.value)}>
            {FILING_STATUSES.map(s => (
              <option key={s} value={s}>{recordStatus.filingLabels[s]}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>{declarationsCopy.filedOn}</label>
          <input
            type="date"
            className={errors.filedOn ? 'invalid' : ''}
            value={f.filedOn}
            max={localDateISO()}
            onChange={e => set('filedOn', e.target.value)}
          />
          {errors.filedOn
            ? <span className="error">{errors.filedOn}</span>
            : <span className="hint">{declarationsCopy.filedOnHint}</span>}
        </div>
        <div className="field">
          <label>{declarationsCopy.reference}</label>
          <input value={f.reference} onChange={e => set('reference', e.target.value)} />
          <span className="hint">{declarationsCopy.referenceHint}</span>
        </div>
      </div>
    </Modal>
  );
}

/**
 * The monthly rows a pre-v11 install carried. Read-only by construction: this component has no write
 * path, and the store no longer offers one.
 */
function LegacyMonthly({ rows, focusRecord }: { rows: readonly Declaration[]; focusRecord?: string }) {
  return (
    <Card>
      <div style={{ padding: '16px 18px 0' }}>
        <h2 className="card-title">{declarationsCopy.legacyTitle}</h2>
        <p className="hint">{declarationsCopy.legacyNote}</p>
      </div>
      {rows.length === 0 ? (
        <p className="hint" style={{ padding: '12px 18px' }}>{declarationsCopy.legacyEmpty}</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>{declarationsCopy.legacyColumns.period}</th>
              <th className="amount">{declarationsCopy.legacyColumns.revenue}</th>
              <th className="amount">{declarationsCopy.legacyColumns.expenses}</th>
              <th>{declarationsCopy.legacyColumns.status}</th>
              <th>{declarationsCopy.legacyColumns.registeredOn}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(d => (
              <tr key={d.id} data-record-id={d.id} className={d.id === focusRecord ? ' row-focus' : ''}>
                <td>{d.an}-{String(d.luna).padStart(2, '0')}</td>
                <td className="amount">{formatBaniRON(d.venituri)}</td>
                <td className="amount">{formatBaniRON(d.cheltuieli)}</td>
                <td>
                  <Badge kind={statusBadge(d.status)}>{recordStatus.labels[d.status]}</Badge>
                </td>
                <td>{fmtDate(d.dataInregistrare)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

interface DeclarationsProps {
  /** TASK 8 — the record an attention item pointed at; see `Revenues.tsx focusRecord`. */
  focusRecord?: string;
}

export default function Declarations({ focusRecord }: DeclarationsProps) {
  const { filings, legacyDeclarations, profile, addFiling, updateFiling, toast } = useStore();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<AnnualFiling | 'new' | null>(null);

  const years = useMemo(() => declareableYears(profile.fiscalYear), [profile.fiscalYear]);

  const rows = useMemo(() =>
    filings
      .filter(f => !search || String(f.taxYear).includes(search))
      .sort((a, b) => b.taxYear - a.taxYear),
  [filings, search]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const legacyRows = useMemo(
    () => [...legacyDeclarations].sort((a, b) => (b.an * 100 + b.luna) - (a.an * 100 + a.luna)),
    [legacyDeclarations],
  );

  // TASK 8: land the focused record on screen, whatever page of the register it sits on.
  const focusIndex = focusRecord ? rows.findIndex(f => f.id === focusRecord) : -1;
  useEffect(() => {
    if (focusIndex >= 0) setPage(Math.floor(focusIndex / PAGE_SIZE) + 1);
  }, [focusIndex]);

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
                  <th>{declarationsCopy.columns.taxYear}</th>
                  <th>{declarationsCopy.columns.form}</th>
                  <th>{declarationsCopy.columns.status}</th>
                  <th>{declarationsCopy.columns.filedOn}</th>
                  <th>{declarationsCopy.columns.reference}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pageRows.map(f => (
                  <tr
                    key={f.id}
                    data-record-id={f.id}
                    className={`clickable${f.id === focusRecord ? ' row-focus' : ''}`}
                    onClick={() => setEditing(f)}
                  >
                    <td style={{ fontWeight: 500, color: 'var(--text)' }}>{f.taxYear}</td>
                    <td>{f.form}</td>
                    <td>
                      <Badge kind={FILING_BADGE[f.status]}>{recordStatus.filingLabels[f.status]}</Badge>
                    </td>
                    <td>{f.filedOn ? fmtDate(f.filedOn) : '—'}</td>
                    <td className="muted">{f.reference ?? '—'}</td>
                    <td>
                      <div className="row-actions">
                        {f.status !== 'depusa' ? (
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={e => {
                              e.stopPropagation();
                              // The date is recorded here because this is the moment the app is told the
                              // return was filed. It is not backdated, and it is not written for a status
                              // that does not claim a filing.
                              updateFiling({ ...f, status: 'depusa', filedOn: localDateISO() });
                              toast('success', declarationsCopy.filed(f.taxYear));
                            }}
                          >
                            {declarationsCopy.markFiled}
                          </button>
                        ) : (
                          <button className="btn btn-sm btn-ghost" onClick={e => { e.stopPropagation(); setEditing(f); }}>{copy.ui.edit}</button>
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

      <LegacyMonthly rows={legacyRows} focusRecord={focusRecord} />

      {editing && (
        <FilingForm
          initial={editing === 'new' ? undefined : editing}
          years={years}
          onClose={() => setEditing(null)}
          onSave={f => {
            if (editing !== 'new') {
              updateFiling({ ...editing, ...f });
              toast('success', declarationsCopy.updated(f.taxYear));
            } else {
              addFiling(f);
              toast('success', declarationsCopy.added(f.taxYear));
            }
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
