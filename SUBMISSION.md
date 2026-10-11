# BijliSense AI: submission kit

Deadline: **Monday 12 October, 7 PM.** Everything below uses only what the product really does. Fill the bracketed fields with real results; do not invent any.

## 1. Demo ad storyboard (45 seconds, screen-recorded from the real app)

| Time | Visual (real footage) | Voice-over / caption |
|---|---|---|
| 0–6 s | Hands on a phone showing a bill, then a fan stopping (record a real fan switch-off, or a black screen with the caption) | "High bills. Power cuts. And no idea which appliance to blame." |
| 6–14 s | Setup section: change AC hours, add an appliance from the list | "Tell BijliSense what you run and for how long." |
| 14–22 s | Overview: energy-flow lines animate, totals update, "Demo data" tag visible, then the modeled-vs-billed gap notice | "See where your units go, and how far the model is from your actual bill." |
| 22–31 s | Simulator: drag the AC slider; difference in PKR and kWh changes live | "Test a change before you make it." |
| 31–38 s | Backup: tick fridge, fans, lights; runtime and "falls short by" appear | "Will your battery get you through a power cut?" |
| 38–45 s | Agent: press Analyze my household; show the AI answer with trade-offs; end card with logo and tagline | "Then get a plain-language next step. BijliSense: understand your bill, outsmart load-shedding." |

Record on the deployed URL. Use the figures the app actually shows. Say "estimates" on screen. No testimonials unless a real tester agreed to be quoted.

## 2. Pitch deck outline (10 slides)

1. **Problem**: rising bills, expensive AC use and load-shedding; households cannot tell which appliance costs what. *Source your statistics from a cited public source or leave them out.*
2. **Target user**: Pakistani households with high AC/fan use and a UPS or inverter. [Name the segment you actually interviewed.]
3. **User research**: [N] people tested; table of what they said and what you changed (template in section 3). This slide must be real.
4. **Solution**: one sentence plus the energy-flow screenshot.
5. **Working product**: three screenshots (simulator, backup, agent) and the live URL.
6. **AI architecture**: browser → Vercel route → server recomputes numbers → Groq → validated JSON → UI; fallback when AI is down. Emphasize "AI explains, the calculation engine computes."
7. **Impact and assumptions**: what a 1 h/day AC change means for the demo household (the app's own figure), clearly labelled as modeled. State the assumptions (rate, nameplate watts).
8. **Business model**: options to evaluate, not claims: free for households, paid tier or B2B with solar/UPS installers (lead generation for correctly sized backup), utilities or NGOs for efficiency programs. [Pick one to validate.]
9. **Team and roadmap**: team names; next: meter-photo or CSV import, tariff slab support once verified against official tariff documents, Urdu/Roman Urdu UI, installer-verified appliance database.
10. **Ask / close**: what you need (feedback, pilot households, mentors) and the tagline.

## 3. User research kit (required: at least three real people)

**Interview script (10 minutes each, watch them use the app on their own phone):**
1. How do you currently figure out why your bill is high?
2. What do you do during load-shedding? What backup do you have (UPS, inverter, generator, none)?
3. [Hand over the phone.] Without help, what do you think this app does?
4. Enter your three biggest appliances. Was anything confusing?
5. Try the simulator. Do you trust the number? Why or why not?
6. Try the backup planner. Did the result match your experience of your own UPS?
7. Read the AI answer. Is anything unclear, wrong, or unhelpful?
8. Would you use this again? What would make you?

**Results template (fill with real answers):**

| # | Who (age band, household size, backup type) | What they did/said (quote or close paraphrase) | What confused them | What we changed |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |

Get permission before quoting anyone by name.

## 4. What remains before submission

- [ ] Create a Groq key; set `GROQ_API_KEY` locally; run `npm run dev` and confirm **Analyze my household** returns a real answer. If the model ID is rejected, set `GROQ_MODEL=openai/gpt-oss-20b`.
- [ ] Push to GitHub (check `git status`: `.env.local` must not appear).
- [ ] Import into Vercel, add `GROQ_API_KEY` and `GROQ_MODEL`, deploy, then repeat the AI test on the production URL.
- [ ] Open the production URL on a real phone and a laptop; try the keyboard (Tab through Setup and the sliders).
- [ ] Run three real user tests; fix at least one thing they found; record it in the table above.
- [ ] Record the 45-second demo from the production site.
- [ ] Build the deck from the outline using your real research results.
- [ ] Re-check https://console.groq.com/docs/models for the model ID the day you submit.
- [ ] Submit before 7 PM Monday 12 October, with buffer for upload problems.
