"use strict";
const { splitLines } = require("../utils/text-position");

function stripYamlComment(t) {
  let q = null;
  for (let j = 0; j < t.length; j++) {
    const c = t[j];
    if (q) {
      if (q === "'" && c === "'") {
        if (t[j + 1] === "'") j++;
        else q = null;
      } else if (q === '"' && c === "\\") j++;
      else if (q === '"' && c === '"') q = null;
      continue;
    }
    if ((c === '"' || c === "'") && (j === 0 || /[\s[{,]/.test(t[j - 1]))) {
      q = c;
      continue;
    }
    if (c === "#" && (j === 0 || /\s/.test(t[j - 1]))) return t.slice(0, j).replace(/\s+$/, "");
  }
  return t;
}

function yamlScalar(t, line, col) {
  let m;
  while ((m = /^([&!][^\s]*)\s+/.exec(t))) {
    col += m[0].length;
    t = t.slice(m[0].length);
  }
  if (!t || /^[&!]\S*$/.test(t)) return { type: "scalar", value: "", line, col, endCol: col, quote: null, empty: true };
  if (t[0] === "*") return { type: "alias" };
  if (t[0] === '"') {
    let j = 1;
    let out = "";
    let esc = false;
    while (j < t.length && t[j] !== '"') {
      if (t[j] === "\\") {
        esc = true;
        const e = t[j + 1];
        out += e === "n" ? "\n" : e === "t" ? "\t" : e === undefined ? "" : e;
        j += 2;
        continue;
      }
      out += t[j];
      j++;
    }
    if (j >= t.length) return { type: "scalar", value: t, line, col, endCol: col + t.length, bad: true };
    return { type: "scalar", value: out, line, col: col + 1, endCol: col + j, quote: '"', escaped: esc };
  }
  if (t[0] === "'") {
    let j = 1;
    let out = "";
    let esc = false;
    while (j < t.length) {
      if (t[j] === "'") {
        if (t[j + 1] === "'") {
          out += "'";
          esc = true;
          j += 2;
          continue;
        }
        break;
      }
      out += t[j];
      j++;
    }
    if (j >= t.length) return { type: "scalar", value: t, line, col, endCol: col + t.length, bad: true };
    return { type: "scalar", value: out, line, col: col + 1, endCol: col + j, quote: "'", escaped: esc };
  }
  return { type: "scalar", value: t, line, col, endCol: col + t.length, quote: null };
}

function yamlFlowSeq(t, line, col) {
  const m = /^\[(.*)\]$/.exec(t);
  if (!m || /[[\]{}]/.test(m[1])) return { type: "flow" };
  const items = [];
  const inner = m[1];
  let start = 0;
  let q = null;
  const push = (end) => {
    const seg = inner.slice(start, end);
    const lead = seg.length - seg.replace(/^\s+/, "").length;
    const s = seg.trim();
    if (s) items.push(yamlScalar(s, line, col + 1 + start + lead));
  };
  for (let j = 0; j < inner.length; j++) {
    const c = inner[j];
    if (q) {
      if (c === q) q = null;
      continue;
    }
    if (c === '"' || c === "'") q = c;
    else if (c === ",") {
      push(j);
      start = j + 1;
    }
  }
  push(inner.length);
  return { type: "seq", items, line };
}

function yamlKeySplit(t) {
  let j = 0;
  let key;
  if (t[0] === '"' || t[0] === "'") {
    const q = t[0];
    j = 1;
    while (j < t.length && t[j] !== q) j += t[j] === "\\" && q === '"' ? 2 : 1;
    if (j >= t.length) return null;
    key = t.slice(1, j);
    j++;
    while (t[j] === " ") j++;
    if (t[j] !== ":" || (t[j + 1] !== undefined && t[j + 1] !== " ")) return null;
  } else {
    const m = /:(?: |$)/.exec(t);
    if (!m || m.index === 0) return null;
    if (/^[[{]/.test(t)) return null;
    key = t.slice(0, m.index).trim();
    j = m.index;
  }
  j++;
  while (t[j] === " ") j++;
  return { key, value: t.slice(j), valueOffset: j };
}

function parseYaml(text) {
  const raw = splitLines(text);
  let i = 0;
  let virt = null;
  const isSeq = (t) => t === "-" || t.startsWith("- ");
  function info(n) {
    const s = raw[n].replace(/\t/g, " ");
    const m = /^( *)(.*?)\s*$/.exec(s);
    const t = m[2];
    if (!t || t[0] === "#" || t[0] === "%") return null;
    if (/^(---|\.\.\.)(\s|$)/.test(t)) return { doc: true, indent: -1, line: n };
    const body = stripYamlComment(t);
    if (!body) return null;
    return { indent: m[1].length, col: m[1].length, text: body, line: n };
  }
  function peek() {
    if (virt) return virt;
    while (i < raw.length) {
      const li = info(i);
      if (li) return li;
      i++;
    }
    return null;
  }
  function advance() {
    virt = null;
    i++;
  }
  function skipDeeper(ind) {
    let p;
    while ((p = peek()) && !p.doc && p.indent > ind) advance();
  }
  function blockScalar(ind) {
    const lines = [];
    let blockIndent = -1;
    while (i < raw.length) {
      const s = raw[i];
      if (!s.trim()) {
        i++;
        continue;
      }
      const indent = /^[ \t]*/.exec(s)[0].length;
      if (indent <= ind) break;
      if (blockIndent < 0) blockIndent = indent;
      if (indent < blockIndent) break;
      lines.push({ text: s.slice(blockIndent), line: i, col: blockIndent });
      i++;
    }
    return { type: "scalar", block: true, lines, value: lines.map((l) => l.text).join("\n") };
  }
  function node() {
    const p = peek();
    if (!p || p.doc) return null;
    if (isSeq(p.text)) return seq(p.indent);
    if (yamlKeySplit(p.text)) return map(p.indent);
    advance();
    const t = p.text;
    if (t[0] === "[") return yamlFlowSeq(t, p.line, p.col);
    if (t[0] === "{") return { type: "flow" };
    return yamlScalar(t, p.line, p.col);
  }
  function seq(ind) {
    const items = [];
    const out = { type: "seq", items, line: peek().line };
    for (;;) {
      const p = peek();
      if (!p || p.doc || p.indent !== ind || !isSeq(p.text)) break;
      const after = p.text.slice(1);
      const rest = after.replace(/^ +/, "");
      if (!rest) {
        advance();
        const q = peek();
        items.push(q && !q.doc && q.indent > ind ? node() : null);
      } else {
        const c = p.col + 1 + (after.length - rest.length);
        virt = { indent: c, col: c, text: rest, line: p.line };
        items.push(node());
      }
      skipDeeper(ind);
    }
    return out;
  }
  function map(ind) {
    const entries = [];
    const out = { type: "map", entries, line: peek().line };
    for (;;) {
      const p = peek();
      if (!p || p.doc || p.indent !== ind || isSeq(p.text)) break;
      const kv = yamlKeySplit(p.text);
      if (!kv) {
        advance();
        skipDeeper(ind);
        continue;
      }
      const vtext = kv.value;
      const vcol = p.col + kv.valueOffset;
      advance();
      let value = null;
      const bare = vtext.replace(/^([&!][^\s]*\s*)+/, "");
      if (!bare) {
        const q = peek();
        if (q && !q.doc && (q.indent > ind || (q.indent === ind && isSeq(q.text)))) value = node();
      } else if (/^[|>][0-9+-]*$/.test(bare)) {
        value = blockScalar(ind);
      } else if (bare[0] === "[") {
        value = yamlFlowSeq(bare, p.line, vcol + (vtext.length - bare.length));
      } else if (bare[0] === "{") {
        value = { type: "flow" };
      } else {
        value = yamlScalar(vtext, p.line, vcol);
      }
      entries.push({ key: kv.key, line: p.line, value });
      skipDeeper(ind);
    }
    return out;
  }
  const docs = [];
  let guard = 0;
  while (peek() && guard++ < 100000) {
    const p = peek();
    if (p.doc) {
      advance();
      continue;
    }
    const before = i;
    const n = node();
    if (n) docs.push(n);
    if (i === before && !virt) advance();
  }
  return docs;
}

function yget(node, key) {
  if (!node || node.type !== "map") return null;
  let v = null;
  for (const e of node.entries) if (e.key === key) v = e.value;
  return v;
}

function yscalar(node) {
  return node && node.type === "scalar" && !node.block && !node.bad && !node.empty ? node : null;
}

module.exports = { parseYaml, yget, yscalar };
