"use strict";

/** Parse a Cookie header into a plain object. */
function parseCookies(req) {
  const header = req.headers?.cookie || "";
  const out = {};
  for (const pair of header.split(";")) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    const k = pair.slice(0, idx).trim();
    if (!k) continue;
    out[k] = decodeURIComponent(pair.slice(idx + 1).trim());
  }
  return out;
}

/**
 * Serialize one Set-Cookie value.
 * @param {string} name
 * @param {string} value  ("" + maxAge:0 to delete)
 * @param {object} [opts] { maxAge, path, httpOnly, secure, sameSite }
 */
function serializeCookie(name, value, opts = {}) {
  const {
    maxAge,
    path = "/",
    httpOnly = true,
    secure = true,
    sameSite = "Lax",
  } = opts;
  let str = `${name}=${encodeURIComponent(value)}`;
  str += `; Path=${path}`;
  if (maxAge != null) str += `; Max-Age=${Math.floor(maxAge)}`;
  if (httpOnly) str += "; HttpOnly";
  if (secure) str += "; Secure";
  if (sameSite) str += `; SameSite=${sameSite}`;
  return str;
}

/** Append a Set-Cookie header without clobbering existing ones. */
function appendCookie(res, cookieStr) {
  const prev = res.getHeader("Set-Cookie");
  if (!prev) res.setHeader("Set-Cookie", cookieStr);
  else if (Array.isArray(prev)) res.setHeader("Set-Cookie", [...prev, cookieStr]);
  else res.setHeader("Set-Cookie", [prev, cookieStr]);
}

module.exports = { parseCookies, serializeCookie, appendCookie };
