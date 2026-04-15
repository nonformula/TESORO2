from __future__ import annotations

import os
import sys

import pandas as pd
from flask import Flask, request, jsonify

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from api.auth import check_auth
from analytics.metrics import calculate_metrics
from analytics.anomalies import detect_spend_spikes, detect_category_jumps
from analytics.recurring import detect_recurring_charges

app = Flask(__name__)


# ---------------------------------------------------------------------------
# Merchant categorization
# ---------------------------------------------------------------------------

CATEGORY_MAP = {
    "dining": [
        "restaurant", "grill", "cafe", "coffee", "starbucks", "mcdonald", "chipotle",
        "subway", "pizza", "sushi", "taco", "burger", "doordash", "grubhub", "ubereats",
        "uber eats", "seamless", "instacart", "postmates",
    ],
    "groceries": [
        "whole foods", "trader joe", "safeway", "kroger", "wegmans", "publix",
        "costco", "walmart", "target", "market", "grocery", "food lion",
    ],
    "transport": [
        "uber", "lyft", "taxi", "metro", "transit", "gas", "shell", "chevron",
        "exxon", "bp ", "parking", "toll", "airline", "delta", "united", "southwest",
        "american air", "jetblue",
    ],
    "health": [
        "pharmacy", "cvs", "walgreens", "rite aid", "doctor", "dental", "vision",
        "hospital", "medical", "clinic", "lab", "gym", "peloton", "fitness",
    ],
    "subscriptions": [
        "netflix", "spotify", "hulu", "disney", "amazon prime", "apple", "google",
        "dropbox", "adobe", "microsoft", "office 365", "icloud", "youtube",
        "hbo", "paramount", "peacock",
    ],
    "shopping": [
        "amazon", "ebay", "etsy", "nordstrom", "macy", "gap", "zara", "h&m",
        "best buy", "home depot", "lowe", "ikea", "wayfair",
    ],
    "utilities": [
        "electric", "gas company", "water", "internet", "comcast", "verizon",
        "at&t", "t-mobile", "sprint", "utility", "pge", "coned",
    ],
    "housing": [
        "rent", "mortgage", "landlord", "hoa", "property",
    ],
    "investment": [
        "robinhood", "schwab", "fidelity", "vanguard", "etrade", "coinbase",
        "crypto", "bitcoin", "transfer to", "brokerage",
    ],
    "income": [
        "payroll", "direct deposit", "salary", "employer", "ach credit", "zelle",
        "venmo credit", "transfer from",
    ],
}

FIXED_CATEGORIES = {"housing", "utilities", "subscriptions"}
DISCRETIONARY_CATEGORIES = {"dining", "shopping", "transport", "entertainment"}


def categorize_merchant(merchant: str) -> str:
    m = merchant.lower()
    for category, keywords in CATEGORY_MAP.items():
        if any(kw in m for kw in keywords):
            return category
    return "other"


def enrich_transactions(transactions: list[dict]) -> pd.DataFrame:
    df = pd.DataFrame(transactions)
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df["category"] = df["merchant"].apply(categorize_merchant)

    # Override with raw_category hint if it maps to a known category
    if "raw_category" in df.columns:
        def maybe_override(row):
            rc = str(row.get("raw_category", "")).lower()
            for cat in CATEGORY_MAP:
                if cat in rc:
                    return cat
            return row["category"]
        df["category"] = df.apply(maybe_override, axis=1)

    df["is_fixed"] = df["category"].isin(FIXED_CATEGORIES)
    df["is_discretionary"] = df["category"].isin(DISCRETIONARY_CATEGORIES)
    return df


# ---------------------------------------------------------------------------
# Vercel handler
# ---------------------------------------------------------------------------

@app.route("/api/analyze", methods=["POST", "OPTIONS"])
def handle_analyze():
    if request.method == "OPTIONS":
        return _cors_response()

    secret = os.environ.get("TESORO_SECRET", "")
    if secret and not check_auth(dict(request.headers), secret):
        return jsonify({"error": "Unauthorized"}), 401

    try:
        payload      = request.get_json(force=True)
        transactions = payload.get("transactions", [])
        if not transactions:
            return jsonify({"error": "No transactions provided"}), 400

        df = enrich_transactions(transactions)

        metrics = calculate_metrics(df)
        spikes  = detect_spend_spikes(df)

        df_sorted  = df.sort_values("date")
        midpoint   = len(df_sorted) // 2
        prior_df   = df_sorted.iloc[:midpoint] if midpoint > 0 else df_sorted
        current_df = df_sorted.iloc[midpoint:] if midpoint > 0 else df_sorted
        category_jumps = detect_category_jumps(current_df, prior_df)

        recurring = detect_recurring_charges(df)

        summary = metrics.get("summary", {})
        if hasattr(summary, "__dict__"):
            summary = summary.__dict__

        def to_list(items):
            return [i.__dict__ if hasattr(i, "__dict__") else i for i in items]

        return jsonify({
            "summary": summary,
            "spend_by_category": metrics.get("spend_by_category", {}),
            "anomalies": to_list(spikes + category_jumps),
            "recurring": to_list(recurring),
            "enriched_count": len(df),
        })

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
