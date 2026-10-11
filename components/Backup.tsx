'use client';
import { BatteryCharging, ShieldAlert } from 'lucide-react';
import { NumberField, Notice, RangeField, SectionHeader, SourceTag } from './ui';
import { Appliance, BackupConfig, BackupResult, formatDuration } from '@/lib/energy';

export function Backup({
  appliances, config, result, onChange,
}: {
  appliances: Appliance[]; config: BackupConfig; result: BackupResult; onChange: (c: BackupConfig) => void;
}) {
  const set = <K extends keyof BackupConfig>(k: K, v: BackupConfig[K]) => onChange({ ...config, [k]: v });
  const toggle = (id: string) => set('selectedIds', config.selectedIds.includes(id) ? config.selectedIds.filter((x) => x !== id) : [...config.selectedIds, id]);
  const pct = result.runtimeHours !== null && config.requiredHours > 0 ? Math.min(100, (result.runtimeHours / config.requiredHours) * 100) : 0;

  return (
    <section aria-labelledby="backup" className="border-t border-line py-14">
      <SectionHeader id="backup" title="Plan your backup for a power cut" lead="Pick the loads you want to keep running, describe your battery, and see if it lasts as long as you need." />
      <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-6">
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Loads to keep running</legend>
            {appliances.length === 0 ? <Notice>Add appliances in Setup first.</Notice> : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {appliances.map((a) => {
                  const w = Math.max(0, a.watts) * Math.max(0, a.quantity);
                  return (
                    <li key={a.id}>
                      <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-line px-3 py-2 hover:border-teal/60">
                        <input type="checkbox" checked={config.selectedIds.includes(a.id)} onChange={() => toggle(a.id)} />
                        <span className="flex-1 text-sm">{a.name}</span>
                        <span className="num-tabular text-sm text-muted">{Math.round(w)} W</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">Battery capacity</legend>
            <div className="mb-3 flex gap-2" role="group" aria-label="Capacity input method">
              <button type="button" className="chip" aria-pressed={config.mode === 'wh'} onClick={() => set('mode', 'wh')}>Watt-hours (Wh)</button>
              <button type="button" className="chip" aria-pressed={config.mode === 'vah'} onClick={() => set('mode', 'vah')}>Volts × amp-hours</button>
            </div>
            {config.mode === 'wh' ? (
              <NumberField label="Battery capacity" unit="Wh" value={config.wh} max={200000} step={100} onChange={(v) => set('wh', v ?? 0)} />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="Battery voltage" unit="V" value={config.volts} max={1000} step={1} onChange={(v) => set('volts', v ?? 0)} />
                <NumberField label="Capacity" unit="Ah" value={config.ah} max={5000} step={5} onChange={(v) => set('ah', v ?? 0)} />
                <p className="col-span-2 text-xs text-muted">Wh = V × Ah, so {config.volts} V × {config.ah} Ah = {Math.round(result.nominalWh).toLocaleString()} Wh. For batteries wired together, enter the combined bank voltage and total Ah.</p>
              </div>
            )}
          </fieldset>

          <div className="grid gap-5 sm:grid-cols-2">
            <RangeField label="Usable battery capacity" min={30} max={100} step={5} value={Math.round(config.usableFraction * 100)} onChange={(v) => set('usableFraction', v / 100)} display={`${Math.round(config.usableFraction * 100)}%`} caption="Lead-acid is often discharged less deeply to protect its life." />
            <RangeField label="Inverter efficiency" min={60} max={98} step={1} value={Math.round(config.inverterEfficiency * 100)} onChange={(v) => set('inverterEfficiency', v / 100)} display={`${Math.round(config.inverterEfficiency * 100)}%`} caption="Check your inverter's datasheet." />
          </div>
          <NumberField label="Backup duration you need" unit="hours" value={config.requiredHours} max={72} step={0.5} onChange={(v) => set('requiredHours', v ?? 0)} />
        </div>

        <div>
          <div className="rounded-2xl border border-line bg-surface p-5">
            <div className="flex items-center justify-between gap-2 text-sm text-muted">
              <span className="inline-flex items-center gap-2"><BatteryCharging size={16} className="text-mint" aria-hidden /> Estimated runtime</span>
              <SourceTag kind="calc" label="Estimate" />
            </div>
            <div className="mt-2 font-heading text-4xl font-extrabold text-mint num-tabular" aria-live="polite">{formatDuration(result.runtimeHours)}</div>
            {result.runtimeHours === null ? (
              <p className="mt-2 text-sm text-amber">Select at least one load with a wattage above zero.</p>
            ) : (
              <>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-line" role="presentation"><div className="bar-fill h-full rounded-full bg-gradient-to-r from-[#4CC38A] to-[#15803D]" style={{ width: `${pct}%` }} /></div>
                <p className={`mt-3 text-sm font-medium ${result.feasible === false ? 'text-amber' : 'text-mint'}`}>
                  {result.feasible === null ? 'Set a required duration to check feasibility.'
                    : result.feasible ? `Meets your ${config.requiredHours} h target under these assumptions.`
                    : `Falls short by about ${formatDuration(result.shortfallHours)}. You would need roughly ${Math.round(result.requiredNominalWh ?? 0).toLocaleString()} Wh of battery.`}
                </p>
              </>
            )}
            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
              <div><dt className="text-muted">Selected load</dt><dd className="num-tabular font-semibold">{Math.round(result.totalLoadWatts).toLocaleString()} W</dd></div>
              <div><dt className="text-muted">Deliverable energy</dt><dd className="num-tabular font-semibold">{Math.round(result.deliverableWh).toLocaleString()} Wh</dd></div>
            </dl>
            <p className="mt-3 text-xs text-muted">Runtime = battery Wh × usable % × inverter efficiency ÷ total load W.</p>
          </div>

          {result.loads.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-medium">What drains the battery</h3>
              <ul className="space-y-2.5">
                {result.loads.map((l) => (
                  <li key={l.id}>
                    <div className="mb-1 flex justify-between text-sm"><span>{l.name}</span><span className="num-tabular text-muted">{Math.round(l.watts)} W · {Math.round(l.share * 100)}%</span></div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-line" role="presentation"><div className="bar-fill h-full rounded-full bg-[#22A559]" style={{ width: `${l.share * 100}%` }} /></div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 flex gap-3 rounded-xl border border-line p-4 text-sm text-muted">
            <ShieldAlert size={18} className="mt-0.5 shrink-0 text-amber" aria-hidden />
            <p>A planning estimate, not a safety check. Real runtime depends on battery age and chemistry, inverter limits, startup surges (fridges and AC draw more when they start), and discharge limits. Use correctly rated equipment and a qualified installer. Never bypass breakers or meters.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
