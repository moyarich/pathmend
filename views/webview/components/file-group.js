import { element } from "../dom.js";
import "./reference-card.js";

/** Group references by source file using native disclosure semantics. */
export class FileGroup extends HTMLElement {
  update(file, revision, expanded, selectedId) {
    const group = element("details");
    group.open = expanded;
    const summary = element("summary");
    const label = element("span", undefined, "group-label");
    label.append(element("span", file.path, "file-path"), element("span", String(file.findings.length), "file-count"));
    summary.append(label);
    group.append(summary);
    let previous = expanded;
    group.addEventListener("toggle", () => {
      if (!group.isConnected || group.open === previous) return;
      previous = group.open;
      this.dispatchEvent(new CustomEvent("pm-group-toggle", {
        bubbles: true,
        detail: { path: file.path, expanded: group.open },
      }));
    });
    for (const finding of file.findings) {
      const card = document.createElement("pm-reference-card");
      card.update(finding, revision, finding.id === selectedId);
      group.append(card);
    }
    this.replaceChildren(group);
  }
}

customElements.define("pm-file-group", FileGroup);
