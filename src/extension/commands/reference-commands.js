"use strict";
const vscode = require("vscode");
const path = require("node:path");
const fs = require("node:fs");
const analyzer = require("../../analyzer");
const { createReport } = require("../../../views/report");
const { exportResults } = require("../../../views/export-results");
const { showErrorDetail, confirmReplacement } = require("../../../views/native-dialogs");

function createCommands(runtime) {
  const { getConfig, roots, insideWorkspace, confined, viewPath, getGroups, scan, scheduleScan, invalidateIndex } = runtime;
  function liveFinding(arg) {
    if (!runtime.state || !arg || typeof arg !== "object") return undefined;
    const a = arg.type === "finding" && arg.f && typeof arg.f === "object" ? arg.f : arg;
    if (typeof a.file !== "string" || !Number.isInteger(a.line) || !Number.isInteger(a.col) || typeof a.code !== "string") return undefined;
    const file = path.resolve(a.file);
    return (runtime.state.findings || []).find((f) => f.file === file && f.line === a.line && f.col === a.col && f.code === a.code);
  }
  function getReport() {
    const cfg = getConfig();
    return createReport(getGroups(), cfg.severity, cfg.enabled, roots().length > 0);
  }
  
  async function exportCurrentResults() {
    return exportResults(getReport());
  }
  
  async function openReferenceDetailsAt(location, ref = null) {
    if (!runtime.referenceDetailsSidebarProvider || !runtime.referenceDetailsPanel) return false;
    if (location === "editor") {
      runtime.referenceDetailsPanel.select(ref);
      runtime.referenceDetailsPanel.reveal();
    } else {
      await runtime.referenceDetailsSidebarProvider.reveal(ref);
    }
    return true;
  }
  
  function defaultReferenceDetailsLocation() {
    return vscode.workspace.getConfiguration("pathmend").get("referenceDetails.defaultLocation", "sidebar");
  }
  
  async function openReferenceDetails() {
    return openReferenceDetailsAt(defaultReferenceDetailsLocation());
  }
  
  async function showReferenceDetails(arg) {
    const f = liveFinding(arg);
    if (!f) return false;
    return openReferenceDetailsAt(defaultReferenceDetailsLocation(), { file: f.file, line: f.line, col: f.col, code: f.code });
  }
  
  async function openReference(arg) {
    const f = liveFinding(arg);
    if (!f) {
      vscode.window.showWarningMessage("PathMend: reference is outdated. Scan again.");
      return false;
    }
    if (!insideWorkspace(f.file) || !confined(f.file)) {
      vscode.window.showWarningMessage("PathMend: refusing to open a file outside the workspace.");
      return false;
    }
    try {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(f.file));
      const line = Math.min(f.line, Math.max(0, doc.lineCount - 1));
      const r = new vscode.Range(line, f.col, line, f.endCol);
      await vscode.window.showTextDocument(doc, { selection: r, preview: true });
      return true;
    } catch (e) {
      void showErrorDetail("Could not open source file.", viewPath(f.file) + "\n\n" + (e?.message || String(e)));
      return false;
    }
  }
  
  /** Replace the broken path with the "Did you mean" suggestion (same edit as the Quick Fix). */
  async function applyFix(arg, replacement) {
    const f = liveFinding(arg);
    if (!f || !f.fix) {
      vscode.window.showWarningMessage("PathMend: no fix available. Scan again.");
      return false;
    }
    if (!insideWorkspace(f.file) || !confined(f.file)) {
      vscode.window.showWarningMessage("PathMend: refusing to edit a file outside the workspace.");
      return false;
    }
    let doc;
    try {
      doc = await vscode.workspace.openTextDocument(vscode.Uri.file(f.file));
    } catch (_) {
      return false;
    }
    const r = new vscode.Range(f.line, f.col, f.line, f.endCol);
    const chosen = replacement === undefined ? f.fix : replacement;
    if (replacement !== undefined && chosen !== f.fix) {
      const validation = analyzer.validateReplacement(f.ref, chosen, analyzer.createGuard(fs, roots().map(r => r.path)), runtime.state.index);
      if (validation === "invalid") {
        void showErrorDetail("Invalid replacement syntax.", "The replacement cannot be safely represented in this reference.\n\nReplacement:\n" + String(chosen));
        return false;
      }
      if (validation !== "valid") {
        const version = doc.version;
        const confirmed = await confirmReplacement(f.ref.display, chosen);
        if (confirmed !== "Apply Anyway") return false;
        if (doc.version !== version || liveFinding(arg) !== f || !insideWorkspace(f.file) || !confined(f.file)) {
          vscode.window.showWarningMessage("PathMend: reference changed. Rescanning.");
          scheduleScan(0);
          return false;
        }
      }
    }
    const text = analyzer.encodeFor(f.ref, chosen);
    if (text === null || doc.getText(r) !== f.ref.raw) {
      vscode.window.showWarningMessage("PathMend: source changed. Rescanning.");
      scheduleScan(0);
      return false;
    }
    const wasDirty = doc.isDirty;
    const edit = new vscode.WorkspaceEdit();
    edit.replace(doc.uri, r, text);
    const ok = await vscode.workspace.applyEdit(edit);
    if (ok && !wasDirty) await doc.save();
    await scan();
    return ok;
  }
  
  // ---------------------------------------------------------------------------
  // Quick Fix
  async function showBroken() {
    await scan();
    const list = runtime.state.findings || [];
    if (!list.length) {
      vscode.window.showInformationMessage("PathMend: no broken path references.");
      return;
    }
    const items = list.map((f) => ({
      label: (f.info ? "$(info) " : "$(link) ") + f.code + " · " + path.basename(f.file) + ":" + (f.line + 1),
      description: f.ref.display,
      detail: viewPath(f.file) + " · " + f.message,
      f,
    }));
    const pick = await vscode.window.showQuickPick(items, { title: "PathMend: Broken References", placeHolder: "Search by path, file, or rule", matchOnDescription: true, matchOnDetail: true });
    if (!pick) return;
    await showReferenceDetails(pick.f);
  }
  
  async function scanCommand() {
    invalidateIndex();
    const f = await scan();
    const n = f.filter((x) => !x.info).length;
    vscode.window.setStatusBarMessage("PathMend: " + n + " broken path reference" + (n === 1 ? "" : "s"), 4000);
    return f;
  }
  
  // ---------------------------------------------------------------------------
  return { liveFinding, getReport, exportCurrentResults, openReferenceDetailsAt, defaultReferenceDetailsLocation, openReferenceDetails, showReferenceDetails, openReference, applyFix, showBroken, scanCommand };
}
module.exports = { createCommands };
