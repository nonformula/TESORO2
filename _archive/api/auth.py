from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import time

from flask import Flask, request, jsonify

app = Flask(__name__)


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


@app.route("/api/auth", methods=["POST", "OPTIONS"])
def handle_auth():
    if request.method == "OPTIONS":
        return _cors_response()

    password_env = os.environ.get("TESORO_PASSWORD", "")
    secret_env   = os.environ.get("TESORO_SECRET", "")

    if not password_env or not secret_env:
        return jsonify({"error": "Server misconfigured"}), 500

    data      = request.get_json(force=True)
    submitted = data.get("password", "")

    if not secrets.compare_digest(submitted, password_env):
        return jsonify({"error": "Invalid password"}), 401

    token = issue_token(secret_env)
    return jsonify({"token": token})


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
