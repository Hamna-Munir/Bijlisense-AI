import { describe, expect, it } from 'vitest';
import {
  Appliance, BackupConfig, applianceMonthlyKwh, computeBackup, computeScenario, estimateEnergyCost,
  formatDuration, reconcile, totalMonthlyKwh,
} from '@/lib/energy';
import { buildActions } from '@/lib/actions';
import { demoState } from '@/lib/demo';

const ac: Appliance = { id: 'ac', name: 'AC', kind: 'ac', watts: 1200, quantity: 1, hoursPerDay: 6 };
const fan: Appliance = { id: 'fan', name: 'Fan', kind: 'fan', watts: 75, quantity: 3, hoursPerDay: 10 };

describe('appliance calculations', () => {
  it('zero usage gives zero kWh', () => {
    expect(applianceMonthlyKwh({ watts: 1200, quantity: 1, hoursPerDay: 0 })).toBe(0);
    expect(applianceMonthlyKwh({ watts: 0, quantity: 3, hoursPerDay: 5 })).toBe(0);
    expect(totalMonthlyKwh([])).toBe(0);
  });
  it('matches watts × quantity × hours × 30 / 1000', () => {
    expect(applianceMonthlyKwh(ac)).toBeCloseTo(216, 10);
    expect(applianceMonthlyKwh(fan)).toBeCloseTo(67.5, 10);
  });
  it('sums multiple appliances', () => {
    expect(totalMonthlyKwh([ac, fan])).toBeCloseTo(283.5, 10);
  });
  it('clamps negative and non-finite inputs instead of going negative or NaN', () => {
    expect(applianceMonthlyKwh({ watts: -500, quantity: 1, hoursPerDay: 5 })).toBe(0);
    expect(applianceMonthlyKwh({ watts: 100, quantity: NaN, hoursPerDay: 5 })).toBe(0);
    expect(applianceMonthlyKwh({ watts: 100, quantity: 1, hoursPerDay: 99 })).toBeCloseTo((100 * 24 * 30) / 1000, 10);
  });
  it('cost is kWh × rate and never negative', () => {
    expect(estimateEnergyCost(100, 55)).toBe(5500);
    expect(estimateEnergyCost(-5, 55)).toBe(0);
    expect(estimateEnergyCost(100, -3)).toBe(0);
  });
});

describe('scenario engine', () => {
  it('no overrides means no difference', () => {
    const r = computeScenario([ac, fan], {}, 55);
    expect(r.changed).toBe(false);
    expect(r.differenceKwh).toBe(0);
  });
  it('recalculates when a scenario changes', () => {
    const a = computeScenario([ac, fan], { ac: 5 }, 55);
    expect(a.differenceKwh).toBeCloseTo(36, 10);
    expect(a.differenceCost).toBeCloseTo(36 * 55, 6);
    const b = computeScenario([ac, fan], { ac: 4 }, 55);
    expect(b.differenceKwh).toBeCloseTo(72, 10);
    expect(b.scenarioKwh).toBeCloseTo(a.scenarioKwh - 36, 10);
  });
  it('reports a negative difference when usage increases', () => {
    expect(computeScenario([ac], { ac: 8 }, 50).differenceKwh).toBeCloseTo(-72, 10);
  });
});

describe('reconciliation', () => {
  it('does not pretend modeled and billed units match', () => {
    const r = reconcile(363, 430);
    expect(r.status).toBe('modeled-lower');
    expect(r.differenceKwh).toBeCloseTo(-67, 10);
  });
  it('handles missing bill and close matches', () => {
    expect(reconcile(300, null).status).toBe('no-bill');
    expect(reconcile(300, 0).status).toBe('no-bill');
    expect(reconcile(305, 300).status).toBe('close');
    expect(reconcile(500, 300).status).toBe('modeled-higher');
  });
});

describe('backup planner', () => {
  const base: BackupConfig = { mode: 'wh', wh: 1200, volts: 12, ah: 100, usableFraction: 0.8, inverterEfficiency: 0.85, requiredHours: 4, selectedIds: ['fan'] };

  it('uses runtime = Wh × usable × efficiency / load', () => {
    const r = computeBackup({ ...base, selectedIds: ['fan'] }, [fan]);
    expect(r.totalLoadWatts).toBe(225);
    expect(r.runtimeHours).toBeCloseTo((1200 * 0.8 * 0.85) / 225, 10);
  });
  it('converts volts × Ah to Wh', () => {
    const r = computeBackup({ ...base, mode: 'vah', volts: 12, ah: 100 }, [fan]);
    expect(r.nominalWh).toBe(1200);
  });
  it('zero or no selected load never yields Infinity or NaN', () => {
    const none = computeBackup({ ...base, selectedIds: [] }, [fan]);
    expect(none.runtimeHours).toBeNull();
    expect(none.feasible).toBeNull();
    const zeroW = computeBackup(base, [{ ...fan, watts: 0 }]);
    expect(zeroW.runtimeHours).toBeNull();
    const bad = computeBackup({ ...base, wh: NaN, usableFraction: -1, inverterEfficiency: 7 }, [fan]);
    expect(Number.isFinite(bad.runtimeHours as number)).toBe(true);
    expect(bad.runtimeHours).toBe(0);
  });
  it('judges feasibility and required capacity', () => {
    const ok = computeBackup({ ...base, requiredHours: 2 }, [fan]);
    expect(ok.feasible).toBe(true);
    const short = computeBackup({ ...base, requiredHours: 10 }, [fan]);
    expect(short.feasible).toBe(false);
    expect(short.requiredNominalWh).toBeCloseTo((225 * 10) / (0.8 * 0.85), 6);
    expect(short.shortfallHours).toBeGreaterThan(0);
  });
  it('ranks loads by contribution', () => {
    const r = computeBackup({ ...base, selectedIds: ['ac', 'fan'] }, [fan, ac]);
    expect(r.loads[0].id).toBe('ac');
    expect(r.loads.reduce((s, l) => s + l.share, 0)).toBeCloseTo(1, 10);
  });
  it('formats durations safely', () => {
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(2.5)).toBe('2 h 30 min');
  });
});

describe('action plan', () => {
  it('ranks real appliances with finite numbers and skips the refrigerator', () => {
    const { household } = demoState();
    const actions = buildActions(household.appliances, household.rate);
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.every((a) => !a.id.includes('fridge'))).toBe(true);
    expect(actions.every((a) => Number.isFinite(a.score))).toBe(true);
    for (let i = 1; i < actions.length; i++) expect(actions[i - 1].score).toBeGreaterThanOrEqual(actions[i].score);
    expect(actions.find((a) => a.id === 'trim-ac')?.savingsKwh).toBeCloseTo(36, 10);
  });
  it('returns nothing for an empty or zero-usage household', () => {
    expect(buildActions([], 55)).toEqual([]);
    expect(buildActions([{ ...ac, hoursPerDay: 0 }], 55)).toEqual([]);
  });
});
