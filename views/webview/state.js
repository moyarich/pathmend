/** Keep transient diagnostics separate from persisted presentation preferences. */
export function createViewState(storage) {
  const saved = storage.load();
  let filter = typeof saved.filter === "string" ? saved.filter : "";
  let snapshot;
  const collapsed = new Set(Array.isArray(saved.collapsed) ? saved.collapsed : []);
  const persist = () => storage.save({ filter, collapsed: [...collapsed] });

  return {
    get filter() { return filter; },
    get snapshot() { return snapshot; },
    setSnapshot(value) { snapshot = value; },
    setFilter(value) { filter = value; persist(); },
    isExpanded(path) { return !!filter.trim() || !collapsed.has(path); },
    setExpanded(path, expanded) {
      if (filter.trim()) return;
      if (expanded) collapsed.delete(path); else collapsed.add(path);
      persist();
    },
  };
}
