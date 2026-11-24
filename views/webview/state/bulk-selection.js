/** Selection belongs to a single diagnostic revision; opaque IDs must never cross revisions. */
export function createBulkSelection() {
  let revision, eligible = new Set(), selected = new Set();
  const ids = files => files.flatMap(file => file.findings.filter(f => f.fix && f.repairable && !f.notChecked).map(f => f.id));
  return {
    reset(snapshot) {
      if (revision !== snapshot?.revision) selected.clear();
      revision = snapshot?.revision;
      eligible = new Set(snapshot?.enabled && snapshot?.hasWorkspace ? ids(snapshot.files || []) : []);
      for (const id of selected) if (!eligible.has(id)) selected.delete(id);
    },
    eligibleIds(files) { return ids(files).filter(id => eligible.has(id)); },
    has(id) { return selected.has(id); },
    set(list, checked) {
      for (const id of list) if (eligible.has(id)) {
        if (checked) selected.add(id); else selected.delete(id);
      }
    },
    clear() { selected.clear(); },
    get count() { return selected.size; },
    get ids() { return [...selected]; },
    status(list) {
      const valid = list.filter(id => eligible.has(id));
      const count = valid.filter(id => selected.has(id)).length;
      return { disabled: !valid.length, checked: !!valid.length && count === valid.length, indeterminate: count > 0 && count < valid.length };
    },
  };
}
