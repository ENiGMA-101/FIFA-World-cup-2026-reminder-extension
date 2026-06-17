// ══════════════════════════════════════════════════════════════════
// FIFA Reminder Pro  —  background.js
// Created by H4MDiL  ·  © 2026  ·  All rights reserved
// ══════════════════════════════════════════════════════════════════

// ─── FIFA Reminder Pro — Background Service Worker ───────────────────────────
const AUTHOR = "H4MDiL"; // creator signature — always present
const API_BASE = "https://api.football-data.org/v4";
const BD_OFFSET = 6 * 60; // BDT = UTC+6 in minutes

// ── Helpers ──────────────────────────────────────────────────────────────────
function utcToBDT(isoString) {
  const d = new Date(isoString);
  const utcMs = d.getTime() + d.getTimezoneOffset() * 60000;
  return new Date(utcMs + BD_OFFSET * 60000);
}

function formatBDT(date) {
  return date.toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true
  }) + " BDT";
}

async function fetchJSON(path) {
  const { apiKey } = await chrome.storage.local.get("apiKey");
  if (!apiKey) return null;
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { "X-Auth-Token": apiKey }
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// ── Core polling ──────────────────────────────────────────────────────────────
async function pollMatches() {
  const data = await fetchJSON("/competitions/WC/matches");
  if (!data?.matches) return;

  const { sent = {}, favorites = [] } = await chrome.storage.local.get(["sent", "favorites"]);
  const nowBDT = utcToBDT(new Date().toISOString());
  const todayStr = nowBDT.toDateString();

  const updated = { ...sent };
  const liveMatches = [];

  for (const m of data.matches) {
    const id = String(m.id);
    const home = m.homeTeam?.name ?? "TBD";
    const away = m.awayTeam?.name ?? "TBD";
    const kickoffBDT = utcToBDT(m.utcDate);
    const status = m.status;

    // Skip matches from before today
    if (kickoffBDT.toDateString() < todayStr && status === "FINISHED") {
      if (!updated[id]) updated[id] = { rem: true, ht: true, ft: true };
      continue;
    }

    if (!updated[id]) updated[id] = { rem: false, ht: false, ft: false };

    const isFav = favorites.length === 0 ||
      favorites.some(f => home.toLowerCase().includes(f.toLowerCase()) ||
                          away.toLowerCase().includes(f.toLowerCase()));

    const minsUntil = (kickoffBDT - nowBDT) / 60000;

    // 30-min reminder
    if (minsUntil >= 0 && minsUntil <= 30 && !updated[id].rem && isFav) {
      showNotif(`⚽ Match in ~${Math.round(minsUntil)} min!`,
        `${home} vs ${away}\n${formatBDT(kickoffBDT)}`, "reminder");
      updated[id].rem = true;
    }

    // Half-time
    if (status === "PAUSED" && !updated[id].ht && isFav) {
      const hs = m.score?.halfTime?.home ?? "?";
      const as_ = m.score?.halfTime?.away ?? "?";
      const detail = await fetchJSON(`/matches/${id}`);
      const scorers = buildScorerText(detail?.goals ?? [], home, away, true);
      showNotif(`⏸ HALF TIME: ${home} ${hs}–${as_} ${away}`,
        scorers || "Half time result", "halftime");
      updated[id].ht = true;
    }

    // Full-time
    if (status === "FINISHED" && !updated[id].ft && isFav) {
      const hs = m.score?.fullTime?.home ?? "?";
      const as_ = m.score?.fullTime?.away ?? "?";
      const detail = await fetchJSON(`/matches/${id}`);
      const scorers = buildScorerText(detail?.goals ?? [], home, away, false);
      showNotif(`🏁 FULL TIME: ${home} ${hs}–${as_} ${away}`,
        scorers || "Final result", "fulltime");
      updated[id].ft = true;
    }

    // Collect live matches for badge
    if (["IN_PLAY", "PAUSED"].includes(status)) {
      liveMatches.push(m);
    }
  }

  // Update badge
  if (liveMatches.length > 0) {
    chrome.action.setBadgeText({ text: String(liveMatches.length) });
    chrome.action.setBadgeBackgroundColor({ color: "#e63946" });
  } else {
    chrome.action.setBadgeText({ text: "" });
  }

  await chrome.storage.local.set({ sent: updated, lastFetch: Date.now(), matches: data.matches });
}

function buildScorerText(goals, home, away, htOnly) {
  if (!goals.length) return "";
  const filtered = htOnly ? goals.filter(g => (g.minute ?? 99) <= 45) : goals;
  if (!filtered.length) return "";
  return filtered.map(g => {
    const name = g.scorer?.name ?? "Unknown";
    const min = g.minute ?? "?";
    const inj = g.injuryTime ? `+${g.injuryTime}` : "";
    const type = g.type === "PENALTY" ? " (P)" : g.type === "OWN" ? " (OG)" : "";
    const team = g.team?.name ?? "";
    const side = team === home ? "🏠" : "✈️";
    return `${side} ${name}${type} ${min}${inj}'`;
  }).join("\n");
}

function showNotif(title, message, tag) {
  chrome.notifications.create(tag + "_" + Date.now(), {
    type: "basic",
    iconUrl: "icons/icon48.png",
    title,
    message: message || " ",
    priority: 2
  });
}

// ── Alarms ────────────────────────────────────────────────────────────────────
chrome.alarms.create("poll", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === "poll") pollMatches();
});

// Run once on install/update
chrome.runtime.onInstalled.addListener(() => pollMatches());
chrome.runtime.onStartup.addListener(() => pollMatches());
