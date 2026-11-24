import { it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import analyzer from "../../../src/analyzer/index.js";
import validation from "../../../src/analyzer/references/validate-replacement.js";
it("distinguishes live validation outcomes without changing confirmation semantics", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pm-validation-"));
  try {
    fs.writeFileSync(path.join(root, "file.txt"), "");
    fs.mkdirSync(path.join(root, "dir"));
    const guard = analyzer.createGuard(fs, [root]);
    const index = new analyzer.FileIndex();
    const ref = { base: root, kind: "file", fmt: "rel", escape: "json" };
    const check = value => validation.inspectReplacement(ref, value, guard, index);
    expect(check("./file.txt")).toBe("valid");
    expect(check("./missing.txt")).toBe("missing");
    expect(check("./dir")).toBe("wrong-type");
    expect(check("../outside.txt")).toBe("outside-workspace");
    expect(check("https://example.com")).toBe("invalid");
    expect(validation.inspectReplacement({ ...ref, bases: [{dir: path.join(root, "dir"), confine: true}] }, "../file.txt", guard, index)).toBe("outside-context");
    expect(validation.validateReplacement(ref, "./missing.txt", guard, index)).toBe("unverified");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
