"use strict";
const path = require("node:path");

function toPosix(p) {
  return p.split(path.sep).join("/");
}

function within(p, base) {
  const rel = path.relative(base, p);
  return rel === "" || (rel !== ".." && !rel.startsWith(".." + path.sep) && !path.isAbsolute(rel));
}

function isUrl(v) {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(v) || /^git@/.test(v) || /^(docker|data|npm|workspace|link|file):/i.test(v);
}

const GLOB_CHARS = /[*?[\]{}]/;

function isGlob(v) {
  return GLOB_CHARS.test(v);
}

function hasControl(v) {
  return /[\u0000-\u001f\u007f]/.test(v);
}

module.exports = { toPosix, within, isUrl, isGlob, hasControl };
