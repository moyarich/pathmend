"use strict";
const fs=require("node:fs");
const path=require("node:path");
const analyzer=require("../analyzer");
const {fileGroups}=require("../../views/model");
const {createReport}=require("../../views/report");
const defaults={
 exclude:["**/node_modules/**","**/.git/**","**/dist/**"],
 ignoreReferences:["**/build/**","**/out/**","**/coverage/**","**/target/**","**/.next/**"],
 maxIndexedFiles:20000,maxFileSizeKB:512,severity:"warning",reportOutside:true
};
function scanWorkspace(root,settings={}){
 const cfg={...defaults,...settings};
 root=fs.realpathSync(root);
 if(!fs.statSync(root).isDirectory())throw new Error("Workspace must be a directory");
 const roots=[{path:root,name:path.basename(root)}],guard=analyzer.createGuard(fs,[root]),index=new analyzer.FileIndex(),configs=[];
 const excluded=analyzer.makeMatcher(cfg.exclude);
 const maxBytes=cfg.maxFileSizeKB*1024;
 // Do not follow directory symlinks. All content reads go through the shared guard.
 const stack=[root];
 while(stack.length){
   const dir=stack.pop();
   const entries=fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0);
   for(const entry of entries){
     const file=path.join(dir,entry.name),rel=analyzer.toPosix(path.relative(root,file));
     if(excluded(rel)||excluded(rel+"/")||entry.isSymbolicLink())continue;
     if(entry.isDirectory()){if(guard.status(file).state==="dir")stack.push(file);continue;}
     if(!entry.isFile()||guard.status(file).state!=="file")continue;
     if(index.roots.get(root)?.files.size>=cfg.maxIndexedFiles)index.truncated=true;
     else index.add(root,rel);
     if(analyzer.classify(file)){
       const read=guard.readText(file,maxBytes);
       if(typeof read.text==="string")configs.push({file,text:read.text});
     }
   }
 }
 configs.sort((a,b)=>a.file<b.file?-1:a.file>b.file?1:0);
 const result=analyzer.analyze({configs,roots,guard,index,settings:cfg});
 return createReport(fileGroups(result.findings,file=>analyzer.toPosix(path.relative(root,file))),cfg.severity,true,true);
}
module.exports={scanWorkspace,defaults};
