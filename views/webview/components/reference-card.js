import { element, action } from "../dom.js";

/** Present one diagnostic and emit actions without depending on the VS Code API. */
export class ReferenceCard extends HTMLElement {
  update(finding, revision, selected) {
    const f = finding;
    const card = element("article", undefined, f.severity);
    if (selected) card.classList.add("selected");
    card.append(
      element("div", f.code + " · " + f.severity + " · L" + f.line + ":" + f.column, "meta"),
      element("div", f.path, "path"),
      element("div", f.rule, "meta"),
      element("p", f.message, "message")
    );
    if (f.fix) card.append(element("div", "Suggested path: " + f.fix, "suggestion"));
    const actions = element("div", undefined, "actions");
    const dispatch = type => this.dispatchEvent(new CustomEvent("pm-reference-action", {
      bubbles: true,
      detail: { type, id: f.id, revision },
    }));
    actions.append(action("Open reference", () => dispatch("open")));
    if (f.fix) {
      const fix = action("Apply fix", () => dispatch("fix"));
      fix.classList.add("primary");
      actions.append(fix);
    }
    card.append(actions);
    this.replaceChildren(card);
  }
}

customElements.define("pm-reference-card", ReferenceCard);
