import { createBridge } from "./bridge.js";
import { createViewState } from "./state.js";
import "./components/reference-list.js";

const bridge = createBridge(acquireVsCodeApi());
const state = createViewState(bridge);
const list = document.querySelector("pm-reference-list");
const filter = document.getElementById("filter");
const severity = document.getElementById("severity");
const clear = document.getElementById("clear-filter");
const expand = document.getElementById("expand");
const collapse = document.getElementById("collapse");

filter.value = state.filter;
severity.value = state.severity;
const render = () => {
  clear.hidden = !state.filter;
  expand.disabled = collapse.disabled = !!state.filter.trim() || !state.snapshot?.files.length;
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
expand.addEventListener("click", () => { state.setAllExpanded(true); render(); });
collapse.addEventListener("click", () => { state.setAllExpanded(false); render(); });
document.getElementById("problems").addEventListener("click", () => bridge.send({ type: "problems" }));
document.getElementById("settings").addEventListener("click", () => bridge.send({ type: "settings" }));
list.addEventListener("pm-reference-action", event => bridge.send(event.detail));
list.addEventListener("pm-group-toggle", event => {
  const { path, expanded } = event.detail;
  state.setExpanded(path, expanded);
});
bridge.onSnapshot(snapshot => {
  state.setSnapshot(snapshot);
  render();
});
render();
bridge.send({ type: "ready" });
