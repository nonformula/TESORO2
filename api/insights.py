from __future__ import annotations

import json
import os
import sys

from flask import Flask, request, jsonify

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from api.auth import check_auth
from orchestrator.build_context import build_context
from orchestrator.generate_insights import generate_insights

app = Flask(__name__)


@app.route("/api/insights", methods=["POST", "OPTIONS"])
def handle_insights():
    if request.method == "OPTIONS":
        return _cors_response()

    secret = os.environ.get("TESORO_SECRET", "")
    if secret and not check_auth(dict(request.headers), secret):
        return jsonify({"error": "Unauthorized"}), 401

    try:
        payload      = request.get_json(force=True)
        analytics    = payload.get("analytics", {})
        user_profile = payload.get("user_profile", {})

        if not analytics:
            return jsonify({"error": "No analytics data provided"}), 400

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
        return jsonify({"error": f"Model returned invalid JSON: {str(e)}"}), 502
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
