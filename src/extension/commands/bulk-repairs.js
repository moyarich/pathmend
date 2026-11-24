"use strict";
const vscode = require("vscode");
const fs = require("node:fs");
const analyzer = require("../../analyzer");
const { proposeRepairs } = require("../../analyzer/references/propose-repairs");

function createBulkRepairs(runtime, preview) {
  async function bulkRepair(references) {
    const warn = message => { void vscode.window.showWarningMessage("PathMend: " + message); return false; };
    const validate = p => analyzer.validateReplacement(p.f.ref, p.chosen,
      analyzer.createGuard(fs, runtime.roots().map(r => r.path)), runtime.state.index) === "valid";
    try {
      const direct = Array.isArray(references);
      const findings = runtime.state?.findings || [];
      const requested = direct ? references.map(ref => findings.find(f => f.file === ref.file && f.line === ref.line && f.col === ref.col && f.code === ref.code)) : findings;
      if (direct && (!requested.length || requested.some(f => !f?.fix || f.info))) return warn("A selected suggestion is unavailable. Scan again.");
      const candidates = [];
      for (const f of requested) {
        if (!f.fix) continue;
        const p = await preview.prepare(f, f.fix);
        if (p && p.validation === "valid") candidates.push(p);
      }
      if (direct && candidates.length !== requested.length) return warn("A selected suggestion could not be verified. Nothing was applied.");
      if (!candidates.length) return warn("No verified suggestions available.");
      const selected = direct ? candidates.map(p => ({p})) : await vscode.window.showQuickPick(candidates.map(p => ({
        label: runtime.viewPath(p.f.file) + ":" + (p.f.line + 1),
        description: p.f.ref.display + " → " + p.chosen,
        picked: true, p,
      })), { canPickMany: true, matchOnDescription: true, title: "Select verified repairs",
        placeHolder: "Select individual repairs or keep all selected" });
      if (!selected?.length) return false;
      const groups = new Map();
      for (const { p } of selected) {
        if (!preview.current(p) || !validate(p)) return warn("A selected repair changed. Scan again.");
        if (!groups.has(p.f.file)) groups.set(p.f.file, []);
        groups.get(p.f.file).push(p);
      }
      for (const [file, entries] of groups) {
        const before = entries[0].doc.getText();
        const after = proposeRepairs(before, entries.map(p => ({ ...p, raw: p.f.ref.raw })));
        if (after === null) return warn("Selected repairs overlap or are stale. Select fewer repairs.");
        if (!await preview.showDiff(entries[0].doc, before, after, "PathMend: " + runtime.viewPath(file), "Continue")) return false;
      }
      if (await vscode.window.showInformationMessage("Apply " + selected.length + " verified repairs across " + groups.size + " files?",
        { modal: true }, "Apply all") !== "Apply all") return false;
      const edit = new vscode.WorkspaceEdit();
      for (const { p } of selected) {
        if (!preview.current(p) || !validate(p)) return warn("A selected repair changed. Nothing was applied.");
        edit.replace(p.doc.uri, p.range, p.encoded);
      }
      const ok = await vscode.workspace.applyEdit(edit);
      await runtime.scan();
      return ok;
    } catch (error) { return warn("Bulk repair failed: " + error.message); }
  }
  return { bulkRepair };
}
module.exports = { createBulkRepairs };
