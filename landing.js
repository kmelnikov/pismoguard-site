// Configured with deployed Google Workspace Apps Script Web App URL (see web/google-workspace/SETUP_GOOGLE_WORKSPACE.md).
const WORKSPACE_ENDPOINT =
  window.PISMOGUARD_WAITLIST_URL ||
  "https://script.google.com/macros/s/AKfycbxcHkFmUU7cMmc6lQI9EiqWYuSzfXrEZjdgMfTA4ad_dGTrc5WrChMYFi3mzQSyldRd/exec";

const modal = document.getElementById("modal");
const titleEl = document.getElementById("modal-title");
const descEl = document.getElementById("modal-desc");
const platformInput = document.getElementById("platform-input");
const statusEl = document.getElementById("form-status");

function trackEvent(eventName, extra = {}) {
  const payload = {
    type: "event",
    event: eventName,
    ts: new Date().toISOString(),
    utm: window.location.search || "",
    ...extra,
  };
  if (typeof window.plausible === "function") {
    window.plausible(eventName);
  }
  if (WORKSPACE_ENDPOINT) {
    navigator.sendBeacon?.(WORKSPACE_ENDPOINT, JSON.stringify(payload));
  }
}

document.getElementById("cta-windows").addEventListener("click", () => {
  trackEvent("win_cta_click");
  platformInput.value = "windows";
  titleEl.textContent = "Powiadom mnie o wersji Windows (3 sprawdzenia gratis)";
  descEl.textContent = "Zostaw służbowy e-mail kancelarii — wyślemy link do bezpłatnej wersji testowej bez karty.";
  statusEl.textContent = "";
  modal.classList.remove("hidden");
});

document.getElementById("cta-macos").addEventListener("click", () => {
  trackEvent("mac_cta_click");
  platformInput.value = "macos";
  titleEl.textContent = "Wersja na macOS jest w kolejce — powiadom mnie";
  descEl.textContent = "Zostaw e-mail kancelarii — wyślemy 3 darmowe sprawdzenia, gdy tylko wyjdzie wersja na Mac (Apple Silicon / Intel).";
  statusEl.textContent = "";
  modal.classList.remove("hidden");
});

document.getElementById("modal-close").addEventListener("click", () => modal.classList.add("hidden"));

document.getElementById("waitlist-form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const platform = platformInput.value;
  const email = document.getElementById("email-input").value.trim();
  const nip = document.getElementById("nip-input").value.trim();
  const eventName = platform === "macos" ? "mac_waitlist_submit" : "win_waitlist_submit";

  if (!WORKSPACE_ENDPOINT) {
    statusEl.textContent = "Formularz zapisów nie jest jeszcze podłączony (brak adresu Google Workspace Web App).";
    return;
  }

  statusEl.textContent = "Zapisywanie…";
  const body = { type: "waitlist", event: eventName, platform, email, nip, utm: window.location.search || "" };

  try {
    await fetch(WORKSPACE_ENDPOINT, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    statusEl.textContent = "Dziękujemy! Zgłoszenie zostało wysłane — wyślemy wiadomość przy starcie testów.";
    ev.target.reset();
  } catch (err) {
    statusEl.textContent = "Nie udało się zapisać — spróbuj ponownie za chwilę.";
  }
});
