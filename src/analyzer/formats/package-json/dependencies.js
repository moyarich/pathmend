"use strict";
const path=require("node:path");
const {jget}=require("../../parsers/jsonc");
const {jsonRef}=require("../../references/create-reference");
function extractDependencies(c,tree,ctx){
 const out=[];
 const name=jget(tree,"name");
 if(name?.type==="string"&&ctx.workspacePackages.resolve(path.dirname(c.file),name.value)?.length>1)out.push(jsonRef(c,name,{base:path.dirname(c.file),code:"PM028",label:"package.json name",escape:"noedit",workspacePackage:name.value}));
 for(const group of ["dependencies","devDependencies","optionalDependencies","peerDependencies"]){
   for(const p of jget(tree,group)?.props||[]){
     const n=p.value;
     if(n?.type!=="string")continue;
     const m=/^(file:|link:|workspace:)(.+)$/.exec(n.value);
     if(m?.[1]==="workspace:"&&!/^\.\.?\//.test(m[2])) {
       const selector=m[2];
       const alias=/^(@[^/\s]+\/[^@/\s]+|[^@/\s]+)@(?:\*|\^|~|[\d][\w.+~^<>= -]*)$/.exec(selector);
       if(alias||/^(?:\*|\^|~|[\d][\w.+~^<>= -]*|[~^<>=][\d][\w.+~^<>= -]*)$/.test(selector)) {
         const name=alias?.[1]||p.key;
         out.push(jsonRef(c,n,{base:path.dirname(c.file),code:"PM027",label:group+"."+p.key,kind:"dir",escape:"noedit",workspacePackage:name}));
       }
       continue;
     }
     if(!m||!m[2]||/[$\\{}*?\[\]\r\n]/.test(m[2]))continue;
     if(m[1]==="workspace:"&&!/^\.\.?\//.test(m[2]))continue;
     if(/^(?:\/|[a-z][a-z0-9+.-]*:|~)/i.test(m[2]))continue;
     // Preserve the protocol outside the replacement range. Escaped JSON is ambiguous.
     if(c.text.slice(n.start,n.end)!==n.value)continue;
     const local={...n,start:n.start+m[1].length,value:m[2]};
     const tarball=/\.(?:tgz|tar\.gz|tar)$/i.test(local.value);
     out.push(jsonRef(c,local,{base:path.dirname(c.file),code:"PM026",label:group+"."+p.key+" ("+m[1]+")",kind:tarball?"file":"dir",...(tarball?{}:{needFileIn:["package.json"]})}));
   }
 }
 return out;
}
module.exports={extractDependencies};
