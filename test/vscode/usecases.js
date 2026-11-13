"use strict";

// Additional article use cases, kept separate from the original integration checks.
// Uses only a temporary subfolder in the already-isolated VS Code test workspace.
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");

async function runScriptCases(check, cfg) {
  const ws = fs.realpathSync(cfg.ws);
  const dir = path.join(ws, "pathmend-script-cases");
  const pkgPath = path.join(dir, "package.json");
  const script = path.join(dir, "tools", "present.sh");
  const { captureState } = require("./utils/visual");
  const ext = vscode.extensions.getExtension("jaytankdev.pathmend");
  const api = await ext.activate();
  try {
    fs.mkdirSync(path.dirname(script), { recursive: true });
    fs.writeFileSync(script, "#!/bin/sh\necho ok\n");
    const scripts = {
      missingNode: "node tools/missing.js",
      missingBash: "bash tools/missing.sh",
      missingRelative: "./tools/missing-cli.sh",
      existingBash: "bash tools/present.sh",
      existingRelative: "./tools/present.sh",
      npmCommand: "npm run build",
      packageBinary: "eslint .",
      envVariable: "node $ENTRYPOINT",
      remote: "node https://example.com/script.js",
      chained: "echo ready && node tools/missing-second.js",
    };
    fs.writeFileSync(pkgPath, JSON.stringify({ name: "script-cases", version: "1.0.0", scripts }, null, 2) + "\n");
    await api.rebuildIndex();
    const findings = vscode.languages.getDiagnostics(vscode.Uri.file(pkgPath))
      .filter((d) => d.source === "PathMend");
    const valueFor = (d) => {
      const line = fs.readFileSync(pkgPath, "utf8").split("\n")[d.range.start.line];
      return line.slice(d.range.start.character, d.range.end.character);
    };
    const actual = findings.map((d) => ({ code: d.code, value: valueFor(d), range: d.range }));
    const expected = ["tools/missing.js", "tools/missing.sh", "./tools/missing-cli.sh", "tools/missing-second.js"];
    check("scripts: missing local executable paths reported as PM001", expected.every((v) =>
      actual.some((d) => d.code === "PM001" && d.value === v)), actual);
    check("scripts: valid commands, environment variables and URLs ignored", actual.length === expected.length, actual);
    check("scripts: exact token ranges", actual.every((d) => expected.includes(d.value)), actual);

    // Let someone watching the editor inspect the script examples as well.
    try {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(pkgPath));
      await vscode.window.showTextDocument(doc, { preview: false });
      await vscode.commands.executeCommand("workbench.view.extension.pathmend");
    } catch (error) {
      console.warn("Could not show script use cases:", error.message);
    }
  } finally {
    // Remove only files created by this suite; restore the original workspace.
    fs.rmSync(dir, { recursive: true, force: true });
    await api.rebuildIndex();
  }
}

module.exports = { runScriptCases };
