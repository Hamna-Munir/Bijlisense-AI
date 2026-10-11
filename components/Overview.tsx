'use client';
import { ArrowRight, BatteryCharging, Sparkles, SlidersHorizontal } from 'lucide-react';
import { HeroScene } from './HeroScene';
import { SourceTag, Stat } from './ui';
import { Appliance, ScenarioResult, formatKwh, formatPKR } from '@/lib/energy';

export function Overview({
  appliances, modeledKwh, cost, rate, scenario, runtimeHours, requiredHours, acShare, backupIds, isDemo, onAnalyze,
}: {
  appliances: Appliance[]; modeledKwh: number; cost: number; rate: number; scenario: ScenarioResult;
  runtimeHours: number | null; requiredHours: number; acShare: number; backupIds: string[]; isDemo: boolean; onAnalyze: () => void;
}) {
  const diffLabel = !scenario.changed ? 'No scenario set' : scenario.differenceCost >= 0 ? 'Lower under your scenario' : 'Higher under your scenario';
  return (
    <section aria-labelledby="overview" className="pt-10 pb-12 sm:pt-16">
      <div className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-sm text-muted">
            <span className="status-dot h-2 w-2 rounded-full bg-mint" aria-hidden />
            For households facing high bills and load-shedding
          </p>
          <h1 id="overview" className="text-4xl font-extrabold leading-[1.05] sm:text-6xl">
            Understand your bill.<br />Outsmart <span className="whitespace-nowrap">load-shedding.</span>
          </h1>
          <p className="mt-5 max-w-lg text-lg text-muted">
            List your appliances, see where the units go, test a change before you make it, and check whether your battery gets you through a power cut.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button className="btn btn-primary" onClick={onAnalyze}><Sparkles size={17} aria-hidden /> Analyze my household</button>
            <a className="btn btn-quiet" href="#simulator"><SlidersHorizontal size={17} aria-hidden /> Run a scenario</a>
            <a className="btn btn-quiet" href="#backup"><BatteryCharging size={17} aria-hidden /> Plan my backup</a>
          </div>
          <p className="mt-4 flex items-center gap-2 text-sm text-muted">
            <ArrowRight size={14} aria-hidden />
            {isDemo ? 'You are looking at a demo household. Edit it in Setup to use your own numbers.' : 'Showing your household. Numbers are modeled estimates.'}
          </p>
        </div>
        <HeroScene appliances={appliances} modeledKwh={modeledKwh} acShare={acShare} runtimeHours={runtimeHours} requiredHours={requiredHours} backupIds={backupIds} isDemo={isDemo} />
      </div>

      <div className="mt-12 grid divide-y divide-line border-y border-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Stat
          label="Modeled monthly energy" value={formatKwh(modeledKwh)} num={{ v: modeledKwh, f: (n) => formatKwh(n) }} unit="kWh"
          foot="Sum of watts × quantity × hours × 30 ÷ 1000" tag={<SourceTag kind={isDemo ? 'demo' : 'calc'} label={isDemo ? 'Demo data' : 'Modeled'} />}
        />
        <Stat
          label="Energy-only cost" value={formatPKR(cost)} num={{ v: cost, f: formatPKR }}
          foot={`At PKR ${formatKwh(rate, 1)}/kWh. Excludes taxes, fixed charges and slabs.`} tag={<SourceTag kind={isDemo ? 'demo' : 'input'} label={isDemo ? 'Demo rate' : 'Your rate'} />}
        />
        <Stat
          label="Scenario difference" value={scenario.changed ? formatPKR(Math.abs(scenario.differenceCost)) : '—'} unit={scenario.changed ? '/ month' : undefined} accent={scenario.changed && scenario.differenceCost > 0}
          foot={`${diffLabel}${scenario.changed ? ` · ${formatKwh(Math.abs(scenario.differenceKwh), 1)} kWh` : ''}. An estimate, not a guarantee.`} tag={<SourceTag kind="calc" label="Estimate" />}
        />
      </div>
    </section>
  );
}
