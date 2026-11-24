"use strict";
const { isUrl, isGlob } = require("../utils/paths");

const RUN_RE =
  /(^|&&|\|\||[;|(`]|\b(?:then|do|else)\s)\s*(?:(?:sudo|exec|time|nohup)\s+)*(?:(bash|sh|zsh|dash|ksh|python3?|node|ruby|perl|pwsh|source|\.)\s+(?:-[A-Za-z-]+\s+)*)?((?:\.\.?\/)?[\w@.+-][^\s;&|()<>`'"]*)/g;
const SCRIPT_EXT = /\.(sh|bash|zsh|py|js|mjs|cjs|ts|rb|pl|ps1)$/;

function runTokens(scalar) {
  const out = [];
  let lines;
  if (scalar.block) lines = scalar.lines;
  else if (scalar.type === "scalar" && !scalar.bad && !scalar.escaped) lines = [{ text: scalar.value, line: scalar.line, col: scalar.col }];
  else return out;
  for (const l of lines) {
    RUN_RE.lastIndex = 0;
    let m;
    while ((m = RUN_RE.exec(l.text))) {
      const interp = m[2];
      let tok = m[3];
      const start = m.index + m[0].length - tok.length;
      tok = tok.replace(/[,:]+$/, "");
      if (!tok || tok.includes("$") || isGlob(tok) || isUrl(tok) || tok.startsWith("-")) continue;
      if (interp) {
        if (!tok.includes("/") && !SCRIPT_EXT.test(tok)) continue;
      } else if (!/^\.\.?\//.test(tok)) continue;
      out.push({ value: tok, line: l.line, col: l.col + start, endCol: l.col + start + tok.length });
    }
  }
  return out;
}

module.exports = { runTokens };
