"use strict";
const path=require("node:path");
const {parseJsonc,jget}=require("../../parsers/jsonc");
const {jsonRef}=require("../../references/create-reference");
const format={
 id:"devcontainer",patterns:["**/.devcontainer.json","**/.devcontainer/**/devcontainer.json"],order:2,
 rules:{PM020:{name:"devcontainer-path-not-found",description:"Dev container local configuration path not found",category:"devcontainer",tags:["devcontainer","docker"],severity:"warning",fixable:true}},
 match({base,parts}){return base===".devcontainer.json"||base==="devcontainer.json"&&parts.includes(".devcontainer")?"devcontainer":null;},
 extract(c){
   const root=parseJsonc(c.text),base=path.dirname(c.file),out=[];
   const add=(node,label,kind)=>{
     if(node?.type!=="string"||!node.value||/^(?:\/|[a-z][a-z0-9+.-]*:|~)/i.test(node.value)||/[$\\{}*?\[\]\r\n]/.test(node.value))return;
     out.push(jsonRef(c,node,{base,code:"PM020",label,kind}));
   };
   const build=jget(root,"build");
   add(jget(root,"dockerFile"),"devcontainer dockerFile","file");
   add(jget(build,"dockerfile"),"devcontainer build.dockerfile","file");
   add(jget(build,"context"),"devcontainer build.context","dir");
   const compose=jget(root,"dockerComposeFile");
   for(const node of compose?.type==="array"?compose.items:[compose])add(node,"devcontainer dockerComposeFile","file");
   return out;
 }
};
module.exports={format};
