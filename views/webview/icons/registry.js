import { icons } from "./geometry.js";

const SVG_NS = "http://www.w3.org/2000/svg";

/** Create an accessible decorative SVG from the local, allowlisted registry. */
export function icon(name) {
  if (!Object.hasOwn(icons, name)) throw new Error("Unknown icon: " + name);
  const svg = document.createElementNS(SVG_NS, "svg");
  for (const [key, value] of Object.entries({
    viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
    "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round",
    class: "pm-icon", "aria-hidden": "true", focusable: "false",
  })) svg.setAttribute(key, value);
  for (const [tag, attributes] of icons[name]) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
    svg.append(node);
  }
  return svg;
}
