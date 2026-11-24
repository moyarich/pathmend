"use strict";
const vscode = require("vscode");
const fs = require("node:fs");
const path = require("node:path");
const analyzer = require("../../analyzer");

function createNavigationProviders(runtime) {
  function references(doc) {
    if (!runtime.state || doc.uri.scheme !== "file" || !runtime.confined(doc.uri.fsPath)) return [];
    return runtime.state.refs.filter(ref => ref.file === path.resolve(doc.uri.fsPath)).flatMap(ref => {
      if (ref.line >= doc.lineCount || ref.col < 0 || ref.endCol > doc.lineAt(ref.line).text.length) return [];
      const range = new vscode.Range(ref.line, ref.col, ref.line, ref.endCol);
      return doc.getText(range) === ref.raw ? [{ ref, range }] : [];
    });
  }
  function provideDocumentLinks(doc) {
    const guard = analyzer.createGuard(fs, runtime.roots().map(r => r.path));
    return references(doc).flatMap(({ref, range}) => {
      const result = ref.result;
      const target = result?.hit || result?.abs;
      if (result?.state !== "ok" || ref.glob || ref.anywhere || !target || guard.status(target).state !== "file") return [];
      return [new vscode.DocumentLink(range, vscode.Uri.file(target))];
    });
  }
  function provideHover(doc, position) {
    const entry = references(doc).find(({range}) => range.contains(position));
    if (!entry) return undefined;
    const f = runtime.state.findings.find(f => f.ref === entry.ref);
    if (!f) return undefined;
    const text = new vscode.MarkdownString();
    text.appendText(f.code + ": " + f.message + (f.fix ? "\n\nSuggested replacement: " + f.fix : ""));
    return new vscode.Hover(text, entry.range);
  }
  function provideCodeLenses(doc) {
    if (!vscode.workspace.getConfiguration("pathmend").get("editor.codeLens", false)) return [];
    return references(doc).flatMap(({ref, range}) => {
      const f = runtime.state.findings.find(f => f.ref === ref && f.fix);
      return f ? [new vscode.CodeLens(range, {title:"Preview path repair", command:"pathmend.previewFix", arguments:[f,f.fix]})] : [];
    });
  }
  return { provideDocumentLinks, provideHover, provideCodeLenses };
}
module.exports = { createNavigationProviders };
