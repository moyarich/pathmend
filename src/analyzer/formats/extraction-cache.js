"use strict";
/**
 * Cache only extractors explicitly independent of cross-document context.
 * Cache source and settings by exact value, never filesystem resolution results.
 * A transaction publishes entries only after extraction completes.
 */
function createExtractionCache() {
  let entries = new Map();
  return {
    begin(settings) {
      const signature = JSON.stringify(settings);
      const next = new Map();
      let hits = 0, misses = 0;
      return {
        extract(document, extract) {
          if (!document.format.cacheable) return extract();
          const old = entries.get(document.file);
          let entry;
          if (old && old.format === document.format.id && old.signature === signature && old.text === document.text) {
            hits++;
            entry = old;
          } else {
            misses++;
            entry = { format: document.format.id, signature, text: document.text, refs: extract() };
          }
          next.set(document.file, entry);
          return entry.refs.map(ref => structuredClone(ref));
        },
        commit() { entries = next; return { hits, misses, entries: entries.size }; },
      };
    },
    clear() { entries.clear(); },
  };
}
module.exports = { createExtractionCache };
