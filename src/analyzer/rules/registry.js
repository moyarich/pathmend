"use strict";
const { formats } = require("../formats/registry");
const shared = {
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
};
const rules = {};
const aliases = new Map();
for (const group of [shared, ...formats.map(format => format.rules)]) {
  for (const [code, rule] of Object.entries(group)) {
    if (!/^PM\d+$/.test(code) || Object.hasOwn(rules, code) || aliases.has(rule.name)) throw new Error("Duplicate or invalid rule: " + code + " / " + rule.name);
    rules[code] = rule;
    aliases.set(rule.name, code);
  }
}
const RULES = Object.freeze(Object.fromEntries(Object.entries(rules).sort(([a], [b]) => a.localeCompare(b))));
function resolveRuleId(value) { return Object.hasOwn(RULES, value) ? value : aliases.get(value); }
module.exports = { RULES, resolveRuleId };
