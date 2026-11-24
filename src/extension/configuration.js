"use strict";
const vscode = require("vscode");
function getConfig() {
  const c = vscode.workspace.getConfiguration("pathmend");
  return {
    enabled: c.get("enabled", true),
    exclude: c.get("exclude", ["**/node_modules/**", "**/.git/**", "**/dist/**"]),
    ignoreReferences: c.get("ignoreReferences", []),
    disabledRules: c.get("disabledRules", []),
    yamlPathAttributes: c.get("yaml.pathAttributes", []),
    mdxPathAttributes: c.get("mdx.pathAttributes", ["src", "href"]),
    directivePathAttributes: c.get("markdown.directivePathAttributes", ["component", "code", "files"]),
    multiPathAttributes: c.get("markdown.multiPathAttributes", ["files"]),
    severity: c.get("severity", "warning"),
    reportOutside: c.get("reportOutsideWorkspace", true),
    maxIndexedFiles: Math.max(100, c.get("maxIndexedFiles", 20000)),
    maxFileSizeKB: Math.max(1, c.get("maxConfigFileSizeKB", 512)),
    renameUpdates: c.get("renameUpdates", "prompt"),
  };
}
module.exports = { getConfig };
