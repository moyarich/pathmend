"use strict";
const path=require("node:path");
const {parseYaml,yget,yscalar}=require("../../parsers/yaml");
const {yamlRef}=require("../../references/create-reference");
const {isGlob}=require("../../utils/paths");
const format={
 id:"pnpm-workspace",patterns:["**/pnpm-workspace.yaml"],order:2,
 rules:{PM025:{name:"pnpm-workspace-path-not-found",description:"pnpm workspace package path not found",category:"package",tags:["pnpm","workspace"],severity:"warning",fixable:true}},
 match({base}){return base==="pnpm-workspace.yaml"?"pnpm-workspace":null;},
 extract(c){
   const out=[];
   for(const doc of parseYaml(c.text)){
     const list=(yget(doc,"packages")?.items||[]).map(yscalar).filter(Boolean);
     const exclusions=list.filter(s=>s.value.startsWith("!")).map(s=>s.value.slice(1));
     for(const s of list){
       if(!s.value||s.value.startsWith("!")||/^(?:\/|[a-z][a-z0-9+.-]*:)/i.test(s.value)||/[$\\\r\n]/.test(s.value))continue;
       const glob=isGlob(s.value);
       out.push(yamlRef(c,s,{base:path.dirname(c.file),code:"PM025",label:"pnpm workspace package",kind:"dir",glob:glob?"std":false,needFileIn:["package.json"],workspaceExclusions:exclusions,...(glob?{escape:"noedit"}:{})}));
     }
   }
   return out;
 }
};
module.exports={format};
