"use strict";
const { sourceRef, maskComments } = require("../source-path");
const format = {
  cacheable:true,
  id:"html", patterns:["**/*.{html,htm}"], order:2,
  rules:{PM017:{name:"html-path-not-found",description:"HTML local resource path not found",category:"html",tags:["html","assets"],severity:"warning",fixable:true}},
  match({base}) { return /\.html?$/i.test(base) ? "html" : null; },
  extract(c) {
    const comments = maskComments(c.text, /<!--[\s\S]*?-->/g);
    const text = comments.replace(/(<(script|style)\b[^>]*>)([\s\S]*?)(<\/\2\s*>)/gi, (_,open,tag,body,close)=>open+body.replace(/[^\r\n]/g," ")+close);
    const refs = [];
    for (const tag of text.matchAll(/<[a-z][\w:-]*(?:\s+(?:"[^"]*"|'[^']*'|[^'"<>])*)?\/?>/gi)) {
      for (const m of tag[0].matchAll(/\s([\w:-]+)\s*=\s*(?:"([^"\r\n]*)"|'([^'\r\n]*)'|([^\s>]+))/gi)) {
        if (!/^(src|href|srcset)$/i.test(m[1])) continue;
        const raw = m[2] ?? m[3] ?? m[4];
        if (!raw || /(?:^|,)\s*data:|\{\{/i.test(raw)) continue;
        const offset = tag.index + m.index + m[0].indexOf(raw, m[0].indexOf("="));
        const parts = m[1].toLowerCase() === "srcset" ? [...raw.matchAll(/(?:^|,)\s*([^\s,]+)(?:\s+\d+(?:\.\d+)?[wx])?\s*(?=,|$)/g)] : null;
        for (const item of parts || [{0:raw,1:raw,index:0}]) {
          const value = item[1];
          // Bare extensionless links may be application routes rather than files.
          if (!/^\.{1,2}\//.test(value) && !/\.[a-z0-9]+(?:[?#]|$)/i.test(value)) continue;
          const ref = sourceRef(c,offset+item.index+item[0].indexOf(value),value,"PM017","HTML "+m[1]);
          if (ref) refs.push(ref);
        }
      }
    }
    return refs;
  }
};
module.exports = { format };
