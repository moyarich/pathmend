"use strict";
const { sourceRef, maskComments } = require("../source-path");
const format = {
  id:"css", patterns:["**/*.{css,scss}"], order:2,
  rules:{PM016:{name:"stylesheet-path-not-found",description:"Stylesheet asset or import path not found",category:"css",tags:["css","scss","assets"],severity:"warning",fixable:true}},
  match({base}) { return /\.(?:css|scss)$/i.test(base) ? "css" : null; },
  extract(c) {
    const text = maskComments(c.text, /\/\*[\s\S]*?\*\//g);
    const refs = [];
    const re = /\burl\(\s*(?:"([^"\r\n]*)"|'([^'\r\n]*)'|([^\s"'()]+))\s*\)|@import\s+(?:"([^"\r\n]*)"|'([^'\r\n]*)')/gi;
    for (const m of text.matchAll(re)) {
      const raw = m.slice(1).find(v => v !== undefined);
      if (!raw || (m[4] !== undefined || m[5] !== undefined) && c.file.endsWith(".scss") && !/\.[a-z]+$/i.test(raw)) continue;
      const start = m.index + m[0].lastIndexOf(raw);
      const ref = sourceRef(c,start,raw,"PM016","Stylesheet path");
      if (ref) refs.push(ref);
    }
    return refs;
  }
};
module.exports = { format };
