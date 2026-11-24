"use strict";

const vscode = require("vscode");
const { formats, serializeReport } = require("../src/analyzer/reporting/formats");
const { showErrorDetail } = require("./native-dialogs");

/** Write only to a destination explicitly selected by the user. */
async function exportResults(report) {
  const selected = await vscode.window.showQuickPick(Object.entries(formats).map(([format,label])=>({label,description:"."+format,format})),{title:"Export PathMend results",placeHolder:"Choose report format"});
  if (!selected) return false;
  const {format,label} = selected;
  const uri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.joinPath(vscode.workspace.workspaceFolders?.[0]?.uri || vscode.Uri.file(require("node:os").homedir()), "pathmend-results."+format),
    filters: { [label]: [format] },
    saveLabel: "Export PathMend results",
  });
  if (!uri) return false;
  try {
    await vscode.workspace.fs.writeFile(uri, Buffer.from(serializeReport(report,format), "utf8"));
    vscode.window.showInformationMessage("PathMend: exported " + report.summary.total + " references.");
    return true;
  } catch (error) {
    void showErrorDetail("Export failed.", uri.fsPath + "\n\n" + (error?.message || String(error)));
    return false;
  }
}

module.exports = { exportResults };
