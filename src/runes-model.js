/* The roll and buff maths, kept away from rendering so pages can share it. */

export function buffCopies(buff) {
  return Math.ceil(buff.MaxBuff / buff.Buff);
}

export function maxedCopies(rune) {
  return rune.Buffs.reduce((max, b) => Math.max(max, buffCopies(b)), 0);
}

/* What one buff is worth at a given copy count: every copy adds `Buff` to the
   target, capped at `MaxBuff`. This is the number the game prints on the card. */
export function buffValue(buff, copies) {
  return Math.min(buff.Buff * copies, buff.MaxBuff);
}

/* Totals across every rune the player owns.
   A buff of x is really a 1+x multiplier, and separate buffs compound, so a
   stat's total is the product of (1 + value) over every buff targeting it.
   Two +1 RuneBulk buffs give 4x, which is the worked example in info/runes.
   No rune targets the same stat twice, so there is no within-rune special case. */
export function statTotals(runesData, counts) {
  const totals = new Map();
  for (const [padName, pad] of Object.entries(runesData)) {
    for (const rune of pad.Runes) {
      const owned = counts[`${padName}::${rune.Name}`] ?? 0;
      for (const b of rune.Buffs) {
        const entry = totals.get(b.Target) ?? { current: 1, max: 1, owned: 0 };
        entry.current *= 1 + buffValue(b, owned);
        entry.max *= 1 + b.MaxBuff;
        if (owned > 0) entry.owned += 1;
        totals.set(b.Target, entry);
      }
    }
  }
  return totals;
}

/* How much of `stat` a single extra copy of this rune would add, as a factor.
   Used to rank what is actually worth farming next. Returns 1 when the buff is
   already capped, i.e. no further gain. */
export function marginalGain(rune, stat, owned) {
  let factor = 1;
  for (const b of rune.Buffs) {
    if (b.Target !== stat) continue;
    const now = buffValue(b, owned);
    const next = buffValue(b, owned + 1);
    if (next > now) factor *= (1 + next) / (1 + now);
  }
  return factor;
}
