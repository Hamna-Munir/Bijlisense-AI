'use client';
import dynamic from 'next/dynamic';
import { Component, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Power, Zap } from 'lucide-react';
import { EnergyFlow } from './EnergyFlow';
import type { DeviceKind } from './HouseScene';
import { Appliance, applianceMonthlyKwh, formatDuration, formatKwh } from '@/lib/energy';

const HouseScene = dynamic(() => import('./HouseScene'), {
  ssr: false,
  loading: () => <div className="shimmer h-full w-full opacity-30" aria-hidden />,
});

class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* WebGL unavailable or crashed: fall back to the 2D diagram */ }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

const KINDS: DeviceKind[] = ['ac', 'fan', 'fridge', 'other', 'light'];
const KIND_LABEL: Record<DeviceKind, string> = { ac: 'AC', fan: 'Fans', fridge: 'Fridge', other: 'TV & devices', light: 'Lights' };
/** Simulated hours that pass per real 100 ms during the power-cut demo (0.01 h = 6 min per second). */
const SIM_STEP_HOURS = 0.01;

export function HeroScene({
  appliances, modeledKwh, acShare, runtimeHours, requiredHours, backupIds, isDemo,
}: {
  appliances: Appliance[]; modeledKwh: number; acShare: number; runtimeHours: number | null; requiredHours: number; backupIds: string[]; isDemo: boolean;
}) {
  const [mode, setMode] = useState<'pending' | '3d' | '2d'>('pending');
  const [reduce, setReduce] = useState(false);
  const [outage, setOutage] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const labelEls = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    setReduce(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    setMode(hasWebGL() ? '3d' : '2d');
  }, []);

  useEffect(() => {
    if (!outage) return;
    const id = setInterval(() => setRemaining((r) => Math.max(0, r - SIM_STEP_HOURS)), 100);
    return () => clearInterval(id);
  }, [outage]);

  // If the backup setup changes mid-demo, end the demo rather than show stale numbers.
  useEffect(() => { setOutage(false); }, [runtimeHours, backupIds.join('|')]);

  const groups = useMemo(() => {
    return KINDS.map((kind) => {
      const items = appliances.filter((a) => a.kind === kind);
      const kwh = items.reduce((s, a) => s + applianceMonthlyKwh(a), 0);
      return { kind, kwh, backed: items.some((a) => backupIds.includes(a.id)) };
    }).filter((g) => g.kwh > 0);
  }, [appliances, backupIds]);

  const canSimulate = runtimeHours !== null;
  const depleted = outage && remaining <= 0;
  const baseLevel = runtimeHours === null ? null : Math.min(1, runtimeHours / Math.max(1, requiredHours || 4));
  const level = baseLevel === null ? null : outage && runtimeHours ? baseLevel * Math.min(1, remaining / runtimeHours) : baseLevel;
  const devices = groups.map((g) => ({ kind: g.kind, share: modeledKwh > 0 ? g.kwh / modeledKwh : 0, on: !outage || (g.backed && !depleted) }));
  const load = Math.min(1, Math.max(0, modeledKwh / 600));

  const spots = useRef<Record<string, { x: number; y: number; vis: boolean }>>({});
  const lineEls = useRef<Record<string, SVGLineElement | null>>({});
  /** Receives each anchor's screen position; after the last one, lays labels out without overlap and draws leader lines. */
  const project = useCallback((key: string, x: number, y: number, visible: boolean) => {
    spots.current[key] = { x, y, vis: visible };
    if (key !== 'grid') return;
    const items = Object.entries(spots.current)
      .map(([k, v]) => ({ k, ...v, el: labelEls.current[k] }))
      .filter((i): i is typeof i & { el: HTMLDivElement } => !!i.el && i.el.offsetParent !== null)
      .sort((a, b) => a.y - b.y);
    if (!items.length) return;
    const parent = items[0].el.parentElement as HTMLElement;
    const W = parent.clientWidth, H = parent.clientHeight, rowH = 32;
    const placed: { x: number; y: number; w: number }[] = [];
    for (const it of items) {
      const w = it.el.offsetWidth;
      const cx = Math.min(W - w / 2 - 8, Math.max(w / 2 + 8, it.x));
      let cy = Math.min(H - 72, Math.max(44, it.y - 46));
      for (let guard = 0; guard < 24; guard++) {
        const hit = placed.find((p) => Math.abs(p.x - cx) < (p.w + w) / 2 + 6 && Math.abs(p.y - cy) < rowH);
        if (!hit) break;
        cy = Math.min(H - 72, hit.y + rowH);
        if (cy >= H - 72) break;
      }
      placed.push({ x: cx, y: cy, w });
      it.el.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -100%)`;
      it.el.style.opacity = it.vis ? '1' : '0';
      const ln = lineEls.current[it.k];
      if (ln) {
        ln.setAttribute('x1', String(it.x)); ln.setAttribute('y1', String(it.y));
        ln.setAttribute('x2', String(cx)); ln.setAttribute('y2', String(cy));
        ln.style.opacity = it.vis && Math.hypot(it.x - cx, it.y - cy) > 14 ? '1' : '0';
      }
    }
  }, []);

  function start() { if (!canSimulate) return; setRemaining(runtimeHours ?? 0); setOutage(true); }

  const flow = <EnergyFlow appliances={appliances} runtimeHours={runtimeHours} isDemo={isDemo} />;
  if (mode === '2d') return flow;

  const labels = [
    ...groups.map((g, i) => ({
      key: g.kind, title: KIND_LABEL[g.kind],
      value: outage && !(g.backed && !depleted) ? 'No power' : `${formatKwh(g.kwh)} kWh · ${Math.round((devices[i].share) * 100)}%`,
      on: devices[i].on,
    })),
    { key: 'battery', title: 'Battery', value: runtimeHours === null ? 'No loads selected' : outage ? (depleted ? 'Empty' : `${formatDuration(remaining)} left`) : `${formatDuration(runtimeHours)} runtime`, on: !depleted },
    { key: 'grid', title: 'Grid supply', value: outage ? 'Power cut' : 'Supplying', on: !outage },
  ];

  return (
    <figure className="m-0">
      <div className="relative h-[400px] w-full overflow-hidden rounded-3xl border border-[#1B5A38] bg-[radial-gradient(ellipse_at_50%_30%,#1F7044_0%,#0F4029_52%,#0A2A1A_100%)] shadow-[0_24px_60px_-28px_rgba(10,60,32,0.7)] sm:h-[500px]">
        {mode === '3d' && (
          <Boundary fallback={flow}>
            <HouseScene devices={devices} load={load} battery={level} outage={outage} reduceMotion={reduce} onProject={project} />
          </Boundary>
        )}

        {/* labels anchored to 3D objects */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <svg className="absolute inset-0 h-full w-full" aria-hidden>
            {labels.map((l) => <line key={l.key} ref={(el) => { lineEls.current[l.key] = el; }} stroke="rgba(255,255,255,0.5)" strokeWidth="1" strokeDasharray="2 3" style={{ opacity: 0 }} />)}
          </svg>
          {labels.map((l, idx) => (
            <div key={l.key} ref={(el) => { labelEls.current[l.key] = el; }} style={{ opacity: 0 }}
              className={`absolute left-0 top-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] leading-tight shadow-md transition-colors ${idx >= 3 && idx < labels.length - 2 ? 'max-sm:hidden' : ''} ${l.on ? 'bg-white/95 text-[#0F3D26]' : 'bg-[#0A2A1A]/80 text-white/60 ring-1 ring-white/15'}`}>
              <div className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${l.on ? (l.key === 'battery' ? 'bg-amber' : 'bg-[#16A34A]') : 'bg-white/30'}`} />
                <span className="font-semibold">{l.title}</span>
                <span className={`num-tabular ${l.on ? 'text-[#4A6654]' : 'text-white/55'}`}>{l.value}</span>
              </div>
            </div>
          ))}
        </div>

        {/* power-cut control */}
        <div className="absolute inset-x-3 bottom-3 flex justify-center sm:inset-x-4 sm:bottom-4" aria-live="polite">
          {!outage ? (
            <button type="button" onClick={start} disabled={!canSimulate}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#0F3D26] shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60">
              <Power size={16} aria-hidden /> {canSimulate ? 'Simulate power cut' : 'Select backup loads to simulate'}
            </button>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-red-300/40 bg-[#3A1212]/85 px-4 py-3 text-white shadow-lg backdrop-blur-sm sm:flex-row sm:gap-4">
              <p className="text-sm">
                <strong className="font-semibold text-red-200">Grid down</strong>
                {' · '}{depleted ? 'Battery empty, everything is off' : `Battery: ${formatDuration(remaining)} left`}
              </p>
              <button type="button" onClick={() => setOutage(false)} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-[#0F3D26]">
                <Zap size={14} aria-hidden /> Restore grid
              </button>
            </div>
          )}
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-3 sm:hidden">
        <div className="rounded-xl border border-line bg-white px-3 py-2.5"><dt className="text-xs text-muted">Modeled home load</dt><dd className="font-heading text-base font-bold num-tabular">{formatKwh(modeledKwh)} kWh/mo</dd></div>
        <div className="rounded-xl border border-line bg-white px-3 py-2.5"><dt className="text-xs text-muted">Backup runtime</dt><dd className="font-heading text-base font-bold num-tabular">{formatDuration(runtimeHours)}</dd></div>
      </dl>
      <figcaption className="mt-2 text-xs text-muted">
        <span className="status-dot mr-2 inline-block h-2 w-2 rounded-full bg-mint align-middle" aria-hidden />
        {isDemo ? 'Demo household. ' : 'Modeled from your appliances. '}
        Each label shows an appliance group's modeled monthly kWh and share. Press <strong className="font-semibold text-fg">Simulate power cut</strong> to see which of your selected backup loads keep running and how long the battery lasts (accelerated: 6 minutes per second). Not a live meter reading.
      </figcaption>
    </figure>
  );
}
