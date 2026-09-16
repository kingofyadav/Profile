"use strict";

// Theme flash prevention — runs before body paint
(function () {
  try {
    // script.js stores "light"/"dark"; older versions stored "theme-light"/"theme-dark"
    var t = localStorage.getItem("theme");
    if (t) {
      var cls = t === "light" || t === "theme-light" ? "theme-light" : "theme-dark";
      document.body.classList.remove("theme-dark", "theme-light");
      document.body.classList.add(cls);
    }
  } catch (e) {}
})();

// Live-class board theme restore
(function () {
  try {
    var lt = localStorage.getItem("live_class_theme");
    if (lt && document.body.dataset.boardTheme !== undefined) document.body.dataset.boardTheme = lt;
  } catch (e) {}
})();

// Pro Effects System — auto-load CSS + JS on every page
(function () {
  var l = document.createElement('link');
  l.rel  = 'stylesheet';
  l.href = '/css/effects.css?v=3';
  (document.head || document.documentElement).appendChild(l);

  document.addEventListener('DOMContentLoaded', function () {
    var s  = document.createElement('script');
    s.src  = '/js/effects.js?v=4';
    s.defer = true;
    document.body.appendChild(s);
  });
})();

// Auth bar wiring — reveals user chip if session is active.
// auth.js is deferred, so it is NOT yet loaded when this file runs at the top of
// <body>. Do the check inside DOMContentLoaded, by which point deferred scripts
// have executed.
(function () {
  document.addEventListener("DOMContentLoaded", function () {
    if (typeof isAuthenticated !== "function" || !isAuthenticated()) return;
    var bar = document.getElementById("homeAuthBar");
    if (bar) bar.hidden = false;
    var el = document.getElementById("authUserDisplay");
    if (el && typeof getAuthUser === "function") el.textContent = getAuthUser() || "";
    var btn = document.getElementById("logoutBtn");
    if (btn && typeof logout === "function") btn.addEventListener("click", logout);
  });
})();
