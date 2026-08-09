/* "Rune Totals": the player records how many of each rune they own and gets the
   combined multiplier for every stat. Laid out like the Rune Index so the pads
   and cards read the same way they do in game. */

import runesData from "./data/runes.json";
import { runeStyle } from "./colors.js";
import { fmtBig, fmtMult, fmtNum, humanizeStat, parseNum } from "./format.js";
import { padDisplayName, padMeta, padRail } from "./pads.js";
import { buffValue, maxedCopies, statTotals } from "./runes-model.js";

const COUNTS_KEY = "dr-wiki:counts";
const TOTALS_PAD_KEY = "dr-wiki:totals-pad";

/* A flat list of 21 stats reads as noise. Grouping puts the numbers a player is
   chasing next to each other. Anything the dev adds later lands in "Other"
   rather than vanishing. */
const STAT_GROUPS = [
  ["Rune farming", ["RuneBulk", "RuneSpeed", "EventRuneBulk", "EventRuneLuck"]],
  ["Progression", ["Luck", "RebirthMulti", "PrestigeMulti"]],
  ["Currencies", ["CashMulti", "CoinMulti", "GemsMulti", "CrystalMulti", "GoldMulti", "EnergyMulti", "EventCoinsMulti"]],
  ["Space", ["FuelMulti", "SpaceCoinsMulti", "StarsMulti", "PlanetsMulti", "SolarSystemsMulti"]],
  ["Drilling", ["DrillSpeed", "DrillBulk"]],
];

function groupOf(stat) {
  const hit = STAT_GROUPS.find(([, stats]) => stats.includes(stat));
  return hit ? hit[0] : "Other";
}

export function readCounts() {
  try {
    const raw = JSON.parse(localStorage.getItem(COUNTS_KEY));
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

function writeCounts(counts) {
  try {
    localStorage.setItem(COUNTS_KEY, JSON.stringify(counts));
  } catch {
    /* storage unavailable */
  }
}

function readStore(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStore(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

function statChip(stat, entry) {
  /* Log-scaled: totals span 35 orders of magnitude, so a linear bar would read
     as empty for every stat until the last handful of copies. */
  const pct = entry.max > 1 ? (Math.log(entry.current) / Math.log(entry.max)) * 100 : 0;
  return `
    <li class="stat-chip${entry.current >= entry.max ? " full" : ""}">
      <span class="chip-stat">${humanizeStat(stat)}</span>
      <span class="chip-now">x${fmtBig(entry.current)}</span>
      <span class="chip-bar"><i style="width: ${Math.min(100, Math.max(0, pct)).toFixed(1)}%"></i></span>
      <span class="chip-max">of x${fmtBig(entry.max)}</span>
    </li>`;
}

function totalsBody(counts) {
  const totals = statTotals(runesData, counts);
  const active = [...totals.entries()].filter(([, e]) => e.current > 1);
  const owned = Object.values(counts).filter((n) => n > 0).length;

  const bulk = totals.get("RuneBulk")?.current ?? 1;
  const speed = totals.get("RuneSpeed")?.current ?? 1;
  const maxRps = (totals.get("RuneBulk")?.max ?? 1) * (totals.get("RuneSpeed")?.max ?? 1);
  const luck = totals.get("Luck");

  const headline = `
    <div class="totals-headline">
      <div class="headline-stat">
        <span class="headline-label">RPS multiplier</span>
        <strong>x${fmtBig(bulk * speed)}</strong>
        <span class="headline-sub">of x${fmtBig(maxRps)}</span>
      </div>
      <div class="headline-stat">
        <span class="headline-label">Luck</span>
        <strong>x${fmtBig(luck?.current ?? 1)}</strong>
        <span class="headline-sub">of x${fmtBig(luck?.max ?? 1)}</span>
      </div>
    </div>`;

  if (!active.length) {
    return `${headline}
      <p class="totals-empty">Record what you own on the right and your combined multipliers build up here. <strong>Max all</strong> then correcting the few runes you have not capped is usually quickest.</p>`;
  }

  const byGroup = new Map();
  for (const [stat, entry] of active) {
    const g = groupOf(stat);
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g).push([stat, entry]);
  }
  const order = [...STAT_GROUPS.map(([g]) => g), "Other"];
  const sections = order
    .filter((g) => byGroup.has(g))
    .map((g) => {
      const rows = byGroup.get(g).sort((a, b) => b[1].current - a[1].current);
      return `<section class="stat-group">
        <h4>${g}</h4>
        <ul class="stat-chips">${rows.map(([s, e]) => statChip(s, e)).join("")}</ul>
      </section>`;
    })
    .join("");

  return `${headline}
    <p class="totals-meta">${owned} of 43 runes recorded</p>
    ${sections}`;
}

/* Counts show as shorthand once the field loses focus, so a capped rune reads
   "4.1T" rather than a wall of digits. */
function displayCount(n) {
  if (!n) return "";
  return n >= 1e4 ? fmtBig(n) : String(n);
}

function countCard(padName, rune, index, counts) {
  const c = runeStyle(padName, rune, index);
  const max = maxedCopies(rune);
  const key = `${padName}::${rune.Name}`;
  const owned = counts[key] ?? 0;
  const capped = owned >= max;
  /* Buff lines show what this rune is giving the player right now, which is the
     whole payoff of typing the number in. */
  const lines = rune.Buffs.map((b) => {
    const v = buffValue(b, owned);
    const at = v >= b.MaxBuff && owned > 0;
    return `<li>${fmtMult(v)} ${humanizeStat(b.Target)}${at ? ' <span class="buff-tag">[MAX]</span>' : ""}</li>`;
  }).join("");

  return `
    <article class="count-card${capped ? " capped" : ""}" style="--accent: ${c.accent}; --from: ${c.from}; --to: ${c.to}">
      <div class="count-card-head">
        <span class="count-card-name">${rune.Name}</span>
        ${capped ? '<span class="count-badge">Max</span>' : ""}
      </div>
      <div class="count-entry">
        <input class="count-input" type="text" inputmode="numeric" spellcheck="false"
          value="${displayCount(owned)}" placeholder="0" data-key="${key}" data-max="${max}"
          aria-label="Copies of ${rune.Name} owned" />
        <span class="count-of">of ${fmtNum(max)}</span>
      </div>
      <ul class="count-buffs">${lines}</ul>
    </article>`;
}

export function renderRuneTotals(host) {
  const counts = readCounts();
  const padNames = Object.keys(runesData);
  let activePad = padNames.includes(readStore(TOTALS_PAD_KEY)) ? readStore(TOTALS_PAD_KEY) : padNames[0];

  const panelFor = (name) => {
    const pad = runesData[name];
    const recorded = pad.Runes.filter((r) => (counts[`${name}::${r.Name}`] ?? 0) > 0).length;
    return `
      <div class="panel-head">
        <div class="panel-title">
          <h3>${padDisplayName(name)}</h3>
          <p class="pad-meta">${recorded} of ${pad.Runes.length} recorded</p>
        </div>
        <span class="count-pad-actions">
          <button type="button" class="count-act" data-act="max">Max all</button>
          <button type="button" class="count-act" data-act="clear">Clear</button>
        </span>
      </div>
      <div class="count-cards">${pad.Runes.map((r, i) => countCard(name, r, i, counts)).join("")}</div>`;
  };

  host.innerHTML = `
    <p class="page-desc">Record how many copies of each rune you own. A buff of x is really a 1+x multiplier and separate buffs compound, so these totals are the product across every rune. Counts are saved on this device.</p>
    <div class="totals-layout">
      <div class="totals-side">
        <nav class="pad-rail" aria-label="Rune pads">${padRail(padNames, activePad)}</nav>
        <aside class="totals-panel" aria-live="polite">
          <h3>Your totals</h3>
          <div id="totals-body">${totalsBody(counts)}</div>
        </aside>
      </div>
      <section class="index-panel" id="counts-panel">${panelFor(activePad)}</section>
    </div>`;

  const body = document.getElementById("totals-body");
  const panel = document.getElementById("counts-panel");
  const rail = host.querySelector(".pad-rail");
  const refreshTotals = () => {
    body.innerHTML = totalsBody(counts);
  };

  /* Rewrites one card in place so typing never re-renders the field under the
     cursor. The card's buff lines depend on the count, so it has to redraw. */
  const refreshCard = (key) => {
    const card = panel.querySelector(`.count-input[data-key="${CSS.escape(key)}"]`)?.closest(".count-card");
    if (!card) return;
    const [padName, runeName] = key.split("::");
    const pad = runesData[padName];
    const index = pad.Runes.findIndex((r) => r.Name === runeName);
    const focused = document.activeElement?.dataset?.key === key;
    const raw = focused ? document.activeElement.value : null;
    card.outerHTML = countCard(padName, pad.Runes[index], index, counts);
    if (focused) {
      const next = panel.querySelector(`.count-input[data-key="${CSS.escape(key)}"]`);
      next.focus();
      next.value = raw;
      next.setSelectionRange(raw.length, raw.length);
    }
  };

  const setCount = (key, value) => {
    /* Round, not floor: 4.1 * 1e12 lands a hair under 4.1T in binary floating
       point, and flooring would store 4099999999999. */
    const n = Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
    if (n > 0) counts[key] = n;
    else delete counts[key];
    writeCounts(counts);
  };

  host.addEventListener("input", (e) => {
    const input = e.target.closest(".count-input");
    if (!input) return;
    /* parseNum accepts shorthand, so "4.1T" works as well as "150". Values above
       the cap are kept rather than clamped: a player who owns 4.1T of a rune
       should see that, and the maths caps the effect anyway. */
    setCount(input.dataset.key, parseNum(input.value));
    refreshCard(input.dataset.key);
    refreshTotals();
  });

  host.addEventListener("focusout", (e) => {
    const input = e.target.closest(".count-input");
    if (!input) return;
    input.value = displayCount(counts[input.dataset.key] ?? 0);
  });

  panel.addEventListener("click", (e) => {
    const btn = e.target.closest(".count-act");
    if (!btn) return;
    for (const input of panel.querySelectorAll(".count-input")) {
      setCount(input.dataset.key, btn.dataset.act === "max" ? Number(input.dataset.max) : 0);
    }
    panel.innerHTML = panelFor(activePad);
    refreshTotals();
  });

  rail.addEventListener("click", (e) => {
    const tab = e.target.closest(".pad-tab");
    if (!tab) return;
    activePad = tab.dataset.pad;
    writeStore(TOTALS_PAD_KEY, activePad);
    rail.innerHTML = padRail(padNames, activePad);
    panel.innerHTML = panelFor(activePad);
  });
}
