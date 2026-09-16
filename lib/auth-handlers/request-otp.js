"use strict";

const { proxyJson, getUpstreamBase } = require("../../api/auth/_proxy");
const { requireIndianPhone } = require("../../api/_validate");

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.end(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
  res.setHeader("Allow", "POST, OPTIONS");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    send(res, 405, { ok: false, error: "Method not allowed" });
    return;
  }

  const body = req.body || {};
  let phone;
  try {
    phone = requireIndianPhone(body.phone ?? body.mobile);
  } catch (err) {
    send(res, 400, { ok: false, error: err.message });
    return;
  }

  try {
    await proxyJson(req, res, "/auth/request-otp", { ...body, phone });
  } catch (err) {
    send(res, 502, {
      ok: false,
      error: `OTP service unavailable. Configure OTP_API_BASE for ${getUpstreamBase()}.`
    });
  }
};
