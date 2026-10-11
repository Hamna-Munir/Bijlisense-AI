'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Zap } from 'lucide-react';
import { Overview } from '@/components/Overview';
import { Setup } from '@/components/Setup';
import { Breakdown } from '@/components/Breakdown';
import { Simulator } from '@/components/Simulator';
import { Backup } from '@/components/Backup';
import { Plan } from '@/components/Plan';
import { Agent, AgentHandle } from '@/components/Agent';
import { AppState, STORAGE_KEY, demoState } from '@/lib/demo';
import { buildActions } from '@/lib/actions';
import { applianceMonthlyKwh, computeBackup, computeScenario, estimateEnergyCost, totalMonthlyKwh } from '@/lib/energy';

const NAV = [['Overview', '#overview'], ['Setup', '#setup'], ['Usage', '#usage'], ['Simulator', '#simulator'], ['Backup', '#backup'], ['Plan', '#plan'], ['AI agent', '#agent']] as const;

/** Only accept saved state that has the shape we expect; anything else falls back to the demo. */
function loadSaved(): AppState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as AppState;
    if (!s?.household?.appliances || !Array.isArray(s.household.appliances) || !s.backup || !Array.isArray(s.readings) || s.readings.length !== 6) return null;
    return { ...demoState(), ...s, scenario: s.scenario ?? {} };
  } catch { return null; }
}

export default function Home() {
  const [state, setState] = useState<AppState>(demoState);
  const [hydrated, setHydrated] = useState(false);
  const agent = useRef<AgentHandle>(null);

  useEffect(() => { const saved = loadSaved(); if (saved) setState(saved); setHydrated(true); }, []);
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* storage unavailable: keep working in memory */ }
  }, [state, hydrated]);

  const { household } = state;
  const modeledKwh = useMemo(() => totalMonthlyKwh(household.appliances), [household.appliances]);
  const acShare = useMemo(() => { const ac = household.appliances.filter((a) => a.kind === 'ac').reduce((s, a) => s + applianceMonthlyKwh(a), 0); return modeledKwh > 0 ? ac / modeledKwh : 0; }, [household.appliances, modeledKwh]);
  const cost = useMemo(() => estimateEnergyCost(modeledKwh, household.rate), [modeledKwh, household.rate]);
  const scenario = useMemo(() => computeScenario(household.appliances, state.scenario, household.rate), [household.appliances, state.scenario, household.rate]);
  const backup = useMemo(() => computeBackup(state.backup, household.appliances), [state.backup, household.appliances]);
  const actions = useMemo(() => buildActions(household.appliances, household.rate, { backup, priorities: household.priorities }), [household.appliances, household.rate, backup, household.priorities]);

  // Any edit makes this the user's household, not the demo.
  const edit = (patch: Partial<AppState>) => setState((s) => ({ ...s, isDemo: false, ...patch }));

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-ink/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <a href="#overview" className="flex items-center gap-2 font-heading text-lg font-extrabold tracking-tight">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-mint text-white"><Zap size={16} fill="currentColor" aria-hidden /></span>
            BijliSense
          </a>
          <nav aria-label="Sections" className="-mx-1 flex flex-1 gap-1 overflow-x-auto text-sm">
            {NAV.map(([label, href]) => <a key={href} href={href} className="whitespace-nowrap rounded-lg px-3 py-2 text-muted hover:bg-surface2 hover:text-fg">{label}</a>)}
          </nav>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-6xl px-4 sm:px-6">
        <Overview appliances={household.appliances} modeledKwh={modeledKwh} cost={cost} rate={household.rate} scenario={scenario}
          runtimeHours={backup.runtimeHours} requiredHours={state.backup.requiredHours} acShare={acShare} backupIds={state.backup.selectedIds} isDemo={state.isDemo} onAnalyze={() => agent.current?.analyze()} />
        <Setup household={household} isDemo={state.isDemo}
          onChange={(h) => edit({ household: h })}
          onResetDemo={() => setState(demoState())}
          onClearAll={() => setState({ ...demoState(), isDemo: false, scenario: {}, readingsAreUserEntered: false, household: { ...demoState().household, billedUnits: null, billAmount: null, appliances: [] }, backup: { ...demoState().backup, selectedIds: [] } })} />
        <Breakdown appliances={household.appliances} modeledKwh={modeledKwh} billedUnits={household.billedUnits} readings={state.readings}
          readingsUserEntered={state.readingsAreUserEntered} isDemo={state.isDemo}
          onReading={(i, v) => edit({ readings: state.readings.map((r, j) => (j === i ? v : r)), readingsAreUserEntered: true })} />
        <Simulator appliances={household.appliances} scenario={state.scenario} result={scenario} onChange={(s) => setState((st) => ({ ...st, scenario: s }))} />
        <Backup appliances={household.appliances} config={state.backup} result={backup} onChange={(c) => setState((st) => ({ ...st, backup: c }))} />
        <Plan actions={actions} />
        <Agent ref={agent} state={state} actions={actions} modeledKwh={modeledKwh} cost={cost} />
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-8 text-xs text-muted sm:px-6">
          <span className="flex items-center gap-2 font-semibold text-fg"><Zap size={14} className="text-mint" aria-hidden /> BijliSense AI</span>
          <span>Not connected to a smart meter or utility account. All figures are estimates from the inputs you provide.</span>
          <span>AI advice is informational, not a bill, a tariff quote or an electrical inspection.</span>
        </div>
      </footer>
    </>
  );
}
