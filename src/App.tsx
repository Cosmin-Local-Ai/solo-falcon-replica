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
import OnboardingPage from './pages/Onboarding';
import { Toasts } from './components/ui';
import { FiscalYearAdvance } from './components/dashboard/YearLifecycleBanner';
import { disclosure, nav, onboarding as onboardingCopy, shell } from './ui/copy';

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
  { page: 'dashboard', label: nav.dashboard, icon: '▦' },
  { page: 'revenues', label: nav.revenues, icon: '↑' },
  { page: 'expenses', label: nav.expenses, icon: '↓' },
  { page: 'e-factura', label: nav['e-factura'], icon: '⚡' },
  { page: 'declarations', label: nav.declarations, icon: '📋' },
  { page: 'documents', label: nav.documents, icon: '📁' },
  { page: 'clients', label: nav.clients, icon: '👥' },
  { page: 'settings', label: nav.settings, icon: '⚙' },
];

// The page title is the nav label — one key, spelled once.
const TITLES: Record<Page, string> = nav;

// --- URL routing: /<page> with optional #!<tab> and optional ?f=<record id> ---

interface Route {
  page: Page;
  tab: string | null;
  /**
   * TASK 8 — the record an attention item pointed at. The hash form is `#!/<tab>?f=<id>`: the tab
   * already says which slice of the register holds the record (it is keyed off the record's own
   * status), and `f` lands the table on that one row and highlights it. Without it a dashboard link
   * could only say "go to the rejected invoices" and leave the user to find the one that was named.
   */
  focus: string | null;
}

// Canonical tab keys per page (must match the tab state inside each page).
// Exact URL forms required:
//   /revenues#!/registered  /revenues#!/pending  /revenues#!/rejected
//   /expenses#!/registered  /expenses#!/rejected
//   /documents#!/company    /settings#!/company
// Pages may also generate their own extra tabs (e.g. /documents#!/toate).
// PG-5: `/declarations` has no tab family any more. The monthly status tabs it used to expose
// (`inregistrata` / `in-asteptare` / `transmisa` / `respinsa`) were tabs over a monthly register, and
// the register is annual now; an attention row for a filing points at the page, not at a status tab.
const VALID_TABS: Partial<Record<Page, string[]>> = {
  revenues: ['registered', 'pending', 'rejected'],
  expenses: ['registered', 'rejected'],
  // PG-6h-3 adds `occupancy`: the occupancy sheet (OPANAF 381/2026). It has to be listed here or the tab
  // is unreachable by URL — `parseRoute` drops an unlisted hash, so the Settings entry point would land
  // on the default tab instead of the sheet, and a deep link to a document would silently open something
  // else. This is the router's whitelist, not a navigation surface: the sidebar still offers four pages.
  documents: ['company', 'statements', 'reports', 'occupancy'],
  // Mirrors the live SOLO settings tabs (docs/reference/settings.md);
  // the real app's "Abonament" (subscription) tab is not replicated.
  // `fiscal` is an addition of this replica: the PfaProfile write path (Phase 6).
  settings: ['company', 'fiscal', 'einvoice', 'bankaccounts', 'account', 'data'],
};

export function parseRoute(): Route {
  const seg = window.location.pathname.split('/').filter(Boolean).pop() ?? '';
  const page: Page = (PAGES as string[]).includes(seg) ? (seg as Page) : 'dashboard';
  const raw = window.location.hash.replace(/^#!\/?/, '');
  const [tabPart, queryPart] = raw.split('?');
  const valid = VALID_TABS[page];
  const tab = valid && tabPart && valid.includes(tabPart) ? tabPart : null;
  const focus = queryPart ? new URLSearchParams(queryPart).get('f') : null;
  return { page, tab, focus };
}

function routeToUrl(page: Page, tab: string | null, focus: string | null = null): string {
  return `/${page}${tab ? `#!/${tab}` : ''}${focus ? `?f=${encodeURIComponent(focus)}` : ''}`;
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
  const { profile, dataOrigin, migration, quarantine, moneyNotices, toast, sandboxActive, unloadSandbox } = useStore();

  // Phase 11 (D1, D-RUN-1): empty storage is a first run, not a demo. `dataOrigin === 'empty'` is the
  // only state that means "nothing this person entered exists yet" — and because the save effect in
  // `store.tsx` refuses to write while the origin is 'empty', reloading during onboarding lands here
  // again instead of on a 'persisted' empty shell.
  const firstRun = dataOrigin === 'empty';

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
      shell.migrationToast(migration.stepsApplied.join(', ') || shell.migrationStepsFallback),
    );
  }, [migration, toast]);
  const { pendingCounts } = useDashboardData();
  const pendingCount =
    pendingCounts.revenuesInAsteptare +
    pendingCounts.expensesRespinsa +
    pendingCounts.filingsInAsteptare;

  const navigate = useCallback((page: Page, tab: string | null = null) => {
    const url = routeToUrl(page, tab);
    if (window.location.pathname + window.location.hash !== url) {
      window.history.pushState({ page, tab }, '', url);
    }
    setRoute({ page, tab, focus: null });
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
    const expected = routeToUrl(r.page, r.tab, r.focus);
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
      {/* PG-5 (B-73): the fiscal-year advance is mounted here, not on the dashboard, so it does not
          depend on which page a person opens first on 2 January. It renders nothing. */}
      <FiscalYearAdvance />
      <aside
        className={`sidebar${navOpen ? ' open' : ''}`}
        aria-hidden={isMobile && !navOpen}
        {...inertAttrs}
      >
        <div className="sidebar-logo">
          <span className="mark">S</span> {shell.brand}
        </div>
        {/* Phase 7: the sidebar shows WHOSE data this is, read from the one
            identity store. It deliberately shows the trade name, not the person
            name/initials the topbar already renders.
            Phase 11: on a first run there is no name to show, so the block is absent rather than
            rendering an empty box or the fixture's name. */}
        {(profile.identity.denumire || profile.identity.nume) && (
          <div className="sidebar-identity" title={profile.identity.denumire || profile.identity.nume}>
            {profile.identity.denumire || profile.identity.nume}
          </div>
        )}
        <nav>
          {!firstRun &&
            NAV.map(n => (
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
          aria-label={shell.closeMenu}
          onClick={() => setNavOpen(false)}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') setNavOpen(false);
          }}
        />
      )}
      <div className="main">
        <header className="topbar">
          {!firstRun && (
            <button
              type="button"
              className="nav-toggle"
              aria-label={shell.menu}
              aria-expanded={navOpen}
              onClick={() => setNavOpen(v => !v)}
            >
              ☰
            </button>
          )}
          <span className="page-title">{firstRun ? onboardingCopy.title : TITLES[route.page]}</span>
          <span className="spacer" />
          {/* Phase 11: the topbar used to print `identity.nume` unconditionally, which on a fresh profile
              meant the fixture's name sat in the chrome of an app that holds no data. No name, no block. */}
          {profile.identity.nume && (
            <div className="topbar-user">
              <span>{profile.identity.nume}</span>
              <span className="avatar">{initials(profile.identity.nume)}</span>
            </div>
          )}
        </header>
        <div className="main-content">
          {firstRun && <OnboardingPage />}
          {!firstRun && (
            <>
          {dataOrigin === 'quarantined' && quarantine && (
            <div className="banner banner-warn" role="alert">
              <strong>{shell.quarantineTitle}</strong> {quarantineSummary(quarantine)}
              <details className="banner-details">
                <summary>{disclosure.technicalDetails}</summary>
                <p>{quarantine.reason} — {quarantine.detail}</p>
                <p>{shell.savedCopy(quarantine.quarantinedAt)}</p>
              </details>
            </div>
          )}
          {/* Phase 11 — the sandbox is marked where it is seen, not only where it was switched on. */}
          {sandboxActive && (
            <div className="banner banner-warn" role="status" data-sandbox-banner>
              <strong>{shell.sandboxTitle}</strong> {shell.sandboxBody}
              <button type="button" className="btn" onClick={unloadSandbox}>
                {shell.sandboxRemove}
              </button>
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
              focusRecord={route.focus ?? undefined}
            />
          )}
          {route.page === 'expenses' && (
            <Expenses
              initialTab={route.tab as 'registered' | 'rejected' | undefined}
              onTabChange={t => navigate('expenses', t)}
              focusRecord={route.focus ?? undefined}
            />
          )}
          {route.page === 'e-factura' && <EFactura />}
          {route.page === 'declarations' && (
            <Declarations focusRecord={route.focus ?? undefined} />
          )}
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
            </>
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
