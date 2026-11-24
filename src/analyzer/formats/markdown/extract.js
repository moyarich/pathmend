"use strict";
const path = require("node:path");
const { posOf } = require("../../utils/text-position");
const { mkRef } = require("../../references/create-reference");
const { TS_MODULE_ALTS } = require("../../references/module-alternatives");
const { extractMarkdownPaths } = require("./scanner");

function extractMarkdown(c, settings) {
  const codes = { markdown: "PM012", module: "PM013", jsx: "PM014", directive: "PM015" };
  return extractMarkdownPaths(c.text, {
    mdx: c.kind === "mdx",
    pathAttributes: settings.mdxPathAttributes,
    directivePathAttributes: settings.directivePathAttributes,
    multiPathAttributes: settings.multiPathAttributes,
  }).map(ref => {
    const p = posOf(c.starts, ref.start);
    const module = ref.type === "module";
    return mkRef({
      file: c.file, line: p.line, col: p.col, endCol: p.col + ref.end - ref.start,
      value: ref.value, base: path.dirname(c.file), code: codes[ref.type],
      label: ref.type + (ref.attribute ? " " + ref.attribute : ""),
      kind: module || ref.type === "directive" || ref.attribute === "src" ? "file" : "any",
      alts: module && !path.extname(ref.value) ? [...TS_MODULE_ALTS, ".md", ".mdx", "/index.mdx"].filter(a => a !== "/package.json") : [],
      escape: "document-path",
    });
  });
}

module.exports = { extractMarkdown };
