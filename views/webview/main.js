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
const render = () => {
  clear.hidden = !state.filter;
  updateGroupToggle();
  list.update(state);
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
document.getElementById("problems").addEventListener("click", () => bridge.send({ type: "problems" }));
document.getElementById("export").addEventListener("click", () => bridge.send({ type: "export" }));
document.getElementById("settings").addEventListener("click", () => bridge.send({ type: "settings" }));
list.addEventListener("pm-reference-action", event => bridge.send(event.detail));
list.addEventListener("pm-group-toggle", event => {
  const { path, expanded } = event.detail;
  state.setExpanded(path, expanded);
  updateGroupToggle();
});
bridge.onSnapshot(snapshot => {
  state.setSnapshot(snapshot);
  render();
});
render();
bridge.send({ type: "ready" });
