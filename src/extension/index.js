"use strict";
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const analyzer = require("../analyzer");
const { createTreeProvider } = require("../../views/tree-provider");
const { createQuickActionsProvider } = require("../../views/quick-actions-provider");
const { fileGroups, findingDetails } = require("../../views/model");
const { ReferenceDetailsSidebarProvider } = require("../../views/reference-details-sidebar-provider");
const { ReferenceDetailsPanel } = require("../../views/reference-details-panel");
const { createReport } = require("../../views/report");
const { exportResults } = require("../../views/export-results");
const { showErrorDetail, confirmReplacement, promptRenameUpdates } = require("../../views/native-dialogs");
const { getConfig } = require("./configuration");
const { roots, rootFor, insideWorkspace, relPath, buildIndex, collectConfigs, openDocText, confined, isConfigDoc } = require("./workspace");
const { createScanner } = require("./scanning/scanner");
const { createCommands } = require("./commands/reference-commands");
const { createReplacementActions } = require("./commands/replacement-actions");
const { createCodeActionProvider } = require("./providers/code-action-provider");
const { createRenameEvents } = require("./events/rename-events");
const SOURCE = "PathMend";
const VIEW_ID = "pathmend.references";
// Fallback for file watchers that do not fire (for example when the OS watch limit is used up):
// the file index is rebuilt and the workspace rescanned this often while the window is focused.
const POLL_MS = 60000;
const runtime = { state: null, referenceDetailsSidebarProvider: null, referenceDetailsPanel: null };
function severityOf(s) {
  if (s === "error") return vscode.DiagnosticSeverity.Error;
  if (s === "information") return vscode.DiagnosticSeverity.Information;
  if (s === "hint") return vscode.DiagnosticSeverity.Hint;
  return vscode.DiagnosticSeverity.Warning;
}
function brokenCount() {
  return ((runtime.state && runtime.state.findings) || []).filter((f) => !f.info).length;
}

function updateStatus() {
  refreshTree();
  const s = runtime.state && runtime.state.status;
  if (!s) return;
  const n = brokenCount();
  if (!runtime.state.findings || (!n && !runtime.state.refs.length)) {
    s.hide();
    return;
  }
  s.text = n ? "$(link) PathMend: " + n : "$(check) PathMend";
  s.tooltip = n
    ? n + " broken path reference" + (n === 1 ? "" : "s") + " - click to list"
    : runtime.state.refs.length + " path reference" + (runtime.state.refs.length === 1 ? "" : "s") + " checked, none broken";
  s.command = "pathmend.showBroken";
  s.show();
}

// ---------------------------------------------------------------------------
// Activity bar view
// ---------------------------------------------------------------------------

/** Path shown in the view: workspace-relative, prefixed with the folder name in a multi-root workspace. */
function viewPath(file) {
  const rs = roots();
  const r = rootFor(file, rs);
  if (!r) return file;
  const rel = analyzer.toPosix(path.relative(r.path, file)) || ".";
  return rs.length > 1 ? r.name + "/" + rel : rel;
}
let treeProvider = null;

function getGroups() {
  return fileGroups(runtime.state ? runtime.state.findings : [], viewPath);
}

function formatFinding(f) {
  return findingDetails(f, viewPath);
}

let treeView = null;

function refreshTree() {
  if (treeProvider) treeProvider.emitter.fire(undefined);
  if (runtime.referenceDetailsSidebarProvider) runtime.referenceDetailsSidebarProvider.refresh();
  if (runtime.referenceDetailsPanel) runtime.referenceDetailsPanel.refresh();
  if (!treeView) return;
  const n = brokenCount();
  treeView.badge = n ? { value: n, tooltip: n + " broken path reference" + (n === 1 ? "" : "s") } : undefined;
}
Object.assign(runtime, { getConfig, roots, rootFor, insideWorkspace, relPath, buildIndex, collectConfigs, openDocText, confined, severityOf, updateStatus, viewPath, getGroups });
const { scan, invalidateIndex, scheduleScan, refreshIndex } = createScanner(runtime);
Object.assign(runtime, { scan, invalidateIndex, scheduleScan });
const { liveFinding, getReport, exportCurrentResults, openReferenceDetailsAt, openReferenceDetails, showReferenceDetails, openReference, applyFix, showBroken, scanCommand } = createCommands(runtime);
const { provideCodeActions } = createCodeActionProvider(runtime);
const { renamesOf, renameKey, planFor, applyPlan, onDidRename } = createRenameEvents(runtime);
function activate(context) {
  runtime.state = {
    diagnostics: vscode.languages.createDiagnosticCollection("pathmend"),
    status: vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 30),
    index: null,
    indexGen: 0,
    refs: [],
    findings: [],
    fixes: new Map(),
    seq: 0,
    timer: null,
    poll: null,
    lastRefresh: Date.now(),
    pendingPlan: null,
    lastPlan: [],
    lastPrompt: null,
    lastPromptDone: null,
  };
  treeProvider = createTreeProvider({ getGroups, getSeverity: () => getConfig().severity, findingDetails: formatFinding });
  const replacements = createReplacementActions(runtime, liveFinding);
  const referenceDetailsActions = {
    getGroups, getSeverity: () => getConfig().severity,
    isEnabled: () => getConfig().enabled, hasWorkspace: () => roots().length > 0,
    open: openReference, fix: applyFix, ...replacements,
  };
  runtime.referenceDetailsSidebarProvider = new ReferenceDetailsSidebarProvider(context.extensionUri, referenceDetailsActions);
  runtime.referenceDetailsPanel = new ReferenceDetailsPanel(context.extensionUri, referenceDetailsActions);
  treeView = vscode.window.createTreeView(VIEW_ID, { treeDataProvider: treeProvider, showCollapseAll: true });
  const excluded = (uri) => {
    const r = rootFor(path.resolve(uri.fsPath), roots());
    if (!r) return true;
    return analyzer.makeMatcher(getConfig().exclude)(analyzer.toPosix(path.relative(r.path, path.resolve(uri.fsPath))));
  };
  const onCreate = async (uri) => {
    if (!runtime.state || !uri || uri.scheme !== "file" || excluded(uri)) return;
    let isDir = false;
    try {
      isDir = (await vscode.workspace.fs.stat(uri)).type & vscode.FileType.Directory;
    } catch (_) {
      return; // already gone again
    }
    if (!runtime.state) return;
    if (isDir || !runtime.state.index) invalidateIndex(); // a new folder, or an index being built: rebuild
    else {
      const p = path.resolve(uri.fsPath);
      const r = rootFor(p, roots());
      if (r) runtime.state.index.add(r.path, analyzer.toPosix(path.relative(r.path, p)));
    }
    scheduleScan(800);
  };
  const onDelete = (uri) => {
    if (!runtime.state || !uri || uri.scheme !== "file") return;
    const p = path.resolve(uri.fsPath);
    const r = rootFor(p, roots());
    if (!runtime.state.index) invalidateIndex();
    else if (r) runtime.state.index.remove(r.path, analyzer.toPosix(path.relative(r.path, p)));
    scheduleScan(800);
  };
  const watcher = vscode.workspace.createFileSystemWatcher("**/*", false, true, false);
  watcher.onDidCreate((u) => onCreate(u).catch(() => {}));
  watcher.onDidDelete(onDelete);
  runtime.state.poll = setInterval(() => {
    if (runtime.state && vscode.window.state.focused && getConfig().enabled) refreshIndex().catch(() => {});
  }, POLL_MS);
  context.subscriptions.push(
    runtime.state.diagnostics,
    runtime.state.status,
    watcher,
    treeProvider.emitter,
    treeView,
    treeView.onDidChangeSelection(event => {
      const f = liveFinding(event.selection[0]);
      const ref = f ? { file: f.file, line: f.line, col: f.col, code: f.code } : null;
      runtime.referenceDetailsSidebarProvider.select(ref);
      runtime.referenceDetailsPanel.select(ref);
    }),
    runtime.referenceDetailsSidebarProvider,
    runtime.referenceDetailsPanel,
    vscode.window.registerTreeDataProvider("pathmend.actions", createQuickActionsProvider()),
    vscode.window.registerWebviewViewProvider("pathmend.referenceDetails", runtime.referenceDetailsSidebarProvider),
    vscode.commands.registerCommand("pathmend.scan", scanCommand),
    vscode.commands.registerCommand("pathmend.showBroken", showBroken),
    vscode.commands.registerCommand("pathmend.openReference", openReference),
    vscode.commands.registerCommand("pathmend.showReferenceDetails", showReferenceDetails),
    vscode.commands.registerCommand("pathmend.openReferenceDetails", openReferenceDetails),
    vscode.commands.registerCommand("pathmend.openReferenceDetailsInEditor", () => openReferenceDetailsAt("editor")),
    vscode.commands.registerCommand("pathmend.openReferenceDetailsInSidebar", () => openReferenceDetailsAt("sidebar")),
    vscode.commands.registerCommand("pathmend.exportResults", exportCurrentResults),
    vscode.commands.registerCommand("pathmend.openSettings", () => vscode.commands.executeCommand("workbench.action.openSettings", "pathmend")),
    vscode.commands.registerCommand("pathmend.applyFix", applyFix),
    vscode.languages.registerCodeActionsProvider({ scheme: "file" }, { provideCodeActions }, { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }),
    vscode.workspace.onDidSaveTextDocument((d) => {
      if (isConfigDoc(d)) scheduleScan(300);
    }),
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (isConfigDoc(e.document) && e.contentChanges.length) scheduleScan(700);
    }),
    // Creates and deletes done in VS Code itself; these fire even when file watching does not.
    vscode.workspace.onDidCreateFiles((e) => {
      for (const u of e.files || []) onCreate(u).catch(() => {});
    }),
    vscode.workspace.onDidDeleteFiles((e) => {
      for (const u of e.files || []) onDelete(u);
    }),
    vscode.window.onDidChangeWindowState((w) => {
      if (w.focused && runtime.state && Date.now() - runtime.state.lastRefresh > 10000 && getConfig().enabled) refreshIndex().catch(() => {});
    }),
    vscode.workspace.onWillRenameFiles((e) => {
      const renames = renamesOf(e);
      runtime.state.pendingPlan = { key: renameKey(renames), plan: planFor(renames) };
    }),
    vscode.workspace.onDidRenameFiles((e) => {
      onDidRename(e).catch(() => {});
    }),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (!e.affectsConfiguration("pathmend")) return;
      if (e.affectsConfiguration("pathmend.exclude") || e.affectsConfiguration("pathmend.maxIndexedFiles")) invalidateIndex();
      scheduleScan(0);
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      invalidateIndex();
      scheduleScan(0);
    })
  );
  const ready = scan().catch(() => []);
  // Only the interactive launcher opts in; installed extensions and CI never steal focus.
  if (context.extensionMode === vscode.ExtensionMode.Development && process.env.PATHMEND_DEV_OPEN_REFERENCE_DETAILS === "1") {
    void ready.then(async () => {
      if (!runtime.state) return;
      await vscode.commands.executeCommand("workbench.view.extension.pathmend");
      await openReferenceDetails();
    }).catch(error => console.warn("PathMend development view:", error.message));
  }
  return {
    ready,
    scan: () => scan(),
    rebuildIndex: () => refreshIndex(),
    poll: () => refreshIndex(),
    getReport,
    getFindings: () => (runtime.state ? runtime.state.findings : []),
    getLastRenamePlan: () => (runtime.state ? runtime.state.lastPlan : []),
    getLastPrompt: () => (runtime.state ? { message: runtime.state.lastPrompt, done: runtime.state.lastPromptDone } : null),
    applyRenamePlan: (plan, preview) => applyPlan(plan, preview),
    getChildren: (node) => treeProvider.getChildren(node),
    getTreeItem: (node) => treeProvider.getTreeItem(node),
    getBadge: () => (treeView && treeView.badge ? treeView.badge.value : 0),
    isViewVisible: () => !!(treeView && treeView.visible),
    isReferenceDetailsVisible: () => !!(runtime.referenceDetailsSidebarProvider && runtime.referenceDetailsSidebarProvider.visible),
    getStatusText: () => (runtime.state && runtime.state.status ? runtime.state.status.text : ""),
  };
}

function deactivate() {
  if (runtime.state) {
    clearTimeout(runtime.state.timer);
    clearInterval(runtime.state.poll);
  }
  runtime.state = null;
  treeView = null;
  treeProvider = null;
  runtime.referenceDetailsSidebarProvider = null;
  runtime.referenceDetailsPanel = null;
}

module.exports = { activate, deactivate };