"use strict";

const vscode = require("vscode");
const { ReferenceDetailsWebview } = require("./reference-details-webview");

/** Owns the native sidebar WebviewView and its badge and focus behavior. */
class ReferenceDetailsSidebarProvider {
  constructor(extensionUri, actions) {
    this.actions = actions;
    this.session = new ReferenceDetailsWebview(extensionUri, actions);
    this.view = undefined;
    this.disposables = [];
  }

  get visible() { return !!this.view?.visible; }

  resolveWebviewView(view) {
    this.dispose();
    this.view = view;
    this.disposables.push(view.onDidDispose(() => this.dispose()));
    this.session.attach(view, {
      location: "sidebar",
      onVisibilityChanged: listener => view.onDidChangeVisibility(listener),
    });
    this.refresh();
  }

  refresh() {
    if (!this.view) return;
    const broken = this.actions.getGroups().reduce((count, group) =>
      count + group.findings.filter(f => !f.info).length, 0);
    this.view.badge = broken ? { value: broken, tooltip: broken + " broken path references" } : undefined;
    this.session.refresh();
  }

  select(ref) { this.session.select(ref); }

  async reveal(ref) {
    this.select(ref);
    if (this.view) this.view.show(false);
    else await vscode.commands.executeCommand("pathmend.referenceDetails.focus");
    this.refresh();
  }

  dispose() {
    this.view = undefined;
    for (const item of this.disposables.splice(0)) item.dispose();
    this.session.dispose();
  }
}

module.exports = { ReferenceDetailsSidebarProvider };
