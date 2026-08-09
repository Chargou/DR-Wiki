/* Pad identity: labels, slugs and the tab styling that mirrors the in-game
   Rune Index rail. Shared by the wiki and the rune totals calculator. */

const PAD_META = {
  BasicRunePad: { label: "Basic", slug: "basic", from: "#f4f6f9", to: "#aab3c0", ink: "#161c26" },
  SandRunePad: { label: "Sand", slug: "sand", from: "#ffe2b0", to: "#ffb457", ink: "#3d2405" },
  SpaceRunePad: { label: "Space", slug: "space", from: "#9333ea", to: "#5b06c4", ink: "#ffffff" },
  EventRunePad: { label: "100K", slug: "100k", from: "#c2f89e", to: "#6ddc32", ink: "#14330a" },
};

export const PAD_NOTES = {
  EventRunePad:
    "Event pad: uses Event Rune Bulk, Speed and Luck instead of the normal rune stats. It celebrates 100k visits and may be temporary.",
};

/* Pads the game adds later fall back to a neutral tab and a derived slug, so a
   new pad renders without a code change. */
export function padMeta(name) {
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

export function padDisplayName(name) {
  return `${name.replace(/RunePad$/, "")} RunePad`;
}

/* `href` builds a deep link when the page routes by pad (the wiki). Omit it and
   the rail renders buttons instead, for pages that hold the pad in state. */
export function padRail(padNames, activeName, href) {
  return padNames
    .map((name) => {
      const meta = padMeta(name);
      const on = name === activeName;
      const style = `style="--from: ${meta.from}; --to: ${meta.to}; --ink: ${meta.ink}"`;
      const cls = `class="pad-tab${on ? " active" : ""}"`;
      return href
        ? `<a ${cls} href="${href(meta.slug)}" ${style} aria-current="${on ? "page" : "false"}">${meta.label}</a>`
        : `<button type="button" ${cls} ${style} data-pad="${name}" aria-pressed="${on}">${meta.label}</button>`;
    })
    .join("");
}
