import {it,expect} from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import analyzer from "../../../src/analyzer/index.js";
it("resolves task commands from their working directory and checks configured attributes in recognized YAML",()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"pm-config-coverage-"));
 try{
  fs.mkdirSync(path.join(root,"scripts"));
  fs.writeFileSync(path.join(root,"scripts","run.sh"),"");
  const configs=[
   {file:path.join(root,".vscode/tasks.json"),text:JSON.stringify({tasks:[{command:"./run.sh",options:{cwd:"./scripts"}},{command:"./missing.sh",options:{cwd:"./scripts"}}]})},
   {file:path.join(root,".github/workflows/ci.yml"),text:"name: CI\nasset: ./missing.png"},
   {file:path.join(root,"pyproject.toml"),text:'[tool.uv.sources]\nlib = { editable = true, path = "./missing" }'},
  ];
  const result=analyzer.analyze({configs,roots:[{path:root}],guard:analyzer.createGuard(fs,[root]),index:new analyzer.FileIndex(),settings:{yamlPathAttributes:["asset"]}});
  expect(result.findings.filter(f=>f.code==="PM019").map(f=>f.ref.value)).toEqual(["./missing.sh"]);
  expect(result.findings.some(f=>f.code==="PM023")).toBe(true);
  expect(result.findings.some(f=>f.code==="PM022")).toBe(true);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
