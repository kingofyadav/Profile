"use strict";

// "Sign in with 0dot" — PKCE redirect flow (api/auth/0dot/*) + session cookie.

process.env.NODE_ENV = "test";
process.env.AUTH_JWT_SECRET = "test-jwt-secret-at-least-32-chars-long!";
process.env.ZERODOT_ISSUER = "https://0dot.in";
process.env.ZERODOT_CLIENT_ID = "test-client-id";
process.env.ZERODOT_CLIENT_SECRET = "test-client-secret";
process.env.ZERODOT_SCOPE = "profile:read";
process.env.ZERODOT_REDIRECT_URI = "https://kingofyadav.in/auth/0dot/callback";

const jwt = require("../../api/_jwt");
const { parseCookies, serializeCookie } = require("../../api/_cookies");
const startHandler = require("../../api/auth/0dot/start");
const callbackHandler = require("../../api/auth/0dot/callback");
const sessionHandler = require("../../api/auth/session");

const { FLOW_COOKIE } = startHandler;
const { SESSION_COOKIE } = callbackHandler;

function makeRes() {
  const headers = {};
  return {
    statusCode: 200,
    _body: "",
    ended: false,
    setHeader(k, v) { headers[k.toLowerCase()] = v; },
    getHeader(k) { return headers[k.toLowerCase()]; },
    removeHeader(k) { delete headers[k.toLowerCase()]; },
    end(b) { this._body = b || ""; this.ended = true; },
    get headers() { return headers; },
  };
}
function makeReq(method, { query = {}, cookies = {}, headers = {} } = {}) {
  const cookieHeader = Object.entries(cookies).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("; ");
  return {
    method,
    url: "/",
    query,
    headers: { host: "kingofyadav.in", ...(cookieHeader ? { cookie: cookieHeader } : {}), ...headers },
    socket: { remoteAddress: "127.0.0.1" },
  };
}
// Set-Cookie may be a string or array; find one entry by name.
function getSetCookie(res, name) {
  let sc = res.getHeader("set-cookie");
  if (!sc) return null;
  if (!Array.isArray(sc)) sc = [sc];
  return sc.find((c) => c.startsWith(name + "=")) || null;
}
function cookieValue(setCookieStr) {
  return decodeURIComponent(setCookieStr.split(";")[0].split("=").slice(1).join("="));
}

describe("api/_jwt", () => {
  it("signs and verifies a round trip", () => {
    const t = jwt.sign({ a: 1, sub: "x" }, "s3cret", 60);
    const claims = jwt.verify(t, "s3cret");
    expect(claims.a).toBe(1);
    expect(claims.sub).toBe("x");
    expect(claims.exp).toBeGreaterThan(claims.iat);
  });
  it("rejects a tampered token", () => {
    const t = jwt.sign({ a: 1 }, "s3cret", 60);
    expect(() => jwt.verify(t.slice(0, -2) + "xx", "s3cret")).toThrow();
    expect(() => jwt.verify(t, "other-secret")).toThrow(/signature/i);
  });
  it("rejects an expired token", () => {
    const t = jwt.sign({ a: 1 }, "s3cret", -1);
    expect(() => jwt.verify(t, "s3cret")).toThrow(/expired/i);
  });
});

describe("api/_cookies", () => {
  it("round-trips parse <-> serialize", () => {
    const s = serializeCookie("k", "a b/c", { maxAge: 60 });
    expect(s).toMatch(/^k=a%20b%2Fc/);
    expect(s).toMatch(/HttpOnly/);
    expect(s).toMatch(/Secure/);
    expect(s).toMatch(/SameSite=Lax/);
    const parsed = parseCookies({ headers: { cookie: "k=a%20b%2Fc; other=1" } });
    expect(parsed.k).toBe("a b/c");
    expect(parsed.other).toBe("1");
  });
});

describe("GET /auth/0dot/start", () => {
  it("redirects to 0dot authorize with PKCE + sets a signed flow cookie", async () => {
    const res = makeRes();
    await startHandler(makeReq("GET", { query: { next: "/pages/dashboard.html" } }), res);

    expect(res.statusCode).toBe(302);
    const loc = new URL(res.getHeader("location"));
    expect(loc.origin + loc.pathname).toBe("https://0dot.in/oauth/authorize");
    expect(loc.searchParams.get("response_type")).toBe("code");
    expect(loc.searchParams.get("client_id")).toBe("test-client-id");
    expect(loc.searchParams.get("redirect_uri")).toBe("https://kingofyadav.in/auth/0dot/callback");
    expect(loc.searchParams.get("scope")).toBe("profile:read");
    expect(loc.searchParams.get("code_challenge_method")).toBe("S256");
    expect(loc.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const state = loc.searchParams.get("state");
    expect(state).toBeTruthy();

    const flow = jwt.verify(cookieValue(getSetCookie(res, FLOW_COOKIE)), process.env.AUTH_JWT_SECRET);
    expect(flow.typ).toBe("zd_flow");
    expect(flow.state).toBe(state);
    expect(flow.next).toBe("/pages/dashboard.html");
    expect(flow.verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("rejects a non-local next (open redirect)", async () => {
    const res = makeRes();
    await startHandler(makeReq("GET", { query: { next: "https://evil.example/x" } }), res);
    const flow = jwt.verify(cookieValue(getSetCookie(res, FLOW_COOKIE)), process.env.AUTH_JWT_SECRET);
    expect(flow.next).toBe("/pages/personal.html");
  });

  it("bounces to login with an error when not configured", async () => {
    const saved = process.env.ZERODOT_CLIENT_ID;
    jest.resetModules();
    delete process.env.ZERODOT_CLIENT_ID;
    const freshStart = require("../../api/auth/0dot/start");
    const res = makeRes();
    await freshStart(makeReq("GET"), res);
    expect(res.statusCode).toBe(302);
    expect(res.getHeader("location")).toMatch(/\/pages\/login\.html\?error=/);
    process.env.ZERODOT_CLIENT_ID = saved;
    jest.resetModules();
  });
});

describe("GET /auth/0dot/callback", () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  function flowCookie(overrides = {}) {
    return jwt.sign({
      typ: "zd_flow",
      state: "STATE123",
      verifier: "verifier-abc",
      next: "/pages/personal.html",
      redirectUri: "https://kingofyadav.in/auth/0dot/callback",
      ...overrides,
    }, process.env.AUTH_JWT_SECRET, 600);
  }

  it("access_denied -> login error, clears flow cookie", async () => {
    const res = makeRes();
    await callbackHandler(makeReq("GET", { query: { error: "access_denied" }, cookies: { [FLOW_COOKIE]: flowCookie() } }), res);
    expect(res.statusCode).toBe(302);
    expect(res.getHeader("location")).toMatch(/error=/);
    expect(getSetCookie(res, FLOW_COOKIE)).toMatch(/Max-Age=0/);
  });

  it("state mismatch -> login error", async () => {
    const res = makeRes();
    await callbackHandler(makeReq("GET", {
      query: { code: "c", state: "WRONG" },
      cookies: { [FLOW_COOKIE]: flowCookie() },
    }), res);
    expect(decodeURIComponent(res.getHeader("location"))).toMatch(/verification failed/i);
  });

  it("missing/expired flow cookie -> login error", async () => {
    const res = makeRes();
    await callbackHandler(makeReq("GET", { query: { code: "c", state: "STATE123" } }), res);
    expect(decodeURIComponent(res.getHeader("location"))).toMatch(/expired/i);
  });

  it("happy path: exchanges code, reads identity, sets hi_session, hands off", async () => {
    const calls = [];
    global.fetch = jest.fn(async (url, opts) => {
      calls.push({ url: String(url), opts });
      if (String(url).endsWith("/api/oauth/token")) {
        return { ok: true, status: 200, json: async () => ({ access_token: "AT", refresh_token: "RT", token_type: "Bearer", expires_in: 3600, scope: "profile:read" }) };
      }
      if (String(url).endsWith("/api/v1/users/me")) {
        return { ok: true, status: 200, json: async () => ({ id: "usr_1", username: "amit", displayName: "Amit Ku Yadav", avatarUrl: "https://0dot.in/a.png" }) };
      }
      throw new Error("unexpected fetch " + url);
    });

    const res = makeRes();
    await callbackHandler(makeReq("GET", {
      query: { code: "AUTHCODE", state: "STATE123" },
      cookies: { [FLOW_COOKIE]: flowCookie() },
    }), res);

    // token call carried PKCE verifier + client secret
    const tokenCall = calls.find((c) => c.url.endsWith("/api/oauth/token"));
    expect(tokenCall.opts.body.toString()).toContain("code_verifier=verifier-abc");
    expect(tokenCall.opts.body.toString()).toContain("client_secret=test-client-secret");
    // userinfo call carried the bearer token
    const meCall = calls.find((c) => c.url.endsWith("/api/v1/users/me"));
    expect(meCall.opts.headers.Authorization).toBe("Bearer AT");

    expect(res.statusCode).toBe(302);
    expect(res.getHeader("location")).toBe("/pages/login.html?connected=1&next=%2Fpages%2Fpersonal.html");

    const session = jwt.verify(cookieValue(getSetCookie(res, SESSION_COOKIE)), process.env.AUTH_JWT_SECRET);
    expect(session.typ).toBe("hi_session");
    expect(session.provider).toBe("0dot");
    expect(session.sub).toBe("usr_1");
    expect(session.username).toBe("amit");
    expect(session.name).toBe("Amit Ku Yadav");
  });

  it("token exchange failure -> login error, no session", async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 400, json: async () => ({ error: "invalid_grant" }) }));
    const res = makeRes();
    await callbackHandler(makeReq("GET", {
      query: { code: "bad", state: "STATE123" },
      cookies: { [FLOW_COOKIE]: flowCookie() },
    }), res);
    expect(decodeURIComponent(res.getHeader("location"))).toMatch(/could not complete/i);
    expect(getSetCookie(res, SESSION_COOKIE)).toBeNull();
  });
});

describe("/api/auth/session", () => {
  function session(overrides = {}) {
    return jwt.sign({ typ: "hi_session", provider: "0dot", sub: "usr_1", username: "amit", name: "Amit", avatar: null, ...overrides }, process.env.AUTH_JWT_SECRET, 3600);
  }

  it("GET with a valid cookie returns the user", async () => {
    const res = makeRes();
    await sessionHandler(makeReq("GET", { cookies: { [SESSION_COOKIE]: session() } }), res);
    const body = JSON.parse(res._body);
    expect(body.ok).toBe(true);
    expect(body.user.username).toBe("amit");
    expect(body.token).toBeTruthy();
  });

  it("GET with no cookie returns user:null", async () => {
    const res = makeRes();
    await sessionHandler(makeReq("GET"), res);
    expect(JSON.parse(res._body)).toEqual({ ok: true, user: null });
  });

  it("GET with a garbage cookie clears it and returns user:null", async () => {
    const res = makeRes();
    await sessionHandler(makeReq("GET", { cookies: { [SESSION_COOKIE]: "not.a.jwt" } }), res);
    expect(JSON.parse(res._body).user).toBeNull();
    expect(getSetCookie(res, SESSION_COOKIE)).toMatch(/Max-Age=0/);
  });

  it("POST clears the session cookie", async () => {
    const res = makeRes();
    await sessionHandler(makeReq("POST", { cookies: { [SESSION_COOKIE]: session() } }), res);
    const body = JSON.parse(res._body);
    expect(body.loggedOut).toBe(true);
    expect(getSetCookie(res, SESSION_COOKIE)).toMatch(/Max-Age=0/);
  });
});
