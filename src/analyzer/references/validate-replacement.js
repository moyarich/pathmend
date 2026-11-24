"use strict";
const path = require("node:path");
const { isUrl, isGlob, hasControl } = require("../utils/paths");
const { evaluateRef } = require("./evaluate");
const { encodeFor } = require("./encode");

function inspectReplacement(ref, replacement, guard, index) {
  if (typeof replacement !== "string" || !replacement.trim() || hasControl(replacement) ||
      isUrl(replacement) || encodeFor(ref, replacement) === null) return "invalid";
  let value = replacement;
  if (ref.fmt === "wsvar") {
    if (value !== ref.varPrefix && !value.startsWith(ref.varPrefix + "/")) return "invalid";
    value = value.slice(ref.varPrefix.length).replace(/^\/+/, "") || ".";
  } else if (ref.fmt === "root") {
    if (!value.startsWith("/")) return "invalid";
    value = value.replace(/^\/+/, "") || ".";
  }
  if (isGlob(value) || value.includes("$") || isUrl(value) || path.isAbsolute(value) ||
      /^[a-z]:/i.test(value) || value.includes("\\")) return "invalid";
  const result = evaluateRef({ ...ref, value, glob: false, anywhere: undefined }, {
    guard, index, ignored: () => false,
  });
  return ({ ok: "valid", missing: "missing", notdir: "wrong-type", notfile: "wrong-type", noentry: "missing-entry", outside: "outside-workspace", context: "outside-context" })[result?.state] || "unverified";
}

function validateReplacement(ref, replacement, guard, index) {
  const status = inspectReplacement(ref, replacement, guard, index);
  return status === "valid" || status === "invalid" ? status : "unverified";
}
module.exports = { validateReplacement, inspectReplacement };
