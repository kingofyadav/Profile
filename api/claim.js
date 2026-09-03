"use strict";

const db = require("../lib/db");
const { csrfGuard, send, badRequest, methodNotAllowed, preflight, CORS_HEADERS } = require("./_response");
const { claim: claimLimit } = require("./_rate-limit");
const { requireUrl, requireEmail, optionalString } = require("./_validate");
const { readJsonBody } = require("./_body");

// Mirrors migrations/006_hdi_claims.sql — Vercel deploys don't run migrations,
// so ensure the table once per cold start instead of failing every claim.
let tableReady = null;
function ensureTable() {
  if (!tableReady) {
    tableReady = db.query(
      `CREATE TABLE IF NOT EXISTS hdi_claims (
         id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
         license_id       VARCHAR(100),
         infringing_url   TEXT         NOT NULL,
         platform         VARCHAR(100),
         violation_type   VARCHAR(50),
         reporter_name    VARCHAR(200),
         reporter_email   TEXT         NOT NULL,
         reporter_contact TEXT,
         dmca_text        TEXT,
         status           VARCHAR(20)  NOT NULL DEFAULT 'open',
         submitted_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
       )`
    ).catch(err => { tableReady = null; throw err; });
  }
  return tableReady;
}

const buildDmca = ({ license_id, infringing_url, platform, violation_type, reporter_name, reporter_email }) => {
  const date = new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });
  return `DMCA TAKEDOWN NOTICE — ${date}

To: DMCA Agent / Legal Team, ${platform ?? "Platform"}

I, ${reporter_name ?? reporter_email}, am the reporter of a copyright violation on behalf of the original creator.

ORIGINAL WORK
License ID : ${license_id}
Verify URL : https://kingofyadav.in/verify/${license_id}
Author     : Amit Ku Yadav
License    : CC-BY-NC-ND-4.0

INFRINGING CONTENT
URL        : ${infringing_url}
Platform   : ${platform ?? "Unknown"}
Violation  : ${violation_type ?? "Unauthorized reproduction"}

I have a good faith belief that the use of the described material is not authorized by the copyright owner, its agent, or the law.

I swear, under penalty of perjury, that the information in this notification is accurate and that I am authorized to act on behalf of the copyright owner.

Contact : ${reporter_email}
Date    : ${date}

— Submitted via kingofyadav.in/claim/${license_id}`;
};

module.exports = async (req, res) => {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === "OPTIONS") { preflight(res); return; }
  if (req.method !== "POST") { methodNotAllowed(res, "POST, OPTIONS"); return; }
  if (csrfGuard(req, res)) return;
  if (!claimLimit(req, res)) return;

  let raw;
  try { raw = await readJsonBody(req, 65536); }
  catch (err) { badRequest(res, err.message || "Invalid request"); return; }
  let license_id, infringing_url, reporter_email, platform, violation_type, reporter_name, reporter_contact;
  try {
    license_id       = optionalString(raw.license_id, "license_id", 100);
    infringing_url    = requireUrl(raw.infringing_url, "infringing_url");
    reporter_email    = requireEmail(raw.reporter_email);
    platform         = optionalString(raw.platform, "platform", 100);
    violation_type   = optionalString(raw.violation_type, "violation_type", 50);
    reporter_name    = optionalString(raw.reporter_name, "reporter_name", 200);
    reporter_contact = optionalString(raw.reporter_contact, "reporter_contact", 200);
  } catch (err) {
    badRequest(res, err.message || "Invalid request");
    return;
  }
  if (!license_id) {
    badRequest(res, "license_id is required");
    return;
  }

  const dmca = buildDmca({ license_id, infringing_url, platform, violation_type, reporter_name, reporter_email });

  try {
    await ensureTable();
    await db.query(
      `INSERT INTO hdi_claims
         (license_id, infringing_url, platform, violation_type, reporter_name, reporter_email, reporter_contact, dmca_text)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [license_id, infringing_url, platform || null, violation_type || null,
       reporter_name || null, reporter_email, reporter_contact || null, dmca]
    );
  } catch (err) {
    console.error(JSON.stringify({ level: "error", event: "claim_persist_failed", message: err.message }));
    send(res, 502, { ok: false, error: "Could not record the claim right now — please retry.", code: "PERSIST_FAILED" });
    return;
  }

  send(res, 200, { ok: true, dmca });
};
