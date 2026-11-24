"use strict";

/** Stable diagnostic IDs and metadata. fixable means a suggestion may be available,
 * not that every finding can be fixed. Severity is the default (PM010 is always information). */
const RULES = Object.freeze({
  PM001: Object.freeze({
    name: "package-path-not-found",
    description: "package.json path not found",
    category: "package",
    tags: Object.freeze(["package.json","npm"]),
    severity: "warning",
    fixable: true,
  }),
  PM002: Object.freeze({
    name: "tsconfig-path-not-found",
    description: "tsconfig / jsconfig path not found",
    category: "typescript",
    tags: Object.freeze(["tsconfig","jsconfig"]),
    severity: "warning",
    fixable: true,
  }),
  PM003: Object.freeze({
    name: "docker-source-not-found",
    description: "Dockerfile COPY / ADD source not found",
    category: "docker",
    tags: Object.freeze(["dockerfile","copy","add"]),
    severity: "warning",
    fixable: true,
  }),
  PM004: Object.freeze({
    name: "compose-path-not-found",
    description: "Compose build context / dockerfile not found",
    category: "docker",
    tags: Object.freeze(["compose","build"]),
    severity: "warning",
    fixable: true,
  }),
  PM005: Object.freeze({
    name: "github-actions-path-not-found",
    description: "GitHub Actions path not found",
    category: "ci",
    tags: Object.freeze(["github-actions"]),
    severity: "warning",
    fixable: true,
  }),
  PM006: Object.freeze({
    name: "codeowners-path-not-found",
    description: "CODEOWNERS path not found",
    category: "ownership",
    tags: Object.freeze(["codeowners"]),
    severity: "warning",
    fixable: true,
  }),
  PM007: Object.freeze({
    name: "launch-path-not-found",
    description: "launch.json path not found",
    category: "editor",
    tags: Object.freeze(["vscode","launch"]),
    severity: "warning",
    fixable: true,
  }),
  PM008: Object.freeze({
    name: "gitlab-include-not-found",
    description: "GitLab CI local include not found",
    category: "ci",
    tags: Object.freeze(["gitlab"]),
    severity: "warning",
    fixable: true,
  }),
  PM009: Object.freeze({
    name: "glob-no-matches",
    description: "Glob matches no files",
    category: "filesystem",
    tags: Object.freeze(["glob"]),
    severity: "warning",
    fixable: false,
  }),
  PM010: Object.freeze({
    name: "outside-workspace",
    description: "Path outside the workspace - not checked",
    category: "security",
    tags: Object.freeze(["workspace","filesystem"]),
    severity: "information",
    fixable: true,
  }),
  PM011: Object.freeze({
    name: "outside-docker-context",
    description: "COPY / ADD source outside the Docker build context",
    category: "docker",
    tags: Object.freeze(["dockerfile","build","security"]),
    severity: "warning",
    fixable: false,
  }),
});

const aliases = new Map(Object.entries(RULES).map(([id, rule]) => [rule.name, id]));

/** Resolve a stable rule ID or descriptive alias; unknown values are ignored. */
function resolveRuleId(value) {
  if (Object.prototype.hasOwnProperty.call(RULES, value)) return value;
  return aliases.get(value);
}

module.exports = { RULES, resolveRuleId };
