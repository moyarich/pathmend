import { createBridge } from "./api/bridge.js";
import { createViewState } from "./state/view-state.js";
import "./components/reference-list/reference-list.js";
import { icon } from "./icons/registry.js";

const bridge = createBridge(acquireVsCodeApi());
const state = createViewState(bridge);
const list = document.querySelector("pm-reference-list");
const filter = document.getElementById("filter");
const severity = document.getElementById("severity");
const clear = document.getElementById("clear-filter");
const toggleGroups = document.getElementById("toggle-groups");
const selectVisible = document.getElementById("select-visible");
const clearSelection = document.getElementById("clear-selection");
const bulkRepair = document.getElementById("bulk-repair");
function updateBulkSelection() {
  const ids=state.bulk.eligibleIds(state.visibleFiles);
  Object.assign(selectVisible,state.bulk.status(ids));
  const count=state.bulk.count;
  const hidden=count-ids.filter(id=>state.bulk.has(id)).length;
  clearSelection.disabled=!count;
  bulkRepair.disabled=!count;
  bulkRepair.textContent="Bulk repairs ("+count+")";
  document.getElementById("selection-status").textContent=count+" selected"+(hidden?" ("+hidden+" hidden by filters)":"");
  list.updateBulkSelection();
}
selectVisible.addEventListener("change",()=>{state.bulk.set(state.bulk.eligibleIds(state.visibleFiles),selectVisible.checked);updateBulkSelection();});
clearSelection.addEventListener("click",()=>{state.bulk.clear();updateBulkSelection();});
list.addEventListener("pm-bulk-selection",event=>{state.bulk.set(event.detail.ids,event.detail.checked);updateBulkSelection();});

for (const [id, name] of Object.entries({ "clear-filter": "x", problems: "circle-alert", settings: "settings", export: "download" })) {
  const button = document.getElementById(id);
  button.prepend(icon(name));
}
const searchIcon = icon("search");
searchIcon.classList.add("search-icon");
filter.before(searchIcon);
filter.value = state.filter;
severity.value = state.severity;
function updateGroupToggle() {
  const { canToggle, allExpanded } = state.groupDisclosure;
  const label = allExpanded ? "Collapse all" : "Expand all";
  toggleGroups.disabled = !canToggle;
  toggleGroups.title = label;
  toggleGroups.setAttribute("aria-label", label);
  toggleGroups.replaceChildren(icon(allExpanded ? "chevrons-down-up" : "chevrons-up-down"));
}
const controls = { fileType: document.getElementById("file-type"), rule: document.getElementById("rule"), sort: document.getElementById("sort"), currentOnly: document.getElementById("current-only") };
for (const [key, control] of Object.entries(controls)) {
  control.addEventListener("change", () => { state.setOption(key, key === "currentOnly" ? control.checked : control.value); render(); });
}
function syncOptions(control, values, label, selected) {
  const options = [...new Set([...values, ...(selected ? [selected] : [])])].sort();
  control.replaceChildren(new Option(label, ""), ...options.map(value => new Option(value, value)));
  control.value = selected;
}
const render = () => {
  const files = state.snapshot?.files || [];
  syncOptions(controls.fileType, files.map(f => /\.([^./]+)$/.exec(f.path)?.[1]?.toLowerCase()).filter(Boolean), "All file types", state.options.fileType);
  syncOptions(controls.rule, files.flatMap(f => f.findings.map(r => r.code)), "All rules", state.options.rule);
  controls.sort.value = state.options.sort;
  controls.currentOnly.checked = state.options.currentOnly;
  clear.hidden = !state.filter;
  updateGroupToggle();
  list.update(state);
  updateBulkSelection();
};
function setFilter(value) {
  filter.value = value;
  state.setFilter(value);
  render();
}
filter.addEventListener("input", () => setFilter(filter.value));
filter.addEventListener("keydown", event => {
  if (event.key === "Escape" && filter.value) { event.preventDefault(); setFilter(""); }
});
clear.addEventListener("click", () => { setFilter(""); filter.focus(); });
severity.addEventListener("change", () => { state.setSeverity(severity.value); render(); });
toggleGroups.addEventListener("click", () => { state.toggleGroups(); render(); });
document.getElementById("editor")?.addEventListener("click", () => bridge.send({ type: "editor" }));
document.getElementById("sidebar")?.addEventListener("click", () => bridge.send({ type: "sidebar" }));
document.getElementById("problems").addEventListener("click", () => bridge.send({ type: "problems" }));
bulkRepair.addEventListener("click", () => { if(state.bulk.count) bridge.send({ type: "bulk-repair", revision:state.snapshot.revision, ids:state.bulk.ids }); });
document.getElementById("export").addEventListener("click", () => bridge.send({ type: "export" }));
document.getElementById("settings").addEventListener("click", () => bridge.send({ type: "settings" }));
list.addEventListener("pm-reference-action", event => bridge.send(event.detail));
list.addEventListener("pm-group-toggle", event => {
  const { path, expanded } = event.detail;
  state.setExpanded(path, expanded);
  updateGroupToggle();
});
window.addEventListener("message", event => {
  if (event.data?.type === "replacement-result") for (const card of list.querySelectorAll("pm-reference-card")) card.receiveReplacement?.(event.data);
});
bridge.onSnapshot(snapshot => {
  state.setSnapshot(snapshot);
  render();
});
render();
bridge.send({ type: "ready" });
