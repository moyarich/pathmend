"use strict";
const path = require("node:path");
const { toPosix, within, isUrl, isGlob, hasControl } = require("../utils/paths");
const { globToRegex, makeMatcher } = require("../utils/glob");

function staticPrefix(abs) {
  const parts = abs.split(path.sep);
  const out = [];
  for (const p of parts) {
    if (isGlob(p)) break;
    out.push(p);
  }
  return out.join(path.sep) || path.sep;
}

function checkOne(ref, abs, env) {
  const root = env.guard.rootOf(abs);
  if (!root) return { state: "outside", abs };
  const rel = toPosix(path.relative(root, abs));
  if (env.ignored(abs, root)) return { state: "skip", abs };
  const excluded = makeMatcher(ref.workspaceExclusions || []);
  const workspaceExcluded = target => excluded(toPosix(path.relative(ref.base, target)));
  if (!ref.glob && workspaceExcluded(abs)) return { state: "skip", abs };
  if (ref.glob) {
    const prefix = staticPrefix(abs);
    const ps = env.guard.status(prefix);
    if (ps.state === "outside") return { state: "outside", abs };
    if (env.ignored(prefix, root)) return { state: "skip", abs };
    if (ps.state === "missing") return { state: "glob", abs };
    if (ref.needFileIn) {
      const re = globToRegex(rel, ref.glob === "any");
      if (!re) return {state:"skip",abs};
      let matched = false;
      for (const target of env.index.paths("dir")) {
        if (!within(target, root) || !re.test(toPosix(path.relative(root,target)))) continue;
        if (workspaceExcluded(target) || env.ignored(target,root)) continue;
        matched = true;
        if (env.guard.status(target).state !== "dir") continue;
        if (ref.needFileIn.some(name=>env.guard.status(path.join(target,name)).state==="file")) return {state:"ok",abs,hit:abs};
      }
      if (!matched && ref.workspaceExclusions?.length) return {state:"skip",abs};
    } else if (env.index.match(root, globToRegex(rel, ref.glob === "any"), ref.kind)) return { state: "ok", abs, hit: abs };
    return { state: env.index.truncated ? "skip" : "glob", abs };
  }
  if (ref.anywhere) {
    const scope = toPosix(path.relative(root, ref.base));
    if (scope.startsWith("..")) return { state: "skip", abs };
    const name = ref.anywhere.slice(ref.anywhere.lastIndexOf("/") + 1);
    if (env.index.hasName(root, scope, name, ref.kind)) return { state: "ok", abs, hit: abs, anywhere: true };
    return { state: env.index.truncated ? "skip" : "missing", abs, anywhere: true };
  }
  let st = env.guard.status(abs);
  if (st.state === "outside") return { state: "outside", abs };
  let hit = st.state === "missing" ? null : abs;
  if (!hit || (ref.escape === "document-path" && ref.kind === "file" && st.state === "dir")) {
    for (const a of ref.alts || []) {
      const s2 = env.guard.status(abs + a);
      if (s2.state === "outside") return { state: "outside", abs };
      if (s2.state !== "missing" && (ref.escape !== "document-path" || s2.state === "file")) {
        hit = abs + a;
        st = s2;
        break;
      }
    }
  }
  if (!hit) return { state: "missing", abs, root, rel };
  if (ref.kind === "dir" && st.state !== "dir") return { state: "notdir", abs };
  if (ref.kind === "file" && st.state === "dir") return { state: "notfile", abs };
  if (st.state === "dir" && ref.needFileIn) {
    let found = false;
    for (const nme of ref.needFileIn) {
      const s3 = env.guard.status(path.join(hit, nme));
      if (s3.state === "file") {
        found = true;
        break;
      }
    }
    if (!found) return { state: "noentry", abs };
  }
  return { state: "ok", abs, hit };
}

function evaluateRef(ref, env) {
  if (ref.workspacePackage) {
    const matches = env.workspacePackages?.resolve(ref.base,ref.workspacePackage);
    if (!matches) return {state:"skip"};
    if (matches.length>1) return {state:"workspace-package-duplicate"};
    if (!matches.length) return {state:env.index.truncated ? "skip" : "workspace-package-missing"};
    return {state:"skip"}; // symbolic package names are not filesystem repair/rename targets
  }
  const v = ref.value;
  if (!v || hasControl(v) || isUrl(v) || (ref.fmt !== "wsvar" && v.includes("${"))) return { state: "skip" };
  const bases = ref.bases || [{ dir: ref.base, confine: false }];
  let first = null;
  for (const b of bases) {
    const abs = path.resolve(b.dir, v);
    let r;
    if (b.confine && !within(abs, b.dir)) r = { state: "context", abs, ctx: b.dir };
    else {
      if (ref.requireBase) {
        const bs = env.guard.status(b.dir);
        if (bs.state !== "dir") return { state: "skip" };
      }
      r = checkOne(ref, abs, env);
    }
    r.base = b.dir;
    r.confine = b.confine;
    if (r.state === "ok" || r.state === "skip") return r;
    if (!first) first = r;
  }
  return first;
}

module.exports = { evaluateRef };
