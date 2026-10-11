'use client';
import { Appliance, applianceMonthlyKwh, formatKwh } from '@/lib/energy';

/**
 * Household energy-flow diagram. Line thickness follows each appliance's share of
 * modeled monthly kWh. Pure SVG + CSS: no 3D runtime, cheap on low-end phones.
 */
export function EnergyFlow({ appliances, runtimeHours, isDemo }: { appliances: Appliance[]; runtimeHours: number | null; isDemo: boolean }) {
  const rows = appliances.map((a) => ({ name: a.name, kwh: applianceMonthlyKwh(a) })).filter((r) => r.kwh > 0).sort((a, b) => b.kwh - a.kwh);
  const top = rows.slice(0, 5);
  const rest = rows.slice(5).reduce((s, r) => s + r.kwh, 0);
  if (rest > 0) top.push({ name: 'Everything else', kwh: rest });
  const total = rows.reduce((s, r) => s + r.kwh, 0);

  const W = 560, H = 340, homeX = 232, homeY = H / 2;
  const slot = (i: number, n: number) => (n === 1 ? H / 2 : 36 + (i * (H - 72)) / (n - 1));
  const summary = total > 0
    ? `Energy flow from the grid into the home, then to appliances. ${top.map((r) => `${r.name} ${formatKwh(r.kwh)} kWh`).join(', ')}.`
    : 'No appliance usage entered yet.';

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} className="h-auto w-full">
        <defs>
          <linearGradient id="flowGrad" x1="0" x2="1">
            <stop offset="0" stopColor="#0E9F8E" />
            <stop offset="1" stopColor="#15803D" />
          </linearGradient>
        </defs>

        {/* grid -> home */}
        <path d={`M 56 ${homeY} L ${homeX - 34} ${homeY}`} stroke="#D3E2CE" strokeWidth="6" strokeLinecap="round" fill="none" />
        <path d={`M 56 ${homeY} L ${homeX - 34} ${homeY}`} stroke="url(#flowGrad)" strokeWidth="2.5" strokeLinecap="round" fill="none" className="flow-line" />
        <circle cx="42" cy={homeY} r="14" fill="#FFFFFF" stroke="#B5CBAE" />
        <path d={`M 44 ${homeY - 8} L 38 ${homeY + 1} L 42 ${homeY + 1} L 40 ${homeY + 8} L 47 ${homeY - 2} L 43 ${homeY - 2} Z`} fill="#15803D" />
        <text x="42" y={homeY + 32} textAnchor="middle" fill="#566B5C" fontSize="12">Grid</text>

        {/* home */}
        <rect x={homeX - 34} y={homeY - 34} width="68" height="68" rx="18" fill="#EAF3E6" stroke="#9FBCA6" />
        <path d={`M ${homeX - 16} ${homeY + 4} L ${homeX} ${homeY - 14} L ${homeX + 16} ${homeY + 4} M ${homeX - 11} ${homeY} L ${homeX - 11} ${homeY + 16} L ${homeX + 11} ${homeY + 16} L ${homeX + 11} ${homeY}`} fill="none" stroke="#12261A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <text x={homeX} y={homeY + 54} textAnchor="middle" fill="#566B5C" fontSize="12">Your home</text>

        {/* home -> appliances */}
        {top.map((r, i) => {
          const y = slot(i, top.length);
          const share = total > 0 ? r.kwh / total : 0;
          const w = 1.5 + share * 11;
          const d = `M ${homeX + 34} ${homeY} C ${homeX + 110} ${homeY}, ${homeX + 110} ${y}, 392 ${y}`;
          return (
            <g key={r.name}>
              <path d={d} stroke="#D3E2CE" strokeWidth={w + 3} fill="none" strokeLinecap="round" className="flow-base" style={{ ['--len' as string]: 420, animationDelay: `${i * 90}ms` }} />
              <path d={d} stroke="url(#flowGrad)" strokeWidth={Math.max(1.5, w * 0.45)} fill="none" strokeLinecap="round" className="flow-line" opacity="0.9" />
              <circle cx="398" cy={y} r="4" fill="#15803D" />
              <text x="412" y={y - 3} fill="#12261A" fontSize="14.5" fontWeight="600">{r.name.length > 16 ? r.name.slice(0, 15) + '…' : r.name}</text>
              <text x="412" y={y + 14} fill="#566B5C" fontSize="13">{formatKwh(r.kwh)} kWh · {Math.round(share * 100)}%</text>
            </g>
          );
        })}

        {/* backup indicator */}
        <g transform={`translate(${homeX - 22}, ${H - 34})`}>
          <rect width="44" height="20" rx="5" fill="none" stroke="#B5CBAE" />
          <rect x="3" y="3" width={runtimeHours === null ? 6 : Math.min(38, 6 + (runtimeHours / 8) * 32)} height="14" rx="3" fill="#0E9F8E" opacity="0.85" />
          <rect x="44" y="6" width="3" height="8" rx="1" fill="#B5CBAE" />
        </g>
        <text x={homeX} y={H - 2} textAnchor="middle" fill="#566B5C" fontSize="11">{runtimeHours === null ? 'Backup: select loads' : `Backup ≈ ${runtimeHours.toFixed(1)} h`}</text>

        {total === 0 && <text x={W / 2} y={H / 2 - 60} textAnchor="middle" fill="#566B5C" fontSize="14">Add appliances to see energy flow</text>}
      </svg>
      <figcaption className="mt-1 flex items-center gap-2 text-xs text-muted">
        <span className="status-dot inline-block h-2 w-2 rounded-full bg-mint" aria-hidden />
        {isDemo ? 'Illustrative flow from the demo household.' : 'Flow modeled from your appliance list. Not a live meter reading.'}
      </figcaption>
    </figure>
  );
}
