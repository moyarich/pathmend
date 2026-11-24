"use strict";
// Fast Node-level check of the analyzer against the fixture (no VS Code). The real editor run is
// test/vscode/index.js. Usage: node scripts/test/run-diagnostics-tests.js <scratch-dir>
const fs = require("fs");
const path = require("path");
const { prepare } = require("../../tests/fixtures/prepare");
const expected = require("../../tests/fixtures/expected");
const analyzer = require("../../src/analyzer/index.js");

const dir = path.resolve(process.argv[2] || path.join(require("os").tmpdir(), "pathmend-unit"));
const { ws, outside } = prepare(dir);

// Index like findFiles with symlink following: include the outside files behind the link.
const index = new analyzer.FileIndex();
const configs = [];
(function walk(abs, rel) {
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const a = path.join(abs, e.name);
    const r = rel ? rel + "/" + e.name : e.name;
    const st = fs.statSync(a);
    if (st.isDirectory()) walk(a, r);
    else {
      index.add(ws, r);
      if (analyzer.classify(a)) configs.push(a);
    }
  }
})(ws, "");

// Spy on fs: record every path that analyzer.js passes to fs.
const calls = [];
const names = ["statSync", "lstatSync", "readlinkSync", "realpathSync", "readFileSync", "existsSync", "accessSync", "openSync", "readdirSync"];
const orig = {};
for (const n of names) {
  orig[n] = fs[n];
  fs[n] = function (p, ...rest) {
    if (/[\\/]src[\\/]analyzer[\\/]workspace[\\/]guard\.js/.test(new Error().stack)) calls.push({ fn: n, p: String(p) });
    return orig[n].call(this, p, ...rest);
  };
}
const guard = analyzer.createGuard(fs, [ws]);
const texts = [];
for (const f of configs) {
  const s = guard.status(f);
  if (s.state !== "file" || s.size > 512 * 1024) continue;
  const r = guard.readText(f, 512 * 1024);
  if (r.text !== undefined) texts.push({ file: f, text: r.text });
}
const res = analyzer.analyze({
  configs: texts,
  roots: [{ path: ws, name: "ws" }],
  guard,
  index,
  settings: { exclude: ["**/node_modules/**", "**/.git/**", "**/dist/**"], ignoreReferences: ["**/build/**", "**/out/**", "**/coverage/**", "**/target/**", "**/.next/**"] },
});
for (const n of names) fs[n] = orig[n];

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok, detail });
}
let fail = 0;
const got = res.findings.map((f) => analyzer.toPosix(path.relative(ws, f.file)) + ":" + (f.line + 1) + ":" + f.code).sort();
const exp = expected.slice().sort();
const missing = exp.filter((x) => { const i = got.indexOf(x); return i < 0; });
const extra = got.slice();
for (const e of exp) { const i = extra.indexOf(e); if (i >= 0) extra.splice(i, 1); }
const miss2 = exp.slice();
for (const g of got) { const i = miss2.indexOf(g); if (i >= 0) miss2.splice(i, 1); }
check("Expected diagnostics match", !extra.length && !miss2.length, { missing: miss2, unexpected: extra });
if (extra.length || miss2.length) {
  fail++;
  console.log("DIAGNOSTICS MISMATCH\n  missing:", miss2, "\n  unexpected:", extra);
}
for (const f of res.findings) console.log(analyzer.toPosix(path.relative(ws, f.file)) + ":" + (f.line + 1) + ":" + (f.col + 1) + " " + f.code + " " + f.message + (f.fix ? '  FIX -> "' + f.fix + '"' : ""));
const bad = calls.filter((c) => !analyzer.within(path.resolve(c.p), ws));
console.log("fs calls from analyzer:", calls.length, "outside workspace:", bad.length);
check("Filesystem calls stay in workspace", calls.length > 0 && !bad.length, { calls: calls.length, outside: bad });
check("Outside directory is not accessed", !calls.some((c) => c.p.startsWith(outside)));
check("Only supported files are read", !calls.some((c) => c.fn === "readFileSync" && !analyzer.classify(c.p)));
if (!calls.length || bad.length) { fail++; console.log(bad); }
if (calls.some((c) => c.p.startsWith(outside))) { fail++; console.log("touched outside dir"); }
if (calls.some((c) => c.fn === "readFileSync" && !analyzer.classify(c.p))) { fail++; console.log("read a non-config file"); }
if (process.env.PM_TEST_RESULTS) {
  fs.writeFileSync(process.env.PM_TEST_RESULTS, JSON.stringify({
    results: checks, expectedDiagnostics: exp.length, actualDiagnostics: got.length,
    filesystemCalls: calls.length, outsideCalls: bad.length,
  }));
}
console.log(fail ? "UNIT FAIL" : "UNIT PASS");
process.exit(fail ? 1 : 0);
