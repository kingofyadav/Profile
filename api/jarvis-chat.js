"use strict";

const { tooManyRequests, methodNotAllowed, badRequest, serverError } = require("./_response");
const { chat: chatLimit } = require("./_rate-limit");
const { readJsonBody } = require("./_body");

const MAX_BODY_BYTES = 65536;
const MAX_HISTORY = 6;

const SITE_FACTS = [
  {
    weight: 3,
    keys: ["who", "king", "amit", "yadav", "founder", "builder", "person"],
    reply: "Amit Ku Yadav (King Yadav) is a builder, digital systems architect, and founder based in Bhagalpur, India. He builds identity systems, AI assistants, digital ventures, and community platforms. His work spans technology, writing, education, and entrepreneurship."
  },
  {
    weight: 2,
    keys: ["service", "services", "work", "offer", "build", "hire", "price", "cost"],
    reply: "Services include: digital identity systems, websites & hosting, automation & AI workflows, content architecture, and business systems for individuals and organizations. Visit the Services page (/pages/services.html) for full details, packages, and the contact form."
  },
  {
    weight: 2,
    keys: ["collab", "collaboration", "partner", "partnership", "together", "join"],
    reply: "For collaboration — share who you are, the idea, timeline, and what kind of help or partnership you want. Use the Collaboration page (/pages/collaboration.html) or Contact page. Amit looks for aligned builders, writers, educators, and community workers."
  },
  {
    weight: 2,
    keys: ["contact", "email", "message", "reach", "talk", "connect"],
    reply: "Contact Amit via the Contact page (/pages/contact.html). Include your name, email, subject, and a clear description. For business enquiries, also mention the scope and timeline."
  },
  {
    weight: 2,
    keys: ["blog", "article", "write", "writing", "read", "post", "essay"],
    reply: "The Blog (/pages/blog.html) has long-form writing on technology, leadership, youth, governance, privacy, AI, education, entrepreneurship, and future systems. Each article is built to last."
  },
  {
    weight: 2,
    keys: ["brand", "venture", "royal", "heritage", "resort", "jhon", "aamit", "national", "youth", "nyf", "llp"],
    reply: "Public ventures: Royal Heritage Resort (hospitality), Jhon Aamit LLP (legal & business entity), National Youth Force (community & education movement). Each has its own page on the site with mission and contact details."
  },
  {
    weight: 2,
    keys: ["hi", "dashboard", "life", "os", "personal", "private", "identity"],
    reply: "HI (Human Intelligence) is the private life OS layer. It includes identity, habits, goals, tasks, notes, contacts, mood tracking, and the assistant context — all stored locally in your browser and optionally synced to the cloud. Login required."
  },
  {
    weight: 2,
    keys: ["wallet", "coin", "digital", "currency", "hi coin", "reward"],
    reply: "HI Coin is the internal digital reward system on the platform. Max supply is 99 coins. It's used for participation, contribution, and ecosystem rewards — not a public cryptocurrency."
  },
  {
    weight: 2,
    keys: ["jarvis", "ai", "assistant", "bot", "chat", "operator"],
    reply: "Jarvis is Amit's personal AI assistant — a local-first AI control plane running on his home server. It powers this chat widget and handles private tasks, memory, planning, voice input, and multi-device sync. For public questions, Jarvis responds from this chat interface."
  },
  {
    weight: 1,
    keys: ["about", "story", "origin", "background", "history"],
    reply: "The About page (/pages/about.html) covers Amit's full story: the person, the machine & AI layer, products, and community work. The Origin page (/pages/origin.html) goes into formative influences and philosophy."
  },
  {
    weight: 1,
    keys: ["gallery", "photo", "image", "picture", "visual"],
    reply: "The Gallery page (/pages/gallery.html) features visual documentation of work, places, events, and people connected to this platform."
  },
  {
    weight: 1,
    keys: ["bhagalpur", "city", "place", "location", "india", "bihar"],
    reply: "Amit is based in Bhagalpur, Bihar, India. There's a dedicated Bhagalpur page (/pages/bhagalpur.html) covering the city and local projects."
  },
  {
    weight: 1,
    keys: ["haven", "resort", "hospitality", "property"],
    reply: "Haven is a hospitality property page (/pages/haven.html). Contact via the Contact page for booking or partnership inquiries."
  },
  {
    weight: 1,
    keys: ["license", "ip", "copyright", "intellectual", "ownership", "hdi"],
    reply: "HI License is the intellectual property licensing and HDI (Human Digital Identity) framework used on this platform. The License page (/pages/hi-license.html) explains the terms and how to claim your digital identity."
  },
  {
    weight: 1,
    keys: ["live", "class", "learn", "course", "session", "teaching"],
    reply: "Live Classes are scheduled learning sessions. Visit the Live Class page (/pages/live-class.html) to see upcoming sessions and join."
  },
  {
    weight: 1,
    keys: ["social", "twitter", "linkedin", "github", "instagram", "follow"],
    reply: "Social profiles are listed on the Social page (/pages/social.html). Connect on the platform that works best for you."
  },
  {
    weight: 1,
    keys: ["professional", "career", "experience", "resume", "cv", "work history"],
    reply: "The Professional page (/pages/professional.html) covers career history, roles, and professional experience."
  }
];

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.end(JSON.stringify(payload));
}

function normalizeBackendBase(req) {
  const raw = String(process.env.JARVIS_API_BASE || process.env.JARVIS_BACKEND_URL || "").trim();
  if (!raw) return "";

  let parsed;
  try {
    parsed = new URL(raw);
  } catch (err) {
    return "";
  }

  const host = String(req.headers.host || "").toLowerCase();
  if (parsed.host.toLowerCase() === host) return "";
  return parsed.toString().replace(/\/+$/, "");
}

async function proxyToBackend(req, res, body) {
  const base = normalizeBackendBase(req);
  if (!base) return false;

  const forwardHeaders = {
    "Content-Type": "application/json",
    "X-Forwarded-Host": String(req.headers.host || ""),
    "X-Forwarded-For": String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || ""),
    "X-Forwarded-Proto": "https",
  };

  const bridgeSecret = String(process.env.JARVIS_BRIDGE_SECRET || "").trim();
  if (bridgeSecret) {
    forwardHeaders["Authorization"] = `Bearer ${bridgeSecret}`;
  }

  const response = await fetch(`${base}/api/jarvis-chat`, {
    method: "POST",
    headers: forwardHeaders,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(65_000)
  });

  const text = await response.text();
  res.statusCode = response.status;
  res.setHeader("Content-Type", response.headers.get("content-type") || "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.end(text);
  return true;
}

// Precompute one RegExp per fact at module load — avoids O(n×keys) scan per request
SITE_FACTS.forEach(item => {
  item._pattern = new RegExp(
    item.keys.map(k => k.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")).join("|"),
    "i"
  );
});

function fallbackReply(message) {
  const q = String(message || "").toLowerCase().replace(/['".,!?]/g, " ");
  const words = new Set(q.split(/\s+/).filter(w => w.length > 2));

  const scored = SITE_FACTS
    .map(item => {
      const matches = (q.match(item._pattern) || []).length;
      return { item, score: matches * (item.weight || 1) };
    })
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (best && best.score > 0) {
    const runner = scored[1];
    if (runner && runner.score > 0 && runner.item !== best.item && runner.score >= best.score * 0.6) {
      return `${best.item.reply}\n\n${runner.item.reply}`;
    }
    return best.item.reply;
  }

  if (words.has("hello") || words.has("hey") || words.has("hi") || words.has("greet")) {
    return "Hello! I'm Jarvis, Amit Ku Yadav's AI assistant. Ask me about Amit, his services, projects, writing, ventures, or the HI platform — I'll do my best to help.";
  }

  if (words.has("help") || words.has("what") || words.has("can")) {
    return "I can answer questions about: Amit Ku Yadav (who he is and what he does), Services (websites, automation, AI), Collaboration, Blog, Ventures (Royal Heritage, Jhon Aamit LLP, NYF), HI Life OS, Jarvis AI, Gallery, and Contact. What would you like to know?";
  }

  return "I can help with questions about Amit Ku Yadav — his services, writing, ventures, HI platform, or how to get in touch. For a direct reply, use the Contact page (/pages/contact.html) or the Collaboration page.";
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    methodNotAllowed(res, "POST, OPTIONS");
    return;
  }

  if (!chatLimit(req, res)) return;

  let body;
  try {
    body = await readJsonBody(req, MAX_BODY_BYTES);
  } catch (err) {
    badRequest(res, err.message || "Invalid request");
    return;
  }

  const message = String(body.message || "").trim().slice(0, 1200);
  if (!message) {
    badRequest(res, "message is required");
    return;
  }

  const payload = {
    message,
    history: Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY) : []
  };

  try {
    if (await proxyToBackend(req, res, payload)) return;
  } catch (err) {
    // Keep the public widget useful even if the home Jarvis backend is down.
  }

  send(res, 200, {
    ok: true,
    mode: "fallback",
    reply: fallbackReply(message)
  });
};
