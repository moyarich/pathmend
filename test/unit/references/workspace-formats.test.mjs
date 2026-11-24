import {it,expect} from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import analyzer from "../../../src/analyzer/index.js";
it("checks workspace folder paths, membership and local dependency protocols",()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"pm-workspace-"));
 try {
   fs.mkdirSync(path.join(root,"packages","valid"),{recursive:true});
   fs.writeFileSync(path.join(root,"packages","valid","package.json"),"{}");
   fs.mkdirSync(path.join(root,"packages","excluded"),{recursive:true});
   const index=new analyzer.FileIndex();
   index.add(root,"packages/valid/package.json");
   index.add(root,"packages/excluded/readme.md");
   const configs=[
    {file:path.join(root,"demo.code-workspace"),text:JSON.stringify({folders:[{path:"./packages/valid"},{path:"./missing"},{path:"../outside"}]})},
    {file:path.join(root,"pnpm-workspace.yaml"),text:'packages: ["packages/*", "!packages/excluded"]'},
    {file:path.join(root,"package.json"),text:JSON.stringify({workspaces:["packages/*","!packages/excluded"],dependencies:{ok:"file:./packages/valid",missing:"link:./missing",local:"workspace:./missing",named:"workspace:*",remote:"^1.0.0"}})}
   ];
   const result=analyzer.analyze({configs,roots:[{path:root,name:"test"}],guard:analyzer.createGuard(fs,[root]),index});
   expect(result.findings.map(f=>f.code).sort()).toEqual(["PM010","PM024","PM026","PM026"]);
   expect(result.refs.filter(r=>r.code==="PM026").map(r=>r.raw)).toEqual(["./packages/valid","./missing","./missing"]);
 } finally {fs.rmSync(root,{recursive:true,force:true});}
});
