"use strict";
const path = require("node:path");
const { sourceRef } = require("../source-path");
const { declarations } = require("./scanner");
const { TS_MODULE_ALTS } = require("../../references/module-alternatives");
const format = {
  cacheable:true,
  id:"javascript", patterns:["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"], order:2,
  rules:{PM018:{name:"script-module-not-found",description:"Static relative script import or export path not found",category:"javascript",tags:["javascript","typescript","imports"],severity:"warning",fixable:true}},
  match({base}) { return /\.(?:[cm]?[jt]s|[jt]sx)$/i.test(base) ? "javascript" : null; },
  extract(c) {
    const refs = [];
    for (const m of declarations(c.text)) {
      const raw = m.value;
      const alts = path.extname(raw) ? [] : TS_MODULE_ALTS.filter(a => a !== "/package.json");
      const ref = sourceRef(c,m.start,raw,"PM018","Static module path",alts);
      if (ref) refs.push(ref);
    }
    return refs;
  }
};
module.exports = { format };
