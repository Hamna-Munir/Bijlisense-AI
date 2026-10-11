import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { AGENT_LIMITS, SYSTEM_PROMPT, buildAgentPayload, parseAgentResponse, validateAgentRequest } from '@/lib/agent';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Default: a production model on Groq's model list. Override with GROQ_MODEL.
const DEFAULT_MODEL = 'openai/gpt-oss-120b';

// Best-effort per-instance limiter (serverless instances do not share memory). It protects your free-tier quota from casual abuse.
const hits = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 8;
function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 500) for (const [k, v] of hits) if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
  return recent.length > MAX_PER_WINDOW;
}

const err = (message: string, status: number, code: string) => NextResponse.json({ error: message, code }, { status });

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey.startsWith('replace_with')) {
    return err('The AI agent is not configured yet. Add GROQ_API_KEY to .env.local (or Vercel environment variables) and restart. Your local calculations still work.', 503, 'not_configured');
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (limited(ip)) return err('Too many requests. Wait a minute and try again.', 429, 'rate_limited');

  let raw: unknown;
  try {
    const text = await request.text();
    if (text.length > AGENT_LIMITS.maxBodyChars) return err('That request is too large.', 413, 'too_large');
    raw = JSON.parse(text);
  } catch {
    return err('Request body must be valid JSON.', 400, 'bad_request');
  }

  const parsed = validateAgentRequest(raw);
  if (!parsed.ok) return err(parsed.error, 400, 'invalid');

  const model = process.env.GROQ_MODEL?.trim() || DEFAULT_MODEL;
  const payload = buildAgentPayload(parsed.value);

  try {
    const groq = new Groq({ apiKey, timeout: 22_000, maxRetries: 1 });
    const isGptOss = model.startsWith('openai/gpt-oss');
    const completion = await groq.chat.completions.create({
      model,
      temperature: 0.3,
      // gpt-oss models spend part of this budget on reasoning, so leave headroom.
      max_completion_tokens: isGptOss ? 1800 : 900,
      response_format: { type: 'json_object' },
      ...(isGptOss ? { reasoning_effort: 'low' as const } : {}),
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(payload) },
      ],
    });
    const result = parseAgentResponse(completion.choices[0]?.message?.content);
    if (!result) return err('The AI returned an empty answer. Please try again.', 502, 'empty');
    return NextResponse.json({ result, model });
  } catch (e) {
    const status = typeof e === 'object' && e && 'status' in e ? Number((e as { status?: number }).status) : 0;
    // Log only the status, never headers, keys or the user's payload.
    console.error('energy-agent: Groq request failed', status || 'network');
    if (status === 429) return err('The AI is rate-limited right now (free-tier limit). Try again in a minute.', 429, 'provider_rate_limited');
    if (status === 401 || status === 403) return err('The AI key was rejected. Check GROQ_API_KEY in your environment settings.', 503, 'auth');
    if (status === 400 || status === 404) return err('The configured model is not available. Check GROQ_MODEL against the current Groq model list.', 502, 'model');
    return err('The AI service is temporarily unavailable. Your local calculations still work; please retry shortly.', 502, 'provider');
  }
}

export async function GET() {
  return err('Use POST.', 405, 'method');
}
