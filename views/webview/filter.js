/** Filter groups without modifying the source snapshot or losing full messages. */
export function filterReferences(files, filter, severity = "all") {
  const query = filter.trim().toLowerCase();
  return files.map(file => ({
    ...file,
    findings: file.findings.filter(f => {
      if (severity === "broken" && f.notChecked) return false;
      if (severity === "info" && !f.notChecked) return false;
      if (severity === "fixable" && !f.fix) return false;
      return [file.path, f.path, f.code, f.alias, f.rule, f.message, f.fix]
        .some(value => String(value || "").toLowerCase().includes(query));
    }),
  })).filter(file => file.findings.length);
}
