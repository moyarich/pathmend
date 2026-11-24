"use strict";

const vscode = require("vscode");
const { ReferenceDetailsWebview } = require("./reference-details-webview");

/** A singleton editor tab using the same renderer and diagnostic actions as the sidebar. */
class ReferenceDetailsPanel {
  constructor(extensionUri, actions) {
    this.session = new ReferenceDetailsWebview(extensionUri, actions);
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
    this.attach(panel);
  }

  attach(panel) {
    this.panel = panel;
    panel.onDidDispose(() => { if (this.panel === panel) this.panel = undefined; });
    this.session.attach(panel, {
      location: "editor",
      onVisibilityChanged: listener => panel.onDidChangeViewState(listener),
    });
  }

  async deserializeWebviewPanel(panel) {
    if (this.panel && this.panel !== panel) { panel.dispose(); this.reveal(); return; }
    this.attach(panel);
    // Webview getState restores presentation preferences, never diagnostic snapshots.
    await this.session.actions.rescan?.();
    this.refresh();
  }

  refresh() { this.session.refresh(); }
  select(ref) { this.session.select(ref); }
  dispose() {
    this.panel?.dispose();
    this.session.dispose();
  }
}

module.exports = { ReferenceDetailsPanel };
