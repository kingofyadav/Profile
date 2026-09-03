"use strict";

// ── Rate Limiter ───────────────────────────────────────────────────────────────
// Default store is in-memory (resets on cold start — acceptable for Vercel
// single-instance use). To persist across instances, swap _store for an
// Upstash Redis client with the same get/set interface:
//
//   const { Redis } = require("@upstash/redis");
//   const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL,
//                             token: process.env.UPSTASH_REDIS_REST_TOKEN });
//   const _store = {
//     async get(k) { return redis.get(k); },
//     async set(k, v, ttlMs) { redis.set(k, v, { px: ttlMs }); },
//   };
//
// IPs are SHA-256 hashed before storage for privacy.
//
// Every limiter carries a `name`. The store key is `name + ":" + rawKey`, so
// two limiters on the same IP (e.g. the OTP limiter and the chat limiter) keep
// independent counters and windows. Without the namespace they would share one
// bucket and cannibalise each other's budget.

const { createHash } = require("crypto");

// ── In-memory store with bounded size ─────────────────────────────────────────

const _map = new Map();
const _MAX_STORE_SIZE = 50_000;

function _pruneIfNeeded() {
  if (_map.size < _MAX_STORE_SIZE) return;
  const now = Date.now();
  for (const [k, v] of _map) {
    if (now >= v.resetAt) _map.delete(k);
  }
  if (_map.size >= _MAX_STORE_SIZE) {
    let toPrune = Math.floor(_MAX_STORE_SIZE * 0.2);
    for (const k of _map.keys()) {
      if (toPrune-- <= 0) break;
      _map.delete(k);
    }
  }
}

const _store = {
  get(key) {
    const e = _map.get(key);
    if (!e || Date.now() >= e.resetAt) return null;
    return e;
  },
  set(key, value) {
    _pruneIfNeeded();
    _map.set(key, value);
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function hashKey(raw) {
  return createHash("sha256").update(String(raw)).digest("hex").slice(0, 32);
}

// Back-compat alias — some callers/tests import `hashIp`.
const hashIp = hashKey;

function getClientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (xff) return String(xff).split(",")[0].trim();
  return String(req.socket?.remoteAddress || "unknown");
}

/**
 * Increment the counter for `key`. Returns { allowed, resetAt, remaining }.
 */
function consume(key, max, windowMs) {
  const now = Date.now();
  const entry = _store.get(key);
  if (!entry) {
    const resetAt = now + windowMs;
    _store.set(key, { count: 1, resetAt });
    return { allowed: true, resetAt, remaining: max - 1 };
  }
  if (entry.count >= max) {
    return { allowed: false, resetAt: entry.resetAt, remaining: 0 };
  }
  entry.count += 1;
  _store.set(key, entry);
  return { allowed: true, resetAt: entry.resetAt, remaining: Math.max(0, max - entry.count) };
}

/**
 * Legacy boolean helper (kept for existing tests): true = allowed.
 */
function check(key, max, windowMs) {
  return consume(key, max, windowMs).allowed;
}

// ── Middleware factory ────────────────────────────────────────────────────────

/**
 * Returns a Vercel-compatible middleware that enforces rate limiting.
 * @param {object}   opts
 * @param {string}   [opts.name="default"]  Namespace — keeps this limiter's
 *                                           counter separate from every other.
 * @param {number}   opts.max               Max requests per window
 * @param {number}   opts.windowMs          Window length in milliseconds
 * @param {Function} [opts.keyFn]           Custom key fn(req, ip) → string
 *
 * Usage:  if (!limit(req, res)) return;
 */
function rateLimit({ name = "default", max = 20, windowMs = 60_000, keyFn = null } = {}) {
  return function limit(req, res) {
    // Disabled under Jest so shared limiters don't bleed across test cases.
    // Set RL_ENFORCE=1 to exercise the limiter itself.
    if (process.env.NODE_ENV === "test" && process.env.RL_ENFORCE !== "1") return true;

    const ip = getClientIp(req);
    const rawKey = keyFn ? keyFn(req, ip) : ip;
    const key = `${name}:` + hashKey(rawKey);
    const { allowed, resetAt, remaining } = consume(key, max, windowMs);

    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(resetAt / 1000)));

    if (allowed) return true;

    res.setHeader("Retry-After", String(Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))));
    res.statusCode = 429;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.end(JSON.stringify({ ok: false, error: "Too many requests — please slow down.", code: "RATE_LIMITED" }));
    return false;
  };
}

// ── Pre-built limiters (each namespaced) ──────────────────────────────────────

const chat      = rateLimit({ name: "chat",       max: 30, windowMs: 60_000  }); // 30/min per IP
const auth      = rateLimit({ name: "auth",       max: 5,  windowMs: 60_000  }); // 5 OTP attempts/min
const upload    = rateLimit({ name: "upload",     max: 10, windowMs: 60_000  }); // 10 upload/min
const strict    = rateLimit({ name: "strict",     max: 5,  windowMs: 300_000 }); // 5/5 min (payments)
const claim     = rateLimit({ name: "claim",      max: 5,  windowMs: 600_000 }); // 5 DMCA claims/10 min
const push      = rateLimit({ name: "push",       max: 20, windowMs: 300_000 }); // 20 subscribe ops/5 min
const liveClass = rateLimit({ name: "live-class", max: 120, windowMs: 60_000 }); // 120 board reads/writes/min per IP

module.exports = {
  rateLimit, consume, check, hashKey, hashIp, getClientIp,
  chat, auth, upload, strict, claim, push, liveClass,
};
