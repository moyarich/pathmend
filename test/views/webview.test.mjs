import { describe, expect, it } from "vitest";
import { filterReferences } from "../../views/webview/filter.js";
import { createViewState } from "../../views/webview/state.js";

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
    expect(saved).toEqual({ filter: "PM003", collapsed: ["Dockerfile"] });
    state.setFilter("");
    expect(state.isExpanded("Dockerfile")).toBe(false);
    state.setExpanded("Dockerfile", true);
    expect(saved.collapsed).toEqual([]);
  });
});
