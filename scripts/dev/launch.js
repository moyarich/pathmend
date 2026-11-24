"use strict";

// Open a development host, not the automated test suite.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { prepare } = require("../../test/fixtures/prepare");
const { resolveVSCode } = require("../utils/vscode");

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log("Usage: npm run dev -- [--workspace <folder>]");
    return;
  }
  if (args.length && (args.length !== 2 || args[0] !== "--workspace")) {
    throw new Error("Usage: npm run dev -- [--workspace <folder>]");
  }
  const executable = await resolveVSCode();
  const extensionDir = path.resolve(__dirname, "../..");
  const base = fs.realpathSync(fs.mkdtempSync(path.join(process.platform === "darwin" ? "/tmp" : os.tmpdir(), "pm-dev-")));
  try {
    const userDir = path.join(base, "user");
    const extensionsDir = path.join(base, "extensions");
    const settingsDir = path.join(userDir, "User");
    fs.mkdirSync(settingsDir, { recursive: true });
    fs.mkdirSync(extensionsDir, { recursive: true });
    fs.writeFileSync(path.join(settingsDir, "settings.json"), JSON.stringify({
      "extensions.autoUpdate": false,
      "extensions.autoCheckUpdates": false,
      "telemetry.telemetryLevel": "off",
      "update.mode": "none",
      "workbench.startupEditor": "none",
      "window.restoreWindows": "none",
      "window.newWindowDimensions": "maximized",
    }, null, 2));
    const workspace = args.length ? fs.realpathSync(args[1]) : prepare(path.join(base, "fixture")).ws;
    if (!fs.statSync(workspace).isDirectory()) throw new Error("Workspace must be a folder");
    const launchArgs = [
      "--new-window",
      "--user-data-dir", userDir,
      "--extensions-dir", extensionsDir,
      "--disable-extensions",
      ...(!args.length ? ["--disable-extension", "vscode.extension-editing"] : []),
      "--skip-welcome", "--skip-release-notes",
      "--extensionDevelopmentPath=" + extensionDir,
      workspace,
    ];
    console.log("PathMend development workspace: " + workspace);
    console.log("Open PathMend from the Activity Bar or run PathMend: Open Reference Details.");
    const child = spawn(executable, launchArgs, { stdio: "inherit", env: process.env });
    const stop = () => child.kill();
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    try {
      const code = await new Promise((resolve, reject) => {
        child.once("error", reject);
        child.once("close", (code, signal) => resolve(code ?? (signal === "SIGINT" ? 130 : 1)));
      });
      process.exitCode = code;
    } finally {
      process.removeListener("SIGINT", stop);
      process.removeListener("SIGTERM", stop);
    }
  } finally {
    // Only delete the temporary profile and fixture, never a supplied workspace.
    fs.rmSync(base, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}

main().catch(error => {
  console.error("PathMend development launch failed:", error.message);
  process.exitCode = 1;
});
