"use strict";

const vscode = require("vscode");

const SEV_THEME = {
  error: ["error", "problemsErrorIcon.foreground"],
  warning: ["warning", "problemsWarningIcon.foreground"],
  information: ["info", "problemsInfoIcon.foreground"],
  hint: ["lightbulb", undefined],
};

function createTreeProvider({ getGroups, getSeverity, findingDetails }) {
  const emitter = new vscode.EventEmitter();
  return {
  emitter,
  get onDidChangeTreeData() {
    return this.emitter.event;
  },
  getChildren(node) {
    if (!node) return getGroups();
    if (node.type === "file") return node.findings.map((f) => ({ type: "finding", f }));
    return [];
  },
  getTreeItem(node) {
    const C = vscode.TreeItemCollapsibleState;
    if (node.type === "file") {
      const broken = node.findings.filter((f) => !f.info).length;
      const info = node.findings.length - broken;
      const item = new vscode.TreeItem(node.rel, C.Expanded);
      item.id = "file:" + node.file;
      item.resourceUri = vscode.Uri.file(node.file);
      item.description = (broken ? broken + " broken" : "") + (broken && info ? ", " : "") + (info ? info + " not checked" : "");
      item.tooltip = node.rel + "\n" + item.description;
      item.contextValue = "configFile";
      return item;
    }
    const f = node.f;
    const item = new vscode.TreeItem(f.code + "  " + f.ref.display, C.None);
    item.description = "L" + (f.line + 1) + ":" + (f.col + 1);
    item.tooltip = findingDetails(f);
    const [icon, color] = f.info ? SEV_THEME.information : SEV_THEME[getSeverity()] || SEV_THEME.warning;
    item.iconPath = new vscode.ThemeIcon(icon, color ? new vscode.ThemeColor(color) : undefined);
    item.contextValue = f.fix ? "finding.fixable" : "finding";
    item.command = { command: "pathmend.openReference", title: "Open reference", arguments: [{ file: f.file, line: f.line, col: f.col, code: f.code }] };
    return item;
  },
  };
}

module.exports = { createTreeProvider };
