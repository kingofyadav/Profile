"use strict";

const { Pool } = require("pg");
const { loadEnv } = require("../../lib/env");
const { rateLimit } = require("../_rate-limit");
const { requireUrl } = require("../_validate");

// ── SSRF guard ────────────────────────────────────────────────────────────────
// Only these public social hosts may be fetched server-side. Anything else
// (internal hostnames, cloud metadata IPs, link-local, raw IP literals) is
// rejected before a request goes out.
const _SOCIAL_HOST_ALLOWLIST = [
  "github.com", "api.github.com",
  "youtube.com", "youtu.be",
  "twitter.com", "x.com",
  "linkedin.com",
  "instagram.com",
  "facebook.com",
  "threads.net",
  "medium.com",
  "dev.to",
  "t.me",
  "mastodon.social",
];

function _assertFetchableSocialUrl(rawUrl) {
  let u;
  try { u = new URL(String(rawUrl)); }
  catch { throw new Error("profile_url is not a valid URL"); }
  if (u.protocol !== "https:") throw new Error("profile_url must be https");
  const host = u.hostname.toLowerCase();
  if (/^[0-9.]+$/.test(host) || host.includes(":")) throw new Error("profile_url host not allowed");
  const ok = _SOCIAL_HOST_ALLOWLIST.some(h => host === h || host.endsWith("." + h));
  if (!ok) throw new Error(`profile_url host not allowed: ${host}`);
  return u.toString();
}

// ── Social profile bio-code checker ───────────────────────────────────────────
async function _checkSocialProfile(platform, profileUrl, verifyCode) {
  let safeUrl;
  try { safeUrl = _assertFetchableSocialUrl(profileUrl); }
  catch (e) { return { verified: false, reason: e.message }; }
  profileUrl = safeUrl;

  const GITHUB_USER = profileUrl.match(/github\.com\/([^/?#]+)/)?.[1];
  try {
    if (GITHUB_USER) {
      const resp = await fetch(`https://api.github.com/users/${GITHUB_USER}`,
        { headers: { "User-Agent": "HI-Verify-Bot/1.0" }, signal: AbortSignal.timeout(8000) });
      if (!resp.ok) return { verified: false, reason: `GitHub API ${resp.status}` };
      const data = await resp.json();
      const haystack = [data.bio, data.name, data.blog, data.company].filter(Boolean).join(" ");
      return { verified: haystack.includes(verifyCode) };
    }
    // General page fetch (YouTube, Twitter, LinkedIn public pages)
    const resp = await fetch(profileUrl,
      { headers: { "User-Agent": "Mozilla/5.0 HI-Verify-Bot/1.0" }, signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return { verified: false, reason: `HTTP ${resp.status}` };
    const html = await resp.text();
    return { verified: html.includes(verifyCode) };
  } catch (e) {
    if (e.name === "TimeoutError" || e.name === "AbortError")
      return { verified: false, reason: "Profile page timed out — try manual verify" };
    return { verified: false, reason: "Cannot reach profile — add code to bio then try again" };
  }
}

loadEnv();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

const checkAuth = (req, res) => {
  const key = process.env.HI_API_KEY;
  if (!key) {
    res.status(500).json({ ok: false, error: "HI_API_KEY is not configured on the server." });
    return false;
  }
  if (req.headers["authorization"] === `Bearer ${key}`) return true;
  res.status(401).json({ ok: false, error: "Unauthorized" });
  return false;
};

module.exports = async (req, res) => {
  if (!checkAuth(req, res)) return;

  const segments = req.url.split("?")[0].split("/").filter(Boolean);
  const hiIdx    = segments.indexOf("hi");
  const resource = segments[hiIdx + 1];
  const id       = req.query.id ?? segments[hiIdx + 2];
  const { method } = req;
  const db = pool;

  try {
    // ── IDENTITY ──────────────────────────────────────────────────
    if (resource === "identity") {
      if (method === "GET") {
        const { rows } = await db.query("SELECT * FROM identity LIMIT 1");
        return res.json({ ok: true, data: rows[0] ?? null });
      }
      if (method === "PUT") {
        const { name, tagline, roles, mission, location, hdi_code } = req.body;
        const rolesJson = JSON.stringify(roles ?? []);
        await db.query(
          "UPDATE identity SET name=$1,tagline=$2,roles=$3::jsonb,mission=$4,location=$5,hdi_code=$6,updated_at=NOW()",
          [name, tagline, rolesJson, mission, location, hdi_code]
        );
        const { rows } = await db.query(`
          INSERT INTO identity (name,tagline,roles,mission,location,hdi_code)
          SELECT $1,$2,$3::jsonb,$4,$5,$6 WHERE NOT EXISTS (SELECT 1 FROM identity)
          RETURNING *`, [name, tagline, rolesJson, mission, location, hdi_code]);
        const final = rows[0] ?? (await db.query("SELECT * FROM identity LIMIT 1")).rows[0];
        return res.json({ ok: true, data: final });
      }
    }

    // ── HABITS ────────────────────────────────────────────────────
    if (resource === "habits") {
      if (method === "GET") {
        const habits = await db.query("SELECT * FROM habits WHERE active=true ORDER BY created_at ASC");
        const logs   = await db.query("SELECT * FROM habit_logs WHERE completed_on >= CURRENT_DATE - 30");
        return res.json({ ok: true, habits: habits.rows, logs: logs.rows });
      }
      if (method === "POST") {
        const { title, description, frequency } = req.body;
        const { rows } = await db.query(
          "INSERT INTO habits (title,description,frequency) VALUES ($1,$2,$3) RETURNING *",
          [title, description, frequency ?? "daily"]);
        return res.status(201).json({ ok: true, data: rows[0] });
      }
      if (method === "PUT" && id) {
        if (req.body.log) {
          const { rows: ex } = await db.query("SELECT id FROM habit_logs WHERE habit_id=$1 AND completed_on=CURRENT_DATE", [id]);
          if (ex.length) {
            await db.query("DELETE FROM habit_logs WHERE habit_id=$1 AND completed_on=CURRENT_DATE", [id]);
            return res.json({ ok: true, completed: false });
          }
          await db.query("INSERT INTO habit_logs (habit_id) VALUES ($1)", [id]);
          return res.json({ ok: true, completed: true });
        }
        const { title, description, frequency, active } = req.body;
        const { rows } = await db.query(
          "UPDATE habits SET title=$2,description=$3,frequency=$4,active=$5 WHERE id=$1 RETURNING *",
          [id, title, description, frequency, active]);
        return res.json({ ok: true, data: rows[0] });
      }
      if (method === "DELETE" && id) {
        await db.query("DELETE FROM habits WHERE id=$1", [id]);
        return res.json({ ok: true });
      }
    }

    // ── GOALS ─────────────────────────────────────────────────────
    if (resource === "goals") {
      if (method === "GET") {
        const { rows } = await db.query("SELECT * FROM goals ORDER BY status='active' DESC, deadline ASC NULLS LAST");
        return res.json({ ok: true, data: rows });
      }
      if (method === "POST") {
        const { title, body, progress, deadline, status } = req.body;
        const { rows } = await db.query(
          "INSERT INTO goals (title,body,progress,deadline,status) VALUES ($1,$2,$3,$4,$5) RETURNING *",
          [title, body, progress ?? 0, deadline ?? null, status ?? "active"]);
        return res.status(201).json({ ok: true, data: rows[0] });
      }
      if (method === "PUT" && id) {
        const { title, body, progress, deadline, status } = req.body;
        const { rows } = await db.query(
          "UPDATE goals SET title=$2,body=$3,progress=$4,deadline=$5,status=$6,updated_at=NOW() WHERE id=$1 RETURNING *",
          [id, title, body, progress, deadline ?? null, status]);
        return res.json({ ok: true, data: rows[0] });
      }
      if (method === "DELETE" && id) {
        await db.query("DELETE FROM goals WHERE id=$1", [id]);
        return res.json({ ok: true });
      }
    }

    // ── NOTES ─────────────────────────────────────────────────────
    if (resource === "notes") {
      if (method === "GET") {
        const { rows } = await db.query("SELECT * FROM notes ORDER BY updated_at DESC");
        return res.json({ ok: true, data: rows });
      }
      if (method === "POST") {
        const { title, body, tags } = req.body;
        const { rows } = await db.query(
          "INSERT INTO notes (title,body,tags) VALUES ($1,$2,$3) RETURNING *",
          [title, body, JSON.stringify(tags ?? [])]);
        return res.status(201).json({ ok: true, data: rows[0] });
      }
      if (method === "PUT" && id) {
        const { title, body, tags } = req.body;
        const { rows } = await db.query(
          "UPDATE notes SET title=$2,body=$3,tags=$4,updated_at=NOW() WHERE id=$1 RETURNING *",
          [id, title, body, JSON.stringify(tags ?? [])]);
        return res.json({ ok: true, data: rows[0] });
      }
      if (method === "DELETE" && id) {
        await db.query("DELETE FROM notes WHERE id=$1", [id]);
        return res.json({ ok: true });
      }
    }

    // ── MOOD ──────────────────────────────────────────────────────
    if (resource === "mood") {
      if (method === "GET") {
        const { rows } = await db.query("SELECT * FROM mood_logs ORDER BY logged_on DESC LIMIT 30");
        return res.json({ ok: true, data: rows });
      }
      if (method === "POST") {
        const { mood, energy, note } = req.body;
        const { rows } = await db.query(
          "INSERT INTO mood_logs (mood,energy,note) VALUES ($1,$2,$3) ON CONFLICT (logged_on) DO UPDATE SET mood=$1,energy=$2,note=$3 RETURNING *",
          [mood, energy, note]);
        return res.json({ ok: true, data: rows[0] });
      }
    }

    // ── TASKS ─────────────────────────────────────────────────────
    if (resource === "tasks") {
      if (method === "GET") {
        const { rows } = await db.query("SELECT * FROM tasks ORDER BY done ASC, due_date ASC NULLS LAST");
        return res.json({ ok: true, data: rows });
      }
      if (method === "POST") {
        const { title, category, due_date } = req.body;
        const { rows } = await db.query(
          "INSERT INTO tasks (title,category,due_date) VALUES ($1,$2,$3) RETURNING *",
          [title, category, due_date ?? null]);
        return res.status(201).json({ ok: true, data: rows[0] });
      }
      if (method === "PUT" && id) {
        const { title, category, done, due_date } = req.body;
        const { rows } = await db.query(
          "UPDATE tasks SET title=$2,category=$3,done=$4,due_date=$5,updated_at=NOW() WHERE id=$1 RETURNING *",
          [id, title, category, done, due_date ?? null]);
        return res.json({ ok: true, data: rows[0] });
      }
      if (method === "DELETE" && id) {
        await db.query("DELETE FROM tasks WHERE id=$1", [id]);
        return res.json({ ok: true });
      }
    }

    // ── CONTACTS ──────────────────────────────────────────────────
    if (resource === "contacts") {
      if (method === "GET") {
        const { rows } = await db.query("SELECT * FROM contacts ORDER BY name ASC");
        return res.json({ ok: true, data: rows });
      }
      if (method === "POST") {
        const { name, email, phone, company, note, follow_up_date } = req.body;
        const { rows } = await db.query(
          "INSERT INTO contacts (name,email,phone,company,note,follow_up_date) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
          [name, email, phone, company, note, follow_up_date ?? null]);
        return res.status(201).json({ ok: true, data: rows[0] });
      }
      if (method === "PUT" && id) {
        const { name, email, phone, company, note, follow_up_date } = req.body;
        const { rows } = await db.query(
          "UPDATE contacts SET name=$2,email=$3,phone=$4,company=$5,note=$6,follow_up_date=$7,updated_at=NOW() WHERE id=$1 RETURNING *",
          [id, name, email, phone, company, note, follow_up_date ?? null]);
        return res.json({ ok: true, data: rows[0] });
      }
      if (method === "DELETE" && id) {
        await db.query("DELETE FROM contacts WHERE id=$1", [id]);
        return res.json({ ok: true });
      }
    }

    // ── EVENTS ────────────────────────────────────────────────────
    if (resource === "events") {
      if (method === "GET") {
        const { rows } = await db.query("SELECT e.*,c.name AS contact_name FROM events e LEFT JOIN contacts c ON e.contact_id=c.id ORDER BY e.event_date ASC");
        return res.json({ ok: true, data: rows });
      }
      if (method === "POST") {
        const { title, description, event_date, follow_up_date, contact_id } = req.body;
        const { rows } = await db.query(
          "INSERT INTO events (title,description,event_date,follow_up_date,contact_id) VALUES ($1,$2,$3,$4,$5) RETURNING *",
          [title, description, event_date, follow_up_date ?? null, contact_id ?? null]);
        return res.status(201).json({ ok: true, data: rows[0] });
      }
      if (method === "PUT" && id) {
        const { title, description, event_date, follow_up_date, contact_id } = req.body;
        const { rows } = await db.query(
          "UPDATE events SET title=$2,description=$3,event_date=$4,follow_up_date=$5,contact_id=$6 WHERE id=$1 RETURNING *",
          [id, title, description, event_date, follow_up_date ?? null, contact_id ?? null]);
        return res.json({ ok: true, data: rows[0] });
      }
      if (method === "DELETE" && id) {
        await db.query("DELETE FROM events WHERE id=$1", [id]);
        return res.json({ ok: true });
      }
    }

    // ── PROJECTS ──────────────────────────────────────────────────
    if (resource === "projects") {
      if (method === "GET") {
        const projects = await db.query("SELECT * FROM projects ORDER BY priority DESC, deadline ASC NULLS LAST");
        const tasks    = await db.query("SELECT * FROM project_tasks ORDER BY created_at ASC");
        const byProject = tasks.rows.reduce((acc, t) => {
          (acc[t.project_id] ??= []).push(t);
          return acc;
        }, {});
        return res.json({ ok: true, data: projects.rows.map(p => ({ ...p, tasks: byProject[p.id] ?? [] })) });
      }
      if (method === "POST") {
        if (req.body.project_id) {
          const { project_id, title, due_date } = req.body;
          const { rows } = await db.query(
            "INSERT INTO project_tasks (project_id,title,due_date) VALUES ($1,$2,$3) RETURNING *",
            [project_id, title, due_date ?? null]);
          return res.status(201).json({ ok: true, data: rows[0] });
        }
        const { title, description, priority, status, deadline } = req.body;
        const { rows } = await db.query(
          "INSERT INTO projects (title,description,priority,status,deadline) VALUES ($1,$2,$3,$4,$5) RETURNING *",
          [title, description, priority ?? 3, status ?? "active", deadline ?? null]);
        return res.status(201).json({ ok: true, data: rows[0] });
      }
      if (method === "PUT" && id) {
        if (req.body.task_id) {
          const { task_id, done } = req.body;
          const { rows } = await db.query("UPDATE project_tasks SET done=$2 WHERE id=$1 RETURNING *", [task_id, done]);
          return res.json({ ok: true, data: rows[0] });
        }
        const { title, description, priority, status, deadline } = req.body;
        const { rows } = await db.query(
          "UPDATE projects SET title=$2,description=$3,priority=$4,status=$5,deadline=$6,updated_at=NOW() WHERE id=$1 RETURNING *",
          [id, title, description, priority, status, deadline ?? null]);
        return res.json({ ok: true, data: rows[0] });
      }
      if (method === "DELETE" && id) {
        await db.query("DELETE FROM projects WHERE id=$1", [id]);
        return res.json({ ok: true });
      }
    }

    // ── CHAT ──────────────────────────────────────────────────────
    if (resource === "chat") {
      if (method === "GET") {
        if (id) {
          const { rows } = await db.query("SELECT * FROM chat_sessions WHERE id=$1", [id]);
          return res.json({ ok: true, data: rows[0] ?? null });
        }
        const { rows } = await db.query("SELECT id,updated_at FROM chat_sessions ORDER BY updated_at DESC LIMIT 30");
        return res.json({ ok: true, data: rows });
      }
      if (method === "POST") {
        const { session_id, messages } = req.body;
        const sid = session_id ?? `session-${new Date().toISOString().slice(0, 10)}`;
        const { rows } = await db.query(
          "INSERT INTO chat_sessions (id,messages) VALUES ($1,$2) ON CONFLICT (id) DO UPDATE SET messages=$2,updated_at=NOW() RETURNING *",
          [sid, JSON.stringify(messages)]);
        return res.json({ ok: true, data: rows[0] });
      }
      if (method === "DELETE" && id) {
        await db.query("DELETE FROM chat_sessions WHERE id=$1", [id]);
        return res.json({ ok: true });
      }
    }

    // ── LICENSES ──────────────────────────────────────────────────
    if (resource === "licenses") {
      if (method === "GET") {
        const { rows } = await db.query("SELECT * FROM hdi_licenses ORDER BY claim_date DESC");
        return res.json({ ok: true, data: rows });
      }
      if (method === "POST") {
        const { claim_id, content_hash, perceptual_hash, status, metadata } = req.body;
        const { rows } = await db.query(
          "INSERT INTO hdi_licenses (claim_id,content_hash,perceptual_hash,status,metadata) VALUES ($1,$2,$3,$4,$5) RETURNING *",
          [claim_id, content_hash, perceptual_hash ?? null, status ?? "active", JSON.stringify(metadata ?? {})]);
        return res.status(201).json({ ok: true, data: rows[0] });
      }
      if (method === "PUT" && id) {
        const { claim_id, content_hash, perceptual_hash, status, metadata } = req.body;
        const { rows } = await db.query(
          "UPDATE hdi_licenses SET claim_id=$2,content_hash=$3,perceptual_hash=$4,status=$5,metadata=$6 WHERE id=$1 RETURNING *",
          [id, claim_id, content_hash, perceptual_hash ?? null, status, JSON.stringify(metadata ?? {})]);
        return res.json({ ok: true, data: rows[0] });
      }
      if (method === "DELETE" && id) {
        await db.query("DELETE FROM hdi_licenses WHERE id=$1", [id]);
        return res.json({ ok: true });
      }
    }

    // ── SEED-BLOGS (idempotent blog license seeder) ───────────────
    if (resource === "seed-blogs") {
      if (method !== "POST") return res.status(405).json({ ok: false, error: "POST only" });
      const crypto = require("crypto");
      const blogData = require("../../blog-data.json");
      let inserted = 0, skipped = 0;
      for (const post of blogData) {
        const slug      = (post.url || "").replace(/.*\//, "").replace(/\.html$/, "");
        const claimId   = `HI-BLOG-${slug}`;
        const contentHash = crypto.createHash("sha256").update(post.title + post.url).digest("hex").slice(0, 32);
        const metadata  = {
          title: post.title, type: "blog-post", category: post.category,
          url: post.url, image: post.image, created: post.date,
          author: "Amit Ku Yadav", excerpt: post.excerpt,
        };
        const { rows: ex } = await db.query(
          "SELECT id FROM hdi_licenses WHERE claim_id=$1", [claimId]);
        if (ex.length) { skipped++; continue; }
        await db.query(
          "INSERT INTO hdi_licenses (claim_id,content_hash,status,metadata) VALUES ($1,$2,'active',$3)",
          [claimId, contentHash, JSON.stringify(metadata)]);
        inserted++;
      }
      return res.json({ ok: true, inserted, skipped, total: blogData.length,
        message: `Seeded ${inserted} new blog licenses (${skipped} already existed).` });
    }

    // ── DETECT (pHash comparison — public, no auth) ────────────────
    if (resource === "detect") {
      res.setHeader("Access-Control-Allow-Origin", "*");
      if (method === "OPTIONS") return res.status(204).end();
      if (method !== "POST") return res.status(405).json({ ok: false, error: "POST only" });
      const { phash, watermark } = req.body ?? {};

      const matches = [];

      // Watermark direct lookup (highest confidence)
      if (watermark) {
        const { rows: wmRows } = await db.query(
          "SELECT claim_id, metadata FROM hdi_licenses WHERE claim_id=$1 AND status='active'",
          [watermark]);
        if (wmRows.length) {
          const r = wmRows[0]; const meta = r.metadata ?? {};
          matches.push({ claim_id: r.claim_id, confidence: 100, method: "watermark",
            title: meta.title ?? "Untitled", author: meta.author ?? "Amit Ku Yadav",
            created: meta.created ?? null, verify_url: `https://kingofyadav.in/verify/${r.claim_id}` });
        }
      }

      // pHash Hamming distance match
      let checked = 0;
      if (phash && /^[01]{64}$/.test(phash)) {
        const { rows } = await db.query(
          "SELECT claim_id, perceptual_hash, metadata FROM hdi_licenses WHERE perceptual_hash IS NOT NULL AND status='active'");
        checked = rows.length;
        const THRESHOLD = 10;
        for (const r of rows) {
          let dist = 0;
          for (let i = 0; i < 64; i++) if (phash[i] !== r.perceptual_hash[i]) dist++;
          if (dist <= THRESHOLD) {
            const meta = r.metadata ?? {};
            const confidence = Math.round((1 - dist / 64) * 100);
            if (!matches.find(m => m.claim_id === r.claim_id)) {
              matches.push({ claim_id: r.claim_id, confidence, method: "phash",
                title: meta.title ?? "Untitled", author: meta.author ?? "Amit Ku Yadav",
                created: meta.created ?? null, verify_url: `https://kingofyadav.in/verify/${r.claim_id}` });
            }
          }
        }
        matches.sort((a, b) => b.confidence - a.confidence);
      }

      return res.json({ ok: true, matches: matches.slice(0, 5), checked });
    }

    // ── ALERTS ─────────────────────────────────────────────────────
    if (resource === "alerts") {
      if (!checkAuth(req, res)) return;

      if (method === "GET") {
        const { rows } = await db.query("SELECT * FROM hi_repost_alerts ORDER BY created_at DESC LIMIT 200");
        return res.json({ ok: true, data: rows });
      }
      if (method === "PUT") {
        if (!id) return res.status(400).json({ ok: false, error: "id required" });
        const { status: s } = req.body ?? {};
        const valid = ["new", "actioned", "ignored", "dmca_sent"];
        if (!valid.includes(s)) return res.status(400).json({ ok: false, error: "invalid status" });
        await db.query("UPDATE hi_repost_alerts SET status=$1 WHERE id=$2", [s, id]);
        return res.json({ ok: true });
      }
      if (method === "DELETE") {
        if (!id) return res.status(400).json({ ok: false, error: "id required" });
        await db.query("DELETE FROM hi_repost_alerts WHERE id=$1", [id]);
        return res.json({ ok: true });
      }
    }

    // ── REPORT (public community repost report) ────────────────────
    if (resource === "report") {
      res.setHeader("Access-Control-Allow-Origin", "*");
      if (method === "OPTIONS") return res.status(204).end();
      if (method !== "POST") return res.status(405).json({ ok: false, error: "POST only" });
      const limit = rateLimit({ name: "hi-report", max: 10, windowMs: 300_000 });
      if (!limit(req, res)) return;

      const { infringing_url, license_id, platform, phash, reporter_note } = req.body ?? {};
      try { requireUrl(infringing_url, "infringing_url"); } catch (e) { return res.status(400).json({ ok: false, error: e.message }); }

      let confidence = 0;
      let matchedId  = license_id ?? null;

      if (phash && /^[01]{64}$/.test(phash)) {
        const { rows } = await db.query(
          "SELECT claim_id, perceptual_hash FROM hdi_licenses WHERE perceptual_hash IS NOT NULL AND status='active'");
        let best = null;
        for (const r of rows) {
          let dist = 0;
          for (let i = 0; i < 64; i++) if (phash[i] !== r.perceptual_hash[i]) dist++;
          if (dist <= 10 && (!best || dist < best.dist)) best = { claim_id: r.claim_id, dist };
        }
        if (best) { confidence = Math.round((1 - best.dist / 64) * 100); matchedId = best.claim_id; }
      }

      const { rows } = await db.query(`
        INSERT INTO hi_repost_alerts (license_id,infringing_url,platform,confidence,reporter_note)
        VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [matchedId, infringing_url, platform ?? null, confidence, reporter_note ?? null]);

      return res.status(201).json({ ok: true, id: rows[0].id, confidence, matched_license: matchedId });
    }

    // ── SOCIAL-VERIFY ──────────────────────────────────────────────
    if (resource === "social-verify") {


      if (method === "GET") {
        if (!checkAuth(req, res)) return;
        // action=check runs the verification check
        if (req.query.action === "check" && id) {
          const { rows: vRows } = await db.query("SELECT * FROM hi_social_verifications WHERE id=$1", [id]);
          if (!vRows.length) return res.status(404).json({ ok: false, error: "Not found" });
          const v = vRows[0];
          const result = await _checkSocialProfile(v.platform, v.profile_url, v.verify_code);
          if (result.verified) {
            await db.query("UPDATE hi_social_verifications SET status='verified', verified_at=NOW() WHERE id=$1", [id]);
          }
          return res.json({ ok: true, verified: result.verified, reason: result.reason ?? null });
        }
        const { rows } = await db.query("SELECT * FROM hi_social_verifications ORDER BY created_at DESC");
        return res.json({ ok: true, data: rows });
      }

      if (method === "POST") {
        if (!checkAuth(req, res)) return;
        const { platform, profile_url } = req.body ?? {};
        if (!platform || !profile_url) return res.status(400).json({ ok: false, error: "platform and profile_url required" });
        try { _assertFetchableSocialUrl(profile_url); }
        catch (e) { return res.status(400).json({ ok: false, error: e.message }); }
        const code = "HI-VERIFY-" + Math.random().toString(36).slice(2, 10).toUpperCase();
        const { rows } = await db.query(
          "INSERT INTO hi_social_verifications (platform,profile_url,verify_code) VALUES ($1,$2,$3) RETURNING *",
          [platform, profile_url, code]);
        return res.status(201).json({ ok: true, data: rows[0] });
      }

      if (method === "PUT") {
        if (!checkAuth(req, res)) return;
        if (req.query.action === "check" && id) {
          const { rows: vRows } = await db.query("SELECT * FROM hi_social_verifications WHERE id=$1", [id]);
          if (!vRows.length) return res.status(404).json({ ok: false, error: "Not found" });
          const v = vRows[0];
          const result = await _checkSocialProfile(v.platform, v.profile_url, v.verify_code);
          if (result.verified) {
            await db.query("UPDATE hi_social_verifications SET status='verified', verified_at=NOW() WHERE id=$1", [id]);
          } else {
            await db.query("UPDATE hi_social_verifications SET status='pending' WHERE id=$1", [id]);
          }
          return res.json({ ok: true, verified: result.verified, reason: result.reason ?? null });
        }
        return res.status(400).json({ ok: false, error: "action=check required" });
      }

      if (method === "DELETE") {
        if (!checkAuth(req, res)) return;
        if (!id) return res.status(400).json({ ok: false, error: "id required" });
        await db.query("DELETE FROM hi_social_verifications WHERE id=$1", [id]);
        return res.json({ ok: true });
      }
    }

    // ── HDI SCORE ─────────────────────────────────────────────────
    if (resource === "hdi") {
      if (method === "GET") {
        const [goals, habits, habitLogs, mood, tasks] = await Promise.all([
          db.query("SELECT progress, status FROM goals"),
          db.query("SELECT id FROM habits WHERE active=true"),
          db.query("SELECT habit_id FROM habit_logs WHERE completed_on >= CURRENT_DATE - 30"),
          db.query("SELECT mood, energy FROM mood_logs WHERE logged_on >= CURRENT_DATE - 30"),
          db.query("SELECT done FROM tasks WHERE created_at >= NOW() - INTERVAL '30 days'"),
        ]);

        const activeGoals = goals.rows.filter(g => g.status === "active");
        const goalScore   = activeGoals.length
          ? Math.round(activeGoals.reduce((s, g) => s + (Number(g.progress) || 0), 0) / activeGoals.length)
          : 50;

        const habitCount  = habits.rows.length;
        const logCount    = habitLogs.rows.length;
        const habitScore  = habitCount
          ? Math.min(100, Math.round((logCount / (habitCount * 30)) * 100))
          : 50;

        const moodRows    = mood.rows;
        const moodScore   = moodRows.length
          ? Math.round((moodRows.reduce((s, m) => s + (Number(m.mood) || 5), 0) / moodRows.length) * 10)
          : 50;

        const energyScore = moodRows.length
          ? Math.round((moodRows.reduce((s, m) => s + (Number(m.energy) || 5), 0) / moodRows.length) * 10)
          : 50;

        const taskRows    = tasks.rows;
        const taskScore   = taskRows.length
          ? Math.round((taskRows.filter(t => t.done).length / taskRows.length) * 100)
          : 50;

        const hdi = Math.round(
          goalScore   * 0.30 +
          habitScore  * 0.25 +
          moodScore   * 0.20 +
          taskScore   * 0.15 +
          energyScore * 0.10
        );

        const grade = hdi >= 90 ? "S" : hdi >= 80 ? "A" : hdi >= 70 ? "B" : hdi >= 60 ? "C" : hdi >= 50 ? "D" : "F";

        return res.json({ ok: true, data: {
          hdi, grade,
          breakdown: { goals: goalScore, habits: habitScore, mood: moodScore, energy: energyScore, tasks: taskScore },
          computed_at: new Date().toISOString(),
        }});
      }
    }

    res.status(404).json({ ok: false, error: `Unknown resource: ${resource}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
};
