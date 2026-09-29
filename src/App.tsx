import { useCallback, useEffect, useState } from 'react';
import { StoreProvider, useStore } from './data/store';
import Dashboard from './pages/Dashboard';
import Revenues from './pages/Revenues';
import Expenses from './pages/Expenses';
import EFactura from './pages/EFactura';
import Declarations from './pages/Declarations';
import Documents from './pages/Documents';
import Clients from './pages/Clients';
import Settings from './pages/Settings';
import { Toasts } from './components/ui';

export type Page =
  | 'dashboard'
  | 'revenues'
  | 'expenses'
  | 'e-factura'
  | 'declarations'
  | 'documents'
  | 'clients'
  | 'settings';

const PAGES: Page[] = [
  'dashboard',
  'revenues',
  'expenses',
  'e-factura',
  'declarations',
  'documents',
  'clients',
  'settings',
];

const NAV: { page: Page; label: string; icon: string }[] = [
  { page: 'dashboard', label: 'Panou de control', icon: '▦' },
  { page: 'revenues', label: 'Venituri', icon: '↑' },
  { page: 'expenses', label: 'Cheltuieli', icon: '↓' },
  { page: 'e-factura', label: 'e-Factura', icon: '⚡' },
  { page: 'declarations', label: 'Declarații', icon: '📋' },
  { page: 'documents', label: 'Documente', icon: '📁' },
  { page: 'clients', label: 'Clienți', icon: '👥' },
  { page: 'settings', label: 'Setări', icon: '⚙' },
];

const TITLES: Record<Page, string> = {
  dashboard: 'Panou de control',
  revenues: 'Venituri',
  expenses: 'Cheltuieli',
  'e-factura': 'e-Factura',
  declarations: 'Declarații',
  documents: 'Documente',
  clients: 'Clienți',
  settings: 'Setări',
};

// --- URL routing: /<page> with optional #!<tab> ---

interface Route {
  page: Page;
  tab: string | null;
}

// Canonical tab keys per page (must match the tab state inside each page).
// Exact URL forms required:
//   /revenues#!/registered  /revenues#!/pending  /revenues#!/rejected
//   /expenses#!/registered  /expenses#!/rejected
//   /documents#!/company    /settings#!/company
// Pages may also generate their own extra tabs (e.g. /documents#!/toate).
const VALID_TABS: Partial<Record<Page, string[]>> = {
  revenues: ['registered', 'pending', 'rejected'],
  expenses: ['registered', 'rejected'],
  documents: ['company', 'statements', 'reports'],
  // Mirrors the live SOLO settings tabs (docs/reference/settings.md);
  // the real app's "Abonament" (subscription) tab is not replicated.
  settings: ['company', 'einvoice', 'bankaccounts', 'account'],
};

export function parseRoute(): Route {
  const seg = window.location.pathname.split('/').filter(Boolean).pop() ?? '';
  const page: Page = (PAGES as string[]).includes(seg) ? (seg as Page) : 'dashboard';
  const raw = window.location.hash.replace(/^#!\/?/, '');
  const valid = VALID_TABS[page];
  const tab = valid && raw && valid.includes(raw) ? raw : null;
  return { page, tab };
}

function routeToUrl(page: Page, tab: string | null): string {
  return `/${page}${tab ? `#!/${tab}` : ''}`;
}

function Shell() {
  const [route, setRoute] = useState<Route>(parseRoute);
  const { revenues, expenses, declarations } = useStore();
  const pendingCount =
    revenues.filter(r => r.status === 'in-asteptare').length +
    expenses.filter(e => e.status === 'respinsa').length +
    declarations.filter(d => d.status === 'in-asteptare').length;

  const navigate = useCallback((page: Page, tab: string | null = null) => {
    const url = routeToUrl(page, tab);
    if (window.location.pathname + window.location.hash !== url) {
      window.history.pushState({ page, tab }, '', url);
    }
    setRoute({ page, tab });
  }, []);

  // Back/forward navigation, plus direct hash edits in the URL bar.
  useEffect(() => {
    const onPop = () => setRoute(parseRoute());
    window.addEventListener('popstate', onPop);
    window.addEventListener('hashchange', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('hashchange', onPop);
    };
  }, []);

  // Normalize the initial URL (e.g. "/" → "/dashboard", aliases → canonical keys)
  // without adding a history entry.
  useEffect(() => {
    const r = parseRoute();
    const expected = routeToUrl(r.page, r.tab);
    if (window.location.pathname + window.location.hash !== expected) {
      window.history.replaceState(null, '', expected);
    }
  }, []);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span className="mark">S</span> SOLO
        </div>
        <nav>
          {NAV.map(n => (
            <a
              key={n.page}
              className={`nav-item ${route.page === n.page ? 'active' : ''}`}
              href={`/${n.page}`}
              onClick={e => {
                e.preventDefault();
                navigate(n.page);
              }}
            >
              <span className="icon">{n.icon}</span>
              {n.label}
              {n.page === 'declarations' && pendingCount > 0 && (
                <span className="badge-count">{pendingCount}</span>
              )}
            </a>
          ))}
        </nav>
      </aside>
      <div className="main">
        <header className="topbar">
          <span className="page-title">{TITLES[route.page]}</span>
          <span className="spacer" />
          <div className="topbar-user">
            <span>Popescu Ion</span>
            <span className="avatar">PI</span>
          </div>
        </header>
        <div className="main-content">
          {route.page === 'dashboard' && <Dashboard onNavigate={navigate} />}
          {route.page === 'revenues' && (
            <Revenues
              initialTab={route.tab as 'registered' | 'pending' | 'rejected' | undefined}
              onTabChange={t => navigate('revenues', t)}
            />
          )}
          {route.page === 'expenses' && (
            <Expenses
              initialTab={route.tab as 'registered' | 'rejected' | undefined}
              onTabChange={t => navigate('expenses', t)}
            />
          )}
          {route.page === 'e-factura' && <EFactura />}
          {route.page === 'declarations' && <Declarations />}
          {route.page === 'documents' && (
            <Documents
              initialTab={route.tab ?? undefined}
              onTabChange={t => navigate('documents', t)}
            />
          )}
          {route.page === 'clients' && <Clients />}
          {route.page === 'settings' && (
            <Settings
              initialTab={route.tab ?? undefined}
              onTabChange={t => navigate('settings', t)}
            />
          )}
        </div>
      </div>
      <Toasts />
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
