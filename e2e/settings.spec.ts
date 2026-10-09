import { test, expect, type Page } from '@playwright/test';

/**
 * Phase 6 e2e — the fiscal profile is editable, and editing it survives a reload.
 *
 * Before Phase 6 the app had NO profile write path at all: `updateProfile` existed in the
 * store but had zero UI callers, so every fiscal input (regime, salary status, CAEN, VAT
 * status…) was frozen at seed values. These tests cover the three things Phase 6 promised:
 *
 *   1. a real UI path edits the profile and the new value comes back out of storage;
 *   2. a payload written BEFORE Phase 6 (profile without the new fields) still loads with its
 *      revenues and expenses intact — the store answers an invalid payload by silently
 *      replacing the whole dataset with seed, so "the page rendered" proves nothing;
 *   3. a salaried PFA below the 6 SM floor gets a COMPUTED estimate in both branches of
 *      CF art. 174 alin. (7) lit. a), instead of the review_required em dash.
 */

const STORAGE_KEY = 'pfa-app-data-v2';

/** Shared settings payload (valid per settingsSchema in src/data/schema.ts). */
const SEED_SETTINGS = {
  cotaTva: 9,
  company: {
    denumire: 'Popescu Andrei PFA',
    cui: 'RO4455667788990',
    numarRegComert: 'J40/1234/2020',
    adresa: 'Str. Libertății 12, Cluj-Napoca',
    cnp: 'RO4455667788990',
    formaJuridica: 'PFA',
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

const IDENTITY = {
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
};

/**
 * A profile exactly as the app wrote it BEFORE Phase 6: no `pfaStartDate`, no
 * `salaryIncomeLei` key at all.
 */
const legacyProfile = (overrides: Record<string, unknown> = {}) => ({
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
  identity: IDENTITY,
  updatedAt: '2026-01-01T10:00:00.000Z',
  ...overrides,
});

const REVENUES = [
  { id: 'p6-r1', tip: 'factura', nr: 'FCT-2026-001', date: '2026-02-10', client: 'Client A SRL', cui: 'RO12345678', valoareFaraTva: 30_000, tva: 5_700, status: 'inregistrata' },
];
const EXPENSES = [
  // TASK 2b: this is a FIXTURE, not migrated user data, so it carries an explicit category — Biroux SRL
  // is an office-supplies invoice, `business_space_upkeep`, deductibilă. Left uncategorised it would
  // classify as `undetermined` and drop out of the base, which would push the projected VNA from
  // 24.000 to 36.000 lei, past the 6 SM CASS floor — and the two tests below would then compute the
  // SAME number, silently deleting the art. 174 alin. (6) difference this spec exists to pin.
  // That the chain preserves a category already on a legacy payload is pinned in
  // src/data/store.migration.chain.test.tsx; that a payload WITHOUT one survives intact and deducts
  // nothing is pinned in src/data/dashboard.test.ts and src/domain/estimateBasis.deductibility.test.ts.
  { id: 'p6-e1', tip: 'factura', nr: 'CH-2026-001', date: '2026-02-20', furnizor: 'Biroux SRL', cui: 'RO11111111', valoareFaraTva: 10_000, tva: 1_900, status: 'inregistrata', category: 'business_space_upkeep' },
];

function seed(page: Page, dataset: unknown) {
  return page.addInitScript(
    ([key, payload]: [string, unknown]) => {
      localStorage.setItem(key, JSON.stringify(payload));
    },
    [STORAGE_KEY, dataset],
  );
}

/** A Settings `.field` block addressed by its label text (labels have no htmlFor). */
function field(page: Page, label: string) {
  return page.locator('.field').filter({ hasText: label });
}

async function storedProfile(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? '{}').profile ?? {},
    STORAGE_KEY,
  ) as Promise<Record<string, unknown>>;
}

test.describe('Settings — Regim fiscal tab (Phase 6 profile write path)', () => {
  test('offers only the regime a PFA can hold, and round-trips an edit through reload', async ({ page }) => {
    // Deliberately NOT seeded with addInitScript: that script re-runs on every document,
    // including reload, and would overwrite the value the UI just saved — the assertion
    // would then prove nothing. Here the app loads its own seed, edits it, and the reload
    // reads back what the store persisted.
    await page.goto('/settings#!/fiscal');

    const regime = field(page, 'Regim fiscal').locator('select');
    await expect(regime).toHaveValue('impozit_pe_venit');
    // impozit_pe_cit is never offered: Titlul II is for persoane juridice only (CF art. 13 alin. (1),
    // art. 14, art. 15) and the art. 120 option is Abrogat from 01.01.2025.
    await expect(field(page, 'Regim fiscal').locator('option')).toHaveCount(1);
    await expect(field(page, 'Regim fiscal').locator('option')).toHaveText(
      'Impozit pe venit — sistem real (Titlul IV)',
    );

    await field(page, 'Cod CAEN').locator('input').fill('6202');
    await field(page, 'Data înființării').locator('input').fill('2026-04-01');
    await field(page, 'Venit din salarii').locator('select').selectOption('da');
    await field(page, 'Venit brut anual din salarii').locator('input').fill('30000');
    await page.getByRole('button', { name: 'Salvează' }).click();
    await expect(page.getByText('Profilul fiscal a fost salvat')).toBeVisible();

    const saved = await storedProfile(page);
    // Phase 7: CAEN lives in profile.identity.caen[] (one store, decision D-1); the
    // profile.caen scalar is retired and must not be written back.
    const identity = saved.identity as { caen?: { cod: string }[] };
    expect(identity.caen?.[0]?.cod).toBe('6202');
    expect(saved.caen).toBeUndefined();
    expect(saved.pfaStartDate).toBe('2026-04-01');
    expect(saved.salaryStatus).toBe('da');
    // Phase 10: storage holds integer BANI. The key is still named `…Lei` — renaming a persisted key
    // would make zod strip it and reject every pre-v5 payload — so the unit lives in the type, not the
    // name. What the user typed (30 000 lei) is what the field shows back; what is stored is 3 000 000.
    expect(saved.salaryIncomeLei).toBe(3_000_000);

    // The real proof: a fresh document must read the new values back out of storage.
    await page.reload();
    await expect(field(page, 'Cod CAEN').locator('input')).toHaveValue('6202');
    await expect(field(page, 'Data înființării').locator('input')).toHaveValue('2026-04-01');
    await expect(field(page, 'Venit din salarii').locator('select')).toHaveValue('da');
    await expect(field(page, 'Venit brut anual din salarii').locator('input')).toHaveValue('30000');
  });

  test('refuses to save a salary without the amount the 6 SM test needs', async ({ page }) => {
    await seed(page, { profile: legacyProfile(), revenues: REVENUES, expenses: EXPENSES, settings: SEED_SETTINGS });
    await page.goto('/settings#!/fiscal');

    await field(page, 'Venit din salarii').locator('select').selectOption('da');
    await page.getByRole('button', { name: 'Salvează' }).click();

    await expect(
      page.getByText('Venitul brut anual din salarii este necesar pentru pragul de 6 salarii minime.'),
    ).toBeVisible();
    const saved = await storedProfile(page);
    expect(saved.salaryStatus).toBe('nu');
    expect(saved.salaryIncomeLei).toBeUndefined();
  });
});

test.describe('pre-Phase-6 payload survives the new profile fields', () => {
  test('revenues and expenses are still there after a reload — not silently replaced by seed', async ({ page }) => {
    await seed(page, {
      profile: legacyProfile(),
      revenues: [
        ...REVENUES,
        { id: 'p6-r2', tip: 'factura', nr: 'FCT-2026-002', date: '2026-03-11', client: 'Client B SRL', cui: 'RO87654321', valoareFaraTva: 12_000, tva: 2_280, status: 'inregistrata' },
      ],
      expenses: EXPENSES,
      settings: SEED_SETTINGS,
    });

    await page.goto('/revenues');
    await expect(page.locator('tbody tr')).toHaveCount(2);
    await expect(page.getByText('FCT-2026-001')).toBeVisible();

    await page.goto('/expenses');
    await expect(page.locator('tbody tr')).toHaveCount(1);

    // TASK 2b: `category` is the field most likely to be lost silently — zod STRIPS undeclared keys, so
    // a category declared on the TS type but not on `expenseSchema` would vanish on this very load and
    // nothing else in the app would notice. The row opens the editor, and the control there carries the
    // stored token after the reload; a categorised fixture raises no unclassified banner.
    await expect(page.getByText(/neclasificat/)).toHaveCount(0);
    await page.locator('tbody tr.clickable').first().click();
    await expect(
      page.locator('select').filter({ has: page.locator('option[value="business_space_upkeep"]') }),
    ).toHaveValue('business_space_upkeep');

    // The store re-persisted the payload it loaded; a second reload must not lose it either.
    await page.goto('/settings#!/fiscal');
    await expect(field(page, 'Cod CAEN').locator('input')).toHaveValue('6201');
    await expect(field(page, 'Venit brut anual din salarii').locator('input')).toHaveValue('');

    await page.goto('/revenues');
    await expect(page.locator('tbody tr')).toHaveCount(2);
  });
});

/**
 * Task 1 (pre-Phase-11): the estimate below is an ANNUAL run-rate projection, so it depends on the date
 * the dashboard is read. Pinning the browser clock is what keeps these two figures deterministic instead
 * of pinning a literal that is wrong the day after it is written (the B-23 failure class).
 * 2026-10-31 makes the projection model's denominator a whole 10 elapsed months, so every operand is
 * YTD x 12/10 = YTD x 1,2. Same instant as e2e/dashboard.spec.ts pins.
 */
const FIXED_AS_OF = new Date('2026-10-31T12:00:00');

async function fixClock(page: Page): Promise<void> {
  await page.clock.setFixedTime(FIXED_AS_OF);
}

test.describe('salaried PFA below the 6 SM floor — CF art. 174 alin. (6) + alin. (7) lit. a)', () => {
  /**
   * Net income 20.000 lei (< 6 SM = 24.300 lei in 2026), so art. 174 alin. (6) would ask for a
   * contribution difference up to 2.430 lei. Whether that difference is owed is a numeric test on
   * the salary actually realised in the year — which is exactly what the profile now carries.
   */
  const salaried = (salaryIncomeLei: number) => ({
    profile: legacyProfile({ salaryStatus: 'da', salaryIncomeLei }),
    revenues: REVENUES,
    expenses: EXPENSES,
    settings: SEED_SETTINGS,
  });

  test('salary at least 6 SM: no difference owed, CASS stays 10% × net, estimate computes', async ({ page }) => {
    await fixClock(page);
    await seed(page, salaried(30_000));
    await page.goto('/dashboard');

    const card = page.locator('.stat-card').filter({ hasText: 'Impozit estimat' });
    // Task 1: the engine receives the ANNUAL projection, so the fixture's 20.000 lei of net income
    // (30.000 revenue − 10.000 expense, both February 2026) enters as 24.000 lei (x 12/10).
    // CAS 0 (net < 12 SM) + CASS 2.400 (10% × 24.000, art. 174 alin. (1)) + 10% × 21.600 = 2.160.
    // On the raw YTD operand this was 3.800 lei (2.000 + 1.800).
    await expect(card.getByText(/4\.560/)).toBeVisible();
    await expect(card.locator('.value')).not.toHaveText('—');
  });

  test('salary below 6 SM: the alin. (6) difference is owed and is not deductible', async ({ page }) => {
    await fixClock(page);
    await seed(page, salaried(20_000));
    await page.goto('/dashboard');

    const card = page.locator('.stat-card').filter({ hasText: 'Impozit estimat' });
    // Projected net 24.000 lei (x 12/10): CASS owed 2.430 (10% × 6 SM floor), of which only 2.400
    // (10% × VNA) is deductible (art. 118 alin. (2) lit. b)), so the base is unchanged at 21.600 and
    // the total is exactly 30 lei higher — the non-deductible difference, not a re-based calculation.
    // On the raw YTD operand this was 4.230 lei (2.430 + 1.800), 430 lei above 3.800.
    await expect(card.getByText(/4\.590/)).toBeVisible();
    await expect(card.locator('.value')).not.toHaveText('—');
  });
});

/**
 * Phase 7, acceptance criterion 5 — identity has ONE store and it round-trips.
 *
 * Before Phase 7 the sidebar brand was hardcoded, the topbar read `profile.identity`, and the
 * Settings personal inputs were `disabled` because the data had no owner. All three now read
 * `profile.identity`, so an edit made in Settings has to come back out of storage after a real
 * navigation — and the retired `settings.personal` / `settings.company` blocks must prove they are
 * frozen (still parseable, no longer written).
 *
 * Deliberately NOT seeded with `addInitScript`: that script re-runs on every document, including
 * reload, and would re-apply the seed over whatever the UI just saved (Phase 6 §10 trap 2).
 */
test.describe('Phase 7 — identity round-trips through the one store', () => {
  async function stored(page: Page): Promise<Record<string, any>> {
    return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}'), STORAGE_KEY);
  }

  test('a personal name edit reaches the topbar and the greeting after a reload', async ({ page }) => {
    await page.goto('/settings#!/account');
    await field(page, 'Nume').locator('input').fill('Georgescu Maria');
    await page.getByRole('button', { name: 'Salvează' }).click();
    await expect(page.getByText('Datele personale au fost salvate')).toBeVisible();

    const saved = await stored(page);
    expect(saved.profile.identity.nume).toBe('Georgescu Maria');
    // settings.personal is retired from writes but stays parseable (decision D-1): the seeded
    // value is still on disk, untouched, and still validates.
    expect(saved.settings.personal.nume).toBe('Popescu Andrei');

    await page.goto('/');
    await expect(page.locator('.topbar-user')).toContainText('Georgescu Maria');
    // The greeting is derived from the same store (last token — the dataset stores surname first).
    await expect(page.locator('.greeting')).toHaveText('Bună, Maria');
  });

  test('the sidebar renders the company name from the store, not a hardcoded brand', async ({ page }) => {
    await page.goto('/settings#!/company');
    await field(page, 'Denumire').locator('input').fill('Georgescu Maria SRL');
    // The PFA tab has two "Salvează" buttons (page header + mențiuni card); the header one saves
    // the identity fields.
    await page.getByRole('button', { name: 'Salvează' }).first().click();
    await expect(page.getByText('Datele PFA au fost salvate')).toBeVisible();

    const saved = await stored(page);
    expect(saved.profile.identity.denumire).toBe('Georgescu Maria SRL');
    // The retired block keeps the value the app seeded and is never written again.
    // TASK 9 re-pin (replaced, not deleted): 'Popescu Consulting SRL' → 'Popescu Andrei PFA'. The seed
    // identity is a persoană fizică autorizată now; what this assertion guards is unchanged — the
    // retired `settings.company` block is still on disk with the seeded value and is never rewritten.
    expect(saved.settings.company.denumire).toBe('Popescu Andrei PFA');

    await page.goto('/');
    await expect(page.locator('.sidebar-identity')).toHaveText('Georgescu Maria SRL');
  });
});

/**
 * Phase 7, acceptance criterion 4 — a payload that cannot be read is quarantined and the user is
 * told. Before Phase 7 the store answered every parse failure by replacing the whole dataset with
 * seed and saying nothing (`store.tsx:109-114` at the start of this phase).
 */
test.describe('Phase 7 — a corrupt payload is quarantined, not silently replaced', () => {
  test('shows a recovery banner, keeps the rejected copy, and loads working data', async ({ page }) => {
    await page.addInitScript((key) => {
      localStorage.setItem(key, '{"profile":');
    }, STORAGE_KEY);

    await page.goto('/dashboard');

    const banner = page.getByRole('alert');
    await expect(banner).toContainText('Datele salvate nu au putut fi citite.');
    await expect(banner).toContainText('unparseable-json');

    // The app is usable again: the dashboard renders the recovered dataset.
    await expect(page.locator('.stat-card').first()).toBeVisible();

    const quarantined = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(`${key}:quarantine`) ?? '{}'),
      STORAGE_KEY,
    );
    expect(quarantined.reason).toBe('unparseable-json');
    expect(quarantined.raw).toBe('{"profile":');

    // The save effect re-persists the recovered data to the MAIN key only — the rejected copy
    // survives the save that follows it (decision D-3).
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}'), STORAGE_KEY);
    expect(saved.version).toBeGreaterThan(0);
    expect(saved.revenues.length).toBeGreaterThan(0);
    const afterSave = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(`${key}:quarantine`) ?? '{}'),
      STORAGE_KEY,
    );
    expect(afterSave.raw).toBe('{"profile":');
  });
});

/**
 * Phase 10, B-26 — the money-conversion report reaching a screen.
 *
 * The v4 → v5 step refuses to decide silently about a stored value that is not a whole number of bani: it
 * records what it changed. That half shipped first; the report was then dropped by `toAppData` and erased by
 * the save effect, so the user saw a clean dashboard over data that had quietly been altered. This is the
 * half that closes it.
 */
test.describe('Phase 10 — a sum that could not be converted exactly is named on screen (B-26)', () => {
  test('names the sum in lei, and the report survives the save that follows the load', async ({ page }) => {
    await seed(page, {
      // A v4 payload: its money fields still hold lei, so 674.504 is below ban precision once converted.
      version: 4,
      profile: legacyProfile(),
      revenues: [
        {
          id: 'p10-r1',
          tip: 'factura',
          nr: 'FCT-2026-001',
          date: '2026-02-10',
          client: 'Client A SRL',
          cui: 'RO12345678',
          valoareFaraTva: 674.504,
          tva: 0,
          status: 'inregistrata',
        },
      ],
      settings: SEED_SETTINGS,
    });

    await page.goto('/dashboard');

    // Scoped to the banner class: the chart tooltip is also a `role="status"` live region.
    const banner = page.locator('.banner[role="status"]');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('674.504'); // the stored value, verbatim
    await expect(banner).toContainText('674,50'); // what it became, in lei
    await expect(banner).not.toContainText('67450'); // never the raw ban count

    // The round-trip proof. `addInitScript` re-seeds on every navigation, so a reload here would re-run the
    // migration and prove nothing — what B-26 actually broke was the WRITE, so the assertion belongs on the
    // bytes the save effect put back into localStorage.
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}'), STORAGE_KEY);
    // The payload entered at v4; the chain ran `money-bani` (4→5), `expense-category` (5→6),
    // `tax-reserve` (6→7), `pension-facts` (7→8) and, since TASK 6, `rule-set-digest` (8→9). The save
    // effect stamps the version this build writes, so the bytes written back are v9 — and the notice
    // below is what proves the migration report survived the write rather than being recomputed on the
    // next load. Neither `tax-reserve` nor `rule-set-digest` backfills anything: this payload carries no
    // snapshots at all, so the version moves and no money and no digest does.
    // Re-pinned 2026-10-09 (TASK 6): 8 → 9, because the rule-set-digest step widened the stored snapshot
    // shape. Nothing else in this assertion changed.
    expect(saved.version).toBe(9);
    // TASK 5: the legacy profile entered this test with the pre-v8 `pensionStatus` key. The step folds it
    // into `pensionerStatus` and removes the old key — a rename of the status fact, never an inference
    // from it about pension sums received in the year.
    expect(saved.profile.pensionerStatus).toBe('nu');
    expect(saved.profile.pensionStatus).toBeUndefined();
    expect(saved.moneyNotices).toHaveLength(1);
    expect(saved.moneyNotices[0].original).toBe('674.504');
    expect(saved.moneyNotices[0].converted).toBe(67450);
  });

  test('shows nothing for a payload the conversion handled exactly', async ({ page }) => {
    await seed(page, {
      version: 4,
      profile: legacyProfile(),
      revenues: [
        {
          id: 'p10-r2',
          tip: 'factura',
          nr: 'FCT-2026-002',
          date: '2026-02-11',
          client: 'Client B SRL',
          cui: 'RO87654321',
          valoareFaraTva: 142.5,
          tva: 0,
          status: 'inregistrata',
        },
      ],
      settings: SEED_SETTINGS,
    });

    await page.goto('/dashboard');
    await expect(page.locator('.banner[role="status"]')).toHaveCount(0);

    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}'), STORAGE_KEY);
    expect('moneyNotices' in saved).toBe(false);
  });
});
