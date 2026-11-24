"use strict";
const { isUrl, hasControl } = require("../utils/paths");

function skipYamlValue(v) {
  return !v || v.includes("$") || isUrl(v) || hasControl(v);
}

module.exports = { skipYamlValue };
