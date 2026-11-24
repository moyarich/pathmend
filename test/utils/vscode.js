"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { downloadAndUnzipVSCode } = require("@vscode/test-electron");

async function resolveVSCode() {
  // Launch the actual Electron executable, not the code CLI shim, so Chromium
  // exposes its DevTools endpoint to Playwright (as Nx Console E2E does).
  const downloaded = process.env.VSCODE_EXECUTABLE_PATH
    || await downloadAndUnzipVSCode(process.env.VSCODE_TEST_VERSION || undefined);
  if (fs.existsSync(downloaded)) return downloaded;
  const macCode = path.join(path.dirname(downloaded), "Code");
  if (fs.existsSync(macCode)) return macCode;
  throw new Error("VS Code executable not found: " + downloaded);
}

module.exports = { resolveVSCode };
