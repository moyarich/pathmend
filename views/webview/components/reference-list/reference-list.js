import { element } from "../../utils/dom.js";
import { filterReferences } from "../../state/filter.js";
import "../file-group/file-group.js";

/** Render the current snapshot, preserving native keyboard and theme behavior. */
export class ReferenceList extends HTMLElement {
  drafts = new Map();

  draftKey(file, finding) {
    return JSON.stringify([file.path, finding.code, finding.line, finding.column, finding.path, finding.fix]);
  }

  update(state) {
    const snapshot = state.snapshot;
    if (!snapshot) return;
    const active = document.activeElement;
    const focused = this.contains(active) && active?.dataset.draftKey ? { key: active.dataset.draftKey, start: active.selectionStart, end: active.selectionEnd } : null;
    const keys = new Set(snapshot.files.flatMap(file => file.findings.filter(f => f.repairable || f.fix).map(f => this.draftKey(file, f))));
    for (const key of this.drafts.keys()) if (!keys.has(key)) this.drafts.delete(key);
    const getDraft = (file, finding) => {
      const key = this.draftKey(file, finding);
      return { key, value: this.drafts.get(key), save: value => {
        if (value === (finding.fix ?? "")) this.drafts.delete(key); else this.drafts.set(key, value);
      } };
    };
    const status = this.querySelector(".reference-status") || element("p", "", "reference-status");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    const results = element("div", undefined, "reference-results");
    if (!snapshot.enabled || !snapshot.hasWorkspace) {
      status.textContent = snapshot.enabled ? "Open a folder to check references." : "PathMend is turned off.";
    } else {
      const files = filterReferences(snapshot.files, state.filter, state.severity);
      const findings = snapshot.files.flatMap(file => file.findings);
      const broken = findings.filter(f => !f.notChecked).length;
      const summary = element("div", undefined, "reference-summary");
      summary.append(element("span", broken + " broken"), element("span", (findings.length - broken) + " not checked"), element("span", findings.filter(f => f.fix).length + " fixable"));
      results.append(summary);
      const groups = element("div", undefined, "reference-groups");
      let total = 0;
      for (const file of files) {
        total += file.findings.length;
        const group = document.createElement("pm-file-group");
        group.update(file, snapshot.revision, state.isExpanded(file.path), snapshot.selectedId, getDraft);
        groups.append(group);
      }
      results.append(groups);
      status.textContent = total ? total + " of " + findings.length + " references · " + files.length + " files" :
        state.filter.trim() || state.severity !== "all" ? "No matching references." : "No broken paths found.";
    }
    this.replaceChildren(status, results);
    if (focused) {
      const input = [...this.querySelectorAll("input.suggestion-path")].find(input => input.dataset.draftKey === focused.key);
      if (input && input.closest("details")?.open) {
        input.focus({ preventScroll: true });
        input.setSelectionRange(focused.start, focused.end);
      }
    }
  }
}

customElements.define("pm-reference-list", ReferenceList);
