# Tesoro — Design System & Style Guide

> **Aesthetic principle:** Private intelligence briefing. Editorial, ceremonial, dark and rich. Not a fintech dashboard. Every screen should feel like a well-designed annual report, not an app.

---

## 1. Brand Identity

### Name & Voice
- Product name: **Tesoro** (Italian for "treasure")
- AI advisor name: **Mastro**
- Tone: Quiet authority. Concise. Never exclamatory. Never gamified.
- Avoid: rounded corners, emojis, bright CTAs, progress bars with color fills, confetti

### Logo
- Full wordmark: IvyJournal light on crimson background — use for print / hero contexts
- Icon mark: crimson square with cream "T" serif — use in nav, favicons, app icons
- Minimum size: 28×28px for icon mark
- Never place the logo on a light background — always dark or crimson

```
Logo files:
  assets/design/png/tesoro_logo_01.png       ← full wordmark
  assets/design/png/tesoro_logo_icon_01.png  ← icon mark (T)
```

---

## 2. Color System

All tokens are defined as CSS custom properties in `public/css/styles.css`.

### Primary Palette

| Token | Hex | Usage |
|---|---|---|
| `--crimson` | `#A33030` | Primary brand color. Hero cards, logo bg, primary buttons, key accents |
| `--crimson-dk` | `#7E2323` | Hover state for crimson elements |
| `--crimson-lt` | `#C44040` | Active/focus crimson |
| `--cream` | `#F5EDD9` | Primary text color on dark. Card backgrounds in light contexts |
| `--cream-dim` | `rgba(245,237,217,0.55)` | Subdued cream for secondary elements |
| `--near-black` | `#111111` | Page background |
| `--surface` | `#181818` | Elevated surface (dark cards) |
| `--surface-hi` | `#222222` | Hover state for dark surfaces |

### Secondary / Semantic Palette

| Token | Hex | Usage |
|---|---|---|
| `--navy` | `#06042A` | Investment/portfolio cards, deep panels |
| `--navy-mid` | `#0B083E` | Navy hover / gradient stop |
| `--gold` | `#D4B554` | Spending cards, accent highlights, recommendations |
| `--gold-dk` | `#B89A3C` | Gold hover |
| `--gold-lt` | `#E8CC72` | Medium-priority badge text |
| `--orange` | `#F05A28` | Anomaly highlights, warnings, biggest charge callouts |
| `--slate` | `#5B9EC9` | Chart accents, secondary data lines |
| `--purple` | `#C88FE0` | AI-specific callouts (subscriptions, Mastro panel) |
| `--forest` | `#1F4027` | Investment / growth contexts |
| `--indigo` | `#1D3B6F` | Recurring charges, structural/fixed costs |

### Borders & Overlays

| Token | Value | Usage |
|---|---|---|
| `--border` | `rgba(245,237,217,0.07)` | Default card border, dividers |
| `--border-hi` | `rgba(245,237,217,0.14)` | Focus state borders, hover borders |

### Card Color Map

| Card class | Background | Text | Typical use |
|---|---|---|---|
| `.card--crimson` | `--crimson` | `--cream` | Hero, primary KPI |
| `.card--navy` | `--navy` | `--cream` | Portfolio, donut charts |
| `.card--gold` | `--gold` | `#1a1208` | Spending insights, top category |
| `.card--forest` | `--forest` | `--cream` | Investment, growth |
| `.card--indigo` | `--indigo` | `--cream` | Recurring, structural costs |
| `.card--dark` | `--surface` + `--border` | `--cream` | Data tables, charts, details |

> **Gold card rule:** Text and labels on gold cards must use `#1a1208` (near-black), not `--cream`. Opacity modifiers apply to this dark value, not cream.

---

## 3. Typography

### Typefaces

| Role | Family | Source | Weight | CSS name |
|---|---|---|---|---|
| Display / Headlines | IvyJournal | Adobe Typekit `jal8uea` | 300 (Light) | `"ivyjournal"` |
| UI / Data / Body | Space Grotesk | Google Fonts | 300, 400, 500, 600 | `"Space Grotesk"` |

```html
<!-- Load order — always both, always in <head> -->
<link rel="stylesheet" href="https://use.typekit.net/jal8uea.css" />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600&display=swap" />
```

```css
--font-serif: "ivyjournal", Georgia, serif;
--font-sans:  "Space Grotesk", "Inter", sans-serif;
```

> **Critical:** The Adobe Typekit CSS family name is `"ivyjournal"` — **no hyphen**. `"ivy-journal"` will silently fall back to Georgia.

### Type Scale

| Element | Font | Size | Weight | Letter-spacing | Notes |
|---|---|---|---|---|---|
| Hero number | serif | 76–84px | 300 | `-0.04em` | Main KPI, one per page |
| Large stat | serif | 52–68px | 300 | `-0.03em` | Card primary value |
| Medium stat | serif | 26–32px | 300 | `-0.02em` | Secondary metric |
| Small stat | serif | 18–24px | 300 | `-0.01em` | Table value, kv-row |
| Micro stat | serif | 14–16px | 300 | `-0.01em` | Merchant amounts, inline figures |
| Card label | sans | 9px | 500 | `0.18em` | UPPERCASE, opacity 0.45 |
| Body / note | sans | 12–13px | 400 | normal | Line height 1.55–1.65 |
| Caption | sans | 10–11px | 400–500 | `0.04–0.08em` | Subtitles, hints |
| Badge / tag | sans | 8–9px | 700 | `0.12–0.14em` | UPPERCASE |

### Rules
- **All large numbers use IvyJournal** — never Space Grotesk for financial figures
- **All labels are UPPERCASE** with generous letter-spacing (`0.12–0.18em`)
- **Opacity as hierarchy:** primary text at 100%, secondary at 45–55%, tertiary at 28–38%
- No bold numbers — weight 300 (light) is the brand voice for figures
- No text shadows

---

## 4. Spacing & Shape

```css
--radius:    0px;   /* No rounded corners anywhere */
--radius-lg: 0px;   /* No rounded corners anywhere */
--gap:       0px;   /* Cards are flush — no gutters */
--gap-lg:    0px;
```

### Rules
- **Zero border radius** — the design is editorial, architectural. Rounded corners signal "app"; sharp edges signal "document."
- **Zero gap between cards** — the grid is a single unified surface, not a collection of floating tiles
- **No drop shadows** — `--shadow-card: none`, `--shadow-hover: none`
- **No glow effects** — `--glow-crimson: none`, `--glow-gold: none`
- Hover: `transform: translateY(-2px)` only — subtle lift, no shadow

---

## 5. Layout System

### Page Structure
```
<nav>            ← always top, border-bottom: 1px solid --border
<div.report-grid> ← 3-column CSS grid, max-width 1400px, margin auto
<div.metric-strip> ← 4-column strip, border-top: 1px solid --border
```

### Grid
```css
.report-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0;
  max-width: 1400px;
  margin: 0 auto;
}
```

**Breakpoints:**
- `>1080px` → 3 columns
- `≤1080px` → 2 columns (right column spans 2)
- `≤640px` → 1 column

### Full-width card
```html
<div class="card card--dark" style="grid-column: span 3">
```

### Metric Strip
4 equal tiles, flush, border-top, border-right between tiles:
```css
.metric-strip {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border-top: 1px solid var(--border);
}
```

---

## 6. Component Patterns

### Nav
```html
<nav class="dash-nav">
  <div class="logo">
    <img src="../assets/design/png/tesoro_logo_icon_01.png" class="logo-icon" />
    <span class="logo-text">Tesoro</span>
  </div>
  <div class="dash-nav-right">
    <!-- context label: "Citi Card-1188 · March 2026" -->
  </div>
</nav>
```
- Logo icon: 28×28px
- Logo text: 20px, IvyJournal, weight 300
- Nav right label: 10px, UPPERCASE, opacity 0.28

### Card Anatomy
```html
<div class="card card--[variant]" style="animation-delay:0.Xs">
  <div class="card-art-bg"></div>      <!-- optional: image background -->
  <div class="card-art-overlay"></div> <!-- optional: gradient overlay -->
  <div class="card-inner">
    <p class="card-label">LABEL TEXT</p>
    <!-- content -->
  </div>
</div>
```

### Card Label
```css
.card-label {
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  opacity: 0.45;
  margin-bottom: 10px;
}
```

### Key-Value Row (used in detail cards)
```html
<div class="kv-row">
  <span class="kv-key">LABEL</span>
  <span class="kv-val">Value</span>
</div>
```

### Horizontal Bar Row (category breakdown)
```html
<div class="cat-bar-row">
  <span class="cat-bar-label">Category</span>
  <div class="cat-bar-track">
    <div class="cat-bar-fill" style="width:81%;background:var(--gold)"></div>
  </div>
  <span class="cat-bar-amt">$1,504</span>
</div>
```
Bar height: 3–4px. Track background: `rgba(245,237,217,0.07)`.

### Metric Tile (in strip)
```html
<div class="metric-tile">
  <div class="metric-value text-gold">$8,503</div>
  <div class="metric-label">Total Spend</div>
</div>
```

### Insight Badge
```html
<span class="insight-badge insight-badge--high">High</span>
<span class="insight-badge insight-badge--medium">Medium</span>
<span class="insight-badge insight-badge--low">Low</span>
```

---

## 7. Animation System

All entry animations use `animation: X both` (fills forward on complete):

| Keyframe | Use | Typical duration |
|---|---|---|
| `cardIn` | Card entry — fade + translateY(18px) | 0.6s |
| `fadeIn` | Nav, labels, subtitles | 0.4–0.5s |
| `slideUp` | Content blocks, input panels | 0.6s |
| `numberIn` | Hero KPI numbers — fade + scale(0.96) | 0.7s |
| `pulse` | Loading dots | 1.4s infinite |

**Stagger pattern:**
```
Card 1: delay 0.05s
Card 2: delay 0.10s
Card 3: delay 0.15s
Card 4: delay 0.20s
Card 5: delay 0.25s
Card 6: delay 0.30s
Metric strip: delay 0.40–0.55s
```

**Easing:** `cubic-bezier(0.22, 1, 0.36, 1)` — iOS spring feel, always.

---

## 8. Texture

### Grain Overlay
Applied globally via `body::before`:
```css
body::before {
  content: "";
  position: fixed;
  inset: 0;
  background-image: url("data:image/svg+xml,...fractalNoise...");
  background-size: 180px 180px;
  opacity: 0.028;
  pointer-events: none;
  z-index: 9999;
}
```
This adds richness and tactility without visible noise. Never increase opacity above 0.04.

---

## 9. Charts (Chart.js)

All charts use the Tesoro color palette. Configure these defaults at page load:

```js
Chart.defaults.font.family = '"Space Grotesk", sans-serif';
Chart.defaults.color = 'rgba(245,237,217,0.38)';
```

### Chart color assignments

| Data type | Color |
|---|---|
| Interest / debt | `#A33030` (crimson) |
| Principal / equity | `#5B9EC9` (slate) |
| Top category / restaurant | `#D4B554` (gold) |
| Health / warning | `#F05A28` (orange) |
| AI / special | `#C88FE0` (purple) |
| Lodging | `#A33030` (crimson) |
| Services / neutral | `rgba(245,237,217,0.5)` |
| Vehicle / misc | `rgba(245,237,217,0.2)` |

### Chart style rules
- `borderWidth: 0` — no bar or segment borders
- Grid lines: `rgba(245,237,217,0.04–0.05)` — barely visible
- Axis border on x: `rgba(245,237,217,0.06–0.08)`
- Axis border on y: `display: false`
- Ticks: `font: { size: 9–10 }`, format with `$` prefix
- Donut cutout: `66–68%`
- Animation: `duration: 900, easing: 'easeOutQuart'`
- Legends: hidden by default; use custom HTML legends when needed

---

## 10. Utility Classes

```css
.text-orange { color: var(--orange); }
.text-gold   { color: var(--gold); }
.text-cream  { color: var(--cream); }
.text-slate  { color: var(--slate); }
.hidden      { display: none !important; }
```

---

## 11. What Not To Do

| Don't | Why |
|---|---|
| Add `border-radius` | Destroys editorial feel |
| Add `box-shadow` or `glow` | Makes it look like a consumer app |
| Use bold or heavy font weights for numbers | IvyJournal light is the brand |
| Use color fills for progress/ring indicators | Use opacity and position only |
| Use emojis in UI | Not consistent with tone |
| Use white `#FFFFFF` backgrounds | Always `--near-black` or card variants |
| Use more than 2 fonts | Only ivyjournal + Space Grotesk |
| Apply gap between cards | Grid is flush — unified surface |
| Place logo on light backgrounds | Crimson or dark only |
| Increase grain opacity above 0.04 | Becomes visible noise |

---

## 12. File Reference

```
public/
  css/styles.css          ← single source of truth for all tokens and components
  login.html              ← login page pattern
  upload.html             ← file upload page pattern
  dashboard.html          ← main dashboard pattern
  mortgage.html           ← mortgage report pattern (reference)
  spending-march.html     ← spending report pattern (reference)
  style-guide.html        ← this visual style guide

assets/
  design/png/
    tesoro_logo_01.png         ← full wordmark
    tesoro_logo_icon_01.png    ← T icon mark
    tesoro_color_01.png        ← color swatch reference
  ai_gens/
    landscape2.png             ← hero card / login background
    royal_clothes1.png         ← Mastro panel background
```

---

*Tesoro Design System · Last updated April 2026*
