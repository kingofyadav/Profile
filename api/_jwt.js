"use strict";

// Minimal dependency-free HS256 JWT (sign + verify), matching the shape
// server/otp-server.js already issues so the two stay interchangeable.

const { createHmac, timingSafeEqual, randomBytes } = require("crypto");

function b64url(input) {
  return Buffer.from(input).toString("base64url");
}
function b64urlJson(obj) {
  return b64url(JSON.stringify(obj));
}

/**
 * @param {object} payload  claims (do NOT include iat/exp — added here)
 * @param {string} secret
 * @param {number} [ttlSeconds=86400]
 */
function sign(payload, secret, ttlSeconds = 86_400) {
  if (!secret) throw new Error("JWT secret is not configured");
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + ttlSeconds };
  const unsigned = `${b64urlJson({ alg: "HS256", typ: "JWT" })}.${b64urlJson(body)}`;
  const sig = createHmac("sha256", secret).update(unsigned).digest("base64url");
  return `${unsigned}.${sig}`;
}

/**
 * @returns {object} claims on success
 * @throws  {Error} on malformed / bad-signature / expired token
 */
function verify(token, secret) {
  if (!secret) throw new Error("JWT secret is not configured");
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new Error("Malformed token");
  const [h, p, sig] = parts;
  const expected = createHmac("sha256", secret).update(`${h}.${p}`).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("Bad signature");
  let claims;
  try { claims = JSON.parse(Buffer.from(p, "base64url").toString("utf8")); }
  catch { throw new Error("Malformed claims"); }
  if (claims.exp && Math.floor(Date.now() / 1000) >= claims.exp) throw new Error("Token expired");
  return claims;
}

const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

module.exports = { sign, verify, randomToken };
