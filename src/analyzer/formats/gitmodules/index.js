"use strict";
const path=require("node:path");
const {mkRef}=require("../../references/create-reference");
const format={
 id:"gitmodules",patterns:["**/.gitmodules"],order:2,
 rules:{PM021:{name:"gitmodule-path-not-found",description:"Git submodule checkout path not found",category:"git",tags:["git","submodule"],severity:"warning",fixable:false}},
 match({base}){return base===".gitmodules"?"gitmodules":null;},
 extract(c){
   let section=false;
   const out=[];
   for(let line=0;line<c.lines.length;line++){
     const text=c.lines[line];
     if(/^\s*\[/.test(text)){section=/^\s*\[submodule\s+"[^"]+"\]\s*$/.test(text);continue;}
     if(!section)continue;
     const m=/^\s*path\s*=\s*(?:"([^"\\\r\n]+)"|([^\s#;]+))\s*(?:[#;].*)?$/.exec(text);
     const value=m?.[1]??m?.[2];
     if(!value||/^(?:\/|[a-z]:)/i.test(value)||/[$\\{}*?\[\]]/.test(value))continue;
     const col=text.indexOf(value,text.indexOf("=")+1);
     out.push(mkRef({file:c.file,line,col,endCol:col+value.length,value,base:path.dirname(c.file),code:"PM021",label:"gitmodules checkout path",kind:"dir",escape:"noedit"}));
   }
   return out;
 }
};
module.exports={format};
