"use strict";

const vscode = require("vscode");

/** Keep notifications short; full paths and errors belong in modal detail. */
function showErrorDetail(title, detail) {
  return vscode.window.showErrorMessage("PathMend: " + title, { modal: true, detail });
}

function confirmReplacement(original, replacement) {
  return vscode.window.showWarningMessage(
    "PathMend could not verify the replacement path.",
    { modal: true, detail: [
      "Original:", original, "", "Replacement:", replacement, "",
      "The target may be missing, the wrong type, or outside the allowed path context.",
      "Applying this change may leave a broken reference.",
    ].join("\n") },
    "Apply Anyway"
  );
}

/** Short non-blocking rename notification; Preview opens VS Code's native diff UI. */
function promptRenameUpdates(count) {
  const message = count + " path reference" + (count === 1 ? " needs" : "s need") + " updating after a move.";
  return { message, choice: vscode.window.showInformationMessage(message, "Update all", "Preview", "Ignore") };
}

module.exports = { showErrorDetail, confirmReplacement, promptRenameUpdates };
