"use strict";
const { posOf } = require("../utils/text-position");

function mkRef(o) {
  const r = Object.assign({ kind: "any", glob: false, alts: [], fmt: "rel", escape: "none" }, o);
  if (r.display === undefined) r.display = r.value;
  if (r.lead === undefined) r.lead = /^\.\//.test(r.value) ? "./" : "";
  if (r.trail === undefined) r.trail = r.value.length > 1 && /\/$/.test(r.value) ? "/" : "";
  return r;
}

function jsonRef(c, node, o) {
  const p = posOf(c.starts, node.start);
  return mkRef(
    Object.assign({ file: c.file, line: p.line, col: p.col, endCol: p.col + (node.end - node.start), value: node.value, escape: "json" }, o)
  );
}

function yamlRef(c, s, o) {
  return mkRef(
    Object.assign(
      {
        file: c.file,
        line: s.line,
        col: s.col,
        endCol: s.endCol,
        value: s.value,
        escape: s.quote === '"' ? "yaml-dq" : s.quote === "'" ? "yaml-sq" : "plain",
      },
      o
    )
  );
}

module.exports = { mkRef, jsonRef, yamlRef };
