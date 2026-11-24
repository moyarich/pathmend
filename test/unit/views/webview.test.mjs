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
    state.setSnapshot({ files: [{ path: "a.md", findings: [{ fix: "./a" }] }, { path: "b.md", findings: [{ fix: "./b" }] }] });
    state.setSeverity("fixable");
    state.setAllExpanded(false);
    expect(saved.severity).toBe("fixable");
    expect(state.isExpanded("a.md")).toBe(false);
    state.setAllExpanded(true);
    expect(state.isExpanded("b.md")).toBe(true);
  });
});


it("toggles visible file groups and reflects manual disclosure changes", () => {
  const state = createViewState({ load: () => ({}), save: () => {} });
  state.setSnapshot({ enabled: true, hasWorkspace: true, files: [
    { path: "a.md", findings: [{ fix: "./a" }] },
    { path: "b.md", findings: [{ notChecked: true }] },
  ] });
  expect(state.groupDisclosure).toEqual({ canToggle: true, allExpanded: true });
  state.toggleGroups();
  expect(state.isExpanded("a.md")).toBe(false);
  expect(state.isExpanded("b.md")).toBe(false);
  state.setExpanded("a.md", true);
  expect(state.groupDisclosure.allExpanded).toBe(false);
  state.toggleGroups();
  expect(state.groupDisclosure.allExpanded).toBe(true);
  state.setSeverity("fixable");
  state.toggleGroups();
  expect(state.isExpanded("a.md")).toBe(false);
  expect(state.isExpanded("b.md")).toBe(true);
  state.setFilter("a");
  expect(state.groupDisclosure.canToggle).toBe(false);
});

it("filters by type, rule and active file, then sorts without mutating input", () => {
  const files = [{path:"a.md",findings:[{code:"PM012",severity:"warning"}]}, {path:"b.json",findings:[{code:"PM001",severity:"error"},{code:"PM001",severity:"error"}]}];
  expect(filterReferences(files,"","all",{fileType:"md",rule:"PM012"})).toEqual([files[0]]);
  expect(filterReferences(files,"","all",{currentOnly:true,currentFile:"b.json"})).toEqual([files[1]]);
  expect(filterReferences(files,"","all",{sort:"count"})).toEqual([files[1],files[0]]);
  expect(filterReferences(files,"","all",{sort:"severity"})).toEqual([files[1],files[0]]);
});
