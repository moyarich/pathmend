"use strict";
const { extractCodeowners } = require("./extract");

const format = {
  id: "codeowners",
  patterns: ["**/CODEOWNERS"],
  order: 2,
  rules: {
    PM006: Object.freeze({
    name: "codeowners-path-not-found",
    description: "CODEOWNERS path not found",
    category: "ownership",
    tags: Object.freeze(["codeowners"]),
    severity: "warning",
    fixable: true,
  }),
  },
  match({ base, parent, grand, parts }) { if (base === "CODEOWNERS") return "codeowners"; return null; },
  
  extract(document, context, settings) { return extractCodeowners(document); },
};

module.exports = { format };
