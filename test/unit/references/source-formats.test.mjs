import { it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import analyzer from "../../../src/analyzer/index.js";
it("reports static source references and preserves source ranges", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),"pm-source-"));
  try {
    const configs = [
      {file:path.join(root,"style.css"),text:'/* url(ignored.png) */\n.a { background:url("./missing.png#x"); }'},
      {file:path.join(root,"page.html"),text:'<!-- <img src="ignored.png"> --><img srcset="./one.png 1x, ./two.png 2x">'},
      {file:path.join(root,"main.ts"),text:'// import "./ignored"\nimport x from "./missing";\nimport("dynamic");'},
    ];
    const result = analyzer.analyze({configs,roots:[{path:root,name:"test"}],guard:analyzer.createGuard(fs,[root]),index:new analyzer.FileIndex()});
    expect(result.findings.map(f=>f.code)).toEqual(["PM016","PM017","PM017","PM018"]);
    expect(result.refs.map(r=>r.raw)).toEqual(["./missing.png","./one.png","./two.png","./missing"]);
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});
