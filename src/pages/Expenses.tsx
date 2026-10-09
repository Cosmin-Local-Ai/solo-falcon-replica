import { useEffect, useMemo, useState } from 'react';
import { formatBaniRON, leiInputValue, parseLeiInput } from '../domain/money';
import { useStore } from '../data/store';
import { fmtDate, sumTotals, total, EXP_STATUS_LABEL, statusBadge } from '../data/types';
import type { Expense } from '../data/types';
import { EXPENSE_CATEGORIES } from '../domain/fiscal/deductibility';
import { selectDeductibleExpenses, selectEstimateOperands } from '../domain/estimateBasis';
import { selectRuleSet } from '../domain/fiscal';
import type { FiscalRule } from '../domain/fiscal/rules';
import { localDateISO, now } from '../domain/date';
import { Card, Badge, Modal, Empty, Pagination } from '../components/ui';

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
  { key: 'registered', label: 'Înregistrate', status: 'inregistrata' },
  { key: 'rejected', label: 'Respinse', status: 'respinsa' },
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
    // `leiInputValue`, not `String(...)`: stored money is integer bani; an input is a screen.
    valoare: initial ? leiInputValue(initial.valoareFaraTva) : '',
    tva: initial ? leiInputValue(initial.tva) : '',
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
    if (!f.nr.trim()) e.nr = 'Numărul documentului este obligatoriu';
    if (!f.date) e.date = 'Data este obligatorie';
    if (!f.furnizor.trim()) e.furnizor = 'Furnizorul este obligatoriu';
    // Phase 10: form in lei, storage in bani; `parseLeiInput` refuses sub-ban precision rather than rounding.
    const v = parseLeiInput(f.valoare);
    const t = parseLeiInput(f.tva);
    if (v === null || v < 0) e.valoare = 'Introduceți o valoare validă';
    if (t === null || t < 0) e.tva = 'Introduceți un TVA valid';
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
        <div className="field">
          <label>Categorie deductibilitate (CF art. 68)</label>
          <select value={f.category} onChange={e => set('category', e.target.value)}>
            <option value="">— fără categorie —</option>
            {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <span className="text-sm muted">Fără categorie, cheltuiala este neclasificată și exclusă din calculul impozitului.</span>
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
  const sum = sumTotals(rows);

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
  // The engine picks the money measure by `vatExempt` (`tax.ts:143-144`); the page shows the one that
  // actually moved the deductible total, and says which one it is.
  const measure = store.profile.vatExempt ? 'inclVat' : 'exclVat';
  const measureLabel = store.profile.vatExempt ? 'cu TVA inclus' : 'fără TVA';

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

      {unclassifiedIds.length > 0 && (
        <div className="banner banner-warn" role="status">
          <strong>{unclassifiedIds.length}</strong>
          {' '}{unclassifiedIds.length === 1 ? 'cheltuială este neclasificată' : 'cheltuieli sunt neclasificate'} în acest an fiscal și nu intră în cheltuielile deductibile (CF art. 68 alin. (4) și (7)).
          {firstUnclassified && (
            <button
              className="btn btn-sm"
              style={{ marginLeft: 10 }}
              onClick={() => setEditing(firstUnclassified)}
            >
              Clasifică
            </button>
          )}
        </div>
      )}

      {alin6Struck.length > 0 && (
        <div className="banner banner-warn" role="status">
          <strong>Plafonul calculat</strong>
          {' '}— {alin6Struck.length === 1 ? 'o cheltuială are' : `${alin6Struck.length} cheltuieli au`} plafonul
          {' '}măsurat pe baza art. 68 alin. (6) în lectura «înregistrată» (pre-plafon): baza scade
          {' '}cheltuielile deductibile așa cum au fost înregistrate, nu așa cum rămân după celelalte
          {' '}plafoane alin. (5). Legea nu stabilește care lectură se aplică — nicio normă nu prescrie o
          {' '}ordine — deci ambele cifre sunt afișate. Cea aplicată este mai puțin generoasă și nu poate
          {' '}produce subimpozitare.
          {alin6Struck.map(a => (
            <div className="text-sm" key={a.ruleId} style={{ marginTop: 6 }}>
              <div>
                <strong>{a.category}</strong>
                {` · ${a.sourceArticle} · plafon ${a.cap.percent}% din baza art. 68 alin. (6)`}
              </div>
              <div>
                {`Plafon aplicat (${measureLabel}): `}
                <strong>{formatBaniRON(a.ceiling[measure])}</strong>
                {` · cealaltă lectură, post-plafon: `}
                <strong>{formatBaniRON(a.ceilingAlt![measure])}</strong>
              </div>
            </div>
          ))}
        </div>
      )}

      {capBlocked.length > 0 && (
        <div className="banner banner-warn" role="status">
          <strong>{capBlocked.length}</strong>
          {' '}{capBlocked.length === 1 ? 'cheltuială are' : 'cheltuieli au'} un plafon legal care nu poate fi
          {' '}măsurat din datele înregistrate, deci nu intră în cheltuielile deductibile (CF art. 68 alin. (5)).
          {' '}Nu este o eroare de completare — este un fapt pe care aplicația nu îl deține.
          <div className="text-sm muted" style={{ marginTop: 6 }}>{capBlocked[0].detail}</div>
          {capBlocked.length > 1 && (
            <div className="text-sm muted">
              {`Celelalte ${capBlocked.length - 1} sunt excluse pentru temeiuri identice sau analoage; fiecare poartă motivul ei.`}
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
                    <td className="amount">{formatBaniRON(e.valoareFaraTva)}</td>
                    <td className="amount">{formatBaniRON(e.tva)}</td>
                    <td className="amount">{formatBaniRON(total(e))}</td>
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
                  <td className="amount" style={{ fontWeight: 600 }}>{formatBaniRON(sum)}</td>
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
