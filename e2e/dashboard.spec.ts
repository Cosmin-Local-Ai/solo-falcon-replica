import { test, expect, type Page } from '@playwright/test';

/**
 * Dashboard e2e coverage (Step 34, Worker 2).
 *
 * The dashboard renders from the app's built-in seed dataset on a fresh
 * browser context (no localStorage). All expected values below are
 * deterministic: they are derived from the seed data with asOf = today
 * (fiscal year 2026) and formatted by formatBaniRON in src/domain/money.ts
 * (Intl.NumberFormat('ro-RO', 2 decimals) + ' RON').
 *
 * Cockpit cards rendered by src/pages/Dashboard.tsx (5 StatCards):
 *   - "Venituri PFA (an)"        → formatBaniRON(snapshot.pfaRevenue)
 *   - "Impozit estimat"          → '—' when tax status is not 'computed'
 *   - "Rezervă lunară"           → formatBaniRON(reserve.recommendedMonthlyReserve)
 *   - "Rămâne de pus deoparte"   → formatBaniRON(reserve.remainingTarget)
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

/**
 * Task 1 (pre-Phase-11): the annual tax estimate is a run-rate projection, so it legitimately
 * depends on the date the dashboard is read. Pinning the browser clock is what keeps the figures
 * below deterministic — a literal pinned against the real "today" would be wrong the day after it
 * was written, which is the failure class B-23 records.
 *
 * 2026-10-31 is chosen because the projection model's own denominator is a whole number there
 * (9 full months + 31/31 days = 10 elapsed months), so every expected figure is hand-checkable as
 * YTD × 12/10 = YTD × 1,2. It also leaves `monthsRemaining` at 3, exactly as the real seed date
 * did, so the reserve arithmetic is unchanged in kind.
 */
const FIXED_AS_OF = new Date('2026-10-31T12:00:00');

async function fixClock(page: Page): Promise<void> {
  await page.clock.setFixedTime(FIXED_AS_OF);
}

test.describe('Dashboard — cockpit cards (seed data)', () => {
  test('renders all cockpit cards with correct labels and seed-derived values', async ({ page }) => {
    await fixClock(page);
    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: 'Tablou de bord' })).toBeVisible();

    // YTD revenue from seed: 9.317,00 lei (fiscal year 2026).
    const venituri = statCard(page, 'Venituri PFA (an)');
    await expect(venituri).toBeVisible();
    await expect(venituri.locator('.value')).toHaveText('9.317,00 RON');

    // Tax estimate is COMPUTED for the seed data (B-14): the seed profile is on impozit_pe_venit, the
    // only regime a PFA can have in 2026, so the default user gets a number instead of an em dash.
    //
    // Task 1 changed WHAT enters the engine: not the YTD totals but the projection model's annual
    // figures. At the fixed clock the model's denominator is 10 elapsed months, so each operand is
    // YTD × 12/10 = YTD × 1,2 — and the pair the engine selects for a non-`vatExempt` profile is the
    // VAT-exclusive one (7.700,00 / 205,50 lei, all 'inregistrata'):
    //   venit brut (excl-VAT)    7.700,00 × 1,2 =  9.240,00 lei
    //   cheltuieli deductibile     205,50 × 1,2 =    246,60 lei
    //   VNA                                    =  8.993,40 lei
    // still inside 0 < VNA < 6 SM, so B-13 still applies: CASS owed = 2.430 lei (art. 174 alin. (6)
    // difference to the 6 SM floor), but only 10% × VNA = 899,34 lei (art. 174 alin. (1)) is
    // deductible. CF art. 66 alin. (1) rounds each sum DUE to a whole leu, fracțiuni de până la 50
    // de bani inclusiv neglijate:
    //   deductibilă 899,34 → 34 bani ≤ 50 → 899,00 lei
    //   bază        8.993,40 − 899,00 = 8.094,40 lei (the base is never itself rounded)
    //   impozit     10% × 8.094,40 = 809,44 → 44 bani ≤ 50 → 809,00 lei
    //   total       2.430 + 809 = 3.239,00 lei
    // The same dataset read at 2026-12-31 has elapsed = 12, so the projection is the identity and the
    // figure is 3.105,00 lei again — that case is pinned in src/data/dashboard.test.ts.
    const impozit = statCard(page, 'Impozit estimat');
    await expect(impozit).toBeVisible();
    await expect(impozit.locator('.value')).toHaveText('3.239,00 RON');
    await expect(impozit.locator('.hint')).toHaveText('de pus deoparte');

    // A computed tax → a recommended monthly reserve (total / 3 months) and a remaining amount.
    const rezerva = statCard(page, 'Rezervă lunară');
    await expect(rezerva).toBeVisible();
    // 3.239,00 lei ÷ 3 months remaining (Oct–Dec) = 1.079,666… lei → divBani (nearest ban) → 1.079,67.
    await expect(rezerva.locator('.value')).toHaveText('1.079,67 RON');

    const ramane = statCard(page, 'Rămâne de pus deoparte');
    await expect(ramane).toBeVisible();
    await expect(ramane.locator('.value')).toHaveText('3.239,00 RON');

    // Completeness: still 8 of 9 — the check looks for a PERSISTED tax snapshot, and the live estimate
    // is not written to storage (persisting it is Phase 7, not Phase 5).
    const dateComplete = statCard(page, 'Date complete');
    await expect(dateComplete).toBeVisible();
    await expect(dateComplete.locator('.value')).toHaveText('8/9');
    await expect(dateComplete.locator('.hint')).toHaveText('verificări');
  });

  test('renders all dashboard sections with Romanian titles', async ({ page }) => {
    await fixClock(page);
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

    // Tax hero mirrors the cockpit: the seed estimate is computed, so the hero shows the number.
    // There are two .tax-hero-value nodes once the reserve section renders its own hero (tax estimate
    // and monthly reserve), so the assertion is scoped to the 'Estimare impozit' card.
    const heroCard = page
      .locator('section.card')
      .filter({ has: page.locator('h2.card-title', { hasText: 'Estimare impozit' }) })
      .first();
    await expect(heroCard.locator('.tax-hero-value')).toHaveText('3.239,00 RON');
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

  test('Rezervă fiscală: shows the recommended reserve built from the computed seed estimate', async ({ page }) => {
    await fixClock(page);
    await page.goto('/dashboard');

    const reserve = sectionWith(page, 'Rezervă fiscală', 'h2');
    await expect(reserve).toBeVisible();
    // 3.239,00 lei (the annual projection at 10 elapsed months) over the 3 remaining months of the
    // fiscal year → 1.079,67 lei/month (divBani, nearest ban).
    await expect(reserve.getByText('1.079,67 RON').first()).toBeVisible();
    await expect(
      reserve.getByText('Rămâne de pus deoparte 3.239,00 RON în următoarele 3 luni.'),
    ).toBeVisible();
    // The no-estimate empty state is gone: the default regime computes (B-14).
    await expect(
      reserve.getByText('Nu există o estimare fiscală disponibilă — rezerva recomandată nu poate fi calculată.'),
    ).toHaveCount(0);
  });

  test('Praguri: renders all 5 thresholds with current value, threshold and status', async ({ page }) => {
    await fixClock(page);
    await page.goto('/dashboard');

    const thresholds = sectionWith(page, 'Praguri');
    await expect(thresholds.locator('.item-row')).toHaveCount(5);

    // CAS: below the tier-1 floor of 12 SM → breached. There is no 'Prag maxim CAS' row:
    // CF art. 148 alin. (2) sets FLOORS ("nu poate fi mai mic decât"), never a ceiling, so a
    // CAS maximum-base row asserted a cap that does not exist (docs/ai/phases/03_cas.md).
    // (exact: true — 'Prag minim CAS' is a substring of 'Prag minim CASS').
    await expect(thresholds.getByText('Prag minim CAS', { exact: true })).toBeVisible();
    await expect(thresholds.getByText('Prag: 48.600,00 lei')).toBeVisible();
    await expect(thresholds.getByText('Prag maxim CAS', { exact: true })).toHaveCount(0);

    // The 24 SM step of the same ladder (art. 148 alin. (2) lit. b)) is labelled as a step, not as
    // a maximum: crossing it raises the MINIMUM CAS base from 12 SM to 24 SM.
    await expect(thresholds.getByText('Treaptă de calcul CAS', { exact: true })).toBeVisible();
    await expect(thresholds.getByText('Prag: 97.200,00 lei')).toBeVisible();

    // CASS: below the minimum base (breached), within the maximum base.
    await expect(thresholds.getByText('Prag minim CASS', { exact: true })).toBeVisible();
    await expect(thresholds.getByText('Prag maxim CASS', { exact: true })).toBeVisible();
    await expect(thresholds.getByText('Prag: 24.300,00 lei')).toBeVisible();
    await expect(thresholds.getByText('Prag: 291.600,00 lei')).toBeVisible();

    // VAT registration threshold.
    await expect(thresholds.getByText('Prag de înregistrare Vat')).toBeVisible();
    await expect(thresholds.getByText('Prag: 395.000,00 lei')).toBeVisible();

    // Phase 8: the rows do not share one number. The four contribution rows are
    // measured on the engine's venitul net din activitate (7.700,00 - 205,50 = 7.494,50 lei),
    // per CF art. 148 alin. (1)-(2) / art. 170 alin. (1) / art. 174 alin. (6); the VAT row is
    // measured on VAT-exclusive turnover (4.500 + 3.200 = 7.700,00 lei), per art. 310 alin. (1).
    // The four contribution rows measure the engine's `net-income` base, which since Task 1 is the
    // ANNUAL projected VNA (8.993,40 lei), not the YTD one (7.494,50 lei). The VAT row below is
    // deliberately still YTD — see docs/ai/phases/12_projection_annual_estimate.md §6.
    await expect(thresholds.getByText(/Curent: 8\.993,40 lei/)).toHaveCount(4);
    await expect(thresholds.getByText(/Curent: 7\.700,00 lei/)).toHaveCount(1);
    // The VAT-inclusive figure all the rows used to share is gone from this section. (It is
    // still correct — and still shown — as the "Venituri PFA (an)" cockpit card.)
    await expect(thresholds.getByText(/Curent: 9\.317,00 lei/)).toHaveCount(0);

    // Status badges: 2 breached (min CAS, min CASS), 3 within limits (max CASS, the 24 SM step,
    // which the seed is far below).
    await expect(thresholds.getByText('Depășit', { exact: true })).toHaveCount(2);
    await expect(thresholds.getByText('În limite', { exact: true })).toHaveCount(3);
  });

  // Phase 9b: exactly ONE upcoming deadline. The four quarterly/estimated event types were deleted
  // because the obligations do not exist in fiscal year 2026 — a PFA în sistem real has NO quarterly
  // plată: income tax, CAS and CASS are each declared AND paid by 25 May of the following year
  // (CF art. 68 alin. (10), art. 151 alin. (1) and art. 174 alin. (15), all routing to art. 122
  // alin. (3)). The advance-payment article (art. 120/120^1) is `Abrogat.` from 01-01-2025 and CAS
  // art. 160 has been `Abrogat.` since 01-01-2018. The VAT registration deadline is rule-driven but
  // dateless here: no profile records a TVA exceedance date, and with offset_days = 0 its deadline IS
  // the exceedance date, so it can never classify as upcoming anyway.
  test('Termene limită: renders the single upcoming filing deadline (D212)', async ({ page }) => {
    await page.goto('/dashboard');

    const deadlines = sectionWith(page, 'Termene limită');
    await expect(deadlines.locator('.item-row')).toHaveCount(1);

    await expect(deadlines.getByText('Depunere D212')).toBeVisible();
    await expect(deadlines.getByText('25.05.2027')).toBeVisible();
    await expect(deadlines.getByText('PFA', { exact: true })).toBeVisible();

    // All listed deadlines are active.
    await expect(deadlines.getByText('Activ', { exact: true })).toHaveCount(1);

    // The deleted obligations must not reappear under any label…
    for (const label of [
      'CAS trimestrial',
      'CASS trimestrial',
      'Avans impozit pe venit',
      'Declarație estimativă PFA',
      'Înregistrare TVA',
    ]) {
      await expect(deadlines.getByText(label)).toHaveCount(0);
    }
    // …or under any of the dates they used to render, including the quarterly instalment dates and
    // the 15 April 2026 date that belongs to a 3% bonificație for the 2025 year, not to a deadline.
    for (const date of [
      '15.04.2026',
      '15.07.2026',
      '15.10.2026',
      '15.01.2027',
      '25.03.2026',
      '25.06.2026',
      '25.09.2026',
      '25.12.2026',
    ]) {
      await expect(deadlines.getByText(date)).toHaveCount(0);
    }
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

  test('Ce trebuie să faci: renders the 3 pending action items', async ({ page }) => {
    await page.goto('/dashboard');

    const actions = sectionWith(page, 'Ce trebuie să faci');
    await expect(actions.getByText('3 item de rezolvat')).toBeVisible();
    // ActionSection renders one .action-label per item (not .item-row).
    await expect(actions.locator('.action-label')).toHaveCount(3);

    // 1 deadline action (D212 only — Phase 9b deleted the four non-existent quarterly obligations),
    // 1 completeness, 1 tax review.
    await expect(actions.getByText('Termen limită', { exact: true })).toHaveCount(1);
    await expect(actions.getByText('Completitudine', { exact: true })).toBeVisible();
    await expect(actions.getByText('Revizuire estimări fiscale')).toBeVisible();
  });

  test('Legislație: renders the empty state when no verified changes exist', async ({ page }) => {
    await page.goto('/dashboard');

    const legislation = sectionWith(page, 'Legislație');
    await expect(legislation.getByText('Nicio modificare viitoare verificată.')).toBeVisible();
  });

  test('Observații: renders all 4 insights with severity badges', async ({ page }) => {
    await page.goto('/dashboard');

    const insights = sectionWith(page, 'Observații', 'h2');

    // Phase 9b: no deadline insights at all. The snapshot carries two deadline rows — D212 at
    // 25.05.2027, which is more than 30 days out and therefore produces no alert, and the VAT
    // registration row, which is dateless and is skipped. The 7 danger + 2 warning deadline alerts
    // this test used to assert were all fabricated quarterly instalments.
    await expect(insights.getByText('Termen depășit: PFA')).toHaveCount(0);
    await expect(insights.getByText('Termen apropiat: PFA')).toHaveCount(0);

    // Completeness + tax insights. The tax insight is now the COMPUTED variant, not the
    // review_required one, because the seed regime computes (B-14).
    await expect(insights.getByText('Date incomplete')).toBeVisible();
    await expect(insights.getByText('Lipsă: Estimare impozit.')).toBeVisible();
    await expect(insights.getByText('Estimare impozit', { exact: true })).toBeVisible();
    await expect(insights.getByText('Estimarea totală a impozitului:')).toBeVisible();
    await expect(insights.getByText('Estimarea impozitului necesită verificare')).toHaveCount(0);
    // A recommended reserve with nothing reserved yet is its own warning — it only exists because the
    // estimate is computed.
    await expect(insights.getByText('Rezervă fiscală sub țintă')).toBeVisible();

    // Phase 9 / B-20: the two contribution FLOORS (CAS_MIN_BASE, CASS_MIN_BASE) are breached —
    // the seed's net income is far below both — and `breached` is now driven off the domain status,
    // so they reach Observații as ONE canonical CASS/CAS alert (canonicalCassCas collapses them).
    await expect(insights.getByText('Prag depășit:')).toHaveCount(1);

    // Severity badges: 1 Urgent (the collapsed CASS/CAS floor breach), 2 Atenție (completeness +
    // reserve), 1 Info (tax). Phase 9b removed the 8 deadline alerts that used to dominate this list.
    await expect(insights.getByText('Urgent', { exact: true })).toHaveCount(1);
    await expect(insights.getByText('Atenție', { exact: true })).toHaveCount(2);
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

// --- Phase 9b: a PFA start date resolves NO deadline at all ------------------------------------
// Phase 9 wired the profile's PFA start date into the deadline engine to render a "declarație
// estimativă" 15 days after the start date. That obligation does not exist: its basis (CF art. 120)
// is `Abrogat.` from 01-01-2025 (OUG 128/2024 pct. 11 Art. I, MO 1125/11.11.2024), and the CPF
// art. 82 alin. (6) lit. c) 30-day `declarație de înregistrare fiscală` excludes precisely the
// persons who register at registrul comerțului — which OUG 44/2008 art. 7 alin. (1) makes mandatory
// for a PFA, while art. 13 alin. (3) of that act makes the ONRC certificate itself the act of fiscal
// taking-into-evidence. A PFA opened at any point in 2026 files its first Declarația Unică by
// 25 May 2027 (CF art. 122 alin. (3), which extends the term to the alin. (2) case verbatim).
// So the start date must be inert end to end: the card shows the D212 deadline and nothing else.
test.describe('Dashboard — a PFA start date resolves no deadline', () => {
  test('renders only the D212 deadline, with no start-date-derived and no invented VAT deadline', async ({ page }) => {
    // The start date is deliberately a *future* one (today + 5 days), which is the case that used to
    // produce a start-date-derived deadline. It must now change nothing, whatever the clock says.
    await page.addInitScript(
      ([key]: [string]) => {
        const iso = (d: Date) => d.toISOString().slice(0, 10);
        const start = new Date(Date.now() + 5 * 86_400_000);
        const dataset = {
          version: 3,
          profile: {
            id: 'profile-dates-1',
            pfaStartYear: 2026,
            pfaStartDate: iso(start),
            fiscalYear: 2026,
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
            updatedAt: '2026-06-01T10:00:00.000Z',
          },
          revenues: [
            {
              id: 'rev-dates-1',
              tip: 'factura',
              nr: 'F2026-001',
              date: '2026-06-15',
              collected: '2026-06-20',
              client: 'Client Test SRL',
              cui: 'RO12345678',
              valoareFaraTva: 1000,
              tva: 0,
              status: 'inregistrata',
            },
          ],
          settings: {
            cotaTva: 9,
            company: { denumire: 'Popescu Consulting SRL', cui: 'RO4455667788990', numarRegComert: 'J40/1234/2020', adresa: 'Str. Libertății 12, Cluj-Napoca', caen: [] },
            personal: { nume: 'Popescu Andrei', cnp: '1234567890123', adresa: 'Str. Libertății 12, Cluj-Napoca', telefon: '0750 123 456', email: 'andrei@popescuconsulting.ro' },
            bankAccounts: [],
            eFactura: { trimitere: 'manual', dateContact: '2026-06-01' },
          },
        };
        localStorage.setItem(key, JSON.stringify(dataset));
      },
      [STORAGE_KEY],
    );

    await page.goto('/dashboard');

    // Same section locator as the seed-data suite (`sectionWith` is scoped to that describe block).
    const deadlines = page
      .locator('section.card')
      .filter({ has: page.locator('h3', { hasText: 'Termene limită' }) });
    // The start date (today + 5 days) resolves nothing: exactly one row, the rule-driven D212.
    await expect(deadlines.locator('.item-row')).toHaveCount(1);
    await expect(deadlines.getByText('Depunere D212')).toBeVisible();
    await expect(deadlines.getByText('Declarație estimativă PFA')).toHaveCount(0);
    // The PFA start date must not resolve the VAT registration deadline: that event never happened.
    await expect(deadlines.getByText('Înregistrare TVA')).toHaveCount(0);
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

    const expected = '202.000,00 RON — Realizat';
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

    const revenueCell = '202.000,00 RON — Realizat';
    const expenseCell = '0,00 RON — Realizat';
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
    await expect(rows.first().locator('td').first()).toHaveText('202.000,00 RON — Realizat');
  });

  test('Grafic financiar: "YTD" range shows the full fiscal year for completed FY2025 data', async ({ page }) => {
    await seedPage(page);
    await page.goto('/dashboard');

    const chart = chartSection(page);
    await chart.getByRole('button', { name: 'YTD' }).click();

    const rows = chart.locator('table tbody tr');
    await expect(rows).toHaveCount(12);

    const expected = '202.000,00 RON — Realizat';
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
    await expect(rows.last().locator('td').first()).toHaveText('202.000,00 RON — Realizat');
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
 * A PFA profile on CF art. 123 alin. (1) / art. 118 sistem real (the only regime a PFA can have in
 * 2026 — see the regime gate in src/domain/tax.ts) with two registered revenues in Q1 2026. The tax
 * engine returns a *computed* estimate, so the cockpit, the tax hero and the Rezervă fiscală section
 * show real values instead of the review_required em dash.
 *
 * Task 1 moved the OPERAND, not the arithmetic. The fixture's 130.000 lei are September-and-earlier
 * actuals; at the pinned clock the projection model annualises them to 156.000 lei (x 12/10), and the
 * engine runs on that: CAS 24.300 = 24 SM x 25%, CASS 15.600 = 10% x 156.000,
 * tax 11.610 = 10% x (156.000 - 39.900) -> 51.510 lei. On the raw YTD operand the same fixture gave
 * 46.570 lei (24.300 + 13.000 + 9.270) — the figure this file pinned before Task 1.
 *
 * Before Phase 5 this fixture used regime `impozit_pe_cit` — a regime a persoană fizică cannot have
 * (CF art. 13 alin. (1), art. 14, art. 15; the art. 120 option is Abrogat from 01.01.2025). The
 * computed figure is unchanged by that correction: the Titlul IV arithmetic is identical, only the
 * gate moved.
 */
const computedDataset = () => ({
  profile: {
    id: 'profile-1',
    pfaStartYear: 2026,
    fiscalYear: 2026,
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
      denumire: 'Popescu Andrei PFA',
      cui: 'RO4455667788990',
      formaJuridica: 'PFA',
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

test.describe('Dashboard — computed tax state (PFA sistem real seed)', () => {
  /** Local copies — the helpers in the first describe are block-scoped there. */
  const sectionWith = (page: Page, title: string) =>
    page.locator('section').filter({ has: page.getByRole('heading', { name: title, exact: true }) }).first();

  test.beforeEach(async ({ page }) => {
    // Task 1: this fixture's figure is an annual run-rate projection, so the clock is pinned exactly as
    // in the seed describes above. At 2026-10-31 the model's denominator is 10 elapsed months, so the
    // fixture's 130.000 lei of registered revenue enters the engine as 156.000 lei.
    await fixClock(page);
    // addInitScript so the store loads the dataset on first load (a
    // post-load evaluate + navigation is racy under parallel execution).
    await page.addInitScript(
      ([key, dataset]: [string, unknown]) => {
        localStorage.setItem(key, JSON.stringify(dataset));
      },
      [STORAGE_KEY, computedDataset()],
    );
  });

  test('tax hero shows the computed estimate (51.510 lei)', async ({ page }) => {
    await page.goto('/dashboard');

    const hero = sectionWith(page, 'Estimare impozit');
    // The computed value is rendered in the hero (not the em-dash empty state).
    await expect(hero.getByText(/51\.510/)).toBeVisible();
  });

  test('Rezervă fiscală section shows the computed estimate and monthly reserve', async ({ page }) => {
    await page.goto('/dashboard');

    const section = sectionWith(page, 'Rezervă fiscală');
    // The section renders the computed estimate (not the no-estimate empty state).
    await expect(section.getByText(/51\.510/).first()).toBeVisible();
  });

  test('cockpit tax cell shows the computed estimate', async ({ page }) => {
    await page.goto('/dashboard');

    const cell = page.locator('.stat-card').filter({ hasText: 'Impozit estimat' });
    await expect(cell.getByText(/51\.510/)).toBeVisible();
  });
});

test.describe('Dashboard — impozit_pe_cit on a PFA is a data-integrity failure (B-14)', () => {
  test('refuses to compute and names the provisions that make the regime impossible', async ({ page }) => {
    await page.addInitScript(
      ([key, dataset]: [string, unknown]) => {
        localStorage.setItem(key, JSON.stringify({ ...dataset, profile: { ...dataset.profile, regime: 'impozit_pe_cit' } }));
      },
      [STORAGE_KEY, computedDataset()],
    );
    await page.goto('/dashboard');

    // No number is shown for a regime the taxpayer cannot have — the engine refuses rather than
    // computing Titlul IV amounts under a Titlul II label.
    const cell = page.locator('.stat-card').filter({ hasText: 'Impozit estimat' });
    await expect(cell.locator('.value')).toHaveText('—');

    // The reason is rendered verbatim by FinancialChart and must cite the operative provisions, so the
    // user can see WHICH record is wrong instead of being told a rule is missing.
    const reason = page.locator('.chart-tax-note');
    await expect(reason).toContainText('nu poate aparține unui PFA');
    await expect(reason).toContainText('art. 13 alin. (1)');
    await expect(reason).toContainText('art. 120');
    await expect(reason).toContainText('abrogată');
  });

  test('when the engine refuses, the contribution thresholds turn review_required instead of vanishing', async ({ page }) => {
    // The B-14 describe has no beforeEach — the regime override must be applied per test.
    await page.addInitScript(
      ([key, dataset]: [string, unknown]) => {
        localStorage.setItem(key, JSON.stringify({ ...dataset, profile: { ...dataset.profile, regime: 'impozit_pe_cit' } }));
      },
      [STORAGE_KEY, computedDataset()],
    );
    await page.goto('/dashboard');

    const thresholds = page
      .locator('section.card')
      .filter({ has: page.locator('h3', { hasText: 'Praguri' }) });

    // The silent-skip trap: a base the caller cannot supply used to delete the card. All five
    // rows must still be here — four of them loud, not missing (the 24 SM CAS step is measured on
    // the same net-income base as the other contribution rows).
    await expect(thresholds.locator('.item-row')).toHaveCount(5);
    await expect(thresholds.getByText('De verificat', { exact: true })).toHaveCount(4);
    await expect(thresholds.getByText(/nu a fost furnizată/)).toHaveCount(4);
    // No invented amount is shown for a base that could not be measured.
    await expect(thresholds.getByText(/Curent: 0\.000,00 lei/)).toHaveCount(0);

    // The VAT row needs no engine: cifră de afaceri 50.000 + 80.000 = 130.000,00 lei stays
    // measured even while the contribution rows are unmeasurable.
    await expect(thresholds.getByText(/Curent: 130\.000,00 lei/)).toHaveCount(1);
    await expect(thresholds.getByText('Prag: 395.000,00 lei')).toBeVisible();
  });
});
