"use strict";

const db = require("../../lib/db");
const { ok, created, badRequest, unauthorized, notFound, methodNotAllowed, serverError, preflight } = require("../_response");
const { rateLimit } = require("../_rate-limit");
const { readJsonBody } = require("../_body");

const MAX_SUPPLY = 99;

// 60 req/min — personal dashboard; API key already guards access
const walletLimit = rateLimit({ name: "wallet", max: 60, windowMs: 60_000 });

function checkAuth(req, res) {
  const key = process.env.HI_API_KEY;
  if (!key) { serverError(res, new Error("HI_API_KEY not configured")); return false; }
  if (req.headers["authorization"] === `Bearer ${key}`) return true;
  unauthorized(res);
  return false;
}

function parseSegments(url) {
  const path = url.split("?")[0];
  const segs = path.split("/").filter(Boolean);
  const walletIdx = segs.indexOf("wallet");
  return segs.slice(walletIdx + 1);
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") { preflight(res, "GET, POST, PUT, DELETE, OPTIONS"); return; }
  if (!walletLimit(req, res)) return;
  if (!checkAuth(req, res)) return;

  const segs = parseSegments(req.url);
  const resource = segs[0];
  const id = req.query?.id || segs[1];
  const { method } = req;

  let body = {};
  if (["POST", "PUT", "PATCH"].includes(method)) {
    try { body = await readJsonBody(req, 65536); }
    catch (e) { badRequest(res, e.message || "Invalid request"); return; }
  }

  try {
    // ── BALANCE ────────────────────────────────────────────────────────────────
    if (resource === "balance") {
      if (method !== "GET") { methodNotAllowed(res, "GET, OPTIONS"); return; }
      const { rows } = await db.query(
        "SELECT balance, locked_balance FROM hi_wallet LIMIT 1"
      );
      const wallet = rows[0] || { balance: 0, locked_balance: 0 };
      const { rows: supply } = await db.query(
        "SELECT COALESCE(SUM(amount),0)::int AS issued FROM hi_transactions WHERE type='mint'"
      );
      ok(res, {
        balance: Number(wallet.balance),
        locked: Number(wallet.locked_balance),
        available: Number(wallet.balance) - Number(wallet.locked_balance),
        max_supply: MAX_SUPPLY,
        issued: Number(supply[0].issued),
        remaining_mintable: MAX_SUPPLY - Number(supply[0].issued),
      });
      return;
    }

    // ── TRANSACTIONS ───────────────────────────────────────────────────────────
    if (resource === "transactions") {
      if (method === "GET") {
        const limit = Math.min(parseInt(req.query?.limit || "50", 10), 200);
        const offset = parseInt(req.query?.offset || "0", 10);
        const { rows } = await db.query(
          "SELECT * FROM hi_transactions ORDER BY created_at DESC LIMIT $1 OFFSET $2",
          [limit, offset]
        );
        const { rows: cnt } = await db.query("SELECT COUNT(*)::int AS total FROM hi_transactions");
        ok(res, { transactions: rows, total: cnt[0].total, limit, offset });
        return;
      }
      // POST — mint/burn/reward/spend/transfer (enforces MAX_SUPPLY; idempotent via request_id)
      if (method === "POST") {
        const { type = "mint", amount, description = "", request_id = null } = body;
        if (!amount || amount <= 0) { badRequest(res, "amount must be positive"); return; }

        // Idempotency: if request_id already exists, return the existing row immediately
        if (request_id) {
          const { rows: existing } = await db.query(
            "SELECT * FROM hi_transactions WHERE request_id = $1", [request_id]
          );
          if (existing.length) { ok(res, existing[0]); return; }
        }

        if (type === "mint") {
          const { rows: supply } = await db.query(
            "SELECT COALESCE(SUM(amount),0)::int AS issued FROM hi_transactions WHERE type='mint'"
          );
          const issued = Number(supply[0].issued);
          if (issued + amount > MAX_SUPPLY) {
            badRequest(res, `Mint would exceed max supply of ${MAX_SUPPLY}. Currently issued: ${issued}`);
            return;
          }
          await db.query("UPDATE hi_wallet SET balance = balance + $1, updated_at = NOW()", [amount]);
        }
        if (type === "burn") {
          const { rows: w } = await db.query("SELECT balance FROM hi_wallet LIMIT 1");
          if (!w.length || w[0].balance < amount) { badRequest(res, "Insufficient balance to burn"); return; }
          await db.query("UPDATE hi_wallet SET balance = balance - $1, updated_at = NOW()", [amount]);
        }
        const { rows } = await db.query(
          "INSERT INTO hi_transactions (type, amount, description, request_id) VALUES ($1, $2, $3, $4) RETURNING *",
          [type, amount, description, request_id || null]
        );
        created(res, rows[0]);
        return;
      }
      methodNotAllowed(res, "GET, POST, OPTIONS");
      return;
    }

    // ── VAULT ──────────────────────────────────────────────────────────────────
    // Encrypted vault backups — the actual encryption is done client-side.
    // Server only stores the opaque ciphertext + metadata.
    if (resource === "vault") {
      if (method === "GET" && id) {
        const { rows } = await db.query("SELECT * FROM hi_vault_backups WHERE id=$1", [id]);
        if (!rows.length) { notFound(res, "Vault backup not found"); return; }
        ok(res, rows[0]);
        return;
      }
      if (method === "GET") {
        const { rows } = await db.query(
          "SELECT id, label, size_bytes, created_at, updated_at FROM hi_vault_backups ORDER BY updated_at DESC LIMIT 10"
        );
        ok(res, { backups: rows });
        return;
      }
      if (method === "POST") {
        const { label = "backup", ciphertext, checksum } = body;
        if (!ciphertext) { badRequest(res, "ciphertext is required"); return; }
        const { rows } = await db.query(
          `INSERT INTO hi_vault_backups (label, ciphertext, checksum, size_bytes)
           VALUES ($1, $2, $3, $4) RETURNING id, label, size_bytes, created_at`,
          [label.slice(0, 80), ciphertext, checksum || "", ciphertext.length]
        );
        created(res, rows[0]);
        return;
      }
      if (method === "DELETE" && id) {
        await db.query("DELETE FROM hi_vault_backups WHERE id=$1", [id]);
        ok(res, { deleted: true });
        return;
      }
      methodNotAllowed(res, "GET, POST, DELETE, OPTIONS");
      return;
    }

    // ── MARKETPLACE ────────────────────────────────────────────────────────────
    if (resource === "marketplace") {
      if (method === "GET") {
        const status = req.query?.status || "active";
        const { rows } = await db.query(
          "SELECT * FROM marketplace_listings WHERE status=$1 ORDER BY created_at DESC",
          [status]
        );
        ok(res, { listings: rows });
        return;
      }
      if (method === "POST") {
        const { title, description = "", price_coins, category = "other", tags = [] } = body;
        if (!title) { badRequest(res, "title is required"); return; }
        if (!price_coins || price_coins < 0) { badRequest(res, "price_coins must be >= 0"); return; }
        const { rows } = await db.query(
          `INSERT INTO marketplace_listings (title, description, price_coins, category, tags)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [title.slice(0, 120), description.slice(0, 1000), price_coins, category, JSON.stringify(tags)]
        );
        created(res, rows[0]);
        return;
      }
      if (method === "PUT" && id) {
        const { title, description, price_coins, category, status, tags } = body;
        const { rows } = await db.query(
          `UPDATE marketplace_listings
           SET title=COALESCE($2,title), description=COALESCE($3,description),
               price_coins=COALESCE($4,price_coins), category=COALESCE($5,category),
               status=COALESCE($6,status), tags=COALESCE($7,tags), updated_at=NOW()
           WHERE id=$1 RETURNING *`,
          [id, title, description, price_coins, category, status, tags ? JSON.stringify(tags) : null]
        );
        if (!rows.length) { notFound(res, "Listing not found"); return; }
        ok(res, rows[0]);
        return;
      }
      if (method === "DELETE" && id) {
        await db.query("UPDATE marketplace_listings SET status='removed', updated_at=NOW() WHERE id=$1", [id]);
        ok(res, { removed: true });
        return;
      }
      methodNotAllowed(res, "GET, POST, PUT, DELETE, OPTIONS");
      return;
    }

    // ── MERCHANT ───────────────────────────────────────────────────────────────
    if (resource === "merchant") {
      if (method === "GET") {
        const { rows } = await db.query(
          "SELECT * FROM merchant_requests ORDER BY created_at DESC LIMIT 50"
        );
        ok(res, { requests: rows });
        return;
      }
      if (method === "POST") {
        const { description, amount_coins, reference = "" } = body;
        if (!description) { badRequest(res, "description is required"); return; }
        if (!amount_coins || amount_coins <= 0) { badRequest(res, "amount_coins must be positive"); return; }

        const client = await db.connect();
        try {
          await client.query("BEGIN");
          // Lock wallet row for the duration of the transaction
          const { rows: w } = await client.query(
            "SELECT balance FROM hi_wallet LIMIT 1 FOR UPDATE"
          );
          if (!w.length || w[0].balance < amount_coins) {
            await client.query("ROLLBACK");
            badRequest(res, "Insufficient balance for this merchant payment");
            return;
          }
          await client.query(
            "UPDATE hi_wallet SET balance = balance - $1, updated_at = NOW()",
            [amount_coins]
          );
          await client.query(
            "INSERT INTO hi_transactions (type, amount, description) VALUES ('spend', $1, $2)",
            [amount_coins, `Merchant: ${description}`]
          );
          const { rows } = await client.query(
            "INSERT INTO merchant_requests (description, amount_coins, reference, status) VALUES ($1, $2, $3, 'completed') RETURNING *",
            [description.slice(0, 200), amount_coins, reference.slice(0, 100)]
          );
          await client.query("COMMIT");
          created(res, rows[0]);
        } catch (txErr) {
          await client.query("ROLLBACK").catch(() => {});
          throw txErr;
        } finally {
          client.release();
        }
        return;
      }
      methodNotAllowed(res, "GET, POST, OPTIONS");
      return;
    }

    notFound(res, `Unknown wallet resource: ${resource}`);
  } catch (err) {
    console.error("[wallet-api]", err);
    serverError(res, err);
  }
};
