# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## What This Is
Tesoro is a personal financial insight web app. Users upload CSV exports from their bank, investment, credit card, and retirement accounts. The app normalizes the data, runs a Python analytics pipeline, and delivers LLM-powered insights through an editorial card-based dashboard. The AI advisor is named **Mastro**.

---

## Local Development

**Install dev dependencies** (not in `requirements.txt` — these are local-only):
```bash
pip install flask python-dotenv
pip install -r requirements.txt
```

**Create `.env`** in project root (gitignored):
```
TESORO_PASSWORD=yourpassword
TESORO_SECRET=yoursecret
ANTHROPIC_API_KEY=sk-ant-...
```

**Run the dev server:**
```bash
python3 dev_server.py
```
Opens at `http://localhost:3003`. Entry point is `/` → `login.html`.

There is no build step, no npm, no test suite.

---

## Deployment (Vercel)

```bash
npm i -g vercel         # if not installed
vercel link
vercel env add TESORO_PASSWORD
vercel env add TESORO_SECRET
vercel env add ANTHROPIC_API_KEY
vercel --prod
```

---

## Stack
- **Frontend**: HTML, CSS, JavaScript (vanilla) — served as static files from `public/`
- **Backend**: Python serverless functions in `api/` (Vercel Python 3.12 runtime)
- **AI**: Anthropic Claude via `anthropic` Python SDK (`claude-opus-4-6`)
- **Charts**: Chart.js (CDN)
- **Host**: Vercel

---

## Dual-Mode API Architecture

Each `api/*.py` file serves two execution environments:

1. **Vercel production** — exposes `class handler(BaseHTTPRequestHandler)` at the module top level. Vercel calls this directly.
2. **Local dev** — `dev_server.py` (Flask) imports the business logic functions directly (e.g. `normalize_csv`, `enrich_transactions`) and wires them into Flask routes.

When editing an API file, both the `handler` class and the imported business logic functions must stay consistent.

---

## Data Flow

```
User uploads CSV
    ↓
POST /api/ingest     → normalize_csv() → JSON transactions (returned to browser)
    ↓  (stored in sessionStorage)
POST /api/analyze    → enrich_transactions() + calculate_metrics() + anomalies + recurring → JSON analytics
    ↓  (stored in sessionStorage)
POST /api/insights   → build_context() → generate_insights() → Claude API → insight cards JSON
    ↓
Dashboard renders cards + Chart.js charts
```

**No data is persisted server-side.** All state lives in browser `sessionStorage`.

---

## Key Module Responsibilities

| Module | Key function(s) | Notes |
|---|---|---|
| `api/ingest.py` | `normalize_csv()` | Detects CSV source type by filename + column sniffing; handles headerless files |
| `api/analyze.py` | `enrich_transactions()` | Merchant categorization via `CATEGORY_MAP`; assigns `category`, `is_fixed`, `is_discretionary` |
| `analytics/metrics.py` | `calculate_metrics()` | Income, spend, savings rate |
| `analytics/anomalies.py` | `detect_spend_spikes()`, `detect_category_jumps()` | |
| `analytics/recurring.py` | `detect_recurring_charges()` | |
| `orchestrator/build_context.py` | `build_context()` | Assembles compact fact packet for LLM |
| `orchestrator/generate_insights.py` | `generate_insights()` | Calls Anthropic; assembles prompt from `system.md`, `insight_rubric.md`, `examples/`, `schemas/` |

---

## Authentication
- `api/auth.py` validates password with `secrets.compare_digest()` (timing-safe)
- Returns a signed HMAC token (key = `TESORO_SECRET`)
- Token stored in `sessionStorage` — never `localStorage`
- All API endpoints verify `Authorization: Bearer <token>` before processing

---

## LLM Prompt Assembly

`generate_insights()` assembles the full prompt from four files loaded at call time:
- `system.md` — Mastro persona + instructions
- `insight_rubric.md` — quality criteria
- `examples/high_quality_insights.md` — few-shot exemplars
- `schemas/insights_output.json` — required output shape

Edit those files to change Mastro's behavior; do not hardcode prompt text in Python.

---

## Environment Variables

| Variable | Purpose |
|---|---|
| `TESORO_PASSWORD` | Dashboard access password |
| `TESORO_SECRET` | HMAC key for signing session tokens |
| `ANTHROPIC_API_KEY` | Claude API key |

Set via `vercel env add` for deployment. For local dev, use `.env` in project root.

---

## Design System

| Token | Value | Use |
|---|---|---|
| `--crimson` | `#A33030` | Logo bg, hero card, brand accents |
| `--cream` | `#F5EDD9` | Text on dark, card bg |
| `--navy` | `#06042A` | Investment card, dark panels |
| `--gold` | `#D4B554` | Spending insight card bg |
| `--orange` | `#F05A28` | Anomaly highlights, CTA |
| `--slate-blue` | `#5B9EC9` | Chart accents |
| `--near-black` | `#1A1A1A` | Page bg, Mastro panel |
| `--indigo` | `#1D3B6F` | Recurring charges card |

**Fonts:**
- Display/headlines: `ivyjournal` — Adobe Typekit `jal8uea` (light, weight 300). CSS family name is `"ivyjournal"` (no hyphen).
- UI/data: `Space Grotesk` — Google Fonts, 400

All styles + tokens live in `public/css/styles.css`. No CSS framework.

---

## CSV Source Detection

Source type is detected in `ingest.py:_detect_source()` by filename keywords first, then column sniffing:

| Source type | Filename hints | Column hints |
|---|---|---|
| `bank` | `wells`, `chase`, `bank` | fallback default |
| `credit_card` | `citi`, `amex`, `visa`, `card`, `credit` | `debit` + `category` cols |
| `investment` | `schwab`, `fidelity`, `robinhood`, `invest` | `symbol`, `shares`, `price` |
| `retirement` | `401k`, `retirement`, `swb`, `ira` | — |

Headerless CSVs (e.g. Wells Fargo) are handled by positional column assignment: col0=date, col1=amount, col4=description.

---

## Session Continuity

**At the start of each session, read `milestone.md`** — it tracks build state, what's complete, known issues, and planned next steps. Update it when milestones are reached or the build state changes.

---

## Frontend JS Modules

| File | Responsibility |
|---|---|
| `public/js/auth.js` | Login form → POST `/api/auth` → stores token in `sessionStorage` |
| `public/js/upload.js` | CSV file selection → POST `/api/ingest` → POST `/api/analyze` → stores analytics |
| `public/js/dashboard.js` | Renders insight cards + Chart.js charts from `sessionStorage` data |
| `public/js/mastro.js` | Mastro panel behavior (time-of-day greeting, panel state) |

---

## Key Conventions
- Python API functions read env vars with `os.environ["KEY"]` — never hardcoded
- All API responses return `Content-Type: application/json`
- Frontend checks for session token before rendering any protected page
- Merchant categorization (`CATEGORY_MAP`) lives in `api/analyze.py`, not `analytics/`
