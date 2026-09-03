"use strict";

/**
 * Read and JSON-parse a request body — safely, on every runtime.
 *
 * On Vercel's Node runtime the platform buffers the incoming request and parses
 * it into `req.body`, consuming the underlying stream in the process. Handlers
 * that then try to re-read `req.on("data")` get nothing (or hang). So we must
 * prefer `req.body` when the platform has populated it, and only fall back to
 * reading the raw stream locally / in tests where it is still available.
 *
 * Throws an Error with a numeric `.status` (400 invalid JSON, 413 too large).
 *
 * @param {import('http').IncomingMessage & { body?: unknown }} req
 * @param {number} [maxBytes=1000000]
 * @returns {Promise<any>}
 */
async function readJsonBody(req, maxBytes = 1_000_000) {
  const pre = req.body;
  if (pre !== undefined && pre !== null && pre !== "") {
    if (typeof pre === "string") {
      try { return JSON.parse(pre); }
      catch { throw Object.assign(new Error("Invalid JSON"), { status: 400 }); }
    }
    if (Buffer.isBuffer(pre)) {
      const text = pre.toString("utf8");
      try { return text ? JSON.parse(text) : {}; }
      catch { throw Object.assign(new Error("Invalid JSON"), { status: 400 }); }
    }
    return pre; // already an object
  }

  return new Promise((resolve, reject) => {
    let raw = "";
    let settled = false;
    const done = (fn, arg) => { if (!settled) { settled = true; fn(arg); } };

    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > maxBytes) {
        try { req.destroy(); } catch { /* noop */ }
        done(reject, Object.assign(new Error("Request body too large"), { status: 413 }));
      }
    });
    req.on("end", () => {
      try { done(resolve, raw ? JSON.parse(raw) : {}); }
      catch { done(reject, Object.assign(new Error("Invalid JSON"), { status: 400 })); }
    });
    req.on("error", (err) => done(reject, err));
  });
}

module.exports = { readJsonBody };
