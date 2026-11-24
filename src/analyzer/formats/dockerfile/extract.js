"use strict";
const path = require("node:path");
const { within, isUrl, isGlob, hasControl } = require("../../utils/paths");
const { mkRef } = require("../../references/create-reference");
const { parseDockerfile, dockerTokens, dockerJsonTokens } = require("../../parsers/dockerfile");

function extractDockerfile(c, ctx) {
  const out = [];
  const dir = path.dirname(c.file);
  const linked = ctx.links.get(c.file);
  let bases;
  if (linked && linked.length) bases = linked.map((d) => ({ dir: d, confine: true }));
  else {
    bases = [{ dir, confine: false }];
    const root = ctx.rootOf(c.file);
    let d = dir;
    while (root && d !== root && within(d, root)) {
      d = path.dirname(d);
      bases.push({ dir: d, confine: false });
    }
  }
  for (const ins of parseDockerfile(c.text)) {
    const m = /^\s*(COPY|ADD)\s+/i.exec(ins.text);
    if (!m) continue;
    const from = m[0].length;
    let toks = ins.text.slice(from).trim().startsWith("[") ? dockerJsonTokens(ins.text, from) : dockerTokens(ins.text, from);
    if (!toks) continue;
    const flags = [];
    while (toks.length && !toks[0].json && toks[0].value.startsWith("--")) flags.push(toks.shift().value);
    if (flags.some((f) => /^--from(=|$)/i.test(f))) continue;
    if (toks.length < 2) continue;
    for (const t of toks.slice(0, -1)) {
      const v = t.value;
      if (!v || v.startsWith("<<") || v.includes("$") || isUrl(v) || hasControl(v)) continue;
      if (t.end <= t.start) continue;
      const a = ins.map[t.start];
      const b = ins.map[t.end - 1];
      if (!a || !b || a.line !== b.line) continue;
      const r = mkRef({
        file: c.file,
        line: a.line,
        col: a.col,
        endCol: b.col + 1,
        value: v,
        escape: t.json ? (t.esc ? "noedit" : "json") : t.quoted ? "noedit" : "shell",
        code: "PM003",
        base: bases[0].dir,
        bases,
        kind: "any",
        glob: isGlob(v) ? "std" : false,
        label: "Dockerfile " + m[1].toUpperCase() + " source",
      });
      if (v.startsWith("/")) {
        r.value = v.replace(/^\/+/, "") || ".";
        r.fmt = "root";
        r.lead = "";
      }
      out.push(r);
    }
  }
  return out;
}

module.exports = { extractDockerfile };
