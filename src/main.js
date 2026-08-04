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

function renderCalculators() {
  app.innerHTML = placeholder(
    "Calculators",
    "Coming soon. Planned: given your RPS and RuneLuck, how long to get N copies of a specific rune.",
  );
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
