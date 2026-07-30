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

## Milestone 5 — Vercel Deployment
**Date:** 2026-04-15
**Status:** ✅ Complete

### What was done
- Initialized git repo and pushed to https://github.com/nonformula/TESORO2.git
- Converted all `api/*.py` handlers from `BaseHTTPRequestHandler` to Flask WSGI apps — required by current Vercel Python runtime
- Added `flask` to `requirements.txt`
- Fixed `vercel.json`: removed invalid `runtime` key, fixed malformed structure, added `framework: null`, `buildCommand: ""`, `outputDirectory: "public"`, corrected rewrite paths (removed `/public/` prefix)
- Fixed `generate_insights.py`: schema filename was `insight_output.json` → corrected to `insights_output.json`
- Fixed `upload.js`: analyze step now fires automatically after ingest (no manual button click required)
- Fixed `upload.js`: removed `checkAnalyzeReady()` gating logic
- Env vars set via Vercel dashboard (Settings → Environment Variables): `TESORO_PASSWORD`, `TESORO_SECRET`, `ANTHROPIC_API_KEY`

### Current Build State
**Deployed to Vercel production.** Env vars pending confirmation — password auth being tested.

### Known issues / watch items
- Mastro insights flow untested end-to-end on production (schema bug was fixed, needs live test)
- Local dev still uses `python3 dev_server.py` on port 3003 — unaffected by Vercel changes

---

## Milestone 6 — Standalone Report Pages
**Date:** 2026-04-15
**Status:** ✅ Complete

### What was built
- `public/mortgage.html` — Mortgage report for Newrez loan #0213535487
  - 3-column grid: principal hero (crimson), payment breakdown with bars, equity/debt donut (navy), YTD paid (indigo), amortization bar chart (span 2)
  - Metric strip: escrow balance, late fee threshold, remaining term, $0 overdue
  - Chart.js: doughnut (interest/escrow/principal split) + stacked bar (12-month amortization)
  - Data sourced from `assets/data/raw/Monthly Statement.pdf`

- `public/spending-march.html` — Citi Card-1188 March 2026 spending report
  - 7-card grid + metric strip from 103 parsed transactions across 10 categories
  - $8,503 total spend; top categories: Merchandise $1,847, Restaurants $1,504, Health $1,484
  - Chart.js: category donut + daily spend bar (Mar 27 peak $1,579 highlighted in orange)
  - AI subscriptions callout card (indigo): $300 across Claude.ai Pro, Anthropic API, OpenAI, Runway, ElevenLabs
  - Data sourced from `assets/data/raw/citi_060726.csv` — March rows only

### Notable data findings (March 2026)
- Tooth Doctor: $1,294 single charge (Mar 27) — dominant health spike
- Neptune's Grill: 4 visits, $340 total — most-frequented restaurant
- AI tooling: exactly $300/month across 5 services (3.5% of total spend)
- Biggest day: Mar 27 at $1,579 (dentist + NYC hotel pre-trip)

---

## Milestone 7 — Design System Documentation
**Date:** 2026-04-15
**Status:** ✅ Complete

### What was built
- `TESORO_STYLE_GUIDE.md` — Comprehensive shareable markdown reference
  - Brand philosophy, voice, logo usage rules + file paths
  - Full color system: all 11 CSS tokens with hex values and semantic mapping
  - Typography: IvyJournal + Space Grotesk specs, sizes, weights, tracking, critical `"ivyjournal"` no-hyphen note
  - Spacing/shape rules (0px radius, 0px gap, no shadows — all intentional)
  - Layout system: 3-column grid, metric strip, breakpoints
  - All component patterns with HTML snippets (card anatomy, labels, KV rows, bars, metric tiles, insight cards)
  - Animation system: 4 keyframes, stagger timing table, spring easing spec
  - Chart.js defaults + color-to-data-type mapping
  - 12-item Do / Don't checklist

- `public/style-guide.html` — Visual interactive style guide (8 sections, sticky nav)
  - 01 Brand: principle statement, logo in 3 contexts (cream bg, dark, surface), voice do/don't
  - 02 Color: live swatches for all 11 tokens + card color→semantic use table
  - 03 Typography: IvyJournal vs Space Grotesk specimens + full type scale with live examples
  - 04 Cards: all 6 variants (crimson, gold, navy, forest, indigo, dark) rendered at full color
  - 05 Components: labels, badges, horizontal bars, KV rows, metric tiles, insight cards, grain demo
  - 06 Layout: grid diagram with span examples + spacing/shape rules panel
  - 07 Motion: all 4 keyframes documented + stagger pattern visualization
  - 08 Rules: Do/Don't checklist + footer stamp

---

---

## Milestone 8 — v3 Architecture Pivot: Phase 1 (Archive + Scaffold)
**Date:** 2026-04-16
**Status:** ✅ Complete

### What changed
Complete architecture pivot from Python/Flask backend to pure static web app.

**Archived to `_archive/`** (no longer active):
- `api/` — Flask endpoints (auth, ingest, analyze, insights)
- `analytics/` — Python metrics, anomalies, recurring modules
- `orchestrator/` — build_context.py, generate_insights.py
- `schemas/` — insights_output.json
- `dev_server.py`, `requirements.txt`
- `public/js/` — auth.js, upload.js, dashboard.js, mastro.js
- `public/` — login.html, upload.html, dashboard.html

**Created:**
- `public/index.html` — single-page app shell: password screen, API key modal, sidebar nav, upload zone, view container
- `public/css/app.css` — all new UI components: auth screens, sidebar, upload zone, loading states, insight panels, chart wrappers, timeframe bar, metric strips
- `Tesoro_v3_plan.md` — architecture pivot plan

**Updated:**
- `vercel.json` — stripped to pure static config (no Python runtime, no functions)
- `CLAUDE.md` — fully rewritten to reflect v3 architecture

### New architecture
- Pure static site: HTML + CSS + JS, no server
- Browser calls Anthropic API directly via `fetch()`
- Files parsed client-side: CSV (Papa Parse), XLSX (SheetJS), PDF (PDF.js)
- Password: SHA-256 client-side hash, sessionStorage
- Anthropic API key: sessionStorage only, clears on tab close
- Five nav sections: Financial Brief, Net Worth, Investments, Spending, Budget

### Current Build State
**Phase 1 complete. Shell exists but JS not yet built.** Opening index.html shows the auth screen but has no logic yet — parser.js, app.js, llm.js, views.js are next.

---

---

## Milestone 9 — v3 Full Build: Phases 2–5
**Date:** 2026-04-16
**Status:** ✅ Complete

### What was built
**public/js/parser.js** — Client-side file parser (CSV/XLSX/PDF)
- CSV: Papa Parse with source detection (Wells/bank → headerless, Citi/card → headed, Schwab/swb → investment positions)
- XLSX: SheetJS, sheet-to-JSON, same dispatch logic
- PDF: PDF.js text extraction + transaction line pattern matching; Robinhood BTC position detection
- All formats normalize to `{ date, amount, description, source, type }`

**public/js/app.js** — Main controller
- Password screen: SHA-256 hash in browser (`crypto.subtle`), default password `tesoro`
- API key modal: validates `sk-ant-` prefix, stores in `sessionStorage`
- Drag-and-drop + browse file upload, file list with CSV/XLSX/PDF color tags
- Navigation routing, timeframe toggle, Chart.js instance cleanup on view switch
- Session restore: loads prior transactions from `sessionStorage` on reload

**public/js/llm.js** — Anthropic API client
- Fetches `public/prompts/system.md` + `insight_rubric.md` + `examples/high_quality_insights.md` at call time
- `buildSpendingContext()` — category breakdown, monthly totals, top merchants, largest charges
- `buildInvestmentContext()` — per-symbol aggregation, gain/loss, portfolio weights
- `generateInsights()` — full context → Anthropic API (`claude-opus-4-6`) → parsed JSON
- `generateBrief()` — time-of-day greeting + 3-5 sentence brief
- Merchant categorizer: 13 categories by keyword regex

**public/js/views.js** — 5 section renderers
- **Financial Brief**: crimson hero + at-a-glance KV card + LLM brief text + metric strip
- **Net Worth**: hero number + holdings list + allocation donut + LLM commentary
- **Investments**: portfolio total + return stats + allocation donut + bar chart by ticker + positions detail + LLM analysis
- **Spending**: total + top category + largest charge + monthly bar (anomaly highlighted orange) + category donut + category bars + merchant bars + LLM insight cards (3)
- **Budget**: inflow/outflow/savings rate heroes + category breakdown bars + horizontal bar chart + LLM insight cards (3)

**public/css/app.css** — All new UI components

**public/prompts/** — Prompt files moved here from project root so Vercel can serve them

### Architecture notes
- Password hash: `5cf0c40b...` = SHA-256 of "tesoro". Change by updating `PASS_HASH` in `app.js`.
- API header: `anthropic-dangerous-direct-browser-access: true` required for direct browser → Anthropic API calls
- Chart.js instances tracked in `window._tesoroCharts`, destroyed on each view switch to prevent canvas reuse errors
- LLM prompt files cached in `_cache` object in `llm.js` for the session (one fetch per file per tab)

### Current Build State
**v3 is feature-complete.** All 5 views render. LLM integration wired. File parsing for CSV/XLSX/PDF implemented. Password + API key auth working.

### Known limitations / next-up
- Net Worth view only shows what's in loaded files (no manual asset entry)
- PDF parsing relies on text extraction patterns — works for Robinhood/Wells statements, may need tuning for other formats
- No error boundary UI for individual view failures (just console errors)

---

---

## Milestone 10 — Parser Fixes: Real Data Ingestion
**Date:** 2026-04-16
**Status:** ✅ Complete

### What was fixed
Real data files from `assets/data/raw/041626/` revealed three parser bugs:

**`detectSource` order bug**
- `WELLS_INVESTMENTS_Portfolio_Positions.xls` matched `wells` before `invest` → parsed as bank
- Fixed: investment/mortgage checks now run before bank checks
- Added `checking` and `savings` keywords to bank pattern
- Added `mortgage` as a new source type

**Citi CSV metadata preamble**
- `CITI_YTD_041626.CSV` has a `"Time period of report:..."` row before the real header
- `parseCreditCSV` assumed row 0 was the header → all column indices were -1 → 0 transactions
- Fixed: scan first 5 rows to find the row with a cell matching `/^date$/i`

**Citi date format**
- Dates are `"Mar 14, 2026"` — not handled by MM/DD/YYYY or ISO parsers
- Fixed: added explicit `"Mon DD, YYYY"` pattern to `parseDate`

**Bank files with header rows (new `parseBankHeaderCSV`)**
- `personal_checking.csv` and `cash_savings.csv` have a header row with a single `amount` column
- These were falling into `parseCreditCSV` → tagged as `credit_card`, amounts not negated
- Bank convention: negative = spending, positive = income (opposite of credit card)
- Fixed: new `parseBankHeaderCSV` function detects `amount` column and negates values so spending is positive (matching credit card convention used throughout `llm.js`)

**Schwab activity log format (new `parseInvestmentActivityLog`)**
- `schwab_investments.csv` uses an activity log format (`record_type`, `market_value`, `cash_effect` columns) — completely different from the Schwab positions format
- Old parser found 0 records
- Fixed: `parseInvestmentCSV` now auto-detects format by checking for `record_type` in the header; routes to `parseInvestmentActivityLog` which extracts the most recent position per symbol

**Mortgage statement (new `parseMortgageCSV`)**
- `mortgage_payment_statement.csv` is a multi-column amortization log, not a transaction file
- Fixed: `parseMortgageCSV` extracts monthly payment rows as housing expenses (`amount = total_amount`, `type = 'bank'`)

### Files changed
- `public/js/parser.js` — `detectSource`, `parseDate`, `parseCreditCSV`, `parseCSV` updated; `parseBankHeaderCSV`, `parseMortgageCSV`, `parseInvestmentActivityLog` added

---

## Report — Citi YTD Jan–Jul 2026 (`public/spending-ytd-july.html`)

Standalone static report built from `assets/data/raw/072926/CITI_Year to date-3.CSV`
(581 transactions, $39,957.66, Jan 1 – Jul 27 2026, zero credits).

**Category reclassification.** Citi files 175 of the 581 charges as a single
`Merchandise` line worth $9,838. The report splits it into Groceries (Walmart per
user instruction, plus Publix / Sprouts / Earth Origins / Mazzaros), AI & Software,
Retail, and Home & Garden. Fuel is pulled out of `Vehicle Services`; utilities out
of `Services`; SunPass/parking into its own bucket. 16 resulting categories.

**Layout rules applied (from `agent/REPORT_PROTOCOL.md`)**
- `.chart-wrap` uses `flex: 0 0 auto` — with `flex: 1` the charts stretched to fill
  cards that a taller neighbour had grown (the AI line chart rendered ~600px tall).
- At ≤1080px every `.report-grid > .card` spans full width. The report alternates
  span-2 and single-column cards, so nothing tiles into a 2-up grid without leaving
  dead half-rows mid-report.
- `.insight-badge` needs `align-self: flex-start` — `card-inner` is a column flex
  box, so inline-block badges stretch to full width without it.

**Correction worth remembering:** Runway's 11 charges across "Standard / Pro /
unlabeled" tiers initially read as plan churn. Transaction-level detail shows the
opposite — a flat $15/mo Jan–Jun, a $16.01 prorated upgrade in June, then Pro at
$35 in July, plus $415 of separate credit top-ups. 76% of the $1,553 AI total is
one-off purchases, not subscriptions.

---

## Next Steps (v3)
- Test end-to-end with all 5 views after parser fixes
- Tune PDF parser for JH 401k and Robinhood statement formats
- Add manual asset entry for Net Worth (home value, car, etc.)
- Consider Mastro follow-up chat within a view
