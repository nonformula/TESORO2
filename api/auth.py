from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
import time
from http.server import BaseHTTPRequestHandler


def _sign_token(payload: str, secret: str) -> str:
    """Return HMAC-SHA256 hex digest of payload."""
    return hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()


def issue_token(secret: str) -> str:
    """Issue a time-stamped signed token."""
    ts = str(int(time.time()))
    nonce = secrets.token_hex(16)
    payload = f"{ts}.{nonce}"
    sig = _sign_token(payload, secret)
    return f"{payload}.{sig}"


def verify_token(token: str, secret: str, max_age_seconds: int = 86400) -> bool:
    """Verify token signature and age. Returns True if valid."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return False
        ts_str, nonce, sig = parts
        payload = f"{ts_str}.{nonce}"
        expected_sig = _sign_token(payload, secret)
        if not hmac.compare_digest(sig, expected_sig):
            return False
        age = int(time.time()) - int(ts_str)
        return 0 <= age <= max_age_seconds
    except Exception:
        return False


def check_auth(headers: dict, secret: str) -> bool:
    """Extract and verify Bearer token from Authorization header."""
    auth_header = headers.get("authorization", "") or headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return False
    token = auth_header[len("Bearer "):]
    return verify_token(token, secret)


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            password_env = os.environ.get("TESORO_PASSWORD", "")
            secret_env = os.environ.get("TESORO_SECRET", "")

            if not password_env or not secret_env:
                self._respond(500, {"error": "Server misconfigured"})
                return

            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            data = json.loads(body)
            submitted = data.get("password", "")

            if not secrets.compare_digest(submitted, password_env):
                self._respond(401, {"error": "Invalid password"})
                return

            token = issue_token(secret_env)
            self._respond(200, {"token": token})

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
        payload = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self._cors_headers()
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, format, *args):
        pass
