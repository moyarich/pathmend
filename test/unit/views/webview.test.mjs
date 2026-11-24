import { describe, expect, it } from "vitest";
import { filterReferences } from "../../../views/webview/state/filter.js";
import { createViewState } from "../../../views/webview/state/view-state.js";

describe("reference webview", () => {
  it("filters complete messages and source paths without modifying the snapshot", () => {
    const files = [{ path: "docs/page.mdx", findings: [
      { code: "PM013", path: "./Demo.tsx", message: "Module not found" },
      { code: "PM015", path: "./example.css", message: "Directive path not found", fix: "./styles.css" },
    ] }];
    expect(filterReferences(files, " STYLES.CSS ")[0].findings).toEqual([files[0].findings[1]]);
    expect(filterReferences(files, "module")[0].findings).toEqual([files[0].findings[0]]);
    expect(filterReferences(files, "docs/page")).toEqual(files);
    expect(filterReferences(files, "unknown")).toEqual([]);
    expect(files[0].findings).toHaveLength(2);
  });

  it("persists preferences, not snapshots, and temporarily expands filtered groups", () => {
    let saved = { filter: "", collapsed: ["Dockerfile"] };
    const state = createViewState({ load: () => saved, save: value => { saved = value; } });
    expect(state.isExpanded("Dockerfile")).toBe(false);
    state.setFilter("PM003");
    expect(state.isExpanded("Dockerfile")).toBe(true);
    state.setExpanded("Dockerfile", true);
    state.setSnapshot({ revision: 1 });
    expect(saved).toEqual({ filter: "PM003", severity: "all", collapsed: ["Dockerfile"] });
    state.setFilter("");
    expect(state.isExpanded("Dockerfile")).toBe(false);
    state.setExpanded("Dockerfile", true);
    expect(saved.collapsed).toEqual([]);
  });
});


describe("reference type filters", () => {
  it("distinguishes not-checked references from configured diagnostic severity", () => {
    const files = [{ path: "a.md", findings: [
      { code: "PM012", path: "./bad", severity: "information", notChecked: false, fix: "./good" },
      { code: "PM010", path: "../outside", severity: "information", notChecked: true },
    ] }];
    expect(filterReferences(files, "", "broken")[0].findings).toEqual([files[0].findings[0]]);
    expect(filterReferences(files, "", "info")[0].findings).toEqual([files[0].findings[1]]);
    expect(filterReferences(files, "bad", "fixable")[0].findings).toEqual([files[0].findings[0]]);
    expect(filterReferences(files, "outside", "fixable")).toEqual([]);
  });

  it("persists reference type and bulk disclosure preferences", () => {
    let saved = {};
    const state = createViewState({ load: () => saved, save: value => { saved = value; } });
    state.setSnapshot({ files: [{ path: "a.md" }, { path: "b.md" }] });
    state.setSeverity("fixable");
    state.setAllExpanded(false);
    expect(saved.severity).toBe("fixable");
    expect(state.isExpanded("a.md")).toBe(false);
    state.setAllExpanded(true);
    expect(state.isExpanded("b.md")).toBe(true);
  });
});
