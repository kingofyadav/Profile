"use strict";

// GET /auth/0dot/start?next=/pages/personal.html
// Begins "Sign in with 0dot": mints PKCE + state into a signed, short-lived
// HttpOnly cookie, then 302s the browser to 0dot.in's consent screen.

const zd = require("../../api/auth/_zerodot");
const { sign, randomToken } = require("../../api/_jwt");
const { serializeCookie, appendCookie } = require("../../api/_cookies");

const FLOW_COOKIE = "zd_flow";
const FLOW_TTL_S = 600; // 10 min to complete the round trip

function safeNext(raw) {
  const fallback = "/pages/personal.html";
  if (!raw) return fallback;
  try {
    const d = decodeURIComponent(String(raw));
    if (d[0] !== "/" || d.startsWith("//") || /[\r\n\t]/.test(d)) return fallback;
    return d;
  } catch { return fallback; }
}

function fail(res, msg) {
  res.statusCode = 302;
  // /pages/login.html (with a query string) would 308 through Vercel's
  // cleanUrls redirect to /pages/login, which drops the query string
  // entirely — link the clean path directly so ?error= survives.
  res.setHeader("Location", `/pages/login?error=${encodeURIComponent(msg)}`);
  res.setHeader("Cache-Control", "no-store");
  res.end();
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET");
    res.end(JSON.stringify({ ok: false, error: "Method not allowed" }));
    return;
  }

  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret || !zd.isConfigured()) {
    fail(res, "0dot login is not configured on the server");
    return;
  }

  const next = safeNext(req.query?.next);
  const redirectUri = zd.resolveRedirectUri(req);
  const { verifier, challenge } = zd.makePkce();
  const state = randomToken(16);

  const flow = sign({ typ: "zd_flow", state, verifier, next, redirectUri }, secret, FLOW_TTL_S);
  appendCookie(res, serializeCookie(FLOW_COOKIE, flow, {
    maxAge: FLOW_TTL_S,
    httpOnly: true,
    secure: true,
    sameSite: "Lax", // sent on the top-level GET redirect back from 0dot.in
  }));

  res.statusCode = 302;
  res.setHeader("Location", zd.buildAuthorizeUrl({ redirectUri, state, challenge }));
  res.setHeader("Cache-Control", "no-store");
  res.end();
};

module.exports.FLOW_COOKIE = FLOW_COOKIE;
