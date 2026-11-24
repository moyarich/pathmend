import { element, action } from "../../utils/dom.js";
import { icon } from "../../icons/registry.js";

/** Present one diagnostic and emit actions without depending on the VS Code API. */
export class ReferenceCard extends HTMLElement {
  disconnectedCallback() { this.cancelPending?.(); }
  update(f, revision, selected, draft) {
    this.cancelPending?.();
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
      const preview = action("Preview", () => dispatch("preview", { replacement: input.value }));
      preview.classList.add("quiet");
      const reset = action("Reset", () => {
        input.value = f.fix ?? "";
        clearTimeout(timer); request++; choices.hidden = true;
        update();
        input.focus();
      });
      reset.classList.add("quiet");
      const choices = element("select", undefined, "replacement-choices");
      choices.hidden = true;
      choices.setAttribute("aria-label", "Matching workspace paths");
      let request = 0, timer, validationRequest = 0, validationTimer;
      this.cancelPending = () => { clearTimeout(timer); clearTimeout(validationTimer); request++; validationRequest++; };
      let validation = "pending";
      const feedback = element("div", "", "replacement-validation");
      feedback.setAttribute("role", "status");
      const messages = { pending: "Checking path…", valid: "Path verified", missing: "Target not found", "wrong-type": "Target has the wrong file or folder type", "missing-entry": "Required file is missing in this folder", "outside-workspace": "Path outside workspace — not checked", "outside-context": "Path outside build context", invalid: "Invalid replacement syntax", unverified: "Path could not be verified", unavailable: "Reference changed — scan again" };
      const displayValidation = status => {
        validation = status;
        feedback.textContent = messages[status] || messages.unverified;
        feedback.className = "replacement-validation " + status;
        fix.disabled = !input.value.trim() || status === "invalid" || status === "unavailable" || status === "pending";
        preview.disabled = fix.disabled;
      };
      const scheduleValidation = () => {
        clearTimeout(validationTimer);
        const current = ++validationRequest;
        if (!input.value.trim()) { displayValidation("invalid"); feedback.textContent = ""; return; }
        displayValidation("pending");
        validationTimer = setTimeout(() => { if (this.isConnected) dispatch("validate-replacement", { replacement: input.value, request: current }); }, 180);
      };
      const ask = type => dispatch(type, { replacement: input.value, request: ++request });
      const browse = action("Browse…", () => { clearTimeout(timer); ask("pick-replacement"); });
      browse.classList.add("quiet");
      const schedule = () => { clearTimeout(timer); request++; choices.hidden = true; timer = setTimeout(() => { if (this.isConnected) ask("complete-replacement"); }, 200); };
      this.receiveReplacement = message => {
        if (message.revision !== revision || message.id !== f.id) return;
        if (message.action === "validate-replacement") {
          if (message.request === validationRequest && typeof message.result === "string") displayValidation(message.result);
          return;
        }
        if (message.request !== request) return;
        if (message.action === "pick-replacement" && typeof message.result === "string") { input.value = message.result; update(); }
        if (message.action === "complete-replacement" && Array.isArray(message.result)) {
          choices.replaceChildren(element("option", "Choose a matching path…"));
          for (const value of message.result) { const option = element("option", value); option.value = value; choices.append(option); }
          choices.hidden = !message.result.length;
        }
      };
      choices.addEventListener("change", () => { if (choices.selectedIndex > 0) { input.value = choices.value; update(); choices.hidden = true; } });
      const update = () => {
        draft.save(input.value);
        scheduleValidation();
        reset.disabled = input.value === (f.fix ?? "");
      };
      input.addEventListener("input", () => { update(); schedule(); });
      input.addEventListener("keydown", event => {
        if (event.key === "Enter" && !fix.disabled) {
          event.preventDefault();
          fix.click();
        }
      });
      const buttons = element("div", undefined, "suggestion-actions");
      buttons.append(fix, preview, reset, browse);
      suggestion.append(label, feedback, choices, buttons);
      update();
      card.append(suggestion);
    }
    this.replaceChildren(card);
  }
}

customElements.define("pm-reference-card", ReferenceCard);
