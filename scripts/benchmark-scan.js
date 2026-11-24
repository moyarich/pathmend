"use strict";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { performance } = require("node:perf_hooks");
const analyzer = require("../src/analyzer");
const { createExtractionCache } = require("../src/analyzer/formats/extraction-cache");
const count = Number(process.argv[2] || 2000);
if (!Number.isSafeInteger(count) || count < 1 || count > 20000) throw new Error("Choose 1–20000 documents");
const root = fs.mkdtempSync(path.join(os.tmpdir(),"pm-bench-"));
try {
  fs.writeFileSync(path.join(root,"target.md"),"");
  const configs = Array.from({length:count},(_,i)=>({file:path.join(root,"doc"+i+".md"),text:Array.from({length:20},()=>"[Link](./target.md)").join("\n")}));
  const cache = createExtractionCache();
  function measure(label, extractionCache) {
    const start = performance.now();
    const result = analyzer.analyze({configs,roots:[{path:root}],guard:analyzer.createGuard(fs,[root]),index:new analyzer.FileIndex(),extractionCache});
    console.log(JSON.stringify({label,documents:count,references:result.refs.length,findings:result.findings.length,ms:Math.round(performance.now()-start),...result.extractionStats}));
    if (result.findings.length || result.refs.length !== count*20) throw new Error("Unexpected diagnostics");
  }
  measure("uncached");
  measure("cold",cache);
  measure("warm",cache);
  configs[0].text = configs[0].text.replace("[Link]","[Updated]");
  measure("one edit",cache);
} finally { fs.rmSync(root,{recursive:true,force:true}); }
