"use strict";
const { extractCompose } = require("./extract");

const format = {
  id: "compose",
  patterns: ["**/{docker-compose,compose}{,.*}.{yml,yaml}"],
  order: 0,
  rules: {
    PM004: Object.freeze({
    name: "compose-path-not-found",
    description: "Compose build context / dockerfile not found",
    category: "docker",
    tags: Object.freeze(["compose","build"]),
    severity: "warning",
    fixable: true,
  }),
  },
  match({ base, parent, grand, parts }) { if (/^(docker-)?compose(\.[\w.-]+)?\.ya?ml$/.test(base)) return "compose"; return null; },
  
  extract(document, context, settings) { return extractCompose(document, context); },
};

module.exports = { format };
