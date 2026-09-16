"use strict";

const db = require("../lib/db");
const { liveClass: liveClassLimit } = require("./_rate-limit");

// Secrets are read at call time so they pick up runtime env changes
// (important in serverless where env vars are set after module load in some runtimes).
const getClassToken = () => process.env.LIVE_CLASS_TOKEN || "";
const MAX_BLOCKS = 80;

const getToken = req => {
  const auth = req.headers["authorization"] ?? "";
  if (auth.startsWith("Bearer ")) return auth.slice(7);
  return req.headers["x-live-class-token"] ?? req.body?.token ?? "";
};

const getRoom = req => {
  const q = req.query?.room ?? req.body?.room ?? "main";
  return String(q).replace(/[^a-z0-9_-]/gi, "").slice(0, 40) || "main";
};

const maskIp = ip => {
  if (!ip) return "unknown";
  const parts = ip.split(".");
  if (parts.length === 4) { parts[3] = "xxx"; return parts.join("."); }
  return ip.replace(/:[^:]+$/, ":xxxx");
};

const getSession = async id => {
  const { rows } = await db.query("SELECT * FROM live_class_sessions WHERE id=$1", [id]);
  if (!rows.length) return null;
  const session   = rows[0];
  const blocks    = await db.query("SELECT * FROM live_class_blocks WHERE session_id=$1 ORDER BY position ASC", [id]);
  const viewers   = await db.query("SELECT * FROM live_class_viewers WHERE session_id=$1 AND last_seen > NOW() - INTERVAL '70 seconds'", [id]);
  const questions = await db.query("SELECT * FROM live_class_questions WHERE session_id=$1 ORDER BY created_at ASC", [id]);
  session.blocks    = blocks.rows;
  session.viewers   = viewers.rows;
  session.questions = questions.rows;
  return session;
};

const formatSession = session => {
  if (!session) return null;
  return {
    ...session,
    updatedAt: session.updated_at ? Number(new Date(session.updated_at)) : null,
    focusId:   session.focus_id ?? null,
    viewers: (session.viewers ?? []).map(v => ({
      ...v,
      lastSeen: v.last_seen ? Number(new Date(v.last_seen)) : null,
    })),
    blocks: (session.blocks ?? []).map(b => ({
      ...b,
      text: b.content ?? b.text ?? "",
      createdAt: b.created_at ? Number(new Date(b.created_at)) : null,
    })),
    questions: session.questions ?? [],
  };
};

const ensureSession = async id => {
  await db.query(`
    INSERT INTO live_class_sessions (id, title, subtitle, theme, status, teacher, revision)
    VALUES ($1,'Live Class','','blackboard','active','',0)
    ON CONFLICT (id) DO NOTHING
  `, [id]);
};

async function aiCall(prompt) {
  const oaiKey   = process.env.OPENAI_API_KEY;
  const oaiBase  = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com").replace(/\/$/, "");
  const oaiModel = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const body = JSON.stringify({
    model: oaiModel,
    messages: [{ role: "user", content: prompt }],
    max_tokens: 800,
    temperature: 0.7,
  });
  const res = await fetch(`${oaiBase}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${oaiKey}`,
    },
    body,
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  return res.json();
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-live-class-token");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (!liveClassLimit(req, res)) return;

  const ROOM = getRoom(req);

  // ── GET ────────────────────────────────────────────────────────────────────
  if (req.method === "GET") {
    if (req.query?.replay) {
      const blocks = await db.query(
        "SELECT * FROM live_class_blocks WHERE session_id=$1 ORDER BY created_at ASC", [ROOM]
      );
      return res.json({ ok: true, room: ROOM, replay: blocks.rows.map(b => ({
        ...b, text: b.content ?? "", createdAt: b.created_at ? Number(new Date(b.created_at)) : null,
      }))});
    }
    await ensureSession(ROOM);
    const session = await getSession(ROOM);
    return res.json(formatSession(session));
  }

  // ── POST ───────────────────────────────────────────────────────────────────
  if (req.method === "POST") {
    const { action, text, language, url, caption, name, device, deviceId, id: viewerId } = req.body ?? {};
    const token     = getToken(req);
    const classToken = getClassToken();
    const isTeacher  = Boolean(classToken) && token === classToken;
    const ip        = maskIp(req.headers["x-forwarded-for"] ?? req.socket?.remoteAddress);

    await ensureSession(ROOM);

    // ── JOIN (public) ──────────────────────────────────────────────
    if (action === "join") {
      const vid = deviceId ?? viewerId ?? `v-${Date.now()}`;
      await db.query(`
        INSERT INTO live_class_viewers (id,session_id,name,device,ip,joined_at,last_seen)
        VALUES ($1,$2,$3,$4,$5,NOW(),NOW())
        ON CONFLICT (id,session_id) DO UPDATE SET name=$3,device=$4,last_seen=NOW()
      `, [vid, ROOM, name ?? "Student", device ?? "browser", ip]);
      const session = await getSession(ROOM);
      return res.json({ viewerId: vid, ...formatSession(session) });
    }

    // ── REACT (public) ─────────────────────────────────────────────
    if (action === "react") {
      const vid     = deviceId ?? viewerId;
      const allowed = ["✋", "✅", "❓", ""];
      const emoji   = allowed.includes(text) ? text : "";
      if (vid) {
        await db.query(`
          INSERT INTO live_class_viewers (id,session_id,name,device,ip,joined_at,last_seen,reaction)
          VALUES ($1,$2,$3,'browser',$4,NOW(),NOW(),$5)
          ON CONFLICT (id,session_id) DO UPDATE SET last_seen=NOW(),reaction=$5
        `, [vid, ROOM, name ?? "Student", ip, emoji || null]);
      }
      const session = await getSession(ROOM);
      return res.json({ viewerId: vid, ...formatSession(session) });
    }

    // ── QUESTION (public) ──────────────────────────────────────────
    if (action === "question") {
      const q = String(text ?? "").trim().slice(0, 300);
      if (!q) return res.status(400).json({ ok: false, error: "Question cannot be empty" });
      await db.query(
        "INSERT INTO live_class_questions (session_id,viewer_name,device_id,question) VALUES ($1,$2,$3,$4)",
        [ROOM, name ?? "Student", deviceId ?? null, q]
      );
      const session = await getSession(ROOM);
      return res.json({ ok: true, ...formatSession(session) });
    }

    if (!isTeacher) return res.status(401).json({ ok: false, error: "Unauthorized" });

    // ── AI BLOCK GENERATION (teacher only) ────────────────────────
    if (action === "ai") {
      if (!process.env.OPENAI_API_KEY) return res.status(503).json({ ok: false, error: "AI not configured (OPENAI_API_KEY missing)" });
      const topic = String(text ?? "").trim();
      if (!topic) return res.status(400).json({ ok: false, error: "Topic required" });

      const prompt = `You are a live classroom assistant. Generate clear educational board content for the topic: "${topic}"

Return ONLY a JSON array (no markdown, no explanation) of 4-6 blocks:
[{"type":"heading","text":"..."},{"type":"text","text":"..."},{"type":"code","text":"..."},{"type":"list","text":"..."}]

Block types: heading, text, code, list, quote, homework
Keep each text block concise (1-3 sentences). Code should be a real working example.`;

      let aiBlocks = [];
      try {
        const result = await aiCall(prompt);
        const content = result.choices?.[0]?.message?.content ?? "[]";
        const match = content.match(/\[[\s\S]*\]/);
        aiBlocks = JSON.parse(match ? match[0] : content);
      } catch (e) {
        return res.status(500).json({ ok: false, error: `AI response parse failed: ${e.message}` });
      }

      for (const block of aiBlocks) {
        const countRes = await db.query("SELECT COUNT(*) FROM live_class_blocks WHERE session_id=$1", [ROOM]);
        if (Number(countRes.rows[0].count) >= MAX_BLOCKS) {
          await db.query("DELETE FROM live_class_blocks WHERE session_id=$1 AND id=(SELECT id FROM live_class_blocks WHERE session_id=$1 ORDER BY position ASC LIMIT 1)", [ROOM]);
        }
        const posRes  = await db.query("SELECT COALESCE(MAX(position),0)+1 AS pos FROM live_class_blocks WHERE session_id=$1", [ROOM]);
        const blockId = `b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const type    = ["heading","text","code","list","quote","homework"].includes(block.type) ? block.type : "text";
        await db.query(
          "INSERT INTO live_class_blocks (id,session_id,type,content,position) VALUES ($1,$2,$3,$4,$5)",
          [blockId, ROOM, type, String(block.text ?? ""), posRes.rows[0].pos]
        );
      }

      await db.query("UPDATE live_class_sessions SET revision=revision+$2,updated_at=NOW() WHERE id=$1", [ROOM, aiBlocks.length]);
      const session = await getSession(ROOM);
      return res.json({ ok: true, generated: aiBlocks.length, ...formatSession(session) });
    }

    // ── WRITE BLOCKS (teacher) ─────────────────────────────────────
    const writeActions = ["write","text","heading","code","list","quote","homework","link","image","divider","answer"];
    if (writeActions.includes(action)) {
      const countRes = await db.query("SELECT COUNT(*) FROM live_class_blocks WHERE session_id=$1", [ROOM]);
      if (Number(countRes.rows[0].count) >= MAX_BLOCKS) {
        await db.query("DELETE FROM live_class_blocks WHERE session_id=$1 AND id=(SELECT id FROM live_class_blocks WHERE session_id=$1 ORDER BY position ASC LIMIT 1)", [ROOM]);
      }
      const posRes  = await db.query("SELECT COALESCE(MAX(position),0)+1 AS pos FROM live_class_blocks WHERE session_id=$1", [ROOM]);
      const blockId = `b-${Date.now()}`;
      const type    = action === "write" ? "text" : action;
      await db.query(
        "INSERT INTO live_class_blocks (id,session_id,type,content,language,url,caption,position) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
        [blockId, ROOM, type, text ?? "", language ?? null, url ?? null, caption ?? null, posRes.rows[0].pos]
      );
      if (action === "answer" && url) {
        await db.query("UPDATE live_class_questions SET answered=TRUE WHERE id=$1", [url]);
      }
    } else if (action === "undo") {
      await db.query("DELETE FROM live_class_blocks WHERE session_id=$1 AND id=(SELECT id FROM live_class_blocks WHERE session_id=$1 ORDER BY position DESC LIMIT 1)", [ROOM]);
    } else if (action === "clear") {
      await db.query("DELETE FROM live_class_blocks WHERE session_id=$1", [ROOM]);
    } else if (action === "reset") {
      await db.query("DELETE FROM live_class_blocks WHERE session_id=$1", [ROOM]);
      await db.query("UPDATE live_class_sessions SET title=$2,subtitle=$3,theme=$4,status=$5,focus_id=NULL WHERE id=$1", [ROOM, "Live Class", "", "blackboard", "active"]);
    } else if (action === "dismiss") {
      await db.query("DELETE FROM live_class_questions WHERE id=$1", [text]);
    } else if (action === "focus") {
      await db.query("UPDATE live_class_sessions SET focus_id=$2 WHERE id=$1", [ROOM, text ?? null]);
    } else if (["title","subtitle","theme","status","teacher","room"].includes(action)) {
      await db.query(`UPDATE live_class_sessions SET ${action}=$2 WHERE id=$1`, [ROOM, text]);
    }

    await db.query("UPDATE live_class_sessions SET revision=revision+1,updated_at=NOW() WHERE id=$1", [ROOM]);
    const session = await getSession(ROOM);
    return res.json(formatSession(session));
  }

  res.status(405).json({ ok: false, error: "Method not allowed" });
};
