"use strict";
const path = require("node:path");
const { osa } = require("../utils/edit-distance");

function parentOf(rel) {
  const i = rel.lastIndexOf("/");
  return i > 0 ? rel.slice(0, i) : "";
}

class FileIndex {
  constructor() {
    this.roots = new Map();
    this.truncated = false;
  }
  _r(root) {
    let r = this.roots.get(root);
    if (!r) {
      r = { files: new Set(), dirs: new Set(), names: null };
      this.roots.set(root, r);
    }
    return r;
  }
  clear() {
    this.roots.clear();
    this.truncated = false;
  }
  add(root, rel) {
    if (!rel || rel === ".." || rel.startsWith("../") || path.isAbsolute(rel)) return;
    const r = this._r(root);
    r.files.add(rel);
    let d = rel;
    while ((d = parentOf(d))) {
      if (r.dirs.has(d)) break;
      r.dirs.add(d);
    }
    r.names = null;
  }
  remove(root, rel) {
    const r = this.roots.get(root);
    if (!r) return;
    const pre = rel + "/";
    for (const f of [...r.files]) if (f === rel || f.startsWith(pre)) r.files.delete(f);
    for (const d of [...r.dirs]) if (d === rel || d.startsWith(pre)) r.dirs.delete(d);
    r.names = null;
  }
  _names(r) {
    if (r.names) return r.names;
    const names = new Map();
    const put = (rel, dir) => {
      const n = rel.slice(rel.lastIndexOf("/") + 1);
      let list = names.get(n);
      if (!list) names.set(n, (list = []));
      list.push({ rel, dir });
    };
    for (const f of r.files) put(f, false);
    for (const d of r.dirs) put(d, true);
    r.names = names;
    return names;
  }
  match(root, re, kind) {
    const r = this.roots.get(root);
    if (!r || !re) return false;
    if (kind !== "dir") for (const f of r.files) if (re.test(f)) return true;
    if (kind !== "file") for (const d of r.dirs) if (re.test(d) || re.test(d + "/")) return true;
    return false;
  }
  hasName(root, scopeRel, name, kind) {
    const r = this.roots.get(root);
    if (!r) return false;
    const list = this._names(r).get(name) || [];
    return list.some(
      (e) => (kind === "dir" ? e.dir : kind === "file" ? !e.dir : true) && (!scopeRel || e.rel.startsWith(scopeRel + "/"))
    );
  }
  *paths(kind = "any") {
    for (const [root, entries] of this.roots) {
      if (kind !== "dir") for (const rel of entries.files) yield path.resolve(root, rel);
      if (kind !== "file") for (const rel of entries.dirs) yield path.resolve(root, rel);
    }
  }
  suggest(root, rel, kind, confineRel) {
    const r = this.roots.get(root);
    if (!r || !rel) return null;
    const names = this._names(r);
    const name = rel.slice(rel.lastIndexOf("/") + 1);
    if (!name) return null;
    const ok = (e) =>
      e.rel !== rel &&
      (kind === "dir" ? e.dir : kind === "file" ? !e.dir : true) &&
      (!confineRel || e.rel.startsWith(confineRel + "/"));
    let best = null;
    let bestScore = Infinity;
    const consider = (e, score) => {
      if (score < bestScore || (score === bestScore && best && e.rel.length < best.length)) {
        best = e.rel;
        bestScore = score;
      }
    };
    for (const e of names.get(name) || []) if (ok(e)) consider(e, osa(rel, e.rel));
    if (best) return best;
    const thr = name.length <= 4 ? 1 : Math.min(3, Math.max(1, Math.floor(name.length / 4)));
    for (const [n, list] of names) {
      if (Math.abs(n.length - name.length) > thr) continue;
      const d = osa(name, n, thr);
      if (d > thr || d === 0) continue;
      for (const e of list) if (ok(e)) consider(e, d * 1000 + osa(rel, e.rel));
    }
    return best;
  }
}

module.exports = { FileIndex };
