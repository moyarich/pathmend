"use strict";
const vscode = require("vscode");
const path = require("node:path");
const fs = require("node:fs");
const analyzer = require("../../analyzer");
const { promptRenameUpdates } = require("../../../views/native-dialogs");

function createRenameEvents(runtime) {
  const { getConfig, insideWorkspace, confined, relPath, roots, rootFor, invalidateIndex, scan } = runtime;
  function renamesOf(e) {
    return (e.files || [])
      .filter((f) => f.oldUri && f.newUri && f.oldUri.scheme === "file" && f.newUri.scheme === "file")
      .map((f) => ({ from: path.resolve(f.oldUri.fsPath), to: path.resolve(f.newUri.fsPath) }));
  }
  
  function renameKey(renames) {
    return JSON.stringify(renames.map((r) => [r.from, r.to]));
  }
  
  function planFor(renames) {
    if (!runtime.state || !renames.length) return [];
    return analyzer.planRenames(runtime.state.refs, renames, insideWorkspace);
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
      const text = analyzer.encodeFor(p.ref, p.newText);
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
    if (!runtime.state) return;
    const cfg = getConfig();
    const renames = renamesOf(e);
    // Use the plan made in onWillRenameFiles (before the move) only for this very rename.
    const key = renameKey(renames);
    const pending = runtime.state.pendingPlan && runtime.state.pendingPlan.key === key ? runtime.state.pendingPlan.plan : null;
    runtime.state.pendingPlan = null;
    const plan = pending && pending.length ? pending : planFor(renames);
    runtime.state.lastPlan = plan;
    // Ask right away: the plan was made from the scan before the move, so the prompt never waits
    // for the file index or a rescan.
    if (plan.length && cfg.renameUpdates !== "off") {
      const { message, choice } = promptRenameUpdates(plan.length);
      runtime.state.lastPrompt = message;
      runtime.state.lastPromptDone = Promise.resolve(choice).then(
        (choice) => {
          if (choice === "Update all") return applyPlan(plan, false);
          if (choice === "Preview") return applyPlan(plan, true);
          return false;
        },
        () => false
      );
    }
    if (!runtime.state.index) invalidateIndex(); // an index build may be running: do not keep it
    else {
      const rs = roots();
      for (const rn of renames) {
        const r1 = rootFor(rn.from, rs);
        if (r1) runtime.state.index.remove(r1.path, analyzer.toPosix(path.relative(r1.path, rn.from)));
        const r2 = rootFor(rn.to, rs);
        if (!r2) continue;
        let isDir = false;
        try {
          isDir = (await vscode.workspace.fs.stat(vscode.Uri.file(rn.to))).type & vscode.FileType.Directory;
        } catch (_) {
          /* moved again already */
        }
        if (!runtime.state) return;
        if (!runtime.state.index) {
          invalidateIndex();
          break;
        }
        if (isDir) invalidateIndex(); // a moved folder: rebuild the index on the next scan
        else runtime.state.index.add(r2.path, analyzer.toPosix(path.relative(r2.path, rn.to)));
      }
    }
    await scan();
  }
  
  // ---------------------------------------------------------------------------
  // Commands
  return { renamesOf, renameKey, planFor, applyPlan, onDidRename };
}
module.exports = { createRenameEvents };
