import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "message.txt");
const dest = join(root, "src", "data", "runes.json");

const source = readFileSync(src, "utf8").replace(/--.*$/gm, "");

class Parser {
  constructor(text) {
    this.text = text;
    this.i = 0;
  }

  skipWs() {
    while (this.i < this.text.length && /\s/.test(this.text[this.i])) this.i++;
  }

  eof() {
    this.skipWs();
    return this.i >= this.text.length;
  }

  peek() {
    this.skipWs();
    return this.text[this.i];
  }

  match(ch) {
    this.skipWs();
    if (this.text[this.i] === ch) {
      this.i++;
      return true;
    }
    return false;
  }

  expect(ch) {
    if (!this.match(ch)) {
      throw new Error(`expected '${ch}' at offset ${this.i}`);
    }
  }

  readString() {
    this.skipWs();
    if (this.text[this.i] !== '"') throw new Error(`expected string at offset ${this.i}`);
    this.i++;
    let out = "";
    while (this.i < this.text.length) {
      const c = this.text[this.i];
      if (c === '"') {
        this.i++;
        return out;
      }
      if (c === "\\") {
        this.i++;
        const esc = this.text[this.i];
        out += esc === "n" ? "\n" : esc === "t" ? "\t" : esc;
        this.i++;
      } else {
        out += c;
        this.i++;
      }
    }
    throw new Error(`unterminated string at offset ${this.i}`);
  }

  readNumber() {
    this.skipWs();
    let m;
    const rest = this.text.slice(this.i);
    m = rest.match(/^0[xX]([0-9a-fA-F]+)/);
    if (m) {
      this.i += m[0].length;
      return parseInt(m[1], 16);
    }
    m = rest.match(/^[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?/);
    if (m) {
      this.i += m[0].length;
      return parseFloat(m[0]);
    }
    throw new Error(`expected number at offset ${this.i}`);
  }

  readWord() {
    this.skipWs();
    let m = this.text.slice(this.i).match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (!m) throw new Error(`expected identifier at offset ${this.i}`);
    this.i += m[0].length;
    return m[0];
  }

  readKey() {
    this.skipWs();
    if (this.text[this.i] === '"') return this.readString();
    if (this.text[this.i] === "[") {
      this.i++;
      const key = this.text[this.i] === '"' ? this.readString() : this.readWord();
      this.skipWs();
      if (this.text[this.i] !== "]") throw new Error(`expected ']' at offset ${this.i}`);
      this.i++;
      return key;
    }
    return this.readWord();
  }

  readValue() {
    this.skipWs();
    const c = this.text[this.i];
    if (c === "{") return this.readTable();
    if (c === '"') return this.readString();
    if (c === "-" || /[0-9]/.test(c)) return this.readNumber();
    const word = this.readWord();
    if (word === "true") return true;
    if (word === "false") return false;
    throw new Error(`unexpected value '${word}' at offset ${this.i}`);
  }

  readTable() {
    this.expect("{");
    const entries = [];
    while (true) {
      if (this.match("}")) break;
      const start = this.i;
      let key = null;
      let value;
      this.skipWs();
      if (this.text[this.i] === "[" || this.text[this.i] === '"' || /[A-Za-z_]/.test(this.text[this.i])) {
        const lookahead = this.text.slice(this.i);
        if (lookahead.startsWith('["')) {
          this.i++;
          key = this.text[this.i] === '"' ? this.readString() : this.readWord();
          this.skipWs();
          this.expect("]");
          this.expect("=");
          value = this.readValue();
        } else {
          const word = this.readWord();
          if (word === "true" || word === "false") {
            value = word === "true";
          } else {
            this.skipWs();
            if (this.text[this.i] === "=") {
              this.i++;
              key = word;
              value = this.readValue();
            } else {
              this.i = start;
              value = this.readValue();
            }
          }
        }
      } else {
        value = this.readValue();
      }
      entries.push({ key, value });
      if (!this.match(",")) {
        this.expect("}");
        break;
      }
    }
    const hasKeys = entries.some((e) => e.key !== null);
    if (hasKeys) {
      const obj = {};
      for (const e of entries) obj[e.key] = e.value;
      return obj;
    }
    return entries.map((e) => e.value);
  }

  parse() {
    const root = this.readTable();
    if (!this.eof()) throw new Error(`trailing content at offset ${this.i}`);
    return root;
  }
}

const data = new Parser(source).parse();

const names = ["BasicRunePad", "SandRunePad", "SpaceRunePad", "EventRunePad"];
for (const n of names) {
  if (!data[n]) throw new Error(`missing pad '${n}' in source`);
}

mkdirSync(dirname(dest), { recursive: true });
writeFileSync(dest, JSON.stringify(data, null, "\t") + "\n");

const total = Object.values(data).reduce((s, pad) => s + pad.Runes.length, 0);
console.log(`Wrote ${dest}`);
console.log(`Pads: ${Object.keys(data).join(", ")}`);
console.log(`Total runes: ${total}`);
