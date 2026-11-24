"use strict";
const path = require("node:path");
const { jsonRef } = require("../references/create-reference");
function literal(value) {
  return typeof value === "string" && /^\.\.?(?:\/|$)/.test(value) && !/[$\\{}*?\[\]\r\n]/.test(value);
}
function configPath(c,node,ctx,base,code,label,kind="any") {
  if (node?.type !== "string") return null;
  const m = /^\$\{(workspaceFolder|workspaceRoot)(?::([^}]+))?\}(\/[^$\\{}*?\[\]\r\n]*)?$/.exec(node.value);
  if (!m && !literal(node.value)) return null;
  if (m?.[2]) {
    const root = ctx.roots.find(r=>r.name===m[2]);
    if (!root) return null;
    base=root.path;
  }
  const ref=jsonRef(c,node,{base,code,label,kind,fmt:m?"wsvar":"rel"});
  if(m) {
    ref.varPrefix=m[0].slice(0,m[0].indexOf("}")+1);
    ref.value=(m[3]||"").replace(/^\/+/,"")||".";
    ref.lead="";
  }
  return ref;
}
module.exports={literal,configPath};
