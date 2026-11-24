/** Workspace-controlled strings are assigned as text, never HTML. */
export function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

export function action(label, handler) {
  const button = element("button", label);
  button.type = "button";
  button.addEventListener("click", handler);
  return button;
}
