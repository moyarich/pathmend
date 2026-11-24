import { element } from "../dom.js";
import { filterReferences } from "../filter.js";
import "./file-group.js";

/** Render the current snapshot, preserving native keyboard and theme behavior. */
export class ReferenceList extends HTMLElement {
  update(state) {
    const snapshot = state.snapshot;
    if (!snapshot) return;
    const status = element("p", "", "reference-status");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    const results = element("div");
    if (!snapshot.enabled || !snapshot.hasWorkspace) {
      status.textContent = snapshot.enabled ? "Open a folder to check references." : "PathMend is turned off.";
    } else {
      const files = filterReferences(snapshot.files, state.filter);
      let total = 0;
      for (const file of files) {
        total += file.findings.length;
        const group = document.createElement("pm-file-group");
        group.update(file, snapshot.revision, state.isExpanded(file.path));
        results.append(group);
      }
      status.textContent = total ? total + " references shown" :
        state.filter.trim() ? "No matching references." : "No broken paths found.";
    }
    this.replaceChildren(status, results);
  }
}

customElements.define("pm-reference-list", ReferenceList);
