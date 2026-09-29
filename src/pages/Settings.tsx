import { useEffect, useState } from 'react';
import { useStore } from '../data/store';
import { Card, Badge, Modal } from '../components/ui';

// Canonical route hash keys (must match VALID_TABS.settings in App.tsx).
// Mirrors the live SOLO settings page (docs/reference/settings.md);
// the real app's "Abonament" tab is intentionally not replicated.
const TABS = [
  { key: 'company', label: 'PFA' },
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
  const { settings, updateSettings, toast } = useStore();
  const [tab, setTab] = useState<TabKey>(
    TABS.some(t => t.key === initialTab) ? (initialTab as TabKey) : 'company'
  );

  // Sync tab when the URL changes (back/forward navigation).
  useEffect(() => {
    if (TABS.some(t => t.key === initialTab)) setTab(initialTab as TabKey);
  }, [initialTab]);

  // --- PFA tab: editable registration data ---
  const [company, setCompany] = useState({
    denumire: settings.company.denumire,
    cui: settings.company.cui,
    numarRegComert: settings.company.numarRegComert,
  });
  const [mentiuni, setMentiuni] = useState(settings.company.mentiuniFactura ?? '');

  // --- e-Factura tab ---
  const [ef, setEf] = useState(settings.eFactura);

  // --- Modals ---
  const [tvaOpen, setTvaOpen] = useState(false);
  const [tvaCode, setTvaCode] = useState('');
  const [tvaFound, setTvaFound] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);
  const [newBank, setNewBank] = useState({ banca: '', moneda: 'RON' });

  function saveCompany() {
    updateSettings(s => ({ ...s, company: { ...s.company, ...company } }));
    toast('success', 'Datele PFA au fost salvate');
  }

  function saveMentiuni() {
    updateSettings(s => ({
      ...s,
      company: { ...s.company, mentiuniFactura: mentiuni.trim() },
    }));
    toast('success', 'Mențiuni pe factură salvate');
  }

  function saveEf() {
    updateSettings(s => ({ ...s, eFactura: ef }));
    toast('success', 'Setările e-Factura au fost salvate');
  }

  function copyAdresa() {
    navigator.clipboard
      ?.writeText(settings.company.adresa)
      .then(() => toast('success', 'Adresă copiată în clipboard'))
      .catch(() => toast('error', 'Nu am putut copia adresa'));
  }

  function openTva() {
    setTvaCode(settings.company.codTvaIntra ?? '');
    setTvaFound(false);
    setTvaOpen(true);
  }

  function searchTva() {
    // Simulated ANAF lookup: any non-empty code is accepted.
    setTvaFound(tvaCode.trim().length > 0);
  }

  function addTva() {
    updateSettings(s => ({
      ...s,
      company: { ...s.company, codTvaIntra: tvaCode.trim() },
    }));
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
          <p className="sub">Datele PFA, e-Factura, conturi bancare și cont personal</p>
        </div>
        <div className="actions">
          {tab === 'company' && (
            <button className="btn btn-primary" onClick={saveCompany}>
              Salvează
            </button>
          )}
          {tab === 'einvoice' && (
            <button className="btn btn-primary" onClick={saveEf}>
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
                  <input className="input" value={settings.company.adresa} disabled />
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
              <span style={{ fontWeight: 600 }}>{settings.company.caen[0]?.cod}</span>
              <span style={{ color: 'var(--text-2)', fontSize: 13 }}>
                {settings.company.caen[0]?.descriere}
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
            {settings.company.codTvaIntra ? (
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
                <span style={{ fontWeight: 600 }}>{settings.company.codTvaIntra}</span>
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
                <input className="input" value={settings.personal.nume} disabled />
              </div>
              <div className="field">
                <label>Email</label>
                <input className="input" value={settings.personal.email} disabled />
              </div>
              <div className="field">
                <label>Telefon</label>
                <input className="input" value={settings.personal.telefon} disabled />
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
