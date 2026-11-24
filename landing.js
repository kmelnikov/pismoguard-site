// Cookieless 1st-party G1 funnel telemetry & waitlist submit (0 cookies, 0 localStorage, 0 3P pixels).
const WORKSPACE_ENDPOINT =
  window.PISMOGUARD_WAITLIST_URL ||
  "https://script.google.com/macros/s/AKfycbxcHkFmUU7cMmc6lQI9EiqWYuSzfXrEZjdgMfTA4ad_dGTrc5WrChMYFi3mzQSyldRd/exec";

function createEphemeralSid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "sid_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function parseAttribution(search) {
  const params = new URLSearchParams(search || "");
  const clean = (key) => (params.get(key) || "").trim().slice(0, 120);
  const utmSource = clean("utm_source");
  return {
    rawSearch: (search || "").slice(0, 400),
    utmSource,
    utmMedium: clean("utm_medium"),
    utmCampaign: clean("utm_campaign"),
    utmContent: clean("utm_content"),
    utmTerm: clean("utm_term"),
    gclid: clean("gclid"),
    fbclid: clean("fbclid"),
    bridge: utmSource === "meta_form" ? "meta_form_bridge" : "",
  };
}

function buildCompactUtm(attr, sid, role = "") {
  const parts = [];
  if (attr.rawSearch) {
    parts.push(attr.rawSearch.replace(/^\?/, ""));
  }
  parts.push("sid=" + encodeURIComponent(sid));
  if (role) {
    parts.push("role=" + encodeURIComponent(role));
  }
  return "?" + parts.join("&");
}

function sendPayload(payload) {
  if (!WORKSPACE_ENDPOINT) {
    return Promise.resolve(false);
  }
  return fetch(WORKSPACE_ENDPOINT, {
    method: "POST",
    mode: "no-cors",
    credentials: "omit",
    keepalive: true,
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
    body: JSON.stringify(payload),
  }).then(() => true);
}

function createTracker(ctx) {
  return (eventName, extra = {}) => {
    const payload = {
      type: "event",
      event: eventName,
      ts: new Date().toISOString(),
      sid: ctx.sid,
      utm: buildCompactUtm(ctx.attr, ctx.sid, extra.role || ""),
      gclid: ctx.attr.gclid,
      fbclid: ctx.attr.fbclid,
      bridge: ctx.attr.bridge,
      ...extra,
    };
    sendPayload(payload).catch((err) => {
      console.warn("PismoGuard telemetry dispatch failed", { event: eventName, message: String(err) });
    });
  };
}

function bindVideoTelemetry(trackEvent) {
  const videoEl = document.getElementById("demo-video");
  if (!videoEl) return;
  const seen = { play: false, at15s: false };
  videoEl.addEventListener("play", () => {
    if (seen.play) return;
    seen.play = true;
    trackEvent("video_play");
  });
  videoEl.addEventListener("timeupdate", () => {
    if (seen.at15s || videoEl.currentTime < 15) return;
    seen.at15s = true;
    trackEvent("video_15s");
  });
}

function bindModalAndForm(ctx, trackEvent) {
  const ui = {
    modal: document.getElementById("modal"),
    title: document.getElementById("modal-title"),
    desc: document.getElementById("modal-desc"),
    platform: document.getElementById("platform-input"),
    role: document.getElementById("role-input"),
    status: document.getElementById("form-status"),
  };
  const openModal = (platform, title, desc, clickEvent) => {
    trackEvent(clickEvent);
    ui.platform.value = platform;
    ui.title.textContent = title;
    ui.desc.textContent = desc;
    ui.status.textContent = "";
    ui.modal.classList.remove("hidden");
  };
  document.getElementById("cta-windows").addEventListener("click", () =>
    openModal(
      "windows",
      "Powiadom mnie o wersji Windows (3 sprawdzenia gratis)",
      "Zostaw służbowy e-mail kancelarii — wyślemy link do bezpłatnej wersji testowej bez karty.",
      "win_cta_click"
    )
  );
  document.getElementById("cta-macos").addEventListener("click", () =>
    openModal(
      "macos",
      "Wersja na macOS jest w kolejce — powiadom mnie",
      "Zostaw e-mail kancelarii — wyślemy 3 darmowe sprawdzenia, gdy tylko wyjdzie wersja na Mac (Apple Silicon / Intel).",
      "mac_cta_click"
    )
  );
  document.getElementById("modal-close").addEventListener("click", () => ui.modal.classList.add("hidden"));
  document.getElementById("waitlist-form").addEventListener("submit", (ev) => handleSubmit(ev, ui, ctx, trackEvent));
}

async function handleSubmit(ev, ui, ctx, trackEvent) {
  ev.preventDefault();
  if (!WORKSPACE_ENDPOINT) {
    ui.status.textContent = "Formularz zapisów nie jest jeszcze podłączony (brak adresu Google Workspace Web App).";
    return;
  }
  const fields = {
    platform: ui.platform.value,
    email: document.getElementById("email-input").value.trim(),
    nip: document.getElementById("nip-input").value.trim(),
    role: ui.role ? ui.role.value.trim() : "",
  };
  const eventName = fields.platform === "macos" ? "mac_waitlist_submit" : "win_waitlist_submit";
  ui.status.textContent = "Zapisywanie…";
  try {
    await sendPayload({
      type: "waitlist",
      event: eventName,
      ...fields,
      sid: ctx.sid,
      utm: buildCompactUtm(ctx.attr, ctx.sid, fields.role),
      gclid: ctx.attr.gclid,
      fbclid: ctx.attr.fbclid,
      bridge: ctx.attr.bridge,
    });
    trackEvent("waitlist_submit", { platform: fields.platform, role: fields.role });
    ui.status.textContent = "Dziękujemy! Zgłoszenie zostało wysłane — wyślemy wiadomość przy starcie testów.";
    ev.target.reset();
  } catch (err) {
    console.warn("PismoGuard waitlist submit failed", { event: eventName, message: String(err) });
    ui.status.textContent = "Nie udało się zapisać — spróbuj ponownie za chwilę.";
  }
}

function initLanding() {
  const ctx = { sid: createEphemeralSid(), attr: parseAttribution(window.location.search) };
  const trackEvent = createTracker(ctx);
  trackEvent("lp_view");
  bindVideoTelemetry(trackEvent);
  bindModalAndForm(ctx, trackEvent);
}

initLanding();
