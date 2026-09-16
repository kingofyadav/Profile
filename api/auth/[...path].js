"use strict";

// Single dispatcher for every /api/auth/* route, consolidated from separate
// files (session, request-otp, verify-otp, 0dot/start, 0dot/callback) to
// stay under the Hobby plan's serverless function count limit. Each route's
// actual logic lives in lib/auth-handlers/ — this file only routes to it,
// unchanged from before the merge.

const session    = require("../../lib/auth-handlers/session");
const requestOtp = require("../../lib/auth-handlers/request-otp");
const verifyOtp  = require("../../lib/auth-handlers/verify-otp");
const zdStart    = require("../../lib/auth-handlers/zerodot-start");
const zdCallback = require("../../lib/auth-handlers/zerodot-callback");

module.exports = async function handler(req, res) {
  // Vercel populates req.query["...path"] for the [...path] dynamic segment
  // (string, or array if matched through multiple hops); fall back to
  // parsing req.url directly in case that's ever absent.
  const qp = req.query && req.query["...path"];
  let path;
  if (Array.isArray(qp)) path = qp.join("/");
  else if (typeof qp === "string" && qp) path = qp;
  else {
    const segments = req.url.split("?")[0].split("/").filter(Boolean);
    const authIdx  = segments.indexOf("auth");
    path = segments.slice(authIdx + 1).join("/");
  }

  switch (path) {
    case "session":            return session(req, res);
    case "request-otp":        return requestOtp(req, res);
    case "verify-otp":         return verifyOtp(req, res);
    case "0dot-start":         return zdStart(req, res);
    case "0dot-callback":      return zdCallback(req, res);
    default:
      res.statusCode = 404;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ ok: false, error: "Not found" }));
  }
};
