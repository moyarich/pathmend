import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import manifest from "../../../package.json";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Load both CommonJS modules through the same Node module cache.
const require = createRequire(import.meta.url);
const analyzer = require("../../../src/analyzer/index.js");
const { RULES, resolveRuleId } = require("../../../src/analyzer/rules/registry.js");

describe("rule metadata", () => {
  it("preserves stable IDs and has unique descriptive aliases", () => {
    expect(Object.keys(RULES)).toEqual(expect.arrayContaining(Array.from({ length: 15 }, (_, i) => "PM" + String(i + 1).padStart(3, "0"))));
    expect(analyzer.RULES).toBe(RULES);
    expect(new Set(Object.values(RULES).map(rule => rule.name)).size).toBe(Object.keys(RULES).length);
    for (const [id, rule] of Object.entries(RULES)) {
      expect(resolveRuleId(id)).toBe(id);
      expect(resolveRuleId(rule.name)).toBe(id);
      expect(rule.name).toMatch(/^[a-z]+(?:-[a-z]+)+$/);
      expect(rule.description).toBeTruthy();
      expect(rule.category).toBeTruthy();
      expect(rule.tags.length).toBeGreaterThan(0);
      expect(rule.severity).toBe(id === "PM010" ? "information" : "warning");
      expect(typeof rule.fixable).toBe("boolean");
    }
    expect(resolveRuleId("unknown")).toBeUndefined();
    expect(resolveRuleId("constructor")).toBeUndefined();
  });

  it("keeps the settings schema synchronized", () => {
    const { items } = manifest.contributes.configuration.properties["pathmend.disabledRules"];
    expect(items.enum).toEqual([...Object.keys(RULES), ...Object.values(RULES).map(rule => rule.name)]);
    expect(items.enumDescriptions).toHaveLength(items.enum.length);
  });

  it("disables the same diagnostic by ID or alias", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "pathmend-rules-"));
    try {
      const opts = {
        configs: [{ file: path.join(root, "package.json"), text: '{"main":"./missing.js"}' }],
        roots: [{ path: root, name: "test" }],
        guard: analyzer.createGuard(fs, [root]),
        index: new analyzer.FileIndex(),
      };
      expect(analyzer.analyze(opts).findings.map(f => f.code)).toEqual(["PM001"]);
      for (const selector of ["PM001", "package-path-not-found"]) {
        expect(analyzer.analyze({ ...opts, settings: { disabledRules: [selector] } }).findings).toEqual([]);
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
