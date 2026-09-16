'use strict'

/* ======================================================
   nav.js — Global nav renderer (defer, runs before script.js)
   Three nav menus:
     data-nav="index"    → public / portfolio pages
     data-nav="personal" → HI Life OS private pages
     data-nav="wallet"   → HI Wallet ecosystem pages
====================================================== */
;(function () {
  const INDEX_NAV = [
    { label: 'Home',          href: '/' },
    { label: 'Blog',          href: '/pages/blog.html' },
    { label: 'Projects',      href: '/pages/projects.html' },
    { label: 'Services',      href: '/pages/services.html' },
    { label: 'Contact',       href: '/pages/contact.html' },
    { label: '🔴 Live',       href: '/pages/live-class.html', cls: 'live-class-link' },
  ]

  const PERSONAL_NAV = [
    { label: 'HI Life OS',    href: '/pages/personal.html' },
    { label: 'Dashboard',     href: '/pages/dashboard.html' },
    { label: 'Wallet',        href: '/pages/wallet.html', cls: 'wallet-link' },
    { label: 'Professional',  href: '/pages/professional.html' },
    { label: 'Social',        href: '/pages/social.html' },
    { label: 'About Me',      href: '/pages/about.html' },
    { label: 'Origin',        href: '/pages/origin.html' },
    { label: 'Haven',         href: '/pages/haven.html' },
    { label: 'Bhagalpur',   href: '/pages/bhagalpur.html' },
    { label: '🔐 IP Vault',    href: '/pages/hi-license.html', cls: 'license-link' },
    { label: '🛡 Protection', href: '/pages/hi-protect.html', cls: 'protect-link' },
    { label: '✍️ Blog Vault',  href: '/pages/hi-license?filter=blog-post', cls: 'blog-vault-link' },
  ]

  const LIVE_NAV = [
    { label: '🔴 Live Class', href: '/pages/live-class.html', cls: 'live-class-link' },
  ]

  const WALLET_NAV = [
    { label: 'Overview',     href: '/wallet/index.html' },
    { label: 'HI Wallet',    href: '/wallet/wallet.html' },
    { label: 'HI Coin',      href: '/wallet/coin.html' },
    { label: 'Vault',        href: '/wallet/vault.html' },
    { label: 'Merchant',     href: '/wallet/merchant.html' },
    { label: 'Marketplace',  href: '/wallet/marketplace/' },
  ]

  const PERSONAL_PATHS = [
    '/pages/personal', '/pages/about', '/pages/origin',
    '/pages/haven', '/pages/bhagalpur', '/pages/hi-license', '/pages/hi-protect',
    '/pages/dashboard', '/pages/wallet',
  ]

  function normPath(p) {
    return (p || '/').replace(/\.html$/, '').replace(/\/$/, '') || '/'
  }

  function isActive(href) {
    const curr = normPath(window.location.pathname)
    const h    = normPath(href)
    if (h === '/') return curr === '/' || curr === '/index'
    return curr === h || curr.startsWith(h + '/')
  }

  function buildLink(link) {
    const a = document.createElement('a')
    a.href = link.href
    // Safe text: strip HTML from label, use textContent
    a.textContent = link.label.replace(/&#x[0-9A-F]+;/gi, (m) =>
      String.fromCodePoint(parseInt(m.slice(3, -1), 16))
    )
    if (link.cls) a.className = link.cls
    if (isActive(link.href)) {
      a.setAttribute('aria-current', 'page')
      a.classList.add('active')
    }
    return a
  }

  function resolveNavLinks(type, path) {
    const isWallet   = path.startsWith('/wallet/')
    const isPersonal = PERSONAL_PATHS.some(p => path.startsWith(p))
    const isLive     = path.startsWith('/pages/live-class')
    if (isLive)      return LIVE_NAV
    if (isWallet)    return WALLET_NAV
    if (isPersonal)  return PERSONAL_NAV
    if (type === 'live')     return LIVE_NAV
    if (type === 'wallet')   return WALLET_NAV
    if (type === 'personal' || PERSONAL_PATHS.some(p => type === p.split('/').pop())) return PERSONAL_NAV
    return INDEX_NAV
  }

  const path = window.location.pathname

  document.querySelectorAll('[data-nav]').forEach(nav => {
    const type  = nav.getAttribute('data-nav') || 'index'
    const links = resolveNavLinks(type, path)

    nav.innerHTML = ''

    if (nav.classList.contains('personal-nav') || nav.classList.contains('wallet-nav')) {
      if (!nav.getAttribute('aria-label')) nav.setAttribute('aria-label', 'Section navigation')
      links.forEach(link => nav.appendChild(buildLink(link)))
    } else {
      if (!nav.getAttribute('aria-label')) nav.setAttribute('aria-label', 'Main navigation')
      const ul = document.createElement('ul')
      ul.className = 'nav-list'
      links.forEach(link => {
        const li = document.createElement('li')
        li.appendChild(buildLink(link))
        ul.appendChild(li)
      })
      nav.appendChild(ul)
    }
  })

  /* ── Auto-inject auth bar ── */
  if (!document.getElementById('logoutBtn') && !document.body.classList.contains('lc-page')) {
    const inner = document.querySelector('.personal-header-inner, .header-inner')
    if (!inner) return

    const bar = document.createElement('div')
    bar.className = 'auth-bar'
    bar.hidden = true
    bar.innerHTML =
      '<span>Hi, <strong id="authUserDisplay"></strong></span>' +
      '<button class="auth-logout-btn" id="logoutBtn" type="button">Logout</button>'
    inner.appendChild(bar)

    if (typeof initAuthButton === 'function') {
      initAuthButton()
      const uEl = document.getElementById('authUserDisplay')
      if (uEl && typeof getAuthUser === 'function') uEl.textContent = getAuthUser() || ''
      return
    }

    /* Inline fallback for pages without auth.js */
    let token = null
    try {
      const raw = sessionStorage.getItem('ak_auth_token') || localStorage.getItem('ak_auth_token')
      if (raw) {
        const t = JSON.parse(raw)
        if (Date.now() < t.exp) token = t
      }
    } catch (_) {}

    const btn = document.getElementById('logoutBtn')
    bar.hidden = false

    if (token) {
      const uEl = document.getElementById('authUserDisplay')
      if (uEl) uEl.textContent = token.username || ''
      if (btn) {
        btn.className = 'auth-logout-btn is-logout'
        btn.textContent = 'Logout'
        btn.addEventListener('click', () => {
          try {
            sessionStorage.removeItem('ak_auth_token')
            localStorage.removeItem('ak_auth_token')
          } catch (_) {}
          window.location.replace('/pages/login.html')
        })
      }
    } else {
      if (btn) {
        btn.className = 'auth-logout-btn is-login'
        btn.textContent = 'Login'
        btn.addEventListener('click', () => {
          window.location.href =
            '/pages/login?next=' + encodeURIComponent(window.location.pathname + window.location.search)
        })
      }
    }
  }
})()
