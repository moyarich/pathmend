import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { fileGroups, createSnapshot } = require("../../../views/model");

describe("reference details model", () => {
  it("preserves complete messages and maps opaque IDs to source references", () => {
    const finding = { file: "/workspace/a.md", line: 0, col: 3, code: "PM012", ref: { display: "./<long-path>.md" }, message: "Path not found: <long-path>", fix: "./new.md" };
    const groups = fileGroups([finding], () => "a.md");
    const { data, references } = createSnapshot(groups, "warning", true, true, 2);
    const row = data.files[0].findings[0];
    expect(row.message).toBe(finding.message);
    expect(row.path).toBe(finding.ref.display);
    expect(row.fix).toBe(finding.fix);
    expect(row.line).toBe(1);
    expect(row.column).toBe(4);
    expect(row).not.toHaveProperty("file");
    expect(references.get(row.id)).toEqual({ file: finding.file, line: 0, col: 3, code: "PM012" });
  });
});
