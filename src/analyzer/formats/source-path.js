"use strict";
const path = require("node:path");
const { posOf } = require("../utils/text-position");
const { mkRef } = require("../references/create-reference");
function sourceRef(c, start, raw, code, label, alts = []) {
  const value = raw.split(/[?#]/, 1)[0];
  if (!value || /[\s\\{}<>%&*[\]]/.test(value) || /^(?:[a-z][a-z0-9+.-]*:|\/|#|\?|@|~)/i.test(value)) return null;
  const p = posOf(c.starts, start);
  return mkRef({file:c.file,line:p.line,col:p.col,endCol:p.col+value.length,value,base:path.dirname(c.file),code,label,kind:"file",alts,escape:"document-path"});
}
function maskComments(text, regex) {
  return text.replace(regex, m => m.replace(/[^\r\n]/g, " "));
}
module.exports = { sourceRef, maskComments };
