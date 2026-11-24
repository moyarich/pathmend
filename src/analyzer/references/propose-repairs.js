"use strict";
/** Build a proposed document without changing it. Reject stale or overlapping edits. */
function proposeRepairs(source, edits) {
  const ordered = [...edits].sort((a,b) => a.start - b.start || a.end - b.end);
  let cursor = 0, output = "";
  for (const e of ordered) {
    if (!Number.isInteger(e.start) || !Number.isInteger(e.end) || e.start < cursor ||
        e.end <= e.start || e.end > source.length || source.slice(e.start,e.end) !== e.raw ||
        typeof e.encoded !== "string") return null;
    output += source.slice(cursor,e.start) + e.encoded;
    cursor = e.end;
  }
  return output + source.slice(cursor);
}
module.exports = { proposeRepairs };
