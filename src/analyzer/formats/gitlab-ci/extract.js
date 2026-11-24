"use strict";
const path = require("node:path");
const { isGlob } = require("../../utils/paths");
const { parseYaml, yget, yscalar } = require("../../parsers/yaml");
const { yamlRef } = require("../../references/create-reference");
const { skipYamlValue } = require("../yaml-values");

function extractGitlab(c) {
  const out = [];
  const root = path.dirname(c.file);
  const doc = parseYaml(c.text)[0];
  const inc = yget(doc, "include");
  if (!inc) return out;
  const items = inc.type === "seq" ? inc.items : [inc];
  const add = (s) => {
    if (!s || skipYamlValue(s.value)) return;
    const v = s.value;
    const lead = v.startsWith("/");
    const r = yamlRef(c, s, { code: "PM008", base: root, kind: "file", label: ".gitlab-ci.yml include local", glob: isGlob(v) ? "std" : false });
    if (lead) {
      r.value = v.replace(/^\/+/, "");
      r.fmt = "root";
      r.lead = "";
    }
    out.push(r);
  };
  for (const it of items) {
    if (!it) continue;
    if (it.type === "scalar") add(yscalar(it));
    else if (it.type === "map") add(yscalar(yget(it, "local")));
  }
  return out;
}

module.exports = { extractGitlab };
