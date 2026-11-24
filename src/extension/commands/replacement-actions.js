"use strict";
const vscode = require("vscode");
const fs = require("node:fs");
const path = require("node:path");
const analyzer = require("../../analyzer");
const { canReplace } = require("../../analyzer/references/can-replace");
const { validateReplacement } = require("../../analyzer/references/validate-replacement");

function createReplacementActions(runtime, liveFinding) {
  const environment = f => {
    const roots = runtime.roots().map(r => r.path);
    const cfg = runtime.getConfig();
    const excluded = analyzer.makeMatcher(cfg.exclude || []);
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
    return validateReplacement(f.ref, replacement, env.guard, env.index) === "valid" ? replacement : null;
  }
  async function pickReplacement(arg) {
    const f = liveFinding(arg);
    if (!f || !canReplace(f)) return null;
    const env = environment(f);
    const selection = await vscode.window.showOpenDialog({
      defaultUri: vscode.Uri.file(f.ref.base),
      canSelectFiles: f.ref.kind !== "dir",
      canSelectFolders: f.ref.kind !== "file",
      canSelectMany: false,
      openLabel: "Use replacement path",
    });
    if (!selection?.length || selection[0].scheme !== "file" || liveFinding(arg) !== f) return null;
    return candidate(f, path.resolve(selection[0].fsPath), environment(f));
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
  return { pickReplacement, completeReplacement };
}
module.exports = { createReplacementActions };
