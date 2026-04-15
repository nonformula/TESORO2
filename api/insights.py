from __future__ import annotations

import json
import os
import sys
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from api.auth import check_auth
from orchestrator.build_context import build_context
from orchestrator.generate_insights import generate_insights


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

            analytics = payload.get("analytics", {})
            user_profile = payload.get("user_profile", {})

            if not analytics:
                self._respond(400, {"error": "No analytics data provided"})
                return

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
            self._respond(200, result)

        except json.JSONDecodeError as e:
            self._respond(502, {"error": f"Model returned invalid JSON: {str(e)}"})
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
