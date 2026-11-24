import {it,expect} from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import cli from "../../../src/cli/index.js";
it("returns deterministic reports, respects exclusions and uses meaningful exit codes",()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"pm-cli-"));
 try{
  fs.writeFileSync(path.join(root,"guide.md"),"[Missing](./missing.md)");
  fs.mkdirSync(path.join(root,"node_modules"));
  fs.writeFileSync(path.join(root,"node_modules","ignored.md"),"[Ignored](./x)");
  const run=(args=[])=>{let out="",err="";const code=cli.main(["--workspace",root,...args],{stdout:{write:s=>out+=s},stderr:{write:s=>err+=s}});return {code,out,err};};
  const first=run();
  expect(first.code).toBe(1);
  expect(JSON.parse(first.out).summary.total).toBe(1);
  expect(run().out).toBe(first.out);
  expect(JSON.parse(run(["--format","sarif"]).out).version).toBe("2.1.0");
  expect(run(["--format","invalid"]).code).toBe(2);
  fs.writeFileSync(path.join(root,"missing.md"),"");
  expect(run().code).toBe(0);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
