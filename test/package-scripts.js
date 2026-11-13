"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const core = require("../core");

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "pathmend-scripts-"));
try {
  const pkg = path.join(scratch, "packages", "app");
  for (const p of ["scripts", "tools"]) fs.mkdirSync(path.join(pkg, p), { recursive: true });
  for (const file of ["scripts/build.ts", "scripts/run.js", "scripts/setup.sh", "scripts/other.ts"]) {
    fs.writeFileSync(path.join(pkg, file), "");
  }
  const json = {
    name: "fixture",
    scripts: {
      build: "tsx scripts/build.ts --watch",
      node: "node ./scripts/run.js",
      shell: "bash scripts/setup.sh",
      direct: "./scripts/setup.sh",
      chained: "echo ready && tsx scripts/other.ts",
      package: "vite build",
      npm: "npm run build",
      option: "node --eval console.log(1)",
      variable: "tsx $SCRIPT",
      url: "node https://example.test/script.js",
      notAPath: "echo scripts/build.ts",
    },
  };
  const manifest = path.join(pkg, "package.json");
  fs.writeFileSync(manifest, JSON.stringify(json, null, 2) + "\n");
  const guard = core.createGuard(fs, [scratch]);
  const index = new core.FileIndex();
  const result = core.analyze({
    configs: [{ file: manifest, text: fs.readFileSync(manifest, "utf8") }],
    roots: [{ path: scratch, name: "ws" }],
    guard,
    index,
    settings: {},
  });
  const scripts = result.refs.filter((r) => r.label.includes("scripts."));
  assert.deepEqual(
    scripts.map((r) => [r.label.split("scripts.")[1], r.value]),
    [
      ["build", "scripts/build.ts"],
      ["node", "./scripts/run.js"],
      ["shell", "scripts/setup.sh"],
      ["direct", "./scripts/setup.sh"],
      ["chained", "scripts/other.ts"],
    ]
  );
  assert.equal(result.findings.length, 0, "existing script entry points must not be reported");
  for (const ref of scripts) {
    const line = fs.readFileSync(manifest, "utf8").split("\n")[ref.line];
    assert.equal(line.slice(ref.col, ref.endCol), ref.value, "reference range must cover only the file path");
  }
  const from = path.join(pkg, "scripts", "build.ts");
  const to = path.join(pkg, "tools", "build.ts");
  const filePlan = core.planRenames(result.refs, [{ from, to }], guard.inside);
  assert.equal(filePlan.length, 1);
  assert.equal(filePlan[0].newText, "tools/build.ts");
  assert.equal(filePlan[0].ref.label, "package.json scripts.build");
  const folderPlan = core.planRenames(result.refs, [
    { from: path.join(pkg, "scripts"), to: path.join(pkg, "tools") },
  ], guard.inside);
  assert.equal(folderPlan.length, 5);
  assert.deepEqual(folderPlan.map((p) => p.newText), [
    "tools/build.ts",
    "./tools/run.js",
    "tools/setup.sh",
    "./tools/setup.sh",
    "tools/other.ts",
  ]);
  const edited = fs.readFileSync(manifest, "utf8");
  const p = filePlan[0];
  const lines = edited.split("\n");
  lines[p.ref.line] = lines[p.ref.line].slice(0, p.ref.col) + core.encodeFor(p.ref, p.newText) + lines[p.ref.line].slice(p.ref.endCol);
  const updated = JSON.parse(lines.join("\n"));
  assert.equal(updated.scripts.build, "tsx tools/build.ts --watch");
  assert.equal(updated.scripts.package, "vite build");

  // Missing targets are reported through the existing PM001 diagnostics.
  fs.unlinkSync(from);
  const broken = core.analyze({
    configs: [{ file: manifest, text: fs.readFileSync(manifest, "utf8") }],
    roots: [{ path: scratch, name: "ws" }], guard: core.createGuard(fs, [scratch]), index, settings: {},
  });
  assert.equal(broken.findings.length, 1);
  assert.equal(broken.findings[0].code, "PM001");
  assert.equal(broken.findings[0].ref.label, "package.json scripts.build");
  console.log("package.json scripts regression tests passed");
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}
