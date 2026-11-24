"use strict";


function encodeFor(ref, text) {
  switch (ref.escape) {
    case "json":
    case "yaml-dq":
      return JSON.stringify(text).slice(1, -1);
    case "yaml-sq":
      return text.replace(/'/g, "''");
    case "plain":
      return /^[-?:,[\]{}#&*!|>'"%@`]|: | #|\s$/.test(text) ? null : text;
    case "document-path":
      // Conservative edits: do not introduce syntax delimiters, URI escapes,
      // or separators that change the meaning of links, strings or lists.
      return /[\s\\'"<>()\[\]{}#?%,&`]/.test(text) ? null : text;
    case "shell":
      return /[\s'"$`\\;&|<>()]/.test(text) ? null : text;
    default:
      return null;
  }
}

module.exports = { encodeFor };
