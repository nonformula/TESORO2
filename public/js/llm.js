/* =========================================================
   TESORO — llm.js
   Anthropic API client + prompt assembly.
   Fetches system.md, insight_rubric.md, and
   examples/high_quality_insights.md at call time.
   Builds structured context from transaction data.
   Returns parsed insight arrays.
   ========================================================= */

const LLM = (() => {

  const MODEL = 'claude-opus-4-6';
  const API_URL = 'https://api.anthropic.com/v1/messages';

  // ── Prompt file cache ─────────────────────────────────────
  const _cache = {};

  async function fetchText(path) {
    if (_cache[path]) return _cache[path];
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
    const text = await res.text();
    _cache[path] = text;
    return text;
  }

  async function buildSystemPrompt() {
    // Files live in public/prompts/ so Vercel serves them as static assets
    const [system, rubric, examples] = await Promise.all([
      fetchText('/prompts/system.md'),
      fetchText('/prompts/insight_rubric.md'),
      fetchText('/prompts/examples/high_quality_insights.md'),
    ]);

    return `${system}

---

## Insight Quality Rubric
${rubric}

---

## High Quality Insight Examples
${examples}

---

## Response Format
Return a JSON object with this structure:
{
  "insights": [
    {
      "title": "Short, non-obvious headline",
      "priority": "high" | "medium" | "low",
      "summary": "1-2 sentence factual summary",
      "evidence": ["specific data point 1", "specific data point 2"],
      "behavioral_interpretation": "What this pattern may indicate (hedge uncertainty)",
      "recommendation": "Specific, actionable suggestion",
      "confidence": "high" | "medium" | "low"
    }
  ],
  "brief": "3-5 sentence financial brief for the Financial Brief view",
  "networth_summary": "1-2 sentence net worth commentary (if investment/bank data present)",
  "investment_summary": "1-2 sentence investment commentary (if investment data present)"
}

Return only valid JSON. No markdown fences. No preamble.`;
  }

  // ── Context builders ──────────────────────────────────────

  function filterByTimeframe(transactions, timeframe) {
    const now = new Date();
    const cutoffs = {
      '1w':  new Date(now - 7  * 86400000),
      '1mo': new Date(now - 30 * 86400000),
      '3mo': new Date(now - 90 * 86400000),
      'ytd': new Date(now.getFullYear(), 0, 1),
      'all': new Date(0),
    };
    const cutoff = cutoffs[timeframe] || cutoffs['ytd'];
    return transactions.filter(t => t.date >= cutoff);
  }

  function categorize(description) {
    const d = String(description).toLowerCase();
    if (/restaurant|grill|cafe|coffee|starbucks|mcdonald|burger|pizza|sushi|taco|diner|bistro|bar |tavern|eatery|doordash|grubhub|uber eats|seamless/.test(d)) return 'Dining';
    if (/walmart|publix|sprouts|whole foods|trader joe|kroger|aldi|costco|grocery|market|safeway|fresh/.test(d)) return 'Groceries';
    if (/amazon|target|best buy|apple store|shop|store|merchandise|retail|clothing|fashion|nordstrom|macy|tj maxx/.test(d)) return 'Shopping';
    if (/uber|lyft|gas|shell|bp |exxon|chevron|parking|metro|transit|toll|autozone|jiffy/.test(d)) return 'Transportation';
    if (/doctor|dentist|medical|pharmacy|cvs|walgreen|health|gym|yoga|fitness|vitamin|supplement/.test(d)) return 'Health';
    if (/hotel|airbnb|vrbo|delta|united|american air|southwest|booking|expedia|hilton|marriott/.test(d)) return 'Travel';
    if (/netflix|spotify|hulu|disney|apple tv|amazon prime|youtube|hbo|subscription|software|claude|openai|anthropic/.test(d)) return 'Subscriptions';
    if (/electric|gas bill|water|utility|duke|teco|pge|con ed|national grid/.test(d)) return 'Utilities';
    if (/mortgage|rent|newrez|shellpoint|insurance|state farm|allstate|geico/.test(d)) return 'Housing';
    if (/transfer|deposit|paycheck|direct dep|salary|payroll|radley|corp pay/.test(d)) return 'Income';
    if (/401k|ira|schwab|fidelity|vanguard|investment|brokerage|moneylink/.test(d)) return 'Investments';
    if (/service|professional|legal|tax|accounting|freelance|consultant/.test(d)) return 'Services';
    if (/entertainment|movie|theater|concert|sport|museum|event/.test(d)) return 'Entertainment';
    return 'Other';
  }

  function buildSpendingContext(transactions, timeframe = 'ytd') {
    const filtered = filterByTimeframe(transactions, timeframe);
    const spending = filtered.filter(t =>
      (t.type === 'credit_card' || t.type === 'bank') && t.amount > 0
    );
    const income = filtered.filter(t =>
      (t.type === 'credit_card' || t.type === 'bank') && t.amount < 0
    );

    const totalSpend = spending.reduce((s, t) => s + t.amount, 0);
    const totalIncome = Math.abs(income.reduce((s, t) => s + t.amount, 0));

    // Category breakdown
    const byCategory = {};
    spending.forEach(t => {
      const cat = categorize(t.description);
      byCategory[cat] = (byCategory[cat] || 0) + t.amount;
    });
    const topCategories = Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([cat, amt]) => ({ category: cat, amount: Math.round(amt) }));

    // Monthly breakdown
    const byMonth = {};
    spending.forEach(t => {
      const key = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}`;
      byMonth[key] = (byMonth[key] || 0) + t.amount;
    });

    // Top merchants
    const byMerchant = {};
    spending.forEach(t => {
      const key = t.description.substring(0, 30);
      byMerchant[key] = (byMerchant[key] || 0) + t.amount;
    });
    const topMerchants = Object.entries(byMerchant)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, amt]) => ({ name, amount: Math.round(amt) }));

    // Largest single charges
    const largest = [...spending]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
      .map(t => ({
        date: t.date.toISOString().split('T')[0],
        description: t.description,
        amount: Math.round(t.amount),
        category: categorize(t.description),
      }));

    return {
      timeframe,
      transaction_count: spending.length,
      total_spend: Math.round(totalSpend),
      total_income: Math.round(totalIncome),
      savings_rate: totalIncome > 0 ? Math.round(((totalIncome - totalSpend) / totalIncome) * 100) : null,
      top_categories: topCategories,
      monthly_breakdown: byMonth,
      top_merchants: topMerchants,
      largest_single_charges: largest,
      avg_transaction: spending.length > 0 ? Math.round(totalSpend / spending.length) : 0,
    };
  }

  function buildInvestmentContext(transactions) {
    const positions = transactions.filter(t => t.type === 'investment');
    if (!positions.length) return null;

    const bySymbol = {};
    positions.forEach(p => {
      const sym = p.symbol || 'UNKNOWN';
      if (!bySymbol[sym] || (p.marketValue && p.marketValue > (bySymbol[sym].marketValue || 0))) {
        bySymbol[sym] = p;
      }
    });

    const holdings = Object.values(bySymbol).map(p => ({
      symbol: p.symbol,
      description: p.description,
      marketValue: p.marketValue || p.amount || 0,
      costBasis: p.costBasis || null,
      gainDollar: p.gainDollar || null,
      gainPct: p.gainPct || null,
      account: p.account || p.source || '',
    })).filter(h => h.marketValue > 0);

    const totalValue = holdings.reduce((s, h) => s + h.marketValue, 0);
    const totalCost = holdings.reduce((s, h) => s + (h.costBasis || h.marketValue), 0);
    const totalGain = totalValue - totalCost;

    return {
      total_portfolio_value: Math.round(totalValue),
      total_cost_basis: Math.round(totalCost),
      total_gain_dollar: Math.round(totalGain),
      total_gain_pct: totalCost > 0 ? Math.round((totalGain / totalCost) * 1000) / 10 : null,
      holdings: holdings.map(h => ({
        ...h,
        marketValue: Math.round(h.marketValue),
        weight_pct: Math.round((h.marketValue / totalValue) * 1000) / 10,
      })),
    };
  }

  function buildFullContext(transactions, timeframe = 'ytd') {
    return {
      generated_at: new Date().toISOString(),
      timeframe,
      spending: buildSpendingContext(transactions, timeframe),
      investments: buildInvestmentContext(transactions),
      transaction_count_total: transactions.length,
      data_sources: [...new Set(transactions.map(t => t.source || 'unknown'))].slice(0, 10),
    };
  }

  // ── API call ──────────────────────────────────────────────

  async function callClaude(systemPrompt, userMessage, apiKey) {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic API error ${res.status}: ${err}`);
    }

    const data = await res.json();
    const raw = data.content?.[0]?.text || '';

    // Strip markdown fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

    try {
      return JSON.parse(cleaned);
    } catch (_) {
      console.error('LLM response was not valid JSON:', cleaned);
      throw new Error('LLM returned invalid JSON. Check console for raw response.');
    }
  }

  // ── Public API ────────────────────────────────────────────

  async function generateInsights(transactions, apiKey, timeframe = 'ytd') {
    const [systemPrompt, context] = await Promise.all([
      buildSystemPrompt(),
      Promise.resolve(buildFullContext(transactions, timeframe)),
    ]);

    const userMessage = `Here is the financial data to analyze:

\`\`\`json
${JSON.stringify(context, null, 2)}
\`\`\`

Generate insights following the rubric and examples. Focus on patterns that are specific, numerically grounded, and non-obvious. Return valid JSON only.`;

    return callClaude(systemPrompt, userMessage, apiKey);
  }

  async function generateBrief(transactions, apiKey) {
    const systemPrompt = await buildSystemPrompt();
    const context = buildFullContext(transactions, 'ytd');
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

    const userMessage = `Here is a financial data summary:

\`\`\`json
${JSON.stringify(context, null, 2)}
\`\`\`

Write the "brief" field only: a ${greeting} greeting followed by 3-5 sentences of sharp, specific financial observations. No generic advice. Lead with the most interesting or non-obvious pattern in the data.`;

    return callClaude(systemPrompt, userMessage, apiKey);
  }

  // Expose context builders for views.js to use client-side
  return {
    generateInsights,
    generateBrief,
    buildSpendingContext,
    buildInvestmentContext,
    buildFullContext,
    filterByTimeframe,
    categorize,
  };
})();
