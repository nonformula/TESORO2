/* upload.js — CSV upload flow */

const TRANSACTIONS_KEY = "tesoro_transactions";
const ANALYTICS_KEY    = "tesoro_analytics";

/* ── DOM refs ──────────────────────────────────────────── */
const dropZone   = document.getElementById("dropZone");
const fileInput  = document.getElementById("fileInput");
const fileList   = document.getElementById("fileList");
const analyzeBtn = document.getElementById("analyzeBtn");
const statusEl   = document.getElementById("uploadStatus");
const skipToDash = document.getElementById("skipToDash");

/* State */
let stagedFiles = [];       // { file, name, sourceType }
let allTransactions = [];   // accumulated normalized transactions

/* ── Auth guard ────────────────────────────────────────── */
if (!requireAuth()) { /* auth.js redirects */ }

/* Show skip link if we have prior data */
if (sessionStorage.getItem(TRANSACTIONS_KEY)) {
  skipToDash.style.display = "inline";
}

/* ── Drop zone interactions ────────────────────────────── */
dropZone.addEventListener("click", () => fileInput.click());

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  handleFiles(Array.from(e.dataTransfer.files));
});

fileInput.addEventListener("change", () => {
  handleFiles(Array.from(fileInput.files));
  fileInput.value = "";
});

/* ── File handling ─────────────────────────────────────── */
function handleFiles(files) {
  const csvFiles = files.filter(f =>
    f.name.toLowerCase().endsWith(".csv")
  );
  if (!csvFiles.length) {
    setStatus("Only CSV files are supported.");
    return;
  }
  csvFiles.forEach(f => {
    if (!stagedFiles.find(s => s.name === f.name)) {
      stagedFiles.push({ file: f, name: f.name, sourceType: null });
    }
  });
  renderFileList();
  uploadAll();
}

function renderFileList() {
  fileList.innerHTML = "";
  stagedFiles.forEach((item, idx) => {
    const el = document.createElement("div");
    el.className = "upload-file-item";
    el.innerHTML = `
      <span class="upload-file-name">${item.name}</span>
      <span class="upload-file-type upload-file-type--${item.sourceType || 'unknown'}">
        ${item.sourceType ? item.sourceType.replace("_", " ") : "detecting…"}
      </span>
      <button class="upload-file-remove" data-idx="${idx}" title="Remove">×</button>
    `;
    fileList.appendChild(el);
  });

  fileList.querySelectorAll(".upload-file-remove").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.idx);
      stagedFiles.splice(idx, 1);
      renderFileList();
      checkAnalyzeReady();
    });
  });
}

function setStatus(msg) {
  statusEl.textContent = msg;
}

/* ── Upload each file to /api/ingest ───────────────────── */
async function uploadAll() {
  if (!stagedFiles.length) return;
  setStatus("Processing files…");

  const pending = stagedFiles.filter(s => s.sourceType === null);
  if (!pending.length) return;

  for (const item of pending) {
    try {
      const csvText = await readFileAsText(item.file);
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ filename: item.name, data: csvText }),
      });

      if (!res.ok) {
        const err = await res.json();
        setStatus(`Error with ${item.name}: ${err.error}`);
        continue;
      }

      const result = await res.json();
      item.sourceType = result.transactions[0]?.source_type || "bank";
      allTransactions = allTransactions.concat(result.transactions);

    } catch (ex) {
      setStatus(`Failed to process ${item.name}.`);
    }
  }

  renderFileList();
  setStatus(`${allTransactions.length} transactions loaded.`);
  sessionStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(allTransactions));

  if (allTransactions.length > 0) {
    await runAnalysis();
  }
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error("File read failed"));
    reader.readAsText(file);
  });
}

/* ── Analyze (auto-triggered after ingest, button as retry) */
async function runAnalysis() {
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = "Analyzing…";
  analyzeBtn.classList.add("visible");
  setStatus("Running analytics pipeline…");

  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({ transactions: allTransactions }),
    });

    if (!res.ok) {
      const err = await res.json();
      setStatus(`Analysis error: ${err.error}`);
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = "Retry →";
      return;
    }

    const analytics = await res.json();
    sessionStorage.setItem(ANALYTICS_KEY, JSON.stringify(analytics));
    window.location.href = "/dashboard.html";

  } catch (ex) {
    setStatus("Failed to run analysis. Please try again.");
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = "Retry →";
  }
}

analyzeBtn.addEventListener("click", () => {
  if (allTransactions.length > 0) runAnalysis();
});
