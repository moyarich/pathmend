"use strict";
const path = require("node:path");
const { isGlob } = require("../../utils/paths");
const { posOf } = require("../../utils/text-position");
const { parseJsonc, jget } = require("../../parsers/jsonc");
const { mkRef, jsonRef } = require("../../references/create-reference");
const { extractDependencies } = require("./dependencies");
const { extractScriptPaths } = require("./scripts");

function packageScriptRefs(c, node, label, base, ctx) {
  if (!node || node.type !== "string" || !node.value) return [];
  // JSON escapes change source offsets. Do not attempt unsafe edits in those strings.
  if (c.text.slice(node.start, node.end) !== node.value) return [];
  return extractScriptPaths(node.value, base, ctx.packageDirs).map(({ value, offset, base: scriptBase }) => {
    const position = posOf(c.starts, node.start + offset);
    return mkRef({
      file: c.file, line: position.line, col: position.col,
      endCol: position.col + value.length, value,
      escape: "json", code: "PM001", base: scriptBase, kind: "file",
      label: "package.json " + label,
    });
  });
}

function extractPackage(c, ctx) {
  const tree = parseJsonc(c.text);
  if (!tree || tree.type !== "object") return [];
  const out = [];
  const base = path.dirname(c.file);
  const add = (node, label, o) => {
    if (!node || node.type !== "string" || !node.value) return;
    out.push(jsonRef(c, node, Object.assign({ code: "PM001", base, label: "package.json " + label }, o)));
  };
  add(jget(tree, "main"), "main", { kind: "file", alts: [".js", ".json", ".node", "/index.js", "/index.json", "/index.node"] });
  for (const k of ["module", "types", "typings", "browser"]) add(jget(tree, k), k, { kind: "file" });
  const scripts = jget(tree, "scripts");
  if (scripts && scripts.type === "object") {
    for (const entry of scripts.props) out.push(...packageScriptRefs(c, entry.value, "scripts." + entry.key, base, ctx));
  }
  const bin = jget(tree, "bin");
  if (bin && bin.type === "string") add(bin, "bin", { kind: "file" });
  else if (bin && bin.type === "object") for (const p of bin.props) add(p.value, "bin." + p.key, { kind: "file" });
  const walk = (node, label, d) => {
    if (!node || d > 20) return;
    if (node.type === "string") {
      if (node.value.startsWith("./")) add(node, label, { kind: "file", glob: node.value.includes("*") ? "any" : false });
    } else if (node.type === "object") {
      for (const p of node.props) walk(p.value, label + '["' + p.key + '"]', d + 1);
    } else if (node.type === "array") {
      for (const it of node.items) walk(it, label, d + 1);
    }
  };
  walk(jget(tree, "exports"), "exports", 0);
  const files = jget(tree, "files");
  if (files && files.type === "array") {
    for (const it of files.items) {
      if (it.type === "string" && it.value && !it.value.startsWith("!")) add(it, "files", { kind: "any", glob: isGlob(it.value) ? "std" : false });
    }
  }
  out.push(...extractDependencies(c, tree, ctx));
  let ws = jget(tree, "workspaces");
  if (ws && ws.type === "object") ws = jget(ws, "packages");
  if (ws && ws.type === "array") {
    const exclusions = ws.items.filter(it => it.type === "string" && it.value.startsWith("!")).map(it => it.value.slice(1));
    for (const it of ws.items) {
      if (it.type === "string" && it.value && !it.value.startsWith("!")) add(it, "workspaces", { kind: "dir", glob: isGlob(it.value) ? "std" : false, needFileIn: ["package.json"], workspaceExclusions: exclusions });
    }
  }
  return out;
}

module.exports = { extractPackage };
