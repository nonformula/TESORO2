/* =========================================================
   TESORO — parser.js
   Parses CSV, XLSX, and PDF files client-side.
   All formats normalize to the unified transaction schema:
   { date: Date, amount: Number, description: String,
     source: String, type: 'bank'|'credit'|'investment'|'pdf' }
   ========================================================= */

const Parser = (() => {

  // ── Source detection ──────────────────────────────────────
  function detectSource(filename) {
    const f = filename.toLowerCase();
    if (/mortgage|newrez|shellpoint|loan_statement/.test(f)) return 'mortgage';
    // Investment before bank — "wells_investments" should win as investment
    if (/schwab|swb|fidelity|robinhood|rh_|invest|portfolio|positions/.test(f)) return 'investment';
    if (/401k|retirement|ira/.test(f))                return 'retirement';
    if (/citi|amex|visa|card|credit/.test(f))          return 'credit_card';
    if (/wells|chase|pma|joint|business|checking|savings/.test(f)) return 'bank';
    return 'bank'; // fallback
  }

  // ── Parse a date string robustly ─────────────────────────
  function parseDate(str) {
    if (!str) return null;
    const s = String(str).trim();
    // MM/DD/YYYY or M/D/YYYY
    const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (mdy) {
      const [, m, d, y] = mdy;
      const year = y.length === 2 ? 2000 + parseInt(y) : parseInt(y);
      return new Date(year, parseInt(m) - 1, parseInt(d));
    }
    // YYYY-MM-DD
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
      return new Date(parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3]));
    }
    // "Mar 14, 2026" or "March 14, 2026" (Citi format)
    const mon = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
    if (mon) {
      const d = new Date(`${mon[1]} ${mon[2]}, ${mon[3]}`);
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  // ── Parse a dollar amount string ─────────────────────────
  function parseAmount(str) {
    if (str === null || str === undefined) return null;
    const s = String(str).replace(/[$,\s]/g, '').trim();
    if (!s || s === '--') return null;
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
  }

  // ── Normalize a single transaction ───────────────────────
  function normalize(date, amount, description, source, type) {
    if (!date || amount === null) return null;
    return {
      date,
      amount: typeof amount === 'number' ? amount : parseAmount(amount),
      description: String(description || '').trim(),
      source,
      type,
    };
  }

  // ── CSV parsers ───────────────────────────────────────────

  function parseBankCSV(rows, source) {
    // Wells Fargo headerless: col0=date, col1=amount, col4=description
    const txns = [];
    for (const row of rows) {
      if (!row || row.length < 5) continue;
      const date = parseDate(row[0]);
      const amount = parseAmount(row[1]);
      const description = row[4] || row[2] || '';
      const t = normalize(date, amount, description, source, 'bank');
      if (t) txns.push(t);
    }
    return txns;
  }

  function parseCreditCSV(rows, source) {
    // Citi: may have a metadata preamble row before the real header row
    if (!rows.length) return [];

    // Find the first row that has a cell matching exactly "date" — that's the real header
    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(rows.length, 5); i++) {
      if ((rows[i] || []).some(c => /^date$/i.test(String(c).trim()))) {
        headerRowIdx = i;
        break;
      }
    }

    const header = rows[headerRowIdx].map(h => String(h).toLowerCase().trim());
    const dateIdx = header.findIndex(h => h.includes('date'));
    const descIdx = header.findIndex(h => h.includes('description') || h.includes('desc'));
    const debitIdx = header.findIndex(h => h.includes('debit') || h.includes('charge') || h.includes('amount'));
    const creditIdx = header.findIndex(h => h.includes('credit') || h.includes('payment'));

    const txns = [];
    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 3) continue;
      const date = parseDate(row[dateIdx] ?? row[0]);
      const desc = row[descIdx] ?? row[1] ?? '';
      // Citi: debit = spending (positive in our model), credit = payment (negative)
      let amount = null;
      if (debitIdx >= 0 && row[debitIdx] && String(row[debitIdx]).trim()) {
        amount = parseAmount(row[debitIdx]);
      } else if (creditIdx >= 0 && row[creditIdx] && String(row[creditIdx]).trim()) {
        const raw = parseAmount(row[creditIdx]);
        if (raw !== null) amount = -raw; // payment = negative spend
      }
      const t = normalize(date, amount, desc, source, 'credit_card');
      if (t) txns.push(t);
    }
    return txns;
  }

  // Bank accounts with a header row (e.g. personal_checking, cash_savings)
  // These use a single `amount` column where negative = spending.
  // We negate so spending is positive (matching credit card convention).
  function parseBankHeaderCSV(rows, source) {
    if (!rows.length) return [];
    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(rows.length, 5); i++) {
      if ((rows[i] || []).some(c => /^date$/i.test(String(c).trim()))) { headerRowIdx = i; break; }
    }
    const header = rows[headerRowIdx].map(h => String(h).toLowerCase().trim());
    const dateIdx  = header.findIndex(h => /^(activity_)?date$/.test(h));
    const descIdx  = header.findIndex(h => h.includes('description') || h.includes('memo'));
    const amtIdx   = header.findIndex(h => h === 'amount');
    if (amtIdx < 0) return [];
    const txns = [];
    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 2) continue;
      const date = parseDate(row[dateIdx >= 0 ? dateIdx : 0]);
      const desc = String(row[descIdx >= 0 ? descIdx : 2] || '').trim();
      const rawAmt = parseAmount(row[amtIdx]);
      if (rawAmt === null) continue;
      // Negate: bank CSVs use negative for spending; our model uses positive
      const t = normalize(date, -rawAmt, desc, source, 'bank');
      if (t) txns.push(t);
    }
    return txns;
  }

  // Mortgage amortization statements — extract monthly payments as housing expenses
  function parseMortgageCSV(rows, source) {
    if (!rows.length) return [];
    const header = rows[0].map(h => String(h).toLowerCase().trim());
    const col = {};
    header.forEach((h, i) => { col[h] = i; });
    const dateIdx = col['activity_date'] ?? col['statement_date'] ?? 0;
    const amtIdx  = col['total_amount'] ?? col['scheduled_payment'];
    const typeIdx = col['activity_type'];
    if (amtIdx === undefined) return [];
    const txns = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row.length) continue;
      const actType = String(row[typeIdx] || '').toLowerCase();
      if (actType.includes('opening') || actType.includes('balance')) continue;
      const date = parseDate(row[dateIdx]);
      const amt  = parseAmount(row[amtIdx]);
      if (!date || !amt || amt <= 0) continue;
      txns.push(normalize(date, amt, 'Mortgage Payment', source, 'bank'));
    }
    return txns.filter(Boolean);
  }

  // Schwab activity-log format (record_type / market_value columns)
  function parseInvestmentActivityLog(rows, source) {
    const header = rows[0].map(h => String(h).toLowerCase().trim());
    const col = {};
    header.forEach((h, i) => { col[h] = i; });
    const bySymbol = {};
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row.length) continue;
      const recordType = String(row[col['record_type']] || '').toLowerCase();
      if (!recordType.includes('position')) continue;
      const sym = String(row[col['symbol']] || '').trim().replace(/"/g, '');
      if (!sym) continue;
      const date    = parseDate(row[col['date']] || row[col['settlement_date']]);
      const mktVal  = parseAmount(row[col['market_value']]);
      const qty     = parseAmount(row[col['quantity']]);
      const price   = parseAmount(row[col['price']]);
      const desc    = String(row[col['description']] || sym).replace(/"/g, '');
      if (!bySymbol[sym] || (date && (!bySymbol[sym].date || date > bySymbol[sym].date))) {
        bySymbol[sym] = { date, sym, mktVal, qty, price, desc };
      }
    }
    return Object.values(bySymbol).filter(p => p.mktVal > 0).map(p => ({
      date: p.date || new Date(),
      amount: p.mktVal,
      description: `${p.sym} — ${p.desc}`,
      source,
      type: 'investment',
      symbol: p.sym,
      qty: p.qty,
      price: p.price,
      marketValue: p.mktVal,
      costBasis: null,
      gainDollar: null,
      gainPct: null,
      account: source,
    }));
  }

  function parseInvestmentCSV(rows, source) {
    // Auto-detect: activity log format vs Schwab positions format
    if (rows.length > 0) {
      const firstRow = (rows[0] || []).map(c => String(c).toLowerCase().trim());
      if (firstRow.includes('record_type') || firstRow.includes('cash_effect')) {
        return parseInvestmentActivityLog(rows, source);
      }
    }
    // Schwab positions: multi-account, header rows per account
    // Returns position snapshots, not transactions
    if (!rows.length) return [];
    const positions = [];
    let accountName = '';
    let headerIdx = -1;
    let colMap = {};

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row.length) continue;
      const first = String(row[0] || '').trim();

      // Account header line (e.g. "Custodial_Brokerage ...920")
      if (first && !first.startsWith('"') && row.length <= 3 && !first.toLowerCase().includes('symbol')) {
        accountName = first;
        headerIdx = -1;
        colMap = {};
        continue;
      }

      // Column header row
      if (first.toLowerCase() === 'symbol' || (row[0] && String(row[0]).toLowerCase().trim() === 'symbol')) {
        headerIdx = i;
        row.forEach((h, idx) => { colMap[String(h).toLowerCase().trim()] = idx; });
        continue;
      }

      // Skip non-data rows
      if (headerIdx < 0) continue;
      if (!first || first === 'Positions Total' || first.toLowerCase().includes('total')) continue;
      if (first === 'Cash & Cash Investments' || first === 'Futures Cash') continue;

      const sym = String(row[colMap['symbol']] || row[0] || '').trim().replace(/"/g, '');
      if (!sym || sym === '--') continue;

      const mktValRaw = row[colMap['mkt val (market value)']] ?? row[colMap['mkt val']] ?? row[6];
      const costRaw   = row[colMap['cost basis']] ?? row[9];
      const gainRaw   = row[colMap['gain $ (gain/loss $)']] ?? row[10];
      const gainPctRaw = row[colMap['gain % (gain/loss %)']] ?? row[11];
      const qtyRaw    = row[colMap['qty (quantity)']] ?? row[2];
      const priceRaw  = row[colMap['price']] ?? row[3];
      const desc      = row[colMap['description']] ?? row[1] ?? '';

      positions.push({
        date: new Date(),
        amount: parseAmount(mktValRaw) || 0,
        description: `${sym} — ${String(desc).replace(/"/g, '')}`,
        source: accountName || source,
        type: 'investment',
        symbol: sym,
        qty: parseAmount(qtyRaw),
        price: parseAmount(priceRaw),
        marketValue: parseAmount(mktValRaw),
        costBasis: parseAmount(costRaw),
        gainDollar: parseAmount(gainRaw),
        gainPct: gainPctRaw ? parseFloat(String(gainPctRaw).replace('%', '')) : null,
        account: accountName,
      });
    }
    return positions;
  }

  // ── XLSX parser ───────────────────────────────────────────

  function parseXLSX(arrayBuffer, filename) {
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const source = detectSource(filename);
    const allTxns = [];

    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      if (!rows.length) return;

      if (source === 'investment') {
        allTxns.push(...parseInvestmentCSV(rows, filename));
      } else if (source === 'credit_card') {
        allTxns.push(...parseCreditCSV(rows, filename));
      } else {
        // Try to detect header
        const firstRow = rows[0].map(c => String(c).toLowerCase());
        const hasHeader = firstRow.some(c => c.includes('date') || c.includes('amount'));
        if (hasHeader) {
          allTxns.push(...parseCreditCSV(rows, filename));
        } else {
          allTxns.push(...parseBankCSV(rows, filename));
        }
      }
    });

    return allTxns;
  }

  // ── PDF parser ────────────────────────────────────────────

  async function parsePDF(arrayBuffer, filename) {
    // PDF.js CDN sets pdfjsLib global
    if (typeof pdfjsLib === 'undefined') {
      console.warn('PDF.js not loaded — skipping PDF parse');
      return [];
    }

    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const lines = [];

    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      // Group items into lines by approximate y-position
      const byY = {};
      content.items.forEach(item => {
        const y = Math.round(item.transform[5]);
        if (!byY[y]) byY[y] = [];
        byY[y].push(item.str);
      });
      Object.keys(byY).sort((a, b) => b - a).forEach(y => {
        lines.push(byY[y].join(' ').trim());
      });
    }

    return extractTransactionsFromText(lines, filename);
  }

  function extractTransactionsFromText(lines, filename) {
    const source = detectSource(filename);
    const txns = [];

    // Pattern: date at start of line, then description, then amount
    // Matches: 01/15/2026  Some Merchant  $123.45
    const linePattern = /^(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(.+?)\s+([-$][\d,]+\.?\d*)$/;
    // Also: date, amount, description (some statement formats)
    const altPattern = /^(\d{1,2}\/\d{1,2}\/\d{2,4})\s+([-$][\d,]+\.?\d*)\s+(.+)$/;

    for (const line of lines) {
      let m = line.match(linePattern);
      if (m) {
        const t = normalize(parseDate(m[1]), parseAmount(m[3]), m[2], filename, source === 'investment' ? 'investment' : 'bank');
        if (t) txns.push(t);
        continue;
      }
      m = line.match(altPattern);
      if (m) {
        const t = normalize(parseDate(m[1]), parseAmount(m[2]), m[3], filename, source === 'investment' ? 'investment' : 'bank');
        if (t) txns.push(t);
      }
    }

    // For Robinhood crypto statements, also look for BTC balance lines
    if (/robinhood|rh_/.test(filename.toLowerCase())) {
      for (const line of lines) {
        // BTC closing position line: "0.84104507 BTC $57,297.52"
        const btcMatch = line.match(/(\d+\.\d+)\s+BTC[^\d]*([\$][\d,]+\.?\d*)/i);
        if (btcMatch) {
          txns.push({
            date: new Date(),
            amount: parseAmount(btcMatch[2]),
            description: `BTC Holdings — ${btcMatch[1]} BTC`,
            source: filename,
            type: 'investment',
            symbol: 'BTC',
            qty: parseFloat(btcMatch[1]),
            marketValue: parseAmount(btcMatch[2]),
            isBTCPosition: true,
          });
        }
      }
    }

    return txns;
  }

  // ── CSV dispatcher ────────────────────────────────────────

  function parseCSV(text, filename) {
    const source = detectSource(filename);
    const result = Papa.parse(text, { skipEmptyLines: true, header: false });
    const rows = result.data;

    if (source === 'mortgage') return parseMortgageCSV(rows, filename);
    if (source === 'investment' || source === 'retirement') return parseInvestmentCSV(rows, filename);

    if (source === 'credit_card') {
      const first = rows[0] || [];
      const hasHeader = first.some(c => /date|description|amount|debit|credit/i.test(String(c)));
      return hasHeader ? parseCreditCSV(rows, filename) : parseBankCSV(rows, filename);
    }

    // Bank: headerless (Wells Fargo style) vs headed (checking/savings with amount column)
    const first = rows[0] || [];
    const hasHeader = first.some(c => /date|description|amount|debit|credit/i.test(String(c)));
    if (hasHeader) return parseBankHeaderCSV(rows, filename);
    return parseBankCSV(rows, filename);
  }

  // ── Public API ────────────────────────────────────────────

  async function parseFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    const filename = file.name;

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      if (ext === 'csv') {
        reader.onload = e => {
          try {
            const txns = parseCSV(e.target.result, filename);
            resolve({ filename, transactions: txns, ext: 'csv' });
          } catch (err) {
            reject(err);
          }
        };
        reader.readAsText(file);

      } else if (ext === 'xlsx' || ext === 'xls') {
        reader.onload = e => {
          try {
            const txns = parseXLSX(e.target.result, filename);
            resolve({ filename, transactions: txns, ext: 'xlsx' });
          } catch (err) {
            reject(err);
          }
        };
        reader.readAsArrayBuffer(file);

      } else if (ext === 'pdf') {
        reader.onload = async e => {
          try {
            const txns = await parsePDF(e.target.result, filename);
            resolve({ filename, transactions: txns, ext: 'pdf' });
          } catch (err) {
            reject(err);
          }
        };
        reader.readAsArrayBuffer(file);

      } else {
        reject(new Error(`Unsupported file type: .${ext}`));
      }
    });
  }

  async function parseFiles(files) {
    const results = await Promise.all(Array.from(files).map(parseFile));
    // Debug: log parse summary to console
    results.forEach(r => {
      const txns = r.transactions || [];
      console.log(`[Parser] ${r.filename} → ${txns.length} records`);
      if (txns.length > 0) {
        console.log(`  sample:`, txns[0]);
        const types = [...new Set(txns.map(t => t.type))];
        const amounts = txns.map(t => t.amount).filter(Boolean);
        console.log(`  types: ${types.join(', ')} | amt range: ${Math.min(...amounts).toFixed(2)} to ${Math.max(...amounts).toFixed(2)}`);
      }
    });
    return results;
  }

  return { parseFile, parseFiles, detectSource };
})();
