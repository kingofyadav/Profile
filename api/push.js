"use strict";

const webpush = require("web-push");
const { csrfGuard } = require("./_response");
const { push: pushLimit } = require("./_rate-limit");
const db      = require("../lib/db");

const TOKEN         = process.env.LIVE_CLASS_TOKEN;
const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const CONTACT       = process.env.VAPID_SUBJECT ?? "mailto:kingofyadav.in@gmail.com";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(CONTACT, VAPID_PUBLIC, VAPID_PRIVATE);
}

const isTeacher = req => {
  const auth = (req.headers["authorization"] ?? "").replace("Bearer ", "");
  return TOKEN && auth === TOKEN;
};

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") {
    if (csrfGuard(req, res)) return;
    if (!pushLimit(req, res)) return;
  }

  if (req.method === "GET") {
    return res.json({ ok: true, publicKey: VAPID_PUBLIC ?? null });
  }

  const { action } = req.body ?? {};

  if (req.method === "POST" && action === "subscribe") {
    const { endpoint, keys, deviceId } = req.body ?? {};
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ ok: false, error: "Invalid subscription object" });
    }
    await db.query(`
      INSERT INTO push_subscriptions (endpoint, p256dh, auth, device_id, last_seen)
      VALUES ($1,$2,$3,$4,NOW())
      ON CONFLICT (endpoint) DO UPDATE SET p256dh=$2, auth=$3, last_seen=NOW()
    `, [endpoint, keys.p256dh, keys.auth, deviceId ?? null]);
    return res.json({ ok: true });
  }

  if (req.method === "POST" && action === "notify") {
    if (!isTeacher(req)) return res.status(401).json({ ok: false, error: "Unauthorized" });
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) return res.status(503).json({ ok: false, error: "VAPID not configured" });

    const { title = "Live Class", body = "Class is starting now!", url = "/pages/live-class.html" } = req.body;
    const payload = JSON.stringify({ title, body, url, icon: "/favicon/android-chrome-192x192.png" });

    const { rows } = await db.query("SELECT * FROM push_subscriptions");
    let sent = 0, failed = 0;
    await Promise.allSettled(rows.map(async row => {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          payload
        );
        sent++;
      } catch (err) {
        failed++;
        if (err.statusCode === 410 || err.statusCode === 404) {
          await db.query("DELETE FROM push_subscriptions WHERE endpoint=$1", [row.endpoint]);
        }
      }
    }));
    return res.json({ ok: true, sent, failed });
  }

  if (req.method === "DELETE") {
    const { endpoint } = req.body ?? {};
    if (endpoint) await db.query("DELETE FROM push_subscriptions WHERE endpoint=$1", [endpoint]);
    return res.json({ ok: true });
  }

  res.status(400).json({ ok: false, error: "Unknown action" });
};
