"use strict";

const vscode = acquireVsCodeApi();
const filter = document.getElementById("filter");
const status = document.getElementById("status");
const results = document.getElementById("results");
let snapshot;
const saved = vscode.getState() || {};
const collapsed = new Set(Array.isArray(saved.collapsed) ? saved.collapsed : []);
filter.value = typeof saved.filter === "string" ? saved.filter : "";

function persist() {
  vscode.setState({ filter: filter.value, collapsed: [...collapsed] });
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function action(label, type, id) {
  const button = element("button", label);
  button.type = "button";
  button.addEventListener("click", () => vscode.postMessage({ type, id, revision: snapshot.revision }));
  return button;
}

function render() {
  if (!snapshot) return;
  results.replaceChildren();
  if (!snapshot.enabled || !snapshot.hasWorkspace) {
    status.textContent = snapshot.enabled ? "Open a folder to check references." : "PathMend is turned off.";
    return;
  }
  const query = filter.value.trim().toLowerCase();
  let total = 0;
  for (const file of snapshot.files) {
    const findings = file.findings.filter(f => [file.path, f.path, f.code, f.alias, f.rule, f.message, f.fix].some(value => String(value || "").toLowerCase().includes(query)));
    if (!findings.length) continue;
    total += findings.length;
    const group = element("details");
    group.open = !!query || !collapsed.has(file.path);
    group.append(element("summary", file.path + " (" + findings.length + ")"));
    group.addEventListener("toggle", () => {
      if (filter.value.trim()) return;
      if (group.open) collapsed.delete(file.path); else collapsed.add(file.path);
      persist();
    });
    for (const f of findings) {
      const card = element("article", undefined, f.severity);
      card.append(element("div", f.code + " · " + f.severity + " · L" + f.line + ":" + f.column, "meta"),
        element("div", f.path, "path"), element("div", f.rule, "meta"), element("p", f.message, "message"));
      if (f.fix) card.append(element("div", "Suggested path: " + f.fix, "suggestion"));
      const actions = element("div", undefined, "actions");
      actions.append(action("Open reference", "open", f.id));
      if (f.fix) actions.append(action("Apply fix", "fix", f.id));
      card.append(actions);
      group.append(card);
    }
    results.append(group);
  }
  status.textContent = total ? total + " references shown" : query ? "No matching references." : "No broken paths found.";
}

filter.addEventListener("input", () => { persist(); render(); });
document.getElementById("scan").addEventListener("click", () => vscode.postMessage({ type: "scan" }));
window.addEventListener("message", event => {
  if (event.data?.type === "snapshot") { snapshot = event.data; render(); }
});
vscode.postMessage({ type: "ready" });
