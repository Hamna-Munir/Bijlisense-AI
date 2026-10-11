'use client';
import { ReactNode, useEffect, useId, useRef, useState } from 'react';

export type SourceKind = 'demo' | 'input' | 'calc' | 'ai';

const TAGS: Record<SourceKind, { label: string; cls: string }> = {
  demo: { label: 'Demo data', cls: 'border-amber/40 bg-amber/10 text-amber' },
  input: { label: 'Your input', cls: 'border-teal/40 bg-teal/10 text-teal' },
  calc: { label: 'Calculated', cls: 'border-line text-muted' },
  ai: { label: 'AI-generated', cls: 'border-mint/40 bg-mint/10 text-mint' },
};

export function SourceTag({ kind, label }: { kind: SourceKind; label?: string }) {
  const t = TAGS[kind];
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${t.cls}`}>{label ?? t.label}</span>;
}

export function SectionHeader({ id, title, lead, aside }: { id: string; title: string; lead: string; aside?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-xl">
        <h2 id={id} className="text-2xl font-bold sm:text-3xl">{title}</h2>
        <p className="mt-2 text-muted">{lead}</p>
      </div>
      {aside}
    </div>
  );
}

export function NumberField({
  label, value, onChange, min = 0, max, step = 1, unit, hint, error, optional,
}: {
  label: string; value: number | null; onChange: (v: number | null) => void;
  min?: number; max?: number; step?: number; unit?: string; hint?: string; error?: string; optional?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 flex items-baseline justify-between gap-2 text-sm font-medium text-fg">
        <span>{label}{optional && <span className="ml-1 font-normal text-muted">(optional)</span>}</span>
        {unit && <span className="text-xs font-normal text-muted">{unit}</span>}
      </label>
      <input
        id={id}
        className="field-input num-tabular"
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={value ?? ''}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-d` : undefined}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') return onChange(optional ? null : 0);
          const n = Number(raw);
          onChange(Number.isFinite(n) ? n : optional ? null : 0);
        }}
      />
      {(error || hint) && (
        <p id={`${id}-d`} className={`mt-1 text-xs ${error ? 'text-rose' : 'text-muted'}`}>{error || hint}</p>
      )}
    </div>
  );
}

export function RangeField({
  label, value, onChange, min, max, step, display, caption,
}: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number; display: string; caption?: string;
}) {
  const id = useId();
  const fill = `${((value - min) / (max - min)) * 100}%`;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium">{label}</label>
        <span className="font-heading text-base font-bold num-tabular text-mint">{display}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} style={{ ['--fill' as string]: fill }} onChange={(e) => onChange(Number(e.target.value))} />
      {caption && <p className="-mt-1 text-xs text-muted">{caption}</p>}
    </div>
  );
}

/** Counts smoothly to a new value (skipped when the user prefers reduced motion). */
export function AnimatedNumber({ value, format }: { value: number; format: (n: number) => string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(value); from.current = value; return; }
    const start = from.current, t0 = performance.now(), dur = 600;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      const cur = start + (value - start) * eased;
      setShown(cur); from.current = cur;
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{format(shown)}</>;
}

export function Stat({ label, value, unit, foot, tag, accent, num }: { label: string; value: string; unit?: string; foot?: string; tag: ReactNode; accent?: boolean; num?: { v: number; f: (n: number) => string } }) {
  return (
    <div className="px-0 py-4 sm:px-6 sm:first:pl-0 sm:last:pr-0">
      <div className="flex items-center justify-between gap-2 text-sm text-muted"><span>{label}</span>{tag}</div>
      <div className={`mt-2 font-heading text-3xl font-bold num-tabular sm:text-4xl ${accent ? 'text-mint' : ''}`}>
        {num ? <AnimatedNumber value={num.v} format={num.f} /> : value}{unit && <span className="ml-1.5 text-base font-medium text-muted">{unit}</span>}
      </div>
      {foot && <p className="mt-1 text-sm text-muted">{foot}</p>}
    </div>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'error'; children: ReactNode }) {
  const cls = tone === 'error' ? 'border-rose/40 bg-rose/10 text-rose' : tone === 'warn' ? 'border-amber/35 bg-amber/10 text-amber' : 'border-line bg-surface2 text-muted';
  return <div role={tone === 'error' ? 'alert' : undefined} className={`rounded-xl border px-4 py-3 text-sm ${cls}`}>{children}</div>;
}
