"use strict";
const path=require("node:path");
const {mkRef}=require("../../references/create-reference");
const format={
 id:"pyproject",patterns:["**/pyproject.toml"],order:2,
 rules:{PM022:{name:"python-dependency-path-not-found",description:"Python local dependency path not found",category:"python",tags:["python","pyproject"],severity:"warning",fixable:true}},
 match({base}){return base==="pyproject.toml"?"pyproject":null;},
 extract(c){
   const out=[];
   let section="";
   for(let line=0;line<c.lines.length;line++){
     const text=c.lines[line];
     const header=/^\s*\[([^\[\]]+)\]\s*(?:#.*)?$/.exec(text);
     if(header){section=header[1];continue;}
     if(!/^tool\.(?:poetry\.(?:dependencies|dev-dependencies|group\.[^.]+\.dependencies)|uv\.sources)$/.test(section))continue;
     const m=/^\s*[\w.-]+\s*=\s*\{\s*path\s*=\s*(["'])([^"'\\\r\n]+)\1(?:\s*,[^}#\r\n]+)?\s*\}\s*(?:#.*)?$/.exec(text);
     if(!m||!m[2]||/^(?:\/|[a-z][a-z0-9+.-]*:|~)/i.test(m[2])||/[$\\{}*?\[\]]/.test(m[2]))continue;
     const col=text.indexOf(m[2],text.indexOf("path",text.indexOf("{")));
     out.push(mkRef({file:c.file,line,col,endCol:col+m[2].length,value:m[2],base:path.dirname(c.file),code:"PM022",label:"Python local dependency",kind:"any",escape:"document-path"}));
   }
   return out;
 }
};
module.exports={format};
