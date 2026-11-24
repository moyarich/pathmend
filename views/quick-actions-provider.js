"use strict";

const vscode = require("vscode");

const actions = [
  {
    label: "Open Reference Details",
    command: "pathmend.openReferenceDetails",
    icon: "open-preview",
    tooltip: "Open Reference Details in your preferred location.",
  },
  {
    label: "Scan Workspace",
    command: "pathmend.scan",
    icon: "refresh",
    tooltip: "Scan the workspace for broken file references.",
  },
  {
    label: "Settings",
    command: "pathmend.openSettings",
    icon: "gear",
    tooltip: "Configure PathMend preferences.",
  },
];

function createQuickActionsProvider() {
  return {
    getChildren(element) {
      return element ? [] : actions;
    },
    getTreeItem(action) {
      const item = new vscode.TreeItem(action.label, vscode.TreeItemCollapsibleState.None);
      item.id = action.command;
      item.iconPath = new vscode.ThemeIcon(action.icon);
      item.tooltip = action.tooltip;
      item.command = { command: action.command, title: action.label };
      return item;
    },
  };
}

module.exports = { createQuickActionsProvider };
