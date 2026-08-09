/* Settings panel backing: export, import and reset of everything the wiki
   keeps in local storage. Future settings live under SETTINGS_KEY and are
   round-tripped as their own object; the rest is stored key by key so unknown
   future keys survive an export/import pair. */

export const SETTINGS_KEY = "dr-wiki:settings";
const PREFIX = "dr-wiki:";

export function readSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
  } catch {
    return {};
  }
}

export function writeSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable */
  }
}

export function collectData() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(PREFIX) && key !== SETTINGS_KEY) {
      data[key] = localStorage.getItem(key);
    }
  }
  return { settings: readSettings(), data };
}

/* Applies a backup produced by collectData. Only dr-wiki: keys are written,
   so an edited or foreign file can't plant arbitrary local storage. */
export function importData(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    throw new Error("Not a valid backup file.");
  }
  if (obj.settings === undefined || typeof obj.data !== "object" || obj.data === null) {
    throw new Error("The backup is missing its settings or data.");
  }
  writeSettings(obj.settings ?? {});
  let n = 0;
  for (const [key, value] of Object.entries(obj.data)) {
    if (typeof key === "string" && key.startsWith(PREFIX)) {
      localStorage.setItem(key, String(value));
      n += 1;
    }
  }
  return n;
}

export function resetData() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(PREFIX)) keys.push(key);
  }
  for (const key of keys) localStorage.removeItem(key);
  return keys.length;
}
