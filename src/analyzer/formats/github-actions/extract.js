"use strict";
const path = require("node:path");
const { parseYaml, yget, yscalar } = require("../../parsers/yaml");
const { mkRef, yamlRef } = require("../../references/create-reference");
const { skipYamlValue } = require("../yaml-values");
const { runTokens } = require("../../parsers/shell");

function repoRootOf(file) {
  const parts = file.split(path.sep);
  const i = parts.lastIndexOf(".github");
  return i > 0 ? parts.slice(0, i).join(path.sep) || path.sep : path.dirname(file);
}

function extractWorkflow(c, kind) {
  const out = [];
  const root = repoRootOf(c.file);
  const doc = parseYaml(c.text)[0];
  if (!doc || doc.type !== "map") return out;
  const wdRef = (node, label) => {
    const s = yscalar(node);
    if (!s || skipYamlValue(s.value)) return { skip: !!s, value: null };
    out.push(yamlRef(c, s, { code: "PM005", base: root, kind: "dir", label: label + " working-directory" }));
    return { skip: false, value: s.value };
  };
  const wd = (node) => yget(yget(yget(node, "defaults"), "run"), "working-directory");
  const doSteps = (steps, label, inherited) => {
    if (!steps || steps.type !== "seq") return;
    for (const step of steps.items) {
      if (!step || step.type !== "map") continue;
      const uses = yscalar(yget(step, "uses"));
      if (uses && uses.value.startsWith("./") && !skipYamlValue(uses.value)) {
        out.push(yamlRef(c, uses, { code: "PM005", base: root, kind: "dir", needFileIn: ["action.yml", "action.yaml", "Dockerfile"], label: label + " uses" }));
      }
      let eff = inherited;
      if (yget(step, "working-directory")) {
        const r = wdRef(yget(step, "working-directory"), label + " step");
        eff = r.skip ? { skip: true } : { skip: false, value: r.value };
      }
      const run = yget(step, "run");
      if (!run || eff.skip) continue;
      const base = eff.value ? path.resolve(root, eff.value) : root;
      for (const t of runTokens(run)) {
        out.push(
          mkRef({ file: c.file, line: t.line, col: t.col, endCol: t.endCol, value: t.value, escape: "shell", code: "PM005", base, kind: "file", requireBase: true, label: label + " run" })
        );
      }
    }
  };
  if (kind === "action") {
    doSteps(yget(yget(doc, "runs"), "steps"), "action", { skip: false, value: null });
    return out;
  }
  let wfWd = { skip: false, value: null };
  if (wd(doc)) {
    const r = wdRef(wd(doc), "workflow defaults");
    wfWd = r.skip ? { skip: true } : { skip: false, value: r.value };
  }
  const jobs = yget(doc, "jobs");
  if (!jobs || jobs.type !== "map") return out;
  for (const job of jobs.entries) {
    const j = job.value;
    if (!j || j.type !== "map") continue;
    const label = "job " + job.key;
    const steps = yget(j, "steps");
    const movedCheckout =
      steps &&
      steps.type === "seq" &&
      steps.items.some((s) => {
        const u = yscalar(yget(s, "uses"));
        return u && /^actions\/checkout@/.test(u.value) && yget(yget(s, "with"), "path");
      });
    if (movedCheckout) continue;
    const juses = yscalar(yget(j, "uses"));
    if (juses && juses.value.startsWith("./") && !skipYamlValue(juses.value)) {
      out.push(yamlRef(c, juses, { code: "PM005", base: root, kind: "file", label: label + " uses" }));
    }
    let eff = wfWd;
    if (wd(j)) {
      const r = wdRef(wd(j), label + " defaults");
      eff = r.skip ? { skip: true } : { skip: false, value: r.value };
    }
    doSteps(steps, label, eff);
  }
  return out;
}

module.exports = { extractWorkflow };
