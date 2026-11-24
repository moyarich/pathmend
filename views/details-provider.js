"use strict";

const vscode = require("vscode");
const { createSnapshot } = require("./model");

/** Sidebar webview. Workspace text is sent as data, never inserted into HTML. */
class ReferenceDetailsProvider {
  constructor(extensionUri, actions) {
    this.extensionUri = extensionUri;
    this.actions = actions;
    this.revision = 0;
    this.ready = false;
    this.selection = null;
    this.references = new Map();
    this.disposables = [];
  }

  get visible() { return !!this.view?.visible; }

  resolveWebviewView(view) {
    this.dispose();
    this.view = view;
    const assets = vscode.Uri.joinPath(this.extensionUri, "views", "webview");
    const webview = view.webview;
    webview.options = { enableScripts: true, localResourceRoots: [assets] };
    const script = webview.asWebviewUri(vscode.Uri.joinPath(assets, "main.js"));
    const style = webview.asWebviewUri(vscode.Uri.joinPath(assets, "styles.css"));
    this.disposables.push(
      webview.onDidReceiveMessage(message => {
        this.handleMessage(message).catch(error => console.warn("PathMend details:", error.message));
      }),
      view.onDidChangeVisibility(() => {
        if (view.visible) this.refresh();
      }),
      view.onDidDispose(() => this.dispose())
    );
    webview.html = renderHtml(webview.cspSource, style, script);
    this.refresh();
  }

  refresh() {
    if (!this.view) return;
    const { getGroups, getSeverity, isEnabled, hasWorkspace } = this.actions;
    const groups = getGroups();
    const broken = groups.reduce((count, group) => count + group.findings.filter(f => !f.info).length, 0);
    this.view.badge = broken ? { value: broken, tooltip: broken + " broken path references" } : undefined;
    if (!this.view.visible || !this.ready) return;
    const snapshot = createSnapshot(groups, getSeverity(), isEnabled(), hasWorkspace(), ++this.revision);
    this.references = snapshot.references;
    const selected = [...snapshot.references].find(([, ref]) =>
      this.selection && ref.file === this.selection.file && ref.line === this.selection.line &&
      ref.col === this.selection.col && ref.code === this.selection.code);
    this.view.webview.postMessage({ type: "snapshot", ...snapshot.data, selectedId: selected?.[0] || null }).then(undefined, () => {});
  }

  select(ref) {
    this.selection = ref;
    this.refresh();
  }

  async reveal(ref) {
    this.selection = ref;
    if (this.view) this.view.show(false);
    else await vscode.commands.executeCommand("pathmend.details.focus");
    this.refresh();
  }

  /** Only allow explicit commands and IDs belonging to the latest rendered snapshot. */
  async handleMessage(message) {
    if (!message || typeof message !== "object") return;
    if (message.type === "ready") { this.ready = true; return this.refresh(); }
    if (!this.view?.visible || !this.ready) return;
    if (message.type === "export") return vscode.commands.executeCommand("pathmend.exportResults");
    if (message.type === "settings") return vscode.commands.executeCommand("workbench.action.openSettings", "pathmend");
    if (message.type === "problems") return vscode.commands.executeCommand("workbench.actions.view.problems");
    if (message.type !== "open" && message.type !== "fix") return;
    if (message.revision !== this.revision || typeof message.id !== "string") return;
    const ref = this.references.get(message.id);
    if (!ref) return;
    await this.actions[message.type](ref);
  }

  dispose() {
    this.view = undefined;
    this.ready = false;
    this.references.clear();
    for (const item of this.disposables.splice(0)) item.dispose();
  }
}

/** All interpolated values are extension-owned resource URIs, not workspace content. */
function renderHtml(cspSource, style, script) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource}; script-src ${cspSource};">
<link rel="stylesheet" href="${style}">
<title>Reference details</title>
</head>
<body>
<header>
  <div class="search-row">
    <label class="sr-only" for="filter">Filter references</label>
    <input id="filter" type="search" placeholder="Filter references…" autocomplete="off">
    <button id="clear-filter" class="quiet" type="button" title="Clear filter" aria-label="Clear filter" hidden></button>
  </div>
  <div class="filter-row">
    <label class="sr-only" for="severity">Reference type</label>
    <select id="severity" aria-label="Reference type"><option value="all">All references</option><option value="broken">Broken only</option><option value="info">Not checked</option><option value="fixable">Fixable</option></select>
    <button id="expand" class="quiet" type="button" title="Expand all" aria-label="Expand all"></button>
    <button id="collapse" class="quiet" type="button" title="Collapse all" aria-label="Collapse all"></button>
  </div>
  <div class="toolbar"><button id="problems" class="quiet" type="button">Problems</button><button id="settings" class="quiet" type="button">Settings</button><button id="export" class="quiet" type="button">Export</button></div>
</header>
<main><pm-reference-list><p class="reference-status" role="status">Loading references…</p></pm-reference-list></main>
<script type="module" src="${script}"></script>
</body>
</html>`;
}

module.exports = { ReferenceDetailsProvider };
