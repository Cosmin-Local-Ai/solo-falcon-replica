import { useState } from "react";
import { useStore } from "../data/store";
import { Card, Badge } from "../components/ui";

const PREFS = [
  { key: "emailAlerts", label: "Alerte prin email", desc: "Primește alerte pentru termene fiscale iminente" },
  { key: "weeklyDigest", label: "Raport săptămânal", desc: "Rezumat săptămânal al veniturilor și cheltuielilor" },
  { key: "autoArchive", label: "Arhivare automată", desc: "Arhivează documentele finalizate automat" },
  { key: "darkMode", label: "Mod întunecat", desc: "Comută tema aplicației" },
] as const;

type PrefKey = (typeof PREFS)[number]["key"];

export default function Settings() {
  const { toast } = useStore();
  const [profile, setProfile] = useState({
    name: "Andrei Popescu",
    email: "andrei@solo.ro",
    phone: "0722 123 456",
    company: "SOLO Consulting S.R.L.",
    cui: "RO12345678",
    city: "Cluj-Napoca",
  });
  const [prefs, setPrefs] = useState<Record<PrefKey, boolean>>({
    emailAlerts: true,
    weeklyDigest: true,
    autoArchive: false,
    darkMode: false,
  });

  function save() {
    toast('success', 'Setări salvate');
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Setări</h1>
          <p className="sub">Profil, preferințe și cont</p>
        </div>
        <div className="actions">
          <button className="btn btn-primary" onClick={save}>
            Salvează modificări
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card>
          <div className="card-head">
            <h2>Profil</h2>
          </div>
          <div className="form-grid">
            <div className="field">
              <label>Nume</label>
              <input
                className="input"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Email</label>
              <input
                className="input"
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Telefon</label>
              <input
                className="input"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Oraș</label>
              <input
                className="input"
                value={profile.city}
                onChange={(e) => setProfile({ ...profile, city: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Firmă</label>
              <input
                className="input"
                value={profile.company}
                onChange={(e) => setProfile({ ...profile, company: e.target.value })}
              />
            </div>
            <div className="field">
              <label>CUI</label>
              <input
                className="input"
                value={profile.cui}
                onChange={(e) => setProfile({ ...profile, cui: e.target.value })}
              />
            </div>
          </div>
        </Card>

        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <Card>
            <div className="card-head">
              <h2>Notificări</h2>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              {PREFS.map((p) => (
                <label
                  key={p.key}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    cursor: "pointer",
                    padding: "10px 12px",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    background: "#fff",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={prefs[p.key]}
                    onChange={(e) => setPrefs({ ...prefs, [p.key]: e.target.checked })}
                    style={{ marginTop: 2, accentColor: "var(--primary)" }}
                  />
                  <span>
                    <span style={{ display: "block", fontWeight: 500, fontSize: 13.5 }}>{p.label}</span>
                    <span style={{ display: "block", fontSize: 12, color: "var(--text-3)" }}>{p.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </Card>

          <Card>
            <div className="card-head">
              <h2>Cont</h2>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{profile.name}</div>
                  <div className="tcell-sub">{profile.email}</div>
                </div>
                <Badge kind="info">Administrator</Badge>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => toast('info', 'Schimbare parolă (simulare)')}>
                  Schimbă parola
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => toast('info', 'Deconectare (simulare)')}>
                  Deconectează
                </button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
