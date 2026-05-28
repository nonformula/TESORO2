/* mastro.js — Mastro AI advisor interface */
console.log("mastro.js loaded");

const ANALYTICS_KEY = "tesoro_analytics";
const INSIGHTS_KEY  = "tesoro_insights";

const insightList = document.getElementById("mastroInsights");
const mastroInput = document.getElementById("mastroInput");
const mastroSend  = document.getElementById("mastroSend");

/* ── Load or fetch insights on page load ───────────────── */
(async function init() {
  // Try cached insights first
  const cached = sessionStorage.getItem(INSIGHTS_KEY);
  if (cached) {
    renderInsights(JSON.parse(cached));
    return;
  }

  // Auto-fetch if analytics are available
  const analytics = sessionStorage.getItem(ANALYTICS_KEY);
  if (analytics) {
    await fetchInsights(JSON.parse(analytics));
  }
})();

/* ── Manual "Ask Mastro" ────────────────────────────────── */
mastroSend.addEventListener("click", handleAsk);
mastroInput.addEventListener("keydown", e => {
  if (e.key === "Enter") handleAsk();
});

async function handleAsk() {
  console.log("handleAsk fired");
  const question = mastroInput.value.trim();
  const analytics = JSON.parse(sessionStorage.getItem(ANALYTICS_KEY) || "null");
  console.log("analytics in session:", !!analytics);

  if (!analytics) {
    showMessage("Import your data first to enable Mastro.", "hint");
    return;
  }

  mastroInput.value = "";
  mastroSend.disabled = true;
  showLoading();

  // Include question as a goal hint in the user profile
  const userProfile = question
    ? { stated_goals: [question] }
    : {};

  await fetchInsights(analytics, userProfile);
  mastroSend.disabled = false;
}

/* ── Fetch insights from API ────────────────────────────── */
async function fetchInsights(analytics, userProfile = {}) {
  showLoading();

  try {
    const res = await fetch("/api/insights", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({ analytics, user_profile: userProfile }),
    });

    if (!res.ok) {
      const err = await res.json();
      console.error("Mastro API error:", err);
      showMessage(`Mastro couldn't respond: ${err.error}`, "error");
      return;
    }

    const data = await res.json();
    console.log("Mastro response:", data);
    sessionStorage.setItem(INSIGHTS_KEY, JSON.stringify(data.insights || []));
    renderInsights(data.insights || []);

  } catch (ex) {
    console.error("Mastro fetch failed:", ex);
    showMessage(`Error: ${ex.message}`, "error");
  }
}

/* ── Render insight cards ───────────────────────────────── */
function renderInsights(insights) {
  insightList.innerHTML = "";

  if (!insights || !insights.length) {
    showMessage("No strong insights found in this dataset.", "hint");
    return;
  }

  insights.forEach(insight => {
    const card = document.createElement("div");
    card.className = "insight-card";

    const priority   = insight.priority   || "low";
    const confidence = insight.confidence || "low";
    const type       = (insight.insight_type || "").replace(/_/g, " ");

    card.innerHTML = `
      <span class="insight-badge insight-badge--${priority}">${type || priority} priority</span>
      <p class="insight-card-title">${escHtml(insight.title || "")}</p>
      <p class="insight-card-summary">${escHtml(insight.summary || "")}</p>
      ${insight.recommendation
        ? `<p class="insight-card-rec">→ ${escHtml(insight.recommendation)}</p>`
        : ""}
      <p class="t-small" style="margin-top:8px;opacity:0.35">${confidence} confidence</p>
    `;

    insightList.appendChild(card);
  });
}

/* ── UI helpers ────────────────────────────────────────── */
function showLoading() {
  insightList.innerHTML = `
    <div class="mastro-loading">
      <div class="mastro-loading-dot"></div>
      <div class="mastro-loading-dot"></div>
      <div class="mastro-loading-dot"></div>
      <span>Mastro is thinking…</span>
    </div>
  `;
}

function showMessage(msg, type = "hint") {
  const color = type === "error" ? "var(--orange)" : "rgba(245,237,217,0.35)";
  insightList.innerHTML = `<p class="t-small" style="color:${color};padding:8px 0">${escHtml(msg)}</p>`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
