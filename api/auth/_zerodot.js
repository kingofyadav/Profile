"use strict";

// "Sign in with 0dot" — shared config + helpers for the OAuth2
// authorization-code + PKCE flow against 0dot.in (its Phase-10 developer
// platform). 0dot issues opaque bearer tokens (not JWTs / OIDC), so after
// the code exchange we call /api/v1/users/me to read the identity, then
// mint our OWN short session (api/_jwt.js) for kingofyadav.in.
//
// Endpoints (verified against the 0dot reference implementation):
//   authorize : GET  {ISSUER}/oauth/authorize
//   token     : POST {ISSUER}/api/oauth/token   (form-encoded)
//   identity  : GET  {ISSUER}/api/v1/users/me   (Bearer, scope profile:read)

const { createHash, randomBytes } = require("crypto");

const ISSUER   = (process.env.ZERODOT_ISSUER || "https://0dot.in").replace(/\/+$/, "");
const CLIENT_ID     = process.env.ZERODOT_CLIENT_ID || "";
const CLIENT_SECRET = process.env.ZERODOT_CLIENT_SECRET || "";
const SCOPE  = process.env.ZERODOT_SCOPE || "profile:read";
// Exact-match against what's registered on the 0dot DeveloperApp. Falls back
// to deriving from the request host when not pinned (local dev).
const REDIRECT_URI = process.env.ZERODOT_REDIRECT_URI || "";

const AUTHORIZE_URL = `${ISSUER}/oauth/authorize`;
const TOKEN_URL     = `${ISSUER}/api/oauth/token`;
const USERINFO_URL  = `${ISSUER}/api/v1/users/me`;

function isConfigured() {
  return Boolean(CLIENT_ID && CLIENT_SECRET);
}

function base64url(buf) {
  return Buffer.from(buf).toString("base64url");
}

/** PKCE: random verifier + its S256 challenge. */
function makePkce() {
  const verifier = base64url(randomBytes(48)); // 64 chars, within RFC 7636's 43–128
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

function resolveRedirectUri(req) {
  if (REDIRECT_URI) return REDIRECT_URI;
  const proto = (req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  const host  = req.headers["x-forwarded-host"] || req.headers.host || "kingofyadav.in";
  return `${proto}://${host}/auth/0dot/callback`;
}

function buildAuthorizeUrl({ redirectUri, state, challenge }) {
  const u = new URL(AUTHORIZE_URL);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", CLIENT_ID);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("scope", SCOPE);
  u.searchParams.set("state", state);
  u.searchParams.set("code_challenge", challenge);
  u.searchParams.set("code_challenge_method", "S256");
  return u.toString();
}

/** Exchange an authorization code for tokens (server-to-server). */
async function exchangeCode({ code, verifier, redirectUri }) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code,
    code_verifier: verifier,
    redirect_uri: redirectUri,
  });
  const resp = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.access_token) {
    const err = new Error(data.error || `Token exchange failed (${resp.status})`);
    err.status = 502;
    throw err;
  }
  return data; // { access_token, refresh_token, token_type, expires_in, scope }
}

/** Read the signed-in 0dot identity with an access token. */
async function fetchIdentity(accessToken) {
  const resp = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.id) {
    const err = new Error(data.error || `Could not read 0dot identity (${resp.status})`);
    err.status = 502;
    throw err;
  }
  return data; // { id, username, displayName, avatarUrl, ... }
}

module.exports = {
  ISSUER, CLIENT_ID, SCOPE,
  AUTHORIZE_URL, TOKEN_URL, USERINFO_URL,
  isConfigured, makePkce, resolveRedirectUri, buildAuthorizeUrl,
  exchangeCode, fetchIdentity,
};
