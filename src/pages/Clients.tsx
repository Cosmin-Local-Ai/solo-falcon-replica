import { useMemo, useState } from 'react';
import { useStore } from '../data/store';
import type { Client } from '../data/types';
import { Card, Badge, Modal, Empty } from '../components/ui';

function ClientForm({ initial, onSave, onClose }: {
  initial?: Client;
  onSave: (c: Omit<Client, 'id'>) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState({
    denumire: initial?.denumire ?? '',
    cui: initial?.cui ?? '',
    email: initial?.email ?? '',
    telefon: initial?.telefon ?? '',
    oras: initial?.oras ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  const submit = () => {
    const e: Record<string, string> = {};
    if (!f.denumire.trim()) e.denumire = 'Denumirea este obligatorie';
    if (!f.cui.trim()) e.cui = 'CUI/CNP este obligatoriu';
    setErrors(e);
    if (Object.keys(e).length) return;
    onSave({
      denumire: f.denumire.trim(), cui: f.cui.trim(),
      email: f.email.trim() || undefined, telefon: f.telefon.trim() || undefined,
      oras: f.oras.trim() || undefined,
    });
  };

  return (
    <Modal
      title={initial ? `Editează ${initial.denumire}` : 'Adaugă client'}
      onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Anulează</button>
        <button className="btn btn-primary" onClick={submit}>{initial ? 'Salvează' : 'Adaugă'}</button>
      </>}
    >
      <div className="form-grid">
        <div className="field full">
          <label>Denumire <span className="req">*</span></label>
          <input className={errors.denumire ? 'invalid' : ''} value={f.denumire} onChange={e => set('denumire', e.target.value)} placeholder="SC EXEMPLU SRL / Nume (PFA)" />
          {errors.denumire && <span className="error">{errors.denumire}</span>}
        </div>
        <div className="field">
          <label>CUI / CNP <span className="req">*</span></label>
          <input className={errors.cui ? 'invalid' : ''} value={f.cui} onChange={e => set('cui', e.target.value)} placeholder="RO…" />
          {errors.cui && <span className="error">{errors.cui}</span>}
        </div>
        <div className="field">
          <label>Telefon</label>
          <input value={f.telefon} onChange={e => set('telefon', e.target.value)} placeholder="07xx xxx xxx" />
        </div>
        <div className="field">
          <label>Email</label>
          <input type="email" value={f.email} onChange={e => set('email', e.target.value)} placeholder="email@exemplu.ro" />
        </div>
        <div className="field">
          <label>Oraș</label>
          <input value={f.oras} onChange={e => set('oras', e.target.value)} placeholder="Oraș" />
        </div>
      </div>
    </Modal>
  );
}

export default function Clients() {
  const { clients, addClient, toast } = useStore();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Client | 'new' | null>(null);

  const rows = useMemo(() =>
    clients
      .filter(c => !search || (c.denumire + ' ' + c.cui).toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.denumire.localeCompare(b.denumire)),
  [clients, search]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Clienți</h1>
          <div className="sub">{clients.length} clienți înregistrați în evidența dvs.</div>
        </div>
        <div className="actions">
          <input
            placeholder="Caută client…"
            style={{ border: '1px solid var(--border-strong)', borderRadius: 6, padding: '7px 10px', fontSize: 13, width: 220 }}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button className="btn btn-primary" onClick={() => setEditing('new')}>+ Adaugă client</button>
        </div>
      </div>

      <Card>
        {rows.length === 0 ? (
          <Empty
            title="Niciun client"
            text={search ? 'Niciun rezultat pentru căutare.' : 'Adăugați primul client pentru a-l selecta la emiterea facturilor.'}
            action={<button className="btn btn-primary" onClick={() => setEditing('new')}>+ Adaugă client</button>}
          />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Denumire</th><th>CUI / CNP</th><th>Email</th><th>Telefon</th><th>Oraș</th><th>Tip</th><th />
              </tr>
            </thead>
            <tbody>
              {rows.map(c => (
                <tr key={c.id} className="clickable" onClick={() => setEditing(c)}>
                  <td style={{ fontWeight: 500, color: 'var(--text)' }}>{c.denumire}</td>
                  <td className="muted">{c.cui}</td>
                  <td>{c.email ?? '—'}</td>
                  <td>{c.telefon ?? '—'}</td>
                  <td>{c.oras ?? '—'}</td>
                  <td>
                    <Badge kind={c.denumire.includes('PFA') ? 'badge-neutral' : 'badge-info'}>
                      {c.denumire.includes('PFA') ? 'Persoană' : 'Firmă'}
                    </Badge>
                  </td>
                  <td />
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {editing && (
        <ClientForm
          initial={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSave={c => {
            addClient(c);
            toast('success', `Clientul ${c.denumire} a fost adăugat`);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
