'use client';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Notice, SectionHeader, SourceTag } from './ui';
import { Appliance, applianceMonthlyKwh, formatKwh, reconcile } from '@/lib/energy';

const MONTHS = ['5 months ago', '4 months ago', '3 months ago', '2 months ago', 'Last month', 'This month'];
const PALETTE = ['#15803D', '#22A559', '#4CC38A', '#0E9F8E', '#7FD8B5', '#B8E3C9', '#F2B84B', '#D98A2B'];
const tooltipStyle = { background: '#fff', border: '1px solid #C2D6BC', borderRadius: 10, color: '#12261A', fontSize: 13 };

export function Breakdown({
  appliances, modeledKwh, billedUnits, readings, readingsUserEntered, isDemo, onReading,
}: {
  appliances: Appliance[]; modeledKwh: number; billedUnits: number | null; readings: number[]; readingsUserEntered: boolean; isDemo: boolean;
  onReading: (i: number, v: number) => void;
}) {
  const rows = appliances.map((a) => ({ name: a.name, kwh: applianceMonthlyKwh(a) })).sort((a, b) => b.kwh - a.kwh);
  const rec = reconcile(modeledKwh, billedUnits);
  const data = readings.map((units, i) => ({ month: MONTHS[i], units }));

  return (
    <section aria-labelledby="usage" className="border-t border-line py-14">
      <SectionHeader id="usage" title="Where the units go" lead="Appliance contribution from your inputs, set against your own monthly readings." />
      <div className="grid gap-10 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-lg font-bold">Appliance share</h3>
            <SourceTag kind="calc" label="Modeled" />
          </div>
          {rows.length === 0 ? <Notice>Add appliances in Setup to see the breakdown.</Notice> : (
            <>
            <div className="relative mx-auto mb-5 h-48 w-48" role="img" aria-label={`Donut chart of appliance share. Total ${formatKwh(modeledKwh)} kWh per month.`}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={rows} dataKey="kwh" nameKey="name" innerRadius={58} outerRadius={86} paddingAngle={2} stroke="none" isAnimationActive>
                    {rows.map((r, i) => <Cell key={r.name + i} fill={PALETTE[i % PALETTE.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n: string) => [`${formatKwh(v, 1)} kWh`, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                <div><div className="font-heading text-2xl font-extrabold num-tabular">{formatKwh(modeledKwh)}</div><div className="text-xs text-muted">kWh / month</div></div>
              </div>
            </div>
            <ul className="space-y-3.5">
              {rows.map((r) => {
                const pct = modeledKwh > 0 ? (r.kwh / modeledKwh) * 100 : 0;
                return (
                  <li key={r.name + r.kwh}>
                    <div className="mb-1 flex justify-between gap-3 text-sm">
                      <span>{r.name}</span>
                      <span className="num-tabular text-muted"><strong className="font-semibold text-fg">{formatKwh(r.kwh, 1)}</strong> kWh · {Math.round(pct)}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-line" role="presentation">
                      <div className="bar-fill h-full rounded-full" style={{ width: `${pct}%`, background: PALETTE[rows.indexOf(r) % PALETTE.length] }} />
                    </div>
                  </li>
                );
              })}
            </ul>
            </>
          )}

          <div className="mt-6">
            {rec.status === 'no-bill' && <Notice>Enter the units from your last bill in Setup to see how closely this model matches reality.</Notice>}
            {rec.status === 'close' && <Notice>Modeled units ({formatKwh(modeledKwh)}) are within 10% of your billed units ({formatKwh(billedUnits ?? 0)}).</Notice>}
            {(rec.status === 'modeled-lower' || rec.status === 'modeled-higher') && (
              <Notice tone="warn">
                Modeled {formatKwh(modeledKwh)} kWh vs billed {formatKwh(billedUnits ?? 0)} kWh: a gap of {formatKwh(Math.abs(rec.differenceKwh))} kWh ({Math.abs(Math.round(rec.differencePct))}%).{' '}
                {rec.status === 'modeled-lower'
                  ? 'You may be missing appliances, or some hours are higher than entered. We do not add the gap into the appliance totals.'
                  : 'Some hours or wattages may be overstated, or the bill period was shorter than 30 days.'}
              </Notice>
            )}
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <h3 className="text-lg font-bold">Monthly units</h3>
            <SourceTag kind={readingsUserEntered ? 'input' : 'demo'} label={readingsUserEntered ? 'Your readings' : 'Illustrative'} />
          </div>
          <p className="mb-3 text-sm text-muted">
            {readingsUserEntered || !isDemo ? 'Readings you entered below.' : 'Sample values, not from a meter. Replace them with units from your own bills.'} Dashed line: modeled monthly kWh.
          </p>
          <div className="h-56 w-full" role="img" aria-label={`Bar chart of six monthly unit readings. Modeled usage is ${formatKwh(modeledKwh)} kWh.`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="#DCE9D7" strokeDasharray="3 6" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#566B5C', fontSize: 11 }} axisLine={false} tickLine={false} interval={0} tickFormatter={(v: string) => (v === 'This month' ? 'Now' : v === 'Last month' ? '−1' : '−' + v[0])} />
                <YAxis tick={{ fill: '#566B5C', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(34,165,89,.08)' }} formatter={(v: number) => [`${v} kWh`, 'Units']} />
                {modeledKwh > 0 && <ReferenceLine y={Math.round(modeledKwh)} stroke="#B45309" strokeDasharray="5 5" />}
                <Bar dataKey="units" fill="#22A559" radius={[5, 5, 0, 0]} isAnimationActive />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium text-teal">Enter your own monthly units</summary>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {readings.map((v, i) => (
                <div key={i}>
                  <label htmlFor={`r${i}`} className="mb-1 block text-xs text-muted">{MONTHS[i]}</label>
                  <input id={`r${i}`} className="field-input num-tabular" type="number" min={0} max={20000} inputMode="numeric" value={v}
                    onChange={(e) => onReading(i, Math.min(20000, Math.max(0, Number(e.target.value) || 0)))} />
                </div>
              ))}
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}
