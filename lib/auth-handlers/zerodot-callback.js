"use strict";

// GET /auth/0dot/callback?code=...&state=...
// The redirect target 0dot.in sends the browser back to. Verifies the PKCE
// flow cookie, exchanges the code for a 0dot access token, reads the 0dot
// identity, then mints our own 24h session cookie for kingofyadav.in and
// hands off to the login page to hydrate the client.

const zd = require("../../api/auth/_zerodot");
const { sign, verify } = require("../../api/_jwt");
const { parseCookies, serializeCookie, appendCookie } = require("../../api/_cookies");
const { FLOW_COOKIE } = require("./zerodot-start");

const SESSION_COOKIE = "hi_session";
const SESSION_TTL_S = 24 * 60 * 60;

function redirect(res, location) {
  res.statusCode = 302;
  res.setHeader("Location", location);
  res.setHeader("Cache-Control", "no-store");
  res.end();
}
function loginError(res, msg) {
  redirect(res, `/pages/login.html?error=${encodeURIComponent(msg)}`);
}
function clearFlow(res) {
  appendCookie(res, serializeCookie(FLOW_COOKIE, "", { maxAge: 0 }));
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET");
    res.end(JSON.stringify({ ok: false, error: "Method not allowed" }));
    return;
  }

  const secret = process.env.AUTH_JWT_SECRET;
  const q = req.query || {};

  clearFlow(res);

  if (q.error) {
    loginError(res, q.error === "access_denied" ? "You cancelled the 0dot sign-in" : String(q.error));
    return;
  }
  if (!secret || !zd.isConfigured()) {
    loginError(res, "0dot login is not configured on the server");
    return;
  }
  if (!q.code || !q.state) {
    loginError(res, "Missing authorization response");
    return;
  }

  // Recover the PKCE flow from the signed cookie.
  let flow;
  try {
    flow = verify(parseCookies(req)[FLOW_COOKIE], secret);
    if (flow.typ !== "zd_flow") throw new Error("wrong token type");
  } catch {
    loginError(res, "Your sign-in session expired — please try again");
    return;
  }
  if (String(q.state) !== flow.state) {
    loginError(res, "Sign-in verification failed — please try again");
    return;
  }

  try {
    const tokens = await zd.exchangeCode({
      code: String(q.code),
      verifier: flow.verifier,
      redirectUri: flow.redirectUri,
    });
    const id = await zd.fetchIdentity(tokens.access_token);

    const username = id.username || null;
    const session = sign({
      typ: "hi_session",
      provider: "0dot",
      sub: String(id.id),
      username,
      name: id.displayName || username || "0dot user",
      avatar: id.avatarUrl || null,
    }, secret, SESSION_TTL_S);

    appendCookie(res, serializeCookie(SESSION_COOKIE, session, {
      maxAge: SESSION_TTL_S,
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    }));

    const next = typeof flow.next === "string" && flow.next.startsWith("/") ? flow.next : "/pages/personal.html";
    redirect(res, `/pages/login.html?connected=1&next=${encodeURIComponent(next)}`);
  } catch (err) {
    console.error(JSON.stringify({ level: "error", event: "zerodot_callback_failed", message: err.message }));
    loginError(res, "Could not complete 0dot sign-in — please try again");
  }
};

module.exports.SESSION_COOKIE = SESSION_COOKIE;
module.exports.SESSION_TTL_S = SESSION_TTL_S;
