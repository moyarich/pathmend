import { element, action } from "../../utils/dom.js";
import { icon } from "../../icons/registry.js";

/** Present one diagnostic and emit actions without depending on the VS Code API. */
export class ReferenceCard extends HTMLElement {
  update(f, revision, selected, draft) {
    const card = element("article", undefined, "reference-card " + f.severity);
    if (selected) card.classList.add("selected");
    const meta = element("div", undefined, "card-meta");
    const severity = element("span", f.notChecked ? "Not checked" : f.severity, "severity-label");
    severity.prepend(icon(f.severity === "error" ? "circle-x" : f.severity === "warning" ? "triangle-alert" : "info"));
    meta.append(element("span", f.code, "rule-code"), severity, element("span", "L" + f.line + ":" + f.column, "location"));
    const dispatch = (type, extra = {}) => this.dispatchEvent(new CustomEvent("pm-reference-action", {
      bubbles: true, detail: { type, id: f.id, revision, ...extra },
    }));
    const path = action(f.path, () => dispatch("open"));
    path.className = "path";
    path.title = "Open reference at line " + f.line + ", column " + f.column;
    card.append(meta, path, element("div", f.rule, "rule-title"), element("p", f.message, "message"));
    if (f.repairable || f.fix) {
      const suggestion = element("div", undefined, "suggestion");
      const label = element("label", f.fix ? "Suggested path" : "Replacement path", "suggestion-label");
      const input = element("input", undefined, "suggestion-path");
      input.type = "text";
      input.value = draft.value ?? f.fix ?? "";
      input.spellcheck = false;
      input.autocomplete = "off";
      input.setAttribute("aria-label", "Replacement path for " + f.path);
      input.placeholder = f.fix ? "" : "Enter a local path";
      input.dataset.draftKey = draft.key;
      label.append(input);
      const fix = action("Apply fix", () => dispatch("fix", { replacement: input.value }), "check");
      fix.classList.add("primary");
      const reset = action("Reset", () => {
        input.value = f.fix ?? "";
        update();
        input.focus();
      });
      reset.classList.add("quiet");
      const update = () => {
        draft.save(input.value);
        fix.disabled = !input.value.trim();
        reset.disabled = input.value === (f.fix ?? "");
      };
      input.addEventListener("input", update);
      input.addEventListener("keydown", event => {
        if (event.key === "Enter" && !fix.disabled) {
          event.preventDefault();
          fix.click();
        }
      });
      const buttons = element("div", undefined, "suggestion-actions");
      buttons.append(fix, reset);
      suggestion.append(label, buttons);
      update();
      card.append(suggestion);
    }
    this.replaceChildren(card);
  }
}

customElements.define("pm-reference-card", ReferenceCard);
