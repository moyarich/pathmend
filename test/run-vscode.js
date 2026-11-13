"use strict";

// Launches a real, isolated VS Code window with PathMend loaded from this folder and runs
// test/vscode/index.js inside it: once trusted (full suite), once in an untrusted workspace
// (PathMend supports untrusted workspaces, so it must still work there). In the trusted run the
// test asks Playwright to capture the VS Code workbench; the screenshot is saved
// in screenshots/pathmend-panel.png (outside the temporary test workspace).
// Usage: node test/run-vscode.js [tmpBaseDir]

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("node:child_process");
const { chromium } = require("playwright-core");
const { downloadAndUnzipVSCode } = require("@vscode/test-electron");
const { prepare } = require("./prepare");

const extDir = path.resolve(__dirname, "..");
// Short paths matter on macOS because VS Code uses Unix-domain IPC sockets.
const base = fs.realpathSync(fs.mkdtempSync(path.join(process.argv[2] || (process.platform === "darwin" ? "/tmp" : os.tmpdir()), "pm-vscode-")));
const userDir = path.join(base, "user");
const extsDir = path.join(base, "exts");
fs.mkdirSync(path.join(userDir, "User"), { recursive: true });
fs.mkdirSync(extsDir, { recursive: true });
const settingsPath = path.join(userDir, "User", "settings.json");
const resultFile = path.join(base, "results.json");
const cfgFile = path.join(base, "config.json");
const shotDir = path.join(base, "shots");
fs.mkdirSync(shotDir);
const screenshotsDir = path.join(extDir, "screenshots");
fs.mkdirSync(screenshotsDir, { recursive: true });
const shot = path.join(screenshotsDir, "pathmend-panel.png");

function writeSettings(trustEnabled) {
  fs.writeFileSync(
    settingsPath,
    JSON.stringify({
      "security.workspace.trust.enabled": trustEnabled,
      "security.workspace.trust.startupPrompt": "never",
      "extensions.autoUpdate": false,
      "extensions.autoCheckUpdates": false,
      "telemetry.telemetryLevel": "off",
      "update.mode": "none",
      "workbench.startupEditor": "none",
      "git.enabled": false,
      "window.restoreWindows": "none",
      // Unique title so the screenshot finds this window even when other windows share the display.
      "window.title": "pathmend-shot ${rootName}",
      "chat.commandCenter.enabled": false,
      "workbench.secondarySideBar.defaultVisibility": "hidden",
    }, null, 2)
  );
}

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

async function captureWorkbench(devtoolsUrl) {
  if (!devtoolsUrl) throw new Error("VS Code did not expose a DevTools endpoint");
  const browser = await chromium.connectOverCDP(devtoolsUrl, { timeout: 10000 });
  try {
    const deadline = Date.now() + 10000;
    let page;
    while (!page && Date.now() < deadline) {
      for (const context of browser.contexts()) {
        page = context.pages().find((candidate) => candidate.url().includes("workbench"));
        if (page) break;
      }
      if (!page) await new Promise((resolve) => setTimeout(resolve, 200));
    }
    if (!page) throw new Error("VS Code workbench page not found");
    await page.screenshot({ path: shot, timeout: 10000, animations: "disabled" });
    if (!fs.existsSync(shot) || fs.statSync(shot).size === 0) {
      throw new Error("Playwright did not create a nonempty screenshot");
    }
  } finally {
    // A CDP browser close disconnects Playwright, leaving VS Code running.
    await browser.close();
  }
}

async function launch(executable, mode, extraArgs) {
  const fx = prepare(path.join(base, mode, "fx"));
  fs.writeFileSync(cfgFile, JSON.stringify({ mode, resultFile, shotDir, ws: fx.ws, outside: fx.outside }));
  const args = [
    "--new-window",
    "--remote-debugging-port=0",
    "--user-data-dir", userDir,
    "--extensions-dir", extsDir,
    "--disable-extensions",
    ...extraArgs,
    "--skip-welcome", "--skip-release-notes",
    "--extensionDevelopmentPath=" + extDir,
    "--extensionTestsPath=" + path.join(__dirname, "vscode", "index.js"),
    fx.ws,
  ];
  console.log(executable + " " + args.join(" "));
  const child = spawn(executable, args, {
    env: Object.assign({}, process.env, { PM_TEST_CONFIG: cfgFile }),
    stdio: ["ignore", "pipe", "pipe"],
  });
  let devtoolsUrl;
  let debugOutput = "";
  const onOutput = (data, stream) => {
    const output = data.toString();
    stream.write(output);
    if (!devtoolsUrl) {
      // The websocket URL can span multiple stdout/stderr data events.
      debugOutput = (debugOutput + output).slice(-8192);
      const match = /DevTools listening on (ws:\/\/\S+)/.exec(debugOutput);
      if (match) devtoolsUrl = match[1];
    }
  };
  child.stdout.on("data", (data) => onOutput(data, process.stdout));
  child.stderr.on("data", (data) => onOutput(data, process.stderr));
  let spawnError;
  child.on("error", (error) => {
    spawnError = error;
    console.error("VS Code launch failed:", error);
  });
  const exited = new Promise((resolve) => child.on("exit", (code) => resolve(code)));
  const killer = setTimeout(() => child.kill("SIGKILL"), 300000);
  let captureInProgress = false;
  const poll = setInterval(async () => {
    const want = path.join(shotDir, "shot-" + mode);
    if (captureInProgress || !fs.existsSync(want)) return;
    captureInProgress = true;
    fs.unlinkSync(want);
    let screenshotOk = false;
    try {
      await captureWorkbench(devtoolsUrl);
      screenshotOk = true;
      console.log("screenshot: " + shot);
    } catch (error) {
      console.error("screenshot failed:", error.message);
    } finally {
      // Signal an attempt only after Playwright finishes; the test reads its result.
      fs.writeFileSync(path.join(shotDir, "shot-done-" + mode), screenshotOk ? "ok" : "failed");
      captureInProgress = false;
    }
  }, 200);
  const status = await exited;
  clearTimeout(killer);
  clearInterval(poll);
  if (captureInProgress) {
    // Capture normally completes before the extension host writes test results.
    while (captureInProgress) await new Promise((resolve) => setTimeout(resolve, 50));
  }
  if (spawnError) throw spawnError;
  console.log("code exit status:", status);
  if (!fs.existsSync(resultFile)) {
    console.log("FAIL: no results written");
    return { passed: 0, failed: 1, results: [] };
  }
  const res = JSON.parse(fs.readFileSync(resultFile, "utf8"));
  fs.unlinkSync(resultFile);
  for (const t of res.results) console.log((t.ok ? "PASS " : "FAIL ") + t.name + (t.detail !== undefined ? " :: " + JSON.stringify(t.detail) : ""));
  if (status !== 0) res.failed += 1;
  return res;
}

(async () => {
  const executable = await resolveVSCode();
  writeSettings(false);
  const r1 = await launch(executable, "trusted", ["--disable-workspace-trust"]);
  writeSettings(true);
  const r2 = await launch(executable, "untrusted", []);
  const passed = r1.passed + r2.passed;
  const failed = r1.failed + r2.failed;
  console.log(`\nin-editor tests: ${passed} passed, ${failed} failed (trusted run ${r1.passed}/${r1.passed + r1.failed}, untrusted run ${r2.passed}/${r2.passed + r2.failed})`);
  if (!failed) fs.rmSync(base, { recursive: true, force: true });
  process.exit(failed ? 1 : 0);
})().catch((error) => { console.error(error); process.exitCode = 1; });
