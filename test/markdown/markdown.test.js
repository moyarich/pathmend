import { describe, expect, it } from "vitest";
import scanner from "../../markdown.js";
import core from "../../core.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const { extractMarkdownPaths } = scanner;

describe("Markdown/MDX scanner", () => {
  it("extracts exact local path ranges and skips non-file references", () => {
    const text = [
      "---", 'image: "./ignored.png"', "---",
      "[Guide](./guide.md#section)", "![Image](<./my image.png>)",
      "[ref]: ./guide.md", "[External](https://example.com)",
      "[Route](/docs/guide)", "[Anchor](#section)",
      "import Demo from './Demo.tsx'", "import './example.css'",
      'export { Demo } from "./Demo"',
      '<img src={"./image.png"} />', '<img src={dynamic} />',
      '::::code-preview[Demo]{component="./Demo.tsx"}',
      '::code-preview-sources{files="./Demo.tsx, ./example.css"}',
      "~~~~mdx", "import X from './ignored.tsx'", "~~~~",
      "    [Indented](./ignored.md)",
      "<!-- [Comment](./ignored.md) -->",
      "{/* [Comment](./ignored.md) */}",
      "\x60[Inline](./ignored.md)\x60",
    ].join("\n");
    const refs = extractMarkdownPaths(text, { mdx: true });
    expect(refs.map(r => [r.type, r.value])).toEqual([
      ["markdown", "./guide.md"], ["markdown", "./my image.png"],
      ["markdown", "./guide.md"], ["module", "./Demo.tsx"],
      ["module", "./example.css"], ["module", "./Demo"],
      ["jsx", "./image.png"], ["directive", "./Demo.tsx"],
      ["directive", "./Demo.tsx"], ["directive", "./example.css"],
    ]);
    for (const r of refs) expect(text.slice(r.start, r.end)).toBe(r.value);
    expect(extractMarkdownPaths("import X from './x.js'")).toEqual([]);
  });

  it("uses existing guard, diagnostics, aliases and rename planning", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "pathmend-mdx-"));
    try {
      const file = path.join(root, "page.mdx");
      const target = path.join(root, "guide.md");
      fs.writeFileSync(target, "# Guide");
      fs.writeFileSync(path.join(root, "Demo.tsx"), "");
      const text = '[Guide](./guide.md#intro)\nimport Demo from "./Demo"\n![Missing](./missing.png)\n<img src="./missing.png" />\n::preview{component="./missing.tsx"}';
      const opts = { configs: [{ file, text }], roots: [{ path: root, name: "test" }],
        guard: core.createGuard(fs, [root]), index: new core.FileIndex() };
      const { findings, refs } = core.analyze(opts);
      expect(findings.map(f => f.code)).toEqual(["PM012", "PM014", "PM015"]);
      expect(core.analyze({ ...opts, settings: { disabledRules: ["markdown-path-not-found"] } }).findings.map(f => f.code)).toEqual(["PM014", "PM015"]);
      const plan = core.planRenames(refs, [{ from: target, to: path.join(root, "new.md") }], () => true);
      expect(plan).toHaveLength(1);
      expect(plan[0].newText).toBe("./new.md");
      expect(plan[0].ref.raw).toBe("./guide.md");
      expect(core.encodeFor(plan[0].ref, "./new name.md")).toBeNull();
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
  it("rebases outgoing paths and edits incoming links at their post-move locations", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "pathmend-move-"));
    try {
      const docs = path.join(root, "docs");
      fs.mkdirSync(docs);
      const page = path.join(docs, "page.mdx");
      const guide = path.join(docs, "guide.md");
      const demo = path.join(docs, "Demo.tsx");
      const readme = path.join(root, "README.md");
      fs.writeFileSync(page, "");
      fs.writeFileSync(guide, "");
      fs.writeFileSync(demo, "");
      const { refs } = core.analyze({
        configs: [
          { file: page, text: '[Guide](./guide.md#intro)\nimport Demo from "./Demo"' },
          { file: readme, text: '[Page](./docs/page.mdx)' },
        ],
        roots: [{ path: root, name: "test" }],
        guard: core.createGuard(fs, [root]), index: new core.FileIndex(),
      });
      const destination = path.join(root, "archive", "nested", "page.mdx");
      const inside = p => core.within(p, root);
      const plan = core.planRenames(refs, [{ from: page, to: destination }], inside);
      expect(plan.map(p => [p.file, p.newText])).toEqual([
        [destination, "../../docs/guide.md"],
        [destination, "../../docs/Demo"],
        [readme, "./archive/nested/page.mdx"],
      ]);
      expect(plan[0].ref.raw).toBe("./guide.md");
      const folder = path.join(root, "archive");
      const folderPlan = core.planRenames(refs, [{ from: docs, to: folder }], inside);
      expect(folderPlan.map(p => p.newText)).toEqual(["./archive/page.mdx"]);
      const combined = core.planRenames(refs, [
        { from: page, to: destination },
        { from: guide, to: path.join(root, "archive", "guide.md") },
      ], inside);
      expect(combined[0].newText).toBe("../guide.md");
      expect(core.planRenames(refs, [{ from: page, to: path.join(root, "..", "outside.mdx") }], inside)).toEqual([]);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
});
