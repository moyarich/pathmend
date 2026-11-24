import {it,expect} from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import analyzer from "../../../src/analyzer/index.js";
it("checks named dependencies within declared membership and detects duplicates",()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"pm-names-"));
 try{
  const configs=[];
  const add=(file,value)=>{const abs=path.join(root,file);fs.mkdirSync(path.dirname(abs),{recursive:true});const text=JSON.stringify(value);fs.writeFileSync(abs,text);configs.push({file:abs,text});};
  add("package.json",{name:"root",workspaces:["packages/*","!packages/excluded"]});
  add("packages/app/package.json",{name:"app",dependencies:{lib:"workspace:*",missing:"workspace:^",excluded:"workspace:~",alias:"workspace:lib@*"}});
  add("packages/lib/package.json",{name:"lib"});
  add("packages/excluded/package.json",{name:"excluded"});
  const index=new analyzer.FileIndex();const run=()=>analyzer.analyze({configs,roots:[{path:root}],guard:analyzer.createGuard(fs,[root]),index});
  expect(run().findings.filter(f=>f.code==="PM027")).toHaveLength(2);
  add("packages/duplicate/package.json",{name:"lib"});
  expect(run().findings.filter(f=>f.code==="PM028").length).toBeGreaterThanOrEqual(2);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
