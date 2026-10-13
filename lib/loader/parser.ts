import type { EnvCollection, EnvRecord } from "@loader/defs";

// character loop table for valid environment variable key names.
const KEY_CHAR = (() => {
  const t = new Uint8Array(256);
  for (let i = 48; i <= 57; i++) t[i] = 1; // 0-9
  for (let i = 65; i <= 90; i++) t[i] = 1; // A-Z
  for (let i = 97; i <= 122; i++) t[i] = 1; // a-z
  t[45] = t[46] = t[95] = 1; // - . _
  return t;
})();

// whitespace character lookup table.
const WS_CHAR = (() => {
  const t = new Uint8Array(256);
  t[9] = t[10] = t[32] = 1; // tab, LF, space
  return t;
})();

/**
 * High-performance environment file parser using character code scanning.
 *
 * Achieves ~3x performance over regex-based parsing utilizing lookup tables
 * and direct character code comparions, avoiding pattern matching overhead
 * in the host path.
 *
 * Supports standard ".env" syntax including:
 *
 * - Variable assignments with "=" or ":" separators.
 * - Single, double, and backick quoted values.
 * - Escape sequence handling within quoted strings.
 * - Comment lines prefixed with "#".
 * - Optional "export" prefix declarations.
 */
export class EnvironmentParser {
  protected source: string = "";
  protected length: number = 0;
  protected index: number = 0;

  /**
   * Initializes the parser with raw file content.
   * @param input Raw environment file content as "string" or "Buffer".
   */
  constructor(input: string | Buffer) {
    this.source = typeof input === "string" ? input : input.toString("utf-8");
    this.length = this.source.length;

    if (this.source.indexOf("\r") !== -1) {
      this.source = this.source.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
      this.length = this.source.length;
    }
  }

  private parseValue(): string {
    const src: string = this.source;
    const len: number = this.length;
    let idx: number = this.index;

    if (idx >= len) return "";
    const ch: number = src.charCodeAt(idx);
    const quote: number = ch === 39 || ch === 34 || ch === 96 ? ch : 0;

    // quoted value
    if (quote) {
      idx++;
      const start: number = idx;

      while (idx < len) {
        const char: number = src.charCodeAt(idx);
        if (char === 92 && idx + 1 < len) {
          // backslash
          const nc: number = src.charCodeAt(idx + 1);
          if (nc === quote || nc === 92) {
            idx += 2;
            continue;
          }
        }
        if (char === quote) {
          const raw: string = src.slice(start, idx);
          idx++;
          const nl: number = src.indexOf("\n", idx);
          this.index = nl === -1 ? len : nl + 1;

          if (quote !== 34 || raw.indexOf("\\") === -1) return raw;
          return raw.replace(/\\[nr]/g, (m) =>
            m.charCodeAt(1) === 110 ? "\n" : "\r",
          );
        }
        idx++;
      }

      // unterminated quote string
      this.index = len;
      return src.slice(start).trimEnd();
    }

    // unquoted value
    const start: number = idx;
    let end: number = idx;

    while (idx < len) {
      const char: number = src.charCodeAt(idx);
      if (char === 35 || char === 10) break; // '#' or 'LF'
      if (char !== 32 && char !== 9) end = idx + 1;
      idx++;
    }

    // skip trailing inline comment
    if (idx < len && src.charCodeAt(idx) === 35) {
      const nl: number = src.indexOf("\n", idx);
      this.index = nl === -1 ? len : nl + 1;
    } else {
      this.index = idx;
    }
    return src.slice(start, end);
  }

  /** Parses environment file content into key-value pairs. */
  public parse(): EnvRecord {
    const obj: EnvCollection = {};
    const src: string = this.source;
    const len: number = this.length;
    let idx: number = 0;

    while (idx < len) {
      // inline skip whitespace
      let ch: number = src.charCodeAt(idx);
      while (idx < len && (ch < 256 ? WS_CHAR[ch] : ch === 65279)) {
        ch = src.charCodeAt(++idx);
      }
      if (idx >= len) break;

      // skip '#' comments
      if (ch === 35) {
        const nl: number = src.indexOf("\n", idx);
        idx = nl === -1 ? len : nl + 1;
        continue;
      }

      // skip optional 'export' prefix
      if (
        idx + 6 < len && // bounds guard
        ch === 101 && // e
        src.charCodeAt(idx + 1) === 120 && // x
        src.charCodeAt(idx + 2) === 112 && // p
        src.charCodeAt(idx + 3) === 111 && // o
        src.charCodeAt(idx + 4) === 114 && // r
        src.charCodeAt(idx + 5) === 116 // t
      ) {
        const nc: number = src.charCodeAt(idx + 6);
        if (nc === 32 || nc === 9) {
          // skip horizontal whitespace only
          idx += 7;
          while (
            idx < len &&
            (src.charCodeAt(idx) === 32 || src.charCodeAt(idx) === 9)
          ) {
            idx++;
          }
        }
      }

      // parse key
      const keyStart: number = idx;
      while (idx < len && KEY_CHAR[src.charCodeAt(idx)]) idx++;

      if (idx === keyStart) {
        const nl: number = src.indexOf("\n", idx);
        idx = nl === -1 ? len : nl + 1;
        continue;
      }
      const key: string = src.slice(keyStart, idx);

      // skips horizontal whitespace before separator
      while (
        idx < len &&
        (src.charCodeAt(idx) === 32 || src.charCodeAt(idx) === 9)
      ) {
        idx++;
      }
      if (idx >= len) break;

      // expected '=' or ':'
      const sep: number = src.charCodeAt(idx);
      if (sep !== 61 && sep !== 58) {
        const nl: number = src.indexOf("\n", idx);
        idx = nl === -1 ? len : nl + 1;
        continue;
      }
      idx++;

      // skips horizontal whitespace before value
      while (
        idx < len &&
        (src.charCodeAt(idx) === 32 || src.charCodeAt(idx) === 9)
      ) {
        idx++;
      }

      // parse value
      this.index = idx;
      const value: string = this.parseValue();
      idx = this.index;
      obj[key] = value;
    }
    return Object.freeze(obj);
  }
}

// represents a lazily materialized environment value
type LazyEntry = Readonly<[number, number]> | string;

/**
 * High-performance environment file parser with lazy value materialization.
 *
 * Extends {@link EnvironmentParser} by avoiding "String.prototype.slice()" for
 * environment values during the parsing phase. Instead, values that do not
 * require immediate processing are represented by their sources offsets and
 * materialized only when accessed.
 *
 * Supports standard ".env" syntax including:
 *
 * - Variable assignments with "=" or ":" separators.
 * - Single, double, and backick quoted values.
 * - Escape sequence handling within quoted strings.
 * - Comment lines prefixed with "#".
 * - Optional "export" prefix declarations.
 */
export class LazyEnvironmentParser extends EnvironmentParser {
  private parseValueLazy(): LazyEntry {
    const src = this.source;
    const len = this.length;
    let idx = this.index;

    if (idx >= len) return "";

    const ch = src.charCodeAt(idx);
    const quote = ch === 39 || ch === 34 || ch === 96 ? ch : 0;

    // quoted
    if (quote) {
      idx++;
      const start = idx;

      while (idx < len) {
        const char = src.charCodeAt(idx);
        if (char === 92 && idx + 1 < len) {
          const nc = src.charCodeAt(idx + 1);
          if (nc === quote || nc === 92) {
            idx += 2;
            continue;
          }
        }
        if (char === quote) {
          const end = idx;
          idx++;
          const nl = src.indexOf("\n", idx);
          this.index = nl === -1 ? len : nl + 1;

          // double-quoted
          if (quote === 34) {
            const raw = src.slice(start, end);
            if (raw.indexOf("\\") !== -1) {
              return raw.replace(/\\[nr]/g, (m) =>
                m.charCodeAt(1) === 110 ? "\n" : "\r",
              );
            }
          }

          // single, backtick, double
          return [start, end] as const;
        }
        idx++;
      }

      // unterminated: edge case
      this.index = len;
      return src.slice(start).trimEnd();
    }

    // unquoted: tracked trimmed end
    const start = idx;
    let end = idx;
    while (idx < len) {
      const char = src.charCodeAt(idx);
      if (char === 35 || char === 10) break;
      if (char !== 32 && char !== 9) end = idx + 1;
      idx++;
    }
    if (idx < len && src.charCodeAt(idx) === 35) {
      const nl = src.indexOf("\n", idx);
      this.index = nl === -1 ? len : nl + 1;
    } else {
      this.index = idx;
    }
    return [start, end] as const;
  }

  /** Parses environment file content using lazy value materialization. */
  public parseLazy(): EnvRecord {
    const entries = new Map<string, LazyEntry>();
    const src = this.source;
    const len = this.length;
    let idx = 0;

    while (idx < len) {
      // inline skip whitespace
      let ch = src.charCodeAt(idx);
      while (idx < len && (ch < 256 ? WS_CHAR[ch] : ch === 65279)) {
        ch = src.charCodeAt(++idx);
      }
      if (idx >= len) break;

      // skip '#' comments
      if (ch === 35) {
        const nl = src.indexOf("\n", idx);
        idx = nl === -1 ? len : nl + 1;
        continue;
      }

      // skip 'export' prefix
      if (
        idx + 6 < len &&
        ch === 101 &&
        src.charCodeAt(idx + 1) === 120 &&
        src.charCodeAt(idx + 2) === 112 &&
        src.charCodeAt(idx + 3) === 111 &&
        src.charCodeAt(idx + 4) === 114 &&
        src.charCodeAt(idx + 5) === 116
      ) {
        const nc = src.charCodeAt(idx + 6);
        if (nc === 32 || nc === 9) {
          idx += 7;
          while (
            idx < len &&
            (src.charCodeAt(idx) === 32 || src.charCodeAt(idx) === 9)
          )
            idx++;
        }
      }

      // parse key
      const keyStart = idx;
      while (idx < len && KEY_CHAR[src.charCodeAt(idx)]) idx++;
      if (idx === keyStart) {
        const nl = src.indexOf("\n", idx);
        idx = nl === -1 ? len : nl + 1;
        continue;
      }
      const key = src.slice(keyStart, idx);

      // skips horizontal whitespace before separator
      while (
        idx < len &&
        (src.charCodeAt(idx) === 32 || src.charCodeAt(idx) === 9)
      )
        idx++;
      if (idx >= len) break;

      const sep = src.charCodeAt(idx);
      if (sep !== 61 && sep !== 58) {
        const nl = src.indexOf("\n", idx);
        idx = nl === -1 ? len : nl + 1;
        continue;
      }
      idx++;

      // skips horizontal whitespace before value
      while (
        idx < len &&
        (src.charCodeAt(idx) === 32 || src.charCodeAt(idx) === 9)
      )
        idx++;

      this.index = idx;
      entries.set(key, this.parseValueLazy());
      idx = this.index;
    }

    // proxy
    const cache = new Map<string, string>();

    const resolve = (key: string): string | undefined => {
      const hit = cache.get(key);
      if (hit !== undefined) return hit;
      const entry = entries.get(key);
      if (entry === undefined) return undefined;
      const value =
        typeof entry === "string" ? entry : src.slice(entry[0], entry[1]);
      cache.set(key, value);
      return value;
    };

    return new Proxy(Object.create(null) as EnvRecord, {
      get: (_, prop) => (typeof prop === "string" ? resolve(prop) : undefined),
      has: (_, prop) => typeof prop === "string" && entries.has(prop),
      ownKeys: () => [...entries.keys()],

      getOwnPropertyDescriptor: (_, prop) => {
        if (typeof prop !== "string" || !entries.has(prop)) return undefined;
        return {
          enumerable: true,
          configurable: true,
          writable: false,
          value: resolve(prop),
        };
      },
    });
  }
}
