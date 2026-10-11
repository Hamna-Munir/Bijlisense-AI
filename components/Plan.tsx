'use client';
import { Notice, SectionHeader, SourceTag } from './ui';
import { ActionItem } from '@/lib/actions';
import { formatKwh, formatPKR } from '@/lib/energy';

const LEVEL = ['', 'Low', 'Medium', 'High'];

function Row({ a, rank }: { a: ActionItem; rank: number }) {
  return (
    <li className="grid gap-3 py-5 sm:grid-cols-[2rem_1fr_auto]">
      <span className="font-heading text-lg font-bold text-muted num-tabular" aria-hidden>{rank}</span>
      <div>
        <h4 className="font-heading text-base font-bold">{a.title}</h4>
        <p className="mt-1 text-sm text-muted">{a.detail}</p>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span>Effort: {LEVEL[a.effort]}</span>
          <span>Comfort cost: {LEVEL[a.comfortCost]}</span>
          <span>Confidence: {a.confidence}</span>
        </p>
        {a.assumption && <p className="mt-1 text-xs text-amber">Assumption: {a.assumption}</p>}
      </div>
      <div className="sm:text-right">
        {a.savingsPKR !== null && a.savingsKwh !== null ? (
          <>
            <p className="font-heading text-xl font-bold text-mint num-tabular">{formatPKR(a.savingsPKR)}</p>
            <p className="text-xs text-muted">≈ {formatKwh(a.savingsKwh, 1)} kWh / month, estimated</p>
          </>
        ) : <p className="text-sm text-muted">Resilience, not bill savings</p>}
      </div>
    </li>
  );
}

export function Plan({ actions }: { actions: ActionItem[] }) {
  const free = actions.filter((a) => a.type === 'free');
  const buy = actions.filter((a) => a.type === 'purchase');
  let n = 0;
  return (
    <section aria-labelledby="plan" className="border-t border-line py-14">
      <SectionHeader id="plan" title="Your action plan" lead="Ranked from your own numbers. Nothing here controls an appliance or optimizes the grid; it is a prioritized to-do list."
        aside={<SourceTag kind="calc" label="Rule-based ranking" />} />
      {actions.length === 0 ? <Notice>Add appliances with usage above zero to get a ranked plan.</Notice> : (
        <div className="grid gap-x-12 gap-y-8 lg:grid-cols-2">
          <div>
            <h3 className="border-b border-line pb-2 text-sm font-medium text-teal">No cost, start today</h3>
            {free.length ? <ul className="divide-y divide-line">{free.map((a) => <Row key={a.id} a={a} rank={++n} />)}</ul> : <p className="py-4 text-sm text-muted">No free actions found.</p>}
          </div>
          <div>
            <h3 className="border-b border-line pb-2 text-sm font-medium text-amber">Needs equipment</h3>
            {buy.length ? <ul className="divide-y divide-line">{buy.map((a) => <Row key={a.id} a={a} rank={++n} />)}</ul> : <p className="py-4 text-sm text-muted">Nothing to buy based on current inputs.</p>}
          </div>
        </div>
      )}
      <p className="mt-6 text-xs text-muted">
        Ranking score = estimated PKR impact × confidence ÷ (effort + comfort cost + 2 if you must buy something). Savings use your effective rate and are estimates, not guarantees.
      </p>
    </section>
  );
}
