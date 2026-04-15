/* dashboard.js — Card rendering + Chart.js initialization */

const ANALYTICS_KEY    = "tesoro_analytics";
const TRANSACTIONS_KEY = "tesoro_transactions";

/* ── Auth guard ────────────────────────────────────────── */
if (!requireAuth()) { /* auth.js redirects */ }

/* ── Date + time-of-day greeting ───────────────────────── */
(function setDate() {
  const dateEl     = document.getElementById("heroDate");
  const greetingEl = document.querySelector(".hero-greeting");
  const now        = new Date();

  if (dateEl) {
    const opts = { month: "long", day: "numeric", year: "numeric" };
    dateEl.textContent = now.toLocaleDateString("en-US", opts);
  }

  if (greetingEl) {
    const h = now.getHours();
    if (h < 12)      greetingEl.textContent = "Good morning.";
    else if (h < 17) greetingEl.textContent = "Good afternoon.";
    else             greetingEl.textContent = "Good evening.";
  }
})();

/* ── Formatting helpers ────────────────────────────────── */
function fmt$(n) {
  if (n == null || isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  }).format(n);
}

function fmtPct(n) {
  if (n == null || isNaN(n)) return "—";
  return (n * 100).toFixed(1) + "%";
}

/* ── Load analytics from sessionStorage ────────────────── */
const analytics = JSON.parse(sessionStorage.getItem(ANALYTICS_KEY) || "null");

if (analytics) {
  renderMetrics(analytics);
  renderSpendingCard(analytics);
  renderCharts(analytics);
} else {
  // No data yet — show prompt state
  document.getElementById("heroSubtitle").textContent =
    "Import your CSV files to see your financial picture.";
}

/* ── Metrics card ──────────────────────────────────────── */
function renderMetrics(data) {
  const s = data.summary || {};

  const income   = document.getElementById("metricIncome");
  const spend    = document.getElementById("metricSpend");
  const savings  = document.getElementById("metricSavings");
  const rate     = document.getElementById("metricRate");

  if (income)  income.textContent  = fmt$(s.monthly_income);
  if (spend)   spend.textContent   = fmt$(s.monthly_spend);
  if (savings) savings.textContent = fmt$(s.monthly_savings);
  if (rate)    rate.textContent    = fmtPct(s.savings_rate);

  // Hero number = savings rate %
  const heroNum = document.getElementById("heroNumber");
  const heroSub = document.getElementById("heroSubtitle");
  if (heroNum) heroNum.textContent = fmtPct(s.savings_rate);
  if (heroSub) heroSub.textContent =
    s.monthly_savings >= 0
      ? `You saved ${fmt$(s.monthly_savings)} this period.`
      : `You spent ${fmt$(Math.abs(s.monthly_savings))} more than you earned.`;
}

/* ── Spending card ─────────────────────────────────────── */
function renderSpendingCard(data) {
  const cats = data.spend_by_category || {};
  const entries = Object.entries(cats).sort((a, b) => b[1] - a[1]);

  if (!entries.length) return;

  const [topCat, topAmt] = entries[0];
  const amountEl   = document.getElementById("spendingAmount");
  const merchantEl = document.getElementById("spendingMerchant");
  const noteEl     = document.getElementById("spendingNote");

  if (amountEl)   amountEl.textContent   = fmt$(topAmt);
  if (merchantEl) merchantEl.textContent = capitalize(topCat);

  // Find top merchant in that category from transactions
  const transactions = JSON.parse(sessionStorage.getItem(TRANSACTIONS_KEY) || "[]");
  const catTx = transactions.filter(t =>
    (t.category || "").toLowerCase() === topCat.toLowerCase() && t.direction === "outflow"
  );
  if (catTx.length && noteEl) {
    // Find most frequent merchant
    const freq = {};
    catTx.forEach(t => { freq[t.merchant] = (freq[t.merchant] || 0) + 1; });
    const topMerchant = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
    if (topMerchant) {
      noteEl.textContent =
        `${topMerchant[0]} appeared ${topMerchant[1]} time${topMerchant[1] > 1 ? "s" : ""} this period.`;
    }
  }

  // Update card label
  const labelEl = document.querySelector("#spendingCard .card-label");
  if (labelEl) labelEl.textContent = topCat.toUpperCase().replace("_", " ");
}

/* ── Charts ────────────────────────────────────────────── */
function renderCharts(data) {
  renderPortfolioChart(data);
  renderRecurringChart(data);
}

function renderPortfolioChart(data) {
  const ctx = document.getElementById("portfolioChart");
  if (!ctx) return;

  const cats = data.spend_by_category || {};
  const labels = Object.keys(cats).slice(0, 6).map(capitalize);
  const values = Object.values(cats).slice(0, 6);

  if (!values.length) return;

  const COLORS = ["#5B9EC9", "#D4B554", "#F05A28", "#C88FE0", "#6fbf7e", "#A33030"];

  new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: COLORS,
        borderWidth: 0,
        hoverOffset: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: "68%",
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${fmt$(ctx.raw)}`,
          },
        },
      },
    },
  });

  // Investment return — use savings rate as proxy if no investment data
  const returnEl = document.getElementById("investReturn");
  const labelEl  = document.getElementById("investLabel");
  const s = data.summary || {};
  if (returnEl) returnEl.textContent = fmtPct(s.savings_rate);
  if (labelEl)  labelEl.textContent  = "Spending by category";
}

function renderRecurringChart(data) {
  const ctx = document.getElementById("recurringChart");
  if (!ctx) return;

  const recurring = (data.recurring || []).slice(0, 5);
  if (!recurring.length) return;

  const labels = recurring.map(r => r.merchant || r.Merchant || "Unknown");
  const values = recurring.map(r => parseFloat(r.avg_amount || r.AvgAmount || 0));

  const healthAmtEl  = document.getElementById("healthAmount");
  const healthSubEl  = document.getElementById("healthSubtitle");

  const total = values.reduce((a, b) => a + b, 0);
  if (healthAmtEl) healthAmtEl.textContent = fmt$(total);
  if (healthSubEl) healthSubEl.textContent = `${recurring.length} recurring charge${recurring.length > 1 ? "s" : ""} detected`;

  new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: "#5B9EC9",
        borderWidth: 0,
        borderRadius: 0,
      }],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: {
        callbacks: { label: ctx => ` ${fmt$(ctx.raw)}/mo` },
      }},
      scales: {
        x: {
          ticks: { color: "rgba(245,237,217,0.4)", font: { size: 9 } },
          grid:  { color: "rgba(255,255,255,0.05)" },
        },
        y: {
          ticks: { color: "rgba(245,237,217,0.6)", font: { size: 10 } },
          grid:  { display: false },
        },
      },
    },
  });
}

/* ── Utility ───────────────────────────────────────────── */
function capitalize(str) {
  return str.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}
