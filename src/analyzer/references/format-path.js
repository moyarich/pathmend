"use strict";
const path = require("node:path");
const { toPosix } = require("../utils/paths");

function formatPath(ref, newAbs, base) {
  let rel = toPosix(path.relative(base, newAbs));
  if (ref.fmt === "root") rel = "/" + rel;
  else if (ref.fmt === "wsvar") rel = rel ? ref.varPrefix + "/" + rel : ref.varPrefix;
  else if (!rel) rel = ".";
  else if (ref.lead === "./" && !rel.startsWith("../")) rel = "./" + rel;
  if (ref.trail && !rel.endsWith("/")) rel += "/";
  return rel;
}

module.exports = { formatPath };
