/* =========================================================
   TESORO — app.js
   Main controller: password auth, API key management,
   file drop/upload, navigation, state, view routing.
   ========================================================= */

// SHA-256 hash of the password "tesoro"
// To change: run `echo -n "yourpassword" | shasum -a 256`
// and replace the string below.
const PASS_HASH = '5cf0c40b6191ab10ea4b728f3d81b9af66230e4a75d75190a71fba22d7a95381';

// ── App state ─────────────────────────────────────────────
const State = {
  transactions: [],       // unified transaction array
  fileResults: [],        // raw parse results per file
  currentView: 'brief',
  currentTimeframe: 'ytd',
  apiKey: '',
};

// ── Utility ───────────────────────────────────────────────
async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function $(id) { return document.getElementById(id); }
function show(id) { $(id).classList.remove('hidden'); }
function hide(id) { $(id).classList.add('hidden'); }

// ── Password auth ─────────────────────────────────────────
async function checkPassword(input) {
  const hash = await sha256(input.trim());
  return hash === PASS_HASH;
}

async function initAuth() {
  const authed = sessionStorage.getItem('tesoro_auth');
  if (authed === '1') {
    hidePasswordScreen();
  } else {
    show('screen-password');
  }
}

function hidePasswordScreen() {
  hide('screen-password');
  initApiKey();
}

$('form-password').addEventListener('submit', async (e) => {
  e.preventDefault();
  const val = $('input-password').value;
  if (!val) return;
  const ok = await checkPassword(val);
  if (ok) {
    sessionStorage.setItem('tesoro_auth', '1');
    $('input-password').value = '';
    $('password-error').classList.add('hidden');
    hidePasswordScreen();
  } else {
    $('password-error').classList.remove('hidden');
    $('input-password').value = '';
    $('input-password').focus();
  }
});

// ── API key ───────────────────────────────────────────────
function initApiKey() {
  const stored = sessionStorage.getItem('tesoro_apikey');
  if (stored && stored.startsWith('sk-ant-')) {
    State.apiKey = stored;
    showApp();
  } else {
    show('modal-apikey');
  }
}

$('form-apikey').addEventListener('submit', (e) => {
  e.preventDefault();
  const val = $('input-apikey').value.trim();
  if (!val.startsWith('sk-ant-')) {
    $('apikey-error').classList.remove('hidden');
    return;
  }
  sessionStorage.setItem('tesoro_apikey', val);
  State.apiKey = val;
  $('input-apikey').value = '';
  hide('modal-apikey');
  showApp();
});

// ── Show app shell ────────────────────────────────────────
function showApp() {
  show('app');
  const savedTxns = sessionStorage.getItem('tesoro_transactions');
  if (savedTxns) {
    try {
      const parsed = JSON.parse(savedTxns);
      // Re-hydrate date strings to Date objects
      State.transactions = parsed.map(t => ({
        ...t,
        date: new Date(t.date),
      }));
      showViewContainer();
      navigateTo(State.currentView);
    } catch (_) {
      showUploadZone();
    }
  } else {
    showUploadZone();
  }
}

// ── Upload zone ───────────────────────────────────────────
function showUploadZone() {
  hide('view-container');
  hide('loading-state');
  show('upload-zone');
}

function showViewContainer() {
  hide('upload-zone');
  hide('loading-state');
  show('view-container');
}

function showLoading(msg = 'Analyzing your data…') {
  hide('upload-zone');
  hide('view-container');
  $('loading-msg').textContent = msg;
  show('loading-state');
}

// Drag and drop
const uploadZone = $('upload-zone');

['dragenter', 'dragover'].forEach(evt => {
  uploadZone.addEventListener(evt, (e) => {
    e.preventDefault();
    uploadZone.classList.add('upload-zone--dragover');
  });
});

['dragleave', 'drop'].forEach(evt => {
  uploadZone.addEventListener(evt, () => {
    uploadZone.classList.remove('upload-zone--dragover');
  });
});

uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  handleFiles(e.dataTransfer.files);
});

$('btn-browse').addEventListener('click', () => $('file-input').click());
$('file-input').addEventListener('change', (e) => handleFiles(e.target.files));

function handleFiles(files) {
  if (!files || !files.length) return;

  const list = $('upload-file-list');
  list.innerHTML = '';
  list.classList.remove('hidden');
  $('btn-analyze').classList.remove('hidden');

  Array.from(files).forEach(f => {
    const ext = f.name.split('.').pop().toLowerCase();
    const item = document.createElement('div');
    item.className = 'upload-file-item';
    item.innerHTML = `
      <span class="upload-file-name">${f.name}</span>
      <span class="upload-file-tag upload-file-tag--${ext}">${ext.toUpperCase()}</span>
    `;
    list.appendChild(item);
  });

  // Store file refs for analyze button
  $('btn-analyze')._files = files;
}

$('btn-analyze').addEventListener('click', async () => {
  const files = $('btn-analyze')._files;
  if (!files) return;
  await processFiles(files);
});

async function processFiles(files) {
  showLoading('Parsing your files…');

  try {
    const results = await Parser.parseFiles(files);
    State.fileResults = results;

    // Flatten all transactions
    State.transactions = results.flatMap(r => r.transactions || []);

    // Persist to sessionStorage (serialize dates as ISO strings)
    sessionStorage.setItem('tesoro_transactions', JSON.stringify(State.transactions));

    showLoading('Generating Financial Brief…');
    showViewContainer();
    navigateTo('brief');

  } catch (err) {
    console.error('Parse error:', err);
    showUploadZone();
    alert('Error parsing files: ' + err.message);
  }
}

// ── Navigation ────────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    navigateTo(btn.dataset.view);
  });
});

function navigateTo(viewKey) {
  State.currentView = viewKey;

  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('nav-item--active', btn.dataset.view === viewKey);
  });

  // Show/hide timeframe bar
  const tfViews = ['spending', 'budget'];
  if (tfViews.includes(viewKey)) {
    show('timeframe-bar');
  } else {
    hide('timeframe-bar');
  }

  // Render the view
  renderView(viewKey, State.currentTimeframe);
}

// ── Timeframe bar ─────────────────────────────────────────
document.querySelectorAll('.tf-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('tf-btn--active'));
    btn.classList.add('tf-btn--active');
    State.currentTimeframe = btn.dataset.tf;
    renderView(State.currentView, State.currentTimeframe);
  });
});

// ── Render dispatcher ─────────────────────────────────────
async function renderView(viewKey, timeframe) {
  const container = $('view-output');

  // Destroy any existing Chart.js instances before re-rendering
  if (window._tesoroCharts) {
    window._tesoroCharts.forEach(c => { try { c.destroy(); } catch (_) {} });
  }
  window._tesoroCharts = [];

  // Show skeleton
  container.innerHTML = '<div style="padding:40px 24px;opacity:0.2;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;">Loading…</div>';

  const txns = State.transactions;

  try {
    switch (viewKey) {
      case 'brief':       await Views.renderBrief(container, txns, State.apiKey); break;
      case 'networth':    await Views.renderNetWorth(container, txns, State.apiKey); break;
      case 'investments': await Views.renderInvestments(container, txns, State.apiKey); break;
      case 'spending':    await Views.renderSpending(container, txns, timeframe, State.apiKey); break;
      case 'budget':      await Views.renderBudget(container, txns, timeframe, State.apiKey); break;
      default:            container.innerHTML = '';
    }
  } catch (err) {
    console.error('View render error:', err);
    container.innerHTML = `<div style="padding:40px 24px;color:var(--orange);font-size:12px;">Error loading view: ${err.message}</div>`;
  }
}

// ── Sidebar actions ───────────────────────────────────────
$('btn-upload-new').addEventListener('click', () => {
  State.transactions = [];
  sessionStorage.removeItem('tesoro_transactions');
  // Reset file input
  $('file-input').value = '';
  $('upload-file-list').classList.add('hidden');
  $('btn-analyze').classList.add('hidden');
  showUploadZone();
});

$('btn-clear-key').addEventListener('click', () => {
  sessionStorage.clear();
  location.reload();
});

// ── Boot ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', initAuth);
