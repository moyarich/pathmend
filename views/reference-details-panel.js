"use strict";

const vscode = require("vscode");
const { ReferenceDetailsProvider } = require("./reference-details-provider");

/** A singleton editor tab using the same renderer and diagnostic actions as the sidebar. */
class ReferenceDetailsPanel {
  constructor(extensionUri, actions) {
    this.provider = new ReferenceDetailsProvider(extensionUri, actions);
  }

  reveal() {
    if (this.panel) {
      this.panel.reveal(this.panel.viewColumn);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      "pathmend.referenceDetailsEditor", "PathMend: Reference Details",
      vscode.ViewColumn.Active, { enableScripts: true }
    );
    this.panel = panel;
    panel.onDidDispose(() => { this.panel = undefined; });
    this.provider.attach(panel, false);
  }

  refresh() { this.provider.refresh(); }
  select(ref) { this.provider.select(ref); }
  dispose() {
    this.panel?.dispose();
    this.provider.dispose();
  }
}

module.exports = { ReferenceDetailsPanel };
