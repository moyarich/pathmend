"use strict";

const vscode = require("vscode");
const { createSnapshot } = require("./model");

/** Shared webview session: rendering, snapshots and validated diagnostic actions. */
class ReferenceDetailsWebview {
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

  attach(view, { location, onVisibilityChanged }) {
    this.dispose();
    this.view = view;
    this.location = location;
    const assets = vscode.Uri.joinPath(this.extensionUri, "views", "webview");
    const webview = view.webview;
    webview.options = { enableScripts: true, localResourceRoots: [assets] };
    const script = webview.asWebviewUri(vscode.Uri.joinPath(assets, "main.js"));
    const style = webview.asWebviewUri(vscode.Uri.joinPath(assets, "styles.css"));
    this.disposables.push(
      webview.onDidReceiveMessage(message => {
        this.handleMessage(message).catch(error => console.warn("PathMend Reference Details:", error.message));
      }),
      onVisibilityChanged(() => {
        if (view.visible) this.refresh();
      }),
      view.onDidDispose(() => this.dispose())
    );
    webview.html = renderHtml(webview.cspSource, style, script, location === "sidebar");
    this.refresh();
  }

  refresh() {
    if (!this.view) return;
    const { getGroups, getSeverity, isEnabled, hasWorkspace } = this.actions;
    const groups = getGroups();
    if (!this.view.visible || !this.ready) return;
    const snapshot = createSnapshot(groups, getSeverity(), isEnabled(), hasWorkspace(), ++this.revision);
    this.references = snapshot.references;
    const selected = [...snapshot.references].find(([, ref]) =>
      this.selection && ref.file === this.selection.file && ref.line === this.selection.line &&
      ref.col === this.selection.col && ref.code === this.selection.code);
    this.view.webview.postMessage({ type: "snapshot", ...snapshot.data, selectedId: selected?.[0] || null, currentFile: this.actions.currentFile?.() || null }).then(undefined, () => {});
  }

  select(ref) {
    this.selection = ref;
    this.refresh();
  }

  /** Only allow explicit commands and IDs belonging to the latest rendered snapshot. */
  async handleMessage(message) {
    if (!message || typeof message !== "object") return;
    if (message.type === "ready") { this.ready = true; return this.refresh(); }
    if (!this.view?.visible || !this.ready) return;
    if (message.type === "editor" && this.location === "sidebar") return vscode.commands.executeCommand("pathmend.openReferenceDetailsInEditor");
    if (message.type === "sidebar" && this.location === "editor") return vscode.commands.executeCommand("pathmend.openReferenceDetailsInSidebar");
    if (message.type === "bulk-repair") return this.actions.bulkRepair();
    if (message.type === "export") return vscode.commands.executeCommand("pathmend.exportResults");
    if (message.type === "settings") return vscode.commands.executeCommand("pathmend.openSettings");
    if (message.type === "problems") return vscode.commands.executeCommand("workbench.actions.view.problems");
    if (!["open", "fix", "preview", "pick-replacement", "complete-replacement", "validate-replacement"].includes(message.type)) return;
    if (message.revision !== this.revision || typeof message.id !== "string") return;
    const ref = this.references.get(message.id);
    if (!ref) return;
    if (message.type === "pick-replacement" || message.type === "complete-replacement" || message.type === "validate-replacement") {
      if (!Number.isSafeInteger(message.request) || typeof message.replacement !== "string" || message.replacement.length > 4096) return;
      const view = this.view;
      const revision = this.revision;
      const result = message.type === "pick-replacement" ? await this.actions.pickReplacement(ref) : message.type === "complete-replacement" ? await this.actions.completeReplacement(ref, message.replacement) : await this.actions.checkReplacement(ref, message.replacement);
      if (this.view === view && this.revision === revision) await view.webview.postMessage({ type: "replacement-result", action: message.type, id: message.id, revision, request: message.request, result });
      return;
    }
    if (message.type === "fix" || message.type === "preview") {
      if (typeof message.replacement !== "string" || message.replacement.length > 4096) return;
      await this.actions[message.type](ref, message.replacement);
    } else {
      await this.actions.open(ref);
    }
  }

  dispose() {
    this.view = undefined;
    this.ready = false;
    this.references.clear();
    for (const item of this.disposables.splice(0)) item.dispose();
  }
}

/** All interpolated values are extension-owned resource URIs, not workspace content. */
function renderHtml(cspSource, style, script, sidebar) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource}; script-src ${cspSource};">
<link rel="stylesheet" href="${style}">
<title>Reference Details</title>
</head>
<body>
<header class="view-toolbar">
  <div class="search-row">
    <label class="sr-only" for="filter">Filter references</label>
    <input id="filter" type="search" placeholder="Filter references…" autocomplete="off">
    <button id="clear-filter" class="quiet icon-button" type="button" title="Clear filter" aria-label="Clear filter" hidden></button>
  </div>
  <div class="filter-row">
    <label class="sr-only" for="severity">Reference type</label>
    <select id="severity" aria-label="Reference type"><option value="all">All references</option><option value="broken">Broken only</option><option value="info">Not checked</option><option value="fixable">Fixable</option></select>
    <button id="toggle-groups" class="quiet icon-button" type="button" title="Collapse all" aria-label="Collapse all" disabled></button>
  </div>
  <div class="filter-row">
    <select id="file-type" aria-label="File type"><option value="">All file types</option></select>
    <select id="rule" aria-label="Diagnostic rule"><option value="">All rules</option></select>
    <select id="sort" aria-label="Sort references"><option value="path">File path</option><option value="severity">Severity</option><option value="count">Reference count</option></select>
    <label><input id="current-only" type="checkbox"> Current file</label>
  </div>
  <div class="toolbar" role="group" aria-label="Reference actions">
    ${sidebar ? '<button id="editor" class="quiet" type="button" title="Open Reference Details in an editor tab alongside your files">Open Reference Details in Editor</button>' : '<button id="sidebar" class="quiet" type="button" title="Show Reference Details in the PathMend sidebar">Open Reference Details in Sidebar</button>'}
    <button id="problems" class="quiet" type="button" title="Open the VS Code Problems panel">Problems</button>
    <button id="bulk-repair" class="quiet" type="button" title="Select and preview verified repairs">Bulk repairs</button>
    <button id="export" class="quiet" type="button" title="Save the complete diagnostic report in your chosen format">Export</button>
    <button id="settings" class="quiet" type="button" title="Configure PathMend settings">Settings</button>
  </div>
</header>
<main class="view-content"><pm-reference-list><p class="reference-status" role="status">Loading references…</p></pm-reference-list></main>
<script type="module" src="${script}"></script>
</body>
</html>`;
}

module.exports = { ReferenceDetailsWebview };
