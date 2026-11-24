"use strict";
const vscode = require("vscode");
const fs = require("node:fs");
const path = require("node:path");
const analyzer = require("../../analyzer");
const { evaluateRef } = require("../../analyzer/references/evaluate");
const { canReplace } = require("../../analyzer/references/can-replace");
const { inspectReplacement } = require("../../analyzer/references/validate-replacement");

function createReplacementActions(runtime, liveFinding) {
  const environment = f => {
    const roots = runtime.roots().map(r => r.path);
    const cfg = runtime.getConfig();
    const excluded = analyzer.makeMatcher([...(cfg.exclude || []), ...(cfg.ignoreReferences || [])]);
    return { guard: analyzer.createGuard(fs, roots), index: runtime.state.index, excluded, ref: f.ref };
  };
  function candidate(f, abs, env) {
    const root = env.guard.rootOf(abs);
    if (!root || env.excluded(analyzer.toPosix(path.relative(root, abs)))) return null;
    const kind = env.guard.status(abs).state;
    if (!["file", "dir"].includes(kind) || (f.ref.kind !== "any" && f.ref.kind !== kind)) return null;
    const base = f.ref.base;
    const replacement = analyzer.formatPath(f.ref, abs, base);
    // Ensure the selected target is actually the path that the reference resolves to.
    if (!analyzer.within(abs, root) || (f.ref.bases || []).some(b => b.confine && !analyzer.within(abs, b.dir))) return null;
    // A multi-base reference may resolve to an earlier, different target.
    if (inspectReplacement(f.ref, replacement, env.guard, env.index) !== "valid") return null;
    const value = f.ref.fmt === "wsvar" ? replacement.slice(f.ref.varPrefix.length).replace(/^\/+/, "") || "." :
      f.ref.fmt === "root" ? replacement.replace(/^\/+/, "") || "." : replacement;
    const resolved = evaluateRef({ ...f.ref, value, glob: false, anywhere: undefined }, {
      guard: env.guard, index: env.index, ignored: () => false,
    });
    return resolved?.state === "ok" && path.resolve(resolved.hit || resolved.abs) === abs ? replacement : null;
  }
  async function pickReplacement(arg) {
    const f = liveFinding(arg);
    if (!f || !canReplace(f)) return null;
    const selection = await vscode.window.showOpenDialog({
      defaultUri: vscode.Uri.file(f.ref.base),
      canSelectFiles: f.ref.kind !== "dir",
      canSelectFolders: f.ref.kind !== "file",
      canSelectMany: false,
      openLabel: "Use replacement path",
    });
    if (!selection?.length || selection[0].scheme !== "file" || liveFinding(arg) !== f) return null;
    const value = candidate(f, path.resolve(selection[0].fsPath), environment(f));
    if (value === null) void vscode.window.showWarningMessage("PathMend: selected path is not an eligible replacement.");
    return value;
  }
  function completeReplacement(arg, query) {
    const f = liveFinding(arg);
    if (!f || !canReplace(f) || !query.trim()) return [];
    const env = environment(f);
    if (!env.index) return [];
    const match = query.toLowerCase().replace(/^\.\//, "");
    const out = new Set();
    for (const abs of env.index.paths(f.ref.kind)) {
      const formatted = analyzer.formatPath(f.ref, abs, f.ref.base);
      if (!formatted.toLowerCase().includes(match)) continue;
      const value = candidate(f, abs, env);
      if (value !== null) out.add(value);
      if (out.size >= 20) break;
    }
    return [...out].sort();
  }
  function checkReplacement(arg, value) {
    const f = liveFinding(arg);
    if (!f || !canReplace(f)) return "unavailable";
    const env = environment(f);
    return inspectReplacement(f.ref, value, env.guard, env.index);
  }
  return { pickReplacement, completeReplacement, checkReplacement };
}
module.exports = { createReplacementActions };
