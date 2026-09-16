# kingofyadav.in — Claude Code Guide

Personal production site for Amit Ku Yadav. Vanilla HTML/CSS/JS frontend, Node.js API, PostgreSQL, deployed on Vercel with Railway as the API backend.

---

## Quick Start

```bash
cp .env.example .env          # fill real values
npm install
vercel dev                    # static site + api/ serverless functions + rewrites, on :3000
```

`vercel dev` is the only local server that runs `api/*.js` (jarvis-chat, auth/0dot/*, wallet, etc.) and applies `vercel.json` rewrites — it replicates the Vercel deployment. Don't use `python3 -m http.server` or open `index.html` directly for anything touching `/api/*`; those return raw files only, so any POST to an API route 404s or 501s.

For static-only work with no API calls, `npm run dev:static` (plain file server, no `api/` support) is a lighter option. The OTP server (`npm start`, port 5050) is the standalone Railway service — normally only needed when testing it in isolation.

Build pipeline:
```bash
npm run build:tokens   # brand-tokens.json → css/brand-tokens.css (auto-generated)
npm run build:blog     # markdown → blog/*.html
npm run build:css      # CSS dist/
npm run build:sw       # bump service worker version
npm run build          # all of the above in order
```

Tests:
```bash
npm test               # Jest unit tests
npm run test:e2e       # Playwright end-to-end
```

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Vanilla HTML5 / CSS3 / ES6+ (no build framework) |
| API | Node.js (raw `http` module, zero deps) — `server/otp-server.js` |
| Auth | JWT + MSG91 OTP |
| AI | Jarvis (custom, `jarvis.kingofyadav.in`) + OpenAI for live class |
| DB | PostgreSQL (Railway / Neon) via `pg` |
| Push | Web Push (VAPID) via `web-push` |
| Deploy | Vercel (static + API functions in `api/`) + Railway (OTP server) |
| Testing | Jest (unit) + Playwright (e2e) |

---

## File Architecture

```
css/
  base.css           ← Global tokens, reset, typography, utilities — EDIT THIS FOR GLOBAL CHANGES
  brand-tokens.css   ← AUTO-GENERATED — never edit; edit brand-tokens.json instead
  index.css          ← Home page only
  blog.css           ← Blog listing page
  blog-post.css      ← Individual blog post page
  layout.css         ← Shared layout primitives (nav, footer, sections)
  components.css     ← Reusable components (buttons, cards, badges, chips)
  effects.css        ← Animations, glows, particle effects, scroll reveals
  auth.css           ← Login / OTP flow
  services.css       ← Services section
  professional.css   ← Professional / work section
  personal.css       ← Personal section
  social.css         ← Social / community section
  contact.css        ← Contact form
  brand.css          ← Brand identity page
  collaboration.css  ← Collaboration page
  hi-*.css           ← HI product suite (wallet, vault, app, ecosystem, etc.)
  live-class.css     ← Live class board
  order.css          ← Order / payment flow

js/
  site-init.js       ← Runs before body paint: theme restore, effects loader, auth bar
  script.js          ← Main page logic
  nav.js             ← Navigation / mobile menu
  effects.js         ← Scroll-triggered animations, particle effects
  footer.js          ← Footer interactions
  hi-*.js            ← HI product suite modules
  blog-translate.js  ← Blog translation feature
  live-class.js      ← Live class board logic
  upi-payment.js     ← UPI/payment integration
  personal-data.js   ← Personal data module
  profile-renderer.js← Profile rendering
  auth.js            ← Auth flow
  order.js           ← Order flow

api/                 ← Vercel serverless functions
server/              ← Node.js OTP server (Railway)
scripts/             ← Build scripts (tokens, blog, CSS, SW version)
pages/               ← Subpages (HTML files)
blog/                ← Generated blog posts (HTML)
brand-tokens.json    ← SINGLE SOURCE OF TRUTH for brand colors/shadows/gradients
```

---

## Design System

### Brand Colors

| Token | Value | Use |
|---|---|---|
| `--brand-green` | `#046A38` | Primary CTAs, links, active states |
| `--brand-green-deep` | `#034f2a` | Hover states on green |
| `--brand-green-soft` | `rgba(4,106,56,0.15)` | Tinted backgrounds, highlights |
| `--brand-orange` | `#FF671F` | Accent, energy, secondary CTAs |
| `--brand-orange-deep` | `#e55a16` | Hover states on orange |
| `--brand-orange-soft` | `rgba(255,103,31,0.15)` | Tinted backgrounds |
| `--brand-blue` | `#000080` | Legacy/rare use only |
| `--gradient-brand` | green → orange 135deg | Hero gradients, badges |
| `--gradient-soft` | soft green → soft orange | Subtle section backgrounds |

**Rule:** Never hardcode these hex values. Always use the CSS variable.

**To change brand colors:** Edit `brand-tokens.json` only → run `npm run build:tokens`.

### Text Colors

```css
--text-primary:   #111   /* headings, important body */
--text-secondary: #333   /* body text */
--text-muted:     #555   /* captions, labels, metadata */
--text-dark:      #111   /* forced dark (ignore theme) */
--text-light:     #e5e5e5 /* forced light (ignore theme) */
```

### Spacing Scale

```css
--space-xs:  8px
--space-sm:  12px
--space-md:  24px
--space-lg:  48px
--space-xl:  80px
```

For gaps, margins, and padding — always prefer these variables over raw values.

### Typography (hero scale from index.css)

```css
/* Home hero h1 */
font-size: clamp(3.4rem, 6.5vw, 5.6rem);
font-weight: 800;
line-height: 1.0;

/* Section headings */
font-size: clamp(2rem, 4vw, 3.2rem);
font-weight: 700;
line-height: 1.15;
```

Always use `clamp()` for fluid typography. No fixed `px` sizes for headings.

### Shadows

```css
--shadow-xs:  0 1px 2px rgba(0,0,0,0.08)
--shadow-sm:  0 2px 8px rgba(0,0,0,0.10)
--shadow-md:  0 4px 16px rgba(0,0,0,0.12)
--shadow-lg:  0 8px 32px rgba(0,0,0,0.18)
--shadow-xl:  0 16px 64px rgba(0,0,0,0.24)
--shadow-brand-green:  0 4px 20px rgba(4,106,56,0.28)
--shadow-brand-orange: 0 4px 20px rgba(255,103,31,0.28)
--shadow-brand-glow:   multi-layer green+orange glow
```

### Border Radius & Blur

```css
--radius: 18px   /* standard card/container radius */
--blur:   18px   /* backdrop-filter blur */
```

### Z-Index Scale

```css
--z-below: -1  | --z-base: 0   | --z-raised: 10
--z-dropdown: 100 | --z-sticky: 200 | --z-fixed: 300
--z-overlay: 400  | --z-modal: 500  | --z-toast: 600  | --z-top: 999
```

Never use a raw z-index number. Always use these tokens.

### Motion & Animation

```css
/* Durations */
--dur-instant: 80ms   /* micro-interactions */
--dur-fast:   160ms   /* button states */
--dur-normal: 240ms   /* standard transitions */
--dur-slow:   400ms   /* page-level animations */
--dur-enter:  300ms   /* elements entering viewport */
--dur-exit:   200ms   /* elements leaving */

/* Easings */
--ease-out:    cubic-bezier(0.16, 1, 0.3, 1)   /* default for most UI */
--ease-in:     cubic-bezier(0.4, 0, 1, 1)
--ease-inout:  cubic-bezier(0.4, 0, 0.2, 1)
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1) /* bouncy, use sparingly */
```

**Always wrap animations in:**
```css
@media (prefers-reduced-motion: no-preference) {
  /* animation code here */
}
```

### Focus / Accessibility

```css
--focus-ring:        0 0 0 3px rgba(4,106,56,0.22)
--focus-ring-orange: 0 0 0 3px rgba(255,103,31,0.22)
--focus-ring-offset: 2px
```

Use `focus-visible` (not `focus`) for all interactive elements:
```css
:focus-visible { outline: none; box-shadow: var(--focus-ring); }
```

Minimum touch target: **44px × 44px** (use `min-height: 44px` on all interactive elements).

### Themes (Dark / Light)

The site supports dark and light themes via `body.theme-dark` / `body.theme-light` class. `site-init.js` restores the user's preference from localStorage before the first paint (no flash).

Theme-aware CSS pattern:
```css
/* Default (dark context) */
.my-component { background: var(--field-bg-dark); }

/* Light theme override */
body.theme-light .my-component { background: var(--field-bg-light); }
```

### Form Tokens

```css
--field-bg-dark / --field-bg-light
--field-border-dark / --field-border-light
--field-border-focus:   rgba(4,106,56,0.38)
--field-shadow-focus:   0 0 0 3px rgba(4,106,56,0.14)
--field-radius:         14px
--field-min-height:     48px
--field-gap:            16px
--field-label:          var(--brand-green)
```

### Layout

```css
--container:      1400px   /* max-width for page containers */
--section-pad-v:  clamp(80px, 9vw, 140px)   /* vertical section padding */
--section-pad-h:  clamp(20px, 5vw, 64px)    /* horizontal section padding */
```

---

## CSS Conventions

1. **One CSS file per page/section** — never put home styles in blog.css.
2. **No `!important`** unless overriding a third-party library.
3. **Mobile-first** — base styles are mobile, `@media (min-width: Npx)` for larger.
4. **Custom properties only** for all colors, spacing, shadows, z-index, durations.
5. **Cache busting** — CSS/JS URLs use `?v=X` query strings. When making significant changes to a CSS file that should be cache-busted, increment the version query string in the HTML `<link>` tag.

---

## JS Conventions

- All files use `"use strict";` at the top.
- Modules are plain IIFE or small named functions — no bundler, no imports.
- `site-init.js` runs synchronously in `<head>` — keep it minimal and free of DOM queries.
- For new features, add a new file rather than growing `script.js`.

---

## Deployment

```
Vercel:  static files + api/* serverless functions
Railway: server/otp-server.js (always-on OTP backend)
```

**CSS/JS/images** are cached 1 year (immutable) by Vercel headers — always bump the `?v=` query string when updating static assets.

**Service worker** is versioned via `scripts/bump-sw-version.js` — run `npm run build:sw` after changes that affect offline behavior.

**Never hardcode** Vercel or Railway URLs. Use `process.env.JARVIS_API_BASE` etc.

---

## UI/UX Rules (Production Quality Standard)

- **No layout shift** — size images with explicit `width`/`height` attributes.
- **No FOUC** — critical styles must be in `base.css` loaded in `<head>`.
- **Touch targets** — all buttons/links ≥ 44px tall on mobile.
- **Loading states** — every async action needs a loading indicator.
- **Error states** — every form/API call needs a visible error state.
- **Semantic HTML** — `<button>` for actions, `<a>` for navigation, headings in order.
- **No inline styles** — all styling goes in the appropriate CSS file.
- **No magic numbers** — all sizing/spacing uses design token variables.

---

## API Architecture

- `api/` — Vercel serverless functions (Node.js)
- `api/auth/` — JWT + OTP auth endpoints
- `api/wallet/` — HI Wallet endpoints
- `api/hi/` — HI API endpoints
- `api-static/` — Static JSON API responses (cached 10 min)
- `server/otp-server.js` — Railway persistent server (MSG91 integration)

---

## Environment Variables

See `.env.example` for full reference. Key vars:
- `DATABASE_URL` — PostgreSQL connection string
- `AUTH_JWT_SECRET` — JWT signing secret
- `MSG91_AUTHKEY` / `MSG91_TEMPLATE_ID` — OTP service
- `JARVIS_API_BASE` — AI backend URL
- `VAPID_*` — Web Push keys
