"use strict";
const path = require("node:path");
const { toPosix, within } = require("./utils/paths");
const { makeMatcher } = require("./utils/glob");
const { lineStarts, splitLines } = require("./utils/text-position");
const { evaluateRef } = require("./references/evaluate");
const { formatPath } = require("./references/format-path");
const { encodeFor } = require("./references/encode");
const { getFormat } = require("./formats/registry");
const { RULES, resolveRuleId } = require("./rules/registry");

function relFor(p, roots) {
  for (const r of roots) if (within(p, r.path)) return toPosix(path.relative(r.path, p)) || ".";
  return p;
}

/**
 * analyze({ configs:[{file,text}], roots:[{path,name}], guard, index, settings })
 * settings: { ignoreReferences:[globs], exclude:[globs], disabledRules:[codes or aliases], reportOutside:bool }
 */
function analyze(opts) {
  const roots = opts.roots || [];
  const settings = opts.settings || {};
  const disabled = new Set((settings.disabledRules || []).map(resolveRuleId).filter(Boolean));
  const ignoreMatch = makeMatcher([].concat(settings.ignoreReferences || [], settings.exclude || []));
  const ctx = {
    links: new Map(),
    outDirs: [],
    roots,
    inside: (p) => opts.guard.inside(p),
    rootOf: (p) => opts.guard.rootOf(p),
  };
  const configs = (opts.configs || []).map(c => ({ ...c, ...getFormat(c.file) })).filter(c => c.format).sort((a,b) => a.format.order - b.format.order);
  ctx.guard = opts.guard;
  ctx.packageDirs = new Map();
  ctx.tsInfo = new Map();
  for (const c of configs) {
    try { c.format.prepare?.(c, ctx, settings); } catch (_) { /* malformed document */ }
  }
  const refs = [];
  for (const c of configs) {
    c.starts = lineStarts(c.text);
    c.lines = splitLines(c.text);
    let list = [];
    try {
      list = c.format.extract(c, ctx, settings);
    } catch (_) {
      list = [];
    }
    for (const r of list) {
      r.raw = (c.lines[r.line] || "").slice(r.col, r.endCol);
      refs.push(r);
    }
  }
  const env = {
    guard: opts.guard,
    index: opts.index,
    ignored: (abs, root) => {
      if (ctx.outDirs.some((d) => within(abs, d))) return true;
      return ignoreMatch(toPosix(path.relative(root, abs)));
    },
  };
  const findings = [];
  for (const ref of refs) {
    const r = evaluateRef(ref, env);
    ref.result = r;
    if (!r || r.state === "ok" || r.state === "skip") continue;
    const shown = '"' + ref.display + '"';
    let code = ref.code;
    let message;
    if (r.state === "outside") {
      code = "PM010";
      message = shown + " resolves outside the workspace - not checked (" + ref.label + ")";
      if (settings.reportOutside === false) continue;
    } else if (r.state === "context") {
      code = "PM011";
      message = shown + " is outside the Docker build context " + relFor(r.ctx, roots) + " - the build fails with \"forbidden path outside the build context\" (" + ref.label + ")";
    } else if (r.state === "glob") {
      code = "PM009";
      message = "No files match " + shown + " (" + ref.label + ")";
    } else if (r.state === "notdir") {
      message = shown + " is a file, a folder is expected (" + ref.label + ")";
    } else if (r.state === "notfile") {
      message = shown + " is a folder, a file is expected (" + ref.label + ")";
    } else if (r.state === "noentry") {
      message = shown + " has no " + ref.needFileIn.join(" / ") + " (" + ref.label + ")";
    } else {
      message = "Path not found: " + shown + (r.anywhere ? " (no file or folder with that name)" : "") + " (" + ref.label + ")";
    }
    if (disabled.has(code)) continue;
    const info = RULES[code].severity === "information";
    let fix = null;
    if (ref.escape !== "noedit" && !r.anywhere) {
      // An outside reference remains PM010. For absolute file paths, look
      // only in the workspace index for a possible relative replacement.
      const outsideAbsolute = r.state === "outside" &&
        path.isAbsolute(ref.value) && ref.kind === "file" && ref.fmt === "rel";
      const root = outsideAbsolute ? opts.guard.rootOf(ref.base) : r.root;
      if ((r.state === "missing" || outsideAbsolute) && root) {
        const confine = r.confine ? toPosix(path.relative(root, ref.base)) : "";
        const best = opts.index.suggest(root, outsideAbsolute ? ref.value : r.rel,
          ref.kind, confine && !confine.startsWith("..") ? confine : "");
        if (best) {
          const target = path.join(root, best);
          // Never offer a stale, ignored, or outside-workspace candidate.
          if ((!outsideAbsolute || opts.guard.status(target).state === "file") &&
              !env.ignored(target, root)) {
            const newText = formatPath(ref, target, ref.base);
            if (newText !== ref.display && encodeFor(ref, newText) !== null) fix = newText;
          }
        }
      }
    }
    findings.push({ file: ref.file, line: ref.line, col: ref.col, endCol: ref.endCol, code, message, info, fix, ref });
  }
  return { refs, findings, links: ctx.links };
}

module.exports = { analyze };
