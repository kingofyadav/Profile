(function () {
"use strict";

/* ======================================================
   script.js — Production Version
   Clean • Modular • Optimized • Root-Safe
====================================================== */

/* ======================================================
   UTIL
====================================================== */

const $ = (id) => document.getElementById(id);
const $$ = (selector) => document.querySelectorAll(selector);

function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ======================================================
   THEME SYSTEM
====================================================== */

function applyTheme(theme) {
  document.body.classList.toggle("theme-dark", theme === "dark");
  document.body.classList.toggle("theme-light", theme === "light");

  const btn = $("themeToggle");
  if (btn) btn.textContent = theme === "dark" ? "🌙" : "☀️";

  updateLogo();
}

function initTheme() {
  const saved = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(saved || (prefersDark ? "dark" : "light"));
}

function setupThemeToggle() {
  const btn = $("themeToggle");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const next = document.body.classList.contains("theme-dark")
      ? "light"
      : "dark";

    localStorage.setItem("theme", next);
    applyTheme(next);
  });
}

function removeFooterThemeToggles() {
  document.querySelectorAll(".site-footer .theme-toggle, .site-footer #themeToggle").forEach(btn => {
    btn.remove();
  });
}

function setupLogoThemeToggle() {
  document.querySelectorAll(".personal-logo, #siteLogo, .logo").forEach(logo => {
    logo.title = "Toggle theme";
    logo.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      const next = document.body.classList.contains("theme-dark") ? "light" : "dark";
      localStorage.setItem("theme", next);
      applyTheme(next);
      logo.classList.remove("logo-theme-switching");
      void logo.offsetWidth;
      logo.classList.add("logo-theme-switching");
      logo.addEventListener("animationend", () => logo.classList.remove("logo-theme-switching"), { once: true });
    });
  });
}

/* ======================================================
   LOGO SYSTEM (ROOT SAFE)
====================================================== */

function updateLogo() {
  const theme = document.body.classList.contains("theme-light")
    ? "day"
    : "night";

  const logoSrc = `/logo/${theme}-logo.png`;
  const logoSelectors = [
    "#siteLogo",
    "#personalLogo",
    "#authLogo",
    "#authLogoCard",
    "#liveClassLogo",
    "#hiPersonalHeroLogo",
    "#hiLicenseHeroLogo",
    "#hiLicenseFooterLogo",
    ".footer-brand-logo",
    ".logo",
    ".personal-logo",
    ".hi-section-logo",
    "img[src*='/logo/day-logo.png']",
    "img[src*='/logo/night-logo.png']",
    "img[src*='logo/day-logo.png']",
    "img[src*='logo/night-logo.png']"
  ];

  document.querySelectorAll(logoSelectors.join(",")).forEach(logo => {
    if (logo.dataset && logo.dataset.noThemeLogo === "true") return;
    logo.src = logoSrc;
  });
}

/* ======================================================
   GLOBAL NAV MENUS
====================================================== */

/* ======================================================
   FOOTER SYSTEM
====================================================== */

function updateClock() {
  const el = $("footerClock");
  if (!el) return;

  el.textContent = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function updateStatus() {
  const el = $("status");
  if (!el) return;

  const hour = parseInt(
    new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      hour12: false
    }),
    10
  );
  el.textContent =
    hour >= 10 && hour < 22 ? "STATUS: ACTIVE" : "STATUS: OFFLINE";
}

function startFooterUpdates() {
  updateClock();
  updateStatus();
  setInterval(() => {
    updateClock();
    updateStatus();
  }, 60_000);
}

/* ======================================================
   DYNAMIC QUOTE BAND
====================================================== */

const FOOTER_QUOTES = [
  {
    text: "Protect the confidence of those above you; respect keeps doors open.",
    label: "Law 01"
  },
  {
    text: "Choose allies by reliability, not comfort or old familiarity.",
    label: "Law 02"
  },
  {
    text: "Keep your full plan private until timing gives it strength.",
    label: "Law 03"
  },
  {
    text: "Speak with restraint; every extra word gives away leverage.",
    label: "Law 04"
  },
  {
    text: "Guard your reputation carefully; it reaches rooms before you do.",
    label: "Law 05"
  },
  {
    text: "Visibility matters; unseen work rarely shapes public memory.",
    label: "Law 06"
  },
  {
    text: "Let others help build the result, while you own the direction.",
    label: "Law 07"
  },
  {
    text: "Draw attention toward your ground instead of chasing every move.",
    label: "Law 08"
  },
  {
    text: "Win through results; arguments often harden the other side.",
    label: "Law 09"
  },
  {
    text: "Avoid chronic negativity; moods can become environments.",
    label: "Law 10"
  },
  {
    text: "Make your contribution useful enough that absence is noticed.",
    label: "Law 11"
  },
  {
    text: "A precise act of honesty can make later strategy believable.",
    label: "Law 12"
  },
  {
    text: "Ask through interest and benefit, not through guilt.",
    label: "Law 13"
  },
  {
    text: "Observe like a friend; information is often given casually.",
    label: "Law 14"
  },
  {
    text: "When a harmful pattern must end, leave no room for return.",
    label: "Law 15"
  },
  {
    text: "Use absence with discipline; rarity can increase value.",
    label: "Law 16"
  },
  {
    text: "Stay unpredictable enough that others cannot script your limits.",
    label: "Law 17"
  },
  {
    text: "Isolation weakens judgment; stay connected to real signals.",
    label: "Law 18"
  },
  {
    text: "Know who you are dealing with before you test boundaries.",
    label: "Law 19"
  },
  {
    text: "Do not bind yourself too early; independence preserves options.",
    label: "Law 20"
  },
  {
    text: "Sometimes underplaying intelligence lets others reveal more.",
    label: "Law 21"
  },
  {
    text: "A tactical retreat can preserve strength for the decisive moment.",
    label: "Law 22"
  },
  {
    text: "Concentrated effort beats scattered ambition.",
    label: "Law 23"
  },
  {
    text: "Move with courtesy, timing, and emotional control in every room.",
    label: "Law 24"
  },
  {
    text: "Renew your identity before others freeze you in an old version.",
    label: "Law 25"
  },
  {
    text: "Keep your hands clean by designing systems that carry the friction.",
    label: "Law 26"
  },
  {
    text: "People follow belief; shape meaning, not only instructions.",
    label: "Law 27"
  },
  {
    text: "Act with boldness once the decision is made.",
    label: "Law 28"
  },
  {
    text: "Plan to the finish; endings decide how work is remembered.",
    label: "Law 29"
  },
  {
    text: "Make difficult work look composed, not desperate.",
    label: "Law 30"
  },
  {
    text: "Offer choices that still lead toward the outcome you need.",
    label: "Law 31"
  },
  {
    text: "People respond to the stories they already want to believe.",
    label: "Law 32"
  },
  {
    text: "Find the real motive; that is where influence begins.",
    label: "Law 33"
  },
  {
    text: "Carry yourself with dignity and others adjust their expectations.",
    label: "Law 34"
  },
  {
    text: "Timing changes everything; patience can be a form of power.",
    label: "Law 35"
  },
  {
    text: "What you chase too openly becomes harder to hold.",
    label: "Law 36"
  },
  {
    text: "Create memorable moments; people remember symbols more than data.",
    label: "Law 37"
  },
  {
    text: "Think independently, but choose when to reveal the difference.",
    label: "Law 38"
  },
  {
    text: "Disturbing emotions can expose hidden positions.",
    label: "Law 39"
  },
  {
    text: "Free offers often carry invisible costs.",
    label: "Law 40"
  },
  {
    text: "Respect the past, but do not live inside another person's shadow.",
    label: "Law 41"
  },
  {
    text: "Address the key source of disorder, not only its symptoms.",
    label: "Law 42"
  },
  {
    text: "Influence begins with hearts and minds before rules and pressure.",
    label: "Law 43"
  },
  {
    text: "Mirror others carefully; reflection can disarm or unsettle.",
    label: "Law 44"
  },
  {
    text: "Lead change gradually; people defend familiar ground.",
    label: "Law 45"
  },
  {
    text: "Perfect images invite attack; show enough humanity to stay trusted.",
    label: "Law 46"
  },
  {
    text: "Know when to stop; victory can turn costly after the peak.",
    label: "Law 47"
  },
  {
    text: "Stay adaptable; fixed shapes break under changing pressure.",
    label: "Law 48"
  }
];

function getFooterQuoteIndex() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((now - start) / 86_400_000) + 1;
  return dayOfYear % FOOTER_QUOTES.length;
}

function renderFooterQuote(section, quote) {
  section.classList.add("footer-quote");
  section.setAttribute("aria-label", "Daily The 48 Laws of Power reflection by Robert Greene");
  section.replaceChildren();

  const label = document.createElement("p");
  label.className = "footer-quote-label";
  label.textContent = quote.label;

  const blockquote = document.createElement("blockquote");
  blockquote.textContent = `"${quote.text}"`;

  const byline = document.createElement("p");
  byline.className = "footer-quote-by";
  byline.textContent = "The 48 Laws of Power by Robert Greene - Daily Reflection";

  section.append(label, blockquote, byline);
}

function initDynamicQuoteBand() {
  const footer = document.querySelector(".site-footer");
  if (!footer) return;

  const quote = FOOTER_QUOTES[getFooterQuoteIndex()];
  const section = document.createElement("section");
  renderFooterQuote(section, quote);
  footer.parentNode.insertBefore(section, footer);
}

/* ======================================================
   GLOBAL PRO FOOTER ENHANCEMENT
====================================================== */

const FOOTER_GROUP_SIZE = 9;

const FOOTER_EXTERNAL_LINKS = {
  "Start Here": [
    { href: "https://en.wikipedia.org/wiki/Amitabh_Bachchan", label: "Wikipedia", note: "Reference-style knowledge hub" },
    { href: "https://news.google.com/topstories?hl=en-IN&gl=IN&ceid=IN:en", label: "Top News", note: "Current headlines in India" },
    { href: "https://www.bbc.com/news/world/asia/india", label: "India News", note: "BBC world coverage" },
    { href: "https://www.timeanddate.com/worldclock/india", label: "India Time", note: "Current time and calendar" },
    { href: "https://www.google.com/search?q=weather+Bhagalpur", label: "Weather", note: "Bhagalpur forecast" },
    { href: "https://www.google.com/maps/place/Bhagalpur,+Bihar", label: "Map", note: "Bhagalpur on Google Maps" },
    { href: "https://trends.google.com/trends/explore?geo=IN", label: "Trends", note: "What people search in India" },
    { href: "https://www.youtube.com/results?search_query=digital+identity+india", label: "Video Search", note: "Digital identity videos" },
    { href: "https://www.reddit.com/search/?q=digital%20identity%20india", label: "Discussions", note: "Public conversations" }
  ],
  "HI Ecosystem": [
    { href: "https://en.wikipedia.org/wiki/Digital_identity", label: "Digital Identity", note: "Wikipedia concept overview" },
    { href: "https://www.w3.org/TR/did-core/", label: "DID Standard", note: "W3C decentralized identity" },
    { href: "https://en.wikipedia.org/wiki/Digital_wallet", label: "Digital Wallet", note: "Wallet concept reference" },
    { href: "https://en.wikipedia.org/wiki/Blockchain", label: "Blockchain", note: "Distributed ledger basics" },
    { href: "https://www.coindesk.com/", label: "CoinDesk", note: "Crypto and token news" },
    { href: "https://www.technologyreview.com/", label: "MIT Tech Review", note: "Technology analysis" },
    { href: "https://www.producthunt.com/", label: "Product Hunt", note: "New tools and products" },
    { href: "https://github.com/topics/digital-identity", label: "GitHub Topics", note: "Open-source identity projects" },
    { href: "https://www.npci.org.in/what-we-do/upi/product-overview", label: "UPI", note: "India payment infrastructure" }
  ],
  "Identity": [
    { href: "https://en.wikipedia.org/wiki/Bhagalpur", label: "Bhagalpur", note: "City reference and history" },
    { href: "https://en.wikipedia.org/wiki/Bihar", label: "Bihar", note: "State reference and context" },
    { href: "https://www.britannica.com/place/Bhagalpur", label: "Britannica", note: "Bhagalpur reference" },
    { href: "https://tourism.bihar.gov.in/", label: "Bihar Tourism", note: "Official tourism portal" },
    { href: "https://www.google.com/search?q=Bhagalpur+news", label: "Local News", note: "Bhagalpur latest updates" },
    { href: "https://www.google.com/search?q=Bhagalpur+weather", label: "Local Weather", note: "Bhagalpur forecast" },
    { href: "https://www.openstreetmap.org/search?query=Bhagalpur", label: "OpenStreetMap", note: "Open map reference" },
    { href: "https://archive.org/", label: "Archive", note: "Public digital archive" },
    { href: "https://creativecommons.org/licenses/by-nc-nd/4.0/", label: "CC License", note: "License terms reference" }
  ],
  "Work With Me": [
    { href: "https://www.startupindia.gov.in/", label: "Startup India", note: "Official startup portal" },
    { href: "https://www.mca.gov.in/", label: "MCA India", note: "Company registry portal" },
    { href: "https://www.india.gov.in/", label: "India Portal", note: "Government services index" },
    { href: "https://www.reuters.com/business/", label: "Business News", note: "Reuters business coverage" },
    { href: "https://hbr.org/", label: "HBR", note: "Business and leadership ideas" },
    { href: "https://www.shopify.com/blog", label: "Commerce Ideas", note: "Store and business learning" },
    { href: "https://developers.google.com/search/docs", label: "SEO Docs", note: "Google search guidance" },
    { href: "https://pagespeed.web.dev/", label: "PageSpeed", note: "Check website performance" },
    { href: "https://www.canva.com/", label: "Canva", note: "Design and content tool" }
  ]
};

function normalizeFooterPath(href) {
  const url = new URL(href, window.location.origin);
  const path = (url.pathname.replace(/\/$/, "") || "/").replace(/\.html$/, "");
  if (url.origin !== window.location.origin) return url.origin + path + url.search;
  return path;
}

function isExternalFooterLink(href) {
  return new URL(href, window.location.origin).origin !== window.location.origin;
}

function isFooterLinkActive(href) {
  const current = (window.location.pathname.replace(/\/$/, "") || "/").replace(/\.html$/, "");
  const target = normalizeFooterPath(href);
  if (target === "/") return current === "/" || current === "/index";
  return current === target || current.startsWith(target + "/");
}

function getCurrentHeaderLinks() {
  const nav =
    document.querySelector("[data-nav]") ||
    document.querySelector("header nav[aria-label='Main navigation']") ||
    document.querySelector(".personal-header nav, .header-inner nav");
  const anchors = nav ? Array.from(nav.querySelectorAll("a[href]")) : [];
  const links = anchors
    .map(a => ({
      href: a.getAttribute("href"),
      label: a.textContent.replace(/\s+/g, " ").trim()
    }))
    .filter(link => link.href && link.label && !link.href.startsWith("#"));

  return links;
}

function getFooterContext() {
  const nav = document.querySelector("[data-nav]");
  const navType = nav ? nav.getAttribute("data-nav") : "";
  const path = window.location.pathname;
  const personalPrefixes = [
    "/pages/personal",
    "/pages/dashboard",
    "/pages/about",
    "/pages/origin",
    "/pages/haven",
    "/pages/bhagalpur",
    "/pages/hi-license",
    "/pages/wallet",
    "/pages/vault",
    "/pages/merchant",
    "/wallet/marketplace"
  ];

  if (navType === "personal" || personalPrefixes.some(prefix => path.startsWith(prefix))) {
    return "personal";
  }

  return "public";
}

function removeFooterDuplicates(links, hiddenPaths) {
  return links.filter(link => !hiddenPaths.has(normalizeFooterPath(link.href)));
}

function fillFooterGroupLinks(title, links, hiddenPaths) {
  const filtered = removeFooterDuplicates(links, hiddenPaths);
  const used = new Set(filtered.map(link => normalizeFooterPath(link.href)));
  const fillers = FOOTER_EXTERNAL_LINKS[title] || [];

  fillers.some(link => {
    const key = normalizeFooterPath(link.href);
    if (!used.has(key)) {
      filtered.push(link);
      used.add(key);
    }

    return filtered.length >= FOOTER_GROUP_SIZE;
  });

  return filtered.slice(0, FOOTER_GROUP_SIZE);
}

function orderFooterGroups(groups, context) {
  const order = context === "personal"
    ? ["Start Here", "Work With Me", "Identity", "HI Ecosystem"]
    : ["HI Ecosystem", "Identity", "Work With Me", "Start Here"];
  const rank = new Map(order.map((title, index) => [title, index]));
  return groups.slice().sort((a, b) => rank.get(a.title) - rank.get(b.title));
}

function createFooterLink(href, label, note) {
  const a = document.createElement("a");
  a.href = href;

  if (isExternalFooterLink(href)) {
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.classList.add("is-external");
  }

  if (isFooterLinkActive(href)) {
    a.classList.add("is-active");
    a.setAttribute("aria-current", "page");
  }

  const text = document.createElement("span");
  text.textContent = label;
  a.appendChild(text);

  if (note) {
    const small = document.createElement("small");
    small.textContent = note;
    a.appendChild(small);
  }

  return a;
}

function createFooterGroup(title, links) {
  const group = document.createElement("nav");
  group.className = "footer-pro-group";
  group.setAttribute("aria-label", title);

  const h = document.createElement("h3");
  h.textContent = title;

  const list = document.createElement("div");
  list.className = "footer-pro-links";
  links.forEach(link => list.appendChild(createFooterLink(link.href, link.label, link.note)));

  group.append(h, list);
  return group;
}

function initProFooter() {
  const footers = document.querySelectorAll(".site-footer");
  if (!footers.length) return;

  const footerContext = getFooterContext();
  const hiddenPaths = new Set(getCurrentHeaderLinks().map(link => normalizeFooterPath(link.href)));
  hiddenPaths.add(normalizeFooterPath(window.location.href));

  const groups = orderFooterGroups([
    {
      title: "Start Here",
      links: [
        { href: "/", label: "Home", note: "Main profile and gateway" },
        { href: "/pages/professional.html", label: "Professional", note: "Career and public profile" },
        { href: "/pages/social.html", label: "Social", note: "Official channels and updates" },
        { href: "/pages/live-class.html", label: "Live Class", note: "Classes, sessions, and access" },
        { href: "/pages/blog.html", label: "Blog", note: "Essays, systems, and ideas" },
        { href: "/pages/gallery.html", label: "Gallery", note: "Visual proof and archive" }
      ]
    },
    {
      title: "HI Ecosystem",
      links: [
        { href: "/pages/personal.html", label: "HI Life OS", note: "Private command center" },
        { href: "/pages/dashboard.html", label: "Dashboard", note: "Manage core HI tools" },
        { href: "/wallet/wallet.html", label: "HI Wallet", note: "Human identity wallet" },
        { href: "/wallet/vault.html", label: "HI Vault", note: "Protected digital backup" },
        { href: "/wallet/merchant.html", label: "Merchant", note: "Payment and merchant layer" },
        { href: "/wallet/marketplace/", label: "Marketplace", note: "Service economy gateway" },
        { href: "/pages/login?next=%2Fpages%2Fpersonal.html", label: "Login / Setup", note: "Access or create workspace" },
        { href: "/wallet/", label: "Digital Coin", note: "Public coin movement page" },
        { href: "/wallet/coin.html", label: "HI Coin", note: "Coin concept and roadmap" }
      ]
    },
    {
      title: "Identity",
      links: [
        { href: "/pages/about.html", label: "About Me", note: "Profile, work, and identity" },
        { href: "/pages/origin.html", label: "Origin", note: "Roots and personal story" },
        { href: "/pages/haven.html", label: "Haven", note: "Private foundation page" },
        { href: "/pages/bhagalpur.html", label: "Bhagalpur", note: "Local identity and presence" },
        { href: "/pages/hi-license.html", label: "License", note: "Ownership and license proof" },
        { href: "/verify/", label: "Verify", note: "Check public certificate" },
        { href: "/claim/", label: "Claim", note: "Report misuse or violation" }
      ]
    },
    {
      title: "Work With Me",
      links: [
        { href: "/pages/services.html", label: "Services", note: "See available services" },
        { href: "/pages/contact.html", label: "Contact", note: "Send a direct enquiry" },
        { href: "/pages/collaboration.html", label: "Collaboration", note: "Build or partner together" },
        { href: "/pages/order.html", label: "Order", note: "Start a purchase request" },
        { href: "/brands/royal-heritage-resort.html", label: "Royal Heritage", note: "Hospitality brand page" },
        { href: "/brands/national-youth-force.html", label: "National Youth Force", note: "Community brand page" },
        { href: "/brands/jhon-aamit-llp.html", label: "Jhon Aamit LLP", note: "Business brand page" }
      ]
    }
  ].map(group => ({
    title: group.title,
    links: fillFooterGroupLinks(group.title, group.links, hiddenPaths)
  })).filter(group => group.links.length), footerContext);

  footers.forEach(footer => {
    if (footer.querySelector(".footer-pro")) return;

    const section = document.createElement("section");
    section.className = "footer-pro";
    section.setAttribute("aria-label", "Explore important website links");

    const grid = document.createElement("div");
    grid.className = "footer-pro-grid";
    groups.forEach(group => grid.appendChild(createFooterGroup(group.title, group.links)));

    section.append(grid);

    const bottom = footer.querySelector(".footer-bottom");
    if (bottom) footer.insertBefore(section, bottom);
    else footer.appendChild(section);
  });
}

/* ======================================================
   SOCIAL LINKS (inline SVG — no external CDN dependency)
====================================================== */

function loadSocials() {
  const box = $("socialLinks");
  if (!box) return;

  const links = [
    { name: "Facebook",  url: "https://www.facebook.com/kingofyadav.in" },
    { name: "Instagram", url: "https://www.instagram.com/kingofyadav.in" },
    { name: "YouTube",   url: "https://www.youtube.com/@kingofyadav-youtube" },
    { name: "GitHub",    url: "https://github.com/kingofyadav" }
  ];

  box.innerHTML = links
    .map(({ name, url }) => `
      <a href="${escHtml(url)}" target="_blank" rel="noopener noreferrer" aria-label="${escHtml(name)}">
        ${getSVGIcon(name)}
      </a>`)
    .join("");
}

function getSVGIcon(name) {
  const icons = {
    Facebook: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`,
    Instagram: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>`,
    YouTube: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,
    GitHub: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>`
  };
  return icons[name] || "";
}

/* ======================================================
   HAMBURGER MENU
====================================================== */

function initHamburger() {
  const btn = $("hamburger");
  if (!btn) return;

  const nav = btn.nextElementSibling?.tagName === "NAV"
    ? btn.nextElementSibling
    : document.querySelector(".site-header nav, .personal-header nav");

  if (!nav) return;
  if (!nav.getAttribute("aria-label")) nav.setAttribute("aria-label", "Main navigation");

  function close() {
    btn.classList.remove("open");
    nav.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
  }

  btn.addEventListener("click", e => {
    e.stopPropagation();
    const opening = !btn.classList.contains("open");
    btn.classList.toggle("open", opening);
    nav.classList.toggle("open", opening);
    btn.setAttribute("aria-expanded", String(opening));
  });

  nav.querySelectorAll("a").forEach(link => link.addEventListener("click", close));

  document.addEventListener("click", e => {
    if (!btn.contains(e.target) && !nav.contains(e.target)) close();
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") close();
  });

  window.addEventListener("resize", () => {
    if (btn.classList.contains("open")) close();
  });
}

/* ======================================================
   MOBILE HEADER AUTO HIDE
====================================================== */

function initMobileHeader() {
  let lastScroll = 0;

  window.addEventListener("scroll", () => {
    if (window.innerWidth > 768) return;

    const header = document.querySelector(".site-header, .personal-header");
    if (!header) return;
    if (header.querySelector(".hamburger.open, nav.open")) return;

    const current = window.scrollY;
    header.classList.toggle("hide", current > lastScroll && current > 100);
    lastScroll = current;
  }, { passive: true });
}

/* ======================================================
   SCROLL REVEAL (INTERSECTION OBSERVER)
====================================================== */

function initScrollReveal() {
  const elements = document.querySelectorAll(
    ".life-card, .service-card, .blog-card, .connect-card, " +
    ".contact-library-item, .pro-value-card, .pro-card, " +
    ".hosting-card, .city-card, .timeline li, .page-intro, " +
    ".personal-section, .city-section, .capability-statement, " +
    ".pro-stats, .services-library-item, .partner-card"
  );
  if (!elements.length) return;

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("active");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0, rootMargin: "0px 0px -40px 0px" }
  );

  /* Group siblings inside same parent for stagger */
  const seen = new Map();
  elements.forEach(el => {
    const parent = el.parentElement;
    const count = seen.get(parent) ?? 0;
    el.classList.add("reveal", `delay-${count % 4}`);
    seen.set(parent, count + 1);
    observer.observe(el);
  });
}

/* ======================================================
   ANIMATED COUNTERS (pro stats)
====================================================== */

function initCounters() {
  const seen  = new Set();
  const stats = [...document.querySelectorAll(".pro-stat-num, [data-count]")]
    .filter(el => { if (seen.has(el)) return false; seen.add(el); return true; });
  if (!stats.length) return;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      observer.unobserve(el);

      const useAttr = el.dataset.count !== undefined;
      const target  = useAttr
        ? parseInt(el.dataset.count, 10)
        : parseInt(([...el.childNodes].find(n => n.nodeType === 3) ?? {}).textContent ?? "0", 10);
      const suffix = el.dataset.countSuffix ?? "";
      if (isNaN(target)) return;

      let start = null;
      const tick = ts => {
        if (!start) start = ts;
        const p = Math.min((ts - start) / 1400, 1);
        const v = Math.round((1 - Math.pow(1 - p, 3)) * target);
        if (useAttr) {
          el.textContent = v + suffix;
        } else {
          const textNode = [...el.childNodes].find(n => n.nodeType === 3);
          if (textNode) textNode.textContent = v;
        }
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.5 });

  stats.forEach(el => observer.observe(el));
}

/* ======================================================
   HERO PARALLAX (THROTTLED)
====================================================== */

function initParallax() {
  const hero = document.querySelector(".hero-pro");
  if (!hero) return;

  let ticking = false;

  window.addEventListener("scroll", () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        hero.style.backgroundPositionY = `${window.scrollY * 0.3}px`;
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
}

/* ======================================================
   GLOBAL CLICK DELEGATION
====================================================== */

function initGlobalClickHandler() {
  document.addEventListener("click", e => {
    const card = e.target.closest(
      ".post-card, .youtube-card, .instagram-card, .facebook-post, .youtube-post"
    );
    if (!card) return;

    const link = card.dataset.link;
    const video = card.dataset.video;

    if (link) {
      window.open(link, "_blank");
    } else if (video) {
      window.open(`https://www.youtube.com/watch?v=${video}`, "_blank");
    }
  });
}

/* ======================================================
   PWA (ROOT SAFE + UPDATE HANDLING)
====================================================== */

function initServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register(
        "/service-worker.js",
        { scope: "/" }
      );
      reg.update().catch(() => {});

      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (
            newWorker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            showSWUpdateBanner(reg);
          }
        });
      });
    } catch {}
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    window.location.reload();
  });
}

function showSWUpdateBanner(reg) {
  if ($("swUpdateBanner")) return;

  const banner = document.createElement("div");
  banner.id = "swUpdateBanner";
  banner.className = "sw-update-banner";
  banner.innerHTML = `
    <span>New version available.</span>
    <div>
      <button id="swLater">Later</button>
      <button id="swRefresh">Refresh</button>
    </div>
  `;

  document.body.appendChild(banner);

  $("swLater")?.addEventListener("click", () => banner.remove());
  $("swRefresh")?.addEventListener("click", () => {
    if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
  });
}

/* ======================================================
   PWA INSTALL PROMPT
====================================================== */

let _installEvent = null;
const _installDismissKey = "pwa_install_dismissed_v1";

function initInstallPrompt() {
  if (localStorage.getItem(_installDismissKey)) return;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    _installEvent = e;
    const bar = document.getElementById("pwaInstallBar");
    if (bar) bar.hidden = false;
  });

  window.addEventListener("appinstalled", () => {
    _installEvent = null;
    const bar = document.getElementById("pwaInstallBar");
    if (bar) bar.hidden = true;
  });
}

function triggerInstallPrompt() {
  if (!_installEvent) return;
  _installEvent.prompt();
  _installEvent.userChoice.then(() => {
    _installEvent = null;
    const bar = document.getElementById("pwaInstallBar");
    if (bar) bar.hidden = true;
  }).catch(() => {
    _installEvent = null;
  });
}

function dismissInstallBar() {
  const bar = document.getElementById("pwaInstallBar");
  if (bar) bar.hidden = true;
  localStorage.setItem(_installDismissKey, "1");
}

/* ======================================================
   CONTACT FORM (Formspree)
====================================================== */

function initContactForm() {
  const form      = document.getElementById("contactForm");
  if (!form) return;

  const submitBtn = document.getElementById("cf-submit");
  const status    = document.getElementById("cf-status");
  const formId    = form.dataset.formspreeId;

  if (!formId) {
    console.warn("Contact form: missing data-formspree-id attribute.");
    if (submitBtn) submitBtn.disabled = true;
    return;
  }

  const RULES = {
    "cf-name":    { label: "Full Name",  minLen: 2 },
    "cf-email":   { label: "Email",      email: true },
    "cf-subject": { label: "Subject",    minLen: 3 },
    "cf-message": { label: "Message",    minLen: 20 },
  };

  function getOrCreateError(input) {
    let el = input.parentElement.querySelector(".field-error");
    if (!el) {
      el = document.createElement("span");
      el.className = "field-error";
      el.setAttribute("aria-live", "polite");
      input.parentElement.appendChild(el);
    }
    return el;
  }

  function validateField(input) {
    const rule = RULES[input.id];
    if (!rule) return true;
    const val = input.value.trim();
    let error = "";
    if (!val) {
      error = `${rule.label} is required.`;
    } else if (rule.minLen && val.length < rule.minLen) {
      error = `${rule.label} must be at least ${rule.minLen} characters.`;
    } else if (rule.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      error = "Please enter a valid email address.";
    }
    const errEl = getOrCreateError(input);
    errEl.textContent = error;
    input.classList.toggle("field-invalid", !!error);
    return !error;
  }

  Object.keys(RULES).forEach(id => {
    const input = document.getElementById(id);
    if (!input) return;
    input.addEventListener("blur",  () => validateField(input));
    input.addEventListener("input", () => { if (input.classList.contains("field-invalid")) validateField(input); });
  });

  form.addEventListener("submit", async e => {
    e.preventDefault();

    const inputs = Object.keys(RULES).map(id => document.getElementById(id)).filter(Boolean);
    const allValid = inputs.map(validateField).every(Boolean);
    if (!allValid) {
      (inputs.find(el => el.classList.contains("field-invalid")) ?? inputs[0])?.focus();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";
    status.textContent = "";
    status.className = "form-status";

    try {
      const res = await fetch(`https://formspree.io/f/${formId}`, {
        method: "POST",
        headers: { "Accept": "application/json" },
        body: new FormData(form),
      });

      if (res.ok) {
        form.classList.add("contact-form--success");
        status.className = "form-status success";
        status.innerHTML = '<span class="cf-success-icon" aria-hidden="true">✓</span> Message sent! I\'ll reply within 24–48 hours.';
        form.reset();
        inputs.forEach(el => el.classList.remove("field-invalid"));
        submitBtn.textContent = "Sent ✓";
        setTimeout(() => {
          form.classList.remove("contact-form--success");
          submitBtn.disabled = false;
          submitBtn.textContent = "Send Message";
          status.textContent = "";
          status.className = "form-status";
        }, 5000);
      } else {
        const data = await res.json().catch(() => ({}));
        status.textContent = data.error || "Something went wrong. Please email directly.";
        status.className = "form-status error";
        submitBtn.disabled = false;
        submitBtn.textContent = "Send Message";
      }
    } catch {
      status.textContent = "Network error. Please email kingofyadav.in@gmail.com";
      status.className = "form-status error";
      submitBtn.disabled = false;
      submitBtn.textContent = "Send Message";
    }
  });
}

/* =====================================================
   GLOBAL ENQUIRY SYSTEM
===================================================== */

function openEnquiry() {
  document.body.classList.add("enquiry-active");
}

function closeEnquiry() {
  document.body.classList.remove("enquiry-active");
}

function initEnquiryForm() {
  const form = document.getElementById("enquiryForm");
  if (!form) return;

  form.addEventListener("submit", async e => {
    e.preventDefault();

    const formData = {
      name:    form.name.value,
      email:   form.email.value,
      subject: form.subject.value,
      message: form.message.value,
    };

    try {
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      const response = await fetch("https://formspree.io/f/xwvaodjy", {
        method:  "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body:    JSON.stringify(formData),
      });

      if (response.ok) {
        if (submitBtn) submitBtn.textContent = "Sent ✓";
        setTimeout(() => {
          form.reset();
          closeEnquiry();
          if (submitBtn) { submitBtn.textContent = "Send Message"; submitBtn.disabled = false; }
        }, 2_000);
      } else {
        if (submitBtn) { submitBtn.textContent = "Failed. Email directly."; submitBtn.disabled = false; }
      }
    } catch {
      const errBtn = form.querySelector('button[type="submit"]');
      if (errBtn) { errBtn.textContent = "Error. Email directly."; errBtn.disabled = false; }
    }
  });
}
/* ======================================================
   SCROLL PROGRESS BAR
====================================================== */

function initScrollProgress() {
  const bar = document.getElementById("scrollProgress");
  if (!bar) return;

  window.addEventListener("scroll", () => {
    const scrolled = window.scrollY;
    const total = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = total > 0 ? (scrolled / total * 100) + "%" : "0%";
  }, { passive: true });
}

/* ======================================================
   BACK TO TOP
====================================================== */

function initBackToTop() {
  const btn = document.getElementById("backToTop");
  if (!btn) return;

  window.addEventListener("scroll", () => {
    btn.classList.toggle("visible", window.scrollY > 400);
  }, { passive: true });

  btn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

/* ======================================================
   HOME BLOG PREVIEW (latest 3 from blog-data.json)
====================================================== */

async function initHomeBlogPreview() {
  const grid = document.getElementById("home-blog-preview");
  if (!grid) return;

  let posts = null;
  for (const path of ["/blog-data.json", "blog-data.json"]) {
    try {
      const res = await fetch(path);
      if (res.ok) { posts = await res.json(); break; }
    } catch { /* try next */ }
  }

  if (!posts || !posts.length) {
    grid.innerHTML = `<p style="opacity:0.5;text-align:center;grid-column:1/-1;padding:2rem;">No articles found.</p>`;
    return;
  }

  grid.innerHTML = posts.slice(0, 3).map(post => `
    <a href="${escHtml(post.url)}" class="life-card glass">
      <span class="blog-category">${escHtml(post.category)}</span>
      <h3>${escHtml(post.title)}</h3>
      <p>${escHtml(post.excerpt)}</p>
      <span class="life-action">Read →</span>
    </a>
  `).join("");
}

/* ======================================================
   BLOG RENDERER (from blog-data.json)
====================================================== */

function formatDate(dateStr) {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const [year, month, day] = dateStr.split("-");
  return `${parseInt(day)} ${months[parseInt(month) - 1]} ${year}`;
}

async function initBlogRenderer() {
  const grid = document.getElementById("blog-dynamic-grid");
  if (!grid) return;

  /* Static cards are already in the HTML for SEO and Google Translate support.
     Just apply the stagger animation and return. */
  if (grid.children.length > 0) {
    grid.querySelectorAll(".blog-card--in").forEach((el, i) => {
      el.style.animationDelay = `${i * 60}ms`;
    });
    return;
  }

  /* Fallback: render dynamically on pages that don't have static cards. */
  const jsonPaths = ["../blog-data.json", "/blog-data.json", "blog-data.json"];
  let posts = null;
  for (const path of jsonPaths) {
    try {
      const res = await fetch(path);
      if (res.ok) { posts = await res.json(); break; }
    } catch { /* try next path */ }
  }

  if (!posts || !posts.length) {
    grid.innerHTML = `<p style="opacity:0.5;text-align:center;grid-column:1/-1;padding:2rem;">No articles found.</p>`;
    return;
  }

  grid.innerHTML = posts.map(post => `
    <article class="blog-card blog-card--in">
      <img src="${escHtml(post.image)}" alt="${escHtml(post.title)}" loading="lazy" width="640" height="360">
      <div class="blog-card-content">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <span class="blog-category">${escHtml(post.category)}</span>
          <time style="font-size:0.72rem;opacity:0.45;font-weight:500;letter-spacing:0.3px;">${escHtml(formatDate(post.date))}</time>
        </div>
        <h3>${escHtml(post.title)}</h3>
        <p>${escHtml(post.excerpt)}</p>
        <a href="${escHtml(post.url)}" class="blog-read">Read Article →</a>
      </div>
    </article>
  `).join("");

  grid.querySelectorAll(".blog-card--in").forEach((el, i) => {
    el.style.animationDelay = `${i * 60}ms`;
  });
}

/* ======================================================
   JARVIS TRANSLATOR  —  powered by Jarvis AI (no Google)
====================================================== */

const JARVIS_TRANSLATE_KEY   = "jarvis_translate_language_v1";
const JARVIS_TRANSLATE_CACHE = "jarvis_translate_cache_v1";
const JARVIS_TRANSLATE_ENDPOINT = "/api/jarvis-chat";
const JARVIS_TRANSLATE_SEP   = "|||";

const JARVIS_TRANSLATE_LANGUAGES = [
  { code: "",      label: "English - Original" },
  { code: "Hindi", label: "India - Hindi" },
  { code: "Bengali", label: "Bangladesh / India - Bengali" },
  { code: "Urdu",  label: "Pakistan - Urdu" },
  { code: "Nepali", label: "Nepal - Nepali" },
  { code: "Tamil", label: "India / Sri Lanka - Tamil" },
  { code: "Telugu", label: "India - Telugu" },
  { code: "Marathi", label: "India - Marathi" },
  { code: "Gujarati", label: "India - Gujarati" },
  { code: "Punjabi", label: "India - Punjabi" },
  { code: "Arabic", label: "Middle East - Arabic" },
  { code: "French", label: "France - French" },
  { code: "German", label: "Germany - German" },
  { code: "Spanish", label: "Spain / Latin America - Spanish" },
  { code: "Portuguese", label: "Brazil / Portugal - Portuguese" },
  { code: "Italian", label: "Italy - Italian" },
  { code: "Russian", label: "Russia - Russian" },
  { code: "Chinese Simplified", label: "China - Chinese Simplified" },
  { code: "Japanese", label: "Japan - Japanese" },
  { code: "Korean",  label: "South Korea - Korean" },
  { code: "Indonesian", label: "Indonesia - Indonesian" },
  { code: "Malay",  label: "Malaysia - Malay" },
  { code: "Thai",   label: "Thailand - Thai" },
  { code: "Vietnamese", label: "Vietnam - Vietnamese" },
  { code: "Turkish", label: "Turkey - Turkish" }
];

/* ── Reading time ────────────────────────────────────── */

function calcReadingTime(el) {
  const text = el ? (el.innerText || el.textContent || "") : "";
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const mins = Math.max(1, Math.round(words / 200));
  return `${mins} min read`;
}

function initReadingTime() {
  const article = document.getElementById("article");
  if (!article) return;
  const rt = calcReadingTime(article);
  article.querySelectorAll("span").forEach(span => {
    if (/\d+\s*min\s*read/i.test(span.textContent)) span.textContent = rt;
  });
}

/* ── Translator init ──────────────────────────────────── */

function initJarvisTranslator() {
  const blogPage = document.getElementById("blog-dynamic-grid");
  const article  = document.getElementById("article");
  if (!blogPage && !article) return;

  let select = document.getElementById("jarvisTranslateSelect");
  if (!select && article) select = injectArticleTranslator();
  if (!select) return;

  populateJarvisLanguages(select);

  let saved = "";
  try { saved = localStorage.getItem(JARVIS_TRANSLATE_KEY) || ""; } catch {}
  select.value = saved;
  updateJarvisTranslateStatus(saved ? "Translated · switch to English to reset." : "");
  if (saved && article) _jarvisApplyCached(saved);

  select.addEventListener("change", () => {
    const lang = select.value;
    try { localStorage.setItem(JARVIS_TRANSLATE_KEY, lang); } catch {}
    if (!lang) {
      _jarvisRestoreOriginal();
      updateJarvisTranslateStatus("");
      return;
    }
    if (article) jarvisTranslateArticle(lang);
    else if (blogPage) jarvisTranslateBlogList(lang);
  });
}

function injectArticleTranslator() {
  const sidebar = document.querySelector(".elite-sidebar");
  if (!sidebar) return null;

  const panel = document.createElement("section");
  panel.className = "jarvis-translator jarvis-translator-sidebar glass";
  panel.setAttribute("aria-label", "Jarvis AI language translator");
  panel.innerHTML = `
    <div class="jarvis-translator-copy">
      <span>Jarvis AI Translator</span>
      <h3>Read this article in your language.</h3>
    </div>
    <label class="jarvis-translator-control">
      <span>Country / Language</span>
      <select id="jarvisTranslateSelect" aria-label="Select language">
        <option value="">English - Original</option>
      </select>
      <small id="jarvisTranslateStatus" aria-live="polite"></small>
    </label>
  `;
  sidebar.appendChild(panel);
  return panel.querySelector("select");
}

function populateJarvisLanguages(select) {
  select.innerHTML = JARVIS_TRANSLATE_LANGUAGES.map(({ code, label }) =>
    `<option value="${code}">${label}</option>`
  ).join("");
}

function updateJarvisTranslateStatus(msg) {
  const el = document.getElementById("jarvisTranslateStatus");
  if (el) el.textContent = msg;
}

/* ── Core translation engine ─────────────────────────── */

async function jarvisTranslateArticle(lang) {
  const article = document.getElementById("article");
  if (!article) return;

  const cacheKey = `${JARVIS_TRANSLATE_CACHE}:${location.pathname}:${lang}`;
  const cached = _jarvisGetCache(cacheKey);
  if (cached) {
    _jarvisApplyTranslation(cached);
    updateJarvisTranslateStatus(`Translated to ${lang}.`);
    return;
  }

  const nodes = _jarvisGetTranslatableNodes(article);
  if (!nodes.length) return;

  updateJarvisTranslateStatus(`Translating to ${lang}…`);

  _jarvisSaveOriginal(nodes);

  const texts = nodes.map(n => (n.textContent || "").trim().replace(/\s+/g, " "));
  const BATCH = 8;
  const results = [];

  for (let i = 0; i < texts.length; i += BATCH) {
    const slice = texts.slice(i, i + BATCH);
    const done  = Math.min(i + BATCH, texts.length);
    updateJarvisTranslateStatus(`Translating ${done}/${texts.length}…`);
    const translated = await _jarvisTranslateBatch(slice, lang);
    results.push(...translated);
  }

  const map = {};
  nodes.forEach((n, i) => { map[i] = results[i] || texts[i]; });
  _jarvisApplyTranslation(map);
  _jarvisSetCache(cacheKey, map);
  updateJarvisTranslateStatus(`Translated to ${lang}. Select English to reset.`);
}

async function jarvisTranslateBlogList(lang) {
  const grid = document.getElementById("blog-dynamic-grid");
  if (!grid) return;

  const cacheKey = `${JARVIS_TRANSLATE_CACHE}:blog-list:${lang}`;
  const cached = _jarvisGetCache(cacheKey);
  if (cached) {
    _jarvisBlogListApply(cached);
    updateJarvisTranslateStatus(`Translated to ${lang}.`);
    return;
  }

  const cards = Array.from(grid.querySelectorAll(".blog-card"));
  if (!cards.length) return;

  updateJarvisTranslateStatus(`Translating to ${lang}…`);

  const nodes = [];
  cards.forEach(card => {
    const h3 = card.querySelector("h3");
    const p  = card.querySelector("p");
    if (h3) nodes.push(h3);
    if (p)  nodes.push(p);
  });

  nodes.forEach(n => { if (!n.dataset.jarvisOriginal) n.dataset.jarvisOriginal = n.textContent; });

  const texts = nodes.map(n => n.textContent.trim().replace(/\s+/g, " "));
  const BATCH = 8;
  const results = [];

  for (let i = 0; i < texts.length; i += BATCH) {
    const done = Math.min(i + BATCH, texts.length);
    updateJarvisTranslateStatus(`Translating ${done}/${texts.length}…`);
    const translated = await _jarvisTranslateBatch(texts.slice(i, i + BATCH), lang);
    results.push(...translated);
  }

  const map = {};
  nodes.forEach((n, i) => { map[i] = results[i] || texts[i]; });
  _jarvisBlogListApply(map);
  _jarvisSetCache(cacheKey, map);
  updateJarvisTranslateStatus(`Translated to ${lang}. Select English to reset.`);
}

function _jarvisBlogListApply(map) {
  const grid = document.getElementById("blog-dynamic-grid");
  if (!grid) return;
  const cards = Array.from(grid.querySelectorAll(".blog-card"));
  const nodes = [];
  cards.forEach(card => {
    const h3 = card.querySelector("h3");
    const p  = card.querySelector("p");
    if (h3) nodes.push(h3);
    if (p)  nodes.push(p);
  });
  nodes.forEach((n, i) => { if (map[i] !== undefined) n.textContent = map[i]; });
}

async function _jarvisTranslateBatch(texts, lang) {
  const joined = texts.join(JARVIS_TRANSLATE_SEP);
  const prompt = `Translate each segment to ${lang}. Return ONLY the translated segments in the same order, separated by ${JARVIS_TRANSLATE_SEP}. No explanations, no numbering.\n\n${joined}`;

  try {
    const res = await fetch(JARVIS_TRANSLATE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: prompt })
    });
    const data = await res.json();
    const reply = (data.reply || "").trim();
    const parts = reply.split(JARVIS_TRANSLATE_SEP).map(s => s.trim());
    if (parts.length === texts.length) return parts;
    return texts;
  } catch {
    return texts;
  }
}

/* ── DOM helpers ─────────────────────────────────────── */

function _jarvisGetTranslatableNodes(article) {
  return Array.from(
    article.querySelectorAll("h2, h3, h4, p, li, blockquote, td, th")
  ).filter(n =>
    !n.closest(".jarvis-translator") &&
    (n.textContent || "").trim().length > 4
  );
}

function _jarvisSaveOriginal(nodes) {
  nodes.forEach((n, i) => {
    if (!n.dataset.jarvisOriginal) n.dataset.jarvisOriginal = n.textContent;
    n.dataset.jarvisIdx = i;
  });
}

function _jarvisApplyTranslation(map) {
  document.querySelectorAll("[data-jarvis-idx]").forEach(n => {
    const idx = n.dataset.jarvisIdx;
    if (map[idx] !== undefined) n.textContent = map[idx];
  });
}

function _jarvisApplyCached(lang) {
  const cacheKey = `${JARVIS_TRANSLATE_CACHE}:${location.pathname}:${lang}`;
  const cached = _jarvisGetCache(cacheKey);
  if (cached) {
    const article = document.getElementById("article");
    if (article) _jarvisSaveOriginal(_jarvisGetTranslatableNodes(article));
    _jarvisApplyTranslation(cached);
    updateJarvisTranslateStatus(`Translated to ${lang}. Select English to reset.`);
  }
}

function _jarvisRestoreOriginal() {
  document.querySelectorAll("[data-jarvis-original]").forEach(n => {
    n.textContent = n.dataset.jarvisOriginal;
  });
}

function _jarvisGetCache(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}

function _jarvisSetCache(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
}

/* ======================================================
   INIT
====================================================== */

function initTimelineReveal() {
  const items = document.querySelectorAll(".timeline-item");
  if (!items.length) return;
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });
  items.forEach(el => observer.observe(el));
}

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  removeFooterThemeToggles();
  setupThemeToggle();
  setupLogoThemeToggle();
  startFooterUpdates();
  loadSocials();
  initHamburger();
  initContactForm();
  initEnquiryForm();
  initMobileHeader();
  initScrollReveal();
  initCounters();
  initParallax();
  initTimelineReveal();
  initGlobalClickHandler();
  initServiceWorker();
  initInstallPrompt();
  initScrollProgress();
  initBackToTop();
  initHomeBlogPreview();
  initBlogRenderer();
  initReadingTime();
  initJarvisTranslator();
  initDynamicQuoteBand();
  initProFooter();

  const year = $("year");
  if (year) year.textContent = new Date().getFullYear();
}, { once: true });

// Expose functions called from HTML onclick attributes
window.triggerInstallPrompt = triggerInstallPrompt;
window.dismissInstallBar    = dismissInstallBar;
window.openEnquiry          = openEnquiry;
window.closeEnquiry         = closeEnquiry;

})();
