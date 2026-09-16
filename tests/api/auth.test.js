"use strict";

// Auth handlers proxy to OTP_API_BASE via _proxy.js — mock fetch globally.
global.fetch = jest.fn();

// Stub _proxy so we don't need a real OTP server
jest.mock("../../api/auth/_proxy", () => ({
  getUpstreamBase: () => "https://test-otp.example.com",
  proxyJson: jest.fn(),
}));

const { proxyJson } = require("../../api/auth/_proxy");
const requestOtp = require("../../lib/auth-handlers/request-otp");
const verifyOtp  = require("../../lib/auth-handlers/verify-otp");

function makeRes() {
  const h = {};
  return {
    statusCode: 200, _body: "",
    setHeader(k, v) { h[k] = v; },
    end(b) { this._body = b || ""; },
    headers: h,
  };
}

function makeReq(method, body = {}) {
  return { method, body, headers: {}, socket: {} };
}

beforeEach(() => {
  proxyJson.mockReset();
});

// ── request-otp ──────────────────────────────────────────────────────────────

describe("request-otp handler", () => {
  it("returns 204 for OPTIONS", async () => {
    const req = makeReq("OPTIONS");
    const res = makeRes();
    await requestOtp(req, res);
    expect(res.statusCode).toBe(204);
  });

  it("returns 405 for GET", async () => {
    const req = makeReq("GET");
    const res = makeRes();
    await requestOtp(req, res);
    expect(res.statusCode).toBe(405);
  });

  it("returns 400 when phone missing", async () => {
    const req = makeReq("POST", {});
    const res = makeRes();
    await requestOtp(req, res);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res._body).ok).toBe(false);
    expect(JSON.parse(res._body).error).toMatch(/mobile/i);
  });

  it("proxies to upstream when phone is present", async () => {
    proxyJson.mockResolvedValueOnce(undefined);
    const req = makeReq("POST", { phone: "9876543210" });
    const res = makeRes();
    await requestOtp(req, res);
    expect(proxyJson).toHaveBeenCalledWith(req, res, "/auth/request-otp", { phone: "9876543210" });
  });

  it("returns 502 when upstream throws", async () => {
    proxyJson.mockRejectedValueOnce(new Error("network error"));
    const req = makeReq("POST", { phone: "9876543210" });
    const res = makeRes();
    await requestOtp(req, res);
    expect(res.statusCode).toBe(502);
    expect(JSON.parse(res._body).ok).toBe(false);
  });
});

// ── verify-otp ───────────────────────────────────────────────────────────────

describe("verify-otp handler", () => {
  it("returns 400 when phone missing", async () => {
    const req = makeReq("POST", { otp: "123456" });
    const res = makeRes();
    await verifyOtp(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when otp missing", async () => {
    const req = makeReq("POST", { phone: "9876543210" });
    const res = makeRes();
    await verifyOtp(req, res);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res._body).error).toMatch(/otp/i);
  });

  it("proxies to upstream when both present", async () => {
    proxyJson.mockResolvedValueOnce(undefined);
    const req = makeReq("POST", { phone: "9876543210", otp: "654321" });
    const res = makeRes();
    await verifyOtp(req, res);
    expect(proxyJson).toHaveBeenCalledWith(
      req, res, "/auth/verify-otp", { phone: "9876543210", otp: "654321" }
    );
  });

  it("returns 502 when upstream throws", async () => {
    proxyJson.mockRejectedValueOnce(new Error("timeout"));
    const req = makeReq("POST", { phone: "9876543210", otp: "000000" });
    const res = makeRes();
    await verifyOtp(req, res);
    expect(res.statusCode).toBe(502);
  });

  it("returns 204 for OPTIONS", async () => {
    const req = makeReq("OPTIONS");
    const res = makeRes();
    await verifyOtp(req, res);
    expect(res.statusCode).toBe(204);
  });

  it("returns 405 for GET", async () => {
    const req = makeReq("GET");
    const res = makeRes();
    await verifyOtp(req, res);
    expect(res.statusCode).toBe(405);
  });

  it("accepts body.mobile as alias for phone", async () => {
    proxyJson.mockResolvedValueOnce(undefined);
    const req = makeReq("POST", { mobile: "9876543210", otp: "654321" });
    const res = makeRes();
    await verifyOtp(req, res);
    expect(proxyJson).toHaveBeenCalledWith(
      req, res, "/auth/verify-otp",
      expect.objectContaining({ phone: "9876543210", otp: "654321" })
    );
  });
});
