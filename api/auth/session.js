"use strict";

// GET  /api/auth/session  → { ok, user, token }  (reads the hi_session cookie)
// POST /api/auth/session  with { action: "logout" } → clears it
// Lets the static front-end hydrate sessionStorage after the 0dot redirect
// flow, and tear the server session down on logout.

const { verify } = require("../_jwt");
const { parseCookies, serializeCookie, appendCookie } = require("../_cookies");
const { SESSION_COOKIE } = require("./0dot/callback");

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.end(JSON.stringify(payload));
}

function clearSession(res) {
  appendCookie(res, serializeCookie(SESSION_COOKIE, "", { maxAge: 0 }));
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://kingofyadav.in");
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") { res.statusCode = 204; res.end(); return; }

  if (req.method === "POST") {
    // Body is optional; any POST here is a logout.
    clearSession(res);
    json(res, 200, { ok: true, loggedOut: true });
    return;
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, POST, OPTIONS");
    json(res, 405, { ok: false, error: "Method not allowed" });
    return;
  }

  const secret = process.env.AUTH_JWT_SECRET;
  const raw = parseCookies(req)[SESSION_COOKIE];
  if (!secret || !raw) { json(res, 200, { ok: true, user: null }); return; }

  let claims;
  try { claims = verify(raw, secret); }
  catch { clearSession(res); json(res, 200, { ok: true, user: null }); return; }

  if (claims.typ !== "hi_session") { clearSession(res); json(res, 200, { ok: true, user: null }); return; }

  json(res, 200, {
    ok: true,
    token: raw,
    user: {
      provider: claims.provider || "0dot",
      id: claims.sub,
      username: claims.username || null,
      name: claims.name || null,
      avatar: claims.avatar || null,
      exp: claims.exp,
    },
  });
};
