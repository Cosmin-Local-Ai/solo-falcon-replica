import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../data/store';
// PG-6g — the periodicity outcome, the filing calendar and the input-VAT decision all come from the ONE
// dashboard build, not from a second pass over the data in this page. `useDashboardData` is what
// Dashboard.tsx reads them from too, so the two pages cannot disagree about the fiscal period.
import { useDashboardData } from '../data/dashboardAdapter';
import {
  fmtDate,
  isFiledVatReturn,
  type AnnualFiling,
  type FilingStatus,
} from '../data/types';
import { Card, Badge, Modal, Empty, Pagination } from '../components/ui';
import { formatRoCalendarDate, localDateISO } from '../domain/date';
import { formatBani } from '../domain/money';
import { ART322_RULE_TEXT, vatPeriodicityYearSentence } from '../domain/fiscal/vatPeriodicity';
import { D300_DEDUCTIBLE_LINES, parkedGroups, unfiledFigureNote } from '../domain/fiscal/vatReturn';
import {
  copy,
  declarations as declarationsCopy,
  empty,
  fields,
  recordStatus,
  vatReturn as vatReturnCopy,
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
 * - It does not show monthly rows from an older version. PG-5 kept them read-only for one release out of
 *   caution about stored data; PG-5b removed the record type and the v10→v11 step now drops those rows,
 *   because D-USER-1 records that no stored payload exists to protect and a PFA în sistem real has no
 *   monthly return for the shape to be a record of. The page has one register and one vocabulary.
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

interface DeclarationsProps {
  /** TASK 8 — the record an attention item pointed at; see `Revenues.tsx focusRecord`. */
  focusRecord?: string;
}

/**
 * PG-6g — the periodic VAT return panel: the CF art. 322 fiscal period, the art. 322/323 filing
 * calendar, the D300 line layout, and the three parked lists from PG-6f.
 *
 * Three things this panel is built to not do:
 *
 * - **It never offers a cadence to pick.** There is no `periodicity` dropdown. The period is derived from
 *   the facts the article names, and where those facts are missing the panel states the rule in Romanian,
 *   asks the specific question, and shows the statutory default of art. 322 alin. (1) as the law's answer
 *   in the meantime. D-VAT-1 is the decision this shape implements.
 * - **It never says a return was or will be filed.** B-56 is open because success messages elsewhere
 *   already claim operations that do not happen. The only write this panel performs records that *the
 *   person* filed something, and the row says so in the past tense about the app's own record.
 * - **It never presents `claimableTotal` as a form line.** `research/42` §7 records that the amount lands
 *   on rd. 30 *plus* rd. 33/34, and the 50 % / pro-rata split sits on both sides of rd. 20–28, so the
 *   panel shows the rubric layout and what may and may not be placed on each line.
 *
 * The mențiuni rows carry their term and their citation but no filing control: the app models one return
 * form (`300`), and a declarație de mențiuni is not it. Minting a `300` record to close a mențiuni term
 * would put the wrong form on the record.
 */
function VatPeriodicityPanel() {
  const store = useStore();
  const dash = useDashboardData();
  const asOf = localDateISO();
  const outcome = dash.vatPeriodicity;
  const obligations = dash.vatObligations;
  const year = store.profile.fiscalYear;

  const recordChoice = (periodicity: 'month' | 'quarter') => {
    const years = store.profile.vatPeriodicityYears ?? [];
    const existing = years.find((y) => y.year === year) ?? { year };
    store.updateProfile({
      vatPeriodicityYears: [
        ...years.filter((y) => y.year !== year),
        {
          ...existing,
          // `confirmedBy: 'user'` is a literal in the schema for a reason: there is no way to write down
          // that the app decided. The branch records WHICH rule the person was shown when they answered.
          userChoice: {
            periodicity,
            branch: outcome.kind === 'ask' && outcome.branch ? outcome.branch : 'alin1',
            confirmedBy: 'user' as const,
            confirmedOn: asOf,
          },
        },
      ],
    });
  };

  const recordFiling = (obligationId: string) => {
    const o = obligations.find((x) => x.id === obligationId);
    if (!o || !o.period) return;
    store.addVatReturn({
      obligationId,
      year: o.period.year,
      form: '300',
      periodKind: o.period.kind,
      periodIndex: o.period.kind === 'month' ? o.period.month
        : o.period.kind === 'quarter' ? o.period.quarter
        : o.period.fromMonth,
      ...(o.period.kind === 'partial' ? { periodToMonth: o.period.toMonth } : {}),
      status: 'depusa',
      // The date is recorded now because now is when the app is told. It is not backdated.
      filedOn: asOf,
    });
    store.toast('success', vatReturnCopy.recordFiled(o.label));
  };

  const filedIds = new Set(
    store.vatReturns.filter(isFiledVatReturn).map((r) => r.obligationId),
  );

  const parked = dash.inputVat
    ? parkedGroups(dash.inputVat.lines, (reason) =>
        vatReturnCopy.parkedReasonLabels[
          reason as keyof typeof vatReturnCopy.parkedReasonLabels
        ] ?? vatReturnCopy.parkedWhyMissing)
    : [];

  return (
    <Card>
      <div className="page-header" style={{ marginBottom: 8 }}>
        <div>
          <h2 style={{ margin: 0 }}>{vatReturnCopy.sectionTitle}</h2>
          <div className="sub">{vatReturnCopy.sectionLead}</div>
        </div>
      </div>

      {/* ── the fiscal period ───────────────────────────────────────────────── */}
      <div data-testid="vat-periodicity">
        {outcome.kind === 'derived' && (
          <>
            <div>
              <Badge kind="info">{vatReturnCopy.derivedBadge}</Badge>{' '}
              <strong>
                {vatReturnCopy.derivedLead(ART322_RULE_TEXT[outcome.branch].citation)}{' '}
                {vatPeriodicityYearSentence(outcome, year)}
              </strong>
            </div>
            <div className="hint">{ART322_RULE_TEXT[outcome.branch].rule}</div>
          </>
        )}
        {outcome.kind === 'user_confirmed' && (
          <>
            <div>
              <Badge kind="neutral">{vatReturnCopy.confirmedBadge}</Badge>{' '}
              <strong>
                {vatReturnCopy.confirmedLead(formatRoCalendarDate(outcome.choice.confirmedOn))}{' '}
                {vatPeriodicityYearSentence(outcome, year)}
              </strong>
            </div>
            <div className="hint">{ART322_RULE_TEXT[outcome.branch].rule}</div>
          </>
        )}
        {outcome.kind === 'ask' && (
          <>
            <div>
              <Badge kind="warning">{vatReturnCopy.askLead}</Badge>
            </div>
            <div className="hint">{outcome.detail}</div>
            <div className="hint">{vatReturnCopy.interimLead(outcome.interim.basis)}</div>
            <details>
              <summary>{vatReturnCopy.questions}</summary>
              <ul>
                {outcome.questions.map((q) => (
                  <li key={q.id}>
                    {q.text}{' '}
                    <span className="hint">({q.rule})</span>{' '}
                    <a href={q.fixTarget}>{q.fixTarget}</a>
                  </li>
                ))}
              </ul>
            </details>
            {/* The confirm path is offered on EVERY unanswered branch, including the one where the app
                cannot yet say which alineat applies. Gating it on a known branch would leave the
                mid-year registration case — the likeliest user of this screen — with a question and no
                way to answer it, which is the dead end D-VAT-1 exists to remove. */}
            <div>
              <div className="hint">
                {vatReturnCopy.answerLead(
                  outcome.branch !== null ? ART322_RULE_TEXT[outcome.branch].rule : outcome.detail,
                )}
              </div>
              <div className="row-actions">
                <button className="btn btn-sm btn-primary" onClick={() => recordChoice('month')}>
                  {vatReturnCopy.chooseMonth}
                </button>
                <button className="btn btn-sm btn-ghost" onClick={() => recordChoice('quarter')}>
                  {vatReturnCopy.chooseQuarter}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── the cap, with the rate it was struck at ─────────────────────── */}
      {'cap' in outcome && (
        <div className="hint" data-testid="vat-cap">
          <div>{vatReturnCopy.capHeading}</div>
          {outcome.cap ? (
            <div>{vatReturnCopy.capRate(outcome.cap.evidence.rate, formatRoCalendarDate(outcome.cap.rateDate))}</div>
          ) : (
            <div>{vatReturnCopy.capUnresolved}</div>
          )}
          <div>{vatReturnCopy.capNotHardcoded}</div>
        </div>
      )}

      {/* ── the arithmetic, shown rather than asserted ──────────────────── */}
      {'steps' in outcome && outcome.steps.length > 0 && (
        <details>
          <summary>{vatReturnCopy.arithmetic}</summary>
          <ul>
            {outcome.steps.map((s, i) => (
              <li key={`${s.label}-${i}`}>
                <span className="hint">{s.label}:</span> {s.value}
              </li>
            ))}
          </ul>
          {'boundaryNote' in outcome && outcome.boundaryNote ? (
            <div className="hint">{outcome.boundaryNote}</div>
          ) : null}
        </details>
      )}

      {/* ── the calendar ─────────────────────────────────────────────── */}
      <div style={{ marginTop: 12 }}>
        <h3 style={{ margin: '0 0 4px' }}>{vatReturnCopy.calendarHeading}</h3>
        {obligations.length === 0 ? (
          <p className="hint">{vatReturnCopy.calendarEmpty}</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{vatReturnCopy.columns.obligation}</th>
                <th>{vatReturnCopy.columns.dueOn}</th>
                <th>{vatReturnCopy.columns.payment}</th>
                <th>{vatReturnCopy.columns.citation}</th>
                <th>{vatReturnCopy.columns.status}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {obligations.map((o) => (
                <tr key={o.id} data-obligation-id={o.id}>
                  <td>
                    <div>{vatReturnCopy.obligationKinds[o.kind]}</div>
                    <div className="hint">{o.label}</div>
                    {o.holidayCaveat ? <div className="hint">{o.holidayCaveat}</div> : null}
                    {o.exceptionNote ? <div className="hint">{o.exceptionNote}</div> : null}
                  </td>
                  <td>{formatRoCalendarDate(o.dueOn)}</td>
                  <td>{formatRoCalendarDate(o.paymentDueOn)}</td>
                  <td className="muted">{o.citation}</td>
                  <td>
                    <Badge kind={filedIds.has(o.id) ? 'success' : 'neutral'}>
                      {filedIds.has(o.id) ? vatReturnCopy.filedBadge : vatReturnCopy.notFiledBadge}
                    </Badge>
                  </td>
                  <td>
                    {o.kind === 'decont' && !filedIds.has(o.id) ? (
                      <button className="btn btn-sm btn-primary" onClick={() => recordFiling(o.id)}>
                        {vatReturnCopy.recordFiling}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="hint">{vatReturnCopy.paymentSameDay}</div>
        <div className="hint">{vatReturnCopy.noBackfill}</div>
      </div>

      {/* ── where 6f's number lands ────────────────────────────────── */}
      <div style={{ marginTop: 12 }}>
        <h3 style={{ margin: '0 0 4px' }}>{vatReturnCopy.d300Heading}</h3>
        <div className="hint">{vatReturnCopy.d300Lead}</div>
        <table className="table">
          <thead>
            <tr>
              <th>{vatReturnCopy.d300Columns.row}</th>
              <th>{vatReturnCopy.d300Columns.title}</th>
              <th>{vatReturnCopy.d300Columns.treatment}</th>
            </tr>
          </thead>
          <tbody>
            {D300_DEDUCTIBLE_LINES.map((l) => (
              <tr key={l.row}>
                <td>{l.row}</td>
                <td>
                  <div>{l.title}</div>
                  <div className="hint">{l.citation}</div>
                </td>
                <td className="muted">{l.appTreatment}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="hint">{vatReturnCopy.d300NotAFacsimile}</div>
      </div>

      {/* ── the three parked lists, still parked ────────────────────── */}
      <div style={{ marginTop: 12 }}>
        <h3 style={{ margin: '0 0 4px' }}>{vatReturnCopy.parkedHeading}</h3>
        <div className="hint">{vatReturnCopy.parkedLead}</div>
        {parked.length === 0 ? (
          <p className="hint">{vatReturnCopy.parkedEmpty}</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{vatReturnCopy.parkedColumns.reason}</th>
                <th>{vatReturnCopy.parkedColumns.count}</th>
                <th>{vatReturnCopy.parkedColumns.amount}</th>
              </tr>
            </thead>
            <tbody>
              {parked.map((g) => (
                <tr key={g.reason}>
                  <td>{g.why}</td>
                  <td>{g.count}</td>
                  <td>{formatBani(g.amountBani)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {dash.inputVat ? (
          <div className="hint">
            {vatReturnCopy.unfiledFigure} {unfiledFigureNote(dash.inputVat.claimableTotal)}
          </div>
        ) : null}
      </div>
    </Card>
  );
}


export default function Declarations({ focusRecord }: DeclarationsProps) {
  const { filings, profile, addFiling, updateFiling, toast } = useStore();
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

      <VatPeriodicityPanel />

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
            <table className="table" data-register="d212">
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
