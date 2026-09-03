"use strict";

/* ======================================================
   hi-license.js — Human Digital Identity + Content License
   Phase 10 v2: deterministic hashes · portable certificate
   Depends on: hi-storage.js, hi-app.js
====================================================== */

const HI_LICENSE_VERSION = "2.0";
const HI_LICENSE_SITE    = "kingofyadav.in";

const HI_LICENSE_TYPES = {
  personal:      { label: "HI Personal",      desc: "Only you can use this content" },
  share:         { label: "HI Share",          desc: "Others may share with full credit" },
  open:          { label: "HI Open",           desc: "Free to use, credit required" },
  commercial:    { label: "HI Commercial",     desc: "Commercial use requires owner permission" },
  collaboration: { label: "HI Collaboration",  desc: "Joint ownership arrangement" },
};

const HI_CONTENT_TYPES = ["Idea","Blog Post","Project","Goal","Note","Design","Code","Data","Other"];

const HI_EXISTING_CLAIM_SOURCES = {
  "personal:note": {
    store:       "personal",
    type:        "note",
    contentType: "Note",
    label:   item => item.title ?? (item.body ?? "Private Note").slice(0, 60),
    content: item => item.body ?? item.title ?? "Private Note",
    sort:    (a, b) => (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0),
  },
  "personal:goal": {
    store:       "personal",
    type:        "goal",
    contentType: "Goal",
    label:   item => item.title ?? "Goal",
    content: item => [item.title, item.note, item.deadline ? `Deadline: ${item.deadline}` : "", `Progress: ${item.progress ?? 0}%`].filter(Boolean).join("\n"),
    sort:    (a, b) => (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0),
  },
  "professional:project": {
    store:       "professional",
    type:        "project",
    contentType: "Project",
    label:   item => item.name ?? "Project",
    content: item => [item.name, `Status: ${item.status ?? "active"}`, `Color: ${item.color ?? ""}`].filter(Boolean).join("\n"),
    sort:    (a, b) => (a.name ?? "").localeCompare(b.name ?? ""),
  },
  "professional:protask": {
    store:       "professional",
    type:        "protask",
    contentType: "Data",
    label:   item => item.title ?? "Project Task",
    content: item => [item.title, `Priority: ${item.priority ?? "normal"}`, `Done: ${Boolean(item.done)}`].join("\n"),
    sort:    (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0),
  },
  "tasks:task": {
    store:       "tasks",
    type:        null,
    contentType: "Data",
    label:   item => item.title ?? "Task",
    content: item => [item.title, `Date: ${item.date ?? ""}`, `Done: ${Boolean(item.done)}`].filter(Boolean).join("\n"),
    sort:    (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0),
  },
  "social:event": {
    store:       "social",
    type:        "event",
    contentType: "Data",
    label:   item => item.title ?? "Event",
    content: item => [item.title, `Date: ${item.date ?? ""}`, `Time: ${item.time ?? ""}`, `Type: ${item.eventType ?? ""}`, item.note ?? ""].filter(Boolean).join("\n"),
    sort:    (a, b) => String(a.date ?? "").localeCompare(String(b.date ?? "")),
  },
};

/* ── Escape ── */

function hiLicenseEsc(str) {
  return typeof hiEsc === "function" ? hiEsc(str) : String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ── Hashing ── */

function hiStableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(hiStableStringify).join(",")}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${hiStableStringify(value[key])}`).join(",")}}`;
}

async function hiHashContent(text) {
  const source = String(text ?? "");
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  } catch {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < source.length; i++) {
      const ch = source.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0") + source.length.toString(16);
  }
}

/* ── Claim helpers ── */

function hiBuildClaimPayload(data) {
  return {
    title:       String(data.title       ?? "").trim(),
    contentType: String(data.contentType ?? "Idea").trim(),
    licenseType: String(data.licenseType ?? "personal").trim(),
    content:     String(data.content     ?? "").trim(),
    sourceStore: data.sourceStore ?? "",
    sourceType:  data.sourceType  ?? "",
    sourceId:    data.sourceId    ?? "",
  };
}

function hiFormatLicenseDate(ms) {
  return new Date(ms).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day:      "numeric",
    month:    "long",
    year:     "numeric",
    hour:     "2-digit",
    minute:   "2-digit",
  });
}

const hiLicensePrefix    = identity => String(identity.hdi ?? identity.name ?? "HI").replace(/[^A-Za-z0-9]/g, "").slice(0, 6).toUpperCase() || "HI";
const hiLicenseTypeLabel = type    => (HI_LICENSE_TYPES[type]?.label) ?? (type || "License");

function hiHashChunks(hash, size, limit) {
  const text   = String(hash ?? "");
  const chunks = [];
  for (let i = 0; i < text.length; i += size) chunks.push(text.slice(i, i + size));
  return chunks.slice(0, limit ?? chunks.length);
}

function hiRenderHashSeal(hash) {
  const source = String(hash ?? "hi").padEnd(64, "0");
  let cells = "";
  for (let i = 0; i < 49; i++) {
    const n = parseInt(source.charAt(i % source.length), 16);
    cells += `<span class="${n % 3 === 0 ? "on strong" : n % 2 === 0 ? "on" : ""}"></span>`;
  }
  return `<div class="hi-cert-seal-grid" aria-hidden="true">${cells}</div>`;
}

/* ── Certificate ── */

async function hiBuildLicenseCertificate(identity, license) {
  const verification = {
    protocol:             "HI-License",
    version:              HI_LICENSE_VERSION,
    licenseId:            license.licenseId,
    ownerName:            license.ownerName,
    ownerHDI:             license.ownerHDI,
    title:                license.title,
    contentType:          license.contentType,
    licenseType:          license.licenseType,
    contentHashAlgorithm: license.contentHashAlgorithm,
    contentHash:          license.contentHash,
    issuedAt:             license.issuedAt,
    site:                 HI_LICENSE_SITE,
  };
  const verificationHash = await hiHashContent(hiStableStringify(verification));
  return {
    protocol: "HI Human Digital Identity License Certificate",
    version:  HI_LICENSE_VERSION,
    issuer:   HI_LICENSE_SITE,
    owner: {
      name:     identity.name     ?? license.ownerName,
      hdi:      identity.hdi      ?? license.ownerHDI ?? "",
      roles:    identity.roles    ?? [],
      location: identity.location ?? "",
      tagline:  identity.tagline  ?? "",
    },
    claim: {
      licenseId:            license.licenseId,
      title:                license.title,
      contentType:          license.contentType,
      licenseType:          license.licenseType,
      contentHashAlgorithm: license.contentHashAlgorithm,
      contentHash:          license.contentHash,
      sourceRef:            license.sourceRef ?? null,
      issuedAt:             license.issuedAt,
      issuedAtLabel:        license.createdAtStr,
    },
    verification,
    verificationHash,
    status: "Locally issued",
    notice: "This certificate records a HI App proof-of-claim and license assertion. It is local-first evidence, not a government copyright registration.",
  };
}

/* ── Claim content ── */

async function hiClaimContent(data, options = {}) {
  const identity = await hiGet("identity", "primary");
  if (!identity?.name) throw new Error("Set up your identity first");

  const payload   = hiBuildClaimPayload(data ?? {});
  if (!payload.title) throw new Error("Title is required");

  const now      = Date.now();
  const licenses = await hiGetAll("licenses");
  const sourceRef = payload.sourceStore && payload.sourceId
    ? { store: payload.sourceStore, type: payload.sourceType ?? payload.contentType, id: payload.sourceId }
    : null;

  const existing = sourceRef
    ? (licenses.find(lic => lic.sourceRef?.store === sourceRef.store && lic.sourceRef?.id === sourceRef.id) ?? null)
    : null;

  const claimHashPayload = {
    title:       payload.title,
    contentType: payload.contentType,
    licenseType: payload.licenseType,
    content:     payload.content,
  };
  const contentHash = await hiHashContent(hiStableStringify(claimHashPayload));
  const issuedAt    = existing ? (existing.issuedAt ?? existing.createdAt ?? now) : now;
  const seq         = existing ? 0 : licenses.length + 1;
  const dateStr     = new Date(issuedAt).toISOString().slice(0, 10).replace(/-/g, "");
  const licenseId   = existing ? existing.licenseId : `LIC-${hiLicensePrefix(identity)}-${dateStr}-${String(seq).padStart(3, "0")}`;

  const license = Object.assign({}, existing ?? {}, {
    id:                  existing ? existing.id : hiGenId(),
    licenseId,
    protocolVersion:     HI_LICENSE_VERSION,
    ownerName:           identity.name,
    ownerHDI:            identity.hdi ?? "",
    title:               payload.title,
    contentType:         payload.contentType,
    licenseType:         payload.licenseType,
    contentHashAlgorithm:"SHA-256",
    contentHash,
    contentHashPreview:  contentHash.slice(0, 16),
    sourceRef,
    autoClaim:           Boolean(options.autoClaim),
    issuedAt,
    createdAt:           issuedAt,
    updatedAt:           now,
    createdAtStr:        hiFormatLicenseDate(issuedAt),
  });

  license.certificate      = await hiBuildLicenseCertificate(identity, license);
  license.verification     = license.certificate.verification;
  license.verificationHash = license.certificate.verificationHash;

  await hiPut("licenses", license);
  return license;
}

async function hiAutoClaimRecord(store, record, config) {
  try {
    if (!record?.id || typeof hiClaimContent !== "function") return null;
    const cfg   = config ?? {};
    const title = cfg.title ?? record.title ?? record.name;
    if (!title) return null;
    const content = cfg.content ?? [
      record.body ?? "",
      record.note ?? "",
      record.mission ?? "",
      record.deadline   ? `Deadline: ${record.deadline}` : "",
      record.progress !== undefined ? `Progress: ${record.progress}%` : "",
    ].filter(Boolean).join("\n");
    return await hiClaimContent({
      title,
      contentType: cfg.contentType ?? record.contentType ?? record.type ?? "Data",
      licenseType: cfg.licenseType ?? record.licenseType ?? "personal",
      content:     content || title,
      sourceStore: store,
      sourceType:  record.type ?? cfg.contentType ?? "",
      sourceId:    record.id,
    }, { autoClaim: true });
  } catch (e) {
    console.warn("[HI License] Auto-claim skipped:", e.message ?? e);
    return null;
  }
}

/* ── Download / copy ── */

function hiDownloadJSON(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

async function hiCopyText(text, btn, label) {
  try {
    await navigator.clipboard.writeText(text);
    if (btn) {
      const original = btn.textContent;
      btn.textContent = label ?? "Copied";
      setTimeout(() => { btn.textContent = original; }, 1_400);
    }
  } catch {
    window.prompt("Copy this value", text);
  }
}

/* ── Certificate markup ── */

function hiRenderLicenseCertificateMarkup(license) {
  const cert       = license.certificate ?? {};
  const owner      = cert.owner ?? {};
  const claim      = cert.claim ?? {};
  const fullHash   = claim.contentHash   ?? license.contentHash   ?? "";
  const verifyHash = cert.verificationHash ?? license.verificationHash ?? "";
  const hashRows   = hiHashChunks(fullHash,   16, 4).map(chunk => `<span>${hiLicenseEsc(chunk)}</span>`).join("");
  const verifyRows = hiHashChunks(verifyHash, 16, 4).map(chunk => `<span>${hiLicenseEsc(chunk)}</span>`).join("");
  const source     = claim.sourceRef ?? license.sourceRef;

  return `<article class="hi-pro-cert hi-print-target" data-license-id="${hiLicenseEsc(license.licenseId)}">` +
    `<div class="hi-pro-cert-ribbon"></div>` +
    `<header class="hi-pro-cert-head">` +
      `<div class="hi-pro-cert-brand">` +
        `<div class="hi-pro-cert-logo">HI</div>` +
        `<div><div class="hi-pro-cert-kicker">Human Intelligence App</div><h3>Digital Ownership Certificate</h3></div>` +
      `</div>` +
      `<div class="hi-pro-cert-status"><span>Verified Record</span><strong>${hiLicenseEsc(license.protocolVersion ?? HI_LICENSE_VERSION)}</strong></div>` +
    `</header>` +
    `<section class="hi-pro-cert-hero">` +
      `<div>` +
        `<div class="hi-pro-cert-label">License ID</div>` +
        `<div class="hi-pro-cert-id">${hiLicenseEsc(license.licenseId)}</div>` +
        `<h4>${hiLicenseEsc(claim.title ?? license.title)}</h4>` +
        `<p>${hiLicenseEsc(hiLicenseTypeLabel(claim.licenseType ?? license.licenseType))} · ${hiLicenseEsc(claim.contentType ?? license.contentType)}</p>` +
      `</div>` +
      `<div class="hi-pro-cert-seal">${hiRenderHashSeal(verifyHash || fullHash)}<span>HI Seal</span></div>` +
    `</section>` +
    `<section class="hi-pro-cert-grid">` +
      `<div class="hi-pro-cert-block"><span>Issued To</span><strong>${hiLicenseEsc(owner.name ?? license.ownerName)}</strong><code>${hiLicenseEsc(owner.hdi ?? license.ownerHDI ?? "HDI pending")}</code></div>` +
      `<div class="hi-pro-cert-block"><span>Issued By</span><strong>${hiLicenseEsc(HI_LICENSE_SITE)}</strong><code>HI-License Protocol</code></div>` +
      `<div class="hi-pro-cert-block"><span>Issued At</span><strong>${hiLicenseEsc(claim.issuedAtLabel ?? license.createdAtStr)}</strong><code>Asia/Kolkata</code></div>` +
      `<div class="hi-pro-cert-block"><span>Source</span><strong>${hiLicenseEsc(source ? `${source.store} / ${source.type}` : "Manual Claim")}</strong><code>${hiLicenseEsc(source ? source.id : "direct")}</code></div>` +
    `</section>` +
    `<section class="hi-pro-cert-hashes">` +
      `<div><span>Content SHA-256</span><code>${hashRows}</code></div>` +
      `<div><span>Certificate Verification Hash</span><code>${verifyRows}</code></div>` +
    `</section>` +
    `<footer class="hi-pro-cert-foot">` +
      `<p>This certificate is a local-first HI App proof-of-claim and license assertion. Verify by matching the exported JSON, license ID, owner HDI, and hashes.</p>` +
      `<div><span>Protocol</span><strong>HI-License ${hiLicenseEsc(license.protocolVersion ?? HI_LICENSE_VERSION)}</strong></div>` +
    `</footer>` +
  `</article>`;
}

async function hiShowLicenseCertificate(id, printAfterRender) {
  const license  = await hiGet("licenses", id);
  const section  = document.getElementById("hi-license-certificate-section");
  const target   = document.getElementById("hi-license-certificate");
  if (!license || !section || !target) return;
  target.innerHTML = hiRenderLicenseCertificateMarkup(license);
  section.hidden   = false;
  if (!printAfterRender) section.scrollIntoView({ behavior: "smooth", block: "start" });
  if (printAfterRender) {
    document.body.classList.add("hi-printing-license");
    window.print();
  }
}

async function hiPrintLicense(id) {
  document.querySelectorAll(".hi-print-target").forEach(el => el.classList.remove("hi-print-target"));
  document.body.classList.remove("hi-printing-license", "hi-printing-hdi");
  if (id) {
    await hiShowLicenseCertificate(id, true);
    return;
  }
  await hiRenderHDICertificate(true);
  document.body.classList.add("hi-printing-hdi");
  window.print();
}

async function hiExportLicenseJSON(id) {
  const license = await hiGet("licenses", id);
  if (!license) return;
  hiDownloadJSON(`${license.licenseId}.hi-license.json`, license.certificate ?? license);
}

async function hiExportHDICertificateJSON() {
  const identity = await hiGet("identity", "primary");
  if (!identity) return;
  const payload = await hiBuildHDICertificate(identity);
  hiDownloadJSON(`${identity.hdi ?? "HI-HDI"}.certificate.json`, payload);
}

/* ── HDI certificate ── */

async function hiBuildHDICertificate(identity) {
  const licenses = await hiGetAll("licenses");
  const claims   = licenses.map(lic => ({
    licenseId:        lic.licenseId,
    title:            lic.title,
    contentType:      lic.contentType,
    licenseType:      lic.licenseType,
    contentHash:      lic.contentHash      ?? "",
    verificationHash: lic.verificationHash ?? "",
    issuedAt:         lic.issuedAt ?? lic.createdAt ?? 0,
  }));
  const payload = {
    protocol:     "HI Human Digital Identity Certificate",
    version:      HI_LICENSE_VERSION,
    issuer:       HI_LICENSE_SITE,
    exportedAt:   new Date().toISOString(),
    issuedAt:     identity.createdAt ?? Date.now(),
    issuedAtLabel:hiFormatLicenseDate(identity.createdAt ?? Date.now()),
    identity: {
      name:      identity.name      ?? "",
      username:  identity.username  ?? "",
      email:     identity.email     ?? "",
      phoneCode: identity.phoneCode ?? "",
      phone:     identity.phone     ?? "",
      hdi:       identity.hdi       ?? "",
      tagline:   identity.tagline   ?? "",
      roles:     identity.roles     ?? [],
      location:  identity.location  ?? "",
      mission:   identity.mission   ?? "",
    },
    claims,
    claimCount: claims.length,
    status:     "Locally issued",
    notice:     "This HDI certificate identifies the local HI App owner and summarizes locally issued content/license claims.",
  };
  payload.verificationHash = await hiHashContent(hiStableStringify(payload));
  return payload;
}

function hiRenderHDICertificateMarkup(cert) {
  const identity    = cert.identity ?? {};
  const roles       = Array.isArray(identity.roles) ? identity.roles.join(" · ") : "";
  const initials    = String(identity.name ?? "HI").split(" ").map(w => w.charAt(0)).join("").slice(0, 3).toUpperCase();
  const claimPreview = (cert.claims ?? []).slice(0, 5).map(claim =>
    `<div class="hi-hdi-claim-row">` +
      `<span>${hiLicenseEsc(claim.licenseId)}</span>` +
      `<strong>${hiLicenseEsc(claim.title ?? "Untitled")}</strong>` +
      `<code>${hiLicenseEsc((claim.verificationHash ?? claim.contentHash ?? "").slice(0, 18))}</code>` +
    `</div>`
  ).join("") || '<p class="hi-empty">No content claims yet. Claim content to attach licenses to this HDI.</p>';

  return `<article class="hi-hdi-pro-cert hi-print-target">` +
    `<div class="hi-pro-cert-ribbon"></div>` +
    `<header class="hi-pro-cert-head">` +
      `<div class="hi-pro-cert-brand">` +
        `<div class="hi-pro-cert-logo">HI</div>` +
        `<div><div class="hi-pro-cert-kicker">Human Intelligence App</div><h3>Human Digital Identity Certificate</h3></div>` +
      `</div>` +
      `<div class="hi-pro-cert-status"><span>Identity Record</span><strong>${hiLicenseEsc(cert.version ?? HI_LICENSE_VERSION)}</strong></div>` +
    `</header>` +
    `<section class="hi-hdi-hero">` +
      `<div class="hi-hdi-avatar-large">${hiLicenseEsc(initials)}</div>` +
      `<div class="hi-hdi-main">` +
        `<div class="hi-pro-cert-label">Owner</div>` +
        `<h4>${hiLicenseEsc(identity.name ?? "Unnamed Identity")}</h4>` +
        (identity.username ? `<p>@${hiLicenseEsc(identity.username)}</p>` : "") +
        (identity.tagline  ? `<p>${hiLicenseEsc(identity.tagline)}</p>`  : "") +
        (roles             ? `<p>${hiLicenseEsc(roles)}</p>`             : "") +
        `<div class="hi-hdi-code">${hiLicenseEsc(identity.hdi ?? "HDI pending")}</div>` +
      `</div>` +
      `<div class="hi-pro-cert-seal">${hiRenderHashSeal(cert.verificationHash ?? identity.hdi ?? identity.name)}<span>HDI Seal</span></div>` +
    `</section>` +
    `<section class="hi-pro-cert-grid">` +
      `<div class="hi-pro-cert-block"><span>Issued By</span><strong>${hiLicenseEsc(HI_LICENSE_SITE)}</strong><code>HI Identity Protocol</code></div>` +
      `<div class="hi-pro-cert-block"><span>Issued At</span><strong>${hiLicenseEsc(cert.issuedAtLabel)}</strong><code>Asia/Kolkata</code></div>` +
      `<div class="hi-pro-cert-block"><span>Location</span><strong>${hiLicenseEsc(identity.location ?? "Not set")}</strong><code>Owner declared</code></div>` +
      `<div class="hi-pro-cert-block"><span>Contact</span><strong>${hiLicenseEsc((identity.email ?? ((identity.phoneCode ?? "") + " " + (identity.phone ?? "")).trim()) || "Not set")}</strong><code>Owner declared</code></div>` +
      `<div class="hi-pro-cert-block"><span>Total Claims</span><strong>${hiLicenseEsc(cert.claimCount)}</strong><code>Linked licenses</code></div>` +
    `</section>` +
    (identity.mission ? `<section class="hi-hdi-mission"><span>Mission</span><p>${hiLicenseEsc(identity.mission)}</p></section>` : "") +
    `<section class="hi-hdi-claims"><div class="hi-pro-cert-label">Linked Claim Preview</div>${claimPreview}</section>` +
    `<section class="hi-pro-cert-hashes">` +
      `<div><span>HDI</span><code><span>${hiLicenseEsc(identity.hdi ?? "pending")}</span></code></div>` +
      `<div><span>Certificate Verification Hash</span><code>${hiHashChunks(cert.verificationHash ?? "", 16, 4).map(chunk => `<span>${hiLicenseEsc(chunk)}</span>`).join("")}</code></div>` +
    `</section>` +
    `<footer class="hi-pro-cert-foot"><p>${hiLicenseEsc(cert.notice)}</p><div><span>Protocol</span><strong>HI Identity ${hiLicenseEsc(cert.version ?? HI_LICENSE_VERSION)}</strong></div></footer>` +
  `</article>`;
}

/* ── Render licenses ── */

async function hiRenderLicenses() {
  const list = document.getElementById("hi-license-list");
  if (!list) return;

  const licenses = (await hiGetAll("licenses")).sort((a, b) => (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0));

  if (!licenses.length) {
    list.innerHTML = '<p class="hi-empty">No content claimed yet. Use the form above to claim your first piece.</p>';
    return;
  }

  list.innerHTML = licenses.map(lic => {
    const lt       = HI_LICENSE_TYPES[lic.licenseType] ?? { label: lic.licenseType ?? "License", desc: "" };
    const fullHash = lic.contentHash ?? "";
    return `<div class="hi-lic-card glass" data-license-id="${hiLicenseEsc(lic.licenseId)}">` +
      `<div class="hi-lic-top">` +
        `<div><div class="hi-lic-id">${hiLicenseEsc(lic.licenseId)}</div><div class="hi-lic-title">${hiLicenseEsc(lic.title)}</div></div>` +
        `<span class="hi-lic-type-badge">${hiLicenseEsc(lt.label)}</span>` +
      `</div>` +
      `<div class="hi-lic-meta">` +
        `<span>${hiLicenseEsc(lic.contentType)}</span>` +
        `<span>SHA-256: <code title="${hiLicenseEsc(fullHash)}">${hiLicenseEsc(fullHash.slice(0, 20))}${fullHash.length > 20 ? "..." : ""}</code></span>` +
        `<span>Verify: <code>${hiLicenseEsc((lic.verificationHash ?? "").slice(0, 16))}</code></span>` +
        `<span>${hiLicenseEsc(lic.createdAtStr ?? "")}</span>` +
        (lic.sourceRef ? `<span>Source: ${hiLicenseEsc(`${lic.sourceRef.store}/${lic.sourceRef.type}`)}</span>` : "") +
      `</div>` +
      `<div class="hi-lic-actions">` +
        `<button type="button" class="hi-contact-btn hi-lic-view"     data-id="${hiLicenseEsc(lic.id)}">View Certificate</button>` +
        `<button type="button" class="hi-contact-btn hi-lic-copy-id"  data-id="${hiLicenseEsc(lic.licenseId)}">Copy ID</button>` +
        `<button type="button" class="hi-contact-btn hi-lic-copy-json" data-id="${hiLicenseEsc(lic.id)}">Copy Verify JSON</button>` +
        `<button type="button" class="hi-contact-btn hi-lic-export"   data-id="${hiLicenseEsc(lic.id)}">Export JSON</button>` +
        `<button type="button" class="hi-contact-btn hi-lic-print"    data-id="${hiLicenseEsc(lic.id)}">Print</button>` +
        `<button type="button" class="hi-icon-btn hi-lic-del"         data-id="${hiLicenseEsc(lic.id)}">&#x2715; Delete</button>` +
      `</div>` +
    `</div>`;
  }).join("");

  list.querySelectorAll(".hi-lic-copy-id").forEach(btn =>
    btn.addEventListener("click", () => hiCopyText(btn.dataset.id, btn, "Copied")));
  list.querySelectorAll(".hi-lic-view").forEach(btn =>
    btn.addEventListener("click", () => hiShowLicenseCertificate(btn.dataset.id, false)));
  list.querySelectorAll(".hi-lic-copy-json").forEach(btn =>
    btn.addEventListener("click", async () => {
      const lic = await hiGet("licenses", btn.dataset.id);
      if (lic) hiCopyText(JSON.stringify(lic.verification ?? lic.certificate ?? lic, null, 2), btn, "Copied");
    }));
  list.querySelectorAll(".hi-lic-export").forEach(btn =>
    btn.addEventListener("click", () => hiExportLicenseJSON(btn.dataset.id)));
  list.querySelectorAll(".hi-lic-print").forEach(btn =>
    btn.addEventListener("click", () => hiPrintLicense(btn.dataset.id)));
  list.querySelectorAll(".hi-lic-del").forEach(btn =>
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this license record?")) return;
      await hiDelete("licenses", btn.dataset.id);
      hiRenderLicenses();
      hiRenderHDICertificate();
    }));
}

/* ── HDI certificate panel ── */

async function hiRenderHDICertificate(printMode) {
  const el = document.getElementById("hi-hdi-certificate");
  if (!el) return;

  const identity = await hiGet("identity", "primary");
  if (!identity) {
    el.innerHTML = '<p class="hi-empty" style="text-align:center;padding:40px">Set up your identity first to generate your HDI certificate.</p>';
    return;
  }

  const hdiCert  = await hiBuildHDICertificate(identity);
  const licCount = hdiCert.claimCount;
  const issued   = new Date(identity.createdAt ?? Date.now()).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  el.innerHTML =
    `<div class="hi-cert-card">` +
      `<div class="hi-cert-header"><div class="hi-cert-logo">HI</div><div class="hi-cert-label">Human Digital Identity Certificate</div></div>` +
      `<div class="hi-cert-body">` +
        `<div class="hi-cert-avatar">${hiLicenseEsc((identity.name ?? "H").charAt(0))}</div>` +
        `<h2 class="hi-cert-name">${hiLicenseEsc(identity.name)}</h2>` +
        (Array.isArray(identity.roles) && identity.roles.length ? `<p class="hi-cert-roles">${hiLicenseEsc(identity.roles.join(" · "))}</p>` : "") +
        (identity.location ? `<p class="hi-cert-location">&#x1F4CD; ${hiLicenseEsc(identity.location)}</p>` : "") +
        `<div class="hi-cert-hdi">${hiLicenseEsc(identity.hdi ?? "—")}</div>` +
      `</div>` +
      `<div class="hi-cert-footer">` +
        `<div class="hi-cert-stat"><span class="hi-cert-stat-val">${licCount}</span><span class="hi-cert-stat-lbl">Claims</span></div>` +
        `<div class="hi-cert-stat"><span class="hi-cert-stat-val">${hiLicenseEsc(issued)}</span><span class="hi-cert-stat-lbl">Issued</span></div>` +
        `<div class="hi-cert-stat"><span class="hi-cert-stat-val">kingofyadav.in</span><span class="hi-cert-stat-lbl">Verified at</span></div>` +
      `</div>` +
    `</div>` +
    `<div class="hi-cert-actions">` +
      `<button type="button" class="hi-contact-btn" id="hiExportHDIJsonBtn">Export HDI JSON</button>` +
      `<button type="button" class="hi-contact-btn" id="hiPrintHDIBtn">Print HDI</button>` +
    `</div>` +
    `<div id="hi-hdi-pro-certificate" class="hi-hdi-pro-wrap">${hiRenderHDICertificateMarkup(hdiCert)}</div>`;

  document.getElementById("hiExportHDIJsonBtn")?.addEventListener("click", hiExportHDICertificateJSON);
  document.getElementById("hiPrintHDIBtn")?.addEventListener("click", () => hiPrintLicense(""));
  if (!printMode) {
    document.querySelector(".hi-hdi-pro-cert")?.classList.remove("hi-print-target");
  }
}

/* ── Claim form ── */

function hiInitClaimForm() {
  const form = document.getElementById("hi-claim-form");
  if (!form) return;

  const typeSelect = document.getElementById("hi-claim-license-type");
  if (typeSelect) {
    typeSelect.innerHTML = Object.entries(HI_LICENSE_TYPES).map(([key, val]) =>
      `<option value="${key}">${val.label} - ${val.desc}</option>`
    ).join("");
  }

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const title       = (document.getElementById("hi-claim-title")?.value       ?? "").trim();
    const contentType = document.getElementById("hi-claim-content-type")?.value ?? "Idea";
    const licenseType = document.getElementById("hi-claim-license-type")?.value ?? "personal";
    const content     = (document.getElementById("hi-claim-content")?.value     ?? "").trim();
    const errEl       = document.getElementById("hi-claim-err");
    const successEl   = document.getElementById("hi-claim-success");

    if (!title) { if (errEl) errEl.textContent = "Title is required."; return; }
    if (errEl) errEl.textContent = "";

    try {
      const license = await hiClaimContent({ title, contentType, licenseType, content });
      if (successEl) {
        successEl.innerHTML =
          `<div class="hi-claim-result">` +
            `<div class="hi-claim-result-id">${hiLicenseEsc(license.licenseId)}</div>` +
            `<p>Content claimed. Full certificate and verification JSON are now saved locally.</p>` +
            `<button type="button" class="hi-btn-primary" id="hiClaimCopyLatest">Copy License ID</button>` +
          `</div>`;
        successEl.hidden = false;
        document.getElementById("hiClaimCopyLatest")?.addEventListener("click", function() {
          hiCopyText(license.licenseId, this, "Copied");
        });
      }
      form.reset();
      hiRenderLicenses();
      hiRenderHDICertificate();
      document.dispatchEvent(new CustomEvent("hiLicenseClaimed", { detail: { licenseId: license.licenseId } }));
    } catch (err) {
      if (errEl) errEl.textContent = err.message ?? "Failed to claim content.";
    }
  });
}

/* ── Existing claim picker ── */

async function hiLoadExistingClaimOptions(sourceKey) {
  const source = HI_EXISTING_CLAIM_SOURCES[sourceKey];
  if (!source) return [];
  const rows = await hiGetAll(source.store);
  return rows
    .filter(item => item?.id && (!source.type || item.type === source.type))
    .sort(source.sort);
}

function hiSetExistingClaimStatus(message, type) {
  const el = document.getElementById("hi-existing-claim-status");
  if (!el) return;
  el.textContent = message ?? "";
  el.className   = type ? `hi-sync-status ${type}` : "hi-sync-status";
}

async function hiRenderExistingClaimRecords() {
  const sourceEl = document.getElementById("hi-existing-source");
  const recordEl = document.getElementById("hi-existing-record");
  if (!sourceEl || !recordEl) return;

  const source   = HI_EXISTING_CLAIM_SOURCES[sourceEl.value];
  const rows     = await hiLoadExistingClaimOptions(sourceEl.value);
  recordEl.innerHTML = rows.length
    ? rows.map(item => `<option value="${hiLicenseEsc(item.id)}">${hiLicenseEsc(source.label(item))}</option>`).join("")
    : '<option value="">No saved content found</option>';
}

async function hiClaimExistingSelectedContent() {
  const sourceEl    = document.getElementById("hi-existing-source");
  const recordEl    = document.getElementById("hi-existing-record");
  const licTypeEl   = document.getElementById("hi-existing-license-type");
  if (!sourceEl || !recordEl?.value) {
    hiSetExistingClaimStatus("Select saved content first.", "error");
    return;
  }

  const source = HI_EXISTING_CLAIM_SOURCES[sourceEl.value];
  if (!source) return;
  const item = await hiGet(source.store, recordEl.value);
  if (!item) { hiSetExistingClaimStatus("Selected content was not found.", "error"); return; }

  const license = await hiClaimContent({
    title:       source.label(item),
    contentType: source.contentType,
    licenseType: licTypeEl?.value ?? "personal",
    content:     source.content(item),
    sourceStore: source.store,
    sourceType:  source.type ?? item.type ?? "task",
    sourceId:    item.id,
  });

  hiSetExistingClaimStatus(`Certificate generated: ${license.licenseId}`);
  await hiRenderLicenses();
  await hiRenderHDICertificate();
  await hiShowLicenseCertificate(license.id, false);
}

function hiInitExistingClaimPicker() {
  const sourceEl  = document.getElementById("hi-existing-source");
  const licTypeEl = document.getElementById("hi-existing-license-type");
  const btn       = document.getElementById("hiClaimExistingBtn");
  if (!sourceEl) return;

  if (licTypeEl) {
    licTypeEl.innerHTML = Object.entries(HI_LICENSE_TYPES).map(([key, val]) =>
      `<option value="${key}">${val.label} - ${val.desc}</option>`
    ).join("");
  }

  sourceEl.addEventListener("change", () => {
    hiSetExistingClaimStatus("");
    hiRenderExistingClaimRecords();
  });

  btn?.addEventListener("click", () => {
    hiClaimExistingSelectedContent().catch(err => {
      hiSetExistingClaimStatus(err.message ?? "Certificate generation failed.", "error");
    });
  });

  hiRenderExistingClaimRecords();
}

/* ── Init ── */

document.addEventListener("DOMContentLoaded", () => {
  hiRenderHDICertificate();
  hiRenderLicenses();
  hiInitClaimForm();
  hiInitExistingClaimPicker();
}, { once: true });

window.addEventListener("afterprint", () => {
  document.body.classList.remove("hi-printing-license", "hi-printing-hdi");
  document.querySelectorAll(".hi-print-target").forEach(el => el.classList.remove("hi-print-target"));
});
