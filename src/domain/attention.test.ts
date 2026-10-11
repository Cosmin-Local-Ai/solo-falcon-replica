/**
 * TASK 8 — the attention model.
 *
 * The defect this file exists to keep fixed: `Insight` had one field, `severity`, and that one field
 * carried the legal weight, the urgency and the kind of thing at the same time. It could not say
 * *legally load-bearing but not urgent*, and it could not say *urgent but purely administrative*,
 * because saying either would have needed a second field.
 *
 * So the central test here is not "does a row appear" — it is that two items can differ on exactly one
 * dimension while agreeing on every other one. If any dimension were doing double duty, that test
 * would be impossible to write.
 */
import { describe, expect, it } from 'vitest';
import {
  attentionRank,
  deadlineSeverity,
  dedupeAttention,
  partitionAttention,
  sortAttention,
  surfaceFor,
  unresolvedRecords,
  type AttentionItem,
} from './attention';
import { lei, ron } from './money';
import { seedData } from '../data/seed';

function item(overrides: Partial<AttentionItem> = {}): AttentionItem {
  return {
    id: 'x',
    severity: 'medium',
    state: 'rejected',
    source: 'revenue',
    title: 'Titlu',
    description: 'Descriere',
    target: null,
    ...overrides,
  };
}

describe('the four dimensions stay independent', () => {
  it('two items differ on `source` while agreeing on severity, state and target', () => {
    // Same thing happened (a document was rejected), same urgency, same kind of item — different
    // register. `source` is doing work `severity` cannot do.
    const a = item({ id: 'r3', source: 'revenue' });
    const b = item({ id: 'e3', source: 'expense' });

    expect(a.severity).toBe(b.severity);
    expect(a.state).toBe(b.state);
    expect(a.target).toEqual(b.target);
    expect(a.source).not.toBe(b.source);
  });

  it('two items differ on `state` while agreeing on severity, source and target', () => {
    // Same register, same urgency, two different facts: a document that was rejected and a document
    // whose transmission is still unconfirmed. Under the old type both would have been `warning`.
    const a = item({ id: 'r3', state: 'rejected' });
    const b = item({ id: 'r2', state: 'awaiting_acceptance' });

    expect(a.severity).toBe(b.severity);
    expect(a.source).toBe(b.source);
    expect(a.target).toEqual(b.target);
    expect(a.state).not.toBe(b.state);
  });

  it('two items differ on `severity` while agreeing on state, source and target', () => {
    // Same kind of item in the same register, one urgent and one not. Severity is not a restatement
    // of the state.
    const a = item({ id: 'a', severity: 'high' });
    const b = item({ id: 'b', severity: 'low' });

    expect(a.state).toBe(b.state);
    expect(a.source).toBe(b.source);
    expect(a.target).toEqual(b.target);
    expect(a.severity).not.toBe(b.severity);
  });

  it('two items differ on `target` while agreeing on severity, state and source', () => {
    const a = item({ id: 'a', target: { href: '/revenues#!/rejected?f=r3' } });
    const b = item({ id: 'b', target: { href: '/revenues#!/rejected?f=r9' } });

    expect(a.severity).toBe(b.severity);
    expect(a.state).toBe(b.state);
    expect(a.source).toBe(b.source);
    expect(a.target?.href).not.toBe(b.target?.href);
  });

  it('a legally load-bearing item can be not urgent, and an administrative one can be urgent', () => {
    // The two sentences the old type could not express, written as data.
    //
    // A contribution floor whose level is in play carries the cited legal consequence and is measured
    // 200 days from any date: load-bearing, low urgency. A missing profile field has no legal
    // consequence attached at all and is the thing to fix this week: administrative, higher urgency.
    const legal = item({ id: 'threshold-CASS_MIN_BASE', state: 'level_engaged', source: 'threshold', severity: 'low' });
    const administrative = item({ id: 'completeness-profile', state: 'data_missing', source: 'completeness', severity: 'high' });

    expect(legal.severity).toBe('low');
    expect(administrative.severity).toBe('high');
    // And the ranking follows severity alone — never the legal weight, never the source. A lower rank
    // number sorts first, so the administrative item outranks the load-bearing one.
    expect(attentionRank(legal.severity)).toBeGreaterThan(attentionRank(administrative.severity));
    expect(sortAttention([legal, administrative]).map(i => i.id)).toEqual([
      'completeness-profile',
      'threshold-CASS_MIN_BASE',
    ]);
  });
});

describe('surface routing is one rule, applied once', () => {
  it('routes an item to exactly one surface from its state', () => {
    expect(surfaceFor('rejected')).toBe('action');
    expect(surfaceFor('awaiting_acceptance')).toBe('action');
    expect(surfaceFor('not_submitted')).toBe('action');
    expect(surfaceFor('data_missing')).toBe('action');
    expect(surfaceFor('deadline_open')).toBe('action');
    expect(surfaceFor('deadline_overdue')).toBe('action');
    expect(surfaceFor('level_engaged')).toBe('observation');
    expect(surfaceFor('level_approaching')).toBe('observation');
    expect(surfaceFor('level_review_required')).toBe('observation');
    expect(surfaceFor('estimate_review_required')).toBe('observation');
    expect(surfaceFor('reserve_shortfall')).toBe('observation');
    expect(surfaceFor('record_date_unusable')).toBe('observation');
  });

  it('the two surfaces are disjoint and together cover every item that needs attention', () => {
    const items = [
      item({ id: 'threshold-cass', state: 'level_engaged' }),
      item({ id: 'completeness-taxEstimate', state: 'data_missing' }),
      item({ id: 'record-revenue-r3', state: 'rejected', source: 'revenue' }),
      item({ id: 'deadline-pfa', state: 'deadline_open', source: 'deadline' }),
      item({ id: 'reserve', state: 'reserve_shortfall', source: 'reserve' }),
      item({ id: 'tax', state: 'estimate_review_required', source: 'tax' }),
    ];
    const { observations, actions } = partitionAttention(items);

    const ids = (list: AttentionItem[]) => list.map(i => i.id);
    expect(observations).toHaveLength(3);
    expect(actions).toHaveLength(3);
    expect(ids(observations).filter(id => ids(actions).includes(id))).toEqual([]);
    expect([...ids(observations), ...ids(actions)].sort()).toEqual(ids(items).sort());
  });

  it('an item the domain marked `none` reaches no surface at all', () => {
    // `none` is not a milder `low`. It is the domain saying this row needs no attention — which is how
    // an inapplicable threshold row stays out of the attention surfaces.
    const { observations, actions } = partitionAttention([
      item({ id: 'threshold-VAT_REGISTRATION', severity: 'none' }),
    ]);
    expect(observations).toEqual([]);
    expect(actions).toEqual([]);
  });

  it('one problem cannot appear as both a card and an action', () => {
    // The duplicate this task removed: `insights.ts` emitted a collapsed `completeness` card while
    // `getActionItems` emitted `completeness-<key>` actions for the same checks. If two producers ever
    // claim the same id again, the more severe copy wins and the other is dropped.
    const { observations, actions } = partitionAttention([
      item({ id: 'completeness-taxEstimate', state: 'data_missing', severity: 'low' }),
      item({ id: 'completeness-taxEstimate', state: 'data_missing', severity: 'high' }),
    ]);
    expect(observations).toEqual([]);
    expect(actions).toHaveLength(1);
    expect(actions[0].severity).toBe('high');
  });

  it('dedupeAttention keeps the more severe copy and drops the other', () => {
    const kept = dedupeAttention([
      item({ id: 'a', severity: 'low' }),
      item({ id: 'a', severity: 'high' }),
      item({ id: 'a', severity: 'medium' }),
    ]);
    expect(kept).toHaveLength(1);
    expect(kept[0].severity).toBe('high');
  });
});

describe('deadline severity is a distance decision made once, in the domain', () => {
  it.each([
    [-4, 'high'],
    [0, 'high'],
    [1, 'high'],
    [7, 'high'],
    [8, 'medium'],
    [30, 'medium'],
    [31, 'low'],
    [206, 'low'],
  ] as const)('daysUntil %i -> %s', (daysUntil, severity) => {
    expect(deadlineSeverity(daysUntil)).toBe(severity);
  });

  it('a non-finite distance decides nothing', () => {
    expect(deadlineSeverity(Number.NaN)).toBe('none');
  });
});

describe('the record family: what the seed actually holds', () => {
  // TASK 9: the seed no longer carries declaration records, because the three it used to carry recorded
  // monthly filings that do not exist for this profile (see the note in `data/seed.ts`).
  //
  // PG-5 re-pin (replaced, not deleted): these rows became `legacyDeclarations` — the monthly rows a
  // pre-v11 payload carries, preserved read-only — and they produce NO action item. An item for one of
  // them read „Declarație fără depunere înregistrată: 2026-06”, which asserts a submission this profile
  // does not owe: a PFA în sistem real files one Declarația Unică per fiscal year. The obligation that
  // does exist is carried by the annual filing model, not here.
  //
  // PG-5b re-pin (replaced, not deleted again): the monthly family is no longer a field on this input at
  // all — `RecordSource` has no key for it, and the record type behind it is deleted. The rows are handed
  // over anyway, cast through `unknown` the way an older caller's payload would arrive, because what is
  // under test is what the pipeline DOES with monthly rows (nothing), not what the type happens to allow.
  // If a later edit re-connects a monthly family, this still fails the moment it starts producing items.
  const declarationFixture = [
    { id: 'd1', an: 2026, luna: 3, venituri: lei(12500), cheltuieli: lei(1800), status: 'transmisa', dataInregistrare: '2026-04-10', dataTrimitere: '2026-04-15' },
    { id: 'd2', an: 2026, luna: 6, venituri: lei(14200), cheltuieli: lei(2100), status: 'in-asteptare', dataInregistrare: '2026-07-08' },
    { id: 'd3', an: 2026, luna: 9, venituri: lei(9680), cheltuieli: lei(546), status: 'inregistrata', dataInregistrare: '2026-09-28' },
  ];
  const seedWithLegacy = { ...seedData, declarations: declarationFixture } as unknown as Parameters<typeof unresolvedRecords>[0];

  const records = unresolvedRecords(seedData);
  const byId = new Map(records.map(r => [r.id, r]));
  const withLegacy = new Map(unresolvedRecords(seedWithLegacy).map(r => [r.id, r]));

  it('surfaces the three genuinely unresolved seed records', () => {
    // TASK 9 re-pin (replaced, not deleted): old `['d2', 'e3', 'r2', 'r3']`. `d2` is gone because the
    // record it came from is gone — it described a monthly filing that was never due.
    expect([...byId.keys()].sort()).toEqual(['e3', 'r2', 'r3']);
  });

  it('r2 is awaiting acceptance, and the reason is the e-Factura status the record carries', () => {
    const r2 = byId.get('r2')!;
    expect(r2.kind).toBe('revenue');
    expect(r2.state).toBe('awaiting_acceptance');
    expect(r2.eFacturaStatus).toBe('În așteptare');
    expect(r2.reference).toBe('FCT-2026-002');
  });

  it('r3 is rejected with the record’s own reason, verbatim', () => {
    const r3 = byId.get('r3')!;
    expect(r3.state).toBe('rejected');
    expect(r3.reason).toBe('CUI nevalid');
    expect(r3.reference).toBe('NF-2026-003');
  });

  it('e3 is rejected with the record’s own reason, verbatim', () => {
    const e3 = byId.get('e3')!;
    expect(e3.kind).toBe('expense');
    expect(e3.state).toBe('rejected');
    expect(e3.reason).toBe('Document neconform');
    expect(e3.reference).toBe('FCT-PRO-121');
  });

  it('a monthly row produces no action item, whatever its status', () => {
    // PG-5, re-premised by PG-5b. `in-asteptare` and `respinsa` are the record's own not-settled markers,
    // and they used to make `d2` an item. They no longer do: an action row for a monthly return asserts
    // an obligation this profile does not have, which is the defect B-34 names. The rows are no longer
    // shown anywhere — the v10→v11 step drops them — and they still generate nothing here.
    for (const legacy of ['d1', 'd2', 'd3']) {
      expect(withLegacy.has(legacy)).toBe(false);
    }
    // And the legacy rows do not disturb the records that ARE unresolved.
    expect([...withLegacy.keys()].sort()).toEqual(['e3', 'r2', 'r3']);
  });

  it('a settled record leaves the surfaces: r1, r4, e1 and e2 produce nothing', () => {
    // `d1`/`d2`/`d3` are absent for the PG-5 reason above, so the settled list is re-pinned to the four
    // revenue and expense records that are genuinely settled.
    for (const settled of ['r1', 'r4', 'e1', 'e2']) {
      expect(withLegacy.has(settled)).toBe(false);
    }
  });

  it('a corrected revenue record stops appearing', () => {
    const fixed = unresolvedRecords({
      ...seedData,
      revenues: seedData.revenues.map(r =>
        r.id === 'r3' ? { ...r, status: 'inregistrata' as const, statusDetail: undefined } : r,
      ),
    });
    expect(fixed.some(r => r.id === 'r3')).toBe(false);
  });

  it('severity is a decision per family, not a restatement of the status', () => {
    const r3 = byId.get('r3')!;
    const e3 = byId.get('e3')!;
    const r2 = byId.get('r2')!;
    // Same state (`rejected`), different severity, because a rejected income document leaves income
    // undocumented while a rejected expense document only leaves a document out of a subset the
    // engine already excluded.
    expect(r3.state).toBe(e3.state);
    expect(r3.severity).toBe('high');
    expect(e3.severity).toBe('medium');
    // Not a defect at all, and not urgent either.
    expect(r2.severity).toBe('medium');
  });

  it('surfacing these records changes no aggregate: the rejected ones stay out of every total', () => {
    // The landmine this guards. `aggregation.ts` sums only `status === 'inregistrata'` records, so
    // r3 (800 lei) and e3 (340 lei) are already out of the totals; adding an attention row for them
    // must not put them back in. The figures below are the seed's own, measured here rather than
    // asserted from memory.
    const registeredNet = seedData.revenues
      .filter(r => r.status === 'inregistrata')
      .reduce((sum, r) => sum + r.valoareFaraTva.amount, 0);
    const registeredExpenses = seedData.expenses
      .filter(e => e.status === 'inregistrata')
      .reduce((sum, e) => sum + e.valoareFaraTva.amount, 0);

    expect(registeredNet).toBe(450000 + 320000); // r1 + r4 in bani — r2 is `in-asteptare`, r3 `respinsa`
    expect(registeredExpenses).toBe(12000 + 8550); // e1 + e2, in bani — e3's 34.000 bani stays out
    // And the attention items themselves carry no sum: they name the record, they do not add it up.
    for (const r of records) expect(r.amountNet.amount).toBeGreaterThanOrEqual(0);
  });
});

describe('the record facts carry what a target needs', () => {
  it('every unresolved record names the register it lives in', () => {
    for (const r of unresolvedRecords(seedData)) {
      expect(['revenue', 'expense']).toContain(r.kind);
      expect(r.reference).not.toBe('');
      expect(r.status).not.toBe('');
    }
  });

  it('an empty register produces no items', () => {
    expect(
      unresolvedRecords({ revenues: [], expenses: [] }),
    ).toEqual([]);
  });

  it('a rejected expense with no statusDetail carries no invented reason', () => {
    const [only] = unresolvedRecords({
      revenues: [],
      expenses: [{ ...seedData.expenses[2], statusDetail: undefined }],
    });
    expect(only.reason).toBeNull();
  });

  it('money is carried as integer bani, never as a float', () => {
    const [r3] = unresolvedRecords({
      revenues: [seedData.revenues[2]],
      expenses: [],
    });
    expect(r3.amountNet).toEqual(ron(800));
  });
});
