import { element } from "../dom.js";
import { filterReferences } from "../filter.js";
import "./file-group.js";

/** Render the current snapshot, preserving native keyboard and theme behavior. */
export class ReferenceList extends HTMLElement {
  update(state) {
    const snapshot = state.snapshot;
    if (!snapshot) return;
    const status = this.querySelector(".reference-status") || element("p", "", "reference-status");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    const results = element("div");
    if (!snapshot.enabled || !snapshot.hasWorkspace) {
      status.textContent = snapshot.enabled ? "Open a folder to check references." : "PathMend is turned off.";
    } else {
      const files = filterReferences(snapshot.files, state.filter, state.severity);
      const findings = snapshot.files.flatMap(file => file.findings);
      const broken = findings.filter(f => !f.notChecked).length;
      const summary = element("div", undefined, "reference-summary");
      summary.append(element("span", broken + " broken"), element("span", (findings.length - broken) + " not checked"), element("span", findings.filter(f => f.fix).length + " fixable"));
      results.append(summary);
      let total = 0;
      for (const file of files) {
        total += file.findings.length;
        const group = document.createElement("pm-file-group");
        group.update(file, snapshot.revision, state.isExpanded(file.path), snapshot.selectedId);
        results.append(group);
      }
      status.textContent = total ? total + " of " + findings.length + " references · " + files.length + " files" :
        state.filter.trim() || state.severity !== "all" ? "No matching references." : "No broken paths found.";
    }
    this.replaceChildren(status, results);
  }
}

customElements.define("pm-reference-list", ReferenceList);
