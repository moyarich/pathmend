"use strict";


function globToRegex(glob, anyStar) {
  let re = "";
  let i = 0;
  let brace = 0;
  while (i < glob.length) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        i += 2;
        if (glob[i] === "/") {
          re += "(?:.*/)?";
          i++;
        } else re += ".*";
        continue;
      }
      re += anyStar ? ".*" : "[^/]*";
      i++;
      continue;
    }
    if (c === "?") {
      re += "[^/]";
      i++;
      continue;
    }
    if (c === "[") {
      const j = glob.indexOf("]", i + 1);
      if (j > i + 1) {
        let cls = glob.slice(i + 1, j).replace(/\\/g, "\\\\");
        if (cls[0] === "!") cls = "^" + cls.slice(1);
        re += "[" + cls + "]";
        i = j + 1;
        continue;
      }
      re += "\\[";
      i++;
      continue;
    }
    if (c === "{") {
      brace++;
      re += "(?:";
      i++;
      continue;
    }
    if (c === "}" && brace > 0) {
      brace--;
      re += ")";
      i++;
      continue;
    }
    if (c === "," && brace > 0) {
      re += "|";
      i++;
      continue;
    }
    re += c.replace(/[.+^$()|\\/{}\]]/g, "\\$&");
    i++;
  }
  while (brace-- > 0) re += ")";
  try {
    return new RegExp("^" + re + "$");
  } catch (_) {
    return null;
  }
}

function makeMatcher(patterns) {
  const res = (patterns || [])
    .filter((p) => typeof p === "string" && p.trim())
    .map((p) => globToRegex(p.trim().replace(/^\.\//, "")))
    .filter(Boolean);
  return (rel) => res.some((r) => r.test(rel) || r.test(rel + "/"));
}

/** Optimal string alignment distance (Levenshtein plus adjacent transposition). */

module.exports = { globToRegex, makeMatcher };
