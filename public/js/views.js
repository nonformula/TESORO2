/* =========================================================
   TESORO — views.js
   Render functions for all 5 sections.
   Each function receives the container element, transactions,
   optional timeframe, and the Anthropic API key.
   ========================================================= */

const Views = (() => {

  // ── Helpers ───────────────────────────────────────────────

  function fmt(n, decimals = 0) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(n);
  }

  function fmtDollar(n, decimals = 0) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    return `${sign}$${fmt(abs, decimals)}`;
  }

  function fmtPct(n) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    return `${n >= 0 ? '+' : ''}${fmt(n, 1)}%`;
  }

  function registerChart(chart) {
    if (!window._tesoroCharts) window._tesoroCharts = [];
    window._tesoroCharts.push(chart);
    return chart;
  }

  Chart.defaults.font.family = '"Space Grotesk", sans-serif';
  Chart.defaults.color = 'rgba(245,237,217,0.38)';

  const CHART_COLORS = {
    crimson: '#A33030',
    gold:    '#D4B554',
    slate:   '#5B9EC9',
    orange:  '#F05A28',
    purple:  '#C88FE0',
    forest:  '#1F4027',
    cream:   'rgba(245,237,217,0.5)',
    cream2:  'rgba(245,237,217,0.2)',
    indigo:  '#1D3B6F',
  };

  const CAT_COLORS = {
    'Dining':          '#D4B554',
    'Groceries':       '#5B9EC9',
    'Shopping':        '#F05A28',
    'Health':          '#C88FE0',
    'Travel':          '#A33030',
    'Subscriptions':   '#C88FE0',
    'Transportation':  'rgba(245,237,217,0.5)',
    'Utilities':       'rgba(245,237,217,0.35)',
    'Housing':         '#1D3B6F',
    'Services':        'rgba(245,237,217,0.4)',
    'Entertainment':   '#1F4027',
    'Other':           'rgba(245,237,217,0.2)',
  };

  function insightCard(ins) {
    const badge = ins.priority === 'high' ? 'high' : ins.priority === 'medium' ? 'medium' : 'low';
    const evidence = (ins.evidence || []).map(e => `<li style="margin-bottom:4px;opacity:0.6;font-size:11px;list-style:none;">${e}</li>`).join('');
    return `
      <div class="card card--dark" style="animation-delay:0.1s">
        <div class="card-inner insight-panel">
          <span class="insight-badge insight-badge--${badge}">${ins.priority || 'insight'}</span>
          <h3 class="insight-title">${ins.title || ''}</h3>
          <p class="insight-summary">${ins.summary || ''}</p>
          ${evidence ? `<ul style="margin-bottom:14px;padding:0;">${evidence}</ul>` : ''}
          ${ins.behavioral_interpretation ? `
            <p class="insight-section-label">Interpretation</p>
            <p class="insight-text">${ins.behavioral_interpretation}</p>
          ` : ''}
          ${ins.recommendation ? `
            <p class="insight-section-label">Recommendation</p>
            <div class="insight-rec">${ins.recommendation}</div>
          ` : ''}
          <p class="mastro-byline" style="margin-top:16px">Mastro · Confidence ${ins.confidence || 'medium'}</p>
        </div>
      </div>`;
  }

  function metricStrip(metrics) {
    const tiles = metrics.map(m => `
      <div class="metric-tile">
        <div class="metric-value ${m.color ? 'text-' + m.color : ''}">${m.value}</div>
        <div class="metric-label">${m.label}</div>
      </div>`).join('');
    return `<div class="metric-strip">${tiles}</div>`;
  }

  function catBarRow(label, amount, maxAmount, color) {
    const pct = maxAmount > 0 ? Math.min((amount / maxAmount) * 100, 100) : 0;
    return `
      <div class="cat-bar-row">
        <span class="cat-bar-label">${label}</span>
        <div class="cat-bar-track">
          <div class="cat-bar-fill" style="width:${pct}%;background:${color || 'var(--cream)'};opacity:0.7"></div>
        </div>
        <span class="cat-bar-amt">${fmtDollar(amount)}</span>
      </div>`;
  }

  // ── FINANCIAL BRIEF ───────────────────────────────────────

  async function renderBrief(container, transactions, apiKey) {
    if (!transactions.length) {
      container.innerHTML = emptyState('No data loaded. Upload financial files to generate your brief.');
      return;
    }

    const ctx = LLM.buildFullContext(transactions, 'ytd');
    const spend = ctx.spending;
    const invest = ctx.investments;

    // Render structure immediately; fetch LLM brief async
    container.innerHTML = `
      <div class="report-grid">
        <div class="card card--crimson span-2" style="animation-delay:0.05s">
          <div class="card-inner" style="min-height:280px;display:flex;flex-direction:column;justify-content:space-between;">
            <p class="card-label">Financial Brief</p>
            <div id="brief-text" class="brief-text" style="opacity:0.3">
              Generating your brief…
            </div>
            <p class="mastro-byline">Mastro · Tesoro Intelligence</p>
          </div>
        </div>
        <div class="card card--dark" style="animation-delay:0.1s">
          <div class="card-inner">
            <p class="card-label">At a Glance</p>
            ${invest ? `
              <div class="kv-row"><span class="kv-key">Portfolio</span><span class="kv-val">${fmtDollar(invest.total_portfolio_value)}</span></div>
              <div class="kv-row"><span class="kv-key">Total Gain</span><span class="kv-val text-gold">${fmtDollar(invest.total_gain_dollar)}</span></div>
            ` : ''}
            ${spend ? `
              <div class="kv-row"><span class="kv-key">YTD Spending</span><span class="kv-val">${fmtDollar(spend.total_spend)}</span></div>
              <div class="kv-row"><span class="kv-key">Transactions</span><span class="kv-val">${fmt(spend.transaction_count)}</span></div>
              <div class="kv-row"><span class="kv-key">Top Category</span><span class="kv-val">${spend.top_categories?.[0]?.category || '—'}</span></div>
            ` : ''}
          </div>
        </div>
      </div>
      ${spend ? metricStrip([
        { label: 'YTD Spend', value: fmtDollar(spend.total_spend), color: 'cream' },
        { label: 'Avg Transaction', value: fmtDollar(spend.avg_transaction), color: '' },
        { label: 'Portfolio Value', value: invest ? fmtDollar(invest.total_portfolio_value) : '—', color: 'gold' },
        { label: 'Portfolio Gain', value: invest ? fmtPct(invest.total_gain_pct) : '—', color: invest && invest.total_gain_pct >= 0 ? 'gold' : 'orange' },
      ]) : ''}
    `;

    // Fetch brief from LLM
    try {
      const result = await LLM.generateBrief(transactions, apiKey);
      const briefEl = document.getElementById('brief-text');
      if (briefEl) {
        briefEl.style.opacity = '1';
        briefEl.style.animation = 'fadeIn 0.5s ease both';
        briefEl.textContent = result.brief || 'Analysis complete.';
      }
    } catch (err) {
      const briefEl = document.getElementById('brief-text');
      if (briefEl) {
        briefEl.style.opacity = '0.5';
        briefEl.textContent = `Unable to generate brief: ${err.message}`;
      }
    }
  }

  // ── NET WORTH ─────────────────────────────────────────────

  async function renderNetWorth(container, transactions, apiKey) {
    const invest = LLM.buildInvestmentContext(transactions);
    const spend = LLM.buildSpendingContext(transactions, 'ytd');

    // Total assets = portfolio + approximate bank balance
    const portfolioValue = invest ? invest.total_portfolio_value : 0;

    // Liabilities: look for mortgage payments
    const mortgagePayments = transactions.filter(t =>
      /mortgage|newrez|shellpoint|loan/i.test(t.description) && t.amount > 0
    );
    const totalMortgagePaid = mortgagePayments.reduce((s, t) => s + t.amount, 0);

    // Simple net worth = portfolio (what we can see)
    const netWorth = portfolioValue;

    container.innerHTML = `
      <div class="report-grid">
        <div class="card card--crimson" style="animation-delay:0.05s">
          <div class="card-inner" style="min-height:260px">
            <p class="card-label">Net Worth</p>
            <div style="font-family:var(--font-serif);font-size:72px;font-weight:300;line-height:0.9;letter-spacing:-0.03em;margin:24px 0 8px;animation:numberIn 0.7s 0.3s cubic-bezier(0.22,1,0.36,1) both">
              ${fmtDollar(netWorth)}
            </div>
            <p style="font-size:11px;opacity:0.45;letter-spacing:0.06em">Based on loaded data</p>
          </div>
        </div>
        <div class="card card--forest span-2" style="animation-delay:0.1s">
          <div class="card-inner">
            <p class="card-label">Assets</p>
            ${invest ? invest.holdings.map(h => `
              <div class="kv-row">
                <span class="kv-key">${h.symbol}</span>
                <span class="kv-val">${fmtDollar(h.marketValue)}</span>
              </div>
            `).join('') : '<p style="opacity:0.35;font-size:12px">No investment data loaded</p>'}
          </div>
        </div>
      </div>
      ${metricStrip([
        { label: 'Portfolio', value: fmtDollar(portfolioValue), color: 'gold' },
        { label: 'Portfolio Gain', value: invest ? fmtDollar(invest.total_gain_dollar) : '—', color: 'gold' },
        { label: 'Mortgage Paid YTD', value: fmtDollar(totalMortgagePaid), color: '' },
        { label: 'Data Sources', value: fmt(new Set(transactions.map(t => t.source)).size), color: '' },
      ])}
      ${invest ? `
        <div class="report-grid" style="margin-top:0">
          <div class="card card--navy" style="animation-delay:0.15s">
            <div class="card-inner">
              <p class="card-label">Portfolio Allocation</p>
              <div class="chart-donut-wrap" style="margin-top:16px">
                <canvas id="networth-donut"></canvas>
              </div>
            </div>
          </div>
          <div class="card card--dark span-2" style="animation-delay:0.2s">
            <div class="card-inner">
              <p class="card-label">Holdings Detail</p>
              ${invest.holdings.map(h => catBarRow(
                h.symbol, h.marketValue, invest.total_portfolio_value,
                CAT_COLORS[h.symbol] || CHART_COLORS.slate
              )).join('')}
            </div>
          </div>
        </div>
      ` : ''}
    `;

    // Render donut
    if (invest && invest.holdings.length) {
      const canvas = document.getElementById('networth-donut');
      if (canvas) {
        const labels = invest.holdings.map(h => h.symbol);
        const data = invest.holdings.map(h => h.marketValue);
        const colors = [CHART_COLORS.slate, CHART_COLORS.crimson, CHART_COLORS.gold, CHART_COLORS.purple, CHART_COLORS.orange, CHART_COLORS.cream];
        registerChart(new Chart(canvas, {
          type: 'doughnut',
          data: { labels, datasets: [{ data, backgroundColor: colors.slice(0, labels.length), borderWidth: 0 }] },
          options: {
            cutout: '67%',
            plugins: { legend: { display: false } },
            animation: { duration: 900, easing: 'easeOutQuart' },
          },
        }));
      }
    }
  }

  // ── INVESTMENTS ───────────────────────────────────────────

  async function renderInvestments(container, transactions, apiKey) {
    const invest = LLM.buildInvestmentContext(transactions);

    if (!invest || !invest.holdings.length) {
      container.innerHTML = emptyState('No investment data found. Upload Schwab, Fidelity, or Robinhood files.');
      return;
    }

    container.innerHTML = `
      <div class="report-grid">
        <div class="card card--crimson span-2" style="animation-delay:0.05s">
          <div class="card-inner" style="min-height:220px">
            <p class="card-label">Total Portfolio</p>
            <div style="font-family:var(--font-serif);font-size:76px;font-weight:300;line-height:0.9;letter-spacing:-0.03em;margin:20px 0 8px;animation:numberIn 0.7s 0.3s cubic-bezier(0.22,1,0.36,1) both">
              ${fmtDollar(invest.total_portfolio_value)}
            </div>
            <div style="display:flex;gap:32px;margin-top:16px">
              <div>
                <p style="font-size:9px;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;opacity:0.4;margin-bottom:4px">Total Gain</p>
                <p style="font-family:var(--font-serif);font-size:22px;font-weight:300;color:var(--gold)">${fmtDollar(invest.total_gain_dollar)}</p>
              </div>
              <div>
                <p style="font-size:9px;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;opacity:0.4;margin-bottom:4px">Return</p>
                <p style="font-family:var(--font-serif);font-size:22px;font-weight:300;color:var(--gold)">${fmtPct(invest.total_gain_pct)}</p>
              </div>
              <div>
                <p style="font-size:9px;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;opacity:0.4;margin-bottom:4px">Cost Basis</p>
                <p style="font-family:var(--font-serif);font-size:22px;font-weight:300">${fmtDollar(invest.total_cost_basis)}</p>
              </div>
            </div>
          </div>
        </div>
        <div class="card card--navy" style="animation-delay:0.1s">
          <div class="card-inner">
            <p class="card-label">Allocation</p>
            <div class="chart-donut-wrap" style="margin-top:16px">
              <canvas id="invest-donut"></canvas>
            </div>
          </div>
        </div>
      </div>
      ${metricStrip([
        { label: 'Portfolio Value', value: fmtDollar(invest.total_portfolio_value), color: 'cream' },
        { label: 'Unrealized Gain', value: fmtDollar(invest.total_gain_dollar), color: 'gold' },
        { label: 'Return', value: fmtPct(invest.total_gain_pct), color: invest.total_gain_pct >= 0 ? 'gold' : 'orange' },
        { label: 'Positions', value: fmt(invest.holdings.length), color: '' },
      ])}
      <div class="report-grid" style="margin-top:0">
        <div class="card card--dark span-2" style="animation-delay:0.15s">
          <div class="card-inner">
            <p class="card-label">Holdings by Value</p>
            <div style="height:200px;margin-top:12px">
              <canvas id="invest-bars"></canvas>
            </div>
          </div>
        </div>
        <div class="card card--forest" style="animation-delay:0.2s">
          <div class="card-inner">
            <p class="card-label">Positions</p>
            ${invest.holdings.map(h => `
              <div class="kv-row">
                <span class="kv-key">${h.symbol}</span>
                <span class="kv-val" style="display:flex;flex-direction:column;align-items:flex-end;gap:2px">
                  <span>${fmtDollar(h.marketValue)}</span>
                  <span style="font-size:10px;opacity:0.5;color:${(h.gainPct || 0) >= 0 ? 'var(--gold)' : 'var(--orange)'}">${fmtPct(h.gainPct)}</span>
                </span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
      <div class="report-grid" style="margin-top:0">
        <div class="card card--dark span-3" style="animation-delay:0.25s" id="invest-insights-container">
          <div class="card-inner">
            <p class="card-label">Mastro · Investment Analysis</p>
            <p style="opacity:0.3;font-size:12px">Generating analysis…</p>
          </div>
        </div>
      </div>
    `;

    // Donut chart
    const donutCanvas = document.getElementById('invest-donut');
    if (donutCanvas) {
      const labels = invest.holdings.map(h => h.symbol);
      const data = invest.holdings.map(h => h.marketValue);
      const colors = [CHART_COLORS.slate, CHART_COLORS.crimson, CHART_COLORS.gold, CHART_COLORS.purple, CHART_COLORS.orange, CHART_COLORS.cream, CHART_COLORS.cream2];
      registerChart(new Chart(donutCanvas, {
        type: 'doughnut',
        data: { labels, datasets: [{ data, backgroundColor: colors.slice(0, labels.length), borderWidth: 0 }] },
        options: {
          cutout: '67%',
          plugins: { legend: { display: false } },
          animation: { duration: 900, easing: 'easeOutQuart' },
        },
      }));
    }

    // Bar chart
    const barCanvas = document.getElementById('invest-bars');
    if (barCanvas) {
      const sorted = [...invest.holdings].sort((a, b) => b.marketValue - a.marketValue);
      registerChart(new Chart(barCanvas, {
        type: 'bar',
        data: {
          labels: sorted.map(h => h.symbol),
          datasets: [{
            data: sorted.map(h => h.marketValue),
            backgroundColor: sorted.map((_, i) => [
              CHART_COLORS.slate, CHART_COLORS.crimson, CHART_COLORS.gold,
              CHART_COLORS.purple, CHART_COLORS.orange, CHART_COLORS.cream,
            ][i % 6]),
            borderWidth: 0,
            borderRadius: 0,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, border: { color: 'rgba(245,237,217,0.06)' }, ticks: { font: { size: 10 } } },
            y: { grid: { color: 'rgba(245,237,217,0.04)' }, border: { display: false }, ticks: { font: { size: 9 }, callback: v => '$' + fmt(v / 1000) + 'k' } },
          },
          animation: { duration: 900, easing: 'easeOutQuart' },
        },
      }));
    }

    // LLM insights
    try {
      const result = await LLM.generateInsights(transactions, apiKey, 'all');
      const el = document.getElementById('invest-insights-container');
      if (el && result.investment_summary) {
        el.innerHTML = `
          <div class="card-inner insight-panel">
            <p class="card-label">Mastro · Investment Analysis</p>
            <p class="brief-text" style="font-size:18px">${result.investment_summary}</p>
            ${(result.insights || []).filter(i => /invest|portfolio|stock|equity|btc|bitcoin/i.test(i.title + i.summary)).slice(0, 2).map(insightCard).join('')}
            <p class="mastro-byline">Mastro · Tesoro Intelligence</p>
          </div>`;
      }
    } catch (err) {
      console.error('Investment LLM error:', err);
    }
  }

  // ── SPENDING ──────────────────────────────────────────────

  async function renderSpending(container, transactions, timeframe, apiKey) {
    const ctx = LLM.buildSpendingContext(transactions, timeframe);

    if (!ctx.transaction_count) {
      container.innerHTML = emptyState('No spending data found for this timeframe.');
      return;
    }

    const topCat = ctx.top_categories[0] || {};
    const monthKeys = Object.keys(ctx.monthly_breakdown).sort();
    const monthVals = monthKeys.map(k => Math.round(ctx.monthly_breakdown[k]));

    container.innerHTML = `
      <div class="report-grid">
        <div class="card card--crimson" style="animation-delay:0.05s">
          <div class="card-inner" style="min-height:220px">
            <p class="card-label">Total Spending · ${timeframe.toUpperCase()}</p>
            <div style="font-family:var(--font-serif);font-size:72px;font-weight:300;line-height:0.9;letter-spacing:-0.03em;margin:20px 0 8px;animation:numberIn 0.7s 0.3s cubic-bezier(0.22,1,0.36,1) both">
              ${fmtDollar(ctx.total_spend)}
            </div>
            <p style="font-size:12px;opacity:0.5;letter-spacing:0.04em">${fmt(ctx.transaction_count)} transactions · avg ${fmtDollar(ctx.avg_transaction)}</p>
          </div>
        </div>
        <div class="card card--gold" style="animation-delay:0.1s">
          <div class="card-inner" style="color:#1a1208">
            <p class="card-label" style="color:#1a1208">Top Category</p>
            <div style="font-family:var(--font-serif);font-size:52px;font-weight:300;line-height:1;letter-spacing:-0.02em;margin:16px 0 8px">
              ${fmtDollar(topCat.amount || 0)}
            </div>
            <p style="font-size:14px;font-weight:600;letter-spacing:0.04em;opacity:0.7">${topCat.category || '—'}</p>
          </div>
        </div>
        <div class="card card--dark" style="animation-delay:0.15s">
          <div class="card-inner">
            <p class="card-label">Largest Single Charge</p>
            ${ctx.largest_single_charges.slice(0, 1).map(t => `
              <div style="font-family:var(--font-serif);font-size:40px;font-weight:300;color:var(--orange);line-height:1;margin:16px 0 8px;letter-spacing:-0.02em">
                ${fmtDollar(t.amount)}
              </div>
              <p style="font-size:12px;opacity:0.55;line-height:1.5">${t.description}</p>
              <p style="font-size:10px;opacity:0.35;margin-top:4px;letter-spacing:0.06em">${t.date}</p>
            `).join('')}
          </div>
        </div>
      </div>
      ${metricStrip([
        { label: 'Total Spend', value: fmtDollar(ctx.total_spend), color: 'cream' },
        { label: 'Transactions', value: fmt(ctx.transaction_count), color: '' },
        { label: 'Avg Transaction', value: fmtDollar(ctx.avg_transaction), color: '' },
        { label: 'Categories', value: fmt(ctx.top_categories.length), color: '' },
      ])}
      <div class="report-grid" style="margin-top:0">
        <div class="card card--dark span-2" style="animation-delay:0.2s">
          <div class="card-inner">
            <p class="card-label">Monthly Spend</p>
            <div style="height:180px;margin-top:12px">
              <canvas id="spending-monthly"></canvas>
            </div>
          </div>
        </div>
        <div class="card card--navy" style="animation-delay:0.25s">
          <div class="card-inner">
            <p class="card-label">By Category</p>
            <div class="chart-donut-wrap" style="margin-top:12px">
              <canvas id="spending-donut"></canvas>
            </div>
          </div>
        </div>
      </div>
      <div class="report-grid" style="margin-top:0">
        <div class="card card--dark span-3" style="animation-delay:0.3s">
          <div class="card-inner">
            <p class="card-label">Category Breakdown</p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 32px;margin-top:12px">
              ${ctx.top_categories.map(c => catBarRow(
                c.category, c.amount, ctx.top_categories[0].amount,
                CAT_COLORS[c.category] || CHART_COLORS.slate
              )).join('')}
            </div>
          </div>
        </div>
      </div>
      <div class="report-grid" style="margin-top:0">
        <div class="card card--dark span-3" style="animation-delay:0.35s">
          <div class="card-inner">
            <p class="card-label">Top Merchants</p>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0 24px;margin-top:12px">
              ${ctx.top_merchants.slice(0, 9).map(m => catBarRow(
                m.name, m.amount, ctx.top_merchants[0].amount, CHART_COLORS.slate
              )).join('')}
            </div>
          </div>
        </div>
      </div>
      <div id="spending-insights" class="report-grid" style="margin-top:0">
        <div class="card card--dark span-3" style="animation-delay:0.4s">
          <div class="card-inner">
            <p class="card-label">Mastro · Spending Insights</p>
            <p style="opacity:0.3;font-size:12px">Generating insights…</p>
          </div>
        </div>
      </div>
    `;

    // Monthly bar chart
    const monthCanvas = document.getElementById('spending-monthly');
    if (monthCanvas && monthKeys.length) {
      registerChart(new Chart(monthCanvas, {
        type: 'bar',
        data: {
          labels: monthKeys.map(k => {
            const [y, m] = k.split('-');
            return new Date(parseInt(y), parseInt(m) - 1).toLocaleString('en-US', { month: 'short' });
          }),
          datasets: [{
            data: monthVals,
            backgroundColor: monthVals.map((v, i) => i === monthVals.indexOf(Math.max(...monthVals)) ? CHART_COLORS.orange : CHART_COLORS.slate),
            borderWidth: 0,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, border: { color: 'rgba(245,237,217,0.06)' }, ticks: { font: { size: 9 } } },
            y: { grid: { color: 'rgba(245,237,217,0.04)' }, border: { display: false }, ticks: { font: { size: 9 }, callback: v => '$' + fmt(v / 1000) + 'k' } },
          },
          animation: { duration: 900, easing: 'easeOutQuart' },
        },
      }));
    }

    // Category donut
    const donutCanvas = document.getElementById('spending-donut');
    if (donutCanvas) {
      const cats = ctx.top_categories.slice(0, 8);
      registerChart(new Chart(donutCanvas, {
        type: 'doughnut',
        data: {
          labels: cats.map(c => c.category),
          datasets: [{
            data: cats.map(c => c.amount),
            backgroundColor: cats.map(c => CAT_COLORS[c.category] || CHART_COLORS.cream2),
            borderWidth: 0,
          }],
        },
        options: {
          cutout: '67%',
          plugins: { legend: { display: false } },
          animation: { duration: 900, easing: 'easeOutQuart' },
        },
      }));
    }

    // LLM insights
    try {
      const result = await LLM.generateInsights(transactions, apiKey, timeframe);
      const insightsEl = document.getElementById('spending-insights');
      if (insightsEl && result.insights?.length) {
        insightsEl.innerHTML = `
          <div class="report-grid" style="margin-top:0">
            ${result.insights.slice(0, 3).map(insightCard).join('')}
          </div>`;
      }
    } catch (err) {
      console.error('Spending LLM error:', err);
    }
  }

  // ── BUDGET ────────────────────────────────────────────────

  async function renderBudget(container, transactions, timeframe, apiKey) {
    const ctx = LLM.buildSpendingContext(transactions, timeframe);
    const filtered = LLM.filterByTimeframe(transactions, timeframe);

    // Inflows
    const income = filtered.filter(t => t.amount < 0 && (t.type === 'bank' || t.type === 'credit_card'));
    const totalIncome = Math.abs(income.reduce((s, t) => s + t.amount, 0));

    // Category spending
    const catTotals = {};
    filtered.filter(t => t.amount > 0).forEach(t => {
      const cat = LLM.categorize(t.description);
      catTotals[cat] = (catTotals[cat] || 0) + t.amount;
    });

    const BUDGET_CATEGORIES = {
      'Inflow': ['Income', 'Investments'],
      'Taxes': ['Services'],
      'Fixed Payments': ['Housing', 'Utilities', 'Subscriptions'],
      'Dining / Food': ['Dining', 'Groceries'],
      'Transportation': ['Transportation'],
      'Health': ['Health'],
      'Discretionary': ['Shopping', 'Entertainment', 'Travel', 'Other'],
    };

    function sumCats(cats) {
      return cats.reduce((s, c) => s + (catTotals[c] || 0), 0);
    }

    const budgetGroups = Object.entries(BUDGET_CATEGORIES).map(([group, cats]) => ({
      group,
      amount: sumCats(cats),
      categories: cats.map(c => ({ name: c, amount: catTotals[c] || 0 })).filter(c => c.amount > 0),
    })).filter(g => g.amount > 0);

    const totalSpend = ctx.total_spend;
    const maxGroup = Math.max(...budgetGroups.map(g => g.amount));

    container.innerHTML = `
      <div class="report-grid">
        <div class="card card--crimson" style="animation-delay:0.05s">
          <div class="card-inner" style="min-height:200px">
            <p class="card-label">Inflow · ${timeframe.toUpperCase()}</p>
            <div style="font-family:var(--font-serif);font-size:68px;font-weight:300;line-height:0.9;letter-spacing:-0.03em;margin:20px 0 8px;animation:numberIn 0.7s 0.3s cubic-bezier(0.22,1,0.36,1) both">
              ${fmtDollar(totalIncome || sumCats(['Income']))}
            </div>
          </div>
        </div>
        <div class="card card--gold" style="animation-delay:0.1s">
          <div class="card-inner" style="color:#1a1208">
            <p class="card-label" style="color:#1a1208">Outflow · ${timeframe.toUpperCase()}</p>
            <div style="font-family:var(--font-serif);font-size:68px;font-weight:300;line-height:0.9;letter-spacing:-0.03em;margin:20px 0 8px;animation:numberIn 0.7s 0.4s cubic-bezier(0.22,1,0.36,1) both">
              ${fmtDollar(totalSpend)}
            </div>
          </div>
        </div>
        <div class="card card--forest" style="animation-delay:0.15s">
          <div class="card-inner">
            <p class="card-label">Savings Rate</p>
            <div style="font-family:var(--font-serif);font-size:68px;font-weight:300;line-height:0.9;letter-spacing:-0.03em;margin:20px 0 8px;animation:numberIn 0.7s 0.5s cubic-bezier(0.22,1,0.36,1) both">
              ${ctx.savings_rate !== null ? fmtPct(ctx.savings_rate) : '—'}
            </div>
          </div>
        </div>
      </div>
      ${metricStrip([
        { label: 'Total Inflow', value: fmtDollar(totalIncome || sumCats(['Income'])), color: 'cream' },
        { label: 'Total Outflow', value: fmtDollar(totalSpend), color: '' },
        { label: 'Fixed Costs', value: fmtDollar(sumCats(['Housing', 'Utilities', 'Subscriptions'])), color: '' },
        { label: 'Discretionary', value: fmtDollar(sumCats(['Shopping', 'Entertainment', 'Travel', 'Dining'])), color: 'gold' },
      ])}
      <div class="report-grid" style="margin-top:0">
        <div class="card card--dark span-2" style="animation-delay:0.2s">
          <div class="card-inner">
            <p class="card-label">Budget Breakdown</p>
            <div style="margin-top:12px">
              ${budgetGroups.map(g => `
                <div style="margin-bottom:20px">
                  <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">
                    <span style="font-size:10px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;opacity:0.55">${g.group}</span>
                    <span style="font-family:var(--font-serif);font-size:18px;font-weight:300">${fmtDollar(g.amount)}</span>
                  </div>
                  ${catBarRow(g.group, g.amount, maxGroup, g.group === 'Inflow' ? CHART_COLORS.forest : CHART_COLORS.slate)}
                  ${g.categories.map(c => `
                    <div class="kv-row" style="padding:5px 0;border-bottom:none;margin-left:16px">
                      <span class="kv-key" style="font-size:9px;opacity:0.28">${c.name}</span>
                      <span class="kv-val" style="font-size:13px;opacity:0.55">${fmtDollar(c.amount)}</span>
                    </div>
                  `).join('')}
                </div>
              `).join('')}
            </div>
          </div>
        </div>
        <div class="card card--navy" style="animation-delay:0.25s">
          <div class="card-inner">
            <p class="card-label">Budget Chart</p>
            <div style="height:260px;margin-top:12px">
              <canvas id="budget-bars"></canvas>
            </div>
          </div>
        </div>
      </div>
      <div id="budget-insights" class="report-grid" style="margin-top:0">
        <div class="card card--dark span-3" style="animation-delay:0.3s">
          <div class="card-inner">
            <p class="card-label">Mastro · Budget Insights</p>
            <p style="opacity:0.3;font-size:12px">Generating insights…</p>
          </div>
        </div>
      </div>
    `;

    // Budget bar chart
    const budgetCanvas = document.getElementById('budget-bars');
    if (budgetCanvas && budgetGroups.length) {
      const outflowGroups = budgetGroups.filter(g => g.group !== 'Inflow').slice(0, 8);
      registerChart(new Chart(budgetCanvas, {
        type: 'bar',
        data: {
          labels: outflowGroups.map(g => g.group),
          datasets: [{
            data: outflowGroups.map(g => g.amount),
            backgroundColor: outflowGroups.map((g, i) => [
              CHART_COLORS.indigo, CHART_COLORS.gold, CHART_COLORS.slate,
              CHART_COLORS.purple, CHART_COLORS.orange, CHART_COLORS.crimson,
              CHART_COLORS.cream, CHART_COLORS.forest,
            ][i]),
            borderWidth: 0,
          }],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: 'rgba(245,237,217,0.04)' }, border: { display: false }, ticks: { font: { size: 8 }, callback: v => '$' + fmt(v / 1000) + 'k' } },
            y: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 9 } } },
          },
          animation: { duration: 900, easing: 'easeOutQuart' },
        },
      }));
    }

    // LLM insights
    try {
      const result = await LLM.generateInsights(transactions, apiKey, timeframe);
      const insightsEl = document.getElementById('budget-insights');
      if (insightsEl && result.insights?.length) {
        insightsEl.innerHTML = `
          <div class="report-grid" style="margin-top:0">
            ${result.insights.slice(0, 3).map(insightCard).join('')}
          </div>`;
      }
    } catch (err) {
      console.error('Budget LLM error:', err);
    }
  }

  // ── Empty state ───────────────────────────────────────────
  function emptyState(msg) {
    return `<div style="padding:60px 40px;text-align:center;opacity:0.35;font-size:13px;letter-spacing:0.04em;line-height:1.6">${msg}</div>`;
  }

  return { renderBrief, renderNetWorth, renderInvestments, renderSpending, renderBudget };
})();
