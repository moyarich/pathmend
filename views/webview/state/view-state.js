import { filterReferences } from "./filter.js";

/** Keep transient diagnostics separate from persisted presentation preferences. */
const TYPES = new Set(["all", "broken", "info", "fixable"]);

export function createViewState(storage) {
  const saved = storage.load();
  let filter = typeof saved.filter === "string" ? saved.filter : "";
  let severity = TYPES.has(saved.severity) ? saved.severity : "all";
  let snapshot;
  const collapsed = new Set(Array.isArray(saved.collapsed) ? saved.collapsed : []);
  const persist = () => storage.save({ filter, severity, collapsed: [...collapsed] });

  const visibleFiles = () => snapshot?.enabled === false || snapshot?.hasWorkspace === false ? [] : filterReferences(snapshot?.files || [], filter, severity);
  const disclosure = () => {
    const files = visibleFiles();
    return { canToggle: !filter.trim() && files.length > 0, allExpanded: files.length > 0 && files.every(file => !!filter.trim() || !collapsed.has(file.path)) };
  };
  const setAllExpanded = expanded => {
    if (filter.trim()) return;
    for (const file of visibleFiles()) {
      if (expanded) collapsed.delete(file.path); else collapsed.add(file.path);
    }
    persist();
  };

  return {
    get filter() { return filter; },
    get severity() { return severity; },
    get snapshot() { return snapshot; },
    setSnapshot(value) { snapshot = value; },
    setFilter(value) { filter = value; persist(); },
    setSeverity(value) { if (TYPES.has(value)) { severity = value; persist(); } },
    isExpanded(path) { return !!filter.trim() || !collapsed.has(path); },
    setExpanded(path, expanded) {
      if (filter.trim()) return;
      if (expanded) collapsed.delete(path); else collapsed.add(path);
      persist();
    },
    get groupDisclosure() { return disclosure(); },
    setAllExpanded,
    toggleGroups() {
      const { canToggle, allExpanded } = disclosure();
      if (canToggle) setAllExpanded(!allExpanded);
    },
  };
}
