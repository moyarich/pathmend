"use strict";

// A conservative source scanner, not a Markdown/MDX compiler. All ranges are
// UTF-16 offsets into the original document. Never evaluate expressions.
const DEFAULT_ATTRIBUTES = ["src", "href"];
const DEFAULT_DIRECTIVE_ATTRIBUTES = ["component", "code", "files"];
const DEFAULT_MULTI_ATTRIBUTES = ["files"];

/**
 * @typedef {"markdown" | "module" | "jsx" | "directive"} DocumentReferenceType
 * @typedef {Object} DocumentReference
 * @property {number} start Inclusive UTF-16 offset into the original source.
 * @property {number} end Exclusive UTF-16 offset; excludes quotes, fragments and query strings.
 * @property {string} value Local path as authored, without query or fragment.
 * @property {DocumentReferenceType} type Syntax that contains the reference.
 * @property {string} [attribute] JSX or directive attribute name, when applicable.
 * @property {string} [quote] Original single or double quote, when applicable.
 */

/**
 * Extract supported static local paths without compiling Markdown or executing MDX.
 * Complex or ambiguous syntax is intentionally skipped. Returned ranges contain only
 * the path itself, allowing callers to preserve surrounding syntax when editing.
 *
 * @param {string} text Original Markdown or MDX document.
 * @param {Object} [options] Scanner configuration.
 * @param {boolean} [options.mdx=false] Recognize static ESM and JSX syntax.
 * @param {string[]} [options.pathAttributes] JSX attributes to scan (defaults to src and href).
 * @param {string[]} [options.directivePathAttributes] Directive attributes to scan.
 * @param {string[]} [options.multiPathAttributes] Attributes containing comma-separated paths.
 * @returns {DocumentReference[]} References in source order.
 */
function extractMarkdownPaths(text, options = {}) {
  const mdx = !!options.mdx;
  const attributes = new Set(options.pathAttributes || DEFAULT_ATTRIBUTES);
  const directives = new Set(options.directivePathAttributes || DEFAULT_DIRECTIVE_ATTRIBUTES);
  const multi = new Set(options.multiPathAttributes || DEFAULT_MULTI_ATTRIBUTES);
  const refs = [];
  const n = text.length;
  const newline = i => { const j = text.indexOf("\n", i); return j < 0 ? n : j; };
  const escaped = i => {
    let count = 0;
    while (i > 0 && text[--i] === "\\") count++;
    return count % 2 !== 0;
  };
  /** Record a supported path without changing its original source offsets. */
  function emit(start, end, type, attr, quote) {
    let value = text.slice(start, end);
    if (!value || /[\r\n\\\u0000-\u001f{}<>]/.test(value)) return;
    // URLs, site-root routes, anchors, aliases and encoded/ambiguous paths.
    if (/^(?:[a-z][a-z0-9+.-]*:|\/|#|\?|@|~)/i.test(value) || /[%&]/.test(value)) return;
    if (type !== "markdown" && !/^\.\.?\//.test(value)) return;
    const cut = value.search(/[?#]/);
    if (cut >= 0) {
      value = value.slice(0, cut);
      end = start + value.length;
    }
    if (!value || /[*[\]]/.test(value)) return;
    refs.push({ start, end, value, type, attribute: attr, quote });
  }
  function quoted(i) {
    const q = text[i];
    if (q !== '"' && q !== "'") return null;
    for (let j = i + 1; j < n; j++) {
      if (text[j] === "\n" || text[j] === "\r") return null;
      if (text[j] === "\\") { j++; continue; }
      if (text[j] === q) return { start: i + 1, end: j, next: j + 1, quote: q };
    }
    return null;
  }
  function ws(i) { while (i < n && /\s/.test(text[i])) i++; return i; }
  /** Skip a balanced expression, treating quoted strings and comments as opaque. */
  function balanced(i, open, close) {
    let depth = 0;
    for (let j = i; j < n; j++) {
      const c = text[j];
      if (c === "\\") { j++; continue; }
      if (c === "'" || c === '"' || c === String.fromCharCode(96)) {
        // Template interpolation and complex JS are deliberately opaque.
        const q = c;
        for (j++; j < n && text[j] !== q; j++) if (text[j] === "\\") j++;
        continue;
      }
      if (text.startsWith("/*", j)) {
        const end = text.indexOf("*/", j + 2);
        if (end < 0) return n;
        j = end + 1;
        continue;
      }
      if (text.startsWith("//", j)) { j = newline(j); continue; }
      if (c === open) depth++;
      if (c === close && --depth === 0) return j + 1;
    }
    return n;
  }
  function emitAttribute(q, type, name) {
    if (!multi.has(name)) { emit(q.start, q.end, type, name, q.quote); return; }
    let start = q.start;
    while (start < q.end) {
      let end = text.indexOf(",", start);
      if (end < 0 || end > q.end) end = q.end;
      let a = start, b = end;
      while (a < b && /\s/.test(text[a])) a++;
      while (b > a && /\s/.test(text[b - 1])) b--;
      emit(a, b, type, name, q.quote);
      start = end + 1;
    }
  }
  // Parse only complete opening tags or directive attribute groups.
  // Stage references until the closing delimiter is confirmed.
  function attrs(i, type, names, close) {
    const staged = refs.length;
    while (i < n) {
      i = ws(i);
      if (text[i] === close) return i + 1;
      if (type === "jsx" && text.startsWith("/>", i)) return i + 2;
      if (type === "jsx" && text[i] === "{") {
        i = balanced(i, "{", "}");
        continue;
      }
      const m = /^[A-Za-z_:][\w:.-]*/.exec(text.slice(i, Math.min(i + 256, n)));
      if (!m) break;
      const name = m[0];
      i = ws(i + name.length);
      if (text[i] !== "=") continue;
      i = ws(i + 1);
      let q = quoted(i);
      if (type === "jsx" && text[i] === "{") {
        const end = balanced(i, "{", "}");
        q = quoted(ws(i + 1));
        if (q && ws(q.next) === end - 1 && text[end - 1] === "}") {
          if (names.has(name)) emitAttribute(q, type, name);
        }
        i = end;
        continue;
      }
      if (!q) break;
      if (names.has(name)) emitAttribute(q, type, name);
      i = q.next;
    }
    refs.length = staged;
    return -1;
  }
  /** Read a single-line Markdown destination and optional title. */
  function destination(i, limit, inline) {
    if (text[limit - 1] === "\r") limit--;
    while (i < limit && /[ \t]/.test(text[i])) i++;
    let start = i, end;
    if (text[i] === "<") {
      start = ++i;
      end = text.indexOf(">", i);
      if (end < 0 || end >= limit) return;
      i = end + 1;
    } else {
      let depth = 0;
      while (i < limit && !/[ \t\r\n]/.test(text[i])) {
        if (text[i] === "\\") { i += 2; continue; }
        if (text[i] === "(") depth++;
        if (text[i] === ")") { if (!depth) break; depth--; }
        i++;
      }
      if (depth) return;
      end = i;
    }
    while (i < limit && /[ \t]/.test(text[i])) i++;
    if (text[i] === '"' || text[i] === "'") {
      const title = quoted(i);
      if (!title || title.next > limit) return;
      i = title.next;
      while (i < limit && /[ \t]/.test(text[i])) i++;
    }
    if (inline ? text[i] !== ")" : i !== limit) return;
    emit(start, end, "markdown");
    return inline ? i + 1 : limit;
  }
  // Frontmatter is opaque. A missing closing delimiter suppresses the rest.
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  if (/^---[ \t]*\r?(?:\n|$)/.test(text.slice(i, newline(i) + 1))) {
    i = newline(i) + 1;
    while (i < n) {
      const end = newline(i);
      const line = text.slice(i, end);
      i = end + 1;
      if (/^(?:---|\.\.\.)[ \t]*\r?$/.test(line)) break;
    }
  }
  let fence = null;
  while (i < n) {
    if (i === 0 || text[i - 1] === "\n" || (i === 1 && text.charCodeAt(0) === 0xfeff)) {
      const end = newline(i);
      const line = text.slice(i, end).replace(/\r$/, "");
      const f = /^(?:[ \t]*>[ \t]?)*[ \t]*(?:[-+*] |\d+[.)] )?([~\x60]{3,})(.*)$/.exec(line);
      if (f && /^([~\x60])\1*$/.test(f[1])) {
        if (!fence) fence = f[1];
        else if (f[1][0] === fence[0] && f[1].length >= fence.length && !f[2].trim()) fence = null;
        i = end + 1; continue;
      }
      if (fence || /^(?: {4}|\t)/.test(line)) { i = end + 1; continue; }
      const def = /^ {0,3}\[(?!\^)[^\]\r\n]+\]:[ \t]*/.exec(line);
      if (def) { destination(i + def[0].length, end, false); i = end + 1; continue; }
      // Recognize a bounded subset of static ESM declarations. No dynamic import.
      if (mdx && /^ {0,3}(?:import|export)\b/.test(line)) {
        const statement = /^(?: {0,3}import[ \t]+(?:(?:[\w$*{}, \t\r\n]+?)[ \t\r\n]+from[ \t\r\n]+)?| {0,3}export[ \t]+(?:\*|{[\w$,\s]*})(?:[ \t]+as[ \t]+[\w$]+)?[ \t\r\n]+from[ \t\r\n]+)(["'])/.exec(text.slice(i, Math.min(i + 8192, n)));
        if (statement) {
          const q = quoted(i + statement[0].length - 1);
          if (q) { emit(q.start, q.end, "module", undefined, q.quote); i = newline(q.next) + 1; continue; }
        }
        // Unrecognized declarations are not Markdown. Skip this line.
        i = end + 1; continue;
      }
      const d = /^ {0,3}:{1,}[A-Za-z][\w-]*(?:\[[^\]\r\n]*\])?\{/.exec(line);
      if (d) {
        const next = attrs(i + d[0].length, "directive", directives, "}");
        i = next > 0 ? next : end + 1;
        continue;
      }
    }
    if (text.startsWith("<!--", i)) {
      const end = text.indexOf("-->", i + 4);
      i = end < 0 ? n : end + 3; continue;
    }
    if (text[i] === "\\" && i + 1 < n) { i += 2; continue; }
    if (text.charCodeAt(i) === 96) {
      let j = i + 1;
      while (text.charCodeAt(j) === 96) j++;
      const size = j - i;
      let k = j, found = false;
      while (k < n) {
        k = text.indexOf(String.fromCharCode(96), k);
        if (k < 0) break;
        let e = k + 1;
        while (text.charCodeAt(e) === 96) e++;
        if (e - k === size) { i = e; found = true; break; }
        k = e;
      }
      if (!found) i = j;
      continue;
    }
    if (mdx && text[i] === "{") { i = balanced(i, "{", "}"); continue; }
    if (mdx && text[i] === "<") {
      const tag = /^<[A-Za-z][\w.:-]*(?=[\s/>])/.exec(text.slice(i, Math.min(i + 256, n)));
      if (tag) {
        const next = attrs(i + tag[0].length, "jsx", attributes, ">");
        i = next > 0 ? next : newline(i) + 1;
        continue;
      }
    }
    if (text[i] === "]" && text[i + 1] === "(" && !escaped(i)) {
      // Require an opening bracket on this line, not an arbitrary ]( sequence.
      const lineStart = text.lastIndexOf("\n", i - 1) + 1;
      const opening = text.lastIndexOf("[", i - 1);
      if (opening >= lineStart && !escaped(opening)) {
        const next = destination(i + 2, newline(i), true);
        if (next) { i = next; continue; }
      }
    }
    i++;
  }
  return refs;
}

module.exports = { extractMarkdownPaths, DEFAULT_ATTRIBUTES, DEFAULT_DIRECTIVE_ATTRIBUTES, DEFAULT_MULTI_ATTRIBUTES };
