# BijliSense AI

**Understand your bill. Outsmart load-shedding.**
Household energy intelligence for Pakistani homes, built for the Qubit Dynamics "Power. Water. Heat." hackathon.

Next.js 14 (App Router, TypeScript) · Tailwind · Recharts · three.js / react-three-fiber (3D hero) · Groq via a Vercel serverless route · no database, no sign-in.
Light (white) + green theme. The hero is a low-poly 3D scene: house, pole, wires with moving energy pulses (speed follows your load), AC fan, and a battery whose bars follow backup runtime. It respects reduced-motion and falls back to a 2D SVG diagram if WebGL is unavailable.

## What it does

| Section | What is real |
|---|---|
| Overview | Live totals from the appliance list, animated numbers, and the 3D scene driven by load, AC share and battery runtime |
| Setup | Editable appliances (add, remove, validate), household size, optional billed units and amount, your own effective PKR/kWh, priorities |
| Usage | Appliance breakdown, your own six monthly readings, and a modeled-vs-billed gap check that never forces the numbers to match |
| Simulator | Per-appliance daily-hour sliders; every result comes from the same calculation engine |
| Backup planner | Wh or V × Ah, usable %, inverter efficiency, selected loads, required hours; runtime, feasibility, shortfall, biggest drains |
| Action plan | Rule-based ranking by impact, confidence, effort, comfort cost and purchase cost; no-cost vs needs-equipment |
| AI agent | Groq model receives inputs plus server-recomputed results; returns insight, up to 3 actions, trade-offs, missing info, limitations |

The app works without the AI: if Groq is unreachable or unconfigured, the agent panel shows a clear error and a local summary, and everything else keeps working.

## Run locally

```bash
npm install
cp .env.example .env.local      # then put your key in GROQ_API_KEY
npm run dev                     # http://localhost:3000
```

Other scripts: `npm test` (28 unit tests), `npm run typecheck`, `npm run build`.

## Deploy to Vercel (all free tier, no card needed)

1. `npm install && npm run build && npm test` locally.
2. Push to GitHub. `.env.local` is git-ignored; check `git status` before committing.
3. In Vercel: Add New → Project → import the repository (framework auto-detected as Next.js).
4. Project Settings → Environment Variables: add `GROQ_API_KEY` and `GROQ_MODEL` (Production, Preview and Development).
5. Deploy (or Redeploy after adding variables; they only apply to new deployments).
6. Open the production URL, press **Analyze my household**, and confirm a real AI answer appears. Test once on a phone.

## Security and privacy

- The key is read only inside `app/api/energy-agent/route.ts` from `GROQ_API_KEY`. No `NEXT_PUBLIC_` secrets; nothing secret reaches the browser.
- The route validates types, clamps ranges, caps body size (20 KB), appliance count (30) and question length (600 chars), applies a best-effort per-instance rate limit (8/min), and logs only an error status, never keys or payloads.
- The server **recomputes all numbers itself** from the raw inputs, so the model is never handed client-supplied "results" to repeat. Appliance names and the question are treated as data in the system prompt.
- Sent to Groq: appliance list, rate, scenario, backup settings, household size, question. Not sent: name, address, account details.
- Household data is saved in this browser's `localStorage` only (not a cloud account, not a backup). The API key is never stored in the browser. **Reset demo data** and **Start empty** are in Setup.

## Assumptions and limits (also shown in the app)

- `monthly kWh = watts × quantity × hours/day × 30 ÷ 1000`. Appliance presets are generic starting points; use the label on your appliance.
- Cost is **energy-only** at the rate you enter. It excludes taxes, fixed charges, tariff slabs and fuel adjustments. The app contains no official tariffs or load-shedding schedules.
- Demo values (appliances, billed units, bill amount, rate, six monthly readings) are illustrative and tagged "Demo data" until you edit them.
- `runtime = battery Wh × usable % × inverter efficiency ÷ load W`. It ignores surge current, battery age and chemistry, and discharge limits. It is a planning estimate, not a safety check.
- Action savings are estimates from your own inputs. Reducing AC is presented as a what-if with a heat-safety warning, never as universally safe.
- Not connected to a smart meter or utility account.
- AI savings figures are constrained by the prompt to supplied numbers, but a language model can still err. The UI labels AI output, and the ranked plan is computed independently of it.

## Model

Default `openai/gpt-oss-120b` (listed under Groq production models on 11 Oct 2026), with `reasoning_effort: low`, JSON-object output, and response validation with a plain-text fallback. Re-check https://console.groq.com/docs/models before submission and change `GROQ_MODEL` if needed. Free-tier rate limits apply; a 429 is shown as a friendly retry message.

## Project layout

```
app/page.tsx                 state, localStorage, section wiring
app/api/energy-agent/route.ts  secure Groq route
lib/energy.ts                calculation engine (pure, tested)
lib/actions.ts               ranked action plan
lib/agent.ts                 request validation, grounded payload, prompt, response parsing
lib/demo.ts                  demo household and appliance presets
components/                  Overview, HeroScene, HouseScene (3D), EnergyFlow (2D fallback), Setup, Breakdown, Simulator, Backup, Plan, Agent, ui
tests/                       energy + agent/API tests (vitest)
SUBMISSION.md                demo ad storyboard, pitch outline, research kit, checklist
```

## Verification status

Verified in a sandbox: `npm run build` succeeds, 28 tests pass, API returns correct 503/400/405/413/502 paths without leaking keys, slider recalculation checked in a headless browser at desktop and mobile widths (no horizontal overflow).
**Not verified here:** a live Groq response (sandbox cannot reach Groq), deployment on Vercel, real devices, and Google Fonts loading (blocked in the sandbox; the CSS falls back to system fonts).
