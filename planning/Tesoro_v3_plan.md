# Tesoro v3 — Architecture Pivot Plan

## Context
Tesoro v2 was built as a Python/Flask backend + static frontend, deployed as Vercel serverless functions. The Python pipeline (ingest → analyze → insights) proved too complex and fragile. The new direction is a **pure static web app** that calls the Anthropic API directly from the browser — no server, no Python runtime, no serverless functions. The LLM does the heavy lifting that Python currently handles. Navigation structure is defined in `TESORO_FUNCTIONS.md`.

---

## New Architecture

### Runtime model
```
Browser
  → User drops CSV / XLSX / PDF files
  → JS parses them (Papa Parse + SheetJS + PDF.js, all CDN)
  → JS builds structured context from raw data
  → fetch() → Anthropic API (api.anthropic.com)
  → LLM returns insight JSON
  → JS renders cards
```

No server. No build step. No Python. Hosted as static files on Vercel.

### Security note
The Anthropic API key is entered by the user and stored in `sessionStorage`. It is transmitted only to `api.anthropic.com` via HTTPS. Since this is a personal tool with no server component, this is acceptable. The key clears on tab close.

---

## Navigation (from TESORO_FUNCTIONS.md)
Five sections, each rendered as a view in the single-page app:
1. **Financial Brief** — auto-generated 3-5 sentence summary on data load
2. **Net Worth** — assets minus liabilities dashboard
3. **Investments** — portfolio breakdown (stocks, BTC, property)
4. **Spending** — transaction analysis with 1w / 1mo / 3mo / YTD timeframe toggle
5. **Budget** — category-level breakdown (Inflow / Outflow / Savings per TESORO_FUNCTIONS.md)

---

## Files to Create (new)

| File | Purpose |
|---|---|
| `public/index.html` | Single-page app shell: nav, sidebar, view container |
| `public/js/app.js` | Main controller: state, navigation, data loading, view switching |
| `public/js/parser.js` | File parsing (CSV/XLSX/PDF) — normalizes all formats to unified transaction schema |
| `public/js/llm.js` | Anthropic API wrapper — fetches rubric/examples/system prompt, builds context, calls claude-opus-4-6 |
| `public/js/views.js` | Render functions for each section (brief, networth, investments, spending, budget) |

---

## Files to Archive → `_archive/`

| Source | What it is |
|---|---|
| `api/` | All Flask/Python API endpoints |
| `analytics/` | metrics.py, anomalies.py, recurring.py |
| `orchestrator/` | build_context.py, generate_insights.py |
| `schemas/insights_output.json` | JSON schema for LLM output (replaced by natural language instructions) |
| `dev_server.py` | Local Flask dev server |
| `requirements.txt` | Python dependencies |
| `public/js/auth.js` | HMAC token auth (no longer needed) |
| `public/js/upload.js` | Old upload flow |
| `public/js/dashboard.js` | Old dashboard renderer |
| `public/js/mastro.js` | Old Mastro panel |
| `public/login.html` | Password login (replaced by password screen in index.html) |
| `public/upload.html` | Upload page (merged into index.html flow) |
| `public/dashboard.html` | Old dashboard (replaced by index.html) |

---

## Files to Keep / Update

| File | Action |
|---|---|
| `public/css/styles.css` | Keep — add nav sidebar styles, view transition styles |
| `system.md` | Keep — loaded at runtime via fetch(), governs Mastro persona |
| `insight_rubric.md` | Keep — fetched and injected into every LLM system prompt |
| `examples/high_quality_insights.md` | Keep — fetched and injected as few-shot examples |
| `TESORO_STYLE_GUIDE.md` | Keep — design reference |
| `TESORO_FUNCTIONS.md` | Keep — functional reference |
| `vercel.json` | Update — remove Python function config, keep static routing only |
| `CLAUDE.md` | Update — reflect new architecture |
| `milestone.md` | Update — new milestone after each major phase |

---

## LLM Prompt Assembly (in llm.js)

On every insight generation call:
```
System prompt = fetch('/system.md') + fetch('/insight_rubric.md') + fetch('/examples/high_quality_insights.md')
User prompt   = structured context built from parsed file data
```

This ensures the rubric and examples always govern LLM responses — they are not optional or cached.

---

## Password Protection

Static site, no server — protection is client-side:
- On load, check sessionStorage for `tesoro_auth` flag
- If missing: show password entry screen (full-page, Tesoro-styled)
- Password is SHA-256 hashed in JS and compared against a stored hash constant in `app.js`
- On match: set `tesoro_auth = true` in sessionStorage, proceed to app
- Password can be changed by updating the hash constant in `app.js`

**Security posture:** Sufficient for a personal tool on a private/unlisted URL. Not designed to protect against someone who can read the JS source. The real sensitive data is the Anthropic API key (which clears on tab close) and the uploaded financial files (which never leave the browser).

---

## New App Flow

```
1. Load index.html
2. Check sessionStorage for password auth
   → If missing: show password screen
   → If valid: proceed
3. Check sessionStorage for API key
   → If missing: show API key entry (one-time modal, persists in sessionStorage)
   → If present: proceed
4. Show upload drop zone (CSV / XLSX / PDF)
5. On file drop: parse with parser.js → unified transaction list stored in sessionStorage
6. Auto-trigger Financial Brief (LLM call with full dataset)
7. Nav buttons unlock: Net Worth / Investments / Spending / Budget
8. Each view: renders chart + data + triggers LLM for insight cards
```

---

## File Parsing Strategy (parser.js)

Three file types supported, detected by extension:

**CSV** — Papa Parse (CDN)
- Filename sniff to detect source: `wells`/`chase`/`bank` → headerless bank, `citi`/`amex`/`card` → credit card, `schwab`/`swb` → investment
- Fallback: generic column detection

**XLSX** — SheetJS / xlsx (CDN)
- Read workbook in browser, extract first sheet, map columns to unified schema
- Handles multi-sheet Schwab / Wells Fargo exports

**PDF** — PDF.js (CDN)
- Extract raw text per page
- Pattern-match for transaction lines (date + amount + description)
- Handles Robinhood statements, mortgage statements

All three formats normalize to the same unified transaction object:
```js
{ date, amount, description, source, type: 'bank'|'credit'|'investment' }
```

---

## Vercel Config (updated vercel.json)

```json
{
  "outputDirectory": "public",
  "rewrites": [
    { "source": "/(.*)", "destination": "/$1" }
  ]
}
```

No Python runtime. No functions block.

---

## Implementation Phases

### Phase 1 — Archive + Scaffold
- Move all Python/old JS to `_archive/`
- Create `public/index.html` (nav shell + password screen + API key modal + upload zone)
- Update `vercel.json`
- Update `CLAUDE.md`
- Milestone checkpoint

### Phase 2 — Parser + State
- Build `parser.js` (CSV / XLSX / PDF parsing — Papa Parse + SheetJS + PDF.js)
- Build `app.js` (password auth, state management, view routing)
- Store parsed data in sessionStorage

### Phase 3 — LLM Integration
- Build `llm.js` (fetch rubric/examples, build context, call Anthropic API)
- Financial Brief auto-generation on data load
- Milestone checkpoint

### Phase 4 — Views
- Build `views.js` with all 5 section renderers (Brief, Net Worth, Investments, Spending, Budget)
- Chart.js charts per view
- LLM insight cards per view
- Milestone checkpoint

### Phase 5 — Polish
- Update `css/styles.css` for new nav + sidebar
- Responsive layout
- Final CLAUDE.md + milestone update

---

## Verification
- Drop Schwab CSV → parser produces unified transactions in console
- Financial Brief renders within ~5 seconds
- All 5 nav sections load without errors
- Anthropic API key stored in sessionStorage, cleared on tab close
- `vercel --prod` deploys cleanly as static site
