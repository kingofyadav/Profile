(function () {
  "use strict";

  // Tor onion visitors: never auto-open a live cross-origin connection to
  // jarvis.kingofyadav.in. Keeps the onion mirror from phoning home per page view.
  if (/\.onion$/i.test(location.hostname)) return;

  // Top-level error boundary — ensures a broken widget never crashes the host page
  window.addEventListener("error", function (e) {
    if (e && e.filename && e.filename.indexOf("jarvis-widget") !== -1) {
      console.warn("[Jarvis widget] Uncaught error:", e.message);
    }
  });

  var script = document.currentScript;
  var ENDPOINT = (script && script.dataset.endpoint) || "";
  if ((location.hostname === "localhost" || location.hostname === "127.0.0.1") && (!ENDPOINT || ENDPOINT.indexOf("/api/") === 0)) {
    ENDPOINT = "http://127.0.0.1:5050/api/jarvis-chat";
  }
  var LIVE_ENDPOINT = (script && script.dataset.liveEndpoint) || "";
  var TITLE = (script && script.dataset.title) || "Jarvis AI";
  var SUBTITLE = (script && script.dataset.subtitle) || "Ask about King Yadav and the website.";
  var SITE_LINE = (script && script.dataset.siteLine) || "Digital identity, blogs, services, and ventures in one place.";
  var WELCOME = "Hi. I’m Jarvis AI Operator for kingofyadav.in. Ask about Amit, services, ventures, writing, collaboration, or the right next page to open.";
  var STORAGE_KEY = "jarvis_public_chat_history_v1";
  var SPEAK_KEY = "jarvis_public_chat_speak_v1";
  var MODE_KEY = "jarvis_public_chat_mode_v1";
  var ENQUIRY_ENDPOINT = (script && script.dataset.enquiryEndpoint) || "";
  var SIGNUP_ENDPOINT = (script && script.dataset.signupEndpoint) || "";
  var SUGGESTIONS = [
    "Show me Amit's digital world",
    "Which service should I choose?",
    "How can I collaborate?",
    "Summarize the ventures"
  ];
  var MODES = {
    chat: { label: "Chat", endpoint: ENDPOINT },
    enquiry: { label: "Enquiry", endpoint: ENQUIRY_ENDPOINT },
    signup: { label: "Access Request", endpoint: SIGNUP_ENDPOINT }
  };

  /* ── Styles ────────────────────────────────────────────────────────────── */
  var css = [
    "#jrv-btn{position:fixed;bottom:24px;right:24px;z-index:9998;width:64px;height:64px;border-radius:20px;border:1px solid rgba(255,255,255,.14);cursor:pointer;background:linear-gradient(135deg,#046A38,#FF671F);box-shadow:0 18px 44px rgba(4,106,56,.28),0 8px 24px rgba(0,0,0,.34);display:flex;align-items:center;justify-content:center;transition:transform .18s,box-shadow .18s,border-radius .18s;}",
    "#jrv-btn:hover{transform:translateY(-3px) scale(1.04);box-shadow:0 22px 56px rgba(4,106,56,.36),0 10px 28px rgba(0,0,0,.42);border-radius:24px;}",
    "#jrv-btn svg{width:26px;height:26px;fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}",
    "#jrv-panel{position:fixed;bottom:96px;right:24px;z-index:9999;width:min(620px,calc(100vw - 32px));height:min(720px,calc(100vh - 124px));max-height:calc(100vh - 124px);background:linear-gradient(145deg,rgba(4,106,56,.08),rgba(255,103,31,.055)),#0a0b0a;border:1px solid rgba(255,255,255,.12);border-radius:20px;box-shadow:0 28px 90px rgba(0,0,0,.52);display:flex;flex-direction:column;overflow:hidden;transform:scale(.94) translateY(18px);opacity:0;pointer-events:none;transition:transform .24s cubic-bezier(.22,1,.36,1),opacity .18s;}",
    "#jrv-panel.jrv-open{transform:scale(1) translateY(0);opacity:1;pointer-events:all;}",
    "#jrv-head{min-height:74px;padding:18px 22px;background:rgba(255,255,255,.04);border-bottom:1px solid rgba(255,255,255,.1);display:flex;align-items:center;gap:12px;flex-shrink:0;position:relative;}",
    "#jrv-head:before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#046A38,#FF671F);}",
    "#jrv-avatar{width:44px;height:44px;border-radius:14px;background:linear-gradient(135deg,#046A38,#FF671F);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;color:#fff;font-family:system-ui,sans-serif;box-shadow:0 12px 30px rgba(4,106,56,.24);}",
    "#jrv-head-text{flex:1;min-width:0;}",
    "#jrv-head-title{font-family:system-ui,sans-serif;font-size:15px;font-weight:850;color:#f4f4f4;line-height:1.2;letter-spacing:0;}",
    "#jrv-head-sub{font-family:system-ui,sans-serif;font-size:11.5px;color:rgba(255,255,255,.58);line-height:1.25;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
    "#jrv-site-line,#jrv-live{display:none;}",
    "#jrv-online{width:10px;height:10px;border-radius:50%;background:#2ecc71;box-shadow:0 0 12px #2ecc71;flex-shrink:0;}",
    "#jrv-msgs{flex:1;overflow-y:auto;padding:24px;display:flex;flex-direction:column;gap:16px;scrollbar-width:thin;scrollbar-color:#333 transparent;background:radial-gradient(circle at 15% 10%,rgba(4,106,56,.08),transparent 28%),radial-gradient(circle at 90% 70%,rgba(255,103,31,.065),transparent 30%);}",
    "#jrv-msgs::-webkit-scrollbar{width:4px;}",
    "#jrv-msgs::-webkit-scrollbar-track{background:transparent;}",
    "#jrv-msgs::-webkit-scrollbar-thumb{background:#333;border-radius:2px;}",
    ".jrv-msg{max-width:min(86%,500px);font-family:system-ui,sans-serif;font-size:14px;line-height:1.68;padding:14px 16px;border-radius:18px;word-break:break-word;white-space:pre-wrap;box-shadow:0 10px 28px rgba(0,0,0,.14);}",
    ".jrv-msg-bot{align-self:flex-start;background:rgba(255,255,255,.075);color:rgba(255,255,255,.9);border:1px solid rgba(255,255,255,.08);border-bottom-left-radius:5px;}",
    ".jrv-msg-user{align-self:flex-end;background:linear-gradient(135deg,#046A38,#0a7a46);color:#fff;border:1px solid rgba(255,255,255,.14);border-bottom-right-radius:5px;}",
    ".jrv-msg-err{align-self:flex-start;background:#2a1a1a;color:#ff6b6b;border-bottom-left-radius:4px;font-size:12px;}",
    ".jrv-mode{align-self:center;font-family:system-ui,sans-serif;font-size:10px;color:#888;background:#181818;border:1px solid #2a2a2a;border-radius:999px;padding:4px 8px;}",
    ".jrv-typing{align-self:flex-start;background:rgba(255,255,255,.075);padding:13px 16px;border-radius:18px;border-bottom-left-radius:5px;display:flex;gap:5px;align-items:center;border:1px solid rgba(255,255,255,.08);}",
    ".jrv-dot{width:6px;height:6px;border-radius:50%;background:#666;animation:jrv-bounce .9s infinite ease-in-out;}",
    ".jrv-dot:nth-child(2){animation-delay:.15s;}",
    ".jrv-dot:nth-child(3){animation-delay:.3s;}",
    "@keyframes jrv-bounce{0%,60%,100%{transform:translateY(0);}30%{transform:translateY(-5px);}}",
    "#jrv-foot{padding:14px 18px 18px;background:rgba(255,255,255,.04);border-top:1px solid rgba(255,255,255,.1);flex-shrink:0;}",
    "#jrv-row{display:flex;gap:10px;align-items:flex-end;}",
    "#jrv-suggest{display:flex;gap:6px;overflow-x:auto;padding:0 0 8px;scrollbar-width:none;}",
    "#jrv-suggest::-webkit-scrollbar{display:none;}",
    ".jrv-chip{border:1px solid rgba(4,106,56,.28);background:rgba(4,106,56,.08);color:#d8d8d8;border-radius:10px;padding:8px 11px;font-family:system-ui,sans-serif;font-size:11.5px;white-space:nowrap;cursor:pointer;}",
    ".jrv-chip:hover{border-color:#046A38;color:#fff;background:rgba(4,106,56,.14);}",
    "#jrv-input{flex:1;background:rgba(255,255,255,.075);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:14px 16px;color:#f0f0f0;font-family:system-ui,sans-serif;font-size:14px;line-height:1.55;resize:none;outline:none;min-height:52px;max-height:170px;overflow-y:auto;transition:border-color .15s,box-shadow .15s;box-sizing:border-box;}",
    "#jrv-input::placeholder{color:#555;}",
    "#jrv-input:focus{border-color:#046A38;box-shadow:0 0 0 3px rgba(4,106,56,.12);}",
    ".jrv-tool{width:44px;height:44px;border-radius:14px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.075);color:#d8d8d8;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .15s,border-color .15s,color .15s,transform .15s;}",
    ".jrv-tool:hover{border-color:#046A38;color:#fff;}",
    ".jrv-tool.jrv-active{background:#12311f;border-color:#046A38;color:#fff;}",
    ".jrv-tool.jrv-listening{background:#3a1818;border-color:#FF671F;color:#fff;animation:jrv-pulse 1s infinite ease-in-out;}",
    ".jrv-tool:disabled{opacity:.35;cursor:default;}",
    ".jrv-tool svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}",
    "@keyframes jrv-pulse{0%,100%{transform:scale(1);}50%{transform:scale(1.08);}}",
    "#jrv-send{width:52px;height:52px;border-radius:16px;border:none;background:linear-gradient(135deg,#046A38,#FF671F);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:opacity .15s,transform .15s,box-shadow .15s;box-shadow:0 12px 26px rgba(4,106,56,.22);}",
    "#jrv-send:hover{transform:translateY(-1px) scale(1.04);box-shadow:0 16px 34px rgba(4,106,56,.3);}",
    "#jrv-send:disabled{opacity:.4;cursor:default;}",
    "#jrv-send svg{width:18px;height:18px;}",
    "#jrv-brand{text-align:center;font-family:system-ui,sans-serif;font-size:10px;color:#444;margin-top:7px;}",
    "#jrv-brand a{color:#046A38;text-decoration:none;}",
    "#jrv-modebar{display:flex;gap:6px;flex-wrap:wrap;padding:0 0 8px;}",
    ".jrv-modechip{flex:1;min-width:0;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.055);color:#cfcfcf;border-radius:12px;padding:8px 10px;font-family:system-ui,sans-serif;font-size:11px;white-space:nowrap;cursor:pointer;}",
    ".jrv-modechip:hover{border-color:#046A38;color:#fff;}",
    ".jrv-modechip.jrv-selected{background:#12311f;border-color:#046A38;color:#fff;}",
    "#jrv-intake{display:none;padding-bottom:8px;}",
    ".jrv-form{display:grid;gap:8px;}",
    ".jrv-form-title{font-family:system-ui,sans-serif;font-size:12px;font-weight:700;color:#f0f0f0;}",
    ".jrv-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}",
    ".jrv-field{width:100%;background:#1c1c1e;border:1px solid #2a2a2a;border-radius:10px;padding:8px 10px;color:#f0f0f0;font-family:system-ui,sans-serif;font-size:13px;line-height:1.35;resize:vertical;outline:none;box-sizing:border-box;}",
    ".jrv-field::placeholder{color:#555;}",
    ".jrv-field:focus{border-color:#046A38;}",
    ".jrv-field.jrv-span2{grid-column:1 / -1;}",
    ".jrv-form-actions{display:flex;gap:8px;justify-content:flex-end;}",
    ".jrv-form-actions .jrv-small{border:1px solid #2a2a2a;background:#171717;color:#cfcfcf;border-radius:999px;padding:7px 12px;font-family:system-ui,sans-serif;font-size:11px;cursor:pointer;}",
    ".jrv-form-actions .jrv-small:hover{border-color:#046A38;color:#fff;}",
    ".jrv-form-actions .jrv-primary{border:none;background:linear-gradient(135deg,#046A38,#FF671F);color:#fff;border-radius:999px;padding:7px 14px;font-family:system-ui,sans-serif;font-size:11px;cursor:pointer;}",
    "@media(max-width:640px){#jrv-panel{left:0;right:0;bottom:0;top:0;width:100vw;height:100vh;max-width:none;max-height:none;border-radius:0;}#jrv-btn{right:18px;bottom:18px;width:58px;height:58px;border-radius:18px;}#jrv-msgs{padding:18px 16px;}.jrv-msg{max-width:94%;font-size:13.5px;}#jrv-foot{padding:12px 14px 16px;}#jrv-input{font-size:13.5px;}.jrv-tool{width:40px;height:40px;border-radius:12px;}#jrv-send{width:46px;height:46px;border-radius:14px;}}"
  ].join("");

  /* ── DOM ───────────────────────────────────────────────────────────────── */
  var styleEl = document.createElement("style");
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  var btn = document.createElement("button");
  btn.id = "jrv-btn";
  btn.setAttribute("aria-label", "Open Jarvis chat");
  btn.innerHTML = iconChat();

  var panel = document.createElement("div");
  panel.id = "jrv-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", TITLE);
  panel.innerHTML =
    '<div id="jrv-head">' +
      '<div id="jrv-avatar">✶</div>' +
      '<div id="jrv-head-text">' +
        '<div id="jrv-head-title">' + esc(TITLE) + '</div>' +
        '<div id="jrv-head-sub">' + esc(SUBTITLE) + '</div>' +
        '<div id="jrv-site-line">' + esc(SITE_LINE) + '</div>' +
        '<div id="jrv-live"></div>' +
      '</div>' +
      '<div id="jrv-online" title="Online"></div>' +
    '</div>' +
    '<div id="jrv-msgs"></div>' +
    '<div id="jrv-foot">' +
      '<div id="jrv-modebar"></div>' +
      '<div id="jrv-intake"></div>' +
      '<div id="jrv-suggest"></div>' +
      '<div id="jrv-row">' +
        '<textarea id="jrv-input" placeholder="Ask Jarvis…" rows="1" maxlength="1200"></textarea>' +
        '<button id="jrv-mic" class="jrv-tool" type="button" aria-label="Speak to Jarvis">' + iconMic() + '</button>' +
        '<button id="jrv-speak" class="jrv-tool" type="button" aria-label="Toggle spoken replies">' + iconSpeaker() + '</button>' +
        '<button id="jrv-send" aria-label="Send">' + iconSend() + '</button>' +
      '</div>' +
      '<div id="jrv-brand">Powered by <a href="https://kingofyadav.in" target="_blank" rel="noopener">Jarvis</a></div>' +
    '</div>';

  document.body.appendChild(btn);
  document.body.appendChild(panel);

  var msgs = document.getElementById("jrv-msgs");
  var input = document.getElementById("jrv-input");
  var sendBtn = document.getElementById("jrv-send");
  var suggest = document.getElementById("jrv-suggest");
  var micBtn = document.getElementById("jrv-mic");
  var speakBtn = document.getElementById("jrv-speak");
  var liveEl = document.getElementById("jrv-live");
  var modeBar = document.getElementById("jrv-modebar");
  var intakeEl = document.getElementById("jrv-intake");
  var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  /* ── State ─────────────────────────────────────────────────────────────── */
  var isOpen = false;
  var busy = false;
  var chatHistory = loadHistory();
  var lastBotText = "";
  var recognition = null;
  var listening = false;
  var voiceStarting = false;
  var speakEnabled = localStorage.getItem(SPEAK_KEY) === "1";
  var currentMode = localStorage.getItem(MODE_KEY) || "chat";
  var liveAttempts = 0;
  var maxLiveAttempts = 3;
  if (currentMode !== "chat" && (!MODES[currentMode] || !MODES[currentMode].endpoint)) {
    currentMode = "chat";
    localStorage.setItem(MODE_KEY, currentMode);
  }

  if (chatHistory.length) {
    chatHistory.slice(-8).forEach(function (item) {
      if (item.role === "user") appendUser(item.content, false);
      if (item.role === "assistant") appendBot(item.content, false);
    });
  } else {
    appendBot(WELCOME, false);
  }
  renderModeBar();
  renderMode(currentMode);
  renderSuggestions();
  connectLiveState();

  /* ── Event listeners ───────────────────────────────────────────────────── */
  btn.addEventListener("click", toggle);

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && isOpen) toggle();
  });

  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  });

  input.addEventListener("input", autoResize);
  sendBtn.addEventListener("click", submit);
  micBtn.addEventListener("click", handleVoiceButton);
  micBtn.addEventListener("touchend", function (e) {
    e.preventDefault();
    handleVoiceButton();
  }, { passive: false });
  speakBtn.addEventListener("click", toggleSpeechOutput);
  updateAudioControls();

  /* ── Warmup ping (silent, fires once on load to wake Railway) ─────────── */
  if (ENDPOINT) {
    setTimeout(function () {
      fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "__warmup__", history: [] })
      }).catch(function () { /* silent */ });
    }, 1500);
  }

  /* ── Core functions ────────────────────────────────────────────────────── */
  function toggle() {
    isOpen = !isOpen;
    panel.classList.toggle("jrv-open", isOpen);
    btn.setAttribute("aria-label", isOpen ? "Close Jarvis chat" : "Open Jarvis chat");
    btn.innerHTML = isOpen ? iconClose() : iconChat();
    if (isOpen) {
      setTimeout(function () { input.focus(); }, 220);
      scrollBottom();
    }
  }

  function submit() {
    if (currentMode !== "chat") return;
    var text = input.value.trim();
    if (!text || busy) return;
    var requestHistory = chatHistory.slice(-6);
    hideSuggestions();
    appendUser(text, true);
    input.value = "";
    autoResize();
    if (!ENDPOINT) {
      appendMode("Local mode");
      var localReply = localFallbackReply(text);
      appendBot(localReply, true);
      speakReply(localReply);
      input.focus();
      return;
    }
    setBusy(true);
    var typing = appendTyping();
    var payload = JSON.stringify({ message: text, history: requestHistory });
    var retried = false;

    function doFetch() {
      return fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload
      })
        .then(function (res) {
          if (res.status === 429) { throw new Error("rate_limit"); }
          if (!res.ok) { throw new Error("http_" + res.status); }
          return res.json();
        })
        .then(function (data) {
          removeEl(typing);
          if (!data.ok) {
            appendErr(data.error || "Jarvis is unavailable.");
            return;
          }
          if (data.mode === "fallback" && !document.getElementById("jrv-limited-mode")) {
            appendMode("Limited mode");
          }
          var reply = data.reply || data.response || data.message || "(no reply)";
          appendBot(reply, true);
          speakReply(reply);
        })
        .catch(function (err) {
          if (err.message !== "rate_limit" && !retried) {
            retried = true;
            appendMode("Waking Jarvis up — retrying…");
            return new Promise(function (resolve) { setTimeout(resolve, 3000); })
              .then(doFetch);
          }
          removeEl(typing);
          if (err.message === "rate_limit") {
            appendErr("Too many messages — please wait a moment.");
            return;
          }
          appendMode("Local guide mode");
          var localReply = localFallbackReply(text);
          appendBot(localReply, true);
          speakReply(localReply);
        });
    }

    doFetch().then(function () {
      setBusy(false);
      input.focus();
    });
  }

  function renderModeBar() {
    if (!modeBar) return;
    modeBar.innerHTML = "";
    Object.keys(MODES).filter(function (mode) {
      return mode === "chat" || Boolean(MODES[mode].endpoint);
    }).forEach(function (mode) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "jrv-modechip" + (mode === currentMode ? " jrv-selected" : "");
      chip.textContent = MODES[mode].label;
      chip.addEventListener("click", function () {
        setMode(mode);
      });
      modeBar.appendChild(chip);
    });
  }

  function localFallbackReply(text) {
    var q = String(text || "").toLowerCase();
    if (q.indexOf("service") !== -1 || q.indexOf("work") !== -1) {
      return "Open the Services page for digital identity, websites, automation, AI workflows, and structured web systems. If you want direct help, use the Contact page with your goal, timeline, and budget.";
    }
    if (q.indexOf("collab") !== -1 || q.indexOf("partner") !== -1) {
      return "For collaboration, open the Collaboration page. Share who you are, what you want to build, what you can contribute, and the timeline. Use Contact for direct communication.";
    }
    if (q.indexOf("contact") !== -1 || q.indexOf("email") !== -1) {
      return "Use the Contact page for direct messages. Include your name, email, subject, and a clear description so Amit can respond properly.";
    }
    if (q.indexOf("blog") !== -1 || q.indexOf("article") !== -1) {
      return "Open the Blog page to read Amit's writing on technology, leadership, AI, governance, youth, privacy, education, entrepreneurship, and future systems.";
    }
    if (q.indexOf("venture") !== -1 || q.indexOf("brand") !== -1 || q.indexOf("royal") !== -1 || q.indexOf("jhon") !== -1 || q.indexOf("youth") !== -1) {
      return "Amit's public ventures include Royal Heritage Resort, Jhon Aamit LLP, and National Youth Force. Open the brand pages to review each initiative.";
    }
    if (q.indexOf("who") !== -1 || q.indexOf("amit") !== -1 || q.indexOf("king") !== -1 || q.indexOf("about") !== -1) {
      return "Amit Ku Yadav is a Bhagalpur-based digital systems builder working across identity, websites, ventures, public communication, and social impact. Open About or Blog for the deeper story.";
    }
    return "I can guide you around kingofyadav.in: About, Blog, Services, Ventures, Collaboration, and Contact. Ask about a service, venture, article, or how to collaborate.";
  }

  function setMode(mode) {
    if (!MODES[mode]) return;
    currentMode = mode;
    localStorage.setItem(MODE_KEY, mode);
    renderModeBar();
    renderMode(mode);
    if (mode === "chat") {
      renderSuggestions();
      input.focus();
    } else {
      hideSuggestions();
    }
  }

  function renderMode(mode) {
    if (!intakeEl) return;
    intakeEl.innerHTML = "";
    var isChat = mode === "chat";
    input.style.display = isChat ? "block" : "none";
    sendBtn.style.display = isChat ? "flex" : "none";
    micBtn.style.display = isChat ? "flex" : "none";
    speakBtn.style.display = isChat ? "flex" : "none";
    suggest.style.display = isChat ? "flex" : "none";
    if (mode === "enquiry") {
      intakeEl.style.display = "block";
      intakeEl.appendChild(buildEnquiryForm());
    } else if (mode === "signup") {
      intakeEl.style.display = "block";
      intakeEl.appendChild(buildSignupForm());
    } else {
      intakeEl.style.display = "none";
    }
  }

  function buildEnquiryForm() {
    var wrap = document.createElement("div");
    wrap.className = "jrv-form";
    wrap.innerHTML =
      '<div class="jrv-form-title">Send an enquiry</div>' +
      '<div class="jrv-form-grid">' +
        '<input class="jrv-field" id="jrv-enq-name" type="text" placeholder="Name">' +
        '<input class="jrv-field" id="jrv-enq-email" type="email" placeholder="Email">' +
        '<input class="jrv-field jrv-span2" id="jrv-enq-subject" type="text" placeholder="Subject">' +
        '<textarea class="jrv-field jrv-span2" id="jrv-enq-message" rows="4" placeholder="Message"></textarea>' +
      '</div>' +
      '<div class="jrv-form-actions">' +
        '<button type="button" class="jrv-small" id="jrv-enq-cancel">Cancel</button>' +
        '<button type="button" class="jrv-primary" id="jrv-enq-send">Send enquiry</button>' +
      '</div>';
    setTimeout(function () {
      var cancel = wrap.querySelector("#jrv-enq-cancel");
      var send = wrap.querySelector("#jrv-enq-send");
      if (cancel) cancel.addEventListener("click", function () { setMode("chat"); });
      if (send) send.addEventListener("click", function () {
        submitForm("enquiry", {
          name: wrap.querySelector("#jrv-enq-name").value,
          email: wrap.querySelector("#jrv-enq-email").value,
          subject: wrap.querySelector("#jrv-enq-subject").value,
          message: wrap.querySelector("#jrv-enq-message").value
        }, "Your enquiry has been sent to Jarvis.");
      });
    }, 0);
    return wrap;
  }

  function buildSignupForm() {
    var wrap = document.createElement("div");
    wrap.className = "jrv-form";
    wrap.innerHTML =
      '<div class="jrv-form-title">Request access</div>' +
      '<div class="jrv-form-grid">' +
        '<input class="jrv-field" id="jrv-sig-name" type="text" placeholder="Name">' +
        '<input class="jrv-field" id="jrv-sig-email" type="email" placeholder="Email">' +
        '<input class="jrv-field" id="jrv-sig-handle" type="text" placeholder="Preferred handle">' +
        '<input class="jrv-field" id="jrv-sig-reason" type="text" placeholder="Reason / role">' +
        '<textarea class="jrv-field jrv-span2" id="jrv-sig-message" rows="4" placeholder="Message"></textarea>' +
      '</div>' +
      '<div class="jrv-form-actions">' +
        '<button type="button" class="jrv-small" id="jrv-sig-cancel">Cancel</button>' +
        '<button type="button" class="jrv-primary" id="jrv-sig-send">Request access</button>' +
      '</div>';
    setTimeout(function () {
      var cancel = wrap.querySelector("#jrv-sig-cancel");
      var send = wrap.querySelector("#jrv-sig-send");
      if (cancel) cancel.addEventListener("click", function () { setMode("chat"); });
      if (send) send.addEventListener("click", function () {
        submitForm("signup", {
          name: wrap.querySelector("#jrv-sig-name").value,
          email: wrap.querySelector("#jrv-sig-email").value,
          handle: wrap.querySelector("#jrv-sig-handle").value,
          reason: wrap.querySelector("#jrv-sig-reason").value,
          message: wrap.querySelector("#jrv-sig-message").value
        }, "Your access request has been sent to Jarvis.");
      });
    }, 0);
    return wrap;
  }

  function submitForm(kind, payload, successMessage) {
    var endpoint = MODES[kind] && MODES[kind].endpoint;
    if (busy) return;
    if (!endpoint) {
      appendErr("This form is offline right now. Please use the Contact page instead.");
      setMode("chat");
      return;
    }
    var hasRequired = (payload.name || "").trim() && (payload.email || "").trim();
    if (kind === "enquiry") {
      hasRequired = hasRequired && (payload.subject || "").trim() && (payload.message || "").trim();
    }
    if (!hasRequired) {
      appendErr("Please fill in the required fields.");
      return;
    }
    setBusy(true);
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({
        page: location.href
      }, payload))
    })
      .then(function (res) {
        if (res.ok) return res.json();
        return res.text().then(function (text) {
          var detail = "";
          try {
            var parsed = JSON.parse(text);
            detail = parsed && (parsed.detail || parsed.error || parsed.message || "");
          } catch (e) {
            detail = text;
          }
          if (res.status === 404 && !detail) {
            detail = "This server does not have the public intake route loaded. Restart the API with the latest code.";
          }
          var err = new Error("http_" + res.status);
          err.status = res.status;
          err.detail = detail;
          throw err;
        });
      })
      .then(function (data) {
        if (!data.ok) {
          appendErr(data.error || "Request failed.");
          return;
        }
        appendBot(successMessage || "Request sent.", true);
        setMode("chat");
      })
      .catch(function (err) {
        var msg = err.message === "rate_limit"
          ? "Too many submissions — please wait a moment."
          : (err.status === 404
            ? (err.detail || "Public intake is not available on this server yet.")
            : (err.detail || "This form is offline right now. Please use the Contact page instead."));
        appendErr(msg);
      })
      .then(function () {
        setBusy(false);
      });
  }

  function connectLiveState() {
    if (!window.WebSocket || !LIVE_ENDPOINT || !liveEl) return;
    var url = LIVE_ENDPOINT;
    if (url.charAt(0) === "/") {
      url = (location.protocol === "https:" ? "wss://" : "ws://") + location.host + url;
    } else {
      url = url.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
    }
    try {
      var socket = new WebSocket(url);
      socket.onopen = function () {
        liveAttempts = 0;
      };
      socket.onmessage = function (event) {
        try {
          var data = JSON.parse(event.data);
          var web = data && data.web ? data.web : {};
          var parts = [];
          if (web.status_line) parts.push(web.status_line);
          if (web.provider || web.model) parts.push([web.provider, web.model].filter(Boolean).join(" / "));
          liveEl.textContent = parts.join(" · ");
        } catch (e) {}
      };
      socket.onclose = function () {
        liveAttempts += 1;
        if (liveAttempts >= maxLiveAttempts) {
          liveEl.textContent = "";
          return;
        }
        setTimeout(connectLiveState, 15000);
      };
      socket.onerror = function () {
        try { socket.close(); } catch (e) {}
      };
    } catch (e) {
      liveEl.textContent = "";
    }
  }

  function setBusy(state) {
    busy = state;
    sendBtn.disabled = state;
    input.disabled = state;
    micBtn.disabled = state;
  }

  function appendUser(text, persist) {
    var el = document.createElement("div");
    el.className = "jrv-msg jrv-msg-user";
    el.textContent = text;
    msgs.appendChild(el);
    if (persist) pushHistory("user", text);
    scrollBottom();
  }

  function appendBot(text, persist) {
    if (text === lastBotText) {
      text = "Ask me about services, blogs, brands, contact, collaboration, or King Yadav’s background.";
    }
    var el = document.createElement("div");
    el.className = "jrv-msg jrv-msg-bot";
    el.textContent = text;
    msgs.appendChild(el);
    lastBotText = text;
    if (persist) pushHistory("assistant", text);
    scrollBottom();
    return el;
  }

  function appendErr(text) {
    var el = document.createElement("div");
    el.className = "jrv-msg jrv-msg-err";
    el.textContent = text;
    msgs.appendChild(el);
    scrollBottom();
  }

  function appendTyping() {
    var el = document.createElement("div");
    el.className = "jrv-typing";
    el.innerHTML = '<div class="jrv-dot"></div><div class="jrv-dot"></div><div class="jrv-dot"></div>';
    msgs.appendChild(el);
    scrollBottom();
    return el;
  }

  function appendMode(text) {
    var el = document.createElement("div");
    el.className = "jrv-mode";
    el.id = "jrv-limited-mode";
    el.textContent = text;
    msgs.appendChild(el);
    scrollBottom();
  }

  function renderSuggestions() {
    if (chatHistory.length) {
      hideSuggestions();
      return;
    }
    suggest.innerHTML = "";
    SUGGESTIONS.forEach(function (text) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "jrv-chip";
      chip.textContent = text;
      chip.addEventListener("click", function () {
        input.value = text;
        submit();
      });
      suggest.appendChild(chip);
    });
  }

  function hideSuggestions() {
    if (!suggest) return;
    suggest.style.display = "none";
    suggest.innerHTML = "";
  }

  function loadHistory() {
    try {
      var parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed.slice(-12) : [];
    } catch (e) {
      return [];
    }
  }

  function pushHistory(role, content) {
    chatHistory.push({ role: role, content: content });
    chatHistory = chatHistory.slice(-12);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(chatHistory));
    } catch (e) {}
  }

  function updateAudioControls() {
    if (!SpeechRecognition) {
      micBtn.title = "Voice input is not supported in this browser.";
    } else if (listening || voiceStarting) {
      micBtn.title = "Listening...";
    } else {
      micBtn.title = "Speak to Jarvis";
    }
    speakBtn.classList.toggle("jrv-active", speakEnabled);
    speakBtn.title = speakEnabled ? "Spoken replies on" : "Spoken replies off";
  }

  function handleVoiceButton() {
    if (listening && recognition) {
      try { recognition.stop(); } catch (e) {}
      stopVoiceIndicator();
      return;
    }
    startVoiceInput();
  }

  function startVoiceInput() {
    if (!SpeechRecognition) {
      appendErr("Voice input is not supported here. Open this site in Chrome or Edge and allow microphone access.");
      return;
    }
    if (busy || listening || voiceStarting) return;
    try {
      recognition = new SpeechRecognition();
      recognition.lang = "en-IN";
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      voiceStarting = true;
      micBtn.classList.add("jrv-listening");
      micBtn.setAttribute("aria-label", "Listening");
      updateAudioControls();

      recognition.onresult = function (event) {
        var transcript = "";
        for (var i = event.resultIndex; i < event.results.length; i += 1) {
          if (event.results[i] && event.results[i][0]) {
            transcript += event.results[i][0].transcript;
          }
        }
        if (transcript) {
          input.value = transcript.trim();
          autoResize();
          if (event.results[event.results.length - 1].isFinal) {
            submit();
          }
        }
      };
      recognition.onaudiostart = function () {
        voiceStarting = false;
        listening = true;
        updateAudioControls();
      };
      recognition.onerror = function (event) {
        var code = event && event.error ? event.error : "";
        var message = code === "not-allowed" || code === "service-not-allowed"
          ? "Microphone permission is blocked. Allow microphone access in your browser settings and try again."
          : code === "no-speech"
            ? "I did not hear anything. Click the mic and speak after the listening indicator starts."
            : "I could not hear clearly. Please try again in a quieter place.";
        appendErr(message);
      };
      recognition.onend = stopVoiceIndicator;
      recognition.start();
    } catch (e) {
      stopVoiceIndicator();
      appendErr("Voice input could not start in this browser.");
    }
  }

  function stopVoiceIndicator() {
    voiceStarting = false;
    listening = false;
    micBtn.classList.remove("jrv-listening");
    micBtn.setAttribute("aria-label", "Speak to Jarvis");
    updateAudioControls();
  }

  function toggleSpeechOutput() {
    speakEnabled = !speakEnabled;
    try {
      localStorage.setItem(SPEAK_KEY, speakEnabled ? "1" : "0");
    } catch (e) {}
    if (!speakEnabled && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    updateAudioControls();
  }

  function speakReply(text) {
    if (!speakEnabled || !window.speechSynthesis || !text) return;
    try {
      window.speechSynthesis.cancel();
      var clean = text
        .replace(/https?:\/\/\S+/g, "")
        .replace(/[•*_#`]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 650);
      var utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = "en-US";
      utterance.rate = 0.86;
      utterance.pitch = 0.92;
      utterance.volume = 1;
      var voice = chooseVoice();
      if (voice) utterance.voice = voice;
      window.speechSynthesis.speak(utterance);
    } catch (e) {}
  }

  function chooseVoice() {
    var voices = window.speechSynthesis && window.speechSynthesis.getVoices
      ? window.speechSynthesis.getVoices()
      : [];
    var preferred = ["Google US English", "Microsoft Aria", "Microsoft Jenny", "Samantha", "Alex"];
    for (var i = 0; i < preferred.length; i += 1) {
      for (var j = 0; j < voices.length; j += 1) {
        if (voices[j].name.indexOf(preferred[i]) !== -1) return voices[j];
      }
    }
    for (var k = 0; k < voices.length; k += 1) {
      if (/^en[-_](US|IN|GB)/i.test(voices[k].lang)) return voices[k];
    }
    return null;
  }

  function removeEl(el) {
    if (el && el.parentNode) { el.parentNode.removeChild(el); }
  }

  function scrollBottom() {
    msgs.scrollTop = msgs.scrollHeight;
  }

  function autoResize() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 100) + "px";
  }

  function esc(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function iconChat() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  }

  function iconClose() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  }

  function iconSend() {
    return '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polygon points="22 2 15 22 11 13 2 9 22 2" fill="#fff"/></svg>';
  }

  function iconMic() {
    return '<svg viewBox="0 0 24 24"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3z"/><path d="M19 11a7 7 0 0 1-14 0"/><path d="M12 18v4"/><path d="M8 22h8"/></svg>';
  }

  function iconSpeaker() {
    return '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18 6a8 8 0 0 1 0 12"/></svg>';
  }
})();
