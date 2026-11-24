import { createBridge } from "./bridge.js";
import { createViewState } from "./state.js";
import "./components/reference-list.js";

const bridge = createBridge(acquireVsCodeApi());
const state = createViewState(bridge);
const list = document.querySelector("pm-reference-list");
const filter = document.getElementById("filter");

filter.value = state.filter;
const render = () => list.update(state);
filter.addEventListener("input", () => {
  state.setFilter(filter.value);
  render();
});
document.getElementById("scan").addEventListener("click", () => bridge.send({ type: "scan" }));
list.addEventListener("pm-reference-action", event => bridge.send(event.detail));
list.addEventListener("pm-group-toggle", event => {
  const { path, expanded } = event.detail;
  state.setExpanded(path, expanded);
});
bridge.onSnapshot(snapshot => {
  state.setSnapshot(snapshot);
  render();
});
bridge.send({ type: "ready" });
