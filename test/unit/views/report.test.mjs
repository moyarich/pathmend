import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { icons } from "../../../views/webview/icons/geometry.js";
const require = createRequire(import.meta.url);
const { createReport } = require("../../../views/report");

describe("diagnostic export", () => {
  it("exports complete diagnostics and counts without transient IDs", () => {
    const groups = [{ rel: "docs/a.md", findings: [
      { file: "/workspace/docs/a.md", code: "PM012", line: 0, col: 2, ref: { display: "./missing" }, message: "Path missing", fix: "./present" },
      { file: "/workspace/docs/a.md", code: "PM010", line: 1, col: 0, ref: { display: "../outside" }, message: "Not checked", info: true },
    ] }];
    const report = createReport(groups, "warning", true, true);
    expect(report.summary).toEqual({ files: 1, total: 2, broken: 1, notChecked: 1, fixable: 1 });
    expect(report.files[0].findings[0]).toMatchObject({ code: "PM012", line: 1, column: 3, message: "Path missing", fix: "./present" });
    expect(report.files[0].findings[0]).not.toHaveProperty("id");
    expect(report.files[0].findings[0]).not.toHaveProperty("file");
    expect(createReport([], "warning", false, true).summary.total).toBe(0);
  });
  it("registers only local SVG geometry", () => {
    for (const shapes of Object.values(icons)) {
      for (const [tag, attributes] of shapes) {
        expect(["path", "circle"]).toContain(tag);
        expect(Object.keys(attributes).every(key => ["d", "cx", "cy", "r"].includes(key))).toBe(true);
      }
    }
  });
});
