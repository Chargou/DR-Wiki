/* Number and stat-name formatting shared by every page. */

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

/* Unknown stats still read sensibly, so a stat the dev adds later shows up as
   "Some New Multi" rather than breaking the page. */
export function humanizeStat(name) {
  if (STAT_DISPLAY[name]) return STAT_DISPLAY[name];
  return name.replace(/([A-Z])/g, " $1").replace(/^ /, "");
}

export function fmtNum(n) {
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

export function parseNum(str) {
  const m = String(str).trim().match(/^([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z]*)$/);
  if (!m) return NaN;
  const num = parseFloat(m[1]);
  const suf = m[2].toLowerCase();
  return suf ? num * (SCALE_MULT[suf] ?? NaN) : num;
}

export function fmtBig(n) {
  if (!Number.isFinite(n)) return "-";
  if (n < 1e3) return String(parseFloat(n.toPrecision(3)));
  let scale = null;
  for (const [t, s] of SCALES) {
    if (n >= t) scale = [t, s];
    else break;
  }
  /* Past Dc the suffix table runs out, so fall back to exponent notation
     rather than printing a bare 36-digit number. */
  if (n >= 1e36) return n.toExponential(2).replace("e+", "e");
  const v = n / scale[0];
  return `${parseFloat(v.toPrecision(3))}${scale[1]}`;
}

export function fmtChance(chance) {
  if (chance <= 100) return `1 in ${fmtBig(chance)} (${(100 / chance).toFixed(2)}%)`;
  return `1 in ${fmtBig(chance)}`;
}

/* The game writes a buff as `x9.20 Fuel`. See How Runes Work for why the real
   effect is 1+x while the label says x. */
export function fmtMult(v) {
  return `x${v.toFixed(2)}`;
}
