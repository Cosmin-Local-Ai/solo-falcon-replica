import { test, expect, type Page } from '@playwright/test';
import { fixedInstant } from '../src/test/fixedInstant';
import { seedBrowserOnce } from './fixtures';

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
  socialInsuranceStatus: 'obligatoriu',
  vatRegistration: { status: 'inregistrat_art316' },
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

/** A Settings `.field` block addressed by its label text. (Since B-91 the labels carry `htmlFor`, but these
 *  specs were written against the text and the text is the accessible name either way, so they still work.) */
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
    // Deliberately NOT seeded with a plain addInitScript: that script re-runs on every document,
    // including reload, and would overwrite the value the UI just saved — the assertion
    // would then prove nothing. Here the app loads the seeded payload, edits it, and the reload
    // reads back what the store persisted.
    //
    // Phase 11: "the app's own seed" is no longer a thing — empty storage opens on onboarding — so the
    // payload is seeded explicitly, once.
    await seedBrowserOnce(page);
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
 *
 * PG-0: this used to declare its own `FIXED_AS_OF`, a second copy of the constant
 * `e2e/dashboard.spec.ts:72` already carried, and two tests further down bypassed even that with an
 * inline `setFixedTime(new Date('2026-10-31T12:00:00'))`. One value now lives in
 * `src/test/fixedInstant.ts` and is shared with the unit suite, so the browser layer and the unit layer
 * pin the same instant and a later date-dependent acceptance criterion is comparable across both.
 * Why 2026-10-31 is reasoned out there.
 */
const FIXED_AS_OF = fixedInstant();

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
    // PG-5C re-pin (replaced, not deleted): 4.560 lei → 3.800 lei. The old figure came from feeding the
    // engine the fixture's 20.000 lei of net income annualised to 24.000 lei (× 12/10). The comment that
    // used to sit here called 3.800 lei "the raw YTD operand"; after B-76 it is the annual amount —
    // CF art. 118 alin. (3) makes the sum realised in part of a year the sum for the whole year.
    // CAS 0 (net < 12 SM) + CASS 2.000 (10% × 20.000, art. 174 alin. (1); salary ≥ 6 SM so no alin. (6)
    // difference) + 10% × (20.000 − 2.000) = 1.800 → 3.800 lei.
    await expect(card.getByText(/3\.800/)).toBeVisible();
    await expect(card.locator('.value')).not.toHaveText('—');
  });

  test('salary below 6 SM: the alin. (6) difference is owed and is not deductible', async ({ page }) => {
    await fixClock(page);
    await seed(page, salaried(20_000));
    await page.goto('/dashboard');

    const card = page.locator('.stat-card').filter({ hasText: 'Impozit estimat' });
    // PG-5C re-pin (replaced, not deleted): 4.590 lei → 4.230 lei.
    // Net income 20.000 lei recorded. Salary 20.000 < 6 SM (24.300), so art. 174 alin. (6) owes the
    // difference to the floor: CASS 2.430, of which only 2.000 (10% × VNA) is deductible — the 430 lei
    // difference is excluded by art. 118 alin. (2) lit. b), so the base stays at 18.000 and the total is
    // exactly 430 lei above the 3.800 lei of the previous test. That 430-lei gap is the whole point of
    // the pair, and it survives the re-pin; only the base it sits on changed.
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
    // Phase 11: seeded once, so the edit round-trips through the store instead of being re-seeded.
    await seedBrowserOnce(page);
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
    await seedBrowserOnce(page);
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
    // Phase 11 re-pin (replaced, not deleted): the recovery target is an EMPTY dataset, not the demo
    // fixture. Handing a user who just lost their data a screenful of someone else's invoices was the D1
    // defect wearing a banner. What this test guards is unchanged — the rejected bytes survive the save
    // that follows the load, in the quarantine key.
    expect(saved.revenues).toEqual([]);
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
      // The retired flag vocabulary rides in with it on purpose: this is what an app at v4 wrote, and the
      // v16 step is the one that removes it. Without the key here, the assertion further down that the
      // written bytes carry no `otherIncome` would prove nothing.
      //
      // PG-6f adds the second retired vocabulary for the same reason. `vatExempt: false` is what a v4
      // profile actually stored, and the v18 step deletes it without converting it; `vatRegistration:
      // undefined` keeps the shared fixture's modern key out of the seeded bytes entirely (JSON.stringify
      // drops an undefined value), so the assertion that the step mints no registration state tests the
      // step rather than the fixture.
      version: 4,
      profile: legacyProfile({ otherIncome: ['imobiliare'], vatExempt: false, vatRegistration: undefined }),
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
    // Re-pinned again 2026-10-09 (TASK 10a): 9 → 10, because `record-currency` (9→10) stamps a currency on
    // every money field of every revenue and expense. Same reason, same discipline — the chain has one more
    // step, so the bytes written back carry one more version. What this test exists for is untouched: the
    // notice is still one long, `original` is still the verbatim 674.504 and `converted` is still 67450 bani.
    // `record-currency` converts nothing, so no money figure in this file moves.
    // Re-pinned 2026-10-10 (PG-5): 10 → 11, because `annual-filing` (10→11) follows it. Same discipline
    // as the two re-pins above — one more step, so the bytes written back carry one more version. What
    // this test exists for is untouched: the notice is still one long, `original` is still the verbatim
    // 674.504 and `converted` is still 67450 bani. The v11 step opens a collection and converts no amount.
    // Re-pinned 2026-10-11 (PG-6b): 11 → 12, because `activity-family` (11→12) follows it — the same
    // discipline a fourth time: one more step, so the bytes written back carry one more version. What this
    // test exists for is untouched: the notice is still one long, `original` is still the verbatim 674.504
    // and `converted` is still 67450 bani. The v12 step writes a version and touches no value.
    // Re-pinned again 2026-10-11 (PG-6h-2): 12 → 13, because `accommodation-facts` (12→13) follows it — the
    // fifth time for the same reason. What this test exists for is still untouched, and the v13 step is the
    // same kind of step as v12: it writes a version and touches no value, so no money figure moves.
    // Re-pinned 2026-10-12 (PG-6h-3): 13 → 14, because `occupancy-sheet` (13→14) follows it — the sixth time
    // for the same reason, and the same kind of step again: it opens a collection and backfills it empty, so
    // it writes a version and touches no value. What this test exists for is untouched: the notice is still
    // one long, `original` is still the verbatim 674.504 and `converted` is still 67450 bani.
    // Re-pinned 2026-10-12 (PG-6c): 14 → 15, because `vehicle-facts` (14→15) follows it — the seventh time
    // for the same reason, and the same kind of step a third time: it opens the `vehicles` collection and
    // backfills it empty, so it writes a version and touches no value. What this test exists for is
    // untouched: the notice is still one long, `original` is still the verbatim 674.504 and `converted` is
    // still 67450 bani. No vehicle fact is inferred for a profile that never declared a car.
    // Re-pinned 2026-10-12 (PG-6d): 15 → 16, because `other-income-ladder` (15→16) follows it — the eighth
    // time for the same reason, and the same kind of step again: it opens a per-year fact slot and backfills
    // nothing. What this test exists for is untouched: the notice is still one long, `original` is still the
    // verbatim 674.504 and `converted` is still 67450 bani. This step is one thing more than the previous
    // ones, though: it also DELETES a field the retired flag list used to occupy, and it converts no flag
    // into an amount.
    // Re-pinned 2026-10-12 (PG-6e): 16 → 17, because `fixed-assets` (16→17) follows it — the ninth time for
    // the same reason, and the same kind of step again: it writes a version and mints no asset. What this
    // test exists for is untouched: the notice is still one long, `original` is still the verbatim 674.504
    // and `converted` is still 67450 bani. The step is stricter than the v14 one before it: v14 opened a
    // collection, v17 opens none — the `fixedAssets` key that appears in the bytes below comes from the
    // load path resolving an absent collection to empty, not from the migration writing one.
    // Re-pinned 2026-10-12 (PG-6f): 17 → 18, because `input-vat-registration` (17→18) follows it — the
    // tenth time for the same reason, and the same kind of step as v16: it DELETES a retired field and
    // mints nothing in its place. Re-pinned again by PG-6g: 18 → 19, because `vat-returns` (18→19) follows
    // it — an eleventh time for the same reason, and the same kind of step as v13-v17: it OPENS a
    // collection and mints nothing in it. What this test exists for is untouched: the notice is still one
    // long, `original` is still the verbatim 674.504 and `converted` is still 67450 bani.
    // Re-pinned again by B-105: 19 → 20, because `lease-facts` (19→20) follows it — a twelfth time for the
    // same reason, and the same kind of step as v13-v19: it opens a fact family and mints nothing in it.
    // Re-pinned again by PG-11: 20 → 21, because `document-blob-ref` (20→21) follows it — a thirteenth time
    // for the same reason, and the same kind of step as v13-v20: it stamps a version and touches no value.
    // It is the first rung in the chain whose subject is not in the payload at all — the bytes it eventually
    // moves live in a separate store — and it is the one step that could not have been written `async` even
    // if it wanted to be, because `MigrationStep.apply` is synchronous. It moves none of those bytes: the
    // relocation is a pass that runs after the chain, and a document that cannot be moved keeps its bytes
    // inline. What this test exists for is untouched: the notice is still one long, `original` is still the
    // verbatim 674.504 and `converted` is still 67450 bani.
    expect(saved.version).toBe(21);
    // The v20 step's own half, on the same bytes: no tenant nature, no owner-cost uplift, no alin. (8)
    // trigger and no contract date was invented for a payload that never named a lease. Each of those facts
    // decides a legal outcome on its own — which of art. 84 and art. 84^1 measures the income, what the 20 %
    // ratio runs over, and whether the tax is the payer's to withhold — so a default would not be a missing
    // value, it would be a different taxpayer.
    expect('leaseFactsYears' in saved.profile).toBe(false);
    // The v16 step's own halves, on the same bytes. First the non-write: this profile never declared an
    // amount for any of the six art. 155 alin. (1) lit. c)-h) categories, so the step opened no ladder year
    // and above all invented no zero — six minted zeros would have moved this person between "no CASS at
    // all" and a base of 6, 12 or 24 minimum wages, which is defect B-41.
    expect('cassLadderYears' in saved.profile).toBe(false);
    // And the deletion: the retired flag list does not survive the chain, not as a value and not as an
    // empty array. An empty array would still be a category vocabulary the engine cannot use, and D-LEG-1
    // retires it outright rather than tolerating it.
    expect('otherIncome' in saved.profile).toBe(false);
    // The v12 step's own half, asserted on the store's bytes: this legacy profile carried no activity
    // family, and the step did not give it one. `'other'` here would have been exactly the default the
    // brief forbids — it reads as "the ordinary rules apply", asserted by the migration rather than chosen
    // by anybody who was asked. Absence is what comes back out.
    expect('activityFamily' in saved.profile).toBe(false);
    // The v13 step's own half, on the same bytes: no room count, no commission reading, no eligibility
    // answer was minted for a profile that never gave one. A room count written here would have written an
    // income title with it — art. 83 alin. (2) / art. 85 versus art. 83 alin. (4) / art. 68^3.
    expect('accommodationRoomCounts' in saved.profile).toBe(false);
    expect('accommodationCommissionReading' in saved.profile).toBe(false);
    expect('accommodationTourismEligibility' in saved.profile).toBe(false);
    // The v14 step's own half, on the same bytes. This payload carried no `occupancySheets` collection, so
    // the step opened one and left it empty — it invented no form, no room, and above all no guest. A sheet
    // written here would have put a third party's name and identity number into a migration that was only
    // ever allowed to open a drawer. Absence is what comes back out.
    expect(saved.occupancySheets).toEqual([]);
    // The v17 step's own half, on the same bytes: no asset, no entry into the patrimony, no *punerea în
    // funcțiune*, no duration was invented for a payload that never named a good. An asset written here
    // would start amortising something nobody bought. The empty array below is the load path's
    // normalisation of an absent collection — the step itself leaves the key off entirely, which is what
    // `store.migration.chain.test.tsx` asserts on the pure chain.
    expect(saved.fixedAssets).toEqual([]);
    // The v18 step's own half, on the same bytes: the retired `vatExempt` boolean is gone, and no
    // registration state was invented to replace it. Converting `false` to `inregistrat_art316` would have
    // asserted an ANAF register fact the payload never recorded, and that fact decides the money measure
    // of every record in the register — so absence is what comes back out, and the app says it does not
    // know whether this person charges TVA.
    expect('vatExempt' in saved.profile).toBe(false);
    expect('vatRegistration' in saved.profile).toBe(false);
    // And the half of the v11 step that is a NON-write, asserted on the bytes: this payload carried no
    // `declarations` collection, so nothing was moved and nothing was invented. PG-5b re-pin: the monthly
    // key is now absent from the written bytes rather than present and empty — the record type is gone, so
    // the store has no such collection to normalise. `filings` is still written empty, because an absent
    // annual register is a fact the app still carries.
    expect('legacyDeclarations' in saved).toBe(false);
    expect('declarations' in saved).toBe(false);
    expect(saved.filings).toEqual([]);
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

/**
 * Phase 10c — the user resolves their own missing rate, in a browser (B-36), and the record then reads the
 * same way everywhere (B-37).
 *
 * Before this phase the app could hold a rate and could show one, but nothing could PRODUCE one:
 * `recordFxRate` had no caller. A user with a EUR invoice met the missing-rate condition with no route out
 * except a developer editing localStorage. This is the acceptance proof for B-36 in the only place it can
 * really be made — a person typing into a form, reloading, and finding the number reconciled.
 *
 * The clock is pinned for the same reason `e2e/dashboard.spec.ts` pins it (B-23): the estimate is a run-rate
 * projection, so a figure asserted against the real "today" would be wrong the day after it was written.
 */
test.describe('Phase 10c — a rate entered in Settings reconciles the ledger (B-36, B-37)', () => {
  /** 1.000,00 EUR, no VAT, dated the day the rate below was published. */
  const EUR_REVENUE = {
    id: 'rev-eur-1',
    tip: 'factura',
    nr: 'FCT-FX-1',
    date: '2026-10-08',
    client: 'Client EUR SRL',
    cui: 'RO12345678',
    valoareFaraTva: { amount: 100_000, currency: 'EUR' },
    tva: { amount: 0, currency: 'EUR' },
    status: 'inregistrata',
  };

  test('the record is disclosed as unconverted, the rate is typed in, and after a reload it is lei', async ({ page }) => {
    // PG-0: was an inline `setFixedTime(new Date('2026-10-31T12:00:00'))`, a fourth copy of the
    // pinned instant. Same instant, now through the one constant.
    await fixClock(page);

    // Deliberately NOT seeded with a plain `addInitScript`: that re-runs on every document, so it would re-apply
    // this payload over the rate the UI is about to save and the reload assertion would prove nothing.
    // Seed the payload once, then rewrite its ledger once, in place.
    //
    // Phase 11: the app no longer loads a dataset of its own on a fresh profile, so the seed is explicit.
    await seedBrowserOnce(page);
    await page.goto('/dashboard');
    await page.evaluate(
      ([key, eur]: [string, unknown]) => {
        const data = JSON.parse(localStorage.getItem(key) ?? '{}');
        data.revenues = [eur];
        data.expenses = [];
        delete data.fxRates;
        localStorage.setItem(key, JSON.stringify(data));
      },
      [STORAGE_KEY, EUR_REVENUE],
    );
    await page.reload();

    // The record has not vanished: the dashboard renders, and says the totals are not complete.
    await expect(page.getByRole('heading', { name: 'Tablou de bord' })).toBeVisible();
    // Phase 11 re-pin (replaced, not deleted): the old assertion looked for the start-from-scratch heading,
    // which no longer exists. The B-68 property is what is asserted now — a record that is present but
    // excluded from every total must not put the zero-record card on screen.
    await expect(page.locator('[data-empty-state]')).toHaveCount(0);
    await expect(page.locator('[data-unconverted="rev-eur-1"]')).toContainText('1.000,00 EUR');

    // The fix is a rate, entered by the user. Currency, kind and date default to what a EUR daily rate is.
    await page.goto('/settings#!/fiscal');
    await page.locator('[name="fx-rate"]').fill('5.3470');
    await page.locator('[name="fx-date"]').fill('2026-10-08');
    await page.getByRole('button', { name: 'Înregistrează cursul' }).click();
    await expect(page.locator('[data-fx-entry-saved]')).toBeVisible();
    await expect(page.locator('#fx-rate-provenance')).toContainText('5.3470');

    // The reload is the proof: the rate came out of storage, not out of the test.
    await page.goto('/dashboard');
    await expect(page.locator('[data-unconverted-count]')).toHaveCount(0);
    await expect(page.locator('[data-conversion="rev-eur-1"]')).toContainText('5.3470');

    // 1.000,00 EUR × 5,3470 = 5.347,00 lei — the figure the summary, the graph and the estimate now share.
    const summaryCard = page.locator('.card').filter({ has: page.getByText('Rezumat', { exact: true }) });
    await expect(summaryCard).toContainText('5.347,00 RON');
  });

  test('an incomplete rate is refused, and the refusal is the validator’s own words', async ({ page }) => {
    // PG-0: was the fourth inline copy of the pinned instant.
    await fixClock(page);
    // Phase 11: Settings is not reachable from a first run, so the payload is seeded.
    await seedBrowserOnce(page);
    await page.goto('/settings#!/fiscal');

    await page.locator('[name="fx-rate"]').fill('5.3470'); // a number anchored to nothing
    await page.getByRole('button', { name: 'Înregistrează cursul' }).click();

    await expect(page.locator('[data-fx-entry-refused]')).toContainText(
      'rateDate: a daily reference rate needs the date it was published for',
    );
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}'), STORAGE_KEY);
    expect(saved.fxRates ?? []).toHaveLength(0);
  });
});

test.describe('B-51 — the scope statement is reachable in Settings', () => {
  /**
   * The statement is one shared copy key (`src/ui/copy/common.ts` → `scope`), rendered on the first run and
   * again on the Settings tab that already answers "where do these numbers come from". This spec proves the
   * second surface in a browser: a key that exists but is never mounted would pass a unit test on the copy
   * layer and still leave the app with no scope statement, which is exactly how B-51 stayed open.
   *
   * The assertion is on a stable fragment, not on the whole sentence — the wording may be reworded honestly
   * (the content pins live in `src/pages/scope.statement.test.tsx`), and a spec that retypes a whole
   * paragraph breaks on every comma.
   */
  test('the Date tab carries the statement, and it survives a reload', async ({ page }) => {
    await fixClock(page);
    await seedBrowserOnce(page);
    await page.goto('/settings#!/data');

    await expect(page.locator('[data-scope-statement]')).toBeVisible();
    await expect(page.locator('[data-scope-statement]')).toContainText('sunt estimări');
    await expect(page.locator('[data-scope-statement]')).toContainText('Nimic nu se depune');

    // Reachable again after a reload, from the same route — it is a durable statement, not a first-run toast.
    await page.reload();
    await expect(page.locator('[data-scope-statement]')).toContainText('consultanța fiscală');
  });
});

test.describe('B-97 — art. 322 alin. (7)-(8): bunuri cumpărate dintr-un alt stat UE', () => {
  /**
   * D-AIC-2 end to end. The point of this spec is the middle of it: after „da” and a month are chosen, the
   * three consequences are on screen and **the profile still holds nothing** — a reload brings back an
   * unanswered year. Only the confirmation writes, and what it writes carries `confirmedBy: 'user'`.
   *
   * `seedBrowserOnce` rather than `seedBrowser`, for the reason the tests above record: an unconditional
   * init script re-runs on reload and would overwrite what the UI just saved, turning the persistence
   * assertion into a tautology.
   */
  test('the three consequences show before saving, nothing persists until confirmed, and the answer survives a reload', async ({ page }) => {
    await fixClock(page);
    await seedBrowserOnce(page);
    await page.goto('/settings#!/fiscal');
    await expect(page.locator('[data-cass-ladder]')).toBeVisible();

    // The seed profile is registered under art. 316 and its period is not already the month, so the
    // question applies to it — and it is asked in human terms, with the citation attached.
    await expect(page.locator('[data-aic-question]')).toContainText('alt stat al Uniunii Europene');
    await expect(page.locator('[data-aic-term]')).toContainText('achiziție intracomunitară de bunuri');

    await page.selectOption('[data-aic-answer]', 'da');
    await page.selectOption('[data-aic-month]', '5');

    const effects = page.locator('[data-aic-effects]');
    await expect(effects).toContainText('luna calendaristică');
    await expect(effects).toContainText('deconturi');
    await expect(effects).toContainText('declarație de mențiuni');
    await expect(effects).toContainText('5 zile lucrătoare');
    // The quarter is derived from the month that was chosen, never asked for.
    await expect(page.locator('[data-aic-quarter]')).toContainText('T2');

    // Nothing was saved. A reload therefore returns an unanswered year, not „da”.
    await page.reload();
    await expect(page.locator('[data-aic-answer]')).toHaveValue('');
    expect((await storedProfile(page)).vatPeriodicityYears).toBeUndefined();

    // Now confirm — two deliberate actions, and only the second one writes.
    await page.selectOption('[data-aic-answer]', 'da');
    await page.selectOption('[data-aic-month]', '5');
    await page.locator('[data-aic-review]').click();
    await expect(page.locator('[data-aic-confirm-go]')).toBeVisible();
    await page.locator('[data-aic-confirm-go]').click();

    await expect.poll(async () => {
      const years = ((await storedProfile(page)).vatPeriodicityYears ?? []) as Array<Record<string, unknown>>;
      const record = years.find((y) => y.year === 2026);
      return `${record?.aicGoodsWhileQuarterly ?? '-'}/${record?.aicGoodsExigibilityMonth ?? '-'}/${
        (record?.userChoice as Record<string, unknown> | undefined)?.confirmedBy ?? '-'
      }`;
    }).toBe('da/5/user');

    // The consequence is shown where PG-6g already shows it — a link to the Form 300 panel, not a second
    // calendar on this tab.
    await page.reload();
    await expect(page.locator('[data-aic-answer]')).toHaveValue('da');
    await expect(page.locator('[data-aic-month]')).toHaveValue('5');
    await expect(page.locator('[data-aic-saved]')).toContainText('al dumneavoastră');
    await expect(page.locator('[data-aic-calendar-link]')).toHaveAttribute('href', '/declarations');
    await expect(page.locator('[data-obligation-id]')).toHaveCount(0);
  });

  test('B-99 — the split the confirmation promises is the split the filing calendar lists', async ({ page }) => {
    // The defect this pins is a promise the app did not keep. The confirmation the taxpayer answers says
    // „În loc de un singur decont pe trimestrul T2, se depun 2 deconturi pentru aceeași perioadă”, and the
    // calendar on /declarations is what they then have to file. Art. 322 alin. (7) sets the periodicity to
    // the month itself, so the year reached the calendar as twelve ordinary months and the distinct period
    // — with its own decont under art. 323 alin. (1) — was absent. The two halves are asserted against each
    // other here, in a browser, because that drift is the defect class, not a detail of this case.
    await fixClock(page);
    await seedBrowserOnce(page);
    await page.goto('/settings#!/fiscal');
    await expect(page.locator('[data-aic-question]')).toBeVisible();

    await page.selectOption('[data-aic-answer]', 'da');
    await page.selectOption('[data-aic-month]', '5');
    await page.locator('[data-aic-review]').click();
    const promised = page.locator('.modal-body li').nth(1);
    await expect(promised).toContainText('2 deconturi');
    // B-101 — the confirmation also has to say WHEN the month begins, because the calendar now shows a
    // quarterly return for every quarter closed before that point. „Perioada fiscală devine luna
    // calendaristică” alone promised a year of months that the law does not give.
    await expect(page.locator('.modal-body li').nth(0)).toContainText('începând cu 06.2026');
    await page.locator('[data-aic-confirm-go]').click();

    await page.goto('/declarations');
    // B-101 — the first quarter was never monthly. Art. 322 alin. (7) lit. b) begins the month at the third
    // month of T2, so Q1 is one return, under the same id a plain quarterly person would have had.
    await expect(page.locator('[data-obligation-id="decont-T1-2026"]')).toBeVisible();
    await expect(page.locator('[data-obligation-id="decont-01.2026"]')).toHaveCount(0);
    await expect(page.locator('[data-obligation-id="decont-02.2026"]')).toHaveCount(0);
    await expect(page.locator('[data-obligation-id="decont-03.2026"]')).toHaveCount(0);
    // The distinct period is its own row, with its own term from the same art. 323 alin. (1) formula — it
    // ends 31 May, so it is due 25 June — and May is no longer a month with a return of its own.
    const distinct = page.locator('[data-obligation-id="decont-04-05.2026"]');
    await expect(distinct).toBeVisible();
    await expect(distinct.locator('td').nth(1)).toHaveText('25.06.2026');
    await expect(distinct.locator('td').nth(3)).toContainText('art. 323 alin. (1)');
    await expect(page.locator('[data-obligation-id="decont-05.2026"]')).toHaveCount(0);
    await expect(page.locator('[data-obligation-id="decont-06.2026"]')).toBeVisible();
    // Two deconturi covering T2 — the number the confirmation stated, counted on the calendar.
    await expect(page.locator('[data-obligation-id="decont-04-05.2026"], [data-obligation-id="decont-06.2026"]')).toHaveCount(2);
    // The alin. (8) mențiuni duty appears exactly once: the calendar does not duplicate it.
    await expect(page.locator('[data-obligation-id="mentiuni-aic-2026-05"]')).toHaveCount(1);

    // And the distinct period is dischargeable on its own terms — the id is a join key, not a caption.
    await distinct.locator('button').click();
    await expect(distinct).toContainText('Depusă');
    await expect(page.locator('[data-obligation-id="decont-06.2026"]')).toContainText('Neconsemnată');
  });

  test('a person outside the VAT register is not asked, and the tab says why', async ({ page }) => {
    await fixClock(page);
    await seedBrowserOnce(page);
    await page.goto('/settings#!/fiscal');
    await expect(page.locator('[data-cass-ladder]')).toBeVisible();

    await page.selectOption('#set-vat-registration', 'scutit_art310');
    await page.getByRole('button', { name: 'Salvează' }).click();

    await expect(page.locator('[data-aic-answer]')).toHaveCount(0);
    await expect(page.locator('[data-aic-not-asked]')).toContainText('nu ești înregistrat(ă) în scopuri de TVA');
  });
});
