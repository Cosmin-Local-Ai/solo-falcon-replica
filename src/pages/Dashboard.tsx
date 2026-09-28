import { useStore } from '../data/store';
import { fmtRON, fmtDate, total, REV_STATUS_LABEL, statusBadge } from '../data/types';
import { Card, StatCard, Badge } from '../components/ui';
import type { Page } from '../App';

export default function Dashboard({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const { revenues, expenses, declarations, documents } = useStore();

  const revTotal = revenues.filter(r => r.status === 'inregistrata').reduce((s, r) => s + total(r), 0);
  const expTotal = expenses.filter(e => e.status === 'inregistrata').reduce((s, e) => s + total(e), 0);
  const sold = revTotal - expTotal;
  const pendingRev = revenues.filter(r => r.status === 'in-asteptare').length;
  const respins = revenues.filter(r => r.status === 'respinsa').length + expenses.filter(e => e.status === 'respinsa').length;
  const declPENDING = declarations.filter(d => d.status === 'in-asteptare').length;

  const recent = [...revenues].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  return (
    <div>
      <div className="stat-grid">
        <StatCard label="Venituri înregistrate" value={fmtRON(revTotal)} hint="Facturi și notele fără factură validate" />
        <StatCard label="Cheltuieli înregistrate" value={fmtRON(expTotal)} hint="Facturi și bonuri fiscale validate" />
        <StatCard label="Sold curent" value={fmtRON(sold)} tone={sold >= 0 ? 'pos' : 'neg'} hint="Venituri − cheltuieli" />
        <StatCard
          label="De verificat"
          value={String(pendingRev + respins + declPENDING)}
          hint={`${pendingRev} venituri în așteptare · ${respins} respinse · ${declPENDING} declarații`}
        />
      </div>

      <div className="stack">
        <Card
          title="Ultimii venituri"
          action={<button className="btn btn-sm btn-outline" onClick={() => onNavigate('revenues')}>Vezi toate</button>}
        >
          <table className="table">
            <thead>
              <tr>
                <th>Document</th><th>Client</th><th>Data</th><th>Status</th><th className="amount">Total</th>
              </tr>
            </thead>
            <tbody>
              {recent.map(r => (
                <tr key={r.id} className="clickable" onClick={() => onNavigate('revenues')}>
                  <td>{r.nr}</td>
                  <td>{r.client}</td>
                  <td>{fmtDate(r.date)}</td>
                  <td><Badge kind={statusBadge(r.status)}>{REV_STATUS_LABEL[r.status]}</Badge></td>
                  <td className="amount">{fmtRON(total(r))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <div className="flex gap-2">
          <Card title="Declarații" action={<button className="btn btn-sm btn-outline" onClick={() => onNavigate('declarations')}>Vezi toate</button>}>
            <table className="table">
              <thead>
                <tr><th>Perioada</th><th>Venituri</th><th>Status</th></tr>
              </thead>
              <tbody>
                {declarations.slice(0, 3).map(d => (
                  <tr key={d.id} className="clickable" onClick={() => onNavigate('declarations')}>
                    <td>{d.luna}/{d.an}</td>
                    <td className="amount">{fmtRON(d.venituri)}</td>
                    <td><Badge kind={statusBadge(d.status)}>{d.status === 'transmisa' ? 'Transmisa' : d.status === 'respinsa' ? 'Respinsă' : d.status === 'in-asteptare' ? 'În așteptare' : 'Înregistrată'}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card title="Documente recente" action={<button className="btn btn-sm btn-outline" onClick={() => onNavigate('documents')}>Vezi toate</button>}>
            <table className="table">
              <thead>
                <tr><th>Nume</th><th>Data</th><th>Categorie</th></tr>
              </thead>
              <tbody>
                {documents.slice(0, 3).map(d => (
                  <tr key={d.id} className="clickable" onClick={() => onNavigate('documents')}>
                    <td>{d.nume}</td>
                    <td>{fmtDate(d.data)}</td>
                    <td>{d.categoria}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </div>
    </div>
  );
}
