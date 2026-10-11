import { Appliance, ApplianceKind, BackupConfig, Priority, ScenarioHours } from './energy';

export interface Household {
  size: number;
  billedUnits: number | null;
  billAmount: number | null;
  rate: number;
  priorities: Priority[];
  appliances: Appliance[];
}

export interface AppState {
  household: Household;
  scenario: ScenarioHours;
  backup: BackupConfig;
  /** Last six monthly unit readings, oldest first. */
  readings: number[];
  readingsAreUserEntered: boolean;
  isDemo: boolean;
}

export const STORAGE_KEY = 'bijlisense:state:v1';

export function demoState(): AppState {
  return {
    isDemo: true,
    household: {
      size: 5,
      billedUnits: 430,
      billAmount: 23650,
      rate: 55,
      priorities: ['cost', 'backup'],
      appliances: [
        { id: 'ac', name: 'Inverter AC', kind: 'ac', watts: 1200, quantity: 1, hoursPerDay: 6 },
        { id: 'fridge', name: 'Refrigerator', kind: 'fridge', watts: 180, quantity: 1, hoursPerDay: 10 },
        { id: 'fans', name: 'Ceiling fans', kind: 'fan', watts: 75, quantity: 3, hoursPerDay: 10 },
        { id: 'lights', name: 'LED lights', kind: 'light', watts: 12, quantity: 6, hoursPerDay: 5 },
        { id: 'tv', name: 'TV and devices', kind: 'other', watts: 120, quantity: 1, hoursPerDay: 4 },
      ],
    },
    scenario: { ac: 5 },
    backup: {
      mode: 'wh',
      wh: 1200,
      volts: 12,
      ah: 100,
      usableFraction: 0.8,
      inverterEfficiency: 0.85,
      requiredHours: 4,
      selectedIds: ['fridge', 'fans', 'lights'],
    },
    readings: [452, 486, 463, 438, 420, 430],
    readingsAreUserEntered: false,
  };
}

export interface Preset {
  label: string;
  kind: ApplianceKind;
  watts: number;
  hoursPerDay: number;
}

/** Generic starting points only. Users should replace them with the wattage on their appliance label. */
export const PRESETS: Preset[] = [
  { label: 'Inverter AC (1.5 ton)', kind: 'ac', watts: 1200, hoursPerDay: 6 },
  { label: 'Non-inverter AC (1.5 ton)', kind: 'ac', watts: 1700, hoursPerDay: 6 },
  { label: 'Ceiling fan', kind: 'fan', watts: 75, hoursPerDay: 10 },
  { label: 'Energy-saving fan', kind: 'fan', watts: 35, hoursPerDay: 10 },
  { label: 'LED bulb', kind: 'light', watts: 12, hoursPerDay: 5 },
  { label: 'Refrigerator', kind: 'fridge', watts: 180, hoursPerDay: 10 },
  { label: 'Deep freezer', kind: 'fridge', watts: 150, hoursPerDay: 10 },
  { label: 'Television', kind: 'other', watts: 100, hoursPerDay: 4 },
  { label: 'Washing machine', kind: 'other', watts: 500, hoursPerDay: 1 },
  { label: 'Water pump', kind: 'other', watts: 750, hoursPerDay: 1 },
  { label: 'Electric iron', kind: 'other', watts: 1000, hoursPerDay: 0.5 },
  { label: 'Wi-Fi router', kind: 'other', watts: 12, hoursPerDay: 24 },
  { label: 'Custom appliance', kind: 'other', watts: 100, hoursPerDay: 2 },
];

export function newId(): string {
  return `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
