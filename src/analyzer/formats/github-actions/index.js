"use strict";
const { extractWorkflow } = require("./extract");

const format = {
  id: "github-actions",
  patterns: ["**/.github/**/*.{yml,yaml}"],
  order: 2,
  rules: {
    PM005: Object.freeze({
    name: "github-actions-path-not-found",
    description: "GitHub Actions path not found",
    category: "ci",
    tags: Object.freeze(["github-actions"]),
    severity: "warning",
    fixable: true,
  }),
  },
  match({ base, parent, grand, parts }) { if (/\.ya?ml$/.test(base) && parent === "workflows" && grand === ".github") return "workflow"; if (/^action\.ya?ml$/.test(base) && parts.includes(".github")) return "action"; return null; },
  
  extract(document, context, settings) { return extractWorkflow(document, document.kind); },
};

module.exports = { format };
