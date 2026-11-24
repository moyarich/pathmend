"use strict";
const { encodeFor } = require("./encode");
/** Only literal references with a supported source encoding can be edited manually. */
function canReplace(finding) {
  const ref = finding?.ref;
  return !!ref && !ref.glob && !ref.anywhere && encodeFor(ref, "./replacement") !== null;
}
module.exports = { canReplace };
