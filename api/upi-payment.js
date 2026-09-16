"use strict";

const crypto = require("crypto");
const { csrfGuard } = require("./_response");
const { strict: paymentLimit } = require("./_rate-limit");
const { readJsonBody } = require("./_body");

const CAN_PERSIST = Boolean(process.env.DATABASE_URL) && process.env.NODE_ENV !== "test";
const db = CAN_PERSIST ? require("../lib/db") : null;

// Vercel deploys don't run migrations — ensure the table once per cold start.
let tableReady = null;
function ensureTable() {
  if (!db) return Promise.resolve();
  if (!tableReady) {
    tableReady = db.query(`
      CREATE TABLE IF NOT EXISTS upi_payments (
        id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id      VARCHAR(120) NOT NULL,
        plan_label    VARCHAR(200),
        amount        NUMERIC(12,2),
        customer_name VARCHAR(200),
        upi_id        VARCHAR(120),
        utr           VARCHAR(80),
        kind          VARCHAR(20)  NOT NULL DEFAULT 'payment',
        status        VARCHAR(20)  NOT NULL DEFAULT 'received',
        ip_hash       VARCHAR(16),
        created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `).catch(err => { tableReady = null; throw err; });
  }
  return tableReady;
}

const clip = (v, n) => (v == null ? null : String(v).slice(0, n));
const ipHash = req => crypto
  .createHash("sha256")
  .update(new Date().toISOString().slice(0, 10) + (String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || ""))
  .digest("hex").slice(0, 16);

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://kingofyadav.in");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (csrfGuard(req, res)) return;
  if (!paymentLimit(req, res)) return;

  let body;
  try { body = await readJsonBody(req, 65536); }
  catch { return res.status(400).json({ error: "Invalid request body" }); }
  if (!body || !body.orderId) {
    return res.status(400).json({ error: "Missing orderId" });
  }

  const orderId = clip(body.orderId, 120);
  const isQuote = !body.utr || body.utr === "quote-request";
  const utr     = isQuote ? null : clip(body.utr, 80);

  const record = {
    order_id:      orderId,
    plan_label:    clip(body.planLabel, 200),
    amount:        Number.isFinite(Number(body.amount)) ? Number(body.amount) : null,
    customer_name: clip(body.customerName, 200),
    upi_id:        clip(body.upiId, 120),
    utr,
    kind:          isQuote ? "quote" : "payment",
    ip_hash:       ipHash(req),
  };

  let persisted = false;
  if (db) {
    try {
      await ensureTable();
      await db.query(
        `INSERT INTO upi_payments
           (order_id, plan_label, amount, customer_name, upi_id, utr, kind, ip_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT DO NOTHING`,
        [record.order_id, record.plan_label, record.amount, record.customer_name,
         record.upi_id, record.utr, record.kind, record.ip_hash]
      );
      persisted = true;
    } catch (err) {
      console.error(JSON.stringify({ level: "error", event: "upi_payment_persist_failed", orderId, message: err.message }));
    }
  }

  // Structured log line — kept even when persisted, for observability.
  console.log(JSON.stringify({
    event: isQuote ? "order_quote_request" : "upi_payment_received",
    orderId,
    persisted,
    ts: new Date().toISOString(),
  }));

  return res.status(200).json({
    ok: true,
    orderId,
    persisted,
    message: isQuote ? "Quote request recorded." : "Payment UTR recorded.",
  });
};
