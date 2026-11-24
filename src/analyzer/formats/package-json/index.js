"use strict";
const path = require("node:path");
const { parseJsonc, jget } = require("../../parsers/jsonc");
const { extractPackage } = require("./extract");

const format = {
  id: "package-json",
  patterns: ["**/package.json"],
  order: 2,
  rules: {
    PM027: {name:"workspace-package-not-found",description:"Named workspace dependency not found",category:"package",tags:["workspace","dependencies"],severity:"warning",fixable:false},
    PM028: {name:"duplicate-workspace-package",description:"Duplicate workspace package name",category:"package",tags:["workspace","dependencies"],severity:"warning",fixable:false},
    PM026: {name:"local-package-path-not-found",description:"Local package dependency path not found",category:"package",tags:["npm","yarn","pnpm","workspace"],severity:"warning",fixable:true},
    PM001: Object.freeze({
    name: "package-path-not-found",
    description: "package.json path not found",
    category: "package",
    tags: Object.freeze(["package.json","npm"]),
    severity: "warning",
    fixable: true,
  }),
  },
  match({ base, parent, grand, parts }) { if (base === "package.json") return "package"; return null; },
  prepare(document, context) { const name = jget(parseJsonc(document.text), "name"); if (name?.type === "string" && name.value) { if (context.packageDirs.has(name.value)) { context.packageDirs.delete(name.value); context.duplicatePackageNames.add(name.value); } else if (!context.duplicatePackageNames.has(name.value)) context.packageDirs.set(name.value, path.dirname(document.file)); } },
  extract(document, context, settings) { return extractPackage(document, context); },
};

module.exports = { format };
