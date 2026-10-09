import { useEffect, useMemo, useState } from 'react';
import { ENTRY_CURRENCIES, formatBaniRON, formatMoney, moneyInputValue, parseMoneyInput, type CurrencyCode } from '../domain/money';
import { useStore } from '../data/store';
import { fmtDate, sumTotalsByCurrency, total, statusBadge } from '../data/types';
import type { Expense } from '../data/types';
import { EXPENSE_CATEGORIES } from '../domain/fiscal/deductibility';
import { selectDeductibleExpenses, selectEstimateOperands } from '../domain/estimateBasis';
import { selectRuleSet } from '../domain/fiscal';
import type { FiscalRule } from '../domain/fiscal/rules';
import { localDateISO, now } from '../domain/date';
import { Card, Badge, Modal, Empty, Pagination } from '../components/ui';
import { Disclosure } from '../components/ui/Disclosure';
import { InterpretationNote } from '../components/ui/InterpretationNote';
import { copy, empty, expenseCategoryLabels, expenses as expensesCopy, fields, recordStatus, validation } from '../ui/copy';

/**
 * TASK 6: the rules in force for the profile's fiscal year, selected rather than imported.
 *
 * This page used to import `PFA_2026_SYSTEM_REAL_PACKAGE` by name — the clearest example of the defect,
 * because the call site had no year and no date in scope at all, so it could only ever ask for 2026. The
 * year is now read from the profile the store already holds.
 */
function activeRulesFor(fiscalYear: number, asOfDate: string): FiscalRule[] {
  const selection = selectRuleSet(fiscalYear, asOfDate);
  return selection ? [...selection.rules] : [];
}

// Canonical route hash keys (English) mapped to the Romanian data statuses.
const TABS = [
  { key: 'registered', label: recordStatus.tabs.inregistrata, status: 'inregistrata' },
  { key: 'rejected', label: recordStatus.tabs.respinsa, status: 'respinsa' },
] as const;

const statusFor = (tab: (typeof TABS)[number]['key']) =>
  TABS.find(t => t.key === tab)!.status;

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
    // `moneyInputValue`, not `String(...)`: stored money is integer minor units; an input is a screen.
    valoare: initial ? moneyInputValue(initial.valoareFaraTva) : '',
    tva: initial ? moneyInputValue(initial.tva) : '',
    // TASK 10a: the currency belongs to the amount. Defaults to RON — what every existing record has.
    currency: (initial?.valoareFaraTva.currency ?? 'RON') as CurrencyCode,
    status: initial?.status ?? 'inregistrata',
    statusDetail: initial?.statusDetail ?? '',
    // TASK 2b: '' means "no category", which is a legal state, not a half-filled field. It is stored as
    // an ABSENT field, never as null — a null would fail the load gate on the next read and quarantine
    // the payload. The option labels are the rule-set tokens on purpose: the Romanian wording of a
    // legal category belongs to the language layer (TASK 7), and inventing 35 legal labels here would
    // put unverified copy in front of a tax decision.
    category: initial?.category ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  const submit = () => {
    const e: Record<string, string> = {};
    if (!f.nr.trim()) e.nr = validation.documentNumberRequired;
    if (!f.date) e.date = validation.dateRequired;
    if (!f.furnizor.trim()) e.furnizor = validation.providerRequired;
    // Phase 10: form in major units, storage in minor units; `parseMoneyInput` refuses sub-minor-unit
    // precision rather than rounding. TASK 10a: it parses in the currency the form is set to.
    const v = parseMoneyInput(f.valoare, f.currency);
    const t = parseMoneyInput(f.tva, f.currency);
    if (v === null || v.amount < 0) e.valoare = validation.amountInvalid;
    if (t === null || t.amount < 0) e.tva = validation.vatInvalid;
    setErrors(e);
    if (Object.keys(e).length) return;
    if (v === null || t === null) return; // unreachable; narrows without a cast
    onSave({
      tip: f.tip as Expense['tip'], nr: f.nr, date: f.date, furnizor: f.furnizor, cui: f.cui,
      valoareFaraTva: v, tva: t, status: f.status as Expense['status'],
      statusDetail: f.statusDetail || undefined,
      category: f.category === '' ? undefined : (f.category as Expense['category']),
    });
  };

  return (
    <Modal
      title={initial ? expensesCopy.editTitle(initial.nr) : expensesCopy.addTitle}
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
            <option value="factura">{expensesCopy.documentTypes.factura}</option>
            <option value="bon-fiscal">{expensesCopy.documentTypes.bon}</option>
          </select>
        </div>
        <div className="field">
          <label>{fields.documentNumber} <span className="req">*</span></label>
          <input className={errors.nr ? 'invalid' : ''} value={f.nr} onChange={e => set('nr', e.target.value)} placeholder={expensesCopy.documentNumberPlaceholder} />
          {errors.nr && <span className="error">{errors.nr}</span>}
        </div>
        <div className="field">
          <label>{fields.date} <span className="req">*</span></label>
          <input type="date" className={errors.date ? 'invalid' : ''} value={f.date} onChange={e => set('date', e.target.value)} />
          {errors.date && <span className="error">{errors.date}</span>}
        </div>
        <div className="field">
          <label>{expensesCopy.columns.provider} <span className="req">*</span></label>
          <input className={errors.furnizor ? 'invalid' : ''} value={f.furnizor} onChange={e => set('furnizor', e.target.value)} placeholder={expensesCopy.providerPlaceholder} />
          {errors.furnizor && <span className="error">{errors.furnizor}</span>}
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
            <option value="respinsa">{recordStatus.labels.respinsa}</option>
          </select>
        </div>
        <div className="field">
          <label>{expensesCopy.deductibilityLabel}</label>
          <select value={f.category} onChange={e => set('category', e.target.value)}>
            <option value="">{expensesCopy.deductibilityNone}</option>
            {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{expenseCategoryLabels[c]}</option>)}
          </select>
          <span className="text-sm muted">{expensesCopy.deductibilityNoneHint}</span>
        </div>
        {f.status !== 'inregistrata' && (
          <div className="field full">
            <label>{fields.statusDetail}</label>
            <input value={f.statusDetail} onChange={e => set('statusDetail', e.target.value)} placeholder={fields.statusDetailPlaceholder} />
          </div>
        )}
      </div>
    </Modal>
  );
}

interface ExpensesProps {
  initialTab?: (typeof TABS)[number]['key'];
  onTabChange?: (tab: (typeof TABS)[number]['key']) => void;
  /** TASK 8 — the record an attention item pointed at; see `Revenues.tsx focusRecord`. */
  focusRecord?: string;
}

export default function Expenses({ initialTab, onTabChange, focusRecord }: ExpensesProps) {
  const store = useStore();
  const { expenses, addExpense, updateExpense, deleteExpense, toast } = store;
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>(
    initialTab && TABS.some(t => t.key === initialTab) ? initialTab : 'registered'
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
      .filter(e => e.status === statusFor(tab))
      .filter(e => !search || (e.nr + e.furnizor).toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => b.date.localeCompare(a.date)),
  [expenses, tab, search]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const counts = (k: (typeof TABS)[number]['key']) =>
    expenses.filter(e => e.status === statusFor(k)).length;
  const sums = sumTotalsByCurrency(rows);

  // TASK 8: land the focused record on screen, whatever page of the register it sits on.
  const focusIndex = focusRecord ? rows.findIndex(e => e.id === focusRecord) : -1;
  useEffect(() => {
    if (focusIndex >= 0) setPage(Math.floor(focusIndex / PAGE_SIZE) + 1);
  }, [focusIndex]);

  // TASK 2b — the residue the law cannot decide, counted where it can be acted on.
  // This is the SAME selector the tax estimate runs (`estimateBasis.ts selectDeductibleExpenses`), so
  // the number on this screen and the total the engine used cannot disagree: same status/period filter,
  // same classification. A count built from `expenses.filter(e => !e.category)` would have been a
  // different population — out-of-period and rejected records included.
  const classification = useMemo(() => {
    const asOf = localDateISO(now());
    return selectDeductibleExpenses(store, asOf, activeRulesFor(store.profile.fiscalYear, asOf));
  }, [store]);
  const unclassifiedIds = classification.excluded
    .filter(x => x.reason === 'undetermined')
    .map(x => x.id);
  const firstUnclassified = expenses.find(e => unclassifiedIds.includes(e.id));
  // TASK 2c — a cap the app cannot measure is NOT a silent drop. The rule settled the ceiling; what is
  // missing is a datum (a BNR rate, a payroll) or a primary text that picks a side. The expense stays out
  // of the deductible total and the reason says which, in the words the rule itself carries.
  const capBlocked = classification.excluded.filter(x => x.reason === 'cap_unresolved');
  // TASK 10a (B-32): records the assembler kept out because they are not written in lei. Named here so the
  // register says what left the deductible base — the same selector the estimate runs, so the count on this
  // screen and the total the engine used cannot disagree.
  const foreignBlocked = classification.excluded.filter(x => x.reason === 'foreign_currency');

  // TASK 2d — a ceiling that WAS struck must be explained, not just applied. These are the numbers the
  // estimate itself produced: the SAME assembler the tax engine runs (`selectEstimateOperands`), so the
  // ceiling shown here and the deductible total the engine used cannot disagree. The alin. (6) letters
  // carry both readings of the base because the law settles neither (research 22 §6) — hiding the one
  // that was not applied would present an unresolved reading as settled law.
  const capStruck = useMemo(() => {
    const asOf = localDateISO(now());
    return selectEstimateOperands(store, asOf, activeRulesFor(store.profile.fiscalYear, asOf)).capAdjustments;
  }, [store]);
  const alin6Struck = capStruck.filter(a => a.base !== undefined && a.ceilingAlt !== undefined);
  // TASK 10b — a ceiling the law states in euro. It exists as a lei number only through a conversion, so
  // the banner names the rate, the year it is anchored to and whether that rate is provisional, and shows
  // the competing art. 9 ceiling beside the applied one. The conflict itself is the rule's own text, not a
  // sentence written here.
  const euroStruck = capStruck.filter(a => a.euro !== undefined);
  // TASK 10b — ledger records that entered the lei base only because a recorded rate converted them.
  const converted = classification.conversions;
  // The engine picks the money measure by `vatExempt` (`tax.ts:143-144`); the page shows the one that
  // actually moved the deductible total, and says which one it is.
  const measure = store.profile.vatExempt ? 'inclVat' : 'exclVat';
  const measureLabel = store.profile.vatExempt
    ? expensesCopy.measureWithVat
    : expensesCopy.measureWithoutVat;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{expensesCopy.title}</h1>
          <div className="sub">{expensesCopy.subtitle}</div>
        </div>
        <div className="actions">
          <input
            placeholder={expensesCopy.searchPlaceholder}
            style={{ border: '1px solid var(--border-strong)', borderRadius: 6, padding: '7px 10px', fontSize: 13, width: 220 }}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
          <button className="btn btn-primary" onClick={() => setEditing('new')}>+ {expensesCopy.add}</button>
        </div>
      </div>

      {unclassifiedIds.length > 0 && (
        <div className="banner banner-warn" role="status">
          <strong>{unclassifiedIds.length}</strong>
          {' '}{expensesCopy.unclassifiedLead(unclassifiedIds.length)} {expensesCopy.unclassifiedTail}
          {firstUnclassified && (
            <button
              className="btn btn-sm"
              style={{ marginLeft: 10 }}
              onClick={() => setEditing(firstUnclassified)}
            >
              {expensesCopy.classify}
            </button>
          )}
        </div>
      )}

      {alin6Struck.length > 0 && (
        <div className="banner banner-warn" role="status">
          <strong>{expensesCopy.capTitle}</strong>{' '}
          — {alin6Struck.length === 1 ? expensesCopy.capHasOne : expensesCopy.capHasMany(alin6Struck.length)}{' '}
          {expensesCopy.capAppliedReading}
          {/* TASK 7: the unresolved reading is stated once, by the reusable Notă de interpretare, and the
              full explanation of both readings sits behind „Surse și note de interpretare". Both figures
              stay on screen — hiding the reading that was not applied would present an unresolved reading
              as settled law. */}
          <InterpretationNote note={copy.notes.capReading} />
          {alin6Struck.map(a => (
            <div className="text-sm" key={a.ruleId} style={{ marginTop: 6 }}>
              <div>
                <strong>{expenseCategoryLabels[a.category]}</strong>
                {expensesCopy.capCitation(a.sourceArticle, a.cap.percent)}
              </div>
              <div>
                {expensesCopy.capAppliedLead(measureLabel)}{' '}
                <strong>{formatBaniRON(a.ceiling[measure])}</strong>
                {' '}{expensesCopy.capAlternativeLead}{' '}
                <strong>{formatBaniRON(a.ceilingAlt![measure])}</strong>
              </div>
            </div>
          ))}
          <Disclosure label={copy.disclosure.sources}>
            <p className="hint">{copy.sources.capReadingChoice}</p>
          </Disclosure>
        </div>
      )}

      {euroStruck.length > 0 && (
        <div className="banner banner-warn" role="status">
          <strong>{expensesCopy.euroCapTitle}</strong>{' '}
          — {euroStruck.length === 1 ? expensesCopy.capHasOne : expensesCopy.capHasMany(euroStruck.length)}{' '}
          {expensesCopy.euroCapAppliedReading}
          <InterpretationNote note={copy.notes.fxConversionConflict} />
          {euroStruck.map(a => {
            const euro = a.euro!;
            return (
              <div className="text-sm" key={a.ruleId} style={{ marginTop: 6 }}>
                <div>
                  <strong>{expenseCategoryLabels[a.category]}</strong>
                  {expensesCopy.euroCapCitation(a.sourceArticle)}
                  {' '}{formatMoney(euro.cap)}
                </div>
                <div>
                  {expensesCopy.capAppliedLead(measureLabel)}{' '}
                  <strong>{formatBaniRON(a.ceiling[measure])}</strong>
                  {' '}{expensesCopy.euroCapRateLead}{' '}
                  <strong>{euro.applied.rate}</strong>{' '}
                  {expensesCopy.euroCapValidFor(euro.paymentYear)}
                  {' '}· {euro.provisional ? copy.fx.provisionalBadge : copy.fx.finalBadge}
                </div>
                <div>
                  {expensesCopy.euroCapAlternativeLead}{' '}
                  {euro.alternative.ok ? (
                    <strong>{formatBaniRON(euro.alternative.ceiling)}</strong>
                  ) : (
                    <span className="muted">{expensesCopy.euroCapAlternativeMissing} {euro.alternative.detail}</span>
                  )}
                </div>
                {euro.provisional && <div className="muted">{expensesCopy.euroCapProvisionalTail}</div>}
                {euro.applied.carriedFrom !== undefined && (
                  <div className="muted">{copy.fx.carriedFrom(euro.applied.carriedFrom)}</div>
                )}
              </div>
            );
          })}
          <Disclosure label={copy.disclosure.sources}>
            {euroStruck.map(a => (
              <p className="hint" key={a.ruleId}>{a.conflict ?? ''}</p>
            ))}
          </Disclosure>
        </div>
      )}

      {converted.length > 0 && (
        <div className="banner banner-warn" role="status">
          <strong>{converted.length}</strong>{' '}
          {expensesCopy.fxConvertedLead(converted.length)}{' '}
          {expensesCopy.fxConvertedTail}
          {converted.map(c => (
            <div className="text-sm" key={`${c.recordKind}-${c.recordId}`} style={{ marginTop: 6 }}>
              {expensesCopy.fxConvertedRow(c.currency, c.onDate, c.rate)}
              {' '}· {formatBaniRON(c.netLei)}
              {c.carriedFrom !== undefined && <> {' '}{expensesCopy.fxConvertedCarried}</>}
            </div>
          ))}
        </div>
      )}

      {foreignBlocked.length > 0 && (
        <div className="banner banner-warn" role="status">
          <strong>{foreignBlocked.length}</strong>{' '}
          {expensesCopy.foreignCurrencyLead(foreignBlocked.length)}{' '}
          {expensesCopy.foreignCurrencyTail}
          <div className="text-sm muted" style={{ marginTop: 6 }}>{foreignBlocked[0].detail}</div>
        </div>
      )}

      {capBlocked.length > 0 && (
        <div className="banner banner-warn" role="status">
          <strong>{capBlocked.length}</strong>
          {' '}{capBlocked.length === 1 ? expensesCopy.capBlockedOne : expensesCopy.capBlockedMany(capBlocked.length)}{' '}
          {expensesCopy.capBlockedTail}
          <InterpretationNote note={copy.notes.capUnmeasurable} />
          <div className="text-sm muted" style={{ marginTop: 6 }}>{capBlocked[0].detail}</div>
          {capBlocked.length > 1 && (
            <div className="text-sm muted">
              {expensesCopy.capBlockedRest(capBlocked.length - 1)}
            </div>
          )}
        </div>
      )}

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
            title={expensesCopy.emptyTitle}
            text={search ? empty.noSearchResults : expensesCopy.emptyBody}
            action={<button className="btn btn-primary" onClick={() => setEditing('new')}>+ {expensesCopy.add}</button>}
          />
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>{expensesCopy.columns.document}</th><th>{expensesCopy.columns.type}</th><th>{expensesCopy.columns.provider}</th><th>{expensesCopy.columns.cui}</th><th>{expensesCopy.columns.date}</th><th>{expensesCopy.columns.currency}</th>
                  <th className="amount">{expensesCopy.columns.withoutVat}</th><th className="amount">{expensesCopy.columns.vat}</th><th className="amount">{expensesCopy.columns.total}</th>
                  <th>{expensesCopy.columns.status}</th><th />
                </tr>
              </thead>
              <tbody>
                {pageRows.map(e => (
                  <tr
                    key={e.id}
                    data-record-id={e.id}
                    className={`clickable${e.id === focusRecord ? ' row-focus' : ''}`}
                    onClick={() => setEditing(e)}
                  >
                    <td style={{ fontWeight: 500, color: 'var(--text)' }}>{e.nr}</td>
                    <td>{e.tip === 'factura' ? expensesCopy.documentTypeCell.factura : expensesCopy.documentTypeCell.bon}</td>
                    <td>{e.furnizor}</td>
                    <td className="muted">{e.cui}</td>
                    <td>{fmtDate(e.date)}</td>
                    <td>{e.valoareFaraTva.currency}</td>
                    <td className="amount">{formatMoney(e.valoareFaraTva)}</td>
                    <td className="amount">{formatMoney(e.tva)}</td>
                    <td className="amount">{formatMoney(total(e))}</td>
                    <td>
                      <Badge kind={statusBadge(e.status)}>{recordStatus.expenseLabels[e.status]}</Badge>
                      {e.statusDetail && <div className="text-sm muted" style={{ marginTop: 3 }}>{e.statusDetail}</div>}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="btn btn-sm btn-ghost" onClick={ev => { ev.stopPropagation(); deleteExpense(e.id); toast('success', expensesCopy.deleted(e.nr)); }}>{copy.ui.remove}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={8} style={{ textAlign: 'right' }} className="muted">{expensesCopy.totalDocuments(rows.length)}</td>
                  {/* One subtotal per currency: a register holding lei and euro has two totals, and adding
                      them would invent a figure in a unit neither record was written in. */}
                  <td className="amount" style={{ fontWeight: 600 }}>
                    {sums.map(s => <div key={s.currency}>{formatMoney(s)}</div>)}
                  </td>
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
            if (editing === 'new') { addExpense(e); toast('success', expensesCopy.added(e.nr)); }
            else { updateExpense({ ...e, id: editing.id }); toast('success', expensesCopy.updated(e.nr)); }
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
