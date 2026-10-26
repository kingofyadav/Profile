# Security Policy — kingofyadav.in

## Supported Versions

| Version | Supported |
| ------- | --------- |
| current | yes       |
| < 1.0   | no        |

## Reporting a Vulnerability

Email **circle.onelife@gmail.com** with subject `[SECURITY] <short description>`.
Expect acknowledgement within 48 hours and a patch within 14 days for critical issues.
Do **not** open public GitHub issues for security vulnerabilities.

---

## Secrets Inventory and Rotation Runbook

| Secret | Where stored | Rotation period |
|--------|-------------|----------------|
| `DASHBOARD_PASSWORD` (bcrypt hash) | Vercel env var / `.env` | On compromise or every 90 days |
| `DASHBOARD_SESSION_SECRET` (≥32 chars) | Vercel env var | On compromise |
| `JARVIS_API_KEY` | Vercel env var | On compromise or every 90 days |
| `JARVIS_BRIDGE_SECRET` | Vercel env var | On compromise |
| `JARVIS_SYNC_SECRET` | Vercel env var | On compromise |
| `HI_API_KEY` | Vercel env var | On compromise |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Vercel env var | See VAPID runbook below |
| `DATABASE_URL` (Postgres) | Vercel env var | On compromise or quarterly |

### General Rotation Steps

1. Generate new value (see per-secret instructions below).
2. Update the Vercel environment variable: `vercel env rm SECRET_NAME` then `vercel env add SECRET_NAME`.
3. Redeploy: `vercel --prod` (or merge to `main` to trigger CI/CD).
4. Verify the application starts correctly and the old secret no longer works.
5. Revoke the old secret at its source (DB user, API provider dashboard, etc.).

### DASHBOARD_PASSWORD Rotation

```bash
# Generate a new bcrypt hash (cost factor 12)
python3 -c "import bcrypt; pw = input('New password: ').encode(); print(bcrypt.hashpw(pw, bcrypt.gensalt(12)).decode())"
# Set the output as DASHBOARD_PASSWORD in Vercel env
```

### VAPID Key Rotation Runbook

VAPID keys sign Web Push notifications. Rotating them invalidates all existing push subscriptions — users must re-subscribe.

**When to rotate:** annually, or if the private key is compromised.

**Step-by-step:**

```bash
# 1. Generate new VAPID key pair (requires web-push CLI)
npx web-push generate-vapid-keys --json
# Output: { "publicKey": "...", "privateKey": "..." }

# 2. Update Vercel env vars (production + preview)
vercel env rm VAPID_PUBLIC_KEY production
vercel env rm VAPID_PRIVATE_KEY production
vercel env add VAPID_PUBLIC_KEY production   # paste new publicKey
vercel env add VAPID_PRIVATE_KEY production  # paste new privateKey

# 3. Redeploy
vercel --prod

# 4. Clear old subscriptions from DB — they are now invalid
# Run via psql or Vercel Postgres dashboard:
# DELETE FROM push_subscriptions;

# 5. Notify users (optional): display an in-app banner prompting re-subscribe
```

**Impact:** All push subscribers are unsubscribed. The push icon resets to "off" state. Users who visit the site can re-enable notifications immediately.

### JWT / Session Secret Rotation

```bash
# Generate a new 64-char hex secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Update DASHBOARD_SESSION_SECRET in Vercel env and redeploy
# Effect: all active sessions are invalidated; users must log in again
```

---

## Observability Setup

### Vercel Analytics

1. Enable in Vercel dashboard → Project → Analytics tab.
2. Add the script to every HTML page `<head>`:

```html
<script defer src="/_vercel/insights/script.js"></script>
```

3. Core Web Vitals (LCP, FID, CLS) are collected automatically.

### Error Monitoring with Sentry

```bash
npm install @sentry/browser
```

Add to each page before other scripts:

```html
<script src="https://browser.sentry-cdn.com/7.x.x/bundle.min.js"
        crossorigin="anonymous"></script>
<script>
  Sentry.init({
    dsn: "YOUR_SENTRY_DSN",
    environment: "production",
    tracesSampleRate: 0.2,
    release: "kingofyadav-in@__BUILD_VERSION__"
  });
</script>
```

For the Vercel serverless API layer (Node.js):

```bash
npm install @sentry/node
```

```js
// api/_sentry.js
const Sentry = require("@sentry/node");
Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.APP_ENV });
module.exports = Sentry;
```

Import `require("./_sentry")` at the top of each API handler before any logic.

### Backend Dashboard (work_station) — Sentry for Python

```bash
pip install sentry-sdk
```

In `app/app.py` before `st.set_page_config(...)`:

```python
import sentry_sdk
sentry_sdk.init(
    dsn=os.getenv("SENTRY_DSN", ""),
    traces_sample_rate=0.1,
    environment=os.getenv("APP_ENV", "production"),
)
```

### Uptime Monitoring

Use **UptimeRobot** (free tier) or Vercel's built-in status checks:
- Monitor `https://kingofyadav.in` (HTTP, 5 min interval)
- Monitor `/api/health` if a health endpoint exists
- Alert via email or Slack webhook on downtime

---

## CSP and Header Audit

Current security headers (set in `vercel.json`):

| Header | Value |
|--------|-------|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Cross-Origin-Resource-Policy` | `same-site` |
| `Content-Security-Policy` | nonce-based via Edge Middleware |

Run `npx observatory-cli https://kingofyadav.in` quarterly to re-score headers.

---

## Tor Hidden Service (Onion Mirror)

The site is also reachable over Tor at:

```
http://dotrta7xpeqlaf4ltswlqo4mdgmjmbngm7krktbb75gctssnefqugsad.onion
```

### Architecture

```
Tor Browser ──(Tor circuit)──> HiddenServiceDir /var/lib/tor/profile-onion/
                                  (v3 onion, HiddenServicePort 80 -> 127.0.0.1:3002)
                                       │
                                       ▼
                        systemd --user: profile-vercel-dev.service
                        `vercel dev --listen 127.0.0.1:3002`
                        (full local replica: static pages + api/* + vercel.json rewrites)
```

No nginx or reverse proxy sits between Tor and the app — Tor forwards directly to the
local `vercel dev` process. This is a full dynamic mirror (API routes included), not a
static-only copy, so it only ever needs this machine to be on; it has no dependency on
the live Vercel/Railway deployment.

### Operational notes

- **Service**: `systemctl --user status profile-vercel-dev.service` / `journalctl --user -u profile-vercel-dev -f`
- **Logs**: `logs/vercel-dev.log` (gitignored). Install `/etc/logrotate.d/profile-vercel-dev` to cap growth — see repo scratchpad or ask for the config again if lost.
- **Tor**: `sudo systemctl status tor` · config in `/etc/tor/torrc` (`ClientOnly 1`, stream isolation, obfs4 scaffold, no exit traffic).
- **Binding**: the dev server binds `127.0.0.1:3002` only — never `0.0.0.0`. Binding to all interfaces would make the exact same content reachable over the LAN, unauthenticated, and would let anyone who finds that port correlate the onion content with this machine's real network address, defeating the point of the hidden service. Keep `--listen 127.0.0.1:3002` in the systemd unit if this is ever touched.
- **Sandboxing**: `~/.config/systemd/user/profile-vercel-dev.service` runs with `NoNewPrivileges`, `ProtectSystem=strict`, `ProtectHome=read-only` (+ explicit `ReadWritePaths`), `PrivateTmp`, `RestrictSUIDSGID`, `RestrictRealtime`, `RemoveIPC`. Several further `Protect*`/capability-bounding directives were tried and reverted — systemd `--user` units fail with `status=218/CAPABILITIES` when asked to drop certain implied capabilities without root, so this is the safe ceiling for a non-root user unit.
- **Rotating the address**: delete `/var/lib/tor/profile-onion/` (as root), restart `tor`, re-read the new `hostname` file, update it here and in `vercel.json`'s `Onion-Location` header.

### Trust/exposure decisions made for this mirror (2026-10-26)

- **Trackers**: `api-static/jarvis-widget.js` early-returns for any `location.hostname` ending in `.onion`, so the live chat widget never opens its cross-origin WebSocket to `jarvis.kingofyadav.in` for Tor visitors. (Cloudflare Insights/Google APIs in the CSP allow-list are not actually embedded anywhere in the codebase — likely injected by Cloudflare at the clearnet edge — so they don't reach the onion mirror at all.)
- **API parity**: deliberately kept full — wallet/auth/payment routes under `api/` are reachable over the onion address exactly as on the live site, using whatever credentials are in `.env.local`. If those are ever swapped for production secrets, revisit whether anonymous Tor traffic should still reach `api/wallet/*`, `api/auth/*`, and `api/upi-payment.js` unauthenticated.
- **Onion-Location**: the live `vercel.json` sends this header site-wide so Tor Browser visitors on the clearnet domain get the one-click banner to switch to the `.onion` address (same pattern as nytimes.com/propublica.org).
