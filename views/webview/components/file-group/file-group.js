import { element } from "../../utils/dom.js";
import { icon } from "../../icons/registry.js";
import "../reference-card/reference-card.js";

export class FileGroup extends HTMLElement {
  update(file, revision, expanded, selectedId, getDraft, bulk) {
    this.model = { file, revision, selectedId, getDraft, bulk };
    if (!this.group) {
      this.group = element("details");
      const summary = element("summary", undefined, "file-summary");
      const chevron = icon("chevron-right");
      chevron.classList.add("disclosure-icon");
      this.label = element("span", undefined, "group-label");
      this.pathLabel = element("span", "", "file-path");
      this.count = element("span", "", "file-count");
      this.label.append(icon("file-code"), this.pathLabel, this.count);
      this.bulkCheckbox = element("input", undefined, "bulk-file-checkbox");
      this.bulkCheckbox.type = "checkbox";
      this.bulkCheckbox.addEventListener("click", event => event.stopPropagation());
      this.bulkCheckbox.addEventListener("change", () => this.dispatchEvent(new CustomEvent("pm-bulk-selection", {bubbles:true,detail:{ids:this.model.bulk.eligibleIds([this.model.file]),checked:this.bulkCheckbox.checked}})));
      summary.append(chevron, this.label, this.bulkCheckbox);
      this.cards = element("div", undefined, "file-references");
      this.group.append(summary, this.cards);
      this.append(this.group);
      this.group.addEventListener("toggle", () => {
        if (!this.isConnected || this.group.open === this.expectedOpen) return;
        this.expectedOpen = this.group.open;
        this.renderCards();
        this.updateBulkSelection();
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
    this.updateBulkSelection();
  }
  updateBulkSelection() {
    const {file,bulk}=this.model;
    const ids=bulk.eligibleIds([file]);
    Object.assign(this.bulkCheckbox,bulk.status(ids));
    this.bulkCheckbox.setAttribute("aria-label","Select visible suggested repairs in "+file.path);
    this.bulkCheckbox.title="Select visible suggested repairs in this file";
    this.bulkCheckbox.hidden=!ids.length;
    for (const card of this.cards.children) card.setBulkSelected(bulk.has(card.bulkId));
  }
  renderCards() {
    if (!this.group.open) { this.cards.replaceChildren(); this.renderKey = null; return; }
    const {file, revision, selectedId, getDraft} = this.model;
    const key = JSON.stringify([revision, selectedId, file.findings.map(f => f.id)]);
    if (key === this.renderKey) return;
    this.renderKey = key;
    const cards = file.findings.map(finding => {
      const card = document.createElement("pm-reference-card");
      card.bulkId = finding.id;
      card.update(finding, revision, finding.id === selectedId, getDraft(file, finding));
      return card;
    });
    this.cards.replaceChildren(...cards);
  }
}
customElements.define("pm-file-group", FileGroup);
