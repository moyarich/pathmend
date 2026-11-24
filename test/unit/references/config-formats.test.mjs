import { it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import analyzer from "../../../src/analyzer/index.js";
it("checks static config paths and ignores dynamic or remote inputs",()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"pm-config-"));
 try{
 const fixtures=[
 [".vscode/tasks.json",JSON.stringify({tasks:[{command:"npm",options:{cwd:"${workspaceFolder}/missing"}},{command:"./run.sh"}]})],
 [".devcontainer/devcontainer.json",JSON.stringify({build:{dockerfile:"Dockerfile",context:"../missing"},dockerComposeFile:["compose.yml"]})],
 [".gitmodules",'[submodule "demo"]\n path = vendor/demo\n url = https://example.com/demo'],
 ["pyproject.toml",'[tool.poetry.dependencies]\n demo = { path = "../missing", develop = true }\n other = "1.0"'],
 ["custom.yaml",'asset: ./missing.txt\nother: ./ignored.txt\nassets: [./one.txt, ./two.txt]\nremote: https://example.com'],
 ];
 const configs=fixtures.map(([file,text])=>({file:path.join(root,file),text}));
 const result=analyzer.analyze({configs,roots:[{path:root,name:"test"}],guard:analyzer.createGuard(fs,[root]),index:new analyzer.FileIndex(),settings:{yamlPathAttributes:["asset","assets","remote"]}});
 expect(result.refs.map(r=>r.code)).toEqual(["PM019","PM019","PM020","PM020","PM020","PM021","PM022","PM023","PM023","PM023"]);
 expect(result.refs.map(r=>r.raw)).toContain("${workspaceFolder}/missing");
 expect(result.refs.map(r=>r.raw)).not.toContain("./ignored.txt");
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
