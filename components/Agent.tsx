'use client';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { LoaderCircle, Sparkles } from 'lucide-react';
import { Notice, SectionHeader, SourceTag } from './ui';
import { AppState } from '@/lib/demo';
import { ActionItem } from '@/lib/actions';
import { AgentResult } from '@/lib/agent';
import { formatKwh, formatPKR } from '@/lib/energy';

const SUGGESTIONS = [
  'Which change should I make first?',
  'How can I cut AC cost without losing comfort?',
  'Is my battery enough for a long power cut?',
  'Explain my bill gap in simple words.',
];

export interface AgentHandle { analyze: () => void }

export const Agent = forwardRef<AgentHandle, { state: AppState; actions: ActionItem[]; modeledKwh: number; cost: number }>(function Agent({ state, actions, modeledKwh, cost }, ref) {
  const [question, setQuestion] = useState(SUGGESTIONS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AgentResult | null>(null);
  const [lastWasDemo, setLastWasDemo] = useState(true);
  const panelRef = useRef<HTMLElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function ask(q: string) {
    const text = q.trim();
    if (!text || busy) return;
    setBusy(true); setError('');
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const timer = setTimeout(() => ctrl.abort(), 30_000);
    try {
      const res = await fetch('/api/energy-agent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
        body: JSON.stringify({ household: state.household, scenario: state.scenario, backup: state.backup, isDemo: state.isDemo, question: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'The AI service could not respond.');
      setResult(data.result as AgentResult);
      setLastWasDemo(state.isDemo);
    } catch (e) {
      setError(e instanceof DOMException && e.name === 'AbortError' ? 'The AI took too long to answer. Try again in a moment.' : e instanceof Error ? e.message : 'Something went wrong.');
    } finally { clearTimeout(timer); setBusy(false); }
  }

  useImperativeHandle(ref, () => ({
    analyze: () => { panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); void ask('Analyze this household and recommend practical energy actions.'); },
  }));

  const top = actions.filter((a) => a.savingsPKR !== null).slice(0, 3);

  return (
    <section ref={panelRef} aria-labelledby="agent" className="border-t border-line py-14">
      <SectionHeader id="agent" title="Ask the energy agent" lead="The AI reads your inputs and the calculated results above, then explains what to do first and why. It cannot invent savings: every figure comes from the calculations." />
      <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <label htmlFor="q" className="mb-1.5 block text-sm font-medium">Your question</label>
          <textarea id="q" className="field-input min-h-[104px] resize-y" maxLength={600} value={question} onChange={(e) => setQuestion(e.target.value)} />
          <div className="mt-2 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => <button key={s} type="button" className="chip" onClick={() => setQuestion(s)}>{s}</button>)}
          </div>
          <button className="btn btn-primary mt-4" disabled={busy || !question.trim()} onClick={() => ask(question)}>
            {busy ? <LoaderCircle className="spin" size={17} aria-hidden /> : <Sparkles size={17} aria-hidden />} {busy ? 'Analyzing your household…' : 'Ask the energy agent'}
          </button>
          <p className="mt-4 text-xs text-muted">
            Sent to the AI provider: your appliance list, rate, scenario, backup settings, household size and your question. Not sent: your name, address, or any account details. Advice is informational, not an electrical inspection.
          </p>
        </div>

        <div aria-live="polite" className="min-h-[200px]">
          {busy && (
            <div className="space-y-3" role="status" aria-label="Waiting for the AI">
              <div className="shimmer h-5 w-3/4 rounded" /><div className="shimmer h-5 w-full rounded" /><div className="shimmer h-24 w-full rounded-xl" /><div className="shimmer h-24 w-full rounded-xl" />
            </div>
          )}

          {!busy && error && (
            <div className="space-y-4">
              <Notice tone="error">{error}</Notice>
              <div className="rounded-2xl border border-line p-5">
                <div className="mb-2 flex items-center justify-between"><h3 className="text-base font-bold">Local summary (no AI)</h3><SourceTag kind="calc" label="Calculated" /></div>
                <p className="text-sm text-muted">Your modeled usage is {formatKwh(modeledKwh)} kWh a month, about {formatPKR(cost)} energy-only at your rate.{top.length ? ' The highest-ranked actions in your plan:' : ''}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{top.map((a) => <li key={a.id}>{a.title} (≈ {formatPKR(a.savingsPKR ?? 0)} / month, estimated)</li>)}</ul>
              </div>
            </div>
          )}

          {!busy && !error && !result && (
            <div className="rounded-2xl border border-dashed border-line p-6 text-sm text-muted">
              No answer yet. Choose <strong className="text-fg">Analyze my household</strong> above or ask your own question. If the AI is unavailable, your calculations and plan above keep working.
            </div>
          )}

          {!busy && !error && result && (
            <article className="space-y-5">
              <div className="flex items-center justify-between gap-2"><h3 className="text-lg font-bold">Insight</h3><SourceTag kind="ai" label={result.format === 'json' ? 'AI-generated' : 'AI, plain text'} /></div>
              <p>{result.insight}</p>
              {lastWasDemo && <p className="text-xs text-amber">Based on the demo household. Enter your own details in Setup for a personal answer.</p>}
              {result.actions.length > 0 && (
                <ol className="space-y-3">
                  {result.actions.map((a, i) => (
                    <li key={i} className="rounded-2xl border border-line bg-surface p-4">
                      <h4 className="font-heading text-base font-bold"><span className="mr-2 text-mint num-tabular">{i + 1}.</span>{a.title}</h4>
                      <dl className="mt-2 space-y-1.5 text-sm">
                        <div><dt className="inline font-medium">Why: </dt><dd className="inline text-muted">{a.why}</dd></div>
                        <div><dt className="inline font-medium">Estimated impact: </dt><dd className="inline text-muted">{a.impact}</dd></div>
                        <div><dt className="inline font-medium">Trade-off: </dt><dd className="inline text-muted">{a.tradeoff}</dd></div>
                      </dl>
                    </li>
                  ))}
                </ol>
              )}
              {(result.missingInfo.length > 0 || result.limitations.length > 0) && (
                <div className="grid gap-4 border-t border-line pt-4 text-sm sm:grid-cols-2">
                  {result.missingInfo.length > 0 && <div><h4 className="mb-1 font-medium">Missing information</h4><ul className="list-disc space-y-1 pl-5 text-muted">{result.missingInfo.map((m, i) => <li key={i}>{m}</li>)}</ul></div>}
                  {result.limitations.length > 0 && <div><h4 className="mb-1 font-medium">Limitations</h4><ul className="list-disc space-y-1 pl-5 text-muted">{result.limitations.map((m, i) => <li key={i}>{m}</li>)}</ul></div>}
                </div>
              )}
            </article>
          )}
        </div>
      </div>
    </section>
  );
});
