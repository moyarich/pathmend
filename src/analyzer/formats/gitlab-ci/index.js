"use strict";
const { extractGitlab } = require("./extract");

const format = {
  id: "gitlab-ci",
  patterns: ["**/{.gitlab-ci.yml,*.gitlab-ci.yml,*.gitlab-ci.yaml}"],
  order: 2,
  rules: {
    PM008: Object.freeze({
    name: "gitlab-include-not-found",
    description: "GitLab CI local include not found",
    category: "ci",
    tags: Object.freeze(["gitlab"]),
    severity: "warning",
    fixable: true,
  }),
  },
  match({ base, parent, grand, parts }) { if (base === ".gitlab-ci.yml" || /\.gitlab-ci\.ya?ml$/.test(base)) return "gitlab"; return null; },
  
  extract(document, context, settings) { return extractGitlab(document); },
};

module.exports = { format };
