/* auth.js — Login form + session token management */

const TOKEN_KEY = "tesoro_token";

/* ── Token helpers ─────────────────────────────────────── */
function saveToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

function authHeaders() {
  const token = getToken();
  return token ? { "Authorization": `Bearer ${token}` } : {};
}

/* ── Guard: redirect to login if no token ──────────────── */
function requireAuth() {
  const token = getToken();
  if (!token) {
    window.location.href = "/login.html";
    return false;
  }
  return true;
}

/* ── Login form ────────────────────────────────────────── */
(function initLoginPage() {
  const form  = document.getElementById("loginForm");
  const input = document.getElementById("passwordInput");
  const btn   = document.getElementById("loginBtn");
  const err   = document.getElementById("loginError");

  if (!form) return; // not on login page

  // Redirect away if already authenticated
  if (getToken()) {
    window.location.href = "/upload.html";
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const password = input.value.trim();
    if (!password) return;

    btn.disabled = true;
    btn.textContent = "Checking…";
    err.textContent = "";

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (res.ok && data.token) {
        saveToken(data.token);
        window.location.href = "/upload.html";
      } else {
        err.textContent = data.error || "Incorrect password.";
        input.value = "";
        input.focus();
      }
    } catch (ex) {
      err.textContent = "Connection error. Please try again.";
    } finally {
      btn.disabled = false;
      btn.textContent = "Enter";
    }
  });
})();
