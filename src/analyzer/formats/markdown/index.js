"use strict";
const { extractMarkdown } = require("./extract");

const format = {
  id: "markdown",
  cacheable: true,
  patterns: ["**/*.{md,mdx,MD,MDX}"],
  order: 2,
  rules: {
    PM012: Object.freeze({
    name: "markdown-path-not-found",
    description: "Markdown link or image path not found",
    category: "markdown",
    tags: Object.freeze(["markdown","mdx","links"]),
    severity: "warning",
    fixable: true,
  }),
    PM013: Object.freeze({
    name: "mdx-module-not-found",
    description: "MDX import or export path not found",
    category: "mdx",
    tags: Object.freeze(["mdx","imports"]),
    severity: "warning",
    fixable: true,
  }),
    PM014: Object.freeze({
    name: "mdx-attribute-path-not-found",
    description: "MDX JSX attribute path not found",
    category: "mdx",
    tags: Object.freeze(["mdx","jsx"]),
    severity: "warning",
    fixable: true,
  }),
    PM015: Object.freeze({
    name: "directive-path-not-found",
    description: "Markdown directive path not found",
    category: "markdown",
    tags: Object.freeze(["markdown","mdx","directives"]),
    severity: "warning",
    fixable: true,
  }),
  },
  match({ base, parent, grand, parts }) { if (/\.mdx$/i.test(base)) return "mdx"; if (/\.md$/i.test(base)) return "markdown"; return null; },
  
  extract(document, context, settings) { return extractMarkdown(document, settings); },
};

module.exports = { format };
