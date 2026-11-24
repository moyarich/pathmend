"use strict";
const { extractLaunch } = require("./extract");

const format = {
  id: "launch-json",
  patterns: ["**/.vscode/launch.json"],
  order: 2,
  rules: {
    PM007: Object.freeze({
    name: "launch-path-not-found",
    description: "launch.json path not found",
    category: "editor",
    tags: Object.freeze(["vscode","launch"]),
    severity: "warning",
    fixable: true,
  }),
  },
  match({ base, parent, grand, parts }) { if (base === "launch.json" && parent === ".vscode") return "launch"; return null; },
  
  extract(document, context, settings) { return extractLaunch(document, context); },
};

module.exports = { format };
