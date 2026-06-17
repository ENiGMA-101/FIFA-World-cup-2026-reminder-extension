// ══════════════════════════════════════════════════════════════════
// FIFA Reminder Pro  —  popup.js
// Created by H4MDiL  ·  © 2026  ·  All rights reserved
// ══════════════════════════════════════════════════════════════════

// ─── FIFA Reminder Pro — Popup Script ────────────────────────────────────────

// Author signature — encoded in source, printed to console on load
const AUTHOR = "H4MDiL";
const APP_SIG = `%c⚽ FIFA Reminder Pro %cv1.0.0 %c· Created by ${AUTHOR}`;
console.log(
  APP_SIG,
  "background:#166b33;color:#fff;font-weight:800;padding:2px 6px;border-radius:4px 0 0 4px;",
  "background:#e63946;color:#fff;font-weight:700;padding:2px 6px;",
  "background:#f0b429;color:#000;font-weight:700;padding:2px 6px;border-radius:0 4px 4px 0;"
);

const BD_OFFSET = 6 * 60; // BDT = UTC+6 minutes

// ── Timezone helpers ──────────────────────────────────────────────────────────
function utcToBDT(iso) {
  const d = new Date(iso);
  return new Date(d.getTime() + (d.getTimezoneOffset() + BD_OFFSET) * 60000);
}

function fmtTime(d) {
  const h = d.getHours(); const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = h % 12 || 12;
  return `${hh}:${String(m).padStart(2,"0")} ${ampm}`;
}

function fmtDate(d) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtAgo(ts) {
  if (!ts) return "Never";
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return "Just now";
  if (sec < 3600) return `${Math.floor(sec/60)}m ago`;
  return `${Math.floor(sec/3600)}h ago`;
}

// ── Country flag emojis from team names ───────────────────────────────────────
const FLAGS = {
  "Brazil":"🇧🇷","Germany":"🇩🇪","France":"🇫🇷","Argentina":"🇦🇷","Spain":"🇪🇸",
  "England":"🏴󠁧󠁢󠁥󠁮󠁧󠁿","Portugal":"🇵🇹","Netherlands":"🇳🇱","Belgium":"🇧🇪","Croatia":"🇭🇷",
  "Uruguay":"🇺🇾","Denmark":"🇩🇰","Switzerland":"🇨🇭","Mexico":"🇲🇽","USA":"🇺🇸",
  "United States":"🇺🇸","Canada":"🇨🇦","Japan":"🇯🇵","South Korea":"🇰🇷","Australia":"🇦🇺",
  "Senegal":"🇸🇳","Morocco":"🇲🇦","Ghana":"🇬🇭","Cameroon":"🇨🇲","Nigeria":"🇳🇬",
  "Ecuador":"🇪🇨","Qatar":"🇶🇦","Iran":"🇮🇷","Saudi Arabia":"🇸🇦","Australia":"🇦🇺",
  "Poland":"🇵🇱","Serbia":"🇷🇸","Tunisia":"🇹🇳","Costa Rica":"🇨🇷","Wales":"🏴󠁧󠁢󠁷󠁬󠁳󠁿",
  "Turkey":"🇹🇷","Colombia":"🇨🇴","Chile":"🇨🇱","Peru":"🇵🇪","Venezuela":"🇻🇪",
  "Egypt":"🇪🇬","Algeria":"🇩🇿","Ivory Coast":"🇨🇮","Austria":"🇦🇹","Ukraine":"🇺🇦",
  "Czech Republic":"🇨🇿","Hungary":"🇭🇺","Romania":"🇷🇴","Slovakia":"🇸🇰","Slovenia":"🇸🇮",
  "Greece":"🇬🇷","Scotland":"🏴󠁧󠁢󠁳󠁣󠁴󠁿","Norway":"🇳🇴","Sweden":"🇸🇪","Finland":"🇫🇮",
  "Iraq":"🇮🇶","Panama":"🇵🇦","New Zealand":"🇳🇿","Indonesia":"🇮🇩","Paraguay":"🇵🇾",
  "Honduras":"🇭🇳","El Salvador":"🇸🇻","Jamaica":"🇯🇲","Trinidad":"🇹🇹","Cuba":"🇨🇺",
  "Bolivia":"🇧🇴","South Africa":"🇿🇦","Mali":"🇲🇱","Burkina Faso":"🇧🇫",
  "Democratic Republic of Congo":"🇨🇩","Tanzania":"🇹🇿","Kenya":"🇰🇪",
  "China PR":"🇨🇳","Uzbekistan":"🇺🇿","Thailand":"🇹🇭","Vietnam":"🇻🇳"
};

function flag(teamName) {
  if (!teamName) return "🏳️";
  for (const [k,v] of Object.entries(FLAGS)) {
    if (teamName.toLowerCase().includes(k.toLowerCase())) return v;
  }
  return "🏳️";
}

// ── State ─────────────────────────────────────────────────────────────────────
let state = {
  matches: [],
  favorites: [],
  apiKey: "",
  darkMode: true,
  notifReminder: true,
  notifScores: true,
  lastFetch: null,
  activeTab: "live"
};

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  const stored = await chrome.storage.local.get([
    "apiKey","favorites","darkMode","notifReminder","notifScores","matches","lastFetch"
  ]);

  state.matches      = stored.matches      ?? [];
  state.favorites    = stored.favorites    ?? [];
  state.apiKey       = stored.apiKey       ?? "";
  state.darkMode     = stored.darkMode     !== false; // default dark
  state.notifReminder= stored.notifReminder !== false;
  state.notifScores  = stored.notifScores   !== false;
  state.lastFetch    = stored.lastFetch    ?? null;

  applyDark();
  renderAll();
  setupListeners();

  if (!state.apiKey) {
    document.getElementById("setupBanner").style.display = "";
  }
});

// ── Listeners ─────────────────────────────────────────────────────────────────
function setupListeners() {
  // Tabs
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      state.activeTab = btn.dataset.tab;
      document.getElementById(`panel-${state.activeTab}`).classList.add("active");
      renderAll();
    });
  });

  // Dark mode
  document.getElementById("darkBtn").addEventListener("click", () => {
    state.darkMode = !state.darkMode;
    chrome.storage.local.set({ darkMode: state.darkMode });
    applyDark();
  });

  // Refresh
  document.getElementById("refreshBtn").addEventListener("click", async () => {
    const btn = document.getElementById("refreshBtn");
    btn.style.opacity = "0.4";
    await fetchLive();
    btn.style.opacity = "";
  });

  // Settings open/close
  document.getElementById("settingsBtn").addEventListener("click", openSettings);
  document.getElementById("closeSettings").addEventListener("click", () => {
    document.getElementById("settingsOverlay").style.display = "none";
  });
  document.getElementById("setupBtn")?.addEventListener("click", openSettings);

  // Save settings
  document.getElementById("saveSettings").addEventListener("click", saveSettings);
}

function applyDark() {
  document.body.classList.toggle("light", !state.darkMode);
  document.getElementById("darkBtn").textContent = state.darkMode ? "☀️" : "🌙";
}

// ── Settings ──────────────────────────────────────────────────────────────────
function openSettings() {
  document.getElementById("apiKeyInput").value = state.apiKey;
  document.getElementById("notifReminder").checked = state.notifReminder;
  document.getElementById("notifScores").checked = state.notifScores;
  document.getElementById("settingsOverlay").style.display = "";
}

async function saveSettings() {
  const key = document.getElementById("apiKeyInput").value.trim();
  state.apiKey = key;
  state.notifReminder = document.getElementById("notifReminder").checked;
  state.notifScores   = document.getElementById("notifScores").checked;

  await chrome.storage.local.set({
    apiKey: state.apiKey,
    notifReminder: state.notifReminder,
    notifScores: state.notifScores
  });

  document.getElementById("settingsOverlay").style.display = "none";

  if (key) {
    document.getElementById("setupBanner").style.display = "none";
    await fetchLive();
  }
}

// ── Fetch live data ───────────────────────────────────────────────────────────
async function fetchLive() {
  if (!state.apiKey) return;

  document.getElementById("panel-" + state.activeTab).innerHTML = `<div class="spinner"></div>`;

  try {
    const res = await fetch("https://api.football-data.org/v4/competitions/WC/matches", {
      headers: { "X-Auth-Token": state.apiKey }
    });
    if (!res.ok) throw new Error("API error " + res.status);
    const data = await res.json();
    state.matches = data.matches ?? [];
    state.lastFetch = Date.now();
    await chrome.storage.local.set({ matches: state.matches, lastFetch: state.lastFetch });
  } catch (e) {
    console.error(e);
  }

  renderAll();
}

// ── Render all panels ─────────────────────────────────────────────────────────
function renderAll() {
  renderLive();
  renderUpcoming();
  renderResults();
  renderFavorites();
  updateFooter();
}

function categorize() {
  const nowBDT = utcToBDT(new Date().toISOString());
  const live = [], upcoming = [], results = [];
  const favSet = new Set(state.favorites.map(f => f.toLowerCase()));

  for (const m of state.matches) {
    const s = m.status;
    const home = m.homeTeam?.name ?? "TBD";
    const away = m.awayTeam?.name ?? "TBD";
    const isFav = favSet.size === 0 ||
      [...favSet].some(f => home.toLowerCase().includes(f) || away.toLowerCase().includes(f));
    const obj = { ...m, isFav };

    if (["IN_PLAY","PAUSED"].includes(s)) live.push(obj);
    else if (s === "FINISHED") results.push(obj);
    else upcoming.push(obj);
  }

  upcoming.sort((a,b) => new Date(a.utcDate) - new Date(b.utcDate));
  results.sort((a,b) => new Date(b.utcDate) - new Date(a.utcDate));

  return { live, upcoming, results };
}

// ── Live Panel ────────────────────────────────────────────────────────────────
function renderLive() {
  const panel = document.getElementById("panel-live");
  const { live } = categorize();

  if (!state.apiKey) { panel.innerHTML = emptyHTML("🔑","Add API key in Settings to view live scores"); return; }
  if (!live.length) {
    panel.innerHTML = emptyHTML("📺","No matches live right now\nCheck the Upcoming tab for next matches");
    return;
  }

  panel.innerHTML = live.map(m => matchCardHTML(m, "live")).join("");
}

// ── Upcoming Panel ────────────────────────────────────────────────────────────
function renderUpcoming() {
  const panel = document.getElementById("panel-upcoming");
  const { upcoming } = categorize();

  if (!state.apiKey) { panel.innerHTML = emptyHTML("🔑","Add API key in Settings to view upcoming matches"); return; }
  if (!upcoming.length) { panel.innerHTML = emptyHTML("📅","No upcoming matches found"); return; }

  // Group by date
  const groups = {};
  for (const m of upcoming.slice(0, 30)) {
    const d = utcToBDT(m.utcDate);
    const key = fmtDate(d);
    if (!groups[key]) groups[key] = [];
    groups[key].push(m);
  }

  panel.innerHTML = Object.entries(groups).map(([date, ms]) => `
    <div style="padding:6px 4px 3px; font-size:10px; font-weight:700; color:var(--text3); text-transform:uppercase; letter-spacing:0.5px;">${date}</div>
    ${ms.map(m => matchCardHTML(m, "upcoming")).join("")}
  `).join("");
}

// ── Results Panel ─────────────────────────────────────────────────────────────
function renderResults() {
  const panel = document.getElementById("panel-results");
  const { results } = categorize();

  if (!state.apiKey) { panel.innerHTML = emptyHTML("🔑","Add API key in Settings to view results"); return; }
  if (!results.length) { panel.innerHTML = emptyHTML("🏁","No results yet"); return; }

  panel.innerHTML = results.slice(0, 20).map(m => matchCardHTML(m, "results")).join("");
}

// ── Favorites Panel ───────────────────────────────────────────────────────────
function renderFavorites() {
  const panel = document.getElementById("panel-favorites");

  panel.innerHTML = `
    <div class="fav-intro">
      Add teams to watch — you'll only get notifications for their matches.
      Leave empty to get all match alerts.
    </div>
    <div class="fav-input-row">
      <input class="fav-input" id="favInput" placeholder="e.g. France, Brazil..." />
      <button class="btn-primary" id="addFavBtn">Add</button>
    </div>
    <div class="fav-chips" id="favChips"></div>
    <div class="fav-note">💡 Partial names work — "Brazil" matches "Brazil NT"</div>
  `;

  renderFavChips();

  document.getElementById("addFavBtn").addEventListener("click", addFav);
  document.getElementById("favInput").addEventListener("keydown", e => {
    if (e.key === "Enter") addFav();
  });
}

function renderFavChips() {
  const container = document.getElementById("favChips");
  if (!container) return;
  container.innerHTML = state.favorites.map(f => `
    <div class="fav-chip">
      <span>${flag(f)} ${f}</span>
      <button class="fav-chip-remove" data-fav="${f}">✕</button>
    </div>
  `).join("") || `<span style="font-size:11px;color:var(--text3)">No favorites set — showing all matches</span>`;

  container.querySelectorAll(".fav-chip-remove").forEach(btn => {
    btn.addEventListener("click", () => removeFav(btn.dataset.fav));
  });
}

async function addFav() {
  const input = document.getElementById("favInput");
  const val = input.value.trim();
  if (!val || state.favorites.includes(val)) { input.value = ""; return; }
  state.favorites.push(val);
  await chrome.storage.local.set({ favorites: state.favorites });
  input.value = "";
  renderFavChips();
}

async function removeFav(name) {
  state.favorites = state.favorites.filter(f => f !== name);
  await chrome.storage.local.set({ favorites: state.favorites });
  renderFavChips();
}

// ── Card HTML builder ─────────────────────────────────────────────────────────
function matchCardHTML(m, mode) {
  const home = m.homeTeam?.name ?? "TBD";
  const away = m.awayTeam?.name ?? "TBD";
  const status = m.status;
  const kickoffBDT = utcToBDT(m.utcDate);
  const group = m.group ?? m.stage ?? "";

  const isFav = m.isFav;
  const favClass = isFav ? "active" : "";

  // Status badge
  let badge = "";
  if (status === "IN_PLAY") badge = `<span class="status-badge status-live">● Live</span>`;
  else if (status === "PAUSED") badge = `<span class="status-badge status-ht">HT</span>`;
  else if (status === "FINISHED") badge = `<span class="status-badge status-ft">FT</span>`;
  else badge = `<span class="status-badge status-sched">${fmtTime(kickoffBDT)}</span>`;

  // Score or kickoff
  let scoreBlock = "";
  if (["IN_PLAY","PAUSED","FINISHED"].includes(status)) {
    const hs = m.score?.fullTime?.home ?? m.score?.halfTime?.home ?? 0;
    const as_ = m.score?.fullTime?.away ?? m.score?.halfTime?.away ?? 0;
    const htH = m.score?.halfTime?.home;
    const htA = m.score?.halfTime?.away;
    const htStr = (htH !== null && htH !== undefined && status === "FINISHED")
      ? `<div class="score-ht">(${htH}–${htA} HT)</div>` : "";
    const minStr = m.minute
      ? `<div class="minute-badge">${m.minute}'</div>` : "";
    scoreBlock = `
      <div class="score-block">
        <div class="score-main">${hs}<span class="score-sep">–</span>${as_}</div>
        ${htStr}${minStr}
      </div>`;
  } else {
    scoreBlock = `
      <div class="score-block">
        <div class="kickoff-time">${fmtTime(kickoffBDT)}</div>
        <div class="kickoff-date">${fmtDate(kickoffBDT)}</div>
      </div>`;
  }

  // Scorers
  let scorersHTML = "";
  if (["IN_PLAY","PAUSED","FINISHED"].includes(status) && m.goals?.length) {
    const rows = m.goals.map(g => {
      const name = g.scorer?.name ?? "Unknown";
      const min = g.minute ?? "?";
      const inj = g.injuryTime ? `+${g.injuryTime}` : "";
      const type = g.type === "PENALTY" ? " (P)" : g.type === "OWN" ? " (OG)" : "";
      const isHome = g.team?.name === home;
      return `<div class="scorer-row ${isHome ? "scorer-home" : "scorer-away"}">
        <span class="scorer-name">⚽ ${name}${type}</span>
        <span class="scorer-min">${min}${inj}'</span>
      </div>`;
    }).join("");
    scorersHTML = `<div class="scorers"><div class="scorers-title">Goalscorers</div>${rows}</div>`;
  }

  const cardClass = status === "FINISHED" ? "finished" : ["IN_PLAY","PAUSED"].includes(status) ? "live" : "";

  return `
    <div class="match-card ${cardClass}" style="position:relative">
      <div class="match-meta">
        <span class="match-group">${group}</span>
        ${badge}
      </div>
      <div class="match-body">
        <div class="team team-home">
          <div class="team-flag">${flag(home)}</div>
          <div class="team-name">${home}</div>
        </div>
        ${scoreBlock}
        <div class="team team-away">
          <div class="team-flag">${flag(away)}</div>
          <div class="team-name">${away}</div>
        </div>
      </div>
      ${scorersHTML}
    </div>`;
}

function emptyHTML(icon, text) {
  return `<div class="empty"><div class="empty-icon">${icon}</div><div class="empty-text">${text.replace(/\n/g,"<br>")}</div></div>`;
}

function updateFooter() {
  document.getElementById("lastUpdated").textContent =
    state.lastFetch ? `Updated ${fmtAgo(state.lastFetch)}` : "Not yet fetched";
}
