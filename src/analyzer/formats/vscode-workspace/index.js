"use strict";
const path = require("node:path");
const {parseJsonc,jget} = require("../../parsers/jsonc");
const {jsonRef} = require("../../references/create-reference");
const {configPath} = require("../config-path");
const format = {
  id:"vscode-workspace", patterns:["**/*.code-workspace"], order:2,
  rules:{PM024:{name:"workspace-folder-path-not-found",description:"VS Code workspace folder or configuration path not found",category:"editor",tags:["vscode","workspace"],severity:"warning",fixable:true}},
  match({base}) { return /\.code-workspace$/i.test(base)?"vscode-workspace":null; },
  extract(c,ctx) {
    const tree = parseJsonc(c.text), base = path.dirname(c.file), out=[];
    for(const folder of jget(tree,"folders")?.items||[]) {
      const node=jget(folder,"path");
      if(node?.type!=="string"||!node.value||/[$\r\n{}*?]/.test(node.value)||/^[a-z][a-z0-9+.-]*:\/\//i.test(node.value))continue;
      out.push(jsonRef(c,node,{base,code:"PM024",label:"Workspace folder",kind:"dir"}));
    }
    // Unqualified paths in a multi-root workspace are ambiguous.
    const rootBase=ctx.roots.length===1?ctx.roots[0].path:null;
    function add(node,label,kind){
      if(!rootBase&&!/^\$\{workspace(?:Folder|Root):[^}]+\}/.test(node?.value||""))return;
      const ref=configPath(c,node,ctx,rootBase||base,"PM024",label,kind);
      if(ref)out.push(ref);
    }
    for(const conf of jget(jget(tree,"launch"),"configurations")?.items||[]){
      add(jget(conf,"program"),"Workspace launch program","file");
      add(jget(conf,"cwd"),"Workspace launch cwd","dir");
    }
    for(const task of jget(jget(tree,"tasks"),"tasks")?.items||[]){
      const cwd=jget(jget(task,"options"),"cwd");
      add(cwd,"Workspace task cwd","dir");
      const command=jget(task,"command");
      if(!cwd||/^\$\{workspace/.test(command?.value||""))add(command,"Workspace task command","file");
    }
    return out;
  }
};
module.exports={format};
