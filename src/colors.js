/* Turns a rune into the colours its card is drawn with.
   The in-game card is a two-stop gradient, so that is what `rune-colors.json`
   stores. This module reproduces it, and derives a name colour that stays
   legible on the dark page even when the game's own colour is near-black. */

import runeColors from "./data/rune-colors.json";

/* Rarity ladder used when a rune has no captured colour and no WebhookColor.
   Index = the rune's position in the pad, which is the order the game shows. */
const TIER_COLORS = [
  "#cbd5e1", "#4ade80", "#22d3ee", "#e879f9", "#fbbf24",
  "#f87171", "#ff3cc8", "#a78bfa", "#38bdf8", "#fb923c", "#f5f5f5",
];

const CARD_BG = [29, 37, 50]; /* --panel-2 */

/* How much of the rune's own colour tints the card top. Keep in step with the
   .rune background in styles.css: the contrast lift is measured against it. */
const TINT = 0.12;

const MIN_CONTRAST = 4.6; /* WCAG AA for body text, with a little margin */

function parseHex(hex) {
  return parseInt(String(hex).replace("#", ""), 16);
}

function toHex(n) {
  return `#${n.toString(16).padStart(6, "0")}`;
}

function intToRgb(n) {
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hexToHsl(hex) {
  const r = ((hex >> 16) & 255) / 255;
  const g = ((hex >> 8) & 255) / 255;
  const b = (hex & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hslToRgb(h, s, l) {
  if (!s) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [channel(h + 1 / 3) * 255, channel(h) * 255, channel(h - 1 / 3) * 255];
}

function relativeLuminance([r, g, b]) {
  const f = (c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrastRatio(a, b) {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function blend(fg, bg, alpha) {
  return fg.map((c, i) => c * alpha + bg[i] * (1 - alpha));
}

/* Chroma, not HSL saturation: HSL calls near-white #f2feff fully saturated,
   which would make Tide read white instead of cyan and 100K Dynasty read red
   instead of green. Raw channel spread matches how the game titles the cards. */
function chromaOf(intColor) {
  const [r, g, b] = intToRgb(intColor);
  return Math.max(r, g, b) - Math.min(r, g, b);
}

/* Rune names sit on the tinted card, so an accent has to clear AA against it.
   Lift lightness until it does, keeping hue and saturation. Colours that
   already pass come through untouched. */
function toReadableCss([h, s, l], bg) {
  let lift = l;
  for (let i = 0; i < 50 && contrastRatio(hslToRgb(h, s, lift), bg) < MIN_CONTRAST; i++) {
    lift = Math.min(1, lift + 0.02);
  }
  return `hsl(${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(lift * 100)}%)`;
}

/* Some dev colours are near-black (Abyssal #0b1d3a, DARK MATTER #1f0018) and
   would vanish on a dark page. Keep the hue, make it a usable accent. */
function normalizeDevColor(intColor) {
  const [h, s, l] = hexToHsl(intColor);
  if (s < 0.15) return [h, s, Math.max(l, 0.82)];
  return [h, Math.max(s, 0.65), Math.min(Math.max(l, 0.6), 0.74)];
}

/* Captured colour first. A rune we haven't photographed yet falls back to the
   dev's WebhookColor, then to the rarity ladder, both as a flat pair.
   WebhookColor is only a fallback on purpose: it matches the card on the Sand
   and Space pads but not on PARADOX, 100K Almighty or 100K Dynasty. */
function runeGradient(padName, rune, index) {
  const captured = runeColors[padName]?.[rune.Name];
  if (captured) return captured.map(parseHex);
  if (rune.WebhookColor != null) return [rune.WebhookColor, rune.WebhookColor];
  const tier = parseHex(TIER_COLORS[index % TIER_COLORS.length]);
  return [tier, tier];
}

/* `index` is the rune's position in its pad, used only by the ladder fallback. */
export function runeStyle(padName, rune, index) {
  const [from, to] = runeGradient(padName, rune, index);
  /* The name takes the more colourful end: the colour the rune reads as in
     game (Abyssal's blue, not its near-black navy). */
  const source = chromaOf(from) >= chromaOf(to) ? from : to;
  const hsl = runeColors[padName]?.[rune.Name] ? hexToHsl(source) : normalizeDevColor(source);
  const cardTop = blend(intToRgb(from), CARD_BG, TINT);
  return { from: toHex(from), to: toHex(to), accent: toReadableCss(hsl, cardTop) };
}
