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
    this.panel = panel;
    panel.onDidDispose(() => { this.panel = undefined; });
    this.session.attach(panel, {
      location: "editor",
      onVisibilityChanged: listener => panel.onDidChangeViewState(listener),
    });
  }

  refresh() { this.session.refresh(); }
  select(ref) { this.session.select(ref); }
  dispose() {
    this.panel?.dispose();
    this.session.dispose();
  }
}

module.exports = { ReferenceDetailsPanel };
