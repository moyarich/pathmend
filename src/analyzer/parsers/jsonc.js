"use strict";


const JSON_ESC = { '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" };

function parseJsonc(text) {
  const n = text.length;
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  const fail = () => {
    throw new Error("json");
  };
  function ws() {
    for (;;) {
      const c = text.charCodeAt(i);
      if (c === 32 || c === 9 || c === 10 || c === 13 || c === 0xfeff) {
        i++;
        continue;
      }
      if (c === 47) {
        const d = text[i + 1];
        if (d === "/") {
          const e = text.indexOf("\n", i);
          i = e < 0 ? n : e + 1;
          continue;
        }
        if (d === "*") {
          const e = text.indexOf("*/", i + 2);
          if (e < 0) fail();
          i = e + 2;
          continue;
        }
      }
      return;
    }
  }
  function str() {
    const start = i;
    i++;
    let out = "";
    for (;;) {
      if (i >= n) fail();
      const c = text[i];
      if (c === '"') {
        i++;
        break;
      }
      if (c === "\n" || c === "\r") fail();
      if (c === "\\") {
        const e = text[i + 1];
        if (e === "u") {
          const h = text.slice(i + 2, i + 6);
          if (!/^[0-9a-fA-F]{4}$/.test(h)) fail();
          out += String.fromCharCode(parseInt(h, 16));
          i += 6;
          continue;
        }
        if (!Object.prototype.hasOwnProperty.call(JSON_ESC, e)) fail();
        out += JSON_ESC[e];
        i += 2;
        continue;
      }
      out += c;
      i++;
    }
    return { type: "string", value: out, start: start + 1, end: i - 1 };
  }
  function value(depth) {
    if (depth > 200) fail();
    ws();
    const c = text[i];
    if (c === "{") {
      i++;
      const props = [];
      for (;;) {
        ws();
        if (text[i] === "}") {
          i++;
          break;
        }
        if (text[i] !== '"') fail();
        const k = str();
        ws();
        if (text[i] !== ":") fail();
        i++;
        const v = value(depth + 1);
        props.push({ key: k.value, value: v });
        ws();
        if (text[i] === ",") {
          i++;
          continue;
        }
        if (text[i] === "}") {
          i++;
          break;
        }
        fail();
      }
      return { type: "object", props };
    }
    if (c === "[") {
      i++;
      const items = [];
      for (;;) {
        ws();
        if (text[i] === "]") {
          i++;
          break;
        }
        items.push(value(depth + 1));
        ws();
        if (text[i] === ",") {
          i++;
          continue;
        }
        if (text[i] === "]") {
          i++;
          break;
        }
        fail();
      }
      return { type: "array", items };
    }
    if (c === '"') return str();
    const m = /^(?:true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(i, i + 64));
    if (!m) fail();
    i += m[0].length;
    return { type: "literal" };
  }
  try {
    const v = value(0);
    ws();
    return i >= n ? v : null;
  } catch (_) {
    return null;
  }
}

function jget(node, key) {
  if (!node || node.type !== "object") return null;
  let v = null;
  for (const p of node.props) if (p.key === key) v = p.value;
  return v;
}

module.exports = { parseJsonc, jget };
