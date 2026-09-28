import { useMemo, useState } from 'react';
import { useStore } from '../data/store';
import { fmtRON, fmtDate, total } from '../data/types';
import type { Revenue } from '../data/types';
import { Card, Badge, Empty, Pagination } from '../components/ui';

const TABS = [
  { key: 'Acceptată', label: 'Acceptate' },
  { key: 'În așteptare', label: 'În așteptare' },
  { key: 'Respinsă', label: 'Respinse' },
] as const;

const PAGE_SIZE = 8;

const eBadge = (s?: string) =>
  s === 'Acceptată' ? 'badge-success' : s === 'În așteptare' ? 'badge-warning' : 'badge-danger';

export default function EFactura() {
  const { revenues, updateRevenue, toast } = useStore();
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('Acceptată');
  const [page, setPage] = useState(1);

  const rows = useMemo(() =>
    revenues
      .filter(r => (r.eFacturaStatus ?? 'Acceptată') === tab)
      .sort((a, b) => b.date.localeCompare(a.date)),
  [revenues, tab]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const counts = (k: string) => revenues.filter(r => (r.eFacturaStatus ?? 'Acceptată') === k).length;

  const retry = (r: Revenue) => {
    updateRevenue({ ...r, status: 'in-asteptare', statusDetail: 'Retransmisă către e-Factura', eFacturaStatus: 'În așteptare' });
    toast('info', `${r.nr} a fost retransmisă către e-Factura`);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>e-Factura</h1>
          <div className="sub">Starea facturilor transmise în sistemul e-Factura.</div>
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
            icon="⚡"
            title="Nicio factură în această stare"
            text="Facturile transmise către e-Factura vor apărea aici."
          />
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Document</th><th>Client</th><th>CUI</th><th>Data</th>
                  <th className="amount">Total</th><th>Status e-Factura</th><th />
                </tr>
              </thead>
              <tbody>
                {pageRows.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 500, color: 'var(--text)' }}>{r.nr}</td>
                    <td>{r.client}</td>
                    <td className="muted">{r.cui}</td>
                    <td>{fmtDate(r.date)}</td>
                    <td className="amount">{fmtRON(total(r))}</td>
                    <td>
                      <Badge kind={eBadge(r.eFacturaStatus)}>{r.eFacturaStatus ?? 'Acceptată'}</Badge>
                      {r.statusDetail && <div className="text-sm muted" style={{ marginTop: 3 }}>{r.statusDetail}</div>}
                    </td>
                    <td>
                      <div className="row-actions">
                        {r.eFacturaStatus === 'Respinsă' && (
                          <button className="btn btn-sm btn-outline" onClick={() => retry(r)}>Retransmite</button>
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
    </div>
  );
}
