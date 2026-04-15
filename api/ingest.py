from __future__ import annotations

import io
import re
import sys
import os

import pandas as pd
from flask import Flask, request, jsonify

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from api.auth import check_auth

app = Flask(__name__)


# ---------------------------------------------------------------------------
# Source detection
# ---------------------------------------------------------------------------

def _detect_source(filename: str, columns: list[str]) -> str:
    name = filename.lower()
    cols = [str(c).lower() for c in columns]

    if any(k in name for k in ("401k", "retirement", "swb", "ira")):
        return "retirement"
    if any(k in name for k in ("invest", "schwab", "fidelity", "robinhood", "brokerage")):
        return "investment"
    if any(k in name for k in ("citi", "amex", "visa", "mastercard", "card", "credit")):
        return "credit_card"

    # column sniffing
    if "symbol" in cols or "shares" in cols or "price" in cols:
        return "investment"
    if "category" in cols and "debit" in cols:
        return "credit_card"

    return "bank"


# ---------------------------------------------------------------------------
# Column normalizers per source type
# ---------------------------------------------------------------------------

def _normalize_bank(df: pd.DataFrame) -> pd.DataFrame:
    """Wells Fargo / Chase style — with or without header."""
    df.columns = [str(c).strip().lower() for c in df.columns]

    # Positional fallback names already assigned by normalize_csv for headerless files
    date_col   = next((c for c in df.columns if "date" in c), None)
    amount_col = next((c for c in df.columns if "amount" in c), None)
    desc_col   = next(
        (c for c in df.columns if c in ("description", "memo", "payee", "merchant", "name")),
        None,
    )

    # Last resort positional fallbacks
    if date_col is None and len(df.columns) >= 1:
        date_col = df.columns[0]
    if amount_col is None and len(df.columns) >= 2:
        amount_col = df.columns[1]
    if desc_col is None:
        desc_col = df.columns[4] if len(df.columns) > 4 else df.columns[-1]

    out = pd.DataFrame()
    out["date"] = pd.to_datetime(df[date_col], errors="coerce")
    out["amount"] = pd.to_numeric(df[amount_col], errors="coerce")
    out["merchant"] = df[desc_col].astype(str)
    out["raw_category"] = df.get("category", pd.Series([""] * len(df))).fillna("")
    return out


def _normalize_credit_card(df: pd.DataFrame) -> pd.DataFrame:
    """Citi / Amex style: Date, Description, Amount  or  Date, Debit, Credit"""
    df.columns = [c.strip().lower() for c in df.columns]

    date_col = next((c for c in df.columns if "date" in c), None)
    desc_col = next((c for c in df.columns if c in ("description", "merchant", "payee", "name")), None)
    if desc_col is None:
        desc_col = df.columns[1] if len(df.columns) > 1 else df.columns[0]

    # Handle debit/credit split columns
    if "debit" in df.columns and "credit" in df.columns:
        debit = pd.to_numeric(df["debit"], errors="coerce").fillna(0)
        credit = pd.to_numeric(df["credit"], errors="coerce").fillna(0)
        amount_series = debit - credit  # positive = money out
    elif "amount" in df.columns:
        amount_series = pd.to_numeric(df["amount"], errors="coerce")
    else:
        amount_col = df.columns[2] if len(df.columns) > 2 else df.columns[-1]
        amount_series = pd.to_numeric(df[amount_col], errors="coerce")

    if date_col is None:
        raise ValueError("Cannot identify date column in credit card CSV")

    out = pd.DataFrame()
    out["date"] = pd.to_datetime(df[date_col], errors="coerce")
    out["amount"] = amount_series
    out["merchant"] = df[desc_col].astype(str)
    out["raw_category"] = df.get("category", pd.Series([""] * len(df))).fillna("")
    return out


def _normalize_investment(df: pd.DataFrame) -> pd.DataFrame:
    """Schwab / Fidelity style: Date, Action, Symbol, Shares, Price, Amount"""
    df.columns = [c.strip().lower() for c in df.columns]

    date_col = next((c for c in df.columns if "date" in c), None)
    amount_col = next((c for c in df.columns if "amount" in c or "value" in c), None)
    desc_col = next((c for c in df.columns if c in ("description", "action", "type", "symbol")), None)

    out = pd.DataFrame()
    out["date"] = pd.to_datetime(df[date_col], errors="coerce") if date_col else pd.NaT
    out["amount"] = pd.to_numeric(df[amount_col].astype(str).str.replace(r"[$,]", "", regex=True), errors="coerce") if amount_col else 0.0
    out["merchant"] = df[desc_col].astype(str) if desc_col else "Investment"
    out["raw_category"] = "investment"
    return out


def _normalize_retirement(df: pd.DataFrame) -> pd.DataFrame:
    """401k / Schwab style — positions with market values."""
    df.columns = [str(c).strip().lower() for c in df.columns]

    # Schwab uses "mkt val (market value)" — match broadly
    amount_col = next(
        (c for c in df.columns if any(k in c for k in ("mkt val", "market value", "value", "balance", "amount", "contribution"))),
        None,
    )
    desc_col = next(
        (c for c in df.columns if any(k in c for k in ("description", "fund", "name", "symbol"))),
        None,
    )

    out = pd.DataFrame()
    # 401k positions don't have transaction dates — use today
    out["date"] = pd.Timestamp.today().normalize()
    out["amount"] = pd.to_numeric(
        df[amount_col].astype(str).str.replace(r"[$,]", "", regex=True), errors="coerce"
    ) if amount_col else 0.0
    out["merchant"] = df[desc_col].astype(str) if desc_col else "Retirement"
    out["raw_category"] = "retirement"
    return out


# ---------------------------------------------------------------------------
# Cleaning helpers
# ---------------------------------------------------------------------------

_JUNK_PATTERNS = re.compile(
    r"\b(pending|memo|hold|processing|debit card|credit card|#\d+)\b",
    re.IGNORECASE,
)

def _clean_merchant(name: str) -> str:
    """Normalize merchant string: remove junk, fix caps."""
    name = str(name).strip()
    name = re.sub(r"\*+", " ", name)
    name = re.sub(r"\s{2,}", " ", name)
    name = _JUNK_PATTERNS.sub("", name).strip()
    if name.isupper():
        name = name.title()
    return name or "Unknown"


def _assign_direction(row: pd.Series, source_type: str) -> str:
    """Determine inflow vs outflow."""
    amount = row.get("amount", 0)
    if source_type == "credit_card":
        return "outflow" if amount > 0 else "inflow"
    return "inflow" if amount > 0 else "outflow"


# ---------------------------------------------------------------------------
# Smart CSV reader — handles headerless and metadata-prefixed files
# ---------------------------------------------------------------------------

_HEADER_KEYWORDS = {
    "date", "amount", "description", "debit", "credit",
    "symbol", "balance", "transaction", "memo", "payee",
    "name", "category", "price", "qty", "quantity",
}

def _find_header_row(csv_bytes: bytes) -> int:
    """Return the row index of the real header, or -1 if no header found."""
    try:
        text = csv_bytes.decode(errors="replace")
    except Exception:
        return 0

    for i, line in enumerate(text.splitlines()[:15]):
        cols = [c.strip().strip('"').lower() for c in line.split(",")]
        if sum(1 for c in cols if any(kw in c for kw in _HEADER_KEYWORDS)) >= 2:
            return i
    return -1  # headerless


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def normalize_csv(csv_bytes: bytes, filename: str) -> list[dict]:
    """Parse and normalize a CSV file to the standard transaction schema."""
    header_row = _find_header_row(csv_bytes)

    if header_row == -1:
        # Headerless (e.g. Wells Fargo) — positional columns
        df_raw = pd.read_csv(
            io.BytesIO(csv_bytes), header=None, on_bad_lines="skip"
        )
        df_raw.dropna(how="all", inplace=True)
        # Assign standard names by position: col0=date, col1=amount, col4=description
        ncols = len(df_raw.columns)
        names = {0: "date", 1: "amount"}
        if ncols >= 5:
            names[4] = "description"
        elif ncols >= 3:
            names[ncols - 1] = "description"
        df_raw.rename(columns=names, inplace=True)
    else:
        df_raw = pd.read_csv(
            io.BytesIO(csv_bytes), skiprows=header_row, on_bad_lines="skip"
        )
        df_raw.dropna(how="all", inplace=True)

    source_type = _detect_source(filename, list(df_raw.columns))

    if source_type == "bank":
        df = _normalize_bank(df_raw)
    elif source_type == "credit_card":
        df = _normalize_credit_card(df_raw)
    elif source_type == "investment":
        df = _normalize_investment(df_raw)
    else:
        df = _normalize_retirement(df_raw)

    # Drop rows with unparseable dates or amounts
    df.dropna(subset=["date", "amount"], inplace=True)
    df = df[df["amount"] != 0]

    # Clean merchant strings
    df["merchant"] = df["merchant"].apply(_clean_merchant)

    # Assign direction
    df["direction"] = df.apply(lambda r: _assign_direction(r, source_type), axis=1)

    # Normalize amount to absolute value
    df["amount"] = df["amount"].abs()

    # Add source type
    df["source_type"] = source_type

    # Format date as string
    df["date"] = df["date"].dt.strftime("%Y-%m-%d")

    # Deduplicate exact rows
    df.drop_duplicates(inplace=True)

    return df.to_dict(orient="records")


# ---------------------------------------------------------------------------
# Vercel handler
# ---------------------------------------------------------------------------

@app.route("/api/ingest", methods=["POST", "OPTIONS"])
def handle_ingest():
    if request.method == "OPTIONS":
        return _cors_response()

    secret = os.environ.get("TESORO_SECRET", "")
    if secret and not check_auth(dict(request.headers), secret):
        return jsonify({"error": "Unauthorized"}), 401

    try:
        payload  = request.get_json(force=True)
        filename = payload.get("filename", "upload.csv")
        csv_data = payload.get("data", "").encode()
        transactions = normalize_csv(csv_data, filename)
        return jsonify({"transactions": transactions, "count": len(transactions)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def _cors_response():
    r = jsonify({})
    r.headers["Access-Control-Allow-Origin"]  = "*"
    r.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    r.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return r, 204


@app.after_request
def add_cors(response):
    response.headers["Access-Control-Allow-Origin"]  = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response
