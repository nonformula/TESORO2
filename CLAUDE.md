# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## What This Is
Tesoro is a personal financial insight web app. Users drop CSV, XLSX, or PDF exports from their bank, investment, credit card, and retirement accounts into the browser. JavaScript parses the files client-side, builds a structured context, and sends it to the Anthropic API. The AI advisor (named **Mastro**) returns insight cards rendered on a multi-section dashboard. **No server. No Python. No build step.**

---

## Architecture

**Pure static site.** All logic runs in the browser.

```
User drops files (CSV / XLSX / PDF)
    ↓
parser.js → unified transaction array (sessionStorage)
    ↓
llm.js → fetches system.md + insight_rubric.md + examples/high_quality_insights.md
       → builds structured context
       → fetch() → api.anthropic.com (claude-opus-4-6)
    ↓
views.js → renders insight cards + Chart.js charts
```

**No server. No Python. No build step.** Deployed as static files on Vercel.

---

## Local Development

Serve from the `public/` directory so absolute paths (`/assets/`, `/prompts/`) resolve correctly:
```bash
npx serve public -l 3003
# then visit http://localhost:3003
```

There is no build step, no npm install required for development. CDN libraries load from the internet.

---

## Deployment (Vercel)

```bash
vercel --prod
```

`outputDirectory` is `public`. No functions, no runtime.

---

## Stack
- **Frontend**: HTML, CSS, JavaScript (vanilla) — served as static files from `public/`
- **AI**: Anthropic Claude via browser `fetch()` → `api.anthropic.com` (`claude-opus-4-6`)
- **File parsing**: Papa Parse (CSV), SheetJS/xlsx (XLSX), PDF.js (PDF) — all CDN
- **Charts**: Chart.js (CDN)
- **Host**: Vercel (static only)

---

## Authentication

Two-step on page load:

1. **Password screen** — SHA-256 hash comparison in `app.js`. Hash constant is `PASS_HASH`. Default password is `tesoro`. To change: run `echo -n "newpassword" | shasum -a 256` and update the constant.
2. **API key modal** — User enters their Anthropic API key. Stored in `sessionStorage` only (clears on tab close). Never sent anywhere except `api.anthropic.com`.

Both states stored in `sessionStorage` — cleared when tab closes.

---

## File Structure

```
public/
  index.html          ← single-page app shell (main app)
  mortgage.html       ← standalone mortgage report (Newrez loan)
  spending-march.html ← standalone Citi March 2026 spending report
  spending-amex.html  ← standalone Amex spending report
  spending-ytd.html   ← standalone Citi YTD spending report
  net-worth.html      ← standalone net worth report
  investments.html    ← standalone investments report
  style-guide.html    ← interactive design system reference
  css/
    styles.css        ← design system tokens + card components
    app.css           ← app UI: auth screens, sidebar, upload zone, views
  js/
    parser.js         ← CSV/XLSX/PDF parsing → unified transaction schema
    llm.js            ← Anthropic API client + prompt assembly
    views.js          ← render functions for all 5 sections
    app.js            ← main controller: auth, state, navigation, routing
  assets/
    design/png/       ← logo files
    ai_gens/          ← background images

public/prompts/
  system.md                     ← Mastro persona + AI instructions (fetched at runtime)
  insight_rubric.md             ← quality criteria for insights (fetched at runtime)
  examples/
    high_quality_insights.md    ← few-shot examples (fetched at runtime)

assets/
  data/raw/           ← sample financial data for development

_archive/             ← archived Python v2 backend (reference only, not active)
  api/                ← old Flask endpoints
  analytics/          ← old Python analytics modules
  orchestrator/       ← old LLM orchestration
  schemas/            ← old JSON output schema
  public/             ← old HTML/JS files
```

---

## Navigation (from TESORO_FUNCTIONS.md)

Five sections, rendered as views in `index.html`:

| View key | Label | Content |
|---|---|---|
| `brief` | Financial Brief | Auto-generated 3-5 sentence summary (LLM) |
| `networth` | Net Worth | Assets minus liabilities |
| `investments` | Investments | Portfolio: stocks, BTC, property |
| `spending` | Spending | Transaction analysis; 1w/1mo/3mo/YTD toggle |
| `budget` | Budget | Inflow / Outflow / Savings by category |

---

## Key JS Module Responsibilities

| File | Key responsibility |
|---|---|
| `parser.js` | Detect file type by extension; normalize all formats to `{ date, amount, description, source, type }` |
| `llm.js` | Fetch prompt files; build context object; call Anthropic API; return parsed insight array |
| `views.js` | Render each section's HTML + Chart.js charts from state data |
| `app.js` | Password auth; API key management; file drop handling; nav routing; state in sessionStorage |

---

## LLM Prompt Assembly

Every LLM call in `llm.js` assembles the system prompt from three files fetched at runtime:
```
public/prompts/system.md
public/prompts/insight_rubric.md
public/prompts/examples/high_quality_insights.md
```

**Never hardcode prompt text in JS.** Edit those three files to change Mastro's behavior. The rubric and examples govern every response. Files must stay in `public/prompts/` so Vercel can serve them.

---

## Design System

All tokens and card components are in `public/css/styles.css`. App-specific UI (auth, sidebar, upload, views) is in `public/css/app.css`. All design decisions reference `TESORO_STYLE_GUIDE.md`.

| Token | Value | Use |
|---|---|---|
| `--crimson` | `#A33030` | Hero cards, brand accents |
| `--cream` | `#F5EDD9` | Text on dark, light card backgrounds |
| `--navy` | `#06042A` | Investment/portfolio cards |
| `--gold` | `#D4B554` | Spending insight cards |
| `--orange` | `#F05A28` | Anomaly highlights |
| `--slate` | `#5B9EC9` | Chart accents |
| `--indigo` | `#1D3B6F` | Fixed/structural cost cards |
| `--forest` | `#1F4027` | Growth/investment cards |
| `--purple` | `#C88FE0` | AI-specific callouts |

**Fonts:** IvyJournal (Adobe Typekit `jal8uea`, weight 300) for all financial figures. Space Grotesk for UI/labels. CSS family name is `"ivyjournal"` — no hyphen.

**Zero border-radius. Zero gap between cards. No shadows.**

---

## CSV Source Detection (parser.js)

`detectSource` runs keyword checks in priority order — investment/mortgage before bank, so `wells_investments.xls` routes to investment not bank.

| Source type | Filename hints | Parser function | Notes |
|---|---|---|---|
| `mortgage` | `mortgage`, `newrez`, `shellpoint` | `parseMortgageCSV` | Amortization log → housing expenses |
| `investment` | `schwab`, `swb`, `fidelity`, `robinhood`, `invest`, `portfolio` | `parseInvestmentCSV` | Auto-detects positions vs. activity log by checking for `record_type` header |
| `retirement` | `401k`, `retirement`, `ira` | — | |
| `credit_card` | `citi`, `amex`, `visa`, `card`, `credit` | `parseCreditCSV` | Scans first 5 rows to find header (Citi prepends a metadata preamble row) |
| `bank` | `wells`, `chase`, `checking`, `savings` | `parseBankHeaderCSV` or `parseBankCSV` | Header CSV negates amounts (bank: negative = spending → flip to match credit convention) |

**Amount sign convention throughout `llm.js`:** spending is positive. Bank CSVs negate on ingest to match credit card convention.

**Citi date format:** `"Mar 14, 2026"` — handled by the `Mon DD, YYYY` branch in `parseDate`.

---

## Runtime Implementation Notes

- **Direct browser API calls** require the header `anthropic-dangerous-direct-browser-access: true` — already set in `llm.js`. Without it, `api.anthropic.com` rejects browser requests.
- **Chart.js instances** are tracked in `window._tesoroCharts` and destroyed on each view switch to prevent canvas reuse errors.
- **Prompt file cache** — `_cache` object in `llm.js` persists fetched prompt files for the tab session (one HTTP request per file per tab).
- **State object** in `app.js` holds `transactions`, `fileResults`, `currentView`, `currentTimeframe`, `apiKey`.

---

## Session Continuity

**At the start of each session, read `milestone.md`** — it tracks build state, what's complete, known issues, and planned next steps. Update it when milestones are reached.

---

## Key Conventions
- No server-side logic. Everything runs in the browser.
- All financial data stays in `sessionStorage` — cleared on tab close.
- Anthropic API key stored in `sessionStorage` only — never `localStorage`.
- Edit `system.md`, `insight_rubric.md`, `examples/` to change LLM behavior — not JS.
- All design decisions reference `TESORO_STYLE_GUIDE.md`.
