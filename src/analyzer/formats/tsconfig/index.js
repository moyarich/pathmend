"use strict";
const { extractTsconfig, tsInfoOf } = require("./extract");

const format = {
  id: "tsconfig",
  patterns: ["**/{tsconfig*,jsconfig*}.json"],
  order: 1,
  rules: {
    PM002: Object.freeze({
    name: "tsconfig-path-not-found",
    description: "tsconfig / jsconfig path not found",
    category: "typescript",
    tags: Object.freeze(["tsconfig","jsconfig"]),
    severity: "warning",
    fixable: true,
  }),
  },
  match({ base, parent, grand, parts }) { if (/^[tj]sconfig(\..+)?\.json$/i.test(base)) return "tsconfig"; return null; },
  prepare(document, context) { const info = tsInfoOf(document); if (info) context.tsInfo.set(document.file, info); },
  extract(document, context, settings) { return extractTsconfig(document, context); },
};

module.exports = { format };
