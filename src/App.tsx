import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type HTMLAttributes } from 'react';
import { StoreProvider, useStore } from './data/store';
import { quarantineSummary } from './data/quarantine';
import { MoneyPrecisionNoticeBanner } from './components/MoneyPrecisionNotice';
import { useDashboardData } from './data/dashboardAdapter';
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
  // `fiscal` is an addition of this replica: the PfaProfile write path (Phase 6).
  settings: ['company', 'fiscal', 'einvoice', 'bankaccounts', 'account'],
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

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0] ?? '')
    .join('')
    .toUpperCase();

/**
 * True when the viewport is at/below the mobile breakpoint (≤768px), where
 * the sidebar is an off-canvas drawer. Above that it is a static column that
 * must stay interactive (never `inert` / `aria-hidden`).
 */
function useIsMobile() {
  // Degrades to `false` (desktop) in environments without matchMedia (jsdom).
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== 'function') return () => {};
      const mq = window.matchMedia('(max-width: 768px)');
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () =>
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(max-width: 768px)').matches
        : false,
    () => false,
  );
}

function Shell() {
  const [route, setRoute] = useState<Route>(parseRoute);
  const [navOpen, setNavOpen] = useState(false);
  const isMobile = useIsMobile();
  const { profile, dataOrigin, migration, quarantine, moneyNotices, toast } = useStore();

  // D-3: a rejected payload must be VISIBLE, not silent (B-11 was the silent
  // reset). The banner below covers the recoverable case; a migration is worth
  // one sentence too, because the user's stored data was rewritten on load.
  // It is keyed on `migration`, not on `dataOrigin` — per D-3b a migrated
  // payload is still 'persisted', and `migration` is the separate signal.
  const migrationAnnounced = useRef(false);
  useEffect(() => {
    if (!migration || migrationAnnounced.current) return;
    migrationAnnounced.current = true;
    toast(
      'info',
      `Datele salvate au fost aduse la zi (${migration.stepsApplied.join(', ') || 'format nou'})`,
    );
  }, [migration, toast]);
  const { pendingCounts } = useDashboardData();
  const pendingCount =
    pendingCounts.revenuesInAsteptare +
    pendingCounts.expensesRespinsa +
    pendingCounts.declarationsInAsteptare;

  const navigate = useCallback((page: Page, tab: string | null = null) => {
    const url = routeToUrl(page, tab);
    if (window.location.pathname + window.location.hash !== url) {
      window.history.pushState({ page, tab }, '', url);
    }
    setRoute({ page, tab });
  }, []);

  // Back/forward navigation, plus direct hash edits in the URL bar.
  useEffect(() => {
    const onPop = () => {
      setRoute(parseRoute());
      setNavOpen(false); // close the mobile drawer on navigation
    };
    window.addEventListener('popstate', onPop);
    window.addEventListener('hashchange', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('hashchange', onPop);
    };
  }, []);

  // Close the mobile drawer with Escape.
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navOpen]);

  // Normalize the initial URL (e.g. "/" → "/dashboard", aliases → canonical keys)
  // without adding a history entry.
  useEffect(() => {
    const r = parseRoute();
    const expected = routeToUrl(r.page, r.tab);
    if (window.location.pathname + window.location.hash !== expected) {
      window.history.replaceState(null, '', expected);
    }
  }, []);

  // SAFETY: `inert` is a real HTML attribute that the installed React `HTMLAttributes` typing predates, so
  // the object literal needs one assertion to be spread onto the element. The value is always the empty
  // string the DOM expects, and the object is EMPTY unless the mobile drawer is closed, so the asserted
  // shape can never reach a visible, interactive element. Hoisted out of the JSX so the invariant sits next
  // to the assertion instead of being buried between attributes.
  const inertAttrs = (isMobile && !navOpen ? { inert: '' } : {}) as HTMLAttributes<HTMLElement>;

  return (
    <div className="app">
      <aside
        className={`sidebar${navOpen ? ' open' : ''}`}
        aria-hidden={isMobile && !navOpen}
        {...inertAttrs}
      >
        <div className="sidebar-logo">
          <span className="mark">S</span> SOLO
        </div>
        {/* Phase 7: the sidebar shows WHOSE data this is, read from the one
            identity store. It deliberately shows the trade name, not the person
            name/initials the topbar already renders. */}
        <div className="sidebar-identity" title={profile.identity.denumire || profile.identity.nume}>
          {profile.identity.denumire || profile.identity.nume}
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
                setNavOpen(false); // close the drawer after choosing a page
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
      {navOpen && (
        <div
          className="nav-overlay"
          role="button"
          tabIndex={-1}
          aria-label="Închide meniul"
          onClick={() => setNavOpen(false)}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') setNavOpen(false);
          }}
        />
      )}
      <div className="main">
        <header className="topbar">
          <button
            type="button"
            className="nav-toggle"
            aria-label="Meniu"
            aria-expanded={navOpen}
            onClick={() => setNavOpen(v => !v)}
          >
            ☰
          </button>
          <span className="page-title">{TITLES[route.page]}</span>
          <span className="spacer" />
          <div className="topbar-user">
            <span>{profile.identity.nume}</span>
            <span className="avatar">{initials(profile.identity.nume)}</span>
          </div>
        </header>
        <div className="main-content">
          {dataOrigin === 'quarantined' && quarantine && (
            <div className="banner banner-warn" role="alert">
              <strong>Datele salvate nu au putut fi citite.</strong> {quarantineSummary(quarantine)}
              <details className="banner-details">
                <summary>Detalii tehnice</summary>
                <p>{quarantine.reason} — {quarantine.detail}</p>
                <p>Copia salvată: {quarantine.quarantinedAt}</p>
              </details>
            </div>
          )}
          {/* B-26: the money-conversion report has to be visible, not just persisted. `role="status"`, not
              `alert`: this is informational and stays until the data is re-entered, while the quarantine
              banner above is the urgent one. */}
          <MoneyPrecisionNoticeBanner notices={moneyNotices ?? []} />
          {route.page === 'dashboard' && <Dashboard />}
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
