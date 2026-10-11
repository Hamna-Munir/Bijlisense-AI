import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AGENT_LIMITS, buildAgentPayload, parseAgentResponse, validateAgentRequest } from '@/lib/agent';
import { demoState } from '@/lib/demo';
import { POST } from '@/app/api/energy-agent/route';

function demoRequest() {
  const s = demoState();
  return { household: s.household, scenario: s.scenario, backup: s.backup, isDemo: true, question: 'How do I save?' };
}

describe('request validation', () => {
  it('accepts a valid request', () => {
    const r = validateAgentRequest(demoRequest());
    expect(r.ok).toBe(true);
  });
  it('rejects malformed bodies', () => {
    expect(validateAgentRequest(null).ok).toBe(false);
    expect(validateAgentRequest({}).ok).toBe(false);
    const bad = demoRequest();
    (bad.household.appliances[0] as unknown as { watts: string }).watts = 'lots';
    expect(validateAgentRequest(bad).ok).toBe(false);
  });
  it('rejects too many appliances and truncates long questions', () => {
    const big = demoRequest();
    big.household.appliances = Array.from({ length: AGENT_LIMITS.maxAppliances + 1 }, (_, i) => ({ ...big.household.appliances[0], id: `x${i}` }));
    expect(validateAgentRequest(big).ok).toBe(false);
    const long = { ...demoRequest(), question: 'a'.repeat(5000) };
    const r = validateAgentRequest(long);
    expect(r.ok && r.value.question.length).toBe(AGENT_LIMITS.maxQuestionChars);
  });
  it('clamps negative values rather than trusting them', () => {
    const neg = demoRequest();
    neg.household.appliances[0].watts = -900;
    const r = validateAgentRequest(neg);
    expect(r.ok && r.value.household.appliances[0].watts).toBe(0);
  });
});

describe('grounded payload', () => {
  it('recomputes numbers server-side and excludes extras', () => {
    const r = validateAgentRequest(demoRequest());
    if (!r.ok) throw new Error('invalid');
    const p = buildAgentPayload(r.value);
    expect(p.calculations.modeledMonthlyKwh).toBeCloseTo(362.7, 1);
    expect(p.calculations.scenario.differenceKwh).toBeCloseTo(36, 1);
    expect(JSON.stringify(p)).not.toMatch(/apiKey|GROQ/i);
    expect(p.missingInformation.length).toBeGreaterThan(0);
  });
});

describe('response parsing', () => {
  const good = { insight: 'AC is your biggest load.', actions: [{ title: 'Trim AC', why: 'Largest', impact: '36 kWh', tradeoff: 'Less cooling' }], missingInfo: [], limitations: [] };
  it('parses clean, fenced and wrapped JSON', () => {
    expect(parseAgentResponse(JSON.stringify(good))?.format).toBe('json');
    expect(parseAgentResponse('```json\n' + JSON.stringify(good) + '\n```')?.actions).toHaveLength(1);
    expect(parseAgentResponse('Sure! ' + JSON.stringify(good) + ' Hope it helps')?.insight).toContain('AC');
  });
  it('limits actions to three', () => {
    const many = { ...good, actions: Array.from({ length: 6 }, (_, i) => ({ ...good.actions[0], title: `A${i}` })) };
    expect(parseAgentResponse(JSON.stringify(many))?.actions).toHaveLength(3);
  });
  it('falls back to flagged text for malformed output and null for empty', () => {
    const r = parseAgentResponse('Just use less AC.');
    expect(r?.format).toBe('text');
    expect(r?.limitations.length).toBe(1);
    expect(parseAgentResponse('')).toBeNull();
    expect(parseAgentResponse(undefined)).toBeNull();
  });
});

describe('API route configuration', () => {
  const saved = process.env.GROQ_API_KEY;
  beforeEach(() => { delete process.env.GROQ_API_KEY; });
  afterEach(() => { if (saved) process.env.GROQ_API_KEY = saved; });

  it('returns a clear 503 when the key is missing', async () => {
    const res = await POST(new Request('http://x/api/energy-agent', { method: 'POST', body: JSON.stringify(demoRequest()) }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toMatch(/GROQ_API_KEY/);
    expect(JSON.stringify(body)).not.toMatch(/gsk_/);
  });
  it('rejects bad JSON and oversized bodies when configured', async () => {
    process.env.GROQ_API_KEY = 'test-key-not-real';
    const bad = await POST(new Request('http://x/api/energy-agent', { method: 'POST', headers: { 'x-forwarded-for': '9.9.9.1' }, body: '{nope' }));
    expect(bad.status).toBe(400);
    const huge = await POST(new Request('http://x/api/energy-agent', { method: 'POST', headers: { 'x-forwarded-for': '9.9.9.2' }, body: 'x'.repeat(AGENT_LIMITS.maxBodyChars + 1) }));
    expect(huge.status).toBe(413);
  });
});
