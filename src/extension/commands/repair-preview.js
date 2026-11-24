"use strict";
const vscode = require("vscode");
const fs = require("node:fs");
const path = require("node:path");
const analyzer = require("../../analyzer");
const { canReplace } = require("../../analyzer/references/can-replace");
let sequence = 0;

function createRepairPreview(runtime, liveFinding) {
  const guard = () => analyzer.createGuard(fs, runtime.roots().map(r => r.path));
  const eligible = f => runtime.insideWorkspace(f.file) && runtime.confined(f.file);
  async function prepare(arg, replacement) {
    const f = liveFinding(arg);
    if (!f || !canReplace(f) || !eligible(f)) return null;
    const chosen = replacement === undefined ? f.fix : replacement;
    if (typeof chosen !== "string") return null;
    const validation = analyzer.validateReplacement(f.ref, chosen, guard(), runtime.state.index);
    const encoded = analyzer.encodeFor(f.ref, chosen);
    if (validation === "invalid" || encoded === null) return null;
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(f.file));
    const range = new vscode.Range(f.line, f.col, f.line, f.endCol);
    if (doc.getText(range) !== f.ref.raw || liveFinding(arg) !== f || !eligible(f)) return null;
    return { arg, f, chosen, encoded, validation, doc, range, version: doc.version,
      start: doc.offsetAt(range.start), end: doc.offsetAt(range.end) };
  }
  function current(p) {
    return eligible(p.f) && liveFinding(p.arg) === p.f && p.doc.version === p.version &&
      p.doc.getText(p.range) === p.f.ref.raw;
  }
  async function showDiff(doc, before, after, title, accept = "Apply") {
    const scheme = "pathmend-preview-" + (++sequence);
    const original = vscode.Uri.from({ scheme, path: "/original/" + path.basename(doc.fileName) });
    const proposed = vscode.Uri.from({ scheme, path: "/proposed/" + path.basename(doc.fileName) });
    const provider = vscode.workspace.registerTextDocumentContentProvider(scheme, {
      provideTextDocumentContent(uri) { return uri.path === original.path ? before : after; },
    });
    try {
      await vscode.commands.executeCommand("vscode.diff", original, proposed, title, { preview: true });
      return await vscode.window.showInformationMessage("Review the repair diff, then choose " + accept + " or Cancel.", accept, "Cancel") === accept;
    } finally { provider.dispose(); }
  }
  async function previewFix(arg, replacement, applyFix) {
    try {
      const p = await prepare(arg, replacement);
      if (!p) { void vscode.window.showWarningMessage("PathMend: repair unavailable or outdated."); return false; }
      const before = p.doc.getText();
      const after = before.slice(0, p.start) + p.encoded + before.slice(p.end);
      if (!await showDiff(p.doc, before, after, "PathMend: " + runtime.viewPath(p.f.file))) return false;
      if (!current(p)) { void vscode.window.showWarningMessage("PathMend: source changed. Scan and preview again."); return false; }
      return await applyFix(arg, p.chosen);
    } catch (error) {
      void vscode.window.showWarningMessage("PathMend: could not preview repair: " + error.message);
      return false;
    }
  }
  return { prepare, current, showDiff, previewFix };
}
module.exports = { createRepairPreview };
