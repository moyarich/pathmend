"use strict";

const { createSnapshot } = require("./model");

/** Export the full current diagnostic set, without internal IDs or absolute source file fields. */
function createReport(groups, severity, enabled, hasWorkspace) {
  const { data } = createSnapshot(groups, severity, enabled, hasWorkspace, 0);
  const files = data.files.map(file => ({
    path: file.path,
    findings: file.findings.map(({ id, ...finding }) => finding),
  }));
  const findings = files.flatMap(file => file.findings);
  const broken = findings.filter(f => !f.notChecked).length;
  return {
    schemaVersion: 1,
    enabled, hasWorkspace,
    summary: { files: files.length, total: findings.length, broken, notChecked: findings.length - broken, fixable: findings.filter(f => f.fix).length },
    files,
  };
}

module.exports = { createReport };
