import { describe, expect, it } from 'vitest';
import type { AppData, Revenue, SettingsState } from '../data/types';
import type { PfaIdentity, PfaProfile } from './models';
import { selectYtd } from './aggregation';
import { dpiCoverageGaps, selectEstimateOperands } from './estimateBasis';
import { getThresholdStatuses } from '../data/dashboard';
import { validateDatasetImport } from '../data/datasetImport';
import { DATASET_EXPORT_KIND, DATASET_EXPORT_VERSION } from '../data/datasetExport';
import { CURRENT_DATA_VERSION } from '../data/migration';
import { selectRuleSet } from './fiscal';
import { PFA_2026_DPI_RELEASE_ID } from './fiscal/release2026dpi';
import { lei, money, type Bani } from './money';

/**
 * B-112 STAGE 1 — the DPI income path, end to end through the assembler and the coverage channel.
 *
 * **What B-112 actually was.** Golden fixture 1 pinned ANAF's own arithmetic and the engine disagreed: for
 * activități independente net 68.000 lei plus DPI net 50.000 lei, ANAF computes bază CAS 97.200 lei → CAS
 * 24.300 lei, and the engine computed 12.150 lei. The tier function was right — 12.150 = 25 % × 48.600 is
 * correct for 68.000 alone. The app simply **could not represent DPI income**: a `Revenue` carried `tip`, a
 * document type, and no income category, so an entire income category was missing from the CAS cumulation of
 * art. 148 alin. (3). That survived 2,332 green tests because every one of them asked the code what the code
 * thinks.
 *
 * **What Stage 1 does, and therefore what this file asserts.** It makes the category representable and keeps
 * the receipts out of the art. 68 sistem-real engine, which is the wrong engine for them — art. 70 income has
 * a 40 % quota (art. 72 alin. (2)), a different CAS limb (art. 137 alin. (1) lit. b¹)) and a different CASS
 * limb (art. 155 alin. (1) lit. c)), and its 10 % tax is withheld by the payer and final (art. 72 alin.
 * (4)-(5)). Those paths land in stages 2-4. So the honest state right now is: **out of the figure, and said.**
 * A test that only checked "the total did not change" would pass on a silent omission, which is the failure
 * this stage exists to prevent; every case below checks the exclusion AND the disclosure.
 *
 * The CAS cumulation that closes the 24.300 vs 12.150 gap is Stage 2, and no figure here pretends otherwise.
 */

function identity(): PfaIdentity {
  return {
    nume: 'Test PFA', cnp: '', adresa: 'Str. Test 1', telefon: '0700000000', email: 'test@example.com',
    denumire: 'Test PFA', cui: '12345678', formaJuridica: 'PFA', numarRegComert: 'J40/123/2026',
    adresaSocietate: 'Str. Test 1', telefonSocietate: '0700000000', emailSocietate: 'test@example.com',
    contBancar: 'RO49BANK1234', banca: 'Test Bank',
  };
}

function profile(over: Partial<PfaProfile> = {}): PfaProfile {
  return {
    id: 'profile-dpi', pfaStartYear: 2026, fiscalYear: 2026, regime: 'impozit_pe_venit', caen: '6201',
    salaryStatus: 'nu', pensionerStatus: 'nu', cassLadderYears: [], socialInsuranceStatus: 'obligatoriu',
    vatRegistration: { status: 'scutit_art310' as const }, cashFloorLei: lei(0), identity: identity(),
    updatedAt: '2026-01-01T00:00:00.000Z', ...over,
  };
}

const emptySettings: SettingsState = {
  cotaTva: 0.19,
  company: { denumire: 'Test PFA', cui: '12345678', numarRegComert: 'J40/123/2026', adresa: 'Str. Test 1', caen: [] },
  personal: { nume: 'Test', cnp: '', adresa: 'Str. Test 1', telefon: '0700000000', email: 'test@example.com' },
  bankAccounts: [],
  eFactura: { trimitere: 'manual', dateContact: '' },
};

function makeData(over: Partial<AppData> = {}): AppData {
  return {
    reservedAmount: null,
    profile: profile(), revenues: [], expenses: [], clients: [], filings: [], vatReturns: [], documents: [],
    occupancySheets: [], vehicles: [], fixedAssets: [],
    companyDocs: { im: [], cs: [], tva: [], facturi: [] }, statements: [], snapshots: [],
    settings: emptySettings, ...over,
  };
}

function rev(id: string, net: Bani, over: Partial<Revenue> = {}): Revenue {
  return {
    id, tip: 'factura', nr: id, date: '2026-03-10', client: 'Client Test', cui: '12345678',
    valoareFaraTva: money(net, 'RON'), tva: money(lei(0), 'RON'), status: 'inregistrata', ...over,
  };
}

const AS_OF = '2026-10-31';
const rulesFor = (data: AppData) => [...(selectRuleSet(data.profile.fiscalYear, AS_OF)?.rules ?? [])];

/** The art. 67 register the app has always modelled: 68.000 lei of receipts, nothing else. */
function aiOnly(): AppData {
  return makeData({ revenues: [rev('ai-1', lei(68_000))] });
}

/** The same register plus ANAF Exemplul 3's DPI receipts: 83.333,33 lei brut → 50.000 lei net. */
function withDpi(): AppData {
  return makeData({
    revenues: [
      rev('ai-1', lei(68_000)),
      rev('dpi-1', lei(50_000), { incomeCategory: 'drepturi_de_proprietate_intelectuala' }),
    ],
  });
}

describe('B-112 — DPI receipts are out of the sistem-real engine, and the estimate says so', () => {
  it('the engine\'s revenue operands exclude the DPI receipts', () => {
    const withD = selectEstimateOperands(withDpi(), AS_OF, rulesFor(withDpi()));
    const without = selectEstimateOperands(aiOnly(), AS_OF, rulesFor(aiOnly()));
    expect(withD.kind).toBe('run');
    expect(without.kind).toBe('run');
    if (withD.kind !== 'run' || without.kind !== 'run') return;
    // The DPI receipt is not run through art. 68 as if it were art. 67 income.
    expect(withD.amounts.revenues).toBe(without.amounts.revenues);
    expect(withD.amounts.revenuesNet).toBe(without.amounts.revenuesNet);
  });

  it('and the same receipts are reported as a coverage gap, one row per receipt', () => {
    const data = withDpi();
    const gaps = dpiCoverageGaps(data, AS_OF, rulesFor(data));
    expect(gaps).toHaveLength(1);
    expect(gaps[0].recordId).toBe('dpi-1');
    expect(gaps[0].kind).toBe('revenue');
    expect(gaps[0].reason).toBe('dpi_income_not_modelled');
    expect(gaps[0].amount).toBe(lei(50_000));
    expect(gaps[0].currency).toBe('RON');
  });

  it('the gap row names the article, the quota and the two contribution limbs', () => {
    const data = withDpi();
    const detail = dpiCoverageGaps(data, AS_OF, rulesFor(data))[0].detail;
    expect(detail).toContain('art. 70');
    // The quota is read from the rule, not restated: 40 %, and the row says the 20 % belongs to cedare.
    expect(detail).toContain('40%');
    expect(detail).toContain('art. 148 alin. (3)');
    expect(detail).toContain('art. 137 alin. (1) lit. b^1)');
    expect(detail).toContain('art. 155 alin. (1) lit. c)');
  });

  it('a register with no DPI receipts produces no DPI row at all', () => {
    // Every payload written before B-112. A row here would be a finding on a record that carries none.
    expect(dpiCoverageGaps(aiOnly(), AS_OF, rulesFor(aiOnly()))).toEqual([]);
  });

  it('an art. 67 receipt is never reported as an omitted DPI income', () => {
    // The guarantee that matters here is the mis-classification one: a receipt the person declared art. 67
    // stays in the figure even if it also carries a DPI contract type. B-117 changed only what the app says
    // about the contradiction — it always named it in `dpiRecordConflict` and the form always refused to
    // store the pair (`Revenues.tsx` clears both DPI fields when the category is not art. 70), but the
    // coverage surface was silent. It is not silent now, and the row is a contradiction row, not an
    // omission row: see the B-117 block below for what the row is and what it carries.
    const data = makeData({ revenues: [rev('ai-1', lei(68_000), { dpiContractType: 'cesiune_licenta' })] });
    expect(dpiCoverageGaps(data, AS_OF, rulesFor(data)).map((g) => g.reason)).toEqual(['fact_missing']);
    const ops = selectEstimateOperands(data, AS_OF, rulesFor(data));
    if (ops.kind !== 'run') throw new Error('expected the engine to run');
    expect(ops.amounts.revenues).toBe(lei(68_000));
  });
});

/**
 * B-117 — a DPI contradiction stored on an art. 67 record reaches the coverage surface.
 *
 * **What the defect was.** `dpiRecordConflict` names the pair, `Revenues.tsx` refuses to store it, and
 * `dpiCoverageGaps` walked only `ytd.dpiRecordIds` — the receipts the declared category puts inside art. 70.
 * So a record that carries a DPI contract fact while its category says art. 67 was contradicted by the app's
 * own vocabulary and invisible to its own coverage channel. Catching it needed the other register subset.
 *
 * **Severity is low and the tests say so.** The form blocks the pair, so the only way to hold it is an
 * imported backup or hand-edited bytes. That is still a contradiction the person should be told about, and
 * it is not a reason to invent one: every case below starts from a fact a live path can produce.
 *
 * **The B-143 lesson, applied.** A coverage row with no producer is how `AttentionState.not_submitted` ended
 * up dead-but-test-pinned. The import case at the end of this block is the pin that says a live path
 * produces the pair — without it, this whole block would be a row kept alive only by its own tests.
 */
describe('B-117 — a stored DPI contradiction on an art. 67 record reaches the coverage surface', () => {
  function art67WithDpiFact(over: Partial<Revenue> = {}): AppData {
    return makeData({ revenues: [rev('ai-1', lei(68_000), over)] });
  }

  it('a cesiune / licență declared on an art. 67 receipt yields one row that names the contradiction', () => {
    const data = art67WithDpiFact({ dpiContractType: 'cesiune_licenta' });
    const gaps = dpiCoverageGaps(data, AS_OF, rulesFor(data));
    expect(gaps).toHaveLength(1);
    expect(gaps[0].recordId).toBe('ai-1');
    expect(gaps[0].kind).toBe('revenue');
    // The reason the art. 70 side of the same contradiction already carries. One contradiction must not
    // take two names depending on which half of it is wrong.
    expect(gaps[0].reason).toBe('fact_missing');
    expect(gaps[0].detail).toContain('art. 67');
    expect(gaps[0].detail).toContain('art. 70');
    // It reports the contradiction and refuses to resolve it.
    expect(gaps[0].detail).toContain('nu alege');
    // And it deep-links to the record, which is the only place the pair can be fixed.
    expect(gaps[0].fixTarget).toContain('/revenues');
  });

  it('an art. 72 alin. (3) exclusion kind on an art. 67 receipt yields the same row', () => {
    const data = art67WithDpiFact({ dpiExcludedKind: 'drept_de_suita' });
    const gaps = dpiCoverageGaps(data, AS_OF, rulesFor(data));
    expect(gaps).toHaveLength(1);
    expect(gaps[0].reason).toBe('fact_missing');
    expect(gaps[0].detail).toContain('art. 72 alin. (3)');
  });

  it('an art. 67 receipt under a contract de comandă is coherent, and the surface stays silent', () => {
    // The walk must not fire on every DPI field: `contract_de_comanda` IS the art. 67 answer. A row here
    // would be a finding on a record that carries none.
    const data = art67WithDpiFact({ dpiContractType: 'contract_de_comanda' });
    expect(dpiCoverageGaps(data, AS_OF, rulesFor(data))).toEqual([]);
    expect(selectYtd(data, AS_OF).dpiDeclaredRecordIds).toEqual(['ai-1']);
  });

  it('the row carries no amount, because the receipt is inside the figure and nothing left it', () => {
    // The art. 70 contradiction row carries its amount: that receipt really is out of the estimate. This one
    // does not, because the engine ran on the receipt at full value. Writing the amount here would subtract
    // from the weighted percentage a sum the figure already computed on — the B-71 defect, dressed as a
    // disclosure.
    const data = art67WithDpiFact({ dpiContractType: 'cesiune_licenta' });
    const [gap] = dpiCoverageGaps(data, AS_OF, rulesFor(data));
    expect(gap.amount).toBeNull();
    expect(gap.currency).toBe('RON');
    const ops = selectEstimateOperands(data, AS_OF, rulesFor(data));
    if (ops.kind !== 'run') throw new Error('expected the engine to run');
    expect(ops.amounts.revenues).toBe(lei(68_000));
  });

  it('the ids come from `selectYtd`, so period and status are decided in one place', () => {
    // The B-70 rule: this function does not re-apply `inPeriod` or re-read `status`. It walks the subset the
    // aggregation pass already selected.
    expect(selectYtd(art67WithDpiFact({ dpiContractType: 'cesiune_licenta' }), AS_OF).dpiDeclaredRecordIds)
      .toEqual(['ai-1']);
    const outside = makeData({
      revenues: [rev('ai-2', lei(68_000), { dpiContractType: 'cesiune_licenta', date: '2025-03-10' })],
    });
    expect(dpiCoverageGaps(outside, AS_OF, rulesFor(outside))).toEqual([]);
    const pending = makeData({
      revenues: [rev('ai-3', lei(68_000), { dpiContractType: 'cesiune_licenta', status: 'in-asteptare' })],
    });
    expect(dpiCoverageGaps(pending, AS_OF, rulesFor(pending))).toEqual([]);
  });

  it('a register with no DPI facts at all still produces no DPI row — the seed, and every pre-B-112 payload', () => {
    // The early return for an empty DPI list is still an early return for an empty register: B-117 widened
    // what the function can see, it did not make it report on records that carry nothing.
    expect(dpiCoverageGaps(aiOnly(), AS_OF, rulesFor(aiOnly()))).toEqual([]);
  });

  it('a live path produces the pair: a backup file imports it, and the imported record reaches the row', () => {
    // This is the pin that keeps B-117 from being B-143. The form cannot store the pair, so the producer has
    // to be named — and it is a real one: Settings offers a dataset backup to `store.importDataset`, which
    // validates through `revenueSchema`. That schema declares all three DPI fields — it has to, because zod
    // strips undeclared keys — and refines none of them against the others, because a cross-field refine
    // would reject bytes the person then has no way to repair. So the pair arrives, and the coverage surface
    // is the place it has to be said.
    const data = art67WithDpiFact({
      incomeCategory: 'activitate_independenta',
      dpiContractType: 'cesiune_licenta',
    });
    const raw = JSON.stringify({
      kind: DATASET_EXPORT_KIND,
      exportVersion: DATASET_EXPORT_VERSION,
      exportedAt: '2026-10-13T09:00:00.000Z',
      // `cotaTva` is an integer percent in the persisted shape and a fraction in the live one — the payload
      // is written the way a backup file writes it, not the way the store holds it.
      data: { ...data, version: CURRENT_DATA_VERSION, settings: { ...emptySettings, cotaTva: 19 } },
    });
    const outcome = validateDatasetImport(raw);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const [imported] = outcome.data.revenues;
    expect(imported.incomeCategory).toBe('activitate_independenta');
    expect(imported.dpiContractType).toBe('cesiune_licenta');
    // The bytes are on the person's register now. The row has to follow them.
    const gaps = dpiCoverageGaps(makeData({ revenues: outcome.data.revenues }), AS_OF, rulesFor(data));
    expect(gaps.map((g) => [g.recordId, g.reason])).toEqual([['ai-1', 'fact_missing']]);
  });

  it('the B-112 refusal is untouched by this: same row, same sentence, and still no DPI income posted', () => {
    // Acceptance criterion 4, pinned rather than asserted. The refusal suppresses the per-receipt DPI rows
    // because those restate one fiscal quantity; it has nothing to say about a different record, so it must
    // not mute this finding either (B-106 is the standing example of a refusal that hid the only finding a
    // surface had).
    const ladder = { fiscalYear: 2026, proprietateIntelectuala: lei(48_000) };
    const dpiReceipt = () => rev('dpi-1', lei(50_000), {
      incomeCategory: 'drepturi_de_proprietate_intelectuala',
    });
    const without = makeData({
      profile: profile({ cassLadderYears: [ladder] }),
      revenues: [rev('ai-1', lei(68_000)), dpiReceipt()],
    });
    const withContradiction = makeData({
      profile: profile({ cassLadderYears: [ladder] }),
      revenues: [rev('ai-1', lei(68_000), { dpiContractType: 'cesiune_licenta' }), dpiReceipt()],
    });
    const before = dpiCoverageGaps(without, AS_OF, rulesFor(without));
    const after = dpiCoverageGaps(withContradiction, AS_OF, rulesFor(withContradiction));
    expect(before).toHaveLength(1);
    // Byte-identical refusal row, still first, still the only DPI row.
    expect(after[0]).toEqual(before[0]);
    expect(after[0].reason).toBe('dpi_income_double_represented');
    expect(after.filter((g) => g.reason === 'dpi_income_double_represented')).toHaveLength(1);
    expect(after.map((g) => g.recordId)).toEqual(['dpi:2026', 'ai-1']);
    // And the refusal still refuses: neither DPI receipt reaches the figure.
    const ops = selectEstimateOperands(withContradiction, AS_OF, rulesFor(withContradiction));
    const plain = selectEstimateOperands(aiOnly(), AS_OF, rulesFor(aiOnly()));
    if (ops.kind !== 'run' || plain.kind !== 'run') throw new Error('expected both to run');
    expect(ops.amounts.revenues).toBe(plain.amounts.revenues);
  });
});

describe('B-112 — marking the DPI part does not shrink the turnover the VAT plafon measures', () => {
  it('DPI receipts stay inside `revenue` and `revenueNet` on the full ledger', () => {
    // Authorship is a `prestare de servicii` for Titlul VII, so it counts toward cifra de afaceri under
    // art. 310. Moving DPI receipts out of the turnover in order to fix an income-tax defect would have
    // created a VAT one. What the income side needs is a named PART of the same total, which is what
    // `dpiGross` / `dpiGrossNet` are.
    const ytd = selectYtd(withDpi(), AS_OF);
    expect(ytd.revenue).toBe(lei(118_000));
    expect(ytd.revenueNet).toBe(lei(118_000));
    expect(ytd.dpiGross).toBe(lei(50_000));
    expect(ytd.dpiGrossNet).toBe(lei(50_000));
    expect(ytd.dpiRecordIds).toEqual(['dpi-1']);
  });

  it('the DPI part is a subset of the turnover, never an addition to it', () => {
    const ytd = selectYtd(withDpi(), AS_OF);
    expect(ytd.dpiGross <= ytd.revenue).toBe(true);
    // And the art. 67 measure the engine runs on is the difference, struck once by the assembler's scoping.
    const ops = selectEstimateOperands(withDpi(), AS_OF, rulesFor(withDpi()));
    if (ops.kind !== 'run') throw new Error('expected the engine to run');
    expect(ops.amounts.revenues).toBe(ytd.revenue - ytd.dpiGross);
  });

  it('a register with no DPI receipts reports a zero DPI part and an empty id list', () => {
    const ytd = selectYtd(aiOnly(), AS_OF);
    expect(ytd.dpiGross).toBe(lei(0));
    expect(ytd.dpiGrossNet).toBe(lei(0));
    expect(ytd.dpiRecordIds).toEqual([]);
  });
});

describe('B-112 — the same DPI income from the register AND from Settings is refused, not summed', () => {
  /** The pre-B-112 representation: a DPI net typed by hand onto the art. 170 alin. (4) ladder. */
  function withLadderDpi(): AppData {
    return makeData({
      profile: profile({
        cassLadderYears: [{ fiscalYear: 2026, proprietateIntelectuala: lei(48_000) }],
      }),
      revenues: [
        rev('ai-1', lei(68_000)),
        rev('dpi-1', lei(50_000), { incomeCategory: 'drepturi_de_proprietate_intelectuala' }),
        rev('dpi-2', lei(30_000), { incomeCategory: 'drepturi_de_proprietate_intelectuala' }),
      ],
    });
  }

  it('one row names the collision instead of one row per receipt', () => {
    const data = withLadderDpi();
    const gaps = dpiCoverageGaps(data, AS_OF, rulesFor(data));
    expect(gaps).toHaveLength(1);
    expect(gaps[0].reason).toBe('dpi_income_double_represented');
  });

  it('the row names BOTH producers, with their own figures', () => {
    const data = withLadderDpi();
    const detail = dpiCoverageGaps(data, AS_OF, rulesFor(data))[0].detail;
    expect(detail).toContain('2 document');
    // `leiText` renders lei without thousands separators — 80000, not 80.000,00.
    expect(detail).toContain('80000');   // the recorded gross, from the register
    expect(detail).toContain('48000');   // the hand-declared net, from Settings
    // And it says plainly what the app will not do.
    expect(detail).toContain('nu adună');
    expect(detail).toContain('nu alege valoarea mai mare');
  });

  it('the row points at Settings, because that is where one of the two inputs is', () => {
    const data = withLadderDpi();
    expect(dpiCoverageGaps(data, AS_OF, rulesFor(data))[0].fixTarget).toBe('/settings');
  });

  it('the declared ladder net alone is still a valid representation, and produces no finding', () => {
    // Stage 1 introduces a second representation; it does not invalidate the first. Retiring one of the two
    // is a data-shape decision, not a side effect of this stage.
    const data = makeData({
      profile: profile({ cassLadderYears: [{ fiscalYear: 2026, proprietateIntelectuala: lei(48_000) }] }),
      revenues: [rev('ai-1', lei(68_000))],
    });
    expect(dpiCoverageGaps(data, AS_OF, rulesFor(data))).toEqual([]);
  });

  it('the recorded path alone is also fine, and produces the per-receipt rows', () => {
    const data = makeData({
      revenues: [
        rev('ai-1', lei(68_000)),
        rev('dpi-1', lei(50_000), { incomeCategory: 'drepturi_de_proprietate_intelectuala' }),
      ],
    });
    expect(dpiCoverageGaps(data, AS_OF, rulesFor(data)).map((g) => g.reason)).toEqual([
      'dpi_income_not_modelled',
    ]);
  });

  it('the double representation changes no arithmetic: the engine sees neither DPI receipt', () => {
    // The refusal is a posting decision, not a recomputation. Had the app summed the two, the ladder would
    // have cumulated the category twice and selected a higher rung of art. 170 alin. (3).
    const doubled = selectEstimateOperands(withLadderDpi(), AS_OF, rulesFor(withLadderDpi()));
    const plain = selectEstimateOperands(aiOnly(), AS_OF, rulesFor(aiOnly()));
    if (doubled.kind !== 'run' || plain.kind !== 'run') throw new Error('expected both to run');
    expect(doubled.amounts.revenues).toBe(plain.amounts.revenues);
  });
});

describe('B-112 — the DPI part is a subset, and the art. 310 ceiling still measures the whole turnover', () => {
  /**
   * **This test protects the Stage 1 design decision, and it exists because that decision is easy to undo
   * by accident.** The scoping that keeps DPI out of the engine's sistem-real operands reads like an
   * omission, and the tidy-up that "simplifies" it is to drop DPI receipts from `revenue` and `revenueNet`
   * altogether. That would be a new defect, not a fix:
   *
   * - `revenueNet` is **cifră de afaceri**, and CF art. 310 alin. (1) measures the VAT registration plafon
   *   on it. Authorship is a *prestare de servicii* for Titlul VII purposes — art. 292 defines it as one,
   *   and nothing in Titlul VII carves DPI out — so an author who passes 395.000 lei of turnover has a
   *   registration duty whether the receipts came from art. 67 work or from art. 70 rights.
   * - Removing DPI from the turnover would **understate the VAT plafon** in order to fix an income-tax
   *   defect: one wrong number traded for another.
   *
   * So the category is marked as a **part of** the same totals (`dpiGross` / `dpiGrossNet`), and the
   * exclusion happens once, downstream, where the engine's record set is scoped. A refactor that moves the
   * exclusion upstream has to break this test on purpose first.
   */
  it('the art. 310 plafon row measures the DPI-inclusive turnover, not the art. 67 part of it', () => {
    // 300.000 lei of activitate independentă + 120.000 lei of DPI = 420.000 lei of cifră de afaceri, over
    // the 395.000 lei plafon. On the art. 67 part alone (300.000 lei) the year would read as comfortably
    // below the ceiling, and the registration duty would vanish from the screen.
    const data = makeData({
      revenues: [
        rev('ai-big', lei(300_000)),
        rev('dpi-big', lei(120_000), { incomeCategory: 'drepturi_de_proprietate_intelectuala' }),
      ],
    });
    const row = getThresholdStatuses(data, AS_OF, null).find((t) => t.thresholdId === 'VAT_REGISTRATION');
    expect(row).toBeDefined();
    expect(row!.currentValue).toBe(lei(420_000));
    // The DPI part is exactly what would have gone missing, named so a reader can see the size of the trade.
    expect(row!.currentValue).not.toBe(lei(300_000));
    expect(selectYtd(data, AS_OF).dpiGrossNet).toBe(lei(120_000));
  });

  it("and the engine's own revenue operands still exclude the DPI part, in the same year", () => {
    // The other half, asserted beside the first so the two cannot drift: the ceiling row measures 420.000
    // lei and the engine measures 300.000 lei. That is not a contradiction — it is two articles measuring
    // two different things over one record set, and it is the reason the exclusion lives in the assembler
    // rather than in the aggregation.
    const data = makeData({
      revenues: [
        rev('ai-big', lei(300_000)),
        rev('dpi-big', lei(120_000), { incomeCategory: 'drepturi_de_proprietate_intelectuala' }),
      ],
    });
    const ops = selectEstimateOperands(data, AS_OF, rulesFor(data));
    if (ops.kind !== 'run') throw new Error('expected the engine to run');
    expect(ops.amounts.revenuesNet).toBe(lei(300_000));
  });
});

describe('B-112 — a contradictory DPI declaration is reported and not posted', () => {
  it('a record declared art. 70 under a contract de comandă yields a fact_missing row with the reason', () => {
    const data = makeData({
      revenues: [
        rev('dpi-1', lei(50_000), {
          incomeCategory: 'drepturi_de_proprietate_intelectuala',
          dpiContractType: 'contract_de_comanda',
        }),
      ],
    });
    const gaps = dpiCoverageGaps(data, AS_OF, rulesFor(data));
    expect(gaps).toHaveLength(1);
    expect(gaps[0].reason).toBe('fact_missing');
    expect(gaps[0].recordId).toBe('dpi-1');
    expect(gaps[0].detail).toContain('art. 47');
    expect(gaps[0].detail).toContain('1793');
    // And it deep-links to the record itself, which is where the contradiction is fixable.
    expect(gaps[0].fixTarget).toContain('/revenues');
  });

  it('the contradictory record is still excluded from the engine, like every other DPI receipt', () => {
    const data = makeData({
      revenues: [
        rev('ai-1', lei(68_000)),
        rev('dpi-1', lei(50_000), {
          incomeCategory: 'drepturi_de_proprietate_intelectuala',
          dpiContractType: 'contract_de_comanda',
        }),
      ],
    });
    const ops = selectEstimateOperands(data, AS_OF, rulesFor(data));
    const plain = selectEstimateOperands(aiOnly(), AS_OF, rulesFor(aiOnly()));
    if (ops.kind !== 'run' || plain.kind !== 'run') throw new Error('expected both to run');
    expect(ops.amounts.revenues).toBe(plain.amounts.revenues);
  });
});

describe('B-112 — the release the path runs on', () => {
  it('the rule set selected for FY2026 carries the DPI rule, so the quota is reachable', () => {
    const rules = rulesFor(withDpi());
    expect(rules.some((r) => r.ruleId === 'DPI_ART72_2026')).toBe(true);
  });

  it('the DPI row quotes the rule\'s own quota, and would say so if the rule were absent', () => {
    // A rule set with no DPI rule must not have the app invent a quota.
    const data = withDpi();
    const v5Only = rulesFor(data).filter((r) => r.ruleId !== 'DPI_ART72_2026');
    const detail = dpiCoverageGaps(data, AS_OF, v5Only)[0].detail;
    expect(detail).toContain('nu conține regula');
    expect(detail).not.toContain('40%');
  });

  it('the revision is what a FY2026 date resolves to', () => {
    expect(selectRuleSet(2026, AS_OF)?.release.releaseId).toBe(PFA_2026_DPI_RELEASE_ID);
  });
});
