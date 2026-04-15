"""
Local development server for Tesoro v2.
Run: python3 dev_server.py
Then open: http://localhost:3000
"""

import json
import os
import sys
import traceback
from pathlib import Path
from dotenv import load_dotenv
from flask import Flask, request, jsonify, send_from_directory

# Load env vars from .env file
load_dotenv(Path(__file__).parent / ".env")

# Make project modules importable
sys.path.insert(0, str(Path(__file__).parent))

from api.auth import check_auth, issue_token, verify_token
from api.ingest import normalize_csv
from api.analyze import enrich_transactions
from analytics.metrics import calculate_metrics
from analytics.anomalies import detect_spend_spikes, detect_category_jumps
from analytics.recurring import detect_recurring_charges
from orchestrator.build_context import build_context
from orchestrator.generate_insights import generate_insights

import secrets as secrets_mod

app = Flask(__name__, static_folder="public", static_url_path="")


# ── Auth helper ──────────────────────────────────────────
def _check_token():
    secret = os.environ.get("TESORO_SECRET", "")
    if not secret:
        return True  # skip auth if secret not configured
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return False
    return verify_token(auth[7:], secret)


# ── Assets (images, design files) ────────────────────────
@app.route("/assets/<path:filename>")
def serve_assets(filename):
    return send_from_directory("assets", filename)


# ── Static pages ─────────────────────────────────────────
@app.route("/")
def index():
    return send_from_directory("public", "login.html")

@app.route("/login.html")
def login():
    return send_from_directory("public", "login.html")

@app.route("/upload.html")
def upload_page():
    return send_from_directory("public", "upload.html")

@app.route("/dashboard.html")
def dashboard():
    return send_from_directory("public", "dashboard.html")


# ── API: auth ────────────────────────────────────────────
@app.route("/api/auth", methods=["POST", "OPTIONS"])
def api_auth():
    if request.method == "OPTIONS":
        return _cors()

    password_env = os.environ.get("TESORO_PASSWORD", "")
    secret_env   = os.environ.get("TESORO_SECRET", "")

    if not password_env or not secret_env:
        return jsonify({"error": "Server misconfigured — check your .env file"}), 500

    data = request.get_json(force=True)
    submitted = data.get("password", "")

    if not secrets_mod.compare_digest(submitted, password_env):
        return jsonify({"error": "Incorrect password"}), 401

    token = issue_token(secret_env)
    return jsonify({"token": token})


# ── API: ingest ──────────────────────────────────────────
@app.route("/api/ingest", methods=["POST", "OPTIONS"])
def api_ingest():
    if request.method == "OPTIONS":
        return _cors()
    if not _check_token():
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json(force=True)
    filename = data.get("filename", "upload.csv")
    csv_data = data.get("data", "").encode()

    try:
        transactions = normalize_csv(csv_data, filename)
        return jsonify({"transactions": transactions, "count": len(transactions)})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ── API: analyze ─────────────────────────────────────────
@app.route("/api/analyze", methods=["POST", "OPTIONS"])
def api_analyze():
    if request.method == "OPTIONS":
        return _cors()
    if not _check_token():
        return jsonify({"error": "Unauthorized"}), 401

    import pandas as pd
    data = request.get_json(force=True)
    transactions = data.get("transactions", [])

    if not transactions:
        return jsonify({"error": "No transactions provided"}), 400

    try:
        df = enrich_transactions(transactions)
        metrics  = calculate_metrics(df)
        spikes   = detect_spend_spikes(df)

        # Split by date midpoint for prior/current period comparison
        df_sorted = df.sort_values("date")
        midpoint = len(df_sorted) // 2
        prior_df  = df_sorted.iloc[:midpoint] if midpoint > 0 else df_sorted
        current_df = df_sorted.iloc[midpoint:] if midpoint > 0 else df_sorted
        jumps    = detect_category_jumps(current_df, prior_df)

        recurring = detect_recurring_charges(df)

        summary = metrics.get("summary", {})
        if hasattr(summary, "__dict__"):
            summary = summary.__dict__

        def to_list(items):
            return [i.__dict__ if hasattr(i, "__dict__") else i for i in items]

        return jsonify({
            "summary": summary,
            "spend_by_category": metrics.get("spend_by_category", {}),
            "anomalies": to_list(spikes + jumps),
            "recurring": to_list(recurring),
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ── API: insights ─────────────────────────────────────────
@app.route("/api/insights", methods=["POST", "OPTIONS"])
def api_insights():
    if request.method == "OPTIONS":
        return _cors()
    if not _check_token():
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json(force=True)
    analytics    = data.get("analytics", {})
    user_profile = data.get("user_profile", {})

    if not analytics:
        return jsonify({"error": "No analytics data provided"}), 400

    try:
        context = build_context(
            user_profile=user_profile,
            metric_results={
                "summary": analytics.get("summary", {}),
                "spend_by_category": analytics.get("spend_by_category", {}),
            },
            anomaly_results=analytics.get("anomalies", []),
            recurring_results=analytics.get("recurring", []),
        )
        result = generate_insights(context)
        return jsonify(result)
    except json.JSONDecodeError as e:
        return jsonify({"error": f"Model returned invalid JSON: {e}"}), 502
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── CORS helper ───────────────────────────────────────────
def _cors():
    r = app.make_response("")
    r.headers["Access-Control-Allow-Origin"]  = "*"
    r.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    r.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return r, 204


@app.after_request
def add_cors(response):
    response.headers["Access-Control-Allow-Origin"]  = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response


if __name__ == "__main__":
    print("\n  Tesoro v2 — local dev server")
    print("  Open: http://localhost:3000\n")
    app.run(port=3003, debug=True)
