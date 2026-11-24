"use strict";
const vscode = require("vscode");
const path = require("node:path");
const fs = require("node:fs");
const analyzer = require("../../analyzer");
const SOURCE = "PathMend";

function createScanner(runtime) {
  const { getConfig, roots, buildIndex, collectConfigs, openDocText, severityOf, updateStatus } = runtime;
  const SUPERSEDED = Symbol("superseded");
  
  /** Scan the workspace. If a newer scan starts meanwhile, resolves to that scan's result. */
  function scan() {
    if (!runtime.state) return Promise.resolve([]);
    const st = runtime.state;
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
    if (runtime.state !== st || seq !== st.seq) return SUPERSEDED;
    const rs = roots();
    const guard = analyzer.createGuard(fs, rs.map((r) => r.path));
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
    const result = analyzer.analyze({
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
    if (runtime.state !== st || seq !== st.seq) return SUPERSEDED;
    runtime.state.refs = result.refs;
    runtime.state.findings = result.findings;
    runtime.state.fixes.clear();
    const byFile = new Map();
    const sev = severityOf(cfg.severity);
    for (const f of result.findings) {
      const range = new vscode.Range(f.line, f.col, f.line, Math.max(f.endCol, f.col + 1));
      const d = new vscode.Diagnostic(range, f.message, f.info ? vscode.DiagnosticSeverity.Information : sev);
      d.source = SOURCE;
      d.code = f.code;
      if (!byFile.has(f.file)) byFile.set(f.file, []);
      byFile.get(f.file).push(d);
      if (f.fix) runtime.state.fixes.set(f.file + "|" + f.line + "|" + f.col, { finding: f, newText: f.fix });
    }
    runtime.state.diagnostics.clear();
    for (const [file, list] of byFile) runtime.state.diagnostics.set(vscode.Uri.file(file), list);
    updateStatus();
    if (stale) scheduleScan(300);
    return runtime.state.findings;
  }
  
  /** Drop the file index; the next scan rebuilds it (and a build already running is not kept). */
  function invalidateIndex() {
    if (!runtime.state) return;
    runtime.state.index = null;
    runtime.state.indexGen++;
  }
  
  function scheduleScan(delay) {
    if (!runtime.state) return;
    clearTimeout(runtime.state.timer);
    runtime.state.timer = setTimeout(() => {
      scan().catch(() => {});
    }, delay === undefined ? 500 : delay);
  }
  function refreshIndex() {
    if (!runtime.state) return Promise.resolve([]);
    invalidateIndex();
    runtime.state.lastRefresh = Date.now();
    return scan();
  }
  return { scan, invalidateIndex, scheduleScan, refreshIndex };
}
module.exports = { createScanner };
