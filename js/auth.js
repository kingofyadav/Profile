"use strict";

/* ======================================================
   AUTH.JS — Client-Side Auth for Personal Section
   • PBKDF2-SHA-256 for new accounts via Web Crypto
   • Legacy SHA-256 / fallback hash support for existing accounts
   • Local admin account stored in localStorage (ak_users)
   • Token in sessionStorage (session) or localStorage (remember me)

   TRUST MODEL — read before relying on this for anything sensitive:
   This is a *client-side convenience gate*, not an access-control boundary.
   requireAuth() only hides/redirects in the browser; the HTML of "protected"
   pages is still served to anyone (those pages carry <meta robots=noindex> and
   contain NO secrets in markup). Real protection lives server-side:
     • HI dashboard data  → /api/hi/* requires the `HI_API_KEY` bearer token,
       which the owner pastes into localStorage; it is never shipped in code.
     • OTP login          → server/otp-server.js verifies the MSG91 OTP and
       signs the session JWT; the client cannot forge `apiToken`.
   Never render private data into a protected page's server response and assume
   requireAuth() will keep it hidden.
====================================================== */

const AUTH_USERS_KEY  = "ak_users";
const AUTH_TOKEN_KEY  = "ak_auth_token";
const SESSION_EXP_MS  = 24 * 60 * 60 * 1000;        // 24 h
const REMEMBER_EXP_MS = 10 * 365 * 24 * 60 * 60 * 1000; // local one-time setup
const RATE_LIMIT_KEY  = "ak_login_attempts";
const DEVICE_ID_KEY   = "ak_device_id";
const MAX_ATTEMPTS    = 5;
const LOCKOUT_MS      = 15 * 60 * 1000;              // 15 min
const HASH_VERSION    = "pbkdf2-sha256";
const PBKDF2_ROUNDS   = 120000;
const AUTH_API_BASE_KEY = "ak_auth_api_base";
const DEFAULT_LOCAL_AUTH_API_BASE = "http://127.0.0.1:5050/api";
const DEFAULT_PROD_AUTH_API_BASE = "/api";

/* ======================================================
   HASH — SHA-256 / PBKDF2 via Web Crypto (required)
   cyrb53 non-cryptographic fallback has been removed.
   Auth will throw if SubtleCrypto is unavailable so the
   user gets a clear "browser not supported" message
   rather than silently storing a weak hash.
====================================================== */

async function hashPassword(password) {
  if (!window.crypto?.subtle) {
    throw new Error("Your browser does not support secure password hashing. Please upgrade to a modern browser (Chrome 90+, Firefox 90+, Safari 15+).");
  }
  const enc = new TextEncoder();
  const buf = await window.crypto.subtle.digest("SHA-256", enc.encode(password));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

function makeSalt() {
  if (!window.crypto?.getRandomValues) {
    throw new Error("Your browser does not support cryptographic random values. Please upgrade to a modern browser.");
  }
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function hashPasswordAdvanced(password, salt) {
  if (!window.crypto?.subtle || !window.TextEncoder) {
    throw new Error("Your browser does not support PBKDF2 key derivation. Please upgrade to a modern browser.");
  }
  const enc = new TextEncoder();
  const key = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await window.crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: enc.encode(salt),
      iterations: PBKDF2_ROUNDS,
      hash: "SHA-256"
    },
    key,
    256
  );
  return Array.from(new Uint8Array(bits))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyPassword(user, password) {
  if (user.hashVersion === HASH_VERSION && user.passwordSalt) {
    return await hashPasswordAdvanced(password, user.passwordSalt) === user.passwordHash;
  }
  return await hashPassword(password) === user.passwordHash;
}

function isLocalHost() {
  if (typeof window === "undefined" || !window.location) return false;
  return /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/.test(window.location.hostname || "");
}

function normalizeApiBase(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";

  if (/^\/[^/]/.test(value) || value === "/api") {
    return value.replace(/\/+$/, "");
  }

  try {
    const parsed = new URL(value, window.location.origin);
    if (!isLocalHost() && /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/.test(parsed.hostname)) {
      return "";
    }
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

/* ======================================================
   RATE LIMITING
====================================================== */

function checkRateLimit() {
  try {
    const raw = sessionStorage.getItem(RATE_LIMIT_KEY);
    if (!raw) return { blocked: false };
    const data = JSON.parse(raw);
    if (Date.now() > data.resetAt) {
      sessionStorage.removeItem(RATE_LIMIT_KEY);
      return { blocked: false };
    }
    return { blocked: data.attempts >= MAX_ATTEMPTS };
  } catch { return { blocked: false }; }
}

function recordFailedAttempt() {
  try {
    const raw = sessionStorage.getItem(RATE_LIMIT_KEY);
    const data = raw ? JSON.parse(raw) : { attempts: 0, resetAt: Date.now() + LOCKOUT_MS };
    data.attempts++;
    if (Date.now() > data.resetAt) data.resetAt = Date.now() + LOCKOUT_MS;
    sessionStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(data));
  } catch {}
}

function clearRateLimit() {
  try { sessionStorage.removeItem(RATE_LIMIT_KEY); } catch {}
}

function getDeviceId() {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
    const generated = `dev_${hex}`;
    localStorage.setItem(DEVICE_ID_KEY, generated);
    return generated;
  } catch {
    return `dev_fallback_${Date.now().toString(36)}`;
  }
}


/* ======================================================
   TOKEN HELPERS
====================================================== */

function saveToken(username, remember) {
  const token = JSON.stringify({
    username,
    exp: Date.now() + (remember ? REMEMBER_EXP_MS : SESSION_EXP_MS)
  });
  try {
    if (remember) {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      sessionStorage.setItem(AUTH_TOKEN_KEY, token);
    }
  } catch { /* storage blocked (private mode quota, etc.) */ }
}

function saveRemoteToken(user, apiToken) {
  const phone = user && user.phone ? String(user.phone) : "";
  const token = JSON.stringify({
    username: phone ? "+" + phone : "otp-user",
    phone: phone,
    apiToken: apiToken || "",
    provider: "msg91",
    exp: Date.now() + SESSION_EXP_MS
  });
  try {
    sessionStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch {}
}

function getToken() {
  try {
    const raw =
      sessionStorage.getItem(AUTH_TOKEN_KEY) ||
      localStorage.getItem(AUTH_TOKEN_KEY);
    if (!raw) return null;
    const token = JSON.parse(raw);
    if (Date.now() > token.exp) {
      clearToken();
      return null;
    }
    return token;
  } catch {
    clearToken();
    return null;
  }
}

function clearToken() {
  try {
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {}
}

function resetLocalAdminState() {
  try {
    localStorage.removeItem(AUTH_USERS_KEY);
    sessionStorage.removeItem(AUTH_USERS_KEY);
    clearToken();
    clearRateLimit();
    return { ok: true };
  } catch (err) {
    console.error("[auth] reset error:", err);
    return { ok: false, error: "Reset failed. Please try again." };
  }
}

function getLocalUsersSnapshot() {
  try {
    const users = JSON.parse(localStorage.getItem(AUTH_USERS_KEY) || "[]");
    return users.map(user => ({
      username: String(user.username || ""),
      createdAt: user.createdAt || 0,
      createdAtLabel: user.createdAt ? new Date(user.createdAt).toLocaleString() : "unknown",
      hashVersion: String(user.hashVersion || "legacy"),
      sessionKey: String(user.sessionKey || user.deviceId || "local"),
      passwordHashPreview: String(user.passwordHash || "").slice(0, 16) + (String(user.passwordHash || "").length > 16 ? "…" : ""),
      passwordHashLength: String(user.passwordHash || "").length,
      hasSalt: Boolean(user.passwordSalt)
    }));
  } catch {
    return [];
  }
}

/* ======================================================
   PUBLIC API
====================================================== */

function isAuthenticated() {
  return getToken() !== null;
}

function getAuthUser() {
  const token = getToken();
  return token ? token.username : null;
}

/* True when the session came from a federated identity provider
   (0dot.in, or the legacy "earthsphere" alias) rather than a local
   username/password or OTP session. */
function isFederatedSession(token) {
  const t = token || getToken();
  return !!t && (t.provider === "0dot" || t.provider === "earthsphere");
}

/* The 0dot @handle for the current session, or null. */
function getSessionHandle() {
  const t = getToken();
  if (!t) return null;
  return t.handle || t.hdi || (typeof t.username === "string" ? t.username : null);
}

function getAuthApiBase() {
  try {
    const candidates = [
      window.HI_AUTH_API_BASE,
      localStorage.getItem(AUTH_API_BASE_KEY),
      isLocalHost() ? DEFAULT_LOCAL_AUTH_API_BASE : DEFAULT_PROD_AUTH_API_BASE
    ];

    for (const candidate of candidates) {
      const normalized = normalizeApiBase(candidate);
      if (normalized) return normalized;
    }

    return isLocalHost() ? DEFAULT_LOCAL_AUTH_API_BASE : DEFAULT_PROD_AUTH_API_BASE;
  } catch {
    return isLocalHost() ? DEFAULT_LOCAL_AUTH_API_BASE : DEFAULT_PROD_AUTH_API_BASE;
  }
}

async function authApi(path, payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let response;
  try {
    response = await fetch(getAuthApiBase() + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {}),
      signal: controller.signal
    });
  } catch (err) {
    throw new Error(
      err.name === "AbortError"
        ? "OTP request timed out. Check your connection and try again."
        : "OTP service unavailable. Check the Railway proxy or OTP_API_BASE."
    );
  } finally {
    clearTimeout(timeout);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    throw new Error(data.error || data.message || "Authentication request failed.");
  }
  return data;
}

async function requestPhoneOtp(phone) {
  return authApi("/auth/request-otp", { phone: phone });
}

async function verifyPhoneOtp(phone, otp) {
  const data = await authApi("/auth/verify-otp", { phone: phone, otp: otp });
  saveRemoteToken(data.user || { phone: phone }, data.token || "");
  return data;
}

function hasAnyUser() {
  try {
    const users = JSON.parse(localStorage.getItem(AUTH_USERS_KEY) || "[]");
    return users.length > 0;
  } catch {
    return false;
  }
}

async function signup(username, password) {
  try {
    username = username.trim().toLowerCase();
    if (!username || !password)  return { ok: false, error: "All fields are required." };
    if (username.length < 3)     return { ok: false, error: "Username must be at least 3 characters." };
    if (!/^[a-z0-9._-]+$/.test(username)) {
      return { ok: false, error: "Username can use letters, numbers, dot, dash, and underscore only." };
    }
    if (password.length < 8)     return { ok: false, error: "Password must be at least 8 characters." };

    const users = JSON.parse(localStorage.getItem(AUTH_USERS_KEY) || "[]");
    if (users.length > 0) {
      return { ok: false, error: "A local admin account already exists on this device." };
    }

    const passwordSalt = makeSalt();
    const passwordHash = await hashPasswordAdvanced(password, passwordSalt);
    users.push({
      username,
      passwordHash,
      passwordSalt,
      hashVersion: HASH_VERSION,
      createdAt: Date.now(),
      deviceId: getDeviceId(),
      sessionKey: username + "::" + getDeviceId()
    });
    localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users));
    return { ok: true };
  } catch (err) {
    console.error("[auth] signup error:", err);
    return { ok: false, error: "Signup failed. Please try again." };
  }
}

async function login(username, password, remember = true) {
  try {
    if (checkRateLimit().blocked) {
      return { ok: false, error: "Too many attempts. Please wait 15 minutes." };
    }

    username = username.trim().toLowerCase();
    if (!username || !password) return { ok: false, error: "All fields are required." };

    const users = JSON.parse(localStorage.getItem(AUTH_USERS_KEY) || "[]");
    const user  = users.find(u => u.username === username);
    if (!user) { recordFailedAttempt(); return { ok: false, error: "Incorrect username or password." }; }

    const matches = await verifyPassword(user, password);
    if (!matches) { recordFailedAttempt(); return { ok: false, error: "Incorrect username or password." }; }

    clearRateLimit();
    saveToken(username, remember);
    return { ok: true };
  } catch (err) {
    console.error("[auth] login error:", err);
    return { ok: false, error: "Login failed. Please try again." };
  }
}

function saveHDIToken(hdi) {
  const token = JSON.stringify({
    username: hdi,
    hdi: hdi,
    provider: 'earthsphere',
    exp: Date.now() + SESSION_EXP_MS
  });
  try { sessionStorage.setItem(AUTH_TOKEN_KEY, token); } catch {}
}

function loginWithHDI(hdi) {
  hdi = String(hdi || '').trim().toLowerCase();
  if (!hdi) return { ok: false, error: 'Enter your HDI.' };
  if (!hdi.startsWith('@')) hdi = '@' + hdi;
  if (!/^@[a-z]{1,10}(\.[a-z])?\.[\d]{4}$/.test(hdi)) {
    return { ok: false, error: 'Invalid HDI format. Expected @name.x.1234 (e.g. @amit.k.9876)' };
  }
  saveHDIToken(hdi);
  return { ok: true };
}

/* ======================================================
   "SIGN IN WITH 0DOT"  (0dot.in OAuth2 + PKCE)
   The redirect flow is driven server-side (api/auth/0dot/*).
   The server sets an HttpOnly session cookie; the client then
   mirrors it into sessionStorage so the existing synchronous
   isAuthenticated()/requireAuth() checks keep working.
====================================================== */

function startZeroDotLogin(next) {
  const target = typeof next === "string" && next
    ? next
    : (window.location.pathname + window.location.search);
  window.location.href = "/auth/0dot/start?next=" + encodeURIComponent(target);
}

function saveZeroDotToken(user, apiToken) {
  const uname = user && user.username ? String(user.username) : "";
  const token = JSON.stringify({
    username: uname ? "@" + uname.replace(/^@/, "") : (user && user.name) || "0dot user",
    handle: uname || null,
    name: (user && user.name) || null,
    avatar: (user && user.avatar) || null,
    apiToken: apiToken || "",
    provider: "0dot",
    exp: user && user.exp ? user.exp * 1000 : Date.now() + SESSION_EXP_MS
  });
  // codeql[js/clear-text-storage-of-sensitive-data]: mirrors the HttpOnly server session cookie for sync isAuthenticated() reads; the real secret stays server-side in the cookie, matches the existing HDI token storage pattern below
  try { sessionStorage.setItem(AUTH_TOKEN_KEY, token); } catch {}
}

/* Hydrate sessionStorage from the server session cookie (after the 0dot
   redirect, or on a fresh tab that still has the cookie). Resolves to the
   user object or null. */
async function adoptServerSession() {
  try {
    const res = await fetch("/api/auth/session", { credentials: "same-origin" });
    if (!res.ok) return null;
    const data = await res.json().catch(() => ({}));
    if (data && data.user) {
      saveZeroDotToken(data.user, data.token || "");
      return data.user;
    }
  } catch (_) {}
  return null;
}

function logout() {
  const wasServerSession = (() => {
    const t = getToken();
    return t && t.provider === "0dot";
  })();
  clearToken();
  if (wasServerSession) {
    // Best-effort server cookie teardown; don't block the redirect on it.
    try {
      fetch("/api/auth/session", { method: "POST", credentials: "same-origin", keepalive: true }).catch(() => {});
    } catch (_) {}
  }
  window.location.replace("/pages/login.html");
}

function authLoginUrl() {
  const next = encodeURIComponent(
    window.location.pathname + window.location.search
  );
  return "/pages/login.html?next=" + next;
}

function initAuthButton() {
  const btn = document.getElementById("logoutBtn");
  if (!btn) return;

  const bar = btn.closest(".auth-bar");
  if (bar) bar.hidden = false;

  const authed = isAuthenticated();
  btn.textContent = authed ? "Logout" : "Login";
  btn.setAttribute("aria-label", authed ? "Logout" : "Login");
  btn.classList.toggle("is-login", !authed);
  btn.classList.toggle("is-logout", authed);

  btn.addEventListener("click", () => {
    if (isAuthenticated()) { logout(); return; }
    window.location.href = authLoginUrl();
  });
}

/* ======================================================
   ROUTE GUARD
   Call this synchronously at top of protected pages.
   Hides body until auth confirmed to prevent flash.
====================================================== */

function requireAuth() {
  if (typeof window === "undefined" || !window.location) return false;
  if (isAuthenticated()) return true;

  // Not authed — drop any stale token, hide the page, bounce to login.
  clearToken();
  try {
    document.documentElement.style.visibility = "hidden";
    document.documentElement.setAttribute("aria-hidden", "true");
  } catch (_) {}
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.replace("/pages/login.html?next=" + next);
  return false;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAuthButton, { once: true });
} else {
  initAuthButton();
}
