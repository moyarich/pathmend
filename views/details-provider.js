"use strict";

const vscode = require("vscode");
const { createSnapshot } = require("./model");

/** Sidebar webview. Workspace text is sent as data, never inserted into HTML. */
class ReferenceDetailsProvider {
  constructor(extensionUri, actions) {
    this.extensionUri = extensionUri;
    this.actions = actions;
    this.revision = 0;
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
    webview.html = renderHtml(webview.cspSource, style, script);
    this.disposables.push(
      webview.onDidReceiveMessage(message => {
        this.handleMessage(message).catch(error => console.warn("PathMend details:", error.message));
      }),
      view.onDidChangeVisibility(() => { if (view.visible) this.refresh(); }),
      view.onDidDispose(() => this.dispose())
    );
  }

  refresh() {
    if (!this.view?.visible) return;
    const { getGroups, getSeverity, isEnabled, hasWorkspace } = this.actions;
    const snapshot = createSnapshot(getGroups(), getSeverity(), isEnabled(), hasWorkspace(), ++this.revision);
    this.references = snapshot.references;
    this.view.webview.postMessage({ type: "snapshot", ...snapshot.data }).then(undefined, () => {});
  }

  /** Only allow explicit commands and IDs belonging to the latest rendered snapshot. */
  async handleMessage(message) {
    if (!message || typeof message !== "object") return;
    if (message.type === "ready") return this.refresh();
    if (message.type === "scan") return this.actions.scan();
    if (message.type !== "open" && message.type !== "fix") return;
    if (message.revision !== this.revision || typeof message.id !== "string") return;
    const ref = this.references.get(message.id);
    if (!ref) return;
    await this.actions[message.type](ref);
  }

  dispose() {
    this.view = undefined;
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
  <label for="filter">Filter references</label>
  <input id="filter" type="search" placeholder="File, path, rule or message">
  <button id="scan" type="button">Scan workspace</button>
</header>
<main><pm-reference-list><p class="reference-status" role="status">Loading references…</p></pm-reference-list></main>
<script type="module" src="${script}"></script>
</body>
</html>`;
}

module.exports = { ReferenceDetailsProvider };
