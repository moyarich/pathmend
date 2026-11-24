"use strict";
const path = require("node:path");
const { parseJsonc, jget } = require("../../parsers/jsonc");
const { extractPackage } = require("./extract");

const format = {
  id: "package-json",
  patterns: ["**/package.json"],
  order: 2,
  rules: {
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
  prepare(document, context) { const name = jget(parseJsonc(document.text), "name"); if (name?.type === "string" && name.value) context.packageDirs.set(name.value, path.dirname(document.file)); },
  extract(document, context, settings) { return extractPackage(document, context); },
};

module.exports = { format };
