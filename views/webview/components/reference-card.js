import { element, action } from "../dom.js";

/** Present one diagnostic and emit actions without depending on the VS Code API. */
export class ReferenceCard extends HTMLElement {
  update(f, revision, selected) {
    const card = element("article", undefined, "reference-card " + f.severity);
    if (selected) card.classList.add("selected");
    const meta = element("div", undefined, "card-meta");
    meta.append(element("span", f.code, "rule-code"), element("span", f.notChecked ? "Not checked" : f.severity, "severity-label"), element("span", "L" + f.line + ":" + f.column, "location"));
    const dispatch = type => this.dispatchEvent(new CustomEvent("pm-reference-action", {
      bubbles: true, detail: { type, id: f.id, revision },
    }));
    const path = action(f.path, () => dispatch("open"));
    path.className = "path";
    path.title = "Open reference at line " + f.line + ", column " + f.column;
    card.append(meta, path, element("div", f.rule, "rule-title"), element("p", f.message, "message"));
    if (f.fix) {
      const suggestion = element("div", undefined, "suggestion");
      suggestion.append(element("span", "Suggested path", "suggestion-label"), element("code", f.fix, "suggestion-path"));
      const fix = action("Apply fix", () => dispatch("fix"));
      fix.classList.add("primary");
      suggestion.append(fix);
      card.append(suggestion);
    }
    this.replaceChildren(card);
  }
}

customElements.define("pm-reference-card", ReferenceCard);
