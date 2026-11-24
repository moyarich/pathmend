/** Filter groups without modifying the source snapshot or losing full messages. */
export function filterReferences(files, filter) {
  const query = filter.trim().toLowerCase();
  return files.map(file => ({
    ...file,
    findings: file.findings.filter(f =>
      [file.path, f.path, f.code, f.alias, f.rule, f.message, f.fix]
        .some(value => String(value || "").toLowerCase().includes(query))
    ),
  })).filter(file => file.findings.length);
}
