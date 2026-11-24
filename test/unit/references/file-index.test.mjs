import { it, expect } from "vitest";
import path from "node:path";
import analyzer from "../../../src/analyzer/index.js";
it("enumerates files and directories separately for path selection", () => {
  const index = new analyzer.FileIndex();
  const root = path.resolve("workspace");
  index.add(root, "docs/readme.md");
  expect([...index.paths("file")]).toEqual([path.join(root, "docs/readme.md")]);
  expect([...index.paths("dir")]).toEqual([path.join(root, "docs")]);
});
