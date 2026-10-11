'use client';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Notice, RangeField, SectionHeader, SourceTag } from './ui';
import { Appliance, ScenarioHours, ScenarioResult, formatKwh, formatPKR } from '@/lib/energy';

const tooltipStyle = { background: '#fff', border: '1px solid #C2D6BC', borderRadius: 10, color: '#12261A', fontSize: 13 };

export function Simulator({
  appliances, scenario, result, onChange,
}: {
  appliances: Appliance[]; scenario: ScenarioHours; result: ScenarioResult; onChange: (s: ScenarioHours) => void;
}) {
  const sorted = [...result.rows].sort((a, b) => b.baselineKwh - a.baselineKwh).filter((r) => appliances.some((a) => a.id === r.id));
  const main = sorted.slice(0, 4);
  const more = sorted.slice(4);
  const acCut = result.rows.some((r) => r.kind === 'ac' && r.scenarioHours < r.baselineHours);
  const set = (id: string, v: number) => onChange({ ...scenario, [id]: v });

  const slider = (r: (typeof sorted)[number]) => {
    const delta = r.scenarioHours - r.baselineHours;
    return (
      <RangeField key={r.id} label={r.name} min={0} max={24} step={0.5} value={r.scenarioHours} onChange={(v) => set(r.id, v)}
        display={`${r.scenarioHours} h/day`}
        caption={delta === 0 ? `Current: ${r.baselineHours} h/day` : `Current ${r.baselineHours} h/day · ${delta < 0 ? '−' : '+'}${Math.abs(delta)} h`} />
    );
  };

  const chart = result.rows.map((r) => ({ name: r.name.length > 12 ? r.name.slice(0, 11) + '…' : r.name, Current: Math.round(r.baselineKwh * 10) / 10, Scenario: Math.round(r.scenarioKwh * 10) / 10 }));
  const better = result.differenceKwh > 0;

  return (
    <section aria-labelledby="simulator" className="border-t border-line py-14">
      <SectionHeader id="simulator" title="Test a change before you make it" lead="Move a slider to change daily hours. Results use the same calculation engine as the dashboard."
        aside={<div className="flex gap-2"><button className="btn btn-quiet btn-small" onClick={() => { const ac = appliances.find((a) => a.kind === 'ac'); if (ac) set(ac.id, Math.max(0, ac.hoursPerDay - 1)); }}>AC 1 h less</button><button className="btn btn-quiet btn-small" onClick={() => onChange({})}>Back to current</button></div>} />
      <div className="grid gap-10 lg:grid-cols-[1fr_1.05fr]">
        <div className="space-y-5">
          {appliances.length === 0 ? <Notice>Add appliances in Setup to run scenarios.</Notice> : (
            <>
              {main.map(slider)}
              {more.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-sm font-medium text-teal">{more.length} more appliance{more.length > 1 ? 's' : ''}</summary>
                  <div className="mt-4 space-y-5">{more.map(slider)}</div>
                </details>
              )}
            </>
          )}
          {acCut && (
            <Notice tone="warn">
              Cutting AC time is a what-if, not a recommendation. In extreme heat it can be unsafe, especially for infants, older people and anyone with a medical condition. Pre-cooling, a higher setpoint, or shading may fit better than running it less.
            </Notice>
          )}
        </div>

        <div>
          <div className="mb-4 rounded-2xl border border-line bg-surface p-5">
            <div className="flex items-center justify-between gap-2 text-sm text-muted">
              <span>{!result.changed ? 'Your scenario matches today' : better ? 'Estimated monthly difference (lower)' : 'Estimated monthly difference (higher)'}</span>
              <SourceTag kind="calc" label="Estimate" />
            </div>
            <div className={`mt-2 font-heading text-4xl font-extrabold num-tabular ${better ? 'text-mint' : result.changed ? 'text-amber' : ''}`} aria-live="polite">
              {result.changed ? `${better ? '−' : '+'}${formatPKR(Math.abs(result.differenceCost))}` : formatPKR(0)}
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4 text-sm">
              <div><dt className="text-muted">Current</dt><dd className="num-tabular font-semibold">{formatKwh(result.baselineKwh)} kWh</dd></div>
              <div><dt className="text-muted">Scenario</dt><dd className="num-tabular font-semibold">{formatKwh(result.scenarioKwh)} kWh</dd></div>
              <div><dt className="text-muted">Units</dt><dd className="num-tabular font-semibold">{result.changed ? `${better ? '−' : '+'}${formatKwh(Math.abs(result.differenceKwh), 1)}` : '0'} kWh</dd></div>
            </dl>
            <p className="mt-3 text-xs text-muted">Energy-only estimate at your chosen rate. Real bills include taxes, fixed charges and slabs, and real usage varies with weather and habits.</p>
          </div>
          <div className="h-60 w-full" role="img" aria-label="Grouped bar chart comparing current and scenario kilowatt-hours for each appliance.">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="#DCE9D7" strokeDasharray="3 6" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#566B5C', fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
                <YAxis tick={{ fill: '#566B5C', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(34,165,89,.08)' }} formatter={(v: number) => `${v} kWh`} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#566B5C' }} />
                <Bar dataKey="Current" fill="#B8CDB2" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Scenario" fill="#15803D" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  );
}
