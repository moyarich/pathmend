"use strict";
const path = require("node:path");
const { sourceRef, maskComments } = require("../source-path");
const { TS_MODULE_ALTS } = require("../../references/module-alternatives");
const format = {
  id:"javascript", patterns:["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"], order:2,
  rules:{PM018:{name:"script-module-not-found",description:"Static relative script import or export path not found",category:"javascript",tags:["javascript","typescript","imports"],severity:"warning",fixable:true}},
  match({base}) { return /\.(?:[cm]?[jt]s|[jt]sx)$/i.test(base) ? "javascript" : null; },
  extract(c) {
    const text = maskComments(c.text, /\/\*[\s\S]*?\*\/|^[ \t]*\/\/[^\r\n]*/gm);
    const refs = [];
    const re = /^[ \t]*(?:import[ \t]+(?:[\w$*{}, \t]+[ \t]+from[ \t]+)?|export[ \t]+(?:\*(?:[ \t]+as[ \t]+[\w$]+)?|\{[\w$, \t]*\})[ \t]+from[ \t]+)(["'])(\.\.?\/[^"'\\\r\n]+)\1/gm;
    for (const m of text.matchAll(re)) {
      const raw = m[2];
      const alts = path.extname(raw) ? [] : TS_MODULE_ALTS.filter(a => a !== "/package.json");
      const ref = sourceRef(c,m.index+m[0].lastIndexOf(raw),raw,"PM018","Static module path",alts);
      if (ref) refs.push(ref);
    }
    return refs;
  }
};
module.exports = { format };
