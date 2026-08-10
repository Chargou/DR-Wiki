import "./styles.css";
import { version } from "../package.json";
import runesData from "./data/runes.json";
import { runeStyle } from "./colors.js";
import { fmtBig, fmtChance, fmtMult, fmtNum, humanizeStat, parseNum } from "./format.js";
import { buffCopies, maxedCopies } from "./runes-model.js";
import { PAD_NOTES, padDisplayName, padMeta, padRail } from "./pads.js";
import { readCounts, renderRuneTotals, writeCounts } from "./rune-totals.js";
import { collectData, importData, resetData } from "./settings.js";

const app = document.getElementById("app");
const versionEl = document.getElementById("site-version");
versionEl.textContent = `v${version}`;
versionEl.title = "Changelog & roadmap";

const modal = document.getElementById("version-modal");
document.getElementById("modal-version").textContent = version;
versionEl.addEventListener("click", () => modal.classList.remove("hidden"));
modal.addEventListener("click", (e) => {
  if (e.target.closest("[data-close-modal]")) modal.classList.add("hidden");
});

const settingsModal = document.getElementById("settings-modal");
const settingsStatus = document.getElementById("settings-status");
const settingsNote = (msg) => {
  settingsStatus.textContent = msg;
};
document.getElementById("settings-btn").addEventListener("click", () => settingsModal.classList.remove("hidden"));
settingsModal.addEventListener("click", (e) => {
  if (e.target.closest("[data-close-settings]")) settingsModal.classList.add("hidden");
});

const settingsExport = document.getElementById("settings-export");
settingsExport.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(collectData(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "dr-wiki-data.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  settingsNote("Exported your saved data.");
});

const settingsImport = document.getElementById("settings-import");
const settingsFile = document.getElementById("settings-file");
settingsImport.addEventListener("click", () => settingsFile.click());
settingsFile.addEventListener("change", () => {
  const file = settingsFile.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const n = importData(JSON.parse(String(reader.result)));
      settingsNote(`Imported ${n} saved values.`);
      render();
    } catch (err) {
      settingsNote(`Import failed: ${err.message}`);
    }
  };
  reader.onerror = () => settingsNote("Couldn't read that file.");
  reader.readAsText(file);
  settingsFile.value = "";
});

document.getElementById("settings-reset").addEventListener("click", () => {
  if (!window.confirm("Reset all saved data on this device? This clears your rune counts, calculator inputs and settings. This cannot be undone.")) return;
  const n = resetData();
  settingsNote(`Reset ${n} saved values.`);
  render();
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  for (const m of [settingsModal, modal]) {
    if (!m.classList.contains("hidden")) m.classList.add("hidden");
  }
});

const MAX_TAG = ' <span class="buff-tag">[MAX]</span>';

/* Both values ship in the markup and CSS shows one, so flipping a card is a
   class change: no re-render, no lost focus, and no height change, since each
   variant is a single line. */
function buffLines(rune) {
  return rune.Buffs.map((b) => {
    const stat = humanizeStat(b.Target);
    return `<li><span class="v-max">${fmtMult(b.MaxBuff)} ${stat}${MAX_TAG}</span><span class="v-copy">${fmtMult(b.Buff)} ${stat}</span></li>`;
  }).join("");
}

/* The pill is the real control, so keyboard and screen-reader users get a
   labelled toggle. Clicking anywhere on the card is a pointer shortcut onto
   the same handler: the usual card-with-primary-action pattern.
   It lives on the footer row because the header can already hold a long name
   plus the Secret badge, and a third item there wraps on narrow cards. */
function modePill(runeName, flipped) {
  return `<button type="button" class="rune-mode" aria-pressed="${flipped}" aria-label="Per-copy values for ${escapeHtml(runeName)}"><span class="v-max">Max</span><span class="v-copy">Per copy</span></button>`;
}

function runeCard(rune, index, padName) {
  const secret = !rune.Luck;
  const potionChance = rune.MinChance != null ? rune.MinChance : rune.Chance / 2;
  const luckLine = secret
    ? `Not affected by RuneLuck (Rune Luck potion halves the chance: ${fmtChance(potionChance)})`
    : rune.MinChance != null
      ? `Affected by RuneLuck: chance floor ${fmtChance(rune.MinChance)}`
      : "Affected by RuneLuck";

  const c = runeStyle(padName, rune, index);
  const flipped = flippedCards.has(flipKey(padName, rune));
  return `
    <article class="rune${flipped ? " percopy" : ""}" data-rune="${escapeHtml(rune.Name)}" style="--accent: ${c.accent}; --from: ${c.from}; --to: ${c.to}">
      <div class="rune-head">
        <span class="rune-name">${rune.Name}</span>
        ${secret ? '<span class="rune-badge">Secret</span>' : ""}
      </div>
      <div class="rune-chance">${fmtChance(rune.Chance)}</div>
      <div class="rune-luck">${luckLine}</div>
      <ul class="buffs">${buffLines(rune)}</ul>
      <div class="rune-foot">
        <span class="rune-maxed">Maxed at ${fmtNum(maxedCopies(rune))} copies</span>
        ${modePill(rune.Name, flipped)}
      </div>
    </article>`;
}

/* Cards are filtered by rune name or by any stat the rune buffs, so
   "cash" surfaces every rune that boosts CashMulti. */
function runeMatches(rune, query) {
  if (!query) return true;
  const haystack = [
    rune.Name,
    rune.Luck ? "" : "secret",
    ...rune.Buffs.map((b) => `${b.Target} ${humanizeStat(b.Target)}`),
  ]
    .join(" ")
    .toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

function runeGrid(padName, pad, query) {
  const cards = pad.Runes.map((rune, i) => ({ rune, i }))
    .filter(({ rune }) => runeMatches(rune, query))
    .map(({ rune, i }) => runeCard(rune, i, padName));
  if (!cards.length) {
    return `<p class="index-empty">No runes on this pad match &ldquo;${escapeHtml(query)}&rdquo;.</p>`;
  }
  return `<div class="runes">${cards.join("")}</div>`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

/* Cards switched to per-copy, so a filter keystroke that redraws the grid
   doesn't silently reset them. Keyed per pad: rune names are only unique
   within one. Session state, deliberately not persisted. */
const flippedCards = new Set();

function flipKey(padName, rune) {
  return `${padName}::${rune.Name}`;
}

function padPanel(name, pad, query) {
  const cost = `${fmtBig(pad.Cost.Amount)} ${humanizeStat(pad.Cost.Stat)} per roll`;
  const secretCount = pad.Runes.filter((r) => !r.Luck).length;
  const note = PAD_NOTES[name];
  return `
    <div class="panel-head">
      <div class="panel-title">
        <h2>${padDisplayName(name)}</h2>
        <p class="pad-meta">${pad.Runes.length} runes &middot; ${secretCount} secret${secretCount === 1 ? "" : "s"} &middot; ${cost}</p>
      </div>
      <input id="rune-search" class="rune-search" type="search" placeholder="Filter by rune or stat" value="${escapeHtml(query)}" aria-label="Filter runes" />
    </div>
    ${note ? `<p class="pad-note">${note}</p>` : ""}
    <div id="rune-grid">${runeGrid(name, pad, query)}</div>`;
}

function runesInfoArticle() {
  return `
    <details class="info-article" id="how-runes-work">
      <summary>How Runes Work</summary>
      <ul>
        <li>Stand on a rune pad to open runes. Each open costs the pad's listed currency and rolls once.</li>
        <li>A rune with a rarity of 1 in N has a 1/N chance per roll, and every rune on the pad is rolled independently - a single open can give several runes.</li>
        <li>RuneLuck makes runes easier to get: the effective chance is divided by your luck, down to each rune's own floor.</li>
        <li>Secret runes are not affected by RuneLuck. Only the Rune Luck potion helps, and it too is capped by the rune's floor.</li>
        <li>RPS (runes per second) = Rune Bulk &times; Rune Speed.</li>
        <li>Cards show buffs the way the game writes them: <strong>x8.00 Cash</strong> is a buff value of 8. The real effect is 1+x, so that is a 9&times; multiplier, but the game labels it x8.00 and the wiki matches it so the two agree.</li>
        <li>Click a rune card to swap between its maxed values and what a single copy adds.</li>
        <li>Boosts from different runes compound multiplicatively.</li>
        <li>Each buff is capped: it stops growing after reaching its maximum, which happens at max / per-copy copies. Caps apply per buff, per rune, per pad.</li>
        <li>Event runes (like the 100K event) use event-specific bulk, speed and luck instead of the normal ones.</li>
      </ul>
    </details>`;
}

const LAST_PAD_KEY = "dr-wiki:pad";
const HOWTO_KEY = "dr-wiki:howto";

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

function resolvePad(padNames, slug) {
  const bySlug = (s) => padNames.find((n) => padMeta(n).slug === s);
  return bySlug(slug) ?? bySlug(readStore(LAST_PAD_KEY)) ?? padNames[0];
}

function renderWiki(section, slug) {
  const padNames = Object.keys(runesData);
  /* The runes section lives at #/wiki/runes/<pad>. Redirect older #/wiki/<pad>
     links, bare #/wiki, and any other wiki section here so the address bar
     always matches what is on screen (replaceState: no second render). */
  if (section !== "runes") {
    const legacyPad = padNames.find((n) => padMeta(n).slug === section);
    const pad = legacyPad ?? slug;
    history.replaceState(null, "", `#/wiki/runes${pad ? `/${pad}` : ""}`);
    if (section !== undefined) return renderWiki("runes", pad);
  }
  const activeName = resolvePad(padNames, slug);
  const pad = runesData[activeName];
  const activeSlug = padMeta(activeName).slug;
  writeStore(LAST_PAD_KEY, activeSlug);
  /* Keep the address bar on the pad actually being shown, so a dead slug still
     produces a link that opens the same pad for someone else. */
  if (slug !== activeSlug) history.replaceState(null, "", `#/wiki/runes/${activeSlug}`);

  app.innerHTML = `
    <h2 class="page-title">Rune Index</h2>
    <p class="page-desc">Runes are a core part of Divine Rarities. They are bundled in RunePads, which cost a currency to open, and grant passive boosts to your stats. Pick a pad to see its runes.</p>
    ${runesInfoArticle()}
    <div class="rune-index">
      <nav class="pad-rail" aria-label="Rune pads">${padRail(padNames, activeName, (s) => `#/wiki/runes/${s}`)}</nav>
      <section class="index-panel" id="index-panel">${padPanel(activeName, pad, "")}</section>
    </div>`;

  const howto = document.getElementById("how-runes-work");
  howto.open = readStore(HOWTO_KEY) !== "closed";
  howto.addEventListener("toggle", () => writeStore(HOWTO_KEY, howto.open ? "open" : "closed"));

  /* The panel element is stable; only its innerHTML is swapped. Delegating
     from it means nothing needs re-binding after a redraw. */
  const panel = document.getElementById("index-panel");
  let query = "";

  panel.addEventListener("input", (e) => {
    if (e.target.id !== "rune-search") return;
    query = e.target.value.trim();
    document.getElementById("rune-grid").innerHTML = runeGrid(activeName, pad, query);
  });

  panel.addEventListener("click", (e) => {
    const card = e.target.closest(".rune");
    if (!card) return;
    /* Don't hijack a click that was the end of a text selection: dragging
       across a value to copy it shouldn't also flip the card. */
    if (String(window.getSelection() ?? "").length) return;
    const on = card.classList.toggle("percopy");
    card.querySelector(".rune-mode")?.setAttribute("aria-pressed", String(on));
    const key = `${activeName}::${card.dataset.rune}`;
    if (on) flippedCards.add(key);
    else flippedCards.delete(key);
  });
}

function placeholder(title, body) {
  return `
    <h2 class="page-title">${title}</h2>
    <div class="placeholder">${body}</div>`;
}

const SNOWBALL_RPS = new Set(["RuneBulk", "RuneSpeed", "EventRuneBulk", "EventRuneSpeed"]);
const SNOWBALL_LUCK = new Set(["RuneLuck", "EventRuneLuck"]);

function buffValueAt(buff, copies) {
  return Math.min(buff.Buff * copies, buff.MaxBuff);
}

function runeSnowballs(rune) {
  return rune.Buffs.some((b) => SNOWBALL_RPS.has(b.Target) || (rune.Luck && SNOWBALL_LUCK.has(b.Target)));
}

function snowballMult(rune, copies) {
  let rps = 1;
  let luck = 1;
  for (const b of rune.Buffs) {
    const v = 1 + buffValueAt(b, copies);
    if (SNOWBALL_RPS.has(b.Target)) rps *= v;
    else if (rune.Luck && SNOWBALL_LUCK.has(b.Target)) luck *= v;
  }
  return { rps, luck };
}

function effChance(rune, luck, potion) {
  const div = rune.Luck ? Math.max(luck, 1) : potion ? 2 : 1;
  return Math.max(rune.Chance / div, rune.MinChance ?? 0);
}

function expectedRolls(rune, { luck, potion, current, goal }) {
  if (goal <= current) return 0;
  if (!runeSnowballs(rune)) return (goal - current) * effChance(rune, luck, potion);
  const m0 = snowballMult(rune, current);
  const baseLuck = luck / m0.luck;
  let total = 0;
  for (let copies = current; copies < goal; copies++) {
    const m = snowballMult(rune, copies);
    total += effChance(rune, baseLuck * m.luck, potion);
  }
  return total;
}

function expectedTime(rune, { rps, luck, potion, current, goal }) {
  if (goal <= current) return 0;
  if (!runeSnowballs(rune)) {
    return ((goal - current) * effChance(rune, luck, potion)) / rps;
  }
  const m0 = snowballMult(rune, current);
  const baseRPS = rps / m0.rps;
  const baseLuck = luck / m0.luck;
  let total = 0;
  for (let copies = current; copies < goal; copies++) {
    const m = snowballMult(rune, copies);
    total += effChance(rune, baseLuck * m.luck, potion) / (baseRPS * m.rps);
  }
  return total;
}

/* A rune is "snowballing" while at least one of its RuneBulk/RuneSpeed/RuneLuck
   (or event variant) buffs still has headroom. The "Luck" stat is separate from
   RuneLuck: Luck buffs affect drops elsewhere and never speed up rune farming,
   so they are not snowballing here. A buffing rune's own Luck flag (whether
   RuneLuck helps it) does not gate its buff's contribution: the shared RuneLuck
   stat rises for everyone, and effChance applies it only to the runes RuneLuck
   actually helps. */
function snowballCandidate(rune, copies) {
  return rune.Buffs.some(
    (b) => (SNOWBALL_RPS.has(b.Target) || SNOWBALL_LUCK.has(b.Target)) && buffValueAt(b, copies) < b.MaxBuff,
  );
}

function padRates(pad, copies) {
  let rps = 1;
  let luck = 1;
  for (const rune of pad.Runes) {
    const c = copies[rune.Name] ?? 0;
    for (const b of rune.Buffs) {
      const v = 1 + buffValueAt(b, c);
      if (SNOWBALL_RPS.has(b.Target)) rps *= v;
      else if (SNOWBALL_LUCK.has(b.Target)) luck *= v;
    }
  }
  return { rps, luck };
}

/* Expected seconds to reach `goal` copies of `target` while the whole pad is
   being rolled. Other runes you own (or pick up along the way) snowball the
   rate too, so the RPS/luck the player entered are factored back to their base
   and re-grow from every rune's buffs.

   Each step advances whichever rune is closest to its next copy: the target
   competes with the non-maxed snowball runes (advancing a snowball rune one
   copy is worth it when it needs fewer rolls than the target does). During that
   step every other rune gains copies in proportion to its expected rate, so
   nothing is double counted. When only the target can snowball (or nothing
   can), this is exactly the single-rune calc, so that path is taken directly. */
function expectedTimeAll(pad, counts, target, goal, { rps, luck, potion }) {
  const cur = counts[target.Name] ?? 0;
  if (goal <= cur) return { time: 0, copies: { ...counts } };
  const otherSnow = pad.Runes.some((r) => r.Name !== target.Name && snowballCandidate(r, counts[r.Name] ?? 0));
  if (!otherSnow) {
    return {
      time: expectedTime(target, { rps, luck, potion, current: cur, goal }),
      copies: { ...counts, [target.Name]: goal },
    };
  }

  const base = padRates(pad, counts);
  const baseRps = rps / base.rps;
  const baseLuck = luck / base.luck;
  const copies = { ...counts };
  let time = 0;
  while ((copies[target.Name] ?? 0) < goal) {
    const rates = padRates(pad, copies);
    const curLuck = baseLuck * rates.luck;
    const curRps = baseRps * rates.rps;
    let best = null;
    let bestRolls = Infinity;
    for (const rune of pad.Runes) {
      const c = copies[rune.Name] ?? 0;
      const advancing = rune.Name === target.Name ? c < goal : snowballCandidate(rune, c);
      if (!advancing) continue;
      const rolls = effChance(rune, curLuck, potion) * (1 - (c % 1));
      if (rolls < bestRolls) {
        bestRolls = rolls;
        best = rune;
      }
    }
    copies[best.Name] = Math.floor(copies[best.Name]) + 1;
    time += bestRolls / curRps;
    for (const rune of pad.Runes) {
      if (rune.Name === best.Name) continue;
      copies[rune.Name] = (copies[rune.Name] ?? 0) + bestRolls / effChance(rune, curLuck, potion);
    }
  }
  return { time, copies };
}

function formatDuration(seconds) {
  if (seconds < 0.01) return seconds > 0 ? "less than a second" : "0 seconds";
  if (seconds < 60) return `${fmtNum(Math.round(seconds * 100) / 100)} seconds`;
  const units = [
    ["year", 31557600],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (let i = 0; i < units.length; i++) {
    const [name, size] = units[i];
    if (seconds >= size) {
      const v = seconds / size;
      if (v >= 1000) return `${fmtBig(v)} ${name}s`;
      const whole = Math.floor(v);
      const rem = seconds - whole * size;
      const next = units[i + 1];
      if (next && rem >= next[1]) {
        const r = Math.floor(rem / next[1]);
        return `${whole} ${name}${whole === 1 ? "" : "s"} ${r} ${next[0]}${r === 1 ? "" : "s"}`;
      }
      return `${fmtNum(Math.round(v * 100) / 100)} ${name}s`;
    }
  }
  return "0 seconds";
}

function formatDurationPrecise(seconds) {
  if (seconds < 0.01) return seconds > 0 ? "less than a second" : "0 seconds";
  if (seconds < 60) return `${fmtNum(Math.round(seconds * 100) / 100)}s`;
  let s = Math.round(seconds);
  const units = [
    ["y", 31557600],
    ["d", 86400],
    ["h", 3600],
    ["m", 60],
    ["s", 1],
  ];
  const parts = [];
  for (const [name, size] of units) {
    const v = Math.floor(s / size);
    if (v > 0) {
      parts.push(`${v}${name}`);
      s -= v * size;
    }
  }
  return parts.join("") || "0s";
}

function calcSelectOptions() {
  return Object.entries(runesData)
    .map(([padName, pad]) => {
      const opts = pad.Runes.map(
        (r) =>
          `<option value="${padName}::${r.Name}">${r.Name} - 1 in ${fmtBig(r.Chance)}${r.Luck ? "" : " (secret)"}</option>`,
      ).join("");
      return `<optgroup label="${padDisplayName(padName)}">${opts}</optgroup>`;
    })
    .join("");
}

const CALCULATORS = [
  ["time", "Rune Time"],
  ["pad", "Pad Time"],
  ["totals", "Rune Totals"],
];

function calcSubNav(active) {
  return `<nav class="sub-tabs" aria-label="Calculators">${CALCULATORS.map(
    ([slug, label]) =>
      `<a class="sub-tab${slug === active ? " active" : ""}" href="#/calculators/${slug}" aria-current="${slug === active ? "page" : "false"}">${label}</a>`,
  ).join("")}</nav>`;
}

function renderCalculators(slug) {
  const active = CALCULATORS.some(([s]) => s === slug) ? slug : "time";
  /* Same canonicalising as the wiki: a bare #/calculators still yields a link
     that opens the same sub-page for someone else. */
  if (slug !== active) history.replaceState(null, "", `#/calculators/${active}`);

  app.innerHTML = `
    <h2 class="page-title">Calculators</h2>
    ${calcSubNav(active)}
    <div id="calc-host"></div>`;

  const host = document.getElementById("calc-host");
  if (active === "totals") return renderRuneTotals(host);
  if (active === "pad") return renderPadTime(host);
  return renderRuneTime(host);
}

function renderRuneTime(host) {
  host.innerHTML = `
    <p class="page-desc">On average, how long it takes to reach a goal number of copies of a rune. Every roll rolls the whole pad, so each copy of the rune takes <em>effective chance / RPS</em> time; snowballing runes (those that boost rune luck, rune bulk or rune speed) get faster as you farm them, which the calc accounts for copy by copy.</p>
    <section class="calc">
      <div class="calc-grid">
        <label>Target rune
          <select id="calc-rune">${calcSelectOptions()}</select>
        </label>
        <label>Runes per second
          <input id="calc-rps" type="text" inputmode="decimal" placeholder="1, 2.3k, 17.7M" />
        </label>
        <label>RuneLuck
          <input id="calc-luck" type="text" inputmode="decimal" placeholder="1, 250, 2.3k" />
        </label>
        <label class="calc-check hidden"><input id="calc-potion" type="checkbox" /> Rune Luck potion active</label>
        <label>Copies owned
          <input id="calc-current" type="number" min="0" step="1" value="0" />
          <span id="calc-owned-note" class="field-note"></span>
        </label>
        <label>Goal copies
          <input id="calc-goal" type="number" min="1" step="1" />
          <span id="calc-goal-suggestions" class="goal-suggestions"></span>
        </label>
      </div>
      <div id="calc-result" class="calc-result"></div>
    </section>`;

  const select = document.getElementById("calc-rune");
  const rps = document.getElementById("calc-rps");
  const luck = document.getElementById("calc-luck");
  const potion = document.getElementById("calc-potion");
  const potionRow = potion.closest("label");
  const current = document.getElementById("calc-current");
  const ownedNote = document.getElementById("calc-owned-note");
  const goal = document.getElementById("calc-goal");
  const suggestions = document.getElementById("calc-goal-suggestions");
  const result = document.getElementById("calc-result");

  function getSelection() {
    const [padName, runeName] = select.value.split("::");
    const pad = runesData[padName] ?? Object.values(runesData)[0];
    const rune = pad.Runes.find((r) => r.Name === runeName) ?? pad.Runes[0];
    return { rune, pad };
  }

  function saveState() {
    try {
      localStorage.setItem(
        "dr-wiki:calc",
        JSON.stringify({
          rune: select.value,
          rps: rps.value,
          luck: luck.value,
          potion: potion.checked,
          current: current.value,
          goal: goal.value,
        }),
      );
    } catch {
      /* storage unavailable */
    }
  }

  function loadState() {
    try {
      return JSON.parse(localStorage.getItem("dr-wiki:calc")) || null;
    } catch {
      return null;
    }
  }

  function goalSuggestions(rune) {
    const byTarget = new Map();
    for (const b of rune.Buffs) {
      byTarget.set(b.Target, Math.max(byTarget.get(b.Target) ?? 0, buffCopies(b)));
    }
    const items = [{ label: "Max all buffs", copies: maxedCopies(rune) }];
    for (const [target, copies] of byTarget) {
      items.push({ label: `Max ${humanizeStat(target)} buff`, copies });
    }
    return items;
  }

  function renderGoalSuggestions(rune) {
    suggestions.innerHTML = goalSuggestions(rune)
      .map((it) => `<button type="button" class="goal-chip" data-copies="${it.copies}">${it.label}: ${fmtNum(it.copies)}</button>`)
      .join("");
  }

  function onRuneChange() {
    const { rune } = getSelection();
    const secret = !rune.Luck;
    luck.disabled = secret;
    potion.disabled = !secret;
    potionRow.classList.toggle("hidden", !secret);
    /* Prefill from what the player recorded on the Rune Totals tab, so the two
       calculators agree instead of asking for the same number twice. */
    const owned = readCounts()[select.value] ?? 0;
    current.value = Math.min(owned, maxedCopies(rune));
    ownedNote.textContent = owned > 0 ? "from your Rune Totals" : "";
    goal.value = maxedCopies(rune);
    goal.max = maxedCopies(rune);
    renderGoalSuggestions(rune);
    recalc();
  }

  function recalc() {
    saveState();
    const { rune, pad } = getSelection();
    const rpsRaw = rps.value.trim();
    const luckRaw = luck.value.trim();
    const rpsVal = rpsRaw === "" ? 1 : parseNum(rpsRaw);
    const luckVal = luckRaw === "" ? 1 : parseNum(luckRaw);
    const curVal = Math.max(0, Math.floor(parseFloat(current.value) || 0));
    const goalVal = Math.max(0, Math.floor(parseFloat(goal.value) || 0));

    if (!(rpsVal > 0)) return fail("Enter a positive RPS.");
    if (!rune.Luck && !(luckVal >= 1)) return fail("RuneLuck must be at least 1.");
    if (goalVal < curVal) return fail("The goal must be at least the copies you own.");

    const opts = {
      rps: rpsVal,
      luck: Math.max(luckVal, 1),
      potion: potion.checked,
      current: curVal,
      goal: goalVal,
    };
    const secs = expectedTime(rune, opts);

    const snow = runeSnowballs(rune);
    const m0 = snowballMult(rune, curVal);
    const mg = snowballMult(rune, goalVal);
    const parts = [];
    if (mg.rps !== m0.rps) parts.push(`${fmtNum(mg.rps / m0.rps)}x RPS`);
    if (mg.luck !== m0.luck) parts.push(`${fmtNum(mg.luck / m0.luck)}x luck`);

    const need = goalVal - curVal;
    const spent = expectedRolls(rune, opts) * pad.Cost.Amount;
    result.innerHTML = `
      <h3 class="calc-total">Expected time: <strong title="${formatDurationPrecise(secs)}">${formatDuration(secs)}</strong></h3>
      <p class="calc-note">
        ${need} more cop${need === 1 ? "y" : "ies"} (from ${curVal} to ${goalVal}) &middot; effective chance ${fmtChance(effChance(rune, Math.max(luckVal, 1), potion.checked))} per roll
        &middot; ${snow ? "snowballing rune" : "flat rate"}
      </p>
      <p class="calc-note">You'll spend <strong>${fmtBig(spent)} ${humanizeStat(pad.Cost.Stat)}</strong> on rolls (${fmtBig(expectedRolls(rune, opts))} opens at ${fmtBig(pad.Cost.Amount)} each).</p>
      ${snow ? `<p class="calc-note">${parts.length ? `Over the run your stats grow to <strong>${parts.join(", ")}</strong>. Buffs already granted by your current copies were factored out of the RPS/luck you entered.` : "Your snowballing buffs are already maxed at this progress, so the rate stays flat from here."}</p>` : ""}
    `;

    function fail(msg) {
      result.innerHTML = `<p class="calc-error">${msg}</p>`;
    }
  }

  select.addEventListener("change", onRuneChange);
  for (const el of [rps, luck, potion, current, goal]) {
    el.addEventListener("input", recalc);
  }
  let hideTimer = null;
  suggestions.addEventListener("mousedown", (e) => e.preventDefault());
  goal.addEventListener("focus", () => {
    clearTimeout(hideTimer);
    suggestions.classList.add("show");
  });
  goal.addEventListener("blur", () => {
    hideTimer = setTimeout(() => suggestions.classList.remove("show"), 150);
  });
  suggestions.addEventListener("click", (e) => {
    const chip = e.target.closest(".goal-chip");
    if (!chip) return;
    goal.value = chip.dataset.copies;
    recalc();
  });

  const saved = loadState();
  if (saved) {
    const [p, r] = String(saved.rune || "").split("::");
    if (runesData[p] && runesData[p].Runes.some((x) => x.Name === r)) {
      select.value = saved.rune;
    }
    rps.value = saved.rps ?? "";
    luck.value = saved.luck ?? "";
    potion.checked = !!saved.potion;
  }
  onRuneChange();
  if (saved) {
    const max = maxedCopies(getSelection().rune);
    const cur = Math.min(Math.max(0, Math.floor(parseFloat(saved.current) || 0)), max);
    const gl = Math.min(Math.max(cur, Math.floor(parseFloat(saved.goal) || 0)), max);
    current.value = cur;
    goal.value = gl;
    recalc();
  }
}

function renderPadTime(host) {
  host.innerHTML = `
    <p class="page-desc">How long to reach a goal number of copies of one rune while rolling the whole pad. Unlike the single-rune calculator, the other runes you own keep snowballing the rate as well: the calculator simulates the copies that drop along the way, re-applying their buffs as they arrive. Counts are prefilled from, and saved back to, your Rune Totals. RuneLuck and the potion are never locked here: RuneLuck speeds every non-secret (including the ones that snowball your RPS), while the potion's 2&times; is already baked into the RuneLuck you enter and only additionally halves the odds of secret drops.</p>
    <section class="calc">
      <div class="calc-grid">
        <label>Pad
          <select id="pad-calc-pad">${Object.keys(runesData).map((p) => `<option value="${p}">${padDisplayName(p)}</option>`).join("")}</select>
        </label>
        <label>Target rune
          <select id="pad-calc-rune"></select>
        </label>
        <label>Runes per second
          <input id="pad-calc-rps" type="text" inputmode="decimal" placeholder="1, 2.3k, 17.7M" />
        </label>
        <label>RuneLuck
          <input id="pad-calc-luck" type="text" inputmode="decimal" placeholder="1, 250, 2.3k" />
        </label>
        <label class="calc-check"><input id="pad-calc-potion" type="checkbox" /> Rune Luck potion active</label>
        <label>Goal copies
          <input id="pad-calc-goal" type="number" min="1" step="1" />
        </label>
      </div>
      <div class="pad-counts">
        <h3>Runes in this pad <span class="pad-counts-note">edits update your Rune Totals</span></h3>
        <div id="pad-calc-counts" class="pad-count-grid"></div>
      </div>
      <div id="pad-calc-result" class="calc-result"></div>
    </section>`;

  const padSelect = document.getElementById("pad-calc-pad");
  const runeSelect = document.getElementById("pad-calc-rune");
  const rps = document.getElementById("pad-calc-rps");
  const luck = document.getElementById("pad-calc-luck");
  const potion = document.getElementById("pad-calc-potion");
  const goal = document.getElementById("pad-calc-goal");
  const countsBox = document.getElementById("pad-calc-counts");
  const result = document.getElementById("pad-calc-result");

  function getPad() {
    return runesData[padSelect.value];
  }

  function padCounts() {
    const all = readCounts();
    const out = {};
    for (const r of getPad().Runes) out[r.Name] = all[`${padSelect.value}::${r.Name}`] ?? 0;
    return out;
  }

  function getSelection() {
    const pad = getPad();
    const rune = pad.Runes.find((r) => r.Name === runeSelect.value) ?? pad.Runes[0];
    return { rune, pad };
  }

  function saveState() {
    try {
      localStorage.setItem(
        "dr-wiki:pad-calc",
        JSON.stringify({
          pad: padSelect.value,
          rune: runeSelect.value,
          rps: rps.value,
          luck: luck.value,
          potion: potion.checked,
          goal: goal.value,
        }),
      );
    } catch {
      /* storage unavailable */
    }
  }

  function loadState() {
    try {
      return JSON.parse(localStorage.getItem("dr-wiki:pad-calc")) || null;
    } catch {
      return null;
    }
  }

  function displayCount(n) {
    if (!n) return "";
    return n >= 1e4 ? fmtBig(n) : String(n);
  }

  function renderRunes() {
    runeSelect.innerHTML = getPad()
      .Runes.map(
        (r) => `<option value="${r.Name}">${r.Name} - 1 in ${fmtBig(r.Chance)}${r.Luck ? "" : " (secret)"}</option>`,
      )
      .join("");
  }

  function renderCounts() {
    const owned = padCounts();
    countsBox.innerHTML = getPad()
      .Runes.map(
        (r) => `
        <div class="pad-count">
          <span class="pad-count-name">${r.Name}</span>
          <div class="pad-count-row">
            <input type="text" inputmode="numeric" spellcheck="false" data-key="${r.Name}"
              value="${displayCount(owned[r.Name])}" placeholder="0" aria-label="Copies of ${r.Name} owned" />
            <button type="button" class="pad-max" data-key="${r.Name}" data-max="${maxedCopies(r)}"
              title="Set ${r.Name} to its max copies" aria-pressed="false">Max</button>
          </div>
        </div>`,
      )
      .join("");
    syncMaxButtons();
  }

  function syncMaxButtons() {
    const all = readCounts();
    for (const btn of countsBox.querySelectorAll(".pad-max")) {
      const on = (all[`${padSelect.value}::${btn.dataset.key}`] ?? 0) >= parseFloat(btn.dataset.max);
      btn.classList.toggle("on", on);
      btn.setAttribute("aria-pressed", String(on));
    }
  }

  function onPadChange() {
    renderRunes();
    renderCounts();
    onRuneChange();
  }

  function onRuneChange() {
    const { rune } = getSelection();
    /* RuneLuck and the potion are never locked in this calculator: the pad
       drops a mix of normal and secret runes, so RuneLuck can speed the
       non-secrets that snowball your RPS and the potion is the only thing that
       helps secret drops. */
    goal.max = maxedCopies(rune);
    if (!goal.value) goal.value = maxedCopies(rune);
    recalc();
  }

  function recalc() {
    saveState();
    const pName = padSelect.value;
    const pad = getPad();
    const { rune } = getSelection();
    const rpsVal = parseNum(rps.value);
    const luckVal = luck.value === "" ? 1 : parseNum(luck.value);
    const goalVal = Math.max(1, Math.floor(parseFloat(goal.value) || 0));
    const owned = padCounts();
    const cur = owned[rune.Name] ?? 0;

    function fail(msg) {
      result.innerHTML = `<p class="calc-error">${msg}</p>`;
    }

    if (!(rpsVal > 0)) return fail("Enter a positive RPS.");
    if (!(luckVal >= 1)) return fail("RuneLuck must be at least 1.");
    if (goalVal <= cur) return fail(`You already own ${fmtNum(cur)} copies of ${rune.Name}.`);

    const sim = expectedTimeAll(pad, owned, rune, goalVal, {
      rps: rpsVal,
      luck: Math.max(luckVal, 1),
      potion: potion.checked,
    });

    const maxed = [];
    const gained = [];
    for (const r of pad.Runes) {
      if (r.Name === rune.Name) continue;
      const n = sim.copies[r.Name] ?? 0;
      if (n <= (owned[r.Name] ?? 0) + 0.5) continue;
      if (n >= maxedCopies(r)) maxed.push(r.Name);
      else gained.push({ name: r.Name, n: n - (owned[r.Name] ?? 0) });
    }
    gained.sort((a, b) => b.n - a.n);
    const gainedList = gained.slice(0, 6).map((g) => `${fmtNum(Math.round(g.n * 100) / 100)} ${g.name}`);

    const m0 = padRates(pad, owned);
    const mg = padRates(pad, sim.copies);
    const growth = [];
    if (mg.rps !== m0.rps) growth.push(`RPS ${fmtNum(mg.rps / m0.rps)}x`);
    if (mg.luck !== m0.luck) growth.push(`luck ${fmtNum(mg.luck / m0.luck)}x`);
    const growing = growth.length > 0;

    const alongside = [];
    if (maxed.length) alongside.push(`max <strong>${maxed.join(", ")}</strong>`);
    if (gainedList.length) alongside.push(`get <strong>${gainedList.join(", ")}</strong>`);

    result.innerHTML = `
      <h3 class="calc-total">Expected time: <strong title="${formatDurationPrecise(sim.time)}">${formatDuration(sim.time)}</strong></h3>
      <p class="calc-note">From ${fmtNum(cur)} to ${fmtNum(goalVal)} copies of <strong>${rune.Name}</strong> on the ${padDisplayName(pName)} pad${rune.Luck ? "" : " (secret rune, RuneLuck does not help it)"}.</p>
      ${growing ? `<p class="calc-note">Along the way you'll ${alongside.join(" and ")}, and your snowball multipliers grow to <strong>${growth.join(", ")}</strong>.</p>` : `<p class="calc-note">All snowballing runes are maxed, so the rate stays flat the whole run.</p>`}`;
  }

  padSelect.addEventListener("change", onPadChange);
  runeSelect.addEventListener("change", onRuneChange);
  for (const el of [rps, luck, potion, goal]) el.addEventListener("input", recalc);

  countsBox.addEventListener("input", (e) => {
    const input = e.target.closest("input[data-key]");
    if (!input) return;
    const key = `${padSelect.value}::${input.dataset.key}`;
    const all = readCounts();
    const n = parseNum(input.value);
    if (Number.isFinite(n) && n > 0) all[key] = Math.round(n);
    else delete all[key];
    writeCounts(all);
    syncMaxButtons();
    recalc();
  });

  countsBox.addEventListener("click", (e) => {
    const btn = e.target.closest(".pad-max");
    if (!btn) return;
    const all = readCounts();
    const key = `${padSelect.value}::${btn.dataset.key}`;
    const max = parseFloat(btn.dataset.max);
    all[key] = max;
    writeCounts(all);
    const input = countsBox.querySelector(`input[data-key="${CSS.escape(btn.dataset.key)}"]`);
    if (input) input.value = displayCount(max);
    syncMaxButtons();
    recalc();
  });

  countsBox.addEventListener("focusout", (e) => {
    const input = e.target.closest("input[data-key]");
    if (!input) return;
    const n = readCounts()[`${padSelect.value}::${input.dataset.key}`] ?? 0;
    input.value = displayCount(n);
  });

  const saved = loadState();
  if (saved && runesData[saved.pad]) padSelect.value = saved.pad;
  renderRunes();
  if (saved && getPad().Runes.some((r) => r.Name === saved.rune)) runeSelect.value = saved.rune;
  renderCounts();
  rps.value = saved?.rps ?? "";
  luck.value = saved?.luck ?? "";
  potion.checked = !!saved?.potion;
  onRuneChange();
  if (saved?.goal) {
    const max = maxedCopies(getSelection().rune);
    goal.value = Math.min(Math.max(1, Math.floor(parseFloat(saved.goal) || 0)), max);
    recalc();
  }
}

function renderGuides() {
  app.innerHTML = placeholder(
    "Guides",
    "Coming soon. Written guides for new players: order of progression, secret code hints, and more.",
  );
}

const routes = {
  wiki: renderWiki,
  calculators: renderCalculators,
  guides: renderGuides,
};

function currentRoute() {
  const m = location.hash.match(/^#\/([a-z]+)(?:\/([a-z0-9-]+)(?:\/([a-z0-9-]+))?)?/i);
  const route = m && m[1].toLowerCase() in routes ? m[1].toLowerCase() : "wiki";
  return {
    route,
    section: m && m[2] ? m[2].toLowerCase() : null,
    sub: m && m[3] ? m[3].toLowerCase() : null,
  };
}

function render() {
  const { route, section, sub } = currentRoute();
  if (route === "wiki") renderWiki(section, sub);
  else routes[route](section);
  document.querySelectorAll(".tabs a").forEach((a) => {
    a.classList.toggle("active", a.dataset.route === route);
  });
}

render();
window.addEventListener("hashchange", render);
