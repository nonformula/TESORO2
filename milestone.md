# Tesoro v2 — Session Milestones

## How to use this file
At the start of each new Claude session, read this file to catch up on current build state, what's done, what's next, and any known issues.

---

## Milestone 1 — Foundation Complete
**Date:** 2026-04-13
**Status:** ✅ Complete

### What was built
- Project structure scaffolded from plan
- Backend analytics + orchestrator modules renamed to valid Python names
- `analytics/__init__.py`, `orchestrator/__init__.py` added
- `requirements.txt` (anthropic, pandas, numpy)
- `vercel.json` (routing + Python function config)
- `CLAUDE.md` (full project orientation)
- `public/`, `public/css/`, `public/js/`, `api/` directories created

### What exists (pre-existing, kept as-is)
- `system.md` — LLM system prompt
- `insight_rubric.md` — insight quality criteria
- `analytics/metrics.py` — `calculate_metrics()`
- `analytics/anomalies.py` — `detect_spend_spikes()`, `detect_category_jumps()`
- `analytics/recurring.py` — `detect_recurring_charges()`
- `orchestrator/build_context.py` — `build_context()`
- `orchestrator/generate_insights.py` — `generate_insights()` (Anthropic call implemented)
- `schemas/insights_output.json` — output schema
- `examples/high_quality_insights.md` — exemplar insights
- `assets/` — design PNGs, AI-gen backgrounds, raw CSV data

---

## Milestone 2 — Backend API Complete
**Date:** 2026-04-13
**Status:** ✅ Complete

### What was built
- `api/auth.py` — password validation + HMAC token issuance + token verification helper
- `api/ingest.py` — CSV normalization for bank, credit card, investment, 401k sources
- `api/analyze.py` — full analytics pipeline (metrics, anomalies, recurring, categorization)
- `api/insights.py` — Anthropic API call via orchestrator, returns insight JSON
- `orchestrator/generate_insights.py` — `call_model()` implemented with Anthropic SDK

---

## Milestone 3 — Frontend Complete
**Date:** 2026-04-13
**Status:** ✅ Complete

### What was built
- `public/css/styles.css` — full design system (tokens, layout, cards, typography)
- `public/login.html` + `public/js/auth.js` — password gate
- `public/upload.html` + `public/js/upload.js` — CSV upload flow
- `public/dashboard.html` + `public/js/dashboard.js` + `public/js/mastro.js` — main dashboard

---

## Milestone 4 — Design Polish + Bug Fixes
**Date:** 2026-04-13
**Status:** ✅ Complete

### What was fixed
- `detect_category_jumps()` was being called with one argument — fixed in both `dev_server.py` and `api/analyze.py` to split transactions at date midpoint into prior/current periods
- Typekit font name corrected from `"ivy-journal"` to `"ivyjournal"` (no hyphen) — matches what Adobe kit `jal8uea` actually registers
- `localhost` added to Adobe Fonts kit allowed domains to enable local font loading

### Design changes
- Hero card: removed red wash overlay, landscape2.png shows at 0.85 opacity, no color tint
- Hero greeting: font size increased to 56px, time-of-day aware (Good morning / Good afternoon / Good evening) — set dynamically in dashboard.js
- Card colors diversified — no repeats across 6 cards: crimson (hero), gold (spending), forest green (investment), indigo #1D3B6F (recurring), near-black (cash flow), navy (Mastro)
- All card border-radius removed (sharp edges)
- All gaps between cards removed (flush grid)
- All card box-shadows removed
- Chart borders removed — doughnut uses solid fills, bar chart uses solid `#5B9EC9`
- Mastro panel: royal_clothes1.png at full opacity, no color overlay
- `--indigo: #1D3B6F` added as new design token

## Current Build State
**All milestones complete.** App is ready to deploy.

### To deploy to Vercel:
1. `npm i -g vercel` (if not installed)
2. `vercel link` (link to Vercel project)
3. Set env vars:
   - `vercel env add TESORO_PASSWORD`
   - `vercel env add TESORO_SECRET`
   - `vercel env add ANTHROPIC_API_KEY`
4. `vercel --prod`

### Known issues / watch items
- None currently

---

## Next Session: If adding features
Common next steps:
- Add property/mortgage card (home value input + mortgage CSV)
- Add net worth timeline chart
- Add Mastro follow-up chat (multi-turn conversation)
- Add PDF statement parsing
- Add date range filtering on dashboard
