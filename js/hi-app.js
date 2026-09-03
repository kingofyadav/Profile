"use strict";

/* ======================================================
   hi-app.js — HI App Core  (Phase 0 + 1)
   Identity · Today View · Tasks · Mood/Energy · Tabs
   Depends on: hi-storage.js (must load first)
====================================================== */

const HI_IDENTITY_ID = "primary";

const HI_DEFAULT_IDENTITY = {
  name:      "Amit Ku Yadav",
  username:  "kingofyadav",
  email:     "kingofyadav.in@gmail.com",
  phoneCode: "+91",
  phone:     "95235 28114",
  tagline:   "Building trusted digital systems, ventures, and community impact from Bhagalpur.",
  roles:     ["Digital Systems Builder", "Founder", "Community Organizer", "Creator"],
  mission:   "Build a disciplined personal internet for identity, work, people, records, ownership, and AI-assisted decisions while staying accountable to useful real-world impact.",
  location:  "Bhagalpur, Bihar, India",
};

const HI_DEFAULT_TODAY_TASKS = [
  "Review HI Life OS dashboard and update missing records",
  "Check priority messages, calls, and community follow-ups",
  "Move one public website or venture task forward",
  "Ask AI for a risk and focus audit before closing the day",
];

/* ── Helpers ── */

function hiEsc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function hiFormatDate(d) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(d ?? new Date());
}

function hiGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 20) return "Good evening";
  return "Good night";
}

function hiBuildUsername(name) {
  return String(name ?? "")
    .trim().toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 40);
}

function hiFormatIdentityPhone(identity) {
  if (!identity?.phone) return "";
  return `${identity.phoneCode ? identity.phoneCode + " " : ""}${identity.phone}`;
}

/* ── HDI Generator ── */

async function hiGenerateHDI(name) {
  const deviceId = localStorage.getItem("ak_device_id") || "device";
  const raw      = `${name}|${deviceId}`;
  try {
    const enc      = new TextEncoder();
    const buf      = await crypto.subtle.digest("SHA-256", enc.encode(raw));
    const hex      = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
    const initials = String(name).split(" ").map(w => w[0] ?? "").join("").toUpperCase().slice(0, 3);
    const year     = new Date().getFullYear();
    return `${initials}-${year}-${hex.slice(0, 6).toUpperCase()}`;
  } catch {
    const code = String(name).replace(/\s+/g, "").slice(0, 3).toUpperCase();
    return `${code}-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }
}

/* ── Identity ── */

async function hiLoadIdentity() {
  try {
    const identity = await hiGet("identity", HI_IDENTITY_ID);
    if (identity && typeof hiCryptoEnsureIdentityKey === "function" && !identity.identityPublicKey) {
      return hiSaveIdentity(identity);
    }
    return identity;
  } catch { return null; }
}

async function hiSaveIdentity(data) {
  let cryptoKey = null;
  if (typeof hiCryptoEnsureIdentityKey === "function") {
    cryptoKey = await hiCryptoEnsureIdentityKey(data);
  }
  if (cryptoKey?.hdi) {
    if (data.hdi && data.hdi !== cryptoKey.hdi && !data.legacyHdi) {
      data.legacyHdi = data.hdi;
      data.migratedToCryptoHdiAt = Date.now();
    }
    data.hdi               = cryptoKey.hdi;
    data.identityKeyVersion = cryptoKey.version;
    data.identityAlgorithm  = cryptoKey.algorithm;
    data.identityPublicKey  = cryptoKey.publicKeySpki;
    data.hdiMode            = "public-key-derived";
  } else if (!data.hdi && data.name) {
    data.hdi    = await hiGenerateHDI(data.name);
    data.hdiMode = "legacy-device-derived";
  }
  data.id        = HI_IDENTITY_ID;
  data.updatedAt = Date.now();
  if (!data.createdAt) data.createdAt = Date.now();
  await hiPut("identity", data);
  try {
    if (data.hdi)  localStorage.setItem('hi_hdi_code', data.hdi);
    if (data.name) localStorage.setItem('hi_hdi_name', data.name);
  } catch {}
  return data;
}

async function hiEnsureDefaultIdentity() {
  const identity = await hiLoadIdentity();
  if (identity) return identity;
  return hiSaveIdentity(Object.assign({}, HI_DEFAULT_IDENTITY, { seeded: true, createdAt: Date.now() }));
}

/* ── Render Identity Card ── */

function hiRenderIdentity(identity) {
  const card = document.getElementById("hi-identity-card");
  hiRenderHeroIdentity(identity);
  if (!card) return;

  if (!identity) {
    card.innerHTML =
      '<div class="hi-identity-setup">' +
        '<div class="hi-setup-icon">🗪</div>' +
        '<h2>Set Up Your Identity</h2>' +
        '<p>Create your Human Digital Identity — the foundation of HI App.</p>' +
        '<button class="hi-btn-primary" id="hiSetupIdentityBtn">Create Identity</button>' +
      '</div>';
    document.getElementById("hiSetupIdentityBtn")?.addEventListener("click", () => hiOpenIdentityModal(null));
    return;
  }

  const roles = Array.isArray(identity.roles) ? identity.roles.join(" · ") : (identity.roles || "");

  card.innerHTML =
    '<div class="hi-identity-inner">' +
      '<div class="hi-identity-left">' +
        '<div class="hi-identity-avatar">' + hiEsc(identity.name.charAt(0)) + '</div>' +
        (identity.hdi ? '<div class="hi-hdi-badge" title="Human Digital Identity">' + hiEsc(identity.hdi) + '</div>' : '') +
      '</div>' +
      '<div class="hi-identity-right">' +
        '<h2 class="hi-identity-name">' + hiEsc(identity.name) + '</h2>' +
        (identity.username ? '<p class="hi-identity-username">@' + hiEsc(identity.username) + '</p>' : '') +
        (roles ? '<p class="hi-identity-roles">' + hiEsc(roles) + '</p>' : '') +
        ((identity.email || identity.phone)
          ? '<div class="hi-identity-contact">' +
              (identity.email ? '<span>' + hiEsc(identity.email) + '</span>' : '') +
              (identity.phone ? '<span>' + hiEsc(hiFormatIdentityPhone(identity)) + '</span>' : '') +
            '</div>' : '') +
        (identity.tagline  ? '<p class="hi-identity-tagline">&ldquo;' + hiEsc(identity.tagline) + '&rdquo;</p>' : '') +
        (identity.location ? '<p class="hi-identity-location">📍 ' + hiEsc(identity.location) + '</p>' : '') +
        (identity.mission  ? '<p class="hi-identity-mission">' + hiEsc(identity.mission) + '</p>' : '') +
      '</div>' +
      '<button class="hi-edit-identity-btn" id="hiEditIdentityBtn" title="Edit identity">✏️</button>' +
    '</div>';

  document.getElementById("hiEditIdentityBtn")?.addEventListener("click", () => hiOpenIdentityModal(identity));
}

function hiRenderHeroDots(containerId, value) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const count = Math.max(0, Math.min(5, parseInt(value || 0, 10)));
  el.textContent = "";
  for (let i = 1; i <= 5; i++) {
    const dot = document.createElement("i");
    if (i <= count) dot.className = "active";
    el.appendChild(dot);
  }
}

async function hiRenderHeroIdentity(identity) {
  const title   = document.getElementById("hiHeroTitle");
  const nameEl  = document.getElementById("hiHeroIdentityName");
  const hdiEl   = document.getElementById("hiHeroHDI");
  const editBtn = document.getElementById("hiHeroEditIdentityBtn");

  /* Read the federated (0dot / legacy EarthSphere) session — auth.js is
     always loaded before hi-app.js */
  const _tok   = (typeof getToken === "function") ? getToken() : null;
  const _fed   = (typeof isFederatedSession === "function") ? isFederatedSession(_tok) : (_tok?.provider === "earthsphere");
  const _esHdi = _fed ? (_tok.handle ? "@" + String(_tok.handle).replace(/^@/, "") : (_tok.hdi || _tok.username || null)) : null;

  const name       = identity?.name ?? (_tok?.name) ?? (_esHdi ? _esHdi.replace(/^@/, "").split(".")[0] : "Amit Ku Yadav");
  const displayHdi = identity?.hdi  ?? _esHdi ?? "HDI pending";

  if (title)  title.textContent  = `Life OS for ${name}`;
  if (nameEl) nameEl.textContent = name;
  if (hdiEl) {
    hdiEl.textContent = displayHdi;
    if (_esHdi && !identity?.hdi) {
      hdiEl.classList.add("hdi-earthsphere");
      hdiEl.title = _tok && _tok.provider === "earthsphere" ? "Synced from EarthSphere" : "Synced from 0dot";
    } else {
      hdiEl.classList.remove("hdi-earthsphere");
      hdiEl.title = "";
    }
  }
  if (editBtn) {
    editBtn.textContent = identity ? "Edit Identity" : "Create Identity";
    editBtn.addEventListener("click", () => hiOpenIdentityModal(identity ?? null));
  }
}

async function hiRenderHeroToday() {
  const greetingEl = document.getElementById("hiHeroGreeting");
  const dateEl     = document.getElementById("hiHeroDate");
  if (greetingEl) greetingEl.textContent = hiGreeting();
  if (dateEl)     dateEl.textContent     = hiFormatDate();
  const moodData = await hiLoadMoodToday();
  hiRenderHeroDots("hiHeroMoodDots",   moodData?.mood   ?? 0);
  hiRenderHeroDots("hiHeroEnergyDots", moodData?.energy ?? 0);
}

/* ── Identity Modal ── */

function hiOpenIdentityModal(identity) {
  const modal = document.getElementById("hi-identity-modal");
  if (!modal) return;

  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  const titleEl = document.getElementById("hiIdentityModalTitle");
  if (titleEl) titleEl.textContent = identity ? "Edit Identity" : "Create Your Identity";

  setVal("hi-id-name",       identity?.name       ?? "Amit Ku Yadav");
  setVal("hi-id-username",   identity?.username   ?? hiBuildUsername(identity?.name ?? ""));
  setVal("hi-id-email",      identity?.email      ?? "");
  setVal("hi-id-phone-code", identity?.phoneCode  ?? "+91");
  setVal("hi-id-phone",      identity?.phone      ?? "");
  setVal("hi-id-tagline",    identity?.tagline    ?? "");
  setVal("hi-id-roles",      Array.isArray(identity?.roles) ? identity.roles.join(", ") : (identity?.roles ?? "Founder · Builder · Creator"));
  setVal("hi-id-mission",    identity?.mission    ?? "");
  setVal("hi-id-location",   identity?.location   ?? "Bhagalpur, India");

  const errEl = document.getElementById("hiIdentityModalErr");
  if (errEl) errEl.textContent = "";

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  setTimeout(() => document.getElementById("hi-id-name")?.focus(), 60);
}

function hiCloseIdentityModal() {
  const modal = document.getElementById("hi-identity-modal");
  if (!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

async function hiSaveIdentityModal() {
  const saveBtn = document.getElementById("hiIdentityModalSave");
  const errEl   = document.getElementById("hiIdentityModalErr");
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = "Saving…"; }

  try {
    const nameEl = document.getElementById("hi-id-name");
    if (!nameEl) { hiCloseIdentityModal(); return; }

    const getVal = id => (document.getElementById(id)?.value ?? "").trim();
    let   name     = getVal("hi-id-name");
    let   username = getVal("hi-id-username");
    const email    = getVal("hi-id-email");
    const phoneCode= getVal("hi-id-phone-code");
    let   phone    = getVal("hi-id-phone").replace(/[^\d\s-]/g, "").trim();
    const tagline  = getVal("hi-id-tagline");
    const rolesRaw = getVal("hi-id-roles");
    const mission  = getVal("hi-id-mission");
    const location = getVal("hi-id-location");

    if (!name) { if (errEl) errEl.textContent = "Name is required."; return; }
    username = hiBuildUsername(username || name);
    if (!username) { if (errEl) errEl.textContent = "Username is required."; return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      if (errEl) errEl.textContent = "Enter a valid email address."; return;
    }
    if (phoneCode && !/^\+\d{1,4}$/.test(phoneCode)) {
      if (errEl) errEl.textContent = "Country code must look like +91."; return;
    }
    if (errEl) errEl.textContent = "";

    const existing = await hiLoadIdentity();
    const roles    = rolesRaw ? rolesRaw.split(/[,·]/).map(r => r.trim()).filter(Boolean) : [];
    const data     = Object.assign({}, existing ?? {}, { name, username, email, phoneCode: phoneCode || "+91", phone, tagline, roles, mission, location });
    if (existing?.hdi) data.hdi = existing.hdi;

    const saved = await hiSaveIdentity(data);
    hiRenderIdentity(saved);
    hiRenderHeroIdentity(saved);
    if (typeof window.pdSyncIdentityDetails === "function") window.pdSyncIdentityDetails(saved);
    hiCloseIdentityModal();
  } catch (err) {
    if (errEl) errEl.textContent = err?.message ? `Identity save failed: ${err.message}` : "Identity save failed. Close other HI tabs, reload, and try again.";
  } finally {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = "Save Identity"; }
  }
}

/* ── Today Header ── */

function hiRenderTodayHeader() {
  const greetEl = document.getElementById("hi-greeting");
  const dateEl  = document.getElementById("hi-today-date");
  if (greetEl) {
    const user = typeof getAuthUser === "function" ? getAuthUser() : null;
    greetEl.textContent = hiGreeting() + (user ? `, ${user}` : "");
  }
  if (dateEl) dateEl.textContent = hiFormatDate();
  hiRenderHeroToday();
}

/* ── Tasks ── */

async function hiLoadTodayTasks() {
  const today = hiTodayDate();
  const all   = await hiGetAll("tasks");
  return all.filter(t => t.date === today).sort((a, b) => a.createdAt - b.createdAt);
}

async function hiEnsureTodayTasks() {
  const existing = await hiLoadTodayTasks();
  if (existing.length) return existing;
  for (let i = 0; i < HI_DEFAULT_TODAY_TASKS.length; i++) {
    await hiPut("tasks", {
      id:        `seed-task-${hiTodayDate()}-${i}`,
      title:     HI_DEFAULT_TODAY_TASKS[i],
      done:      false,
      date:      hiTodayDate(),
      seeded:    true,
      createdAt: Date.now() + i,
    });
  }
  return hiLoadTodayTasks();
}

async function hiAddTask(title) {
  const task = { id: hiGenId(), title: title.trim(), done: false, date: hiTodayDate(), createdAt: Date.now() };
  await hiPut("tasks", task);
  return task;
}

async function hiToggleTask(id) {
  const task = await hiGet("tasks", id);
  if (!task) return;
  task.done   = !task.done;
  task.doneAt = task.done ? Date.now() : null;
  await hiPut("tasks", task);
}

async function hiRenderTasks() {
  const list = document.getElementById("hi-task-list");
  if (!list) return;

  const tasks = await hiLoadTodayTasks();
  if (!tasks.length) {
    list.innerHTML = '<li class="hi-task-empty">No tasks yet. Add your first task for today.</li>';
    return;
  }

  list.innerHTML = tasks.map(t =>
    `<li class="hi-task-item${t.done ? " done" : ""}" data-id="${hiEsc(t.id)}">` +
      `<button class="hi-task-check" aria-label="${t.done ? "Mark incomplete" : "Mark complete"}">${t.done ? "✓" : ""}</button>` +
      `<span class="hi-task-title">${hiEsc(t.title)}</span>` +
      `<button class="hi-task-delete" aria-label="Delete task">✕</button>` +
    `</li>`
  ).join("");

  list.querySelectorAll(".hi-task-check").forEach(btn => {
    btn.addEventListener("click", async () => {
      await hiToggleTask(btn.closest(".hi-task-item").dataset.id);
      hiRenderTasks();
    });
  });

  list.querySelectorAll(".hi-task-delete").forEach(btn => {
    btn.addEventListener("click", async () => {
      await hiDelete("tasks", btn.closest(".hi-task-item").dataset.id);
      hiRenderTasks();
    });
  });
}

function hiInitTaskInput() {
  const form = document.getElementById("hi-task-form");
  if (!form) return;
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const input = document.getElementById("hi-task-input");
    const val   = (input?.value ?? "").trim();
    if (!val) return;
    await hiAddTask(val);
    if (input) input.value = "";
    hiRenderTasks();
  });
}

/* ── Mood & Energy ── */

async function hiLoadMoodToday() {
  try { return await hiGet("personal", `mood-${hiTodayDate()}`); }
  catch { return null; }
}

async function hiSaveMoodEnergy(mood, energy) {
  await hiPut("personal", {
    id:        `mood-${hiTodayDate()}`,
    mood,
    energy,
    date:      hiTodayDate(),
    updatedAt: Date.now(),
  });
}

function hiRenderDots(containerId, value, max, onSelect) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = "";
  for (let i = 1; i <= max; i++) {
    const dot = document.createElement("button");
    dot.className = `hi-dot${i <= value ? " active" : ""}`;
    dot.type = "button";
    dot.setAttribute("aria-label", `${i} of ${max}`);
    dot.dataset.val = i;
    el.appendChild(dot);
  }
  el.addEventListener("click", e => {
    const btn = e.target.closest(".hi-dot");
    if (btn) onSelect(parseInt(btn.dataset.val, 10));
  });
}

async function hiInitMood() {
  const moodData      = await hiLoadMoodToday();
  let   currentMood   = moodData?.mood   ?? 0;
  let   currentEnergy = moodData?.energy ?? 0;

  function renderAll() {
    hiRenderDots("hi-mood-dots", currentMood, 5, async val => {
      currentMood = val;
      await hiSaveMoodEnergy(currentMood, currentEnergy);
      hiRenderHeroDots("hiHeroMoodDots",   currentMood);
      hiRenderHeroDots("hiHeroEnergyDots", currentEnergy);
      renderAll();
    });
    hiRenderDots("hi-energy-dots", currentEnergy, 5, async val => {
      currentEnergy = val;
      await hiSaveMoodEnergy(currentMood, currentEnergy);
      hiRenderHeroDots("hiHeroMoodDots",   currentMood);
      hiRenderHeroDots("hiHeroEnergyDots", currentEnergy);
      renderAll();
    });
    hiRenderHeroDots("hiHeroMoodDots",   currentMood);
    hiRenderHeroDots("hiHeroEnergyDots", currentEnergy);
  }
  renderAll();
}

/* ── Tabs ── */

function hiInitTabs() {
  const tabBtns     = document.querySelectorAll(".hi-tab-btn");
  const tabContents = document.querySelectorAll(".hi-tab-content");
  if (!tabBtns.length) return;

  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tab;
      tabBtns.forEach(b     => b.classList.toggle("active", b.dataset.tab === target));
      tabContents.forEach(c => { c.hidden = c.dataset.tab !== target; });
    });
  });
}

/* ── INIT ── */

document.addEventListener("DOMContentLoaded", async () => {
  try { await hiOpenDB(); } catch (err) {
    console.warn("[HI] IndexedDB unavailable — running in degraded mode", err);
  }

  let identity = await hiEnsureDefaultIdentity();
  hiRenderIdentity(identity);
  if (typeof window.pdSyncIdentityDetails === "function") window.pdSyncIdentityDetails(identity);

  document.getElementById("hiPersonalDetailsEditBtn")?.addEventListener("click", () => {
    hiOpenIdentityModal(identity ?? null);
  });

  hiRenderTodayHeader();
  await hiEnsureTodayTasks();
  hiRenderTasks();
  hiInitTaskInput();
  hiInitMood();
  hiInitTabs();

  /* Identity modal */
  const overlay = document.getElementById("hi-identity-modal");
  document.getElementById("hiIdentityModalSave")?.addEventListener("click",   hiSaveIdentityModal);
  document.getElementById("hiIdentityModalCancel")?.addEventListener("click", hiCloseIdentityModal);
  document.getElementById("hiIdentityModalClose")?.addEventListener("click",  hiCloseIdentityModal);
  overlay?.addEventListener("click", e => { if (e.target === overlay) hiCloseIdentityModal(); });
  overlay?.addEventListener("keydown", e => {
    if (e.key === "Enter" && e.target.tagName !== "TEXTAREA" && e.target.tagName !== "BUTTON") {
      e.preventDefault();
      hiSaveIdentityModal();
    }
  });

  document.addEventListener("keydown", e => { if (e.key === "Escape") hiCloseIdentityModal(); });
}, { once: true });
