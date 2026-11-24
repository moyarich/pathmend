"use strict";
const path=require("node:path");
const {parseJsonc,jget}=require("../../parsers/jsonc");
const {parseYaml,yget,yscalar}=require("../../parsers/yaml");
const {globToRegex}=require("../../utils/glob");
const {within,toPosix}=require("../../utils/paths");
function collectWorkspacePackages(configs){
 const packages=[],groups=new Map();
 function set(base,patterns,implicit=false){
   const group=groups.get(base)||{base,patterns:[],implicit:false};
   group.patterns.push(...patterns.filter(p=>typeof p==="string"&&p.length));
   group.implicit ||= implicit;
   groups.set(base,group);
 }
 for(const c of configs){
   const base=path.dirname(c.file);
   if(c.format.id==="package-json"){
     const tree=parseJsonc(c.text),name=jget(tree,"name");
     if(name?.type==="string"&&name.value)packages.push({base,name:name.value});
     let ws=jget(tree,"workspaces");
     if(ws?.type==="object")ws=jget(ws,"packages");
     if(ws?.type==="array")set(base,ws.items.filter(n=>n.type==="string").map(n=>n.value));
   }else if(c.format.id==="pnpm-workspace"){
     for(const doc of parseYaml(c.text)){
       const ws=yget(doc,"packages");
       set(base,(ws?.items||[]).map(yscalar).filter(Boolean).map(n=>n.value),!ws);
     }
   }
 }
 const scopes=[...groups.values()].map(g=>{
   const includes=g.patterns.filter(p=>!p.startsWith("!")).map(p=>globToRegex(p.replace(/^\.\//,"").replace(/\/$/,""))).filter(Boolean);
   const excludes=g.patterns.filter(p=>p.startsWith("!")).map(p=>globToRegex(p.slice(1).replace(/^\.\//,"").replace(/\/$/,""))).filter(Boolean);
   const members=packages.filter(p=>{
     if(!within(p.base,g.base))return false;
     const rel=toPosix(path.relative(g.base,p.base));
     return !rel||(!excludes.some(re=>re.test(rel)||re.test(rel+"/"))&&(g.implicit||includes.some(re=>re.test(rel)||re.test(rel+"/"))));
   });
   return {...g,members};
 }).sort((a,b)=>b.base.length-a.base.length);
 return {
   scopeFor(base){return scopes.find(g=>g.base===base||g.members.some(p=>p.base===base));},
   resolve(base,name){const scope=this.scopeFor(base);return scope?scope.members.filter(p=>p.name===name):null;}
 };
}
module.exports={collectWorkspacePackages};
