"use strict";
const path = require("node:path");
const { hasControl } = require("../../utils/paths");
const { splitLines } = require("../../utils/text-position");
const { mkRef } = require("../../references/create-reference");

function extractCodeowners(c) {
  const out = [];
  const dir = path.dirname(c.file);
  const root = /^(\.github|docs|\.gitlab)$/.test(path.basename(dir)) ? path.dirname(dir) : dir;
  const lines = splitLines(c.text);
  for (let n = 0; n < lines.length; n++) {
    const l = lines[n];
    const lead = /^\s*/.exec(l)[0].length;
    const t = l.slice(lead);
    if (!t || t[0] === "#" || t[0] === "[" || t.startsWith("^[")) continue;
    const m = /^((?:\\.|[^\s\\])+)/.exec(t);
    if (!m) continue;
    const pat = m[1];
    if (/[*?[\]!]/.test(pat) || hasControl(pat)) continue;
    const escaped = pat.includes("\\");
    const unesc = pat.replace(/\\(.)/g, "$1");
    const core = unesc.replace(/^\/+/, "").replace(/\/+$/, "");
    if (!core) continue;
    const anchored = unesc.startsWith("/") || core.includes("/");
    const kind = /\/$/.test(unesc) ? "dir" : "any";
    const r = mkRef({
      file: c.file,
      line: n,
      col: lead,
      endCol: lead + pat.length,
      value: unesc,
      display: pat,
      escape: escaped ? "noedit" : "shell",
      code: "PM006",
      base: root,
      kind,
      label: "CODEOWNERS",
    });
    if (unesc.startsWith("/")) {
      r.value = unesc.replace(/^\/+/, "");
      r.fmt = "root";
      r.lead = "";
    }
    if (!anchored) r.anywhere = core;
    out.push(r);
  }
  return out;
}

module.exports = { extractCodeowners };
