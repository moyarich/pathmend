"use strict";
/**
 * PathMend - finds config file references (package.json, tsconfig, Dockerfile, Compose,
 * GitHub Actions, GitLab CI, CODEOWNERS, launch.json) that point at paths which no longer
 * exist, suggests the moved file, and updates references when you rename in VS Code.
 *
 * Runs entirely locally. No network, no telemetry, no child processes. Only config files
 * found with vscode.workspace.findFiles are read; referenced paths are only checked for
 * existence, and only when they are inside a workspace folder (see core.createGuard).
 *
 * The PathMend activity bar view lists the broken references grouped by config file; each
 * row is labelled with the exact path string (e.g. "PM003  scripts/start.sh"), opens the file
 * at that line, and offers the "Did you mean ...?" fix inline.
 */

const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const core = require("./core");
const { createTreeProvider } = require("./views/tree-provider");
const { fileGroups, findingDetails } = require("./views/model");
const { ReferenceDetailsProvider } = require("./views/details-provider");
const { createReport } = require("./views/report");
const { exportResults } = require("./views/export-results");

const SOURCE = "PathMend";
const CONFIG_GLOB =
  "**/{package.json,tsconfig*.json,jsconfig*.json,Dockerfile,Dockerfile.*,*.Dockerfile,*.dockerfile,Containerfile,Containerfile.*,docker-compose*.yml,docker-compose*.yaml,compose*.yml,compose*.yaml,CODEOWNERS,launch.json,.gitlab-ci.yml,*.gitlab-ci.yml}";
const MARKDOWN_GLOB = "**/*.{md,mdx,MD,MDX}";
const GITHUB_GLOB = "**/.github/**/*.{yml,yaml}";
const MAX_CONFIG_FILES = 2000;
const VIEW_ID = "pathmend.references";
// Fallback for file watchers that do not fire (for example when the OS watch limit is used up):
// the file index is rebuilt and the workspace rescanned this often while the window is focused.
const POLL_MS = 60000;

let state = null;

function getConfig() {
  const c = vscode.workspace.getConfiguration("pathmend");
  return {
    enabled: c.get("enabled", true),
    exclude: c.get("exclude", ["**/node_modules/**", "**/.git/**", "**/dist/**"]),
    ignoreReferences: c.get("ignoreReferences", []),
    disabledRules: c.get("disabledRules", []),
    mdxPathAttributes: c.get("mdx.pathAttributes", ["src", "href"]),
    directivePathAttributes: c.get("markdown.directivePathAttributes", ["component", "code", "files"]),
    multiPathAttributes: c.get("markdown.multiPathAttributes", ["files"]),
    severity: c.get("severity", "warning"),
    reportOutside: c.get("reportOutsideWorkspace", true),
    maxIndexedFiles: Math.max(100, c.get("maxIndexedFiles", 20000)),
    maxFileSizeKB: Math.max(1, c.get("maxConfigFileSizeKB", 512)),
    renameUpdates: c.get("renameUpdates", "prompt"),
  };
}

function severityOf(s) {
  if (s === "error") return vscode.DiagnosticSeverity.Error;
  if (s === "information") return vscode.DiagnosticSeverity.Information;
  if (s === "hint") return vscode.DiagnosticSeverity.Hint;
  return vscode.DiagnosticSeverity.Warning;
}

function roots() {
  return (vscode.workspace.workspaceFolders || [])
    .filter((f) => f.uri && f.uri.scheme === "file")
    .map((f) => ({ path: path.resolve(f.uri.fsPath), name: f.name }));
}

function excludeGlob(cfg) {
  const list = (cfg.exclude || []).filter((p) => typeof p === "string" && p.trim() && !/[{}]/.test(p));
  if (!list.length) return null;
  return list.length === 1 ? list[0] : "{" + list.join(",") + "}";
}

function rootFor(p, rs) {
  let best = null;
  for (const r of rs) if (core.within(p, r.path) && (!best || r.path.length > best.path.length)) best = r;
  return best;
}

function insideWorkspace(p) {
  return !!rootFor(path.resolve(p), roots());
}

function relPath(p) {
  const r = rootFor(p, roots());
  return r ? core.toPosix(path.relative(r.path, p)) || "." : p;
}

async function buildIndex(cfg) {
  const idx = new core.FileIndex();
  const rs = roots();
  if (!rs.length) return idx;
  const uris = await vscode.workspace.findFiles("**/*", excludeGlob(cfg), cfg.maxIndexedFiles + 1);
  if (uris.length > cfg.maxIndexedFiles) idx.truncated = true;
  for (const u of uris.slice(0, cfg.maxIndexedFiles)) {
    if (u.scheme !== "file") continue;
    const p = path.resolve(u.fsPath);
    const r = rootFor(p, rs);
    if (r) idx.add(r.path, core.toPosix(path.relative(r.path, p)));
  }
  return idx;
}

async function collectConfigs(cfg) {
  const out = new Set();
  if (!roots().length) return [];
  const ex = excludeGlob(cfg);
  for (const g of [CONFIG_GLOB, GITHUB_GLOB, MARKDOWN_GLOB]) {
    const found = await vscode.workspace.findFiles(g, ex, MAX_CONFIG_FILES);
    for (const u of found) if (u.scheme === "file" && core.classify(u.fsPath)) out.add(path.resolve(u.fsPath));
  }
  return [...out];
}

function openDocText(p) {
  for (const d of vscode.workspace.textDocuments) {
    if (d.uri && d.uri.scheme === "file" && path.resolve(d.uri.fsPath) === p) return d.getText();
  }
  return null;
}

const SUPERSEDED = Symbol("superseded");

/** Scan the workspace. If a newer scan starts meanwhile, resolves to that scan's result. */
function scan() {
  if (!state) return Promise.resolve([]);
  const st = state;
  const p = doScan(st);
  st.latest = p;
  const settle = (r) => (r === SUPERSEDED && st.latest !== p ? st.latest.then(settle) : r === SUPERSEDED ? st.findings : r);
  return p.then(settle);
}

async function doScan(st) {
  const seq = ++st.seq;
  const cfg = getConfig();
  if (!cfg.enabled) {
    st.diagnostics.clear();
    st.findings = [];
    st.refs = [];
    st.fixes.clear();
    updateStatus();
    return [];
  }
  // Use a local reference: a rename, a new folder or a settings change may drop st.index while
  // this scan is waiting. An index built while it was invalidated again is used once, not kept.
  let index = st.index;
  let stale = false;
  if (!index) {
    const gen = st.indexGen;
    index = await buildIndex(cfg);
    if (seq !== st.seq && st.index) return SUPERSEDED;
    if (st.indexGen === gen) st.index = index;
    else stale = true;
  }
  const files = await collectConfigs(cfg);
  if (seq !== state.seq) return SUPERSEDED;
  const rs = roots();
  const guard = core.createGuard(fs, rs.map((r) => r.path));
  const maxBytes = cfg.maxFileSizeKB * 1024;
  const configs = [];
  for (const file of files) {
    const fst = guard.status(file);
    if (fst.state !== "file") continue; // missing, or a symlink that leaves the workspace
    if (fst.size > maxBytes) continue;
    let text = openDocText(file);
    if (text === null) {
      const r = guard.readText(file, maxBytes);
      if (!r.text && r.text !== "") continue;
      text = r.text;
    }
    if (text.length > maxBytes) continue;
    configs.push({ file, text });
  }
  const result = core.analyze({
    configs,
    roots: rs,
    guard,
    index,
    settings: {
      exclude: cfg.exclude,
      ignoreReferences: cfg.ignoreReferences,
      disabledRules: cfg.disabledRules,
      mdxPathAttributes: cfg.mdxPathAttributes,
      directivePathAttributes: cfg.directivePathAttributes,
      multiPathAttributes: cfg.multiPathAttributes,
      reportOutside: cfg.reportOutside,
    },
  });
  if (seq !== state.seq) return SUPERSEDED;
  state.refs = result.refs;
  state.findings = result.findings;
  state.fixes.clear();
  const byFile = new Map();
  const sev = severityOf(cfg.severity);
  for (const f of result.findings) {
    const range = new vscode.Range(f.line, f.col, f.line, Math.max(f.endCol, f.col + 1));
    const d = new vscode.Diagnostic(range, f.message, f.info ? vscode.DiagnosticSeverity.Information : sev);
    d.source = SOURCE;
    d.code = f.code;
    if (!byFile.has(f.file)) byFile.set(f.file, []);
    byFile.get(f.file).push(d);
    if (f.fix) state.fixes.set(f.file + "|" + f.line + "|" + f.col, { finding: f, newText: f.fix });
  }
  state.diagnostics.clear();
  for (const [file, list] of byFile) state.diagnostics.set(vscode.Uri.file(file), list);
  updateStatus();
  if (stale) scheduleScan(300);
  return state.findings;
}

/** Drop the file index; the next scan rebuilds it (and a build already running is not kept). */
function invalidateIndex() {
  if (!state) return;
  state.index = null;
  state.indexGen++;
}

function scheduleScan(delay) {
  if (!state) return;
  clearTimeout(state.timer);
  state.timer = setTimeout(() => {
    scan().catch(() => {});
  }, delay === undefined ? 500 : delay);
}

function brokenCount() {
  return ((state && state.findings) || []).filter((f) => !f.info).length;
}

function updateStatus() {
  refreshTree();
  const s = state && state.status;
  if (!s) return;
  const n = brokenCount();
  if (!state.findings || (!n && !state.refs.length)) {
    s.hide();
    return;
  }
  s.text = n ? "$(link) PathMend: " + n : "$(check) PathMend";
  s.tooltip = n
    ? n + " broken path reference" + (n === 1 ? "" : "s") + " - click to list"
    : state.refs.length + " path reference" + (state.refs.length === 1 ? "" : "s") + " checked, none broken";
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
  const rel = core.toPosix(path.relative(r.path, file)) || ".";
  return rs.length > 1 ? r.name + "/" + rel : rel;
}

let treeProvider = null;
let detailsProvider = null;

function getGroups() {
  return fileGroups(state ? state.findings : [], viewPath);
}

function formatFinding(f) {
  return findingDetails(f, viewPath);
}

let treeView = null;

function refreshTree() {
  if (treeProvider) treeProvider.emitter.fire(undefined);
  if (detailsProvider) detailsProvider.refresh();
  if (!treeView) return;
  const n = brokenCount();
  treeView.badge = n ? { value: n, tooltip: n + " broken path reference" + (n === 1 ? "" : "s") } : undefined;
}

/** Map a command argument (a tree node or {file,line,col,code}) to a live finding; never trust the object itself. */
function liveFinding(arg) {
  if (!state || !arg || typeof arg !== "object") return undefined;
  const a = arg.type === "finding" && arg.f && typeof arg.f === "object" ? arg.f : arg;
  if (typeof a.file !== "string" || !Number.isInteger(a.line) || !Number.isInteger(a.col) || typeof a.code !== "string") return undefined;
  const file = path.resolve(a.file);
  return (state.findings || []).find((f) => f.file === file && f.line === a.line && f.col === a.col && f.code === a.code);
}

function realpathOrNull(p) {
  try {
    return fs.realpathSync.native(p);
  } catch (_) {
    return null;
  }
}

/** True when the file's real path (symlinks resolved) is inside a workspace folder's real path. */
function confined(file) {
  const real = realpathOrNull(file);
  if (!real) return false;
  return roots().some((r) => {
    const root = realpathOrNull(r.path);
    return !!root && core.within(real, root);
  });
}

/** Show the complete diagnostic without the single-line tree width constraint. */
async function exportCurrentResults() {
  return exportResults(createReport(getGroups(), getConfig().severity, getConfig().enabled, roots().length > 0));
}

async function openDetails() {
  if (!detailsProvider) return false;
  await detailsProvider.reveal(null);
  return true;
}

async function showReferenceDetails(arg) {
  const f = liveFinding(arg);
  if (!f) return false;
  await detailsProvider.reveal({ file: f.file, line: f.line, col: f.col, code: f.code });
  return true;
}

async function openReference(arg) {
  const f = liveFinding(arg);
  if (!f) {
    vscode.window.showWarningMessage("PathMend: that reference is no longer reported. Run PathMend: Scan workspace and try again.");
    return false;
  }
  if (!insideWorkspace(f.file) || !confined(f.file)) {
    vscode.window.showWarningMessage("PathMend: refusing to open a file outside the workspace.");
    return false;
  }
  try {
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(f.file));
    const line = Math.min(f.line, Math.max(0, doc.lineCount - 1));
    const r = new vscode.Range(line, f.col, line, f.endCol);
    await vscode.window.showTextDocument(doc, { selection: r, preview: true });
    return true;
  } catch (e) {
    vscode.window.showWarningMessage("PathMend: could not open " + viewPath(f.file) + ": " + (e && e.message ? e.message : e));
    return false;
  }
}

/** Replace the broken path with the "Did you mean" suggestion (same edit as the Quick Fix). */
async function applyFix(arg) {
  const f = liveFinding(arg);
  if (!f || !f.fix) {
    vscode.window.showWarningMessage("PathMend: no fix available for that reference any more. Run PathMend: Scan workspace and try again.");
    return false;
  }
  if (!insideWorkspace(f.file) || !confined(f.file)) {
    vscode.window.showWarningMessage("PathMend: refusing to edit a file outside the workspace.");
    return false;
  }
  let doc;
  try {
    doc = await vscode.workspace.openTextDocument(vscode.Uri.file(f.file));
  } catch (_) {
    return false;
  }
  const r = new vscode.Range(f.line, f.col, f.line, f.endCol);
  const text = core.encodeFor(f.ref, f.fix);
  if (text === null || doc.getText(r) !== f.ref.raw) {
    vscode.window.showWarningMessage("PathMend: " + viewPath(f.file) + " changed since the last scan. Rescanning.");
    scheduleScan(0);
    return false;
  }
  const wasDirty = doc.isDirty;
  const edit = new vscode.WorkspaceEdit();
  edit.replace(doc.uri, r, text);
  const ok = await vscode.workspace.applyEdit(edit);
  if (ok && !wasDirty) await doc.save();
  await scan();
  return ok;
}

// ---------------------------------------------------------------------------
// Quick Fix
// ---------------------------------------------------------------------------

function provideCodeActions(doc, range, context) {
  const actions = [];
  if (!doc.uri || doc.uri.scheme !== "file" || !state) return actions;
  const file = path.resolve(doc.uri.fsPath);
  if (!insideWorkspace(file)) return actions;
  const diags = (context.diagnostics || []).filter((d) => d.source === SOURCE);
  const seen = new Set();
  for (const [key, fx] of state.fixes) {
    const f = fx.finding;
    if (f.file !== file || seen.has(key)) continue;
    const r = new vscode.Range(f.line, f.col, f.line, f.endCol);
    const diag = diags.find((d) => d.range.start.line === f.line && d.range.start.character === f.col);
    if (!diag && !r.intersection(range)) continue;
    if (doc.getText(r) !== f.ref.raw) continue;
    const text = core.encodeFor(f.ref, fx.newText);
    if (text === null) continue;
    seen.add(key);
    const act = new vscode.CodeAction('Did you mean "' + fx.newText + '"?', vscode.CodeActionKind.QuickFix);
    act.edit = new vscode.WorkspaceEdit();
    act.edit.replace(doc.uri, r, text);
    if (diag) act.diagnostics = [diag];
    act.isPreferred = true;
    actions.push(act);
  }
  return actions;
}

// ---------------------------------------------------------------------------
// Rename awareness
// ---------------------------------------------------------------------------

function renamesOf(e) {
  return (e.files || [])
    .filter((f) => f.oldUri && f.newUri && f.oldUri.scheme === "file" && f.newUri.scheme === "file")
    .map((f) => ({ from: path.resolve(f.oldUri.fsPath), to: path.resolve(f.newUri.fsPath) }));
}

function renameKey(renames) {
  return JSON.stringify(renames.map((r) => [r.from, r.to]));
}

function planFor(renames) {
  if (!state || !renames.length) return [];
  return core.planRenames(state.refs, renames, insideWorkspace);
}

async function applyPlan(plan, preview) {
  if (!plan || !plan.length) return false;
  const edit = new vscode.WorkspaceEdit();
  const touched = new Map();
  let count = 0;
  for (const p of plan) {
    const file = p.file || p.ref.file;
    if (!insideWorkspace(file) || !confined(file)) continue; // edits only inside the workspace
    const uri = vscode.Uri.file(file);
    let doc;
    try {
      doc = await vscode.workspace.openTextDocument(uri);
    } catch (_) {
      continue;
    }
    const r = new vscode.Range(p.ref.line, p.ref.col, p.ref.line, p.ref.endCol);
    if (doc.getText(r) !== p.ref.raw) continue;
    const text = core.encodeFor(p.ref, p.newText);
    if (text === null) continue;
    edit.replace(uri, r, text, {
      label: "Update moved path",
      description: relPath(file),
      needsConfirmation: !!preview,
    });
    if (!touched.has(file)) touched.set(file, { doc, wasDirty: doc.isDirty });
    count++;
  }
  if (!count) return false;
  const ok = await vscode.workspace.applyEdit(edit);
  // Save the files PathMend edited, but never a file that already had unsaved changes of yours.
  if (ok && !preview) for (const t of touched.values()) if (!t.wasDirty && t.doc.isDirty) await t.doc.save();
  await scan();
  return ok;
}

async function onDidRename(e) {
  if (!state) return;
  const cfg = getConfig();
  const renames = renamesOf(e);
  // Use the plan made in onWillRenameFiles (before the move) only for this very rename.
  const key = renameKey(renames);
  const pending = state.pendingPlan && state.pendingPlan.key === key ? state.pendingPlan.plan : null;
  state.pendingPlan = null;
  const plan = pending && pending.length ? pending : planFor(renames);
  state.lastPlan = plan;
  // Ask right away: the plan was made from the scan before the move, so the prompt never waits
  // for the file index or a rescan.
  if (plan.length && cfg.renameUpdates !== "off") {
    const n = plan.length;
    const old = relPath(plan[0].from);
    const msg = plan.some(p => p.sourceMoved)
      ? n + " relative path reference" + (n === 1 ? "" : "s") + (n === 1 ? " needs" : " need") + " updating after the move - update " + (n === 1 ? "it" : "all") + "?"
      : n + " path reference" + (n === 1 ? "" : "s") + " still point" + (n === 1 ? "s" : "") + " to " + old + " - update " + (n === 1 ? "it" : "all") + "?";
    state.lastPrompt = msg;
    state.lastPromptDone = Promise.resolve(vscode.window.showInformationMessage(msg, "Update all", "Preview", "Ignore")).then(
      (choice) => {
        if (choice === "Update all") return applyPlan(plan, false);
        if (choice === "Preview") return applyPlan(plan, true);
        return false;
      },
      () => false
    );
  }
  if (!state.index) invalidateIndex(); // an index build may be running: do not keep it
  else {
    const rs = roots();
    for (const rn of renames) {
      const r1 = rootFor(rn.from, rs);
      if (r1) state.index.remove(r1.path, core.toPosix(path.relative(r1.path, rn.from)));
      const r2 = rootFor(rn.to, rs);
      if (!r2) continue;
      let isDir = false;
      try {
        isDir = (await vscode.workspace.fs.stat(vscode.Uri.file(rn.to))).type & vscode.FileType.Directory;
      } catch (_) {
        /* moved again already */
      }
      if (!state) return;
      if (!state.index) {
        invalidateIndex();
        break;
      }
      if (isDir) invalidateIndex(); // a moved folder: rebuild the index on the next scan
      else state.index.add(r2.path, core.toPosix(path.relative(r2.path, rn.to)));
    }
  }
  await scan();
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function showBroken() {
  await scan();
  const list = state.findings || [];
  if (!list.length) {
    vscode.window.showInformationMessage("PathMend: no broken path references.");
    return;
  }
  const items = list.map((f) => ({
    label: (f.info ? "$(info) " : "$(link) ") + f.code + "  " + f.ref.display,
    description: viewPath(f.file) + ":" + (f.line + 1),
    detail: f.message + (f.fix ? ' - did you mean "' + f.fix + '"?' : ""),
    f,
  }));
  const pick = await vscode.window.showQuickPick(items, { placeHolder: "Broken path references", matchOnDescription: true, matchOnDetail: true });
  if (!pick) return;
  await openReference(pick.f);
}

async function scanCommand() {
  invalidateIndex();
  const f = await scan();
  const n = f.filter((x) => !x.info).length;
  vscode.window.setStatusBarMessage("PathMend: " + n + " broken path reference" + (n === 1 ? "" : "s"), 4000);
  return f;
}

// ---------------------------------------------------------------------------
// Activation
// ---------------------------------------------------------------------------

function isConfigDoc(doc) {
  return doc && doc.uri && doc.uri.scheme === "file" && !!core.classify(doc.uri.fsPath);
}

/** Rebuild the file index and rescan: catches files created, deleted or moved outside VS Code. */
function refreshIndex() {
  if (!state) return Promise.resolve([]);
  invalidateIndex();
  state.lastRefresh = Date.now();
  return scan();
}

function activate(context) {
  state = {
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
  detailsProvider = new ReferenceDetailsProvider(context.extensionUri, {
    getGroups, getSeverity: () => getConfig().severity,
    isEnabled: () => getConfig().enabled, hasWorkspace: () => roots().length > 0,
    open: openReference, fix: applyFix,
  });
  treeView = vscode.window.createTreeView(VIEW_ID, { treeDataProvider: treeProvider, showCollapseAll: true });
  const excluded = (uri) => {
    const r = rootFor(path.resolve(uri.fsPath), roots());
    if (!r) return true;
    return core.makeMatcher(getConfig().exclude)(core.toPosix(path.relative(r.path, path.resolve(uri.fsPath))));
  };
  const onCreate = async (uri) => {
    if (!state || !uri || uri.scheme !== "file" || excluded(uri)) return;
    let isDir = false;
    try {
      isDir = (await vscode.workspace.fs.stat(uri)).type & vscode.FileType.Directory;
    } catch (_) {
      return; // already gone again
    }
    if (!state) return;
    if (isDir || !state.index) invalidateIndex(); // a new folder, or an index being built: rebuild
    else {
      const p = path.resolve(uri.fsPath);
      const r = rootFor(p, roots());
      if (r) state.index.add(r.path, core.toPosix(path.relative(r.path, p)));
    }
    scheduleScan(800);
  };
  const onDelete = (uri) => {
    if (!state || !uri || uri.scheme !== "file") return;
    const p = path.resolve(uri.fsPath);
    const r = rootFor(p, roots());
    if (!state.index) invalidateIndex();
    else if (r) state.index.remove(r.path, core.toPosix(path.relative(r.path, p)));
    scheduleScan(800);
  };
  const watcher = vscode.workspace.createFileSystemWatcher("**/*", false, true, false);
  watcher.onDidCreate((u) => onCreate(u).catch(() => {}));
  watcher.onDidDelete(onDelete);
  state.poll = setInterval(() => {
    if (state && vscode.window.state.focused && getConfig().enabled) refreshIndex().catch(() => {});
  }, POLL_MS);
  context.subscriptions.push(
    state.diagnostics,
    state.status,
    watcher,
    treeProvider.emitter,
    treeView,
    treeView.onDidChangeSelection(event => {
      const f = liveFinding(event.selection[0]);
      detailsProvider.select(f ? { file: f.file, line: f.line, col: f.col, code: f.code } : null);
    }),
    detailsProvider,
    vscode.window.registerWebviewViewProvider("pathmend.details", detailsProvider),
    vscode.commands.registerCommand("pathmend.scan", scanCommand),
    vscode.commands.registerCommand("pathmend.showBroken", showBroken),
    vscode.commands.registerCommand("pathmend.openReference", openReference),
    vscode.commands.registerCommand("pathmend.showReferenceDetails", showReferenceDetails),
    vscode.commands.registerCommand("pathmend.openDetails", openDetails),
    vscode.commands.registerCommand("pathmend.exportResults", exportCurrentResults),
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
      if (w.focused && state && Date.now() - state.lastRefresh > 10000 && getConfig().enabled) refreshIndex().catch(() => {});
    }),
    vscode.workspace.onWillRenameFiles((e) => {
      const renames = renamesOf(e);
      state.pendingPlan = { key: renameKey(renames), plan: planFor(renames) };
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
  return {
    ready,
    scan: () => scan(),
    rebuildIndex: () => refreshIndex(),
    poll: () => refreshIndex(),
    getFindings: () => (state ? state.findings : []),
    getLastRenamePlan: () => (state ? state.lastPlan : []),
    getLastPrompt: () => (state ? { message: state.lastPrompt, done: state.lastPromptDone } : null),
    applyRenamePlan: (plan, preview) => applyPlan(plan, preview),
    getChildren: (node) => treeProvider.getChildren(node),
    getTreeItem: (node) => treeProvider.getTreeItem(node),
    getBadge: () => (treeView && treeView.badge ? treeView.badge.value : 0),
    isViewVisible: () => !!(treeView && treeView.visible),
    isDetailsVisible: () => !!(detailsProvider && detailsProvider.visible),
    getStatusText: () => (state && state.status ? state.status.text : ""),
  };
}

function deactivate() {
  if (state) {
    clearTimeout(state.timer);
    clearInterval(state.poll);
  }
  state = null;
  treeView = null;
  treeProvider = null;
  detailsProvider = null;
}

module.exports = { activate, deactivate };
