/**
 * PG-6c (D-VEH-1, D-VEH-2, D-VEH-3) — the vehicle facts, per car and per fiscal year.
 *
 * What this file exists to pin, in the order the acceptance criteria state it:
 *
 * 1. **The 50 % is a statutory default, not a penalty.** `unknown` computes at 50 % and is never
 *    `incomplete` and never a refusal (D-VEH-1). Refusing instead would treat the app's own missing
 *    record as if the law were unresolved, and it would understate a liability.
 * 2. **`unknown` and `mixed` stay distinct stored facts** even though both compute at 50 %, because a
 *    *foaie de parcurs* changes one and not the other.
 * 3. **Inside or outside the one-car limit is about *who uses the car*, not about the car.** art. 68
 *    alin. (5) lit. j) reaches only „autoturismele folosite de contribuabil sau membru asociat”, so a car
 *    the taxpayer does not personally use is outside it and still gets 100 % / 50 % by the exclusive-use
 *    test. Without this distinction the task is not done.
 * 4. **Two taxpayer-used cars: the person designates one, and the other stays unsettled with BOTH
 *    readings quoted** (D-VEH-2). A detail carrying one reading would present an unresolved question as a
 *    finding.
 * 5. **No selection rule exists.** The behavioural form of that guarantee: with two candidates and no
 *    designation, *neither* car's running costs are computed — the app does not pick one by price,
 *    registration order, mileage, category token or anything else.
 * 6. **The global `ctx.vehicleUse` is no longer the mechanism.** An expense that cannot be attributed to a
 *    declared car is refused, not classified by a run-wide value.
 *
 * The fixtures are synthetic. No real CNP, plate or person appears here.
 */
import { describe, expect, it } from 'vitest';
import {
  isVehicleCapUnresolved,
  resolveVehicleExpense,
  vehicleCapStatuses,
  vehicleYearFacts,
  type VehicleFacts,
} from './fiscal/deductibility';
import { selectDeductibleExpenses, selectEstimateOperands } from './estimateBasis';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from './fiscal';
import { seedData } from '../data/seed';
import type { AppData, Expense } from '../data/types';
import { lei, ron } from './money';

const AS_OF = '2026-12-31';

function expense(over: Partial<Expense> = {}): Expense {
  return {
    id: 'exp-1',
    tip: 'factura',
    nr: 'FCT-TEST-1',
    date: '2026-06-10',
    furnizor: 'Furnizor Test',
    cui: 'RO00000000',
    valoareFaraTva: ron(1000),
    tva: ron(190),
    status: 'inregistrata',
    category: 'vehicle_related',
    ...over,
  };
}

/** A car with the facts the person declared for 2026. Every field optional; nothing defaults. */
function car(id: string, facts: Omit<NonNullable<ReturnType<typeof vehicleYearFacts>>, 'fiscalYear'> = {}): VehicleFacts {
  return { id, label: `Mașina ${id}`, years: [{ fiscalYear: 2026, ...facts }] };
}

function dataWith(vehicles: VehicleFacts[], expenses: Expense[]): AppData {
  return { ...seedData, vehicles: vehicles as never, expenses };
}

function assemble(vehicles: VehicleFacts[], expenses: Expense[]) {
  return selectDeductibleExpenses(dataWith(vehicles, expenses), AS_OF, PFA_2026_SYSTEM_REAL_PACKAGE);
}

describe('the vehicle entity — declared per car, per year, never inferred', () => {
  it('a vehicle with no year entry has no facts at all, and no fact is filled in', () => {
    const v = car('v1');
    expect(vehicleYearFacts(v, 2026)).toEqual({ fiscalYear: 2026 });
    expect(vehicleYearFacts(v, 2026)?.use).toBeUndefined();
    expect(vehicleYearFacts(v, 2026)?.usedByPerson).toBeUndefined();
    expect(vehicleYearFacts(v, 2026)?.designatedForRunningCosts).toBeUndefined();
    // A year nobody answered is not resolved by borrowing another year's answer.
    const otherYear = { id: 'v2', label: 'Mașina v2', years: [{ fiscalYear: 2027, use: 'exclusive' as const }] };
    expect(vehicleYearFacts(otherYear, 2026)).toBeUndefined();
  });

  it('the seed declares no vehicle, so an existing profile behaves exactly as it did before PG-6c', () => {
    expect(seedData.vehicles).toEqual([]);
    const set = assemble([], [expense()]);
    expect(set.records).toHaveLength(1);
    expect(set.records[0].valoareFaraTva).toEqual(ron(500)); // 1.000,00 x 50 %
    expect(set.excluded).toHaveLength(0);
    expect(set.counts.undetermined).toBe(0);
  });
});

describe('D-VEH-1 — the 50 % is the statutory default, not a refusal', () => {
  it('`unknown` deducts at 50 % and is not `incomplete`', () => {
    const set = assemble([car('v1', { usedByPerson: 'da' })], [expense({ vehicleId: 'v1' })]);
    expect(set.records).toHaveLength(1);
    expect(set.records[0].valoareFaraTva).toEqual(ron(500));
    expect(set.excluded).toHaveLength(0);
    expect(set.counts.undetermined).toBe(0);
    const line = set.lines.find(l => l.category === 'vehicle_related')!;
    expect(line.ruleId).toBe('EXPENSE_VEHICLE_MIXED_USE_2026');
    expect(line.cap).toMatchObject({ percent: 50, base: 'expense_itself' });
    expect(line.cap?.baseArticle).toBe('art. 68 alin. (7) lit. k)');
  });

  it('`unknown` and `mixed` are distinct stored facts that both compute at 50 %', () => {
    const unknown = assemble([car('v1', { use: 'unknown', usedByPerson: 'da' })], [expense({ id: 'u', vehicleId: 'v1' })]);
    const mixed = assemble([car('v1', { use: 'mixed', usedByPerson: 'da' })], [expense({ id: 'm', vehicleId: 'v1' })]);
    // Same money — the law gives the same answer to both.
    expect(unknown.records[0].valoareFaraTva).toEqual(mixed.records[0].valoareFaraTva);
    // Different facts — a *foaie de parcurs* changes the `unknown` one and not the `mixed` one, so the
    // two must never be merged into one stored value.
    const u = vehicleYearFacts(car('v1', { use: 'unknown' }), 2026)!.use;
    const m = vehicleYearFacts(car('v1', { use: 'mixed' }), 2026)!.use;
    expect(u).toBe('unknown');
    expect(m).toBe('mixed');
    expect(u).not.toBe(m);
  });

  it('evidenced exclusive use deducts fully, and a claimed exception category does too', () => {
    const exclusive = assemble(
      [car('v1', { use: 'exclusive', usedByPerson: 'da' })],
      [expense({ id: 'e', vehicleId: 'v1' })],
    );
    expect(exclusive.records[0].valoareFaraTva).toEqual(ron(1000));
    expect(exclusive.lines[0].ruleId).toBe('EXPENSE_VEHICLE_EXCLUSIVE_USE_2026');

    const taxi = assemble(
      [car('v1', { exceptionCategory: 'transport_persoane_cu_plata', usedByPerson: 'da' })],
      [expense({ id: 't', vehicleId: 'v1' })],
    );
    expect(taxi.records[0].valoareFaraTva).toEqual(ron(1000));
  });

  it('a car not used in the activity at all is fully non-deductible, not 50 %', () => {
    const set = assemble([car('v1', { use: 'not_used', usedByPerson: 'da' })], [expense({ vehicleId: 'v1' })]);
    expect(set.records).toHaveLength(0);
    expect(set.excluded[0]).toMatchObject({ reason: 'non_deductible', ruleId: 'EXPENSE_VEHICLE_NOT_USED_2026' });
    expect(set.excluded[0].detail).toContain('art. 68 alin. (7) lit. a)');
  });
});

describe('acceptance 4 — the one-car limit is about who uses the car, not about the car', () => {
  it('a car the taxpayer does not personally use is outside lit. j) and keeps the general rule', () => {
    // Two identical cars. One is used only by an employee, one only in the activity. Neither is
    // „folosit de contribuabil”, so neither is caught by „cel mult un singur autoturism”.
    const outside = assemble(
      [
        car('angajat', { usedByPerson: 'nu', use: 'mixed' }),
        car('activitate', { usedByPerson: 'nu', use: 'exclusive' }),
      ],
      [expense({ id: 'a', vehicleId: 'angajat' }), expense({ id: 'b', vehicleId: 'activitate' })],
    );
    expect(outside.excluded).toHaveLength(0);
    const amounts = outside.records.map(r => r.valoareFaraTva).sort((x, y) => x.amount - y.amount);
    expect(amounts).toEqual([ron(500), ron(1000)]); // 50 % mixed, 100 % exclusive — both cars carry costs
  });

  it('an outside-cap car is not displaced by a designated taxpayer-used car', () => {
    const set = assemble(
      [
        car('personal', { usedByPerson: 'da', use: 'mixed', designatedForRunningCosts: 'da' }),
        car('curierat', { usedByPerson: 'nu', use: 'mixed' }),
      ],
      [expense({ id: 'p', vehicleId: 'personal' }), expense({ id: 'c', vehicleId: 'curierat' })],
    );
    expect(set.excluded).toHaveLength(0);
    expect(set.records).toHaveLength(2);
  });

  it('the limit is per person, not per register: two taxpayer-used cars are two candidates in one CUI', () => {
    const statuses = vehicleCapStatuses(
      [car('v1', { usedByPerson: 'da' }), car('v2', { usedByPerson: 'da' })],
      2026,
    );
    // One CUI, one register — and still two candidates, because „aferent fiecărei persoane” is not a
    // per-CUI allowance. Nothing here reads `cui`.
    expect(statuses.get('v1')).toBe('designation_missing');
    expect(statuses.get('v2')).toBe('designation_missing');
  });
});

describe('acceptance 5 — two taxpayer-used cars: the person designates, the other stays unsettled', () => {
  const twoCars = [
    car('aleasa', { usedByPerson: 'da', use: 'mixed', designatedForRunningCosts: 'da' }),
    car('cealalta', { usedByPerson: 'da', use: 'mixed' }),
  ];

  it('the designated car carries the allowance and computes', () => {
    const set = assemble(twoCars, [expense({ id: 'd', vehicleId: 'aleasa' })]);
    expect(set.records).toHaveLength(1);
    expect(set.records[0].valoareFaraTva).toEqual(ron(500));
    expect(set.excluded).toHaveLength(0);
  });

  it('the other car is unsettled, and its detail carries BOTH readings verbatim', () => {
    const set = assemble(twoCars, [expense({ id: 'o', vehicleId: 'cealalta' })]);
    expect(set.records).toHaveLength(0);
    expect(set.excluded).toHaveLength(1);
    const detail = set.excluded[0].detail;
    // Reading A — fully non-deductible as personal use.
    expect(detail).toContain('CITEȘTE A');
    expect(detail).toContain('sumele sau bunurile utilizate de contribuabil pentru uzul personal');
    // Reading B — still deductible at 50 % under alin. (4).
    expect(detail).toContain('CITEȘTE B');
    expect(detail).toContain('conform art. 68 alin. (4) și (5)');
    // The litera itself, quoted, and the fact that the app chose nothing.
    expect(detail).toContain('cel mult un singur autoturism aferent fiecărei persoane');
    expect(detail).toContain('aplicația nu alege o lectură în locul tău');
    expect(set.excluded[0].ruleId).toBe('EXPENSE_VEHICLE_MIXED_USE_2026');
  });

  it('a designated car never makes the other car look settled at the estimate level either', () => {
    const operands = selectEstimateOperands(
      dataWith(twoCars, [expense({ id: 'd', vehicleId: 'aleasa' }), expense({ id: 'o', vehicleId: 'cealalta' })]),
      AS_OF,
      PFA_2026_SYSTEM_REAL_PACKAGE,
    );
    if (operands.kind !== 'run') throw new Error('expected the engine to run for this register');
    const unsettled = operands.deductible.excluded.filter(x => x.reason === 'undetermined');
    expect(unsettled).toHaveLength(1);
    expect(unsettled[0].id).toBe('o');
    expect(unsettled[0].detail).toContain('CITEȘTE A');
    expect(unsettled[0].detail).toContain('CITEȘTE B');
  });

  it('no designation settles nothing: both cars leave the base, and neither is picked', () => {
    // This is the behavioural form of "no selection rule exists". If any heuristic picked a car, exactly
    // one of these two records would compute. Neither does.
    const set = assemble(
      [car('v1', { usedByPerson: 'da', use: 'mixed' }), car('v2', { usedByPerson: 'da', use: 'mixed' })],
      [expense({ id: 'x', vehicleId: 'v1' }), expense({ id: 'y', vehicleId: 'v2' })],
    );
    expect(set.records).toHaveLength(0);
    expect(set.excluded.map(e => e.id).sort()).toEqual(['x', 'y']);
    for (const e of set.excluded) expect(e.detail).toContain('CITEȘTE A');
  });

  it('two cars marked designated is a conflict the app does not arbitrate', () => {
    const statuses = vehicleCapStatuses(
      [
        car('v1', { usedByPerson: 'da', designatedForRunningCosts: 'da' }),
        car('v2', { usedByPerson: 'da', designatedForRunningCosts: 'da' }),
      ],
      2026,
    );
    expect(statuses.get('v1')).toBe('designation_conflict');
    expect(statuses.get('v2')).toBe('designation_conflict');
    expect(isVehicleCapUnresolved('designation_conflict')).toBe(true);
  });

  it('a single taxpayer-used car needs no designation: the cap excludes nothing', () => {
    const statuses = vehicleCapStatuses([car('v1', { usedByPerson: 'da', use: 'mixed' })], 2026);
    expect(statuses.get('v1')).toBe('sole_candidate');
    const set = assemble([car('v1', { usedByPerson: 'da', use: 'mixed' })], [expense({ vehicleId: 'v1' })]);
    expect(set.records).toHaveLength(1);
  });

  it('an unanswered `usedByPerson` counts as a possible candidate — absence is not an answer', () => {
    const statuses = vehicleCapStatuses(
      [car('v1', { usedByPerson: 'da' }), car('v2', {})],
      2026,
    );
    expect(statuses.get('v1')).toBe('designation_missing');
    expect(statuses.get('v2')).toBe('designation_missing');
  });
});

describe('acceptance 7 — the global context value is no longer the mechanism', () => {
  it('a vehicle cost that names no declared car is refused, not classified by a global value', () => {
    const set = assemble(
      [car('v1', { usedByPerson: 'da', use: 'exclusive' })],
      [expense({ id: 'orfan' })], // no vehicleId, while the register does declare a car
    );
    expect(set.records).toHaveLength(0);
    expect(set.excluded[0]).toMatchObject({ reason: 'undetermined', ruleId: null });
    expect(set.excluded[0].detail).toContain('nu este atribuită niciunui vehicul');
    // The refusal says it is the app's limit, not the law's answer.
    expect(set.excluded[0].detail).toContain('Aceasta este o limită a aplicației, nu un răspuns al legii');
  });

  it('a link to a deleted car is treated the same way, not repaired', () => {
    const resolution = resolveVehicleExpense([car('v1')], 2026, 'stale-id');
    expect(resolution.kind).toBe('unattributed');
    if (resolution.kind !== 'unattributed') return;
    expect(resolution.vehicleId).toBe('stale-id');
  });

  it('with no cars declared there is no global value to fall back to, so the statutory default stands', () => {
    const resolution = resolveVehicleExpense([], 2026, undefined);
    expect(resolution).toEqual({ kind: 'no_vehicles' });
  });

  it('a non-vehicle expense is untouched by any of this', () => {
    const set = assemble([car('v1', { usedByPerson: 'da' })], [expense({ id: 'n', category: 'postal_and_telecom' })]);
    expect(set.records).toHaveLength(1);
    expect(set.excluded).toHaveLength(0);
  });
});

describe('the money never leaves the record it belongs to', () => {
  it('the cap is applied to the record, in integer bani, floored', () => {
    const set = assemble(
      [car('v1', { usedByPerson: 'da', use: 'mixed' })],
      [expense({ id: 'f', vehicleId: 'v1', valoareFaraTva: ron(10.01), tva: ron(0) })],
    );
    expect(set.records[0].valoareFaraTva).toEqual(ron(5)); // 500 bani, never 501
  });

  it('the seed estimate does not move when a vehicle is declared on a profile that has no vehicle costs', () => {
    const before = selectEstimateOperands(seedData, AS_OF, PFA_2026_SYSTEM_REAL_PACKAGE);
    const withCar = selectEstimateOperands(
      { ...seedData, vehicles: [car('v1', { usedByPerson: 'da', use: 'mixed' })] as never },
      AS_OF,
      PFA_2026_SYSTEM_REAL_PACKAGE,
    );
    if (before.kind !== 'run' || withCar.kind !== 'run') throw new Error('the seed register must compute');
    expect(before.amounts.expenses).toEqual(withCar.amounts.expenses);
  });
});
