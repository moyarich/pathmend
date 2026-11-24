"use strict";

const { RULES } = require("../rules");

function fileGroups(findings, viewPath) {
  const groups = new Map();
  for (const f of findings) {
    if (!groups.has(f.file)) groups.set(f.file, []);
    groups.get(f.file).push(f);
  }
  return [...groups.entries()]
    .map(([file, list]) => ({ type: "file", file, rel: viewPath(file), findings: list.slice().sort((a, b) => a.line - b.line || a.col - b.col) }))
    .sort((a, b) => a.rel.localeCompare(b.rel));
}

/** Full diagnostic text, shared by the tooltip and the explicit details action. */
function findingDetails(f, viewPath) {
  const rule = RULES[f.code];
  return f.code + " (" + rule.name + ") " + rule.description + "\n" +
    viewPath(f.file) + ":" + (f.line + 1) + ":" + (f.col + 1) + "\n\n" +
    f.message + (f.fix ? '\n\nQuick Fix: did you mean "' + f.fix + '"?' : "");
}

/** Serialize only display data; commands use opaque IDs from the current snapshot. */
function createSnapshot(groups, severity, enabled, hasWorkspace, revision) {
  const references = new Map();
  let next = 0;
  const files = groups.map(group => ({
    path: group.rel,
    findings: group.findings.map(f => {
      const id = String(++next);
      references.set(id, { file: f.file, line: f.line, col: f.col, code: f.code });
      return {
        id, code: f.code, rule: RULES[f.code].description, alias: RULES[f.code].name,
        path: f.ref.display, message: f.message, fix: f.fix || null,
        line: f.line + 1, column: f.col + 1, severity: f.info ? "information" : severity, notChecked: !!f.info,
      };
    }),
  }));
  return { references, data: { revision, enabled, hasWorkspace, files } };
}

module.exports = { fileGroups, findingDetails, createSnapshot };
