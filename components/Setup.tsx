'use client';
import { useState } from 'react';
import { Plus, RotateCcw, Trash2 } from 'lucide-react';
import { NumberField, Notice, SectionHeader, SourceTag } from './ui';
import { Household } from '@/lib/demo';
import { PRESETS, newId } from '@/lib/demo';
import { Appliance, LIMITS, Priority, applianceIssues, applianceMonthlyKwh, formatKwh, rateFromBill } from '@/lib/energy';

const PRIORITY_LABEL: Record<Priority, string> = { cost: 'Lower my bill', backup: 'Backup readiness', comfort: 'Keep comfort first' };

export function Setup({
  household, isDemo, onChange, onResetDemo, onClearAll,
}: {
  household: Household; isDemo: boolean; onChange: (h: Household) => void; onResetDemo: () => void; onClearAll: () => void;
}) {
  const [preset, setPreset] = useState(0);
  const set = <K extends keyof Household>(k: K, v: Household[K]) => onChange({ ...household, [k]: v });
  const setAppliance = (id: string, patch: Partial<Appliance>) => set('appliances', household.appliances.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const billRate = rateFromBill(household.billAmount, household.billedUnits);
  const full = household.appliances.length >= 30;

  function addAppliance() {
    const p = PRESETS[preset];
    set('appliances', [...household.appliances, { id: newId(), name: p.label === 'Custom appliance' ? 'My appliance' : p.label, kind: p.kind, watts: p.watts, quantity: 1, hoursPerDay: p.hoursPerDay }]);
  }

  return (
    <section aria-labelledby="setup" className="border-t border-line py-14">
      <SectionHeader
        id="setup" title="Set up your household"
        lead="Start with the demo, or enter what you know. Everything is optional except the appliance list."
        aside={
          <div className="flex flex-wrap items-center gap-2">
            <SourceTag kind={isDemo ? 'demo' : 'input'} label={isDemo ? 'Demo household' : 'Your household'} />
            <button className="btn btn-quiet btn-small" onClick={onResetDemo}><RotateCcw size={14} aria-hidden /> Reset demo data</button>
            <button className="btn btn-quiet btn-small" onClick={onClearAll}>Start empty</button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <NumberField label="People in household" value={household.size} min={1} max={LIMITS.householdSize} onChange={(v) => set('size', Math.max(1, v ?? 1))} />
        <NumberField label="Units on your last bill" optional unit="kWh" value={household.billedUnits} max={LIMITS.units} onChange={(v) => set('billedUnits', v)} hint="Used to check the model against your bill." />
        <NumberField label="Last bill amount" optional unit="PKR" value={household.billAmount} max={LIMITS.amount} onChange={(v) => set('billAmount', v)} hint="Sent to the AI only as a number, if you ask it a question." />
        <div>
          <NumberField label="Effective cost per kWh" unit="PKR" step={0.5} value={household.rate} max={LIMITS.rate}
            onChange={(v) => set('rate', v ?? 0)} hint="Your own assumption, not an official tariff." />
          {billRate !== null && Math.abs(billRate - household.rate) > 0.05 && (
            <button className="mt-1.5 text-xs font-medium text-teal underline underline-offset-2" onClick={() => set('rate', Math.round(billRate * 10) / 10)}>
              Use bill ÷ units = {formatKwh(billRate, 1)}
            </button>
          )}
        </div>
      </div>

      <fieldset className="mt-6">
        <legend className="mb-2 text-sm font-medium">What matters most right now?</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => {
            const on = household.priorities.includes(p);
            return (
              <button key={p} type="button" className="chip" aria-pressed={on}
                onClick={() => set('priorities', on ? household.priorities.filter((x) => x !== p) : [...household.priorities, p])}>
                {PRIORITY_LABEL[p]}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-9">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold">Appliances</h3>
            <p className="text-sm text-muted">Use the wattage printed on each appliance label. Presets are only starting points.</p>
          </div>
          <div className="flex items-end gap-2">
            <div>
              <label htmlFor="preset" className="mb-1 block text-xs text-muted">Add from list</label>
              <select id="preset" className="field-input" value={preset} onChange={(e) => setPreset(Number(e.target.value))}>
                {PRESETS.map((p, i) => <option key={p.label} value={i}>{p.label}</option>)}
              </select>
            </div>
            <button className="btn btn-primary" onClick={addAppliance} disabled={full}><Plus size={16} aria-hidden /> Add</button>
          </div>
        </div>

        {household.appliances.length === 0 ? (
          <Notice>No appliances yet. Add one above, or reset to the demo household to explore first.</Notice>
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {household.appliances.map((a) => {
              const issues = applianceIssues(a);
              return (
                <li key={a.id} className="grid gap-3 p-4 sm:grid-cols-[1.4fr_repeat(3,minmax(0,.7fr))_auto_auto] sm:items-start">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium" htmlFor={`n-${a.id}`}>Name</label>
                    <input id={`n-${a.id}`} className="field-input" value={a.name} maxLength={40} onChange={(e) => setAppliance(a.id, { name: e.target.value })} aria-invalid={!a.name.trim() || undefined} />
                  </div>
                  <NumberField label="Watts" value={a.watts} max={LIMITS.watts} onChange={(v) => setAppliance(a.id, { watts: v ?? 0 })} />
                  <NumberField label="Quantity" value={a.quantity} max={LIMITS.quantity} onChange={(v) => setAppliance(a.id, { quantity: v ?? 0 })} />
                  <NumberField label="Hours / day" value={a.hoursPerDay} max={24} step={0.5} onChange={(v) => setAppliance(a.id, { hoursPerDay: v ?? 0 })} />
                  <div className="sm:pt-7 sm:text-right">
                    <p className="num-tabular text-lg font-bold text-mint">{formatKwh(applianceMonthlyKwh(a), 1)}</p>
                    <p className="text-xs text-muted">kWh / month</p>
                  </div>
                  <div className="sm:pt-6">
                    <button className="btn btn-quiet btn-small" aria-label={`Remove ${a.name || 'appliance'}`} onClick={() => set('appliances', household.appliances.filter((x) => x.id !== a.id))}>
                      <Trash2 size={15} aria-hidden /> <span className="sm:sr-only">Remove</span>
                    </button>
                  </div>
                  {issues.length > 0 && <p className="text-xs text-rose sm:col-span-full" role="alert">{issues.join(' ')} The calculation uses the nearest allowed value.</p>}
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted">
          Saved in this browser only. That is not a cloud account or a secure backup, and clearing site data removes it.
        </p>
      </div>
    </section>
  );
}
