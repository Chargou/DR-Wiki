import "./styles.css";
import { version } from "../package.json";
import runesData from "./data/runes.json";
import { runeStyle } from "./colors.js";

const app = document.getElementById("app");
document.getElementById("site-version").textContent = `v${version}`;

const STAT_DISPLAY = {
  CashMulti: "Cash",
  CoinMulti: "Coins",
  CrystalMulti: "Crystals",
  GemsMulti: "Gems",
  EnergyMulti: "Energy",
  FuelMulti: "Fuel",
  SpaceCoinsMulti: "Space Coins",
  StarsMulti: "Stars",
  PlanetsMulti: "Planets",
  SolarSystemsMulti: "Solar Systems",
  GoldMulti: "Gold",
  Luck: "Luck",
  RebirthMulti: "Rebirth",
  PrestigeMulti: "Prestige",
  EventCoinsMulti: "Event Coins",
  RuneBulk: "Rune Bulk",
  RuneSpeed: "Rune Speed",
  EventRuneBulk: "Event Rune Bulk",
  EventRuneLuck: "Event Rune Luck",
  DrillSpeed: "Drill Speed",
  DrillBulk: "Drill Bulk",
};

function humanizeStat(name) {
  if (STAT_DISPLAY[name]) return STAT_DISPLAY[name];
  return name.replace(/([A-Z])/g, " $1").replace(/^ /, "");
}

function padDisplayName(name) {
  return `${name.replace(/RunePad$/, "")} RunePad`;
}

/* Pad tab styling, mirroring the in-game Rune Index rail. Pads the game adds
   later fall back to a neutral tab so the index keeps working without edits. */
const PAD_META = {
  BasicRunePad: { label: "Basic", slug: "basic", from: "#f4f6f9", to: "#aab3c0", ink: "#161c26" },
  SandRunePad: { label: "Sand", slug: "sand", from: "#ffe2b0", to: "#ffb457", ink: "#3d2405" },
  SpaceRunePad: { label: "Space", slug: "space", from: "#9333ea", to: "#5b06c4", ink: "#ffffff" },
  EventRunePad: { label: "100K", slug: "100k", from: "#c2f89e", to: "#6ddc32", ink: "#14330a" },
};

const PAD_NOTES = {
  EventRunePad:
    "Event pad: uses Event Rune Bulk, Speed and Luck instead of the normal rune stats. It celebrates 100k visits and may be temporary.",
};

function padMeta(name) {
  if (PAD_META[name]) return PAD_META[name];
  const label = name.replace(/RunePad$/, "") || name;
  return {
    label,
    slug: label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "pad",
    from: "#3a4658",
    to: "#232c3a",
    ink: "#e6edf3",
  };
}

function fmtNum(n) {
  if (Number.isInteger(n)) return String(n);
  const r = Math.round(n * 1e4) / 1e4;
  return String(r);
}

const SCALES = [
  [1e3, "K"], [1e6, "M"], [1e9, "B"], [1e12, "T"], [1e15, "Qa"], [1e18, "Qi"],
  [1e21, "Sx"], [1e24, "Sp"], [1e27, "Oc"], [1e30, "No"], [1e33, "Dc"],
];

const SCALE_MULT = {
  k: 1e3, m: 1e6, b: 1e9, t: 1e12, qa: 1e15, qi: 1e18, sx: 1e21,
  sp: 1e24, oc: 1e27, no: 1e30, dc: 1e33,
};

function parseNum(str) {
  const m = String(str).trim().match(/^([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z]*)$/);
  if (!m) return NaN;
  const num = parseFloat(m[1]);
  const suf = m[2].toLowerCase();
  return suf ? num * (SCALE_MULT[suf] ?? NaN) : num;
}

function fmtBig(n) {
  if (n < 1e3) return String(n);
  let scale = null;
  for (const [t, s] of SCALES) {
    if (n >= t) scale = [t, s];
    else break;
  }
  if (!scale) return n.toExponential(2).replace(/\.?0+e/, "e").replace("e+", "e");
  const v = n / scale[0];
  return `${parseFloat(v.toPrecision(3))}${scale[1]}`;
}

function fmtChance(chance) {
  if (chance <= 100) return `1 in ${fmtBig(chance)} (${(100 / chance).toFixed(2)}%)`;
  return `1 in ${fmtBig(chance)}`;
}

function buffCopies(buff) {
  return Math.ceil(buff.MaxBuff / buff.Buff);
}

function maxedCopies(rune) {
  return rune.Buffs.reduce((max, b) => Math.max(max, buffCopies(b)), 0);
}

/* The game prints a buff as `x9.20 Fuel`, tagging it [MAX] once capped. Its
   value is min(Buff * copies, MaxBuff) - verified against a DARK MATTER card
   at 46 copies, all six values exact. Matching that notation matters: the
   wiki previously wrote the same number as `+9.2`, so anyone comparing a card
   against their own screen saw a mismatch with no way to tell which was right.
   (The true effect is 1+x; the game says x anyway. How Runes Work explains it.) */
function fmtMult(v) {
  return `x${v.toFixed(2)}`;
}

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

function padRail(padNames, activeName) {
  return padNames
    .map((name) => {
      const meta = padMeta(name);
      const active = name === activeName;
      return `<a class="pad-tab${active ? " active" : ""}" href="#/wiki/${meta.slug}"
        style="--from: ${meta.from}; --to: ${meta.to}; --ink: ${meta.ink}"
        aria-current="${active ? "page" : "false"}">${meta.label}</a>`;
    })
    .join("");
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

function renderWiki(slug) {
  const padNames = Object.keys(runesData);
  const activeName = resolvePad(padNames, slug);
  const pad = runesData[activeName];
  const activeSlug = padMeta(activeName).slug;
  writeStore(LAST_PAD_KEY, activeSlug);
  /* Keep the address bar on the pad actually being shown, so a bare #/wiki or a
     dead slug still produces a link that opens the same pad for someone else.
     replaceState instead of assigning location.hash: no second render. */
  if (slug !== activeSlug) history.replaceState(null, "", `#/wiki/${activeSlug}`);

  app.innerHTML = `
    <h2 class="page-title">Rune Index</h2>
    <p class="page-desc">Runes are a core part of Divine Rarities. They are bundled in RunePads, which cost a currency to open, and grant passive boosts to your stats. Pick a pad to see its runes.</p>
    ${runesInfoArticle()}
    <div class="rune-index">
      <nav class="pad-rail" aria-label="Rune pads">${padRail(padNames, activeName)}</nav>
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

function renderCalculators() {
  app.innerHTML = `
    <h2 class="page-title">Rune Time Calculator</h2>
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
    current.value = 0;
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
      <h3 class="calc-total">Expected time: <strong>${formatDuration(secs)}</strong></h3>
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
  const m = location.hash.match(/^#\/([a-z]+)(?:\/([a-z0-9-]+))?/i);
  const route = m && m[1].toLowerCase() in routes ? m[1].toLowerCase() : "wiki";
  return { route, sub: m && m[2] ? m[2].toLowerCase() : null };
}

function render() {
  const { route, sub } = currentRoute();
  routes[route](sub);
  document.querySelectorAll(".tabs a").forEach((a) => {
    a.classList.toggle("active", a.dataset.route === route);
  });
}

render();
window.addEventListener("hashchange", render);
