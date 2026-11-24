"use strict";
const { splitLines } = require("../utils/text-position");

function dockerTokens(text, from) {
  const toks = [];
  let j = from;
  const n = text.length;
  while (j < n) {
    while (j < n && /\s/.test(text[j])) j++;
    if (j >= n) break;
    let val = "";
    const start = j;
    let quoted = false;
    let cStart = j;
    let cEnd = -1;
    while (j < n && !/\s/.test(text[j])) {
      const ch = text[j];
      if (ch === '"' || ch === "'") {
        const e = text.indexOf(ch, j + 1);
        if (e < 0) return null;
        quoted = true;
        if (j === start) cStart = j + 1;
        val += text.slice(j + 1, e);
        cEnd = e;
        j = e + 1;
        continue;
      }
      val += ch;
      j++;
    }
    toks.push({ value: val, start: quoted ? cStart : start, end: quoted ? cEnd : j, quoted });
  }
  return toks;
}

function dockerJsonTokens(text, from) {
  const t = text.slice(from).trim();
  if (!/^\[.*\]$/.test(t)) return null;
  const toks = [];
  let j = text.indexOf("[", from) + 1;
  for (;;) {
    while (j < text.length && /[\s,]/.test(text[j])) j++;
    if (text[j] === "]") break;
    if (text[j] !== '"') return null;
    let k = j + 1;
    let val = "";
    let esc = false;
    while (k < text.length && text[k] !== '"') {
      if (text[k] === "\\") {
        esc = true;
        val += text[k + 1] || "";
        k += 2;
        continue;
      }
      val += text[k];
      k++;
    }
    if (k >= text.length) return null;
    toks.push({ value: val, start: j + 1, end: k, quoted: true, json: true, esc });
    j = k + 1;
  }
  return toks;
}

function parseDockerfile(text) {
  const raw = splitLines(text);
  let esc = "\\";
  for (const l of raw) {
    const m = /^\s*#\s*([a-zA-Z]+)\s*=\s*(\S+)\s*$/.exec(l);
    if (!m) break;
    if (m[1].toLowerCase() === "escape" && (m[2] === "`" || m[2] === "\\")) esc = m[2];
  }
  const instrs = [];
  let n = 0;
  while (n < raw.length) {
    if (/^\s*(#|$)/.test(raw[n])) {
      n++;
      continue;
    }
    const map = [];
    let textL = "";
    let cur = n;
    for (;;) {
      const l = raw[cur];
      const trimmed = l.replace(/\s+$/, "");
      const cont = trimmed.endsWith(esc);
      const body = cont ? trimmed.slice(0, -1) : l;
      for (let k = 0; k < body.length; k++) map.push({ line: cur, col: k });
      textL += body;
      cur++;
      if (!cont) break;
      while (cur < raw.length && /^\s*(#.*)?$/.test(raw[cur])) cur++;
      if (cur >= raw.length) break;
    }
    const hd = [];
    const re = /<<(-?)(["']?)([A-Za-z_]\w*)\2/g;
    let m;
    while ((m = re.exec(textL))) hd.push({ strip: m[1] === "-", word: m[3] });
    for (const h of hd) {
      while (cur < raw.length) {
        const l = raw[cur++];
        if ((h.strip ? l.replace(/^\t+/, "") : l) === h.word) break;
      }
    }
    instrs.push({ text: textL, map, heredoc: hd.length > 0 });
    n = cur;
  }
  return instrs;
}

module.exports = { parseDockerfile, dockerTokens, dockerJsonTokens };
