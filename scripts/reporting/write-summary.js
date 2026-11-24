"use strict";

const fs = require("node:fs");
const path = require("node:path");

const [suite, file] = process.argv.slice(2);
const titles = { vitest: "Vitest", diagnostics: "Analyzer diagnostics", vscode: "VS Code integration" };
const outcome = process.env.TEST_OUTCOME || "unknown";
const lines = ["## " + (titles[suite] || "Tests"), "", "**Test step:** " + outcome, ""];

/** Escape GitHub workflow command data and property values separately. */
function escapeCommand(value, property = false) {
  let result = String(value).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
  if (property) result = result.replace(/:/g, "%3A").replace(/,/g, "%2C");
  return result;
}

/** Publish a native error annotation, optionally attached to a repository file. */
function annotate(name, detail, file, location) {
  if (!process.env.GITHUB_ACTIONS) return;
  const props = ["title=" + escapeCommand(name, true)];
  if (file) {
    const relative = path.relative(process.env.GITHUB_WORKSPACE || process.cwd(), path.resolve(file));
    if (relative && relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative)) {
      props.push("file=" + escapeCommand(relative.split(path.sep).join("/"), true));
      if (Number.isInteger(location?.line) && location.line > 0) {
        props.push("line=" + location.line);
        if (Number.isInteger(location.column) && location.column > 0) props.push("col=" + location.column);
      }
    }
  }
  console.log("::error " + props.join(",") + "::" + escapeCommand(String(detail || name).slice(0, 4000)));
}

/** Escape test-authored text for Markdown tables and summaries. */
function safe(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/[\\|*_\[\]#]/g, "\\$&").replace(/\x60/g, "\\\x60").replace(/\r?\n/g, " ");
}

function counts(passed, failed, skipped = 0) {
  lines.push("| Passed | Failed | Skipped | Total |", "| ---: | ---: | ---: | ---: |",
    "| " + [passed, failed, skipped, passed + failed + skipped].join(" | ") + " |", "");
}

function failures(results, fallbackFile) {
  const failed = results.filter(t => !t.ok);
  if (!failed.length) return;
  lines.push("### Failures", "");
  for (const t of failed) {
    const detail = typeof t.detail === "string" ? t.detail : JSON.stringify(t.detail);
    lines.push("- **" + safe(t.name) + "**" + (detail ? ": " + safe(detail.slice(0, 4000)) : ""));
    annotate(t.name, detail, t.file || fallbackFile, t.location);
  }
  lines.push("");
}

try {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  if (suite === "vitest") {
    counts(data.numPassedTests, data.numFailedTests, (data.numPendingTests || 0) + (data.numTodoTests || 0));
    lines.push("**Test files:** " + data.numPassedTestSuites + " passed, " + data.numFailedTestSuites + " failed.", "");
    const errors = [];
    for (const f of data.testResults || []) {
      for (const t of f.assertionResults || []) {
        if (t.status === "failed") errors.push({ name: t.fullName || t.title, ok: false, detail: (t.failureMessages || []).join("\n"), file: f.name, location: t.location });
      }
      if (f.status === "failed" && !(f.assertionResults || []).some(t => t.status === "failed")) errors.push({ name: f.name, ok: false, detail: f.message, file: f.name });
    }
    failures(errors);
  } else if (suite === "diagnostics") {
    const results = data.results;
    counts(results.filter(t => t.ok).length, results.filter(t => !t.ok).length);
    lines.push("| Check | Result |", "| --- | --- |");
    for (const t of results) lines.push("| " + safe(t.name) + " | " + (t.ok ? "Passed" : "Failed") + " |");
    lines.push("", "**Diagnostics:** " + data.actualDiagnostics + " actual / " + data.expectedDiagnostics + " expected.", "",
      "**Filesystem calls:** " + data.filesystemCalls + " total, " + data.outsideCalls + " outside workspace.", "");
    failures(results, "scripts/test/run-diagnostics-tests.js");
  } else if (suite === "vscode") {
    counts(data.trusted.passed + data.untrusted.passed, data.trusted.failed + data.untrusted.failed);
    lines.push("| Workspace | Passed | Failed |", "| --- | ---: | ---: |");
    for (const mode of ["trusted", "untrusted"]) lines.push("| " + mode + " | " + data[mode].passed + " | " + data[mode].failed + " |");
    lines.push("");
    failures(["trusted", "untrusted"].flatMap(mode => data[mode].results.map(t => ({ ...t, name: mode + ": " + t.name }))));
  }
} catch (error) {
  lines.push("No readable test report was produced. The test step may have failed before starting or been skipped. See the job logs.", "");
  if (outcome !== "skipped" && outcome !== "cancelled") annotate("Test report unavailable", "See the test job logs for details.");
}
const markdown = lines.join("\n") + "\n";
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
else process.stdout.write(markdown);
