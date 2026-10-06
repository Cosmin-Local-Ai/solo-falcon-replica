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
  { id: 'p6-e1', tip: 'factura', nr: 'CH-2026-001', date: '2026-02-20', furnizor: 'Biroux SRL', cui: 'RO11111111', valoareFaraTva: 10_000, tva: 1_900, status: 'inregistrata' },
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
    expect(saved.salaryIncomeLei).toBe(30000);

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

    // The store re-persisted the payload it loaded; a second reload must not lose it either.
    await page.goto('/settings#!/fiscal');
    await expect(field(page, 'Cod CAEN').locator('input')).toHaveValue('6201');
    await expect(field(page, 'Venit brut anual din salarii').locator('input')).toHaveValue('');

    await page.goto('/revenues');
    await expect(page.locator('tbody tr')).toHaveCount(2);
  });
});

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
    await seed(page, salaried(30_000));
    await page.goto('/dashboard');

    const card = page.locator('.stat-card').filter({ hasText: 'Impozit estimat' });
    // CAS 0 (net < 12 SM) + CASS 2.000 (10% × 20.000, art. 174 alin. (1)) + 10% × 18.000 = 1.800.
    await expect(card.getByText(/3\.800/)).toBeVisible();
    await expect(card.locator('.value')).not.toHaveText('—');
  });

  test('salary below 6 SM: the alin. (6) difference is owed and is not deductible', async ({ page }) => {
    await seed(page, salaried(20_000));
    await page.goto('/dashboard');

    const card = page.locator('.stat-card').filter({ hasText: 'Impozit estimat' });
    // CASS 2.430 (10% × 6 SM), of which only 2.000 is deductible (art. 118 alin. (2) lit. b)),
    // so the taxable base is unchanged at 18.000 and the total is 430 lei higher.
    await expect(card.getByText(/4\.230/)).toBeVisible();
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
    expect(saved.settings.company.denumire).toBe('Popescu Consulting SRL');

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
