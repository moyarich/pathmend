import { createBridge } from "./bridge.js";
import { createViewState } from "./state.js";
import { renderReferences } from "./render.js";

const bridge = createBridge(acquireVsCodeApi());
const state = createViewState(bridge);
const filter = document.getElementById("filter");
const status = document.getElementById("status");
const results = document.getElementById("results");

filter.value = state.filter;
const render = () => renderReferences({ state, status, results, send: bridge.send });

filter.addEventListener("input", () => {
  state.setFilter(filter.value);
  render();
});
document.getElementById("scan").addEventListener("click", () => bridge.send({ type: "scan" }));
bridge.onSnapshot(snapshot => {
  state.setSnapshot(snapshot);
  render();
});
bridge.send({ type: "ready" });
