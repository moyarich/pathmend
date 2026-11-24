"use strict";
const path=require("node:path");
const {parseJsonc,jget}=require("../../parsers/jsonc");
const {configPath}=require("../config-path");
const format={
 id:"tasks-json",patterns:["**/.vscode/tasks.json"],order:2,
 rules:{PM019:{name:"task-path-not-found",description:"VS Code task local path not found",category:"editor",tags:["vscode","tasks"],severity:"warning",fixable:true}},
 match({base,parent}){return base==="tasks.json"&&parent===".vscode"?"tasks":null;},
 extract(c,ctx){
   const tree=parseJsonc(c.text),base=path.dirname(path.dirname(c.file)),out=[];
   const visit=task=>{
     const options=jget(task,"options");
     const cwd=jget(options,"cwd");
     const ref=configPath(c,cwd,ctx,base,"PM019","tasks.json cwd","dir");
     if(ref)out.push(ref);
     // A command without an explicit path is an executable on PATH, not a file reference.
     const command=jget(task,"command");
     if(!cwd || cwd.type!=="string"){
       const r=configPath(c,command,ctx,base,"PM019","tasks.json command","file");
       if(r)out.push(r);
     } else if(command?.value?.startsWith("${workspace")){
       const r=configPath(c,command,ctx,base,"PM019","tasks.json command","file");
       if(r)out.push(r);
     }
   };
   visit(tree);
   for(const task of jget(tree,"tasks")?.items||[])visit(task);
   return out;
 }
};
module.exports={format};
