import { useEffect, useState } from 'react';
import { useStore } from '../data/store';
import { Card, Badge, Modal } from '../components/ui';
import {
  isSelectableRegime,
  regimeRefusalReason,
  selectableRegimes,
} from '../domain/regimes';
import type {
  PfaPensionStatus,
  PfaRegime,
  PfaSalaryStatus,
  PfaSocialInsuranceStatus,
} from '../domain/models';

// Canonical route hash keys (must match VALID_TABS.settings in App.tsx).
// Mirrors the live SOLO settings page (docs/reference/settings.md);
// the real app's "Abonament" tab is intentionally not replicated.
// `fiscal` is NOT in the live SOLO page: it is where this replica edits the
// PfaProfile contract (Phase 6) — the profile had no write path at all before.
const TABS = [
  { key: 'company', label: 'PFA' },
  { key: 'fiscal', label: 'Regim fiscal' },
  { key: 'einvoice', label: 'e-Factura' },
  { key: 'bankaccounts', label: 'Conturi bancare' },
  { key: 'account', label: 'Personal' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

interface SettingsProps {
  initialTab?: string;
  onTabChange?: (tab: string) => void;
}

export default function Settings({ initialTab, onTabChange }: SettingsProps) {
  // Identity/contact fields come from ONE store: `profile.identity` (D-1). The
  // legacy `settings.company` / `settings.personal` blocks are not read here at
  // all — they are frozen legacy data, read only by the migration chain.
  // `settings` itself stays live for what is genuinely settings: e-Factura
  // behaviour and the bank-account list.
  const { settings, updateSettings, profile, updateProfile, toast } = useStore();
  const identity = profile.identity;
  const [tab, setTab] = useState<TabKey>(
    TABS.some(t => t.key === initialTab) ? (initialTab as TabKey) : 'company'
  );

  // Sync tab when the URL changes (back/forward navigation).
  useEffect(() => {
    if (TABS.some(t => t.key === initialTab)) setTab(initialTab as TabKey);
  }, [initialTab]);

  // --- PFA tab: editable registration data ---
  const [company, setCompany] = useState({
    denumire: identity.denumire,
    cui: identity.cui,
    numarRegComert: identity.numarRegComert,
    adresaSocietate: identity.adresaSocietate,
  });
  const [mentiuni, setMentiuni] = useState(identity.mentiuniFactura ?? '');

  // --- Personal tab: now a real write path (Phase 7 scope item 2). These inputs
  // were `disabled` in the mock because the data had no owner; `profile.identity`
  // is that owner.
  const [personal, setPersonal] = useState({
    nume: identity.nume,
    email: identity.email,
    telefon: identity.telefon,
  });

  // --- e-Factura tab ---
  const [ef, setEf] = useState(settings.eFactura);

  // --- Regim fiscal tab: the PfaProfile write path (Phase 6) ---
  // Numbers are held as strings so an empty/invalid input can be shown as invalid
  // instead of being coerced to 0 (the Revenues.tsx validation pattern).
  const [fiscal, setFiscal] = useState({
    regime: profile.regime,
    // CAEN is identity data now (D-1); the field stays on this tab because that
    // is where its "does not change the regime" caveat belongs, but it reads and
    // writes `identity.caen`, not the deprecated `profile.caen` string.
    caen: identity.caen?.[0]?.cod ?? '',
    pfaStartYear: String(profile.pfaStartYear),
    fiscalYear: String(profile.fiscalYear),
    pfaStartDate: profile.pfaStartDate ?? '',
    salaryStatus: profile.salaryStatus,
    salaryIncomeLei: profile.salaryIncomeLei === undefined ? '' : String(profile.salaryIncomeLei),
    pensionStatus: profile.pensionStatus,
    socialInsuranceStatus: profile.socialInsuranceStatus,
    vatExempt: profile.vatExempt ? 'da' : 'nu',
    cashFloorLei: String(profile.cashFloorLei),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const regimeOptions = selectableRegimes();

  // --- Modals ---
  const [tvaOpen, setTvaOpen] = useState(false);
  const [tvaCode, setTvaCode] = useState('');
  const [tvaFound, setTvaFound] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);
  const [newBank, setNewBank] = useState({ banca: '', moneda: 'RON' });

  /** Write identity fields through the profile — the one canonical store. */
  function updateIdentity(patch: Partial<typeof identity>) {
    updateProfile({ identity: { ...identity, ...patch } });
  }

  function saveCompany() {
    updateIdentity(company);
    toast('success', 'Datele PFA au fost salvate');
  }

  function savePersonal() {
    const nume = personal.nume.trim();
    if (!nume) {
      toast('error', 'Numele nu poate fi gol');
      return;
    }
    updateIdentity({ ...personal, nume });
    toast('success', 'Datele personale au fost salvate');
  }

  function saveMentiuni() {
    updateIdentity({ mentiuniFactura: mentiuni.trim() });
    toast('success', 'Mențiuni pe factură salvate');
  }

  function saveEf() {
    updateSettings(s => ({ ...s, eFactura: ef }));
    toast('success', 'Setările e-Factura au fost salvate');
  }

  function saveFiscal() {
    const e: Record<string, string> = {};
    const year = Number(fiscal.pfaStartYear);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      e.pfaStartYear = 'An invalid (2000–2100).';
    }
    const fy = Number(fiscal.fiscalYear);
    if (!Number.isInteger(fy) || fy < 2000 || fy > 2100) {
      e.fiscalYear = 'An invalid (2000–2100).';
    }
    if (fiscal.pfaStartDate && !/^\d{4}-\d{2}-\d{2}$/.test(fiscal.pfaStartDate)) {
      e.pfaStartDate = 'Format așteptat: AAAA-LL-ZZ.';
    }
    // art. 174 alin. (7) lit. a) is a numeric condition, so when a salary exists the
    // amount is mandatory — without it the engine cannot decide the 6 SM test and
    // calcCass() must halt instead of guessing.
    const salary = fiscal.salaryIncomeLei.trim() === '' ? undefined : Number(fiscal.salaryIncomeLei);
    if (fiscal.salaryStatus === 'da') {
      if (salary === undefined) {
        e.salaryIncomeLei = 'Venitul brut anual din salarii este necesar pentru pragul de 6 salarii minime.';
      } else if (!Number.isFinite(salary) || salary < 0) {
        e.salaryIncomeLei = 'Valoare invalidă (lei, ≥ 0).';
      }
    }
    const cash = Number(fiscal.cashFloorLei);
    if (!Number.isFinite(cash) || cash < 0) e.cashFloorLei = 'Valoare invalidă (lei, ≥ 0).';
    if (!isSelectableRegime(fiscal.regime)) {
      e.regime = 'Regimul salvat nu poate fi calculat; alege un regim valabil pentru un PFA.';
    }
    setErrors(e);
    if (Object.keys(e).length > 0) {
      toast('error', 'Verifică datele din formular');
      return;
    }
    updateProfile({
      regime: fiscal.regime,
      pfaStartYear: year,
      fiscalYear: fy,
      pfaStartDate: fiscal.pfaStartDate || undefined,
      salaryStatus: fiscal.salaryStatus,
      // No salary ⇒ no art. 174 alin. (7) lit. a) relief, and no stale amount left behind.
      salaryIncomeLei: fiscal.salaryStatus === 'da' ? salary : undefined,
      pensionStatus: fiscal.pensionStatus,
      socialInsuranceStatus: fiscal.socialInsuranceStatus,
      vatExempt: fiscal.vatExempt === 'da',
      cashFloorLei: cash,
      // CAEN is written into the single CAEN model (D-1), keeping any description
      // the entry already had. The deprecated `profile.caen` string is not written.
      identity: {
        ...identity,
        caen: [
          ...(fiscal.caen.trim()
            ? [{ cod: fiscal.caen.trim(), descriere: identity.caen?.[0]?.descriere ?? '' }]
            : []),
          ...(identity.caen?.slice(1) ?? []),
        ],
      },
    });
    toast('success', 'Profilul fiscal a fost salvat');
  }

  function copyAdresa() {
    navigator.clipboard
      ?.writeText(identity.adresaSocietate)
      .then(() => toast('success', 'Adresă copiată în clipboard'))
      .catch(() => toast('error', 'Nu am putut copia adresa'));
  }

  function openTva() {
    setTvaCode(identity.codTvaIntra ?? '');
    setTvaFound(false);
    setTvaOpen(true);
  }

  function searchTva() {
    // Simulated ANAF lookup: any non-empty code is accepted.
    setTvaFound(tvaCode.trim().length > 0);
  }

  function addTva() {
    updateIdentity({ codTvaIntra: tvaCode.trim() });
    setTvaOpen(false);
    toast('success', 'Cod TVA intracomunitar adăugat');
  }

  function addBank() {
    if (!newBank.banca.trim()) {
      toast('error', 'Introdu denumirea băncii');
      return;
    }
    updateSettings(s => ({
      ...s,
      bankAccounts: [
        ...s.bankAccounts,
        { id: `ba-${Date.now().toString(36)}`, banca: newBank.banca.trim(), moneda: newBank.moneda },
      ],
    }));
    setNewBank({ banca: '', moneda: 'RON' });
    setBankOpen(false);
    toast('success', 'Cont bancar adăugat');
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Setări</h1>
          <p className="sub">Datele PFA, regim fiscal, e-Factura, conturi bancare și cont personal</p>
        </div>
        <div className="actions">
          {tab === 'company' && (
            <button className="btn btn-primary" onClick={saveCompany}>
              Salvează
            </button>
          )}
          {tab === 'fiscal' && (
            <button className="btn btn-primary" onClick={saveFiscal}>
              Salvează
            </button>
          )}
          {tab === 'einvoice' && (
            <button className="btn btn-primary" onClick={saveEf}>
              Salvează
            </button>
          )}
          {tab === 'account' && (
            <button className="btn btn-primary" onClick={savePersonal}>
              Salvează
            </button>
          )}
        </div>
      </div>

      <div className="tabs">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => {
              setTab(t.key);
              onTabChange?.(t.key);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'company' && (
        <div style={{ display: 'grid', gap: 16, maxWidth: 720 }}>
          <Card title="Date de identificare">
            <div className="form-grid">
              <div className="field">
                <label>Denumire</label>
                <input
                  className="input"
                  value={company.denumire}
                  onChange={e => setCompany({ ...company, denumire: e.target.value })}
                />
              </div>
              <div className="field">
                <label>CUI</label>
                <input
                  className="input"
                  value={company.cui}
                  onChange={e => setCompany({ ...company, cui: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Număr registrul comerțului</label>
                <input
                  className="input"
                  value={company.numarRegComert}
                  onChange={e => setCompany({ ...company, numarRegComert: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Adresa</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="input"
                    value={company.adresaSocietate}
                    onChange={e => setCompany({ ...company, adresaSocietate: e.target.value })}
                  />
                  <button className="btn btn-outline" onClick={copyAdresa}>
                    Copiază
                  </button>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Codurile tale CAEN">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                border: '1px solid var(--border)',
                borderRadius: 8,
              }}
            >
              <Badge kind="info">Principal</Badge>
              <span style={{ fontWeight: 600 }}>{identity.caen?.[0]?.cod}</span>
              <span style={{ color: 'var(--text-2)', fontSize: 13 }}>
                {identity.caen?.[0]?.descriere}
              </span>
            </div>
          </Card>

          <Card title="Mențiuni pe factură">
            <div className="field">
              <input
                className="input"
                value={mentiuni}
                placeholder="Text afișat pe factura (opțional)"
                onChange={e => setMentiuni(e.target.value)}
              />
            </div>
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={saveMentiuni}>
                Salvează
              </button>
            </div>
          </Card>

          <Card title="Cod TVA intracomunitar">
            <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 12px' }}>
              Firmele neplătitoare de TVA care vor colabora cu firme din Uniunea Europeană au
              nevoie de acest cod special. Dacă ai deja un cod de TVA intracomunitar, te rugăm să
              îl introduci aici.
            </p>
            {identity.codTvaIntra ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                }}
              >
                <Badge kind="success">Adăugat</Badge>
                <span style={{ fontWeight: 600 }}>{identity.codTvaIntra}</span>
              </div>
            ) : (
              <button className="btn btn-outline" onClick={openTva}>
                Am cod TVA intracomunitar
              </button>
            )}
          </Card>
        </div>
      )}

      {tab === 'einvoice' && (
        <div style={{ display: 'grid', gap: 16, maxWidth: 720 }}>
          <Card title="Conectare e-Factura">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
                Contul este conectat la platforma e-Factura
              </span>
              <Badge kind="warning">În progres</Badge>
            </div>
          </Card>

          <Card title="Preferințe e-Factura">
            <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
              <div className="field">
                <label>Trimitere e-Factura</label>
                <select
                  className="input"
                  value={ef.trimitere}
                  onChange={e => setEf({ ...ef, trimitere: e.target.value as typeof ef.trimitere })}
                >
                  <option value="2-zile">În decurs de 2 zile de la emitere</option>
                  <option value="imediat">Cât mai repede după emitere</option>
                </select>
                <span className="hint">
                  Termenul legal de transmitere a unei e-Facturi este de maximum 5 zile de la
                  emitere.
                </span>
              </div>
              <div className="field">
                <label>Date de contact</label>
                <select
                  className="input"
                  value={ef.dateContact}
                  onChange={e => setEf({ ...ef, dateContact: e.target.value as typeof ef.dateContact })}
                >
                  <option value="nu">Nu sunt incluse în e-Factura</option>
                  <option value="da">Include e-mail și telefon în e-Factura</option>
                </select>
                <span className="hint">
                  Nu este obligatoriu să incluzi datele tale de contact în e-Factura.
                </span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {tab === 'bankaccounts' && (
        <div style={{ display: 'grid', gap: 16, maxWidth: 720 }}>
          <Card title="Securitatea datelor personale">
            <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0 }}>
              Pentru a efectua modificări ale conturilor bancare îți vom trimite un cod de
              securitate prin SMS.
            </p>
          </Card>

          <Card
            title="Conturi bancare"
            action={
              <button className="btn btn-primary btn-sm" onClick={() => setBankOpen(true)}>
                Adaugă cont bancar
              </button>
            }
          >
            <table className="table">
              <thead>
                <tr>
                  <th>Banca</th>
                  <th>Moneda</th>
                </tr>
              </thead>
              <tbody>
                {settings.bankAccounts.map(b => (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 500, color: 'var(--text)' }}>{b.banca}</td>
                    <td>{b.moneda}</td>
                  </tr>
                ))}
                {settings.bankAccounts.length === 0 && (
                  <tr>
                    <td colSpan={2} style={{ color: 'var(--text-3)' }}>
                      Niciun cont bancar înregistrat.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div style={{ marginTop: 12 }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  toast(
                    'info',
                    'Un cont bancar de PFA este recomandat pentru separarea finanțelor personale de cele profesionale.'
                  )
                }
              >
                Îmi trebuie cont bancar de PFA?
              </button>
            </div>
          </Card>
        </div>
      )}

      {tab === 'account' && (
        <div style={{ display: 'grid', gap: 16, maxWidth: 720 }}>
          <Card title="Securitatea datelor personale">
            <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0 }}>
              Pentru modificări ale datelor personale îți vom trimite un cod de securitate prin
              SMS.
            </p>
          </Card>

          <Card title="Date personale">
            <div className="form-grid">
              <div className="field">
                <label>Nume</label>
                <input
                  className="input"
                  value={personal.nume}
                  onChange={e => setPersonal({ ...personal, nume: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Email</label>
                <input
                  className="input"
                  value={personal.email}
                  onChange={e => setPersonal({ ...personal, email: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Telefon</label>
                <input
                  className="input"
                  value={personal.telefon}
                  onChange={e => setPersonal({ ...personal, telefon: e.target.value })}
                />
              </div>
            </div>
          </Card>

          <Card title="Opțiuni cont">
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-outline"
                onClick={() => toast('info', 'Schimbare parolă — simulare (versiune locală)')}
              >
                Schimbă parola
              </button>
              <button
                className="btn btn-outline"
                onClick={() => toast('info', 'Gestionare cookies — simulare (versiune locală)')}
              >
                Gestionează cookies
              </button>
            </div>
          </Card>
        </div>
      )}

      {tab === 'fiscal' && (
        <div style={{ display: 'grid', gap: 16, maxWidth: 720 }}>
          {!isSelectableRegime(fiscal.regime) && (
            <Card title="Regim fiscal nesusținut">
              <p style={{ fontSize: 13, color: 'var(--danger)', margin: 0 }}>
                {regimeRefusalReason(fiscal.regime)}
              </p>
            </Card>
          )}

          <Card title="Profil fiscal">
            <div className="form-grid">
              <div className="field">
                <label>Regim fiscal <span className="req">*</span></label>
                <select
                  className="input"
                  value={fiscal.regime}
                  onChange={e => setFiscal({ ...fiscal, regime: e.target.value as PfaRegime })}
                >
                  {!isSelectableRegime(fiscal.regime) && (
                    <option value={fiscal.regime} disabled>
                      {fiscal.regime} — nu poate fi calculat
                    </option>
                  )}
                  {regimeOptions.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
                <span className="hint">
                  Cod fiscal art. 123 alin. (1). impozit pe profit nu este oferit: art. 13 alin. (1),
                  art. 14 și art. 15 rezervă Titlul II persoanelor juridice, iar art. 120 a fost abrogat.
                </span>
                {errors.regime && <span className="error">{errors.regime}</span>}
              </div>

              <div className="field">
                <label>Cod CAEN</label>
                <input
                  className="input"
                  value={fiscal.caen}
                  onChange={e => setFiscal({ ...fiscal, caen: e.target.value })}
                />
                <span className="hint">
                  Codul CAEN nu schimbă regimul fiscal; nu susține o normă de venit (nicio regulă de
                  normă nu a fost verificată pentru 2026).
                </span>
              </div>

              <div className="field">
                <label>Anul începerii activității <span className="req">*</span></label>
                <input
                  className="input"
                  value={fiscal.pfaStartYear}
                  onChange={e => setFiscal({ ...fiscal, pfaStartYear: e.target.value })}
                />
                {errors.pfaStartYear && <span className="error">{errors.pfaStartYear}</span>}
              </div>

              <div className="field">
                <label>An fiscal de referință <span className="req">*</span></label>
                <input
                  className="input"
                  value={fiscal.fiscalYear}
                  onChange={e => setFiscal({ ...fiscal, fiscalYear: e.target.value })}
                />
                {errors.fiscalYear && <span className="error">{errors.fiscalYear}</span>}
              </div>

              <div className="field">
                <label>Data înființării (fracțiune de an)</label>
                <input
                  className="input"
                  type="date"
                  value={fiscal.pfaStartDate}
                  onChange={e => setFiscal({ ...fiscal, pfaStartDate: e.target.value })}
                />
                <span className="hint">
                  Art. 118 alin. (3): venitul realizat într-o fracțiune de an se consideră venit anual —
                  baza nu se proratează. Necompletat = profil fără dată de înființare.
                </span>
                {errors.pfaStartDate && <span className="error">{errors.pfaStartDate}</span>}
              </div>

              <div className="field">
                <label>Venit din salarii</label>
                <select
                  className="input"
                  value={fiscal.salaryStatus}
                  onChange={e => setFiscal({ ...fiscal, salaryStatus: e.target.value as PfaSalaryStatus })}
                >
                  <option value="nu">nu</option>
                  <option value="da">da</option>
                </select>
              </div>

              <div className="field">
                <label>Venit brut anual din salarii (lei)</label>
                <input
                  className="input"
                  value={fiscal.salaryIncomeLei}
                  disabled={fiscal.salaryStatus !== 'da'}
                  onChange={e => setFiscal({ ...fiscal, salaryIncomeLei: e.target.value })}
                />
                <span className="hint">
                  Art. 174 alin. (7) lit. a): diferența de la alin. (6) nu se datorează dacă salariul
                  anual este cel puțin 6 salarii minime brute (24.300 lei în 2026). Sub acest prag
                  diferența de 2.430 lei se datorează și nu se deduce (art. 118 alin. (2) lit. b)).
                </span>
                {errors.salaryIncomeLei && <span className="error">{errors.salaryIncomeLei}</span>}
              </div>

              <div className="field">
                <label>Venituri din pensii</label>
                <select
                  className="input"
                  value={fiscal.pensionStatus}
                  onChange={e => setFiscal({ ...fiscal, pensionStatus: e.target.value as PfaPensionStatus })}
                >
                  <option value="nu">nu</option>
                  <option value="da">da</option>
                </select>
                <span className="hint">
                  Art. 174 alin. (7) lit. c): elimină doar diferența de la alin. (6); CAS se datorează
                  doar în condițiile art. 150 alin. (1).
                </span>
              </div>

              <div className="field">
                <label>Asigurări sociale de sănătate</label>
                <select
                  className="input"
                  value={fiscal.socialInsuranceStatus}
                  onChange={e =>
                    setFiscal({ ...fiscal, socialInsuranceStatus: e.target.value as PfaSocialInsuranceStatus })
                  }
                >
                  <option value="obligatoriu">obligatoriu</option>
                  <option value="exempt">scutit</option>
                  <option value="neplata">neplata</option>
                </select>
                <span className="hint">
                  Atenție: „scutit”/“neplata” zero CASS în motor, dar temeiul (art. 154 alin. (1)) nu a
                  fost verificat — să nu fie folosit ca dovedire (docs/ai/STATE.md).
                </span>
              </div>

              <div className="field">
                <label>Scutire de TVA</label>
                <select
                  className="input"
                  value={fiscal.vatExempt}
                  onChange={e => setFiscal({ ...fiscal, vatExempt: e.target.value })}
                >
                  <option value="nu">nu</option>
                  <option value="da">da</option>
                </select>
              </div>

              <div className="field">
                <label>Prag plăți în numerar (lei)</label>
                <input
                  className="input"
                  value={fiscal.cashFloorLei}
                  onChange={e => setFiscal({ ...fiscal, cashFloorLei: e.target.value })}
                />
                {errors.cashFloorLei && <span className="error">{errors.cashFloorLei}</span>}
              </div>
            </div>
          </Card>
        </div>
      )}

      {tvaOpen && (
        <Modal
          title="Cod TVA intracomunitar"
          onClose={() => setTvaOpen(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setTvaOpen(false)}>
                Renunță
              </button>
              <button className="btn btn-primary" onClick={searchTva}>
                Caută codul
              </button>
              {tvaFound && (
                <button className="btn btn-primary" onClick={addTva}>
                  Adaugă codul
                </button>
              )}
            </>
          }
        >
          <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 12px' }}>
            Introdu codul unic de identificare fiscală obținut de la ANAF în scop de TVA
            intracomunitar
          </p>
          <div className="field">
            <input
              className="input"
              value={tvaCode}
              placeholder="RO123456789"
              onChange={e => {
                setTvaCode(e.target.value);
                setTvaFound(false);
              }}
            />
            {tvaFound && (
              <span className="hint">Cod validat (căutare simulată ANAF)</span>
            )}
          </div>
        </Modal>
      )}

      {bankOpen && (
        <Modal
          title="Adaugă cont bancar"
          onClose={() => setBankOpen(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setBankOpen(false)}>
                Renunță
              </button>
              <button className="btn btn-primary" onClick={addBank}>
                Adaugă
              </button>
            </>
          }
        >
          <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
            <div className="field">
              <label>Banca</label>
              <input
                className="input"
                value={newBank.banca}
                placeholder="ex. CEC Bank"
                onChange={e => setNewBank({ ...newBank, banca: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Moneda</label>
              <select
                className="input"
                value={newBank.moneda}
                onChange={e => setNewBank({ ...newBank, moneda: e.target.value })}
              >
                <option value="RON">RON</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
