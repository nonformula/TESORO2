from __future__ import annotations

import json
import os
import sys
from http.server import BaseHTTPRequestHandler

import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from api.auth import check_auth
from analytics.metrics import calculate_metrics
from analytics.anomalies import detect_spend_spikes, detect_category_jumps
from analytics.recurring import detect_recurring_charges


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

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        secret = os.environ.get("TESORO_SECRET", "")
        if secret and not check_auth(dict(self.headers), secret):
            self._respond(401, {"error": "Unauthorized"})
            return

        try:
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            payload = json.loads(body)

            transactions = payload.get("transactions", [])
            if not transactions:
                self._respond(400, {"error": "No transactions provided"})
                return

            df = enrich_transactions(transactions)

            metrics = calculate_metrics(df)
            spikes = detect_spend_spikes(df)

            # Split by date midpoint for prior/current period comparison
            df_sorted = df.sort_values("date")
            midpoint = len(df_sorted) // 2
            prior_df   = df_sorted.iloc[:midpoint] if midpoint > 0 else df_sorted
            current_df = df_sorted.iloc[midpoint:] if midpoint > 0 else df_sorted
            category_jumps = detect_category_jumps(current_df, prior_df)

            recurring = detect_recurring_charges(df)

            # Convert MetricResults dataclass to dict if needed
            summary = metrics.get("summary", {})
            if hasattr(summary, "__dict__"):
                summary = summary.__dict__

            # Serialize anomalies
            def to_list(items):
                result = []
                for item in items:
                    if hasattr(item, "__dict__"):
                        result.append(item.__dict__)
                    elif isinstance(item, dict):
                        result.append(item)
                return result

            self._respond(200, {
                "summary": summary,
                "spend_by_category": metrics.get("spend_by_category", {}),
                "anomalies": to_list(spikes + category_jumps),
                "recurring": to_list(recurring),
                "enriched_count": len(df),
            })

        except Exception as e:
            self._respond(500, {"error": str(e)})

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors_headers()
        self.end_headers()

    def _cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def _respond(self, status: int, body: dict):
        payload = json.dumps(body, default=str).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self._cors_headers()
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, format, *args):
        pass
