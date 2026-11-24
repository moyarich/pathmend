import { element } from "../dom.js";
import { referenceCard } from "./reference-card.js";

/** Render a collapsible source-file group. */
export function fileGroup(file, revision, state, send) {
  const group = element("details");
  group.open = state.isExpanded(file.path);
  group.append(element("summary", file.path + " (" + file.findings.length + ")"));
  group.addEventListener("toggle", () => {
    if (group.isConnected) state.setExpanded(file.path, group.open);
  });
  for (const finding of file.findings) {
    group.append(referenceCard(finding, revision, send));
  }
  return group;
}
