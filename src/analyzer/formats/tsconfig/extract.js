"use strict";
const path = require("node:path");
const { isGlob, hasControl } = require("../../utils/paths");
const { parseJsonc, jget } = require("../../parsers/jsonc");
const { jsonRef } = require("../../references/create-reference");
const { TS_MODULE_ALTS } = require("../../references/module-alternatives");

function tsExtends(tree, file) {
  const ext = jget(tree, "extends");
  const out = [];
  for (const n of ext && ext.type === "array" ? ext.items : [ext]) {
    if (!n || n.type !== "string" || !n.value) continue;
    if (!/^(\.\.?\/|\/)/.test(n.value) || n.value.includes("$")) {
      out.push(null);
      continue;
    }
    const abs = path.resolve(path.dirname(file), n.value);
    out.push(/\.json$/i.test(abs) ? abs : abs + ".json");
  }
  return out;
}

/** baseUrl of `file` or inherited through relative "extends" (later entries win); null when none, undefined when unknown. */
function inheritedBaseUrl(file, ctx, depth) {
  const info = ctx.tsInfo.get(file);
  if (!info || depth > 16) return undefined;
  if (info.baseUrl !== null) return info.baseUrl;
  for (let k = info.extends.length - 1; k >= 0; k--) {
    const e = info.extends[k];
    if (e === null) return undefined;
    const r = inheritedBaseUrl(e, ctx, depth + 1);
    if (r !== null) return r;
  }
  return null;
}

/**
 * The directory "paths" of `file` are resolved against: its own baseUrl, else the baseUrl it
 * inherits through relative "extends", else its own folder. Undefined when that is unknown (a
 * package name in "extends", or a base config that was not read): the entries are then not
 * checked rather than checked against a guess.
 */
function tsPathsBase(file, ctx) {
  const r = inheritedBaseUrl(file, ctx, 0);
  if (r === undefined) return undefined;
  return r === null ? path.dirname(file) : r;
}

function tsInfoOf(c) {
  const tree = parseJsonc(c.text);
  if (!tree || tree.type !== "object") return null;
  const co = jget(tree, "compilerOptions");
  const b = jget(co, "baseUrl");
  const ok = b && b.type === "string" && b.value && !b.value.includes("$") && !hasControl(b.value);
  return { tree, baseUrl: ok ? path.resolve(path.dirname(c.file), b.value) : null, extends: tsExtends(tree, c.file) };
}

function extractTsconfig(c, ctx) {
  const info = ctx.tsInfo.get(c.file);
  const tree = info && info.tree;
  if (!tree || tree.type !== "object") return [];
  const out = [];
  const base = path.dirname(c.file);
  const name = path.basename(c.file);
  const add = (node, label, o) => {
    if (!node || node.type !== "string" || !node.value) return;
    out.push(jsonRef(c, node, Object.assign({ code: "PM002", base, label: name + " " + label }, o)));
  };
  const ext = jget(tree, "extends");
  for (const n of ext && ext.type === "array" ? ext.items : [ext]) {
    if (n && n.type === "string" && /^(\.\.?\/|\/)/.test(n.value)) add(n, "extends", { kind: "file", alts: [".json"] });
  }
  const files = jget(tree, "files");
  if (files && files.type === "array") for (const n of files.items) add(n, "files", { kind: "file" });
  const inc = jget(tree, "include");
  if (inc && inc.type === "array") for (const n of inc.items) if (n.type === "string") add(n, "include", { kind: "any", glob: isGlob(n.value) ? "std" : false });
  const refs = jget(tree, "references");
  if (refs && refs.type === "array") {
    for (const r of refs.items) add(jget(r, "path"), "references", { kind: "any", needFileIn: ["tsconfig.json"] });
  }
  const co = jget(tree, "compilerOptions");
  const baseUrl = jget(co, "baseUrl");
  if (baseUrl && baseUrl.type === "string" && baseUrl.value) add(baseUrl, "compilerOptions.baseUrl", { kind: "dir" });
  const typeRoots = jget(co, "typeRoots");
  if (typeRoots && typeRoots.type === "array") {
    for (const n of typeRoots.items) add(n, "compilerOptions.typeRoots", { kind: "dir" });
  }
  const paths = jget(co, "paths");
  let pathsBase = paths && paths.type === "object" ? tsPathsBase(c.file, ctx) : undefined;
  // A missing (or outside) baseUrl is reported once; its "paths" are then not checked against it.
  if (pathsBase !== undefined && ctx.guard.status(pathsBase).state !== "dir") pathsBase = undefined;
  if (pathsBase !== undefined) {
    for (const p of paths.props) {
      if (!p.value || p.value.type !== "array") continue;
      const label = 'compilerOptions.paths["' + p.key + '"]';
      for (const n of p.value.items) {
        if (!n || n.type !== "string" || !n.value || n.value.includes("$")) continue;
        if (n.value.includes("*")) add(n, label, { base: pathsBase, kind: "any", glob: "any" });
        else add(n, label, { base: pathsBase, kind: "any", alts: TS_MODULE_ALTS });
      }
    }
  }
  for (const k of ["outDir", "declarationDir"]) {
    const n = jget(co, k);
    if (n && n.type === "string" && n.value && !n.value.includes("$")) ctx.outDirs.push(path.resolve(base, n.value));
  }
  return out;
}

module.exports = { extractTsconfig, tsInfoOf };
