"use strict";
const path = require("node:path");
const { within, hasControl } = require("../utils/paths");

const OUTSIDE = Object.freeze({ state: "outside" });
const MISSING = Object.freeze({ state: "missing" });

/**
 * createGuard(fsMod, rootPaths) - existence checks confined to the workspace folders.
 * - A path that is not lexically inside a root is never passed to fs.
 * - Each component is lstat'ed from the (real) root downwards. A symlink is resolved by
 *   reading the link itself; if its target is outside every root the walk stops before the
 *   target is touched.
 */
function createGuard(fsMod, rootPaths) {
  const roots = rootPaths.map((r) => path.resolve(r));
  const real = roots.map((r) => {
    try {
      return path.resolve(fsMod.realpathSync(r));
    } catch (_) {
      return r;
    }
  });
  const cache = new Map();
  const insideReal = (p) => real.some((r) => within(p, r));
  const rootIndex = (p) => {
    let i = roots.findIndex((r) => within(p, r));
    if (i >= 0) return { i, rel: path.relative(roots[i], p) };
    i = real.findIndex((r) => within(p, r));
    if (i >= 0) return { i, rel: path.relative(real[i], p) };
    return null;
  };

  function walk(abs) {
    const ri = rootIndex(abs);
    if (!ri) return OUTSIDE;
    const queue = ri.rel ? ri.rel.split(path.sep).filter(Boolean) : [];
    let cur = real[ri.i];
    let st = null;
    let hops = 0;
    while (queue.length) {
      const part = queue.shift();
      if (part === ".") continue;
      if (part === "..") {
        cur = path.dirname(cur);
        st = null;
        if (!insideReal(cur)) return OUTSIDE;
        continue;
      }
      const next = path.join(cur, part);
      if (!insideReal(next)) return OUTSIDE;
      try {
        st = fsMod.lstatSync(next);
      } catch (_) {
        return MISSING;
      }
      if (st.isSymbolicLink()) {
        if (++hops > 32) return MISSING;
        let target;
        try {
          target = fsMod.readlinkSync(next);
        } catch (_) {
          return MISSING;
        }
        const t = path.resolve(cur, target);
        const j = real.findIndex((r) => within(t, r));
        if (j < 0) return OUTSIDE;
        const relT = path.relative(real[j], t);
        cur = real[j];
        st = null;
        queue.unshift(...(relT ? relT.split(path.sep).filter(Boolean) : []));
        continue;
      }
      if (queue.length && !st.isDirectory()) return MISSING;
      cur = next;
    }
    if (!st) {
      if (real.includes(cur)) return { state: "dir", real: cur, size: 0 };
      try {
        st = fsMod.lstatSync(cur);
      } catch (_) {
        return MISSING;
      }
    }
    return { state: st.isDirectory() ? "dir" : st.isFile() ? "file" : "other", real: cur, size: st.size };
  }

  function status(abs) {
    if (typeof abs !== "string" || !abs || hasControl(abs)) return MISSING;
    abs = path.resolve(abs);
    if (cache.has(abs)) return cache.get(abs);
    const r = walk(abs);
    cache.set(abs, r);
    return r;
  }

  function readText(abs, maxBytes) {
    const s = status(abs);
    if (s.state === "outside") return { skip: "outside" };
    if (s.state !== "file") return { skip: "missing" };
    if (s.size > maxBytes) return { skip: "large" };
    try {
      return { text: fsMod.readFileSync(s.real, "utf8") };
    } catch (_) {
      return { skip: "unreadable" };
    }
  }

  const inside = (p) => !!rootIndex(path.resolve(p));
  const rootOf = (p) => {
    const ri = rootIndex(path.resolve(p));
    return ri ? roots[ri.i] : null;
  };
  return { status, readText, inside, rootOf, roots, real };
}

module.exports = { createGuard };
