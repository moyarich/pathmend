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

it("exposes manual repair eligibility without inventing a suggestion", () => {
  const base = { file: "/workspace/a.md", line: 0, col: 0, code: "PM012", message: "Missing", fix: null };
  const findings = [{ ...base, ref: { display: "./missing.md", escape: "document-path" } }, { ...base, col: 5, ref: { display: "*.md", escape: "document-path", glob: true } }, { ...base, col: 10, ref: { display: "name", escape: "noedit" } }];
  const rows = createSnapshot(fileGroups(findings, () => "a.md"), "warning", true, true, 1).data.files[0].findings;
  expect(rows.map(row => [row.repairable, row.fix])).toEqual([[true, null], [false, null], [false, null]]);
});
