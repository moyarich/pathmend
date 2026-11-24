import { it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import analyzer from "../../../src/analyzer/index.js";
import cacheModule from "../../../src/analyzer/formats/extraction-cache.js";
it("reuses unchanged extraction but rechecks targets, source edits, settings and deletions", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),"pm-cache-"));
  try {
    const cache = cacheModule.createExtractionCache();
    const file = path.join(root,"guide.md");
    let configs = [{file,text:"[Link](./missing.md)"}];
    const run = (settings = {}) => analyzer.analyze({configs,settings,roots:[{path:root}],guard:analyzer.createGuard(fs,[root]),index:new analyzer.FileIndex(),extractionCache:cache});
    const first = run();
    expect(first.findings).toHaveLength(1);
    expect(first.extractionStats.misses).toBe(1);
    fs.writeFileSync(path.join(root,"missing.md"),"");
    const warm = run();
    expect(warm.findings).toHaveLength(0);
    expect(warm.extractionStats.hits).toBe(1);
    expect(first.refs[0].result.state).toBe("missing");
    configs = [{file,text:"[Link](./other.md)"}];
    expect(run().extractionStats.misses).toBe(1);
    expect(run({disabledRules:["PM012"]}).findings).toHaveLength(0);
    configs = [];
    expect(run().extractionStats.entries).toBe(0);
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});
