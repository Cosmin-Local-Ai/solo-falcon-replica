import { test, expect, type Page } from '@playwright/test';

/**
 * Dashboard e2e coverage (Step 34, Worker 2).
 *
 * The dashboard renders from the app's built-in seed dataset on a fresh
 * browser context (no localStorage). All expected values below are
 * deterministic: they are derived from the seed data with asOf = today
 * (fiscal year 2026) and formatted with the app's fmtRON
 * (Intl.NumberFormat('ro-RO', 2 decimals) + ' RON').
 *
 * Cockpit cards rendered by src/pages/Dashboard.tsx (5 StatCards):
 *   - "Venituri PFA (an)"        → fmtRON(snapshot.pfaRevenue)
 *   - "Impozit estimat"          → '—' when tax status is not 'computed'
 *   - "Rezervă lunară"           → fmtRON(reserve.recommendedMonthlyReserve)
 *   - "Rămâne de pus deoparte"   → fmtRON(reserve.remainingTarget)
 *   - "Date complete"            → `${satisfiedCount}/${totalCount}`
 */

const STORAGE_KEY = 'pfa-app-data-v2';

/** Shared settings payload for localStorage-seeded datasets (valid per settingsSchema). */
const SEED_SETTINGS = {
  cotaTva: 9,
  company: {
    denumire: 'Popescu Consulting SRL',
    cui: 'RO4455667788990',
    numarRegComert: 'J40/1234/2020',
    adresa: 'Str. Libertății 12, Cluj-Napoca',
    cnp: 'RO4455667788990',
    formaJuridica: 'SRL',
    codFiscal: 'RO4455667788990',
    codCAEN: '6201',
    'regComerț': 'J40/1234/2020',
    telefon: '0750 123 456',
    email: 'contact@popescuconsulting.ro',
    contBancar: 'RO44 BACX 0000 0000 1234 5678 9000',
    banca: 'BCR',
    caen: [{ cod: '6201', descriere: 'Activități de programare computerizate' }],
  },
  personal: {
    nume: 'Popescu Andrei',
    cnp: '1234567890123',
    adresa: 'Str. Libertății 12, Cluj-Napoca',
    telefon: '0750 123 456',
    email: 'andrei@popescuconsulting.ro',
  },
  bankAccounts: [{ id: 'ba-1', banca: 'BCR', moneda: 'RON' }],
  eFactura: { trimitere: 'manual', dateContact: '2026-09-01' },
};

/** Locator for a cockpit StatCard by its exact label text. */
function statCard(page: Page, label: string) {
  return page.locator('.stat-card').filter({ has: page.getByText(label, { exact: true }) });
}

test.describe('Dashboard — cockpit cards (seed data)', () => {
  test('renders all cockpit cards with correct labels and seed-derived values', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: 'Tablou de bord' })).toBeVisible();

    // YTD revenue from seed: 9.317,00 lei (fiscal year 2026).
    const venituri = statCard(page, 'Venituri PFA (an)');
    await expect(venituri).toBeVisible();
    await expect(venituri.locator('.value')).toHaveText('9.317,00 RON');

    // Tax estimate is review_required for the seed data → card shows '—'.
    const impozit = statCard(page, 'Impozit estimat');
    await expect(impozit).toBeVisible();
    await expect(impozit.locator('.value')).toHaveText('—');
    await expect(impozit.locator('.hint')).toHaveText('de pus deoparte');

    // No computed tax → no recommended reserve and nothing left to set aside.
    const rezerva = statCard(page, 'Rezervă lunară');
    await expect(rezerva).toBeVisible();
    await expect(rezerva.locator('.value')).toHaveText('0,00 RON');

    const ramane = statCard(page, 'Rămâne de pus deoparte');
    await expect(ramane).toBeVisible();
    await expect(ramane.locator('.value')).toHaveText('0,00 RON');

    // Completeness: 8 of 9 checks satisfied (tax estimate snapshot missing).
    const dateComplete = statCard(page, 'Date complete');
    await expect(dateComplete).toBeVisible();
    await expect(dateComplete.locator('.value')).toHaveText('8/9');
    await expect(dateComplete.locator('.hint')).toHaveText('verificări');
  });

  test('renders all dashboard sections with Romanian titles', async ({ page }) => {
    await page.goto('/dashboard');

    // Page-level sections (h2.card-title).
    const h2Titles = [
      'Estimare impozit',
      'Grafic financiar',
      'Rezumat',
      'Observații',
      'Rezervă fiscală',
    ];
    for (const title of h2Titles) {
      await expect(page.locator('h2.card-title', { hasText: title })).toBeVisible();
    }

    // Step 22 sections (CardTitle → h3).
    const h3Titles = [
      'Praguri',
      'Termene limită',
      'Completitudine date',
      'Ce trebuie să faci',
      'Legislație',
    ];
    for (const title of h3Titles) {
      await expect(page.locator('h3', { hasText: title })).toBeVisible();
    }

    // Tax hero mirrors the cockpit: review_required → '—'.
    await expect(page.locator('.tax-hero-value')).toHaveText('—');
  });
});

test.describe('Dashboard — section content (seed data)', () => {
  /**
   * Every section renders from the app's built-in seed dataset (fresh
   * browser context, no localStorage) with asOf = today (fiscal year 2026).
   * All values below are deterministic for that dataset. Date-relative
   * fields (e.g. "zile rămase" counts) are asserted by their stable date
   * part only, so the tests do not depend on the day they run.
   */

  /** Scope to the dashboard card (section.card) containing the given title. */
  const sectionWith = (page: Page, title: string, level: 'h2' | 'h3' = 'h3') =>
    page.locator('section.card').filter({ has: page.locator(level, { hasText: title }) });

  test('Rezervă fiscală: shows the no-estimate message when tax is review_required', async ({ page }) => {
    await page.goto('/dashboard');

    const reserve = sectionWith(page, 'Rezervă fiscală', 'h2');
    await expect(reserve).toBeVisible();
    await expect(
      reserve.getByText('Nu există o estimare fiscală disponibilă — rezerva recomandată nu poate fi calculată.'),
    ).toBeVisible();
  });

  test('Praguri: renders all 5 thresholds with current value, threshold and status', async ({ page }) => {
    await page.goto('/dashboard');

    const thresholds = sectionWith(page, 'Praguri');
    await expect(thresholds.locator('.item-row')).toHaveCount(5);

    // CAS: below the minimum base (breached), within the maximum base.
    // (exact: true — 'Prag minim CAS' is a substring of 'Prag minim CASS').
    await expect(thresholds.getByText('Prag minim CAS', { exact: true })).toBeVisible();
    await expect(thresholds.getByText('Prag maxim CAS', { exact: true })).toBeVisible();
    await expect(thresholds.getByText('Prag: 48.600,00 lei')).toBeVisible();
    await expect(thresholds.getByText('Prag: 97.200,00 lei')).toBeVisible();

    // CASS: below the minimum base (breached), within the maximum base.
    await expect(thresholds.getByText('Prag minim CASS', { exact: true })).toBeVisible();
    await expect(thresholds.getByText('Prag maxim CASS', { exact: true })).toBeVisible();
    await expect(thresholds.getByText('Prag: 24.300,00 lei')).toBeVisible();
    await expect(thresholds.getByText('Prag: 291.600,00 lei')).toBeVisible();

    // VAT registration threshold.
    await expect(thresholds.getByText('Prag de înregistrare Vat')).toBeVisible();
    await expect(thresholds.getByText('Prag: 395.000,00 lei')).toBeVisible();

    // All five rows show the same current revenue (9.317,00 lei YTD).
    await expect(thresholds.getByText(/Curent: 9\.317,00 lei/)).toHaveCount(5);

    // Status badges: 2 breached (min CAS, min CASS), 3 within limits.
    await expect(thresholds.getByText('Depășit', { exact: true })).toHaveCount(2);
    await expect(thresholds.getByText('În limite', { exact: true })).toHaveCount(3);
  });

  test('Termene limită: renders the 6 upcoming filing deadlines with dates and status', async ({ page }) => {
    await page.goto('/dashboard');

    const deadlines = sectionWith(page, 'Termene limită');
    await expect(deadlines.locator('.item-row')).toHaveCount(6);

    await expect(deadlines.getByText('Depunere D212')).toBeVisible();
    await expect(deadlines.getByText('25.05.2027')).toBeVisible();
    await expect(deadlines.getByText('CAS trimestrial')).toHaveCount(2);
    await expect(deadlines.getByText('15.10.2026')).toHaveCount(2); // CAS + CASS Q3
    await expect(deadlines.getByText('15.01.2027')).toHaveCount(2); // CAS + CASS Q4
    await expect(deadlines.getByText('CASS trimestrial')).toHaveCount(2);
    await expect(deadlines.getByText('Avans impozit pe venit')).toBeVisible();
    await expect(deadlines.getByText('25.12.2026')).toBeVisible();

    // All listed deadlines are active.
    await expect(deadlines.getByText('Activ', { exact: true })).toHaveCount(6);
  });

  test('Completitudine date: renders 9 checks, 8 satisfied and the missing tax estimate', async ({ page }) => {
    await page.goto('/dashboard');

    const completeness = sectionWith(page, 'Completitudine date');
    await expect(completeness.getByText('8 din 9 verificări îndeplinite')).toBeVisible();
    // CompletenessSection renders one .check-row per check (not .item-row).
    await expect(completeness.locator('.check-row')).toHaveCount(9);

    for (const label of [
      'Profil',
      'Venituri înregistrate',
      'Cheltuieli înregistrate',
      'Clienți',
      'Documente',
      'Documente de firmă',
      'Declarații',
      'Declarații fiscale',
    ]) {
      await expect(completeness.getByText(label, { exact: true })).toBeVisible();
    }

    // The only unsatisfied check is the tax estimate snapshot.
    await expect(completeness.getByText('Estimare impozit', { exact: true })).toBeVisible();
    await expect(completeness.getByText('nu există instantanee de taxe')).toBeVisible();
    await expect(completeness.getByText('Complet', { exact: true })).toHaveCount(8);
    await expect(completeness.getByText('Lipsă', { exact: true })).toHaveCount(1);
  });

  test('Ce trebuie să faci: renders the 8 pending action items', async ({ page }) => {
    await page.goto('/dashboard');

    const actions = sectionWith(page, 'Ce trebuie să faci');
    await expect(actions.getByText('8 item de rezolvat')).toBeVisible();
    // ActionSection renders one .action-label per item (not .item-row).
    await expect(actions.locator('.action-label')).toHaveCount(8);

    // 6 deadline actions (one per upcoming filing), 1 completeness, 1 tax review.
    await expect(actions.getByText('Termen limită', { exact: true })).toHaveCount(6);
    await expect(actions.getByText('Completitudine', { exact: true })).toBeVisible();
    await expect(actions.getByText('Revizuire estimări fiscale')).toBeVisible();
  });

  test('Legislație: renders the empty state when no verified changes exist', async ({ page }) => {
    await page.goto('/dashboard');

    const legislation = sectionWith(page, 'Legislație');
    await expect(legislation.getByText('Nicio modificare viitoare verificată.')).toBeVisible();
  });

  test('Observații: renders all 11 insights with severity badges', async ({ page }) => {
    await page.goto('/dashboard');

    const insights = sectionWith(page, 'Observații', 'h2');

    // 7 overdue deadlines (danger), 2 upcoming deadlines (warning).
    await expect(insights.getByText('Termen depășit: PFA')).toHaveCount(7);
    await expect(insights.getByText('Termen apropiat: PFA')).toHaveCount(2);

    // Completeness + tax insights.
    await expect(insights.getByText('Date incomplete')).toBeVisible();
    await expect(insights.getByText('Lipsă: Estimare impozit.')).toBeVisible();
    await expect(insights.getByText('Estimarea impozitului necesită verificare')).toBeVisible();

    // Severity badges: 7 Urgent, 3 Atenție (2 deadlines + completeness), 1 Info.
    await expect(insights.getByText('Urgent', { exact: true })).toHaveCount(7);
    await expect(insights.getByText('Atenție', { exact: true })).toHaveCount(3);
    await expect(insights.getByText('Info', { exact: true })).toHaveCount(1);
  });
});

test.describe('Dashboard — mobile viewport (390x844)', () => {
  test('renders without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: 'Tablou de bord' })).toBeVisible();
    await expect(statCard(page, 'Venituri PFA (an)')).toBeVisible();
    await expect(page.locator('h2.card-title', { hasText: 'Grafic financiar' })).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'page must not scroll horizontally at 390px').toBeLessThanOrEqual(0);
  });
});

test.describe('Dashboard — navigation', () => {
  test('normalizes / to /dashboard and shows the dashboard title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator('.page-title')).toHaveText('Panou de control');
    await expect(page.getByRole('heading', { name: 'Tablou de bord' })).toBeVisible();
  });

  test('navigates to /revenues via the sidebar link', async ({ page }) => {
    await page.goto('/dashboard');

    await page.locator('a.nav-item', { hasText: 'Venituri' }).click();
    await expect(page).toHaveURL(/\/revenues$/);
    await expect(page.locator('.page-title')).toHaveText('Venituri');
  });

  test('navigates to /revenues via direct URL', async ({ page }) => {
    await page.goto('/revenues');
    await expect(page).toHaveURL(/\/revenues$/);
    await expect(page.locator('.page-title')).toHaveText('Venituri');
  });
});

test.describe('Dashboard — empty state', () => {
  test('shows the onboarding CTA when no data is recorded', async ({ page }) => {
    // Seed a valid-but-empty dataset into localStorage *before* the app
    // scripts run (addInitScript), so the store loads it directly and the
    // page's hasData gate switches to the onboarding CTA. This avoids a
    // post-load evaluate + reload, which is racy under parallel execution.
    //
    // The persisted schema requires only `revenues` + `settings`; every
    // other collection is optional and backfilled to empty on load.
    const emptyDataset = {
      revenues: [],
      settings: SEED_SETTINGS,
    };

    await page.addInitScript(
      ([key, dataset]: [string, unknown]) => {
        localStorage.setItem(key, JSON.stringify(dataset));
      },
      [STORAGE_KEY, emptyDataset],
    );

    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: 'Începe înregistrarea activității' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Adaugă un venit' })).toHaveAttribute('href', '/revenues');
    await expect(page.getByRole('link', { name: 'Adaugă o cheltuială' })).toHaveAttribute('href', '/expenses');

    // No cockpit cards or dashboard sections in the empty state.
    await expect(page.locator('.stat-card')).toHaveCount(0);
    await expect(page.locator('h2.card-title')).toHaveCount(0);
  });
});

test.describe('Dashboard — Grafic financiar & KPI table (seeded FY2025)', () => {
  const FISCAL_YEAR = 2025;
  const MONTHLY_TOTAL = 202_000;

  /**
   * A *completed* fiscal year (2025 — fully in the past relative to
   * asOf = today) with one registered revenue of exactly MONTHLY_TOTAL
   * per month. Every month is therefore "Realizat" with the seeded total
   * (no run-rate projection involved), so all expectations are fully
   * deterministic. The profile is required so the app's fiscal year is
   * 2025 (the default profile would use the current year).
   */
  const seededDataset = () => ({
    profile: {
      id: 'profile-1',
      pfaStartYear: 2020,
      fiscalYear: FISCAL_YEAR,
      regime: 'impozit_pe_venit',
      caen: '6201',
      salaryStatus: 'nu',
      pensionStatus: 'nu',
      otherIncome: [],
      socialInsuranceStatus: 'obligatoriu',
      vatExempt: false,
      cashFloorLei: 0,
      identity: {
        nume: 'Popescu Andrei',
        cnp: '1234567890123',
        adresa: 'Str. Libertății 12, Cluj-Napoca',
        telefon: '0750 123 456',
        email: 'andrei@popescuconsulting.ro',
        denumire: 'Popescu Consulting SRL',
        cui: 'RO4455667788990',
        formaJuridica: 'SRL',
        numarRegComert: 'J40/1234/2020',
        adresaSocietate: 'Str. Libertății 12, Cluj-Napoca',
        telefonSocietate: '0750 123 456',
        emailSocietate: 'contact@popescuconsulting.ro',
        contBancar: 'RO44 BACX 0000 0000 1234 5678 9000',
        banca: 'BCR',
      },
      updatedAt: '2025-12-31T10:00:00.000Z',
    },
    revenues: Array.from({ length: 12 }, (_, i) => {
      const m = String(i + 1).padStart(2, '0');
      return {
        id: `rev-${FISCAL_YEAR}-${m}`,
        tip: 'factura',
        nr: `F${FISCAL_YEAR}-${m}`,
        date: `${FISCAL_YEAR}-${m}-15`,
        client: 'Client Test SRL',
        cui: 'RO12345678',
        valoareFaraTva: MONTHLY_TOTAL,
        tva: 0,
        status: 'inregistrata',
      };
    }),
    settings: SEED_SETTINGS,
  });

  const seedPage = async (page: Page) => {
    await page.addInitScript(
      ([key, dataset]: [string, unknown]) => {
        localStorage.setItem(key, JSON.stringify(dataset));
      },
      [STORAGE_KEY, seededDataset()],
    );
  };

  /** Mirror of the app's fmtRON (src/data/types.ts). */
  const fmtRON = (n: number) =>
    `${new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} RON`;

  /**
   * Mirror of the app's month labels (FinancialChart MONTH_LABELS). In the
   * "An" range the label carries no year. Do NOT use toLocaleDateString —
   * ICU ro-RO short labels are lowercased with periods ("ian."), which the
   * app does not render.
   */
  const MONTH_LABELS = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
  const monthLabel = (m: number) => MONTH_LABELS[m - 1];

  const chartSection = (page: Page) => page.locator('section[aria-label="Grafic financiar"]');

  test('Grafic financiar: 12 monthly rows in "An" range, first/last match seeded total', async ({ page }) => {
    await seedPage(page);
    await page.goto('/dashboard');

    const chart = chartSection(page);
    // Default range is "Lunar" (single month) — switch to the full fiscal year.
    await chart.getByRole('button', { name: 'An' }).click();

    const rows = chart.locator('table tbody tr');
    await expect(rows).toHaveCount(12);

    const expected = `${fmtRON(MONTHLY_TOTAL)} — Realizat`;
    await expect(rows.first().locator('td').first()).toHaveText(expected);
    await expect(rows.last().locator('td').first()).toHaveText(expected);
  });

  test('KPI table: 12 rows with seeded revenue, zero expenses, net = revenue', async ({ page }) => {
    await seedPage(page);
    await page.goto('/dashboard');

    const chart = chartSection(page);
    await chart.getByRole('button', { name: 'An' }).click();

    const rows = chart.locator('table tbody tr');
    await expect(rows).toHaveCount(12);

    const revenueCell = `${fmtRON(MONTHLY_TOTAL)} — Realizat`;
    const expenseCell = `${fmtRON(0)} — Realizat`;
    for (let i = 0; i < 12; i++) {
      const row = rows.nth(i);
      await expect(row.locator('th')).toHaveText(monthLabel(i + 1));
      const tds = row.locator('td');
      await expect(tds.nth(0)).toHaveText(revenueCell); // Venituri
      await expect(tds.nth(1)).toHaveText(expenseCell); // Cheltuieli
      await expect(tds.nth(2)).toHaveText(revenueCell); // Net
    }
  });

  test('Grafic financiar: "Lunar" range (default) is empty for FY2025 data; month select shows a seeded month', async ({ page }) => {
    await seedPage(page);
    await page.goto('/dashboard');

    const chart = chartSection(page);
    const rows = chart.locator('table tbody tr');
    // Default month is the current one (2026) — outside the FY2025 series → no rows.
    await expect(rows).toHaveCount(0);

    // Pick a seeded month from the dropdown.
    await chart.locator('select[aria-label="Lună selectată"]').selectOption('2025-03');
    await expect(rows).toHaveCount(1);
    await expect(rows.first().locator('th')).toHaveText('Mar 2025');
    await expect(rows.first().locator('td').first()).toHaveText(`${fmtRON(MONTHLY_TOTAL)} — Realizat`);
  });

  test('Grafic financiar: "YTD" range shows the full fiscal year for completed FY2025 data', async ({ page }) => {
    await seedPage(page);
    await page.goto('/dashboard');

    const chart = chartSection(page);
    await chart.getByRole('button', { name: 'YTD' }).click();

    const rows = chart.locator('table tbody tr');
    await expect(rows).toHaveCount(12);

    const expected = `${fmtRON(MONTHLY_TOTAL)} — Realizat`;
    await expect(rows.first().locator('th')).toHaveText('Ian');
    await expect(rows.first().locator('td').first()).toHaveText(expected);
    await expect(rows.last().locator('th')).toHaveText('Dec');
    await expect(rows.last().locator('td').first()).toHaveText(expected);
  });

  test('Grafic financiar: "Lunar" is the default pressed range; "An" range ends with Dec 2025', async ({ page }) => {
    await seedPage(page);
    await page.goto('/dashboard');

    const chart = chartSection(page);
    // Default range button is pressed.
    await expect(chart.getByRole('button', { name: 'Lunar' })).toHaveAttribute('aria-pressed', 'true');

    await chart.getByRole('button', { name: 'An' }).click();
    const rows = chart.locator('table tbody tr');
    await expect(rows).toHaveCount(12);
    await expect(rows.last().locator('th')).toHaveText('Dec');
    await expect(rows.last().locator('td').first()).toHaveText(`${fmtRON(MONTHLY_TOTAL)} — Realizat`);
  });

  test('mobile (390x844): seeded FY2025 data renders without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedPage(page);
    await page.goto('/dashboard');

    // Load the full 12-row "An" range — the data-heavy chart table.
    const chart = chartSection(page);
    await chart.getByRole('button', { name: 'An' }).click();
    await expect(chart.locator('table tbody tr')).toHaveCount(12);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'page must not scroll horizontally at 390px with seeded data').toBeLessThanOrEqual(0);
  });
});

/**
 * A CIT-regime profile (SRL) with two registered revenues in Q1 2026.
 * The tax engine returns a *computed* estimate of exactly 46.570 lei
 * (verified against src/domain/tax for this dataset), so the cockpit,
 * the tax hero and the Rezervă fiscală section show real values instead
 * of the review_required em dash.
 */
const citDataset = () => ({
  profile: {
    id: 'profile-1',
    pfaStartYear: 2026,
    fiscalYear: 2026,
    regime: 'impozit_pe_cit',
    caen: '6201',
    salaryStatus: 'nu',
    pensionStatus: 'nu',
    otherIncome: [],
    socialInsuranceStatus: 'obligatoriu',
    vatExempt: false,
    cashFloorLei: 0,
    identity: {
      nume: 'Popescu Andrei',
      cnp: '1234567890123',
      adresa: 'Str. Libertății 12, Cluj-Napoca',
      telefon: '0750 123 456',
      email: 'andrei@popescuconsulting.ro',
      denumire: 'Popescu Consulting SRL',
      cui: 'RO4455667788990',
      formaJuridica: 'SRL',
      numarRegComert: 'J40/1234/2020',
      adresaSocietate: 'Str. Libertății 12, Cluj-Napoca',
      telefonSocietate: '0750 123 456',
      emailSocietate: 'contact@popescuconsulting.ro',
      contBancar: 'RO44 BACX 0000 0000 1234 5678 9000',
      banca: 'BCR',
    },
    updatedAt: '2026-01-01T10:00:00.000Z',
  },
  revenues: [
    { id: 'cit-r1', tip: 'factura', nr: 'FCT-2026-001', date: '2026-02-10', client: 'Client A SRL', cui: 'RO12345678', valoareFaraTva: 50_000, tva: 9_500, status: 'inregistrata' },
    { id: 'cit-r2', tip: 'factura', nr: 'FCT-2026-002', date: '2026-03-15', client: 'Client B SRL', cui: 'RO12345678', valoareFaraTva: 80_000, tva: 15_200, status: 'inregistrata' },
  ],
  expenses: [],
  settings: SEED_SETTINGS,
});

test.describe('Dashboard — computed tax state (CIT seed)', () => {
  const CIT_ESTIMATE = 46_570;

  /** Local copies — the helpers in the first describe are block-scoped there. */
  const sectionWith = (page: Page, title: string) =>
    page.locator('section').filter({ has: page.getByRole('heading', { name: title, exact: true }) }).first();

  const fmtRON = (n: number) =>
    `${new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} RON`;

  test.beforeEach(async ({ page }) => {
    // addInitScript so the store loads the dataset on first load (a
    // post-load evaluate + navigation is racy under parallel execution).
    await page.addInitScript(
      ([key, dataset]: [string, unknown]) => {
        localStorage.setItem(key, JSON.stringify(dataset));
      },
      [STORAGE_KEY, citDataset()],
    );
  });

  test('tax hero shows the computed estimate (46.570 lei)', async ({ page }) => {
    await page.goto('/dashboard');

    const hero = sectionWith(page, 'Estimare impozit');
    // The computed value is rendered in the hero (not the em-dash empty state).
    await expect(hero.getByText(/46\.570/)).toBeVisible();
  });

  test('Rezervă fiscală section shows the computed estimate and monthly reserve', async ({ page }) => {
    await page.goto('/dashboard');

    const section = sectionWith(page, 'Rezervă fiscală');
    // The section renders the computed estimate (not the no-estimate empty state).
    await expect(section.getByText(/46\.570/).first()).toBeVisible();
  });

  test('cockpit tax cell shows the computed estimate', async ({ page }) => {
    await page.goto('/dashboard');

    const cell = page.locator('.stat-card').filter({ hasText: 'Impozit estimat' });
    await expect(cell.getByText(/46\.570/)).toBeVisible();
  });
});
