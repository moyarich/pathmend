"use strict";
const vscode = require("vscode");
const path = require("node:path");
const fs = require("node:fs");
const analyzer = require("../../analyzer");
const MAX_CONFIG_FILES = 2000;
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
  for (const r of rs) if (analyzer.within(p, r.path) && (!best || r.path.length > best.path.length)) best = r;
  return best;
}

function insideWorkspace(p) {
  return !!rootFor(path.resolve(p), roots());
}

function relPath(p) {
  const r = rootFor(p, roots());
  return r ? analyzer.toPosix(path.relative(r.path, p)) || "." : p;
}

async function buildIndex(cfg) {
  const idx = new analyzer.FileIndex();
  const rs = roots();
  if (!rs.length) return idx;
  const uris = await vscode.workspace.findFiles("**/*", excludeGlob(cfg), cfg.maxIndexedFiles + 1);
  if (uris.length > cfg.maxIndexedFiles) idx.truncated = true;
  for (const u of uris.slice(0, cfg.maxIndexedFiles)) {
    if (u.scheme !== "file") continue;
    const p = path.resolve(u.fsPath);
    const r = rootFor(p, rs);
    if (r) idx.add(r.path, analyzer.toPosix(path.relative(r.path, p)));
  }
  return idx;
}

async function collectConfigs(cfg) {
  const out = new Set();
  if (!roots().length) return [];
  const ex = excludeGlob(cfg);
  for (const g of analyzer.discoveryPatterns) {
    const found = await vscode.workspace.findFiles(g, ex, MAX_CONFIG_FILES);
    for (const u of found) if (u.scheme === "file" && analyzer.classify(u.fsPath)) out.add(path.resolve(u.fsPath));
  }
  return [...out];
}

function openDocText(p) {
  for (const d of vscode.workspace.textDocuments) {
    if (d.uri && d.uri.scheme === "file" && path.resolve(d.uri.fsPath) === p) return d.getText();
  }
  return null;
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
    return !!root && analyzer.within(real, root);
  });
}
function isConfigDoc(doc) {
  return doc && doc.uri && doc.uri.scheme === "file" && !!analyzer.classify(doc.uri.fsPath);
}
module.exports = { roots, excludeGlob, rootFor, insideWorkspace, relPath, buildIndex, collectConfigs, openDocText, confined, isConfigDoc };
