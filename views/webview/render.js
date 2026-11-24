import { filterReferences } from "./filter.js";
import { fileGroup } from "./components/file-group.js";

/** Render the current snapshot and its empty, disabled or filtered state. */
export function renderReferences({ state, status, results, send }) {
  const snapshot = state.snapshot;
  if (!snapshot) return;
  results.replaceChildren();
  if (!snapshot.enabled || !snapshot.hasWorkspace) {
    status.textContent = snapshot.enabled ? "Open a folder to check references." : "PathMend is turned off.";
    return;
  }
  const files = filterReferences(snapshot.files, state.filter);
  let total = 0;
  for (const file of files) {
    total += file.findings.length;
    results.append(fileGroup(file, snapshot.revision, state, send));
  }
  status.textContent = total ? total + " references shown" :
    state.filter.trim() ? "No matching references." : "No broken paths found.";
}
