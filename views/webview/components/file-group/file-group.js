import { element } from "../../utils/dom.js";
import { icon } from "../../icons/registry.js";
import "../reference-card/reference-card.js";

export class FileGroup extends HTMLElement {
  update(file, revision, expanded, selectedId, getDraft) {
    this.model = { file, revision, selectedId, getDraft };
    if (!this.group) {
      this.group = element("details");
      const summary = element("summary", undefined, "file-summary");
      const chevron = icon("chevron-right");
      chevron.classList.add("disclosure-icon");
      this.label = element("span", undefined, "group-label");
      this.pathLabel = element("span", "", "file-path");
      this.count = element("span", "", "file-count");
      this.label.append(icon("file-code"), this.pathLabel, this.count);
      summary.append(chevron, this.label);
      this.cards = element("div", undefined, "file-references");
      this.group.append(summary, this.cards);
      this.append(this.group);
      this.group.addEventListener("toggle", () => {
        if (!this.isConnected || this.group.open === this.expectedOpen) return;
        this.expectedOpen = this.group.open;
        this.renderCards();
        this.dispatchEvent(new CustomEvent("pm-group-toggle", {
          bubbles: true, detail: { path: this.model.file.path, expanded: this.group.open },
        }));
      });
    }
    this.pathLabel.textContent = file.path;
    this.count.textContent = String(file.findings.length);
    this.expectedOpen = expanded;
    this.group.open = expanded;
    this.renderCards();
  }
  renderCards() {
    if (!this.group.open) { this.cards.replaceChildren(); this.renderKey = null; return; }
    const {file, revision, selectedId, getDraft} = this.model;
    const key = JSON.stringify([revision, selectedId, file.findings.map(f => f.id)]);
    if (key === this.renderKey) return;
    this.renderKey = key;
    const cards = file.findings.map(finding => {
      const card = document.createElement("pm-reference-card");
      card.update(finding, revision, finding.id === selectedId, getDraft(file, finding));
      return card;
    });
    this.cards.replaceChildren(...cards);
  }
}
customElements.define("pm-file-group", FileGroup);
