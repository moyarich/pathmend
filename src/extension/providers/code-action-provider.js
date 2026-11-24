"use strict";
const vscode = require("vscode");
const path = require("node:path");
const fs = require("node:fs");
const analyzer = require("../../analyzer");
const SOURCE = "PathMend";

function createCodeActionProvider(runtime) {
  const { insideWorkspace } = runtime;
  function provideCodeActions(doc, range, context) {
    const actions = [];
    if (!doc.uri || doc.uri.scheme !== "file" || !runtime.state) return actions;
    const file = path.resolve(doc.uri.fsPath);
    if (!insideWorkspace(file)) return actions;
    const diags = (context.diagnostics || []).filter((d) => d.source === SOURCE);
    const seen = new Set();
    for (const [key, fx] of runtime.state.fixes) {
      const f = fx.finding;
      if (f.file !== file || seen.has(key)) continue;
      const r = new vscode.Range(f.line, f.col, f.line, f.endCol);
      const diag = diags.find((d) => d.range.start.line === f.line && d.range.start.character === f.col);
      if (!diag && !r.intersection(range)) continue;
      if (doc.getText(r) !== f.ref.raw) continue;
      const text = analyzer.encodeFor(f.ref, fx.newText);
      if (text === null) continue;
      seen.add(key);
      const act = new vscode.CodeAction('Did you mean "' + fx.newText + '"?', vscode.CodeActionKind.QuickFix);
      act.edit = new vscode.WorkspaceEdit();
      act.edit.replace(doc.uri, r, text);
      if (diag) act.diagnostics = [diag];
      act.isPreferred = true;
      actions.push(act);
    }
    return actions;
  }
  
  // ---------------------------------------------------------------------------
  // Rename awareness
  return { provideCodeActions };
}
module.exports = { createCodeActionProvider };
