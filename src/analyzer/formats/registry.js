"use strict";
const formats = Object.freeze([
  require("./markdown").format,
  require("./css").format,
  require("./html").format,
  require("./javascript").format,
  require("./package-json").format,
  require("./tsconfig").format,
  require("./dockerfile").format,
  require("./compose").format,
  require("./github-actions").format,
  require("./codeowners").format,
  require("./launch-json").format,
  require("./gitlab-ci").format,
  require("./tasks-json").format,
  require("./devcontainer").format,
  require("./gitmodules").format,
  require("./pyproject").format,
  require("./yaml-paths").format,
]);
const discoveryPatterns = Object.freeze([...new Set(formats.flatMap(format => format.patterns))]);
function getFormat(file) {
  const parts = file.split(/[\\/]/);
  const info = { parts, base: parts.at(-1) || "", parent: parts.at(-2) || "", grand: parts.at(-3) || "" };
  for (const format of formats) { const kind = format.match(info); if (kind) return { format, kind }; }
  return null;
}
function classify(file) { return getFormat(file)?.kind || null; }
module.exports = { formats, discoveryPatterns, getFormat, classify };
