"use strict";

const vscode = require("vscode");

/** Write only to a destination explicitly selected by the user. */
async function exportResults(report) {
  const uri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.joinPath(vscode.workspace.workspaceFolders?.[0]?.uri || vscode.Uri.file(require("node:os").homedir()), "pathmend-results.json"),
    filters: { JSON: ["json"] },
    saveLabel: "Export PathMend results",
  });
  if (!uri) return false;
  try {
    await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(report, null, 2) + "\n", "utf8"));
    vscode.window.showInformationMessage("PathMend: exported " + report.summary.total + " references.");
    return true;
  } catch (error) {
    vscode.window.showErrorMessage("PathMend: export failed: " + error.message);
    return false;
  }
}

module.exports = { exportResults };
