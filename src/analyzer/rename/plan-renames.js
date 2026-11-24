"use strict";
const path = require("node:path");
const { within } = require("../utils/paths");
const { formatPath } = require("../references/format-path");
const { encodeFor } = require("../references/encode");

function movedPath(original, renames) {
  let match = null;
  for (const rn of renames) {
    const from = path.resolve(rn.from);
    if (!within(original, from)) continue;
    if (!match || from.length > match.from.length) match = { from, to: path.resolve(rn.to) };
  }
  return match
    ? { path: path.resolve(match.to, path.relative(match.from, original)), rename: match }
    : { path: original, rename: null };
}

/**
 * Plan outgoing and incoming document reference edits from pre-move resolutions.
 * @param {Object} ref Normalized document reference.
 * @param {{from: string, to: string}[]} renames Rename batch.
 * @param {function(string): boolean} isInside Workspace boundary predicate.
 * @returns {Object|null} Edit targeting the post-move document, if necessary.
 */
function planDocumentRename(ref, renames, isInside) {
  const r = ref.result;
  const source = movedPath(ref.file, renames);
  const target = movedPath(r.hit || r.abs, renames);
  const change = target.rename || source.rename;
  if (!change || !isInside(source.path) || !isInside(target.path)) return null;
  // Preserve extensionless imports only when the original fallback still applies.
  let newAbs = target.path;
  if (r.hit && r.hit !== r.abs) {
    const suffix = r.hit.slice(r.abs.length);
    if (newAbs.endsWith(suffix)) newAbs = newAbs.slice(0, -suffix.length);
  }
  const base = path.dirname(source.path);
  let newText = formatPath(ref, newAbs, base);
  // JS imports and configured attributes must remain explicit relative paths.
  if (ref.lead === "./" || /^\.\.\//.test(ref.value)) {
    if (!/^\.\.?\//.test(newText) && newText !== ".") newText = "./" + newText;
  }
  if (newText === ref.display || encodeFor(ref, newText) === null) return null;
  return { ref, file: source.path, newText, from: change.from, to: change.to, sourceMoved: !!source.rename };
}

function planRenames(refs, renames, isInside) {
  const plan = [];
  for (const ref of refs || []) {
    const r = ref.result;
    if (!r || r.state !== "ok" || r.anywhere || ref.escape === "noedit") continue;
    if (ref.escape === "document-path") {
      const edit = planDocumentRename(ref, renames, isInside);
      if (edit) plan.push(edit);
      continue;
    }
    const target = r.hit || r.abs;
    for (const rn of renames) {
      const from = path.resolve(rn.from);
      const to = path.resolve(rn.to);
      if (!(target === from || target.startsWith(from + path.sep))) continue;
      if (ref.file === from || ref.file.startsWith(from + path.sep)) continue;
      let newAbs = to + target.slice(from.length);
      if (r.hit && r.hit !== r.abs) {
        const suffix = r.hit.slice(r.abs.length);
        newAbs = newAbs.endsWith(suffix) ? newAbs.slice(0, -suffix.length) : newAbs;
      }
      if (!isInside(newAbs) || !isInside(ref.file)) continue;
      if (r.confine && !within(newAbs, r.base)) continue;
      const newText = formatPath(ref, newAbs, r.base);
      if (newText === ref.display || encodeFor(ref, newText) === null) continue;
      plan.push({ ref, newText, from, to });
      break;
    }
  }
  return plan;
}

module.exports = { planRenames };
