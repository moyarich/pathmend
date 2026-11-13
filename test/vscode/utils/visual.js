"use strict";

// VS Code editor presentation and optional screenshot synchronization.
// These helpers must never determine functional test pass/fail.
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, ms) {
  const end = Date.now() + ms;
  for (;;) {
    let v;
    try {
      v = await fn();
    } catch (_) {
      v = undefined;
    }
    if (v) return v;
    if (Date.now() > end) return v;
    await sleep(100);
  }
}

async function screenshot(cfg, name) {
  if (!cfg.screenshotsEnabled) return;
  // Screenshots are diagnostic artifacts, not test assertions. Wait for the
  // runner's acknowledgment so each image corresponds to the requested state.
  const done = path.join(cfg.shotDir, "shot-done-" + cfg.mode + "-" + name);
  const request = path.join(cfg.shotDir, "shot-" + cfg.mode + "-" + name);
  try {
    fs.writeFileSync(request, "1");
    const completed = await waitFor(() => fs.existsSync(done), 20000);
    if (!completed) {
      console.warn("Screenshot timed out: " + name);
      return;
    }
    if (fs.readFileSync(done, "utf8") !== "ok") {
      console.warn("Screenshot unavailable: " + name);
    }
    fs.unlinkSync(done);
  } catch (error) {
    console.warn("Screenshot skipped (" + name + "): " + error.message);
  }
}

// Prepare only the *presentation* for a screenshot. Functional checks above
// verify the actual state; these commands must never determine test pass/fail.
async function screenshotEditor(ws, file, line) {
  const document = await vscode.workspace.openTextDocument(vscode.Uri.file(path.join(ws, file)));
  const position = new vscode.Position(Math.min(line, document.lineCount - 1), 0);
  const editor = await vscode.window.showTextDocument(document, {
    preview: false,
    preserveFocus: false,
    selection: new vscode.Range(position, position),
  });
  editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
}

async function screenshotView() {
  // Opening PathMend is sufficient: its file-group TreeItems already default
  // to CollapsibleState.Expanded. There is no public list.expandAll command.
  await vscode.commands.executeCommand("workbench.view.extension.pathmend");
}

async function captureState(cfg, name, prepare) {
  // Show the same editor transitions for someone watching VS Code, regardless
  // of whether Playwright is installed or screenshots are enabled.
  try {
    await prepare();
  } catch (error) {
    // Presentation is independent from functional assertions.
    console.warn("Could not show test state (" + name + "):", error.message);
  }
  if (cfg.screenshotsEnabled) {
    await sleep(500);
    await screenshot(cfg, name);
  }
}

module.exports = { sleep, waitFor, captureState, screenshotEditor, screenshotView };
