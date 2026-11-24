"use strict";
const path = require("node:path");
const { parseYaml, yget, yscalar } = require("../../parsers/yaml");
const { yamlRef } = require("../../references/create-reference");
const { skipYamlValue } = require("../yaml-values");

function extractCompose(c, ctx) {
  const out = [];
  const dir = path.dirname(c.file);
  for (const doc of parseYaml(c.text)) {
    const services = yget(doc, "services");
    if (!services || services.type !== "map") continue;
    for (const svc of services.entries) {
      const build = yget(svc.value, "build");
      if (!build) continue;
      let ctxNode = null;
      let dfNode = null;
      let inline = false;
      if (build.type === "scalar") ctxNode = yscalar(build);
      else if (build.type === "map") {
        ctxNode = yscalar(yget(build, "context"));
        dfNode = yscalar(yget(build, "dockerfile"));
        inline = !!yget(build, "dockerfile_inline");
      } else continue;
      const label = "compose service " + svc.key;
      let ctxAbs = dir;
      if (ctxNode) {
        const v = ctxNode.value;
        if (skipYamlValue(v) || /\.git(#|$)/.test(v)) continue;
        out.push(yamlRef(c, ctxNode, { code: "PM004", base: dir, kind: "dir", label: label + " build.context" }));
        ctxAbs = path.resolve(dir, v);
      }
      if (!ctx.inside(ctxAbs)) continue;
      let dfAbs = null;
      if (dfNode && !skipYamlValue(dfNode.value)) {
        out.push(yamlRef(c, dfNode, { code: "PM004", base: ctxAbs, kind: "file", label: label + " build.dockerfile" }));
        dfAbs = path.resolve(ctxAbs, dfNode.value);
      } else if (!dfNode && !inline) {
        dfAbs = path.join(ctxAbs, "Dockerfile");
      }
      if (dfAbs) {
        if (!ctx.links.has(dfAbs)) ctx.links.set(dfAbs, []);
        const list = ctx.links.get(dfAbs);
        if (!list.includes(ctxAbs)) list.push(ctxAbs);
      }
    }
  }
  return out;
}

module.exports = { extractCompose };
