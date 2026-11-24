"use strict";
const path = require("node:path");
const { hasControl } = require("../../utils/paths");
const { parseJsonc, jget } = require("../../parsers/jsonc");
const { jsonRef } = require("../../references/create-reference");

function extractLaunch(c, ctx) {
  const out = [];
  const tree = parseJsonc(c.text);
  const confs = jget(tree, "configurations");
  if (!confs || confs.type !== "array") return out;
  const folder = path.dirname(path.dirname(c.file));
  for (const conf of confs.items) {
    for (const [k, kind] of [["program", "file"], ["cwd", "dir"]]) {
      const n = jget(conf, k);
      if (!n || n.type !== "string") continue;
      const m = /^\$\{(workspaceFolder|workspaceRoot)(?::([^}]+))?\}(.*)$/.exec(n.value);
      if (!m || m[3].includes("${") || hasControl(n.value)) continue;
      let base = folder;
      if (m[2]) {
        const f = ctx.roots.find((r) => r.name === m[2]);
        if (!f) continue;
        base = f.path;
      }
      const rest = m[3].replace(/^[\\/]+/, "");
      const r = jsonRef(c, n, { code: "PM007", base, kind, label: "launch.json " + k, fmt: "wsvar" });
      r.varPrefix = "${" + m[1] + (m[2] ? ":" + m[2] : "") + "}";
      r.value = rest || ".";
      r.lead = "";
      r.trail = rest.length > 1 && /\/$/.test(rest) ? "/" : "";
      out.push(r);
    }
  }
  return out;
}

module.exports = { extractLaunch };
