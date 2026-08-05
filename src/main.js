import "./styles.css";
import { version } from "../package.json";
import runesData from "./data/runes.json";

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

function runeCard(rune) {
  const secret = !rune.Luck;
  const potionChance = rune.MinChance != null ? rune.MinChance : rune.Chance / 2;
  const luckLine = secret
    ? `Secret &mdash; not affected by RuneLuck (Rune Luck potion halves the chance: ${fmtChance(potionChance)})`
    : rune.MinChance != null
      ? `Affected by RuneLuck &mdash; chance floor ${fmtChance(rune.MinChance)}`
      : "Affected by RuneLuck";

  const buffs = rune.Buffs.map((b) => {
    const stat = humanizeStat(b.Target);
    return `<li>+${fmtNum(b.Buff)} ${stat} per copy &middot; max +${fmtNum(b.MaxBuff)} ${stat} after ${fmtNum(buffCopies(b))} copies</li>`;
  });

  return `
    <div class="rune">
      <div class="rune-head">
        <span class="rune-name${secret ? " secret" : ""}">${rune.Name}</span>
        <span class="rune-chance">${fmtChance(rune.Chance)}</span>
      </div>
      <div class="rune-luck">${luckLine}</div>
      <div class="rune-maxed">All stats maxed at ${fmtNum(maxedCopies(rune))} copies</div>
      <ul class="buffs">${buffs.join("")}</ul>
    </div>`;
}

function padSection(name, pad) {
  const cost = `${pad.Cost.Amount} ${humanizeStat(pad.Cost.Stat)}`;
  const secretCount = pad.Runes.filter((r) => !r.Luck).length;
  const cards = pad.Runes.map(runeCard).join("");
  return `
    <section class="pad">
      <h2>${padDisplayName(name)} <span class="pad-cost">${cost} per roll</span></h2>
      <p class="pad-meta">${pad.Runes.length} runes &middot; ${secretCount} secret${secretCount === 1 ? "" : "s"}</p>
      <div class="runes">${cards}</div>
    </section>`;
}

function runesInfoArticle() {
  return `
    <section class="info-article">
      <h2>How Runes Work</h2>
      <ul>
        <li>Stand on a rune pad to open runes. Each open costs the pad's listed currency and rolls once.</li>
        <li>A rune with a rarity of 1 in N has a 1/N chance per roll, and every rune on the pad is rolled independently &mdash; a single open can give several runes.</li>
        <li>RuneLuck makes runes easier to get: the effective chance is divided by your luck, down to each rune's own floor.</li>
        <li>Secret runes are not affected by RuneLuck. Only the Rune Luck potion helps, and it too is capped by the rune's floor.</li>
        <li>RPS (runes per second) = Rune Bulk &times; Rune Speed.</li>
        <li>Boosts are multiplicative: a +x boost is actually a 1+x multiplier, and boosts from different runes compound.</li>
        <li>Each buff is capped: it stops growing after reaching its maximum, which happens at max / per-copy copies. Caps apply per buff, per rune, per pad.</li>
        <li>Event runes (like the 100K event) use event-specific bulk, speed and luck instead of the normal ones.</li>
      </ul>
    </section>`;
}

function renderWiki() {
  const padEntries = Object.entries(runesData);
  const content = padEntries.map(([name, pad]) => padSection(name, pad)).join("");
  app.innerHTML = `
    <h2 class="page-title">Runes</h2>
    <p class="page-desc">Runes are a core part of Divine Rarities. They are bundled in RunePads, which cost a currency to open, and grant passive boosts to your stats.</p>
    ${runesInfoArticle()}
    ${content}`;
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
          `<option value="${padName}::${r.Name}">${r.Name} — 1 in ${fmtBig(r.Chance)}${r.Luck ? "" : " (secret)"}</option>`,
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
    potion.checked = false;
    potionRow.classList.toggle("hidden", !secret);
    current.value = 0;
    goal.value = maxedCopies(rune);
    goal.max = maxedCopies(rune);
    renderGoalSuggestions(rune);
    recalc();
  }

  function recalc() {
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
  onRuneChange();
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
  const m = location.hash.match(/#\/([a-z]+)/);
  return m && m[1] in routes ? m[1] : "wiki";
}

function render() {
  const route = currentRoute();
  routes[route]();
  document.querySelectorAll(".tabs a").forEach((a) => {
    a.classList.toggle("active", a.dataset.route === route);
  });
}

render();
window.addEventListener("hashchange", render);
