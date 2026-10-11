/**
 * BijliSense calculation engine.
 * Pure functions only: no React, no network. Every number shown in the UI
 * and every number sent to the AI comes from here.
 */

export type ApplianceKind = 'ac' | 'fan' | 'light' | 'fridge' | 'other';
export type Priority = 'cost' | 'backup' | 'comfort';

export interface Appliance {
  id: string;
  name: string;
  kind: ApplianceKind;
  watts: number;
  quantity: number;
  hoursPerDay: number;
}

export const DAYS_PER_MONTH = 30;

export const LIMITS = {
  watts: 10_000,
  quantity: 50,
  hoursPerDay: 24,
  rate: 500,
  units: 20_000,
  amount: 5_000_000,
  householdSize: 30,
  batteryWh: 200_000,
  volts: 1_000,
  ah: 5_000,
} as const;

export function toNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Clamp to [min, max]. Non-finite input becomes `min`. */
export function clamp(value: unknown, min: number, max: number): number {
  const n = toNumber(value);
  return Math.min(max, Math.max(min, n));
}

/** Human-readable problems with an appliance row (the engine still clamps). */
export function applianceIssues(a: Appliance): string[] {
  const issues: string[] = [];
  if (!a.name.trim()) issues.push('Give this appliance a name.');
  if (a.watts < 0 || a.quantity < 0 || a.hoursPerDay < 0) issues.push('Values cannot be negative.');
  if (a.watts > LIMITS.watts) issues.push(`Watts above ${LIMITS.watts.toLocaleString()} is unusual for a household appliance.`);
  if (a.quantity > LIMITS.quantity) issues.push(`Quantity is capped at ${LIMITS.quantity}.`);
  if (a.hoursPerDay > LIMITS.hoursPerDay) issues.push('A day only has 24 hours.');
  return issues;
}

/** monthly_kWh = watts × quantity × hours_per_day × 30 / 1000 (inputs clamped to sane ranges). */
export function applianceMonthlyKwh(a: Pick<Appliance, 'watts' | 'quantity' | 'hoursPerDay'>): number {
  const watts = clamp(a.watts, 0, LIMITS.watts);
  const quantity = clamp(a.quantity, 0, LIMITS.quantity);
  const hours = clamp(a.hoursPerDay, 0, LIMITS.hoursPerDay);
  return (watts * quantity * hours * DAYS_PER_MONTH) / 1000;
}

export function totalMonthlyKwh(appliances: Appliance[]): number {
  return appliances.reduce((sum, a) => sum + applianceMonthlyKwh(a), 0);
}

/** Energy-only cost: kWh × the user's effective rate. Excludes taxes, fixed charges, slabs, adjustments. */
export function estimateEnergyCost(kwh: number, effectiveRate: number): number {
  return Math.max(0, toNumber(kwh)) * clamp(effectiveRate, 0, LIMITS.rate);
}

/** All-in rate implied by a bill and its units. Includes taxes/charges, so it is not a tariff. */
export function rateFromBill(billAmount: number | null, billedUnits: number | null): number | null {
  if (!billAmount || !billedUnits || billAmount <= 0 || billedUnits <= 0) return null;
  return billAmount / billedUnits;
}

// ---------- Scenario ----------

export type ScenarioHours = Record<string, number>;

export interface ScenarioRow {
  id: string;
  name: string;
  kind: ApplianceKind;
  baselineHours: number;
  scenarioHours: number;
  baselineKwh: number;
  scenarioKwh: number;
}

export interface ScenarioResult {
  rows: ScenarioRow[];
  baselineKwh: number;
  scenarioKwh: number;
  /** baseline − scenario. Positive = fewer units under the scenario; negative = more. */
  differenceKwh: number;
  baselineCost: number;
  scenarioCost: number;
  differenceCost: number;
  changed: boolean;
}

export function computeScenario(appliances: Appliance[], overrides: ScenarioHours, rate: number): ScenarioResult {
  const rows: ScenarioRow[] = appliances.map((a) => {
    const override = overrides[a.id];
    const scenarioHours = override === undefined ? a.hoursPerDay : clamp(override, 0, LIMITS.hoursPerDay);
    return {
      id: a.id,
      name: a.name,
      kind: a.kind,
      baselineHours: a.hoursPerDay,
      scenarioHours,
      baselineKwh: applianceMonthlyKwh(a),
      scenarioKwh: applianceMonthlyKwh({ ...a, hoursPerDay: scenarioHours }),
    };
  });
  const baselineKwh = rows.reduce((s, r) => s + r.baselineKwh, 0);
  const scenarioKwh = rows.reduce((s, r) => s + r.scenarioKwh, 0);
  const baselineCost = estimateEnergyCost(baselineKwh, rate);
  const scenarioCost = estimateEnergyCost(scenarioKwh, rate);
  return {
    rows,
    baselineKwh,
    scenarioKwh,
    differenceKwh: baselineKwh - scenarioKwh,
    baselineCost,
    scenarioCost,
    differenceCost: baselineCost - scenarioCost,
    changed: rows.some((r) => Math.abs(r.scenarioHours - r.baselineHours) > 1e-9),
  };
}

// ---------- Modeled vs billed ----------

export interface Reconciliation {
  status: 'no-bill' | 'close' | 'modeled-lower' | 'modeled-higher';
  differenceKwh: number;
  differencePct: number;
}

/** Compares appliance-modeled units with billed units. Never forces them to agree. */
export function reconcile(modeledKwh: number, billedUnits: number | null): Reconciliation {
  if (!billedUnits || billedUnits <= 0) return { status: 'no-bill', differenceKwh: 0, differencePct: 0 };
  const differenceKwh = modeledKwh - billedUnits;
  const differencePct = (differenceKwh / billedUnits) * 100;
  const status = Math.abs(differencePct) <= 10 ? 'close' : differenceKwh < 0 ? 'modeled-lower' : 'modeled-higher';
  return { status, differenceKwh, differencePct };
}

// ---------- Backup planner ----------

export interface BackupConfig {
  mode: 'wh' | 'vah';
  wh: number;
  volts: number;
  ah: number;
  /** 0–1: share of nominal capacity you are willing to use. */
  usableFraction: number;
  /** 0–1: inverter efficiency. */
  inverterEfficiency: number;
  requiredHours: number;
  selectedIds: string[];
}

export interface BackupLoad {
  id: string;
  name: string;
  watts: number;
  share: number;
}

export interface BackupResult {
  nominalWh: number;
  deliverableWh: number;
  totalLoadWatts: number;
  loads: BackupLoad[];
  /** null when no valid load is selected (never Infinity/NaN). */
  runtimeHours: number | null;
  /** null when it cannot be judged (no load or no required duration). */
  feasible: boolean | null;
  /** Nominal battery Wh needed for the required duration under the stated assumptions. */
  requiredNominalWh: number | null;
  shortfallHours: number | null;
}

export function batteryNominalWh(c: Pick<BackupConfig, 'mode' | 'wh' | 'volts' | 'ah'>): number {
  if (c.mode === 'vah') return clamp(c.volts, 0, LIMITS.volts) * clamp(c.ah, 0, LIMITS.ah);
  return clamp(c.wh, 0, LIMITS.batteryWh);
}

/** runtime_hours = battery_Wh × usable_fraction × inverter_efficiency / total_load_W */
export function computeBackup(config: BackupConfig, appliances: Appliance[]): BackupResult {
  const selected = appliances.filter((a) => config.selectedIds.includes(a.id));
  const raw = selected.map((a) => ({
    id: a.id,
    name: a.name,
    watts: clamp(a.watts, 0, LIMITS.watts) * clamp(a.quantity, 0, LIMITS.quantity),
  }));
  const totalLoadWatts = raw.reduce((s, l) => s + l.watts, 0);
  const loads: BackupLoad[] = raw
    .map((l) => ({ ...l, share: totalLoadWatts > 0 ? l.watts / totalLoadWatts : 0 }))
    .sort((a, b) => b.watts - a.watts);

  const nominalWh = batteryNominalWh(config);
  const usable = clamp(config.usableFraction, 0, 1);
  const efficiency = clamp(config.inverterEfficiency, 0, 1);
  const deliverableWh = nominalWh * usable * efficiency;
  const requiredHours = clamp(config.requiredHours, 0, 72);

  const hasLoad = totalLoadWatts > 0;
  const runtimeHours = hasLoad ? deliverableWh / totalLoadWatts : null;
  const feasible = runtimeHours === null || requiredHours <= 0 ? null : runtimeHours >= requiredHours;
  const requiredNominalWh =
    hasLoad && requiredHours > 0 && usable * efficiency > 0 ? (totalLoadWatts * requiredHours) / (usable * efficiency) : null;
  const shortfallHours = runtimeHours !== null && requiredHours > 0 ? Math.max(0, requiredHours - runtimeHours) : null;

  return { nominalWh, deliverableWh, totalLoadWatts, loads, runtimeHours, feasible, requiredNominalWh, shortfallHours };
}

/** Back-compat helper from the starter. */
export function estimateBatteryRuntimeHours(capacityWh: number, loadWatts: number, inverterEfficiency = 0.85, usableFraction = 0.8): number {
  if (!(loadWatts > 0) || !(capacityWh > 0)) return 0;
  return (capacityWh * clamp(usableFraction, 0, 1) * clamp(inverterEfficiency, 0, 1)) / loadWatts;
}

// ---------- Formatting ----------

export function formatPKR(value: number): string {
  const v = Number.isFinite(value) ? value : 0;
  return 'PKR ' + new Intl.NumberFormat('en-PK', { maximumFractionDigits: 0 }).format(Math.round(v));
}

export function formatKwh(value: number, digits = 0): string {
  const v = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('en-PK', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(v);
}

export function formatDuration(hours: number | null): string {
  if (hours === null || !Number.isFinite(hours)) return '—';
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
