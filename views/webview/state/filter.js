/** Filter groups without modifying the source snapshot or losing full messages. */
export function filterReferences(files, filter, severity = "all", options = {}) {
  const query = filter.trim().toLowerCase();
  const { fileType = "", rule = "", currentOnly = false, currentFile = null, sort = "path" } = options;
  const selected = files.filter(file => (!fileType || file.path.toLowerCase().endsWith("." + fileType)) && (!currentOnly || file.path === currentFile));
  return selected.map(file => ({
    ...file,
    findings: file.findings.filter(f => {
      if (rule && f.code !== rule) return false;
      if (severity === "broken" && f.notChecked) return false;
      if (severity === "info" && !f.notChecked) return false;
      if (severity === "fixable" && !f.fix) return false;
      return [file.path, f.path, f.code, f.alias, f.rule, f.message, f.fix]
        .some(value => String(value || "").toLowerCase().includes(query));
    }),
  })).filter(file => file.findings.length).sort((a,b) => {
    const rank = file => Math.min(...file.findings.map(f => ({error:0,warning:1,information:2,hint:3})[f.severity] ?? 4));
    return (sort === "count" ? b.findings.length - a.findings.length : sort === "severity" ? rank(a) - rank(b) : 0) || a.path.localeCompare(b.path);
  });
}
