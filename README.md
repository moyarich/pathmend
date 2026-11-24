# PathMend

**Find and fix broken file paths before they break your build, package or CI.**

PathMend checks local file references in source code, configuration files, workspace manifests and Markdown/MDX documents. Find broken paths, review suggested repairs, update references after moves, and scan projects from VS Code or the command line.

Scanning runs locally, in VS Code or through the standalone Node.js CLI. No network requests, telemetry or project script execution.

Based on the original [PathMend by Jay Tank](https://github.com/jay-tank/pathmend), with expanded file support, repair workflows and diagnostic views.

[Getting started](#getting-started) · [CLI](#command-line-scanning) · [Supported files](#supported-files) · [Repair references](#repair-references) · [Export reports](#export-reports) · [Commands](#commands) · [Rules](#diagnostic-rules) · [Settings](#settings) · [Limitations](#limitations)

## Getting started

1. Install PathMend in VS Code and open a workspace folder.
2. Select the PathMend icon in the Activity Bar. Diagnostics appear automatically.
3. Choose **Open Reference Details** in Quick Actions to inspect and repair references.

Use **Scan Workspace** to refresh results manually. Diagnostics also appear in VS Code's Problems panel, with Quick Fix actions where suggestions are available.

### Example

You move `scripts/start.sh` to `tools/start.sh`, but a Dockerfile still contains:

```dockerfile
COPY scripts/start.sh /usr/local/bin/
```

PathMend can report PM003 and suggest the new path if it is a suitable match within the build context. Review the suggestion before applying it.

## Command-line scanning

Run PathMend without VS Code using Node.js 20 or newer from a checkout:

```bash
node src/cli/index.js --workspace . --format sarif > pathmend.sarif
```

A locally installed npm package exposes the `pathmend` command via its `bin` entry (`npm pack` can create a local tarball; registry publication is not required). Use `--config ./pathmend.config.json` to supply JSON settings such as `exclude`, `ignoreReferences`, `disabledRules`, `yamlPathAttributes`, `maxIndexedFiles` and `maxFileSizeKB`. The command writes reports to stdout and exits 0 when no broken references are found, 1 for broken references and 2 for usage or scan errors. Outside-workspace references are informational. Directory symlinks are not followed. In CI, preserve the exit status while uploading the report as an artifact or SARIF to code scanning.

## Supported files

PathMend supports the following local references. Dynamic expressions, remote URLs and ambiguous syntax are skipped rather than guessed.

| File type | References checked |
| --- | --- |
| `package.json` | `main`, `module`, `types`, `typings`, `browser`, `bin`, `exports`, `files`, `workspaces`, local script entry points, `file:`, `link:` and `workspace:` dependencies |
| `tsconfig*.json`, `jsconfig*.json` | Relative `extends`, `files`, `include`, `references`, `baseUrl`, `typeRoots`, `paths` |
| Dockerfile / Containerfile | `COPY` and `ADD` sources, including JSON form and line continuations |
| Docker Compose | Build contexts and Dockerfile paths |
| GitHub Actions | Local actions, reusable workflows, working directories, recognizable script paths in `run` steps |
| GitLab CI | Local includes, including globs |
| CODEOWNERS | Literal paths and bare names |
| `.vscode/launch.json` | Workspace-relative `program` and `cwd` |
| `.code-workspace` | Folder paths and unambiguous task/launch references |
| `pnpm-workspace.yaml` | Workspace package patterns and exclusions |
| `.vscode/tasks.json` | Explicit local commands and working directories |
| Dev container configuration | Dockerfile, context and Compose file paths |
| `.gitmodules` | Submodule checkout paths (diagnostics only) |
| `pyproject.toml` | Poetry/uv inline local dependency paths |
| YAML | Opt-in local path attributes |
| CSS / SCSS | `url()` and quoted `@import` (explicit SCSS extensions) |
| HTML | `src`, `href`, simple `srcset`, including unquoted paths |
| JavaScript / TypeScript | Static relative imports and exports, including simple multiline declarations |
| Markdown | Local links, images, reference definitions and configured directive attributes |
| MDX | Markdown references, static relative imports/exports and configured JSX path attributes |

**Workspace packages:** npm, Yarn and pnpm membership patterns and exclusions are checked; missing named `workspace:` dependencies and duplicate package names are reported. Version range compatibility is not checked. Ambiguous npm script workspace names are skipped. Workspace configuration files must be within opened roots.

**YAML:** set `pathmend.yaml.pathAttributes` to `["asset", "source"]`, for example, to check explicit relative paths in these properties. Existing format-specific rules take precedence. Uninitialized submodules may produce missing-checkout diagnostics.

**How paths are resolved:** package paths are relative to the package directory; TypeScript paths use the effective `baseUrl`; Docker sources use the known build context; Markdown links are relative to their document. Globs must match at least one indexed file. Dynamic expressions, external URLs and unsupported syntax are generally skipped rather than guessed.

## Repair references

### Broken References

The native tree groups diagnostics by source file.

- Select a reference to open its source location.
- Hover to read the complete message.
- Right-click and choose **Show Reference Details** for a more readable view.
- Use the inline action to apply an available suggestion.

### Reference Details

Use this view in the sidebar or an editor tab to:

- Read fully wrapped messages, source locations and rule descriptions.
- Search by path, message or rule; filter by status, file type, rule or current file, and sort results.
- Expand or collapse file groups.
- Edit suggested paths and reset them to their original suggestion.
- Select suggested repairs individually, by file or across visible results.
- Export all current diagnostics in your chosen format, regardless of active filters.

Set the preferred location with `pathmend.referenceDetails.defaultLocation`. The explicit **Open Reference Details in Editor** and **Open Reference Details in Sidebar** commands override that preference.

### Preview a repair

Choose **Preview** beside a replacement to compare the current source with the proposed change in VS Code’s diff editor. Choose **Apply** or **Cancel** after reviewing the diff. Previewing does not write files; existing unsaved edits are preserved.

### Bulk repairs

1. Tick the checkbox on the right of a reference to select its suggested repair.
2. Use a file group's right-hand checkbox to select its visible suggestions, or **Select visible fixes** to select across filtered results. A partially selected group shows an indeterminate checkbox.
3. Check the selection count. References hidden by filters remain selected; use **Clear selection** to start over.
4. Choose **Bulk repairs (N)** to review the native diff for each affected file, then confirm **Apply all**.

Only references with an editable suggested replacement can be selected. Bulk repairs use the original suggestions, not manually edited replacement drafts. A refreshed diagnostic snapshot clears the selection. PathMend revalidates every selected repair and rejects stale or overlapping edits. Changes are applied as one workspace edit and remain unsaved for review or undo.

### Editor navigation and preferences

- Open valid local references using editor document links; hover over broken references for details.
- Enable `pathmend.editor.codeLens` for inline repair previews.
- Use **Scan File or Folder References** from Explorer to refresh the workspace scan and inspect a selection.

Reference Details retains filter, sort and disclosure preferences, and restores editor tabs when VS Code restores them. Diagnostics are refreshed on restoration. Collapsed groups render on demand; unchanged Markdown/MDX extraction is reused while target existence and context are rechecked.

### Choose a replacement path

Use **Browse…** to select a file or folder using the native VS Code picker. Typing in the replacement field offers matching indexed workspace paths. Only eligible paths within the workspace and reference context are offered; excluded paths are omitted. Suggestions are limited to indexed paths and may not include every file.

### Apply a suggested path

PathMend looks for the same filename elsewhere in the workspace first, then for similar names. Suggestions preserve the original path conventions where possible.

1. Review or edit the generated suggested path.
2. Review the live validation message. It distinguishes verified paths, missing targets, wrong file/folder types, outside-workspace or build-context paths, and invalid syntax.
3. Select **Apply fix** (or use **Reset** to restore the suggestion).
4. If the edited target cannot be verified, choose whether to apply it anyway or cancel. Invalid syntax cannot be applied.

Unsafe syntax, stale source edits and edits outside the workspace are blocked. For safely editable literal references without a suggestion, enter a replacement path manually. Glob patterns, unanchored CODEOWNERS names and unsupported edit syntax may still require editing the source directly. The Fixable filter counts generated suggestions.

### Rename or move files

When a file or folder moves in VS Code, PathMend can offer updates based on the pre-move scan.

| Action | Result |
| --- | --- |
| **Update all** | Apply proposed edits and save files that did not already have unsaved changes. |
| **Preview** | Review proposed edits in VS Code's native refactoring interface. |
| **Ignore** | Leave references unchanged. |

Markdown and MDX also support rebasing resolved local references when the referring document moves. Moves outside VS Code are detected as broken references rather than automatically rewritten.

## Export reports

Choose **Export** in Reference Details (or the export command in the Command Palette), select a format, and choose a destination using the native save dialog. Exports contain the complete diagnostic set, not just filtered or selected references.

| Format | Best for |
| --- | --- |
| JSON | Automation and structured diagnostic data |
| SARIF | CI and code scanning |
| Markdown | Pull requests and review notes |
| CSV | Spreadsheets (formula-like values are escaped) |
| HTML | Standalone, offline report |

The CLI supports the same formats with `--format json`, `sarif`, `md`, `csv` or `html`. Review reports before sharing because they can contain workspace paths.

## Commands

Search for **PathMend** in the Command Palette.

| Command | Purpose |
| --- | --- |
| Open Reference Details | Open the preferred diagnostic view |
| Open Reference Details in Editor | Open an editor tab |
| Open Reference Details in Sidebar | Reveal the sidebar |
| Scan Workspace | Rebuild the file index and scan |
| Show Broken References | Search findings and reveal the selected reference |
| Export Results as JSON | Choose JSON, SARIF, Markdown, CSV or HTML and save the complete report |
| Scan File or Folder References | Refresh and inspect a selected file or folder |
| Preview Path Repair | Review a suggested change in the diff editor |
| Open PathMend Settings | Configure the extension |

Quick Actions provides shortcuts to Reference Details, scanning and settings. The status bar and view badges display broken-reference counts.

## Diagnostic rules

Use a rule code or its descriptive alias in `pathmend.disabledRules`.

> **Note:** PM010 is informational. It means a path resolves outside the workspace and was not checked, not necessarily that the target is missing.

| Code | Rule alias | Category | Description |
| --- | --- | --- | --- |
| **PM001** | `package-path-not-found` | package | package.json path not found |
| **PM002** | `tsconfig-path-not-found` | typescript | tsconfig / jsconfig path not found |
| **PM003** | `docker-source-not-found` | docker | Dockerfile COPY / ADD source not found |
| **PM004** | `compose-path-not-found` | docker | Compose build context / dockerfile not found |
| **PM005** | `github-actions-path-not-found` | ci | GitHub Actions path not found |
| **PM006** | `codeowners-path-not-found` | ownership | CODEOWNERS path not found |
| **PM007** | `launch-path-not-found` | editor | launch.json path not found |
| **PM008** | `gitlab-include-not-found` | ci | GitLab CI local include not found |
| **PM009** | `glob-no-matches` | filesystem | Glob matches no files |
| **PM010** | `outside-workspace` | security | Resolves outside the workspace - not checked (Information) |
| **PM011** | `outside-docker-context` | docker | COPY / ADD source outside the Docker build context |
| **PM012** | `markdown-path-not-found` | markdown | Markdown link or image path not found |
| **PM013** | `mdx-module-not-found` | mdx | MDX import or export path not found |
| **PM014** | `mdx-attribute-path-not-found` | mdx | MDX JSX attribute path not found |
| **PM015** | `directive-path-not-found` | markdown | Markdown directive path not found |
| **PM016** | `stylesheet-path-not-found` | css | Stylesheet asset or import path not found |
| **PM017** | `html-path-not-found` | html | HTML local resource path not found |
| **PM018** | `script-module-not-found` | javascript | Static relative script import or export path not found |
| **PM019** | `task-path-not-found` | editor | VS Code task local path not found |
| **PM020** | `devcontainer-path-not-found` | editor | Dev container local configuration path not found |
| **PM021** | `gitmodule-path-not-found` | git | Git submodule checkout path not found |
| **PM022** | `python-dependency-path-not-found` | python | Python local dependency path not found |
| **PM023** | `yaml-attribute-path-not-found` | yaml | Configured YAML local path attribute not found |
| **PM024** | `workspace-folder-path-not-found` | editor | VS Code workspace folder or configuration path not found |
| **PM025** | `pnpm-workspace-path-not-found` | package | pnpm workspace package path not found |
| **PM026** | `local-package-path-not-found` | package | Local package dependency path not found |
| **PM027** | `workspace-package-not-found` | package | Named workspace dependency not found |
| **PM028** | `duplicate-workspace-package` | package | Duplicate workspace package name |

## Settings

Open **PathMend: Open PathMend Settings** or edit your VS Code `settings.json`.

For example, to open Reference Details in an editor and disable CODEOWNERS diagnostics:

```json
{
  "pathmend.referenceDetails.defaultLocation": "editor",
  "pathmend.disabledRules": ["PM006"]
}
```

### General

| Setting | Default | Purpose |
| --- | --- | --- |
| `pathmend.enabled` | `true` | Enable diagnostics. |
| `pathmend.severity` | `"warning"` | Severity for broken references; PM010 remains informational. |
| `pathmend.reportOutsideWorkspace` | `true` | Report paths outside the workspace. |
| `pathmend.renameUpdates` | `"prompt"` | Enable or disable rename update prompts. |
| `pathmend.referenceDetails.defaultLocation` | `"sidebar"` | Choose sidebar or editor. |
| `pathmend.editor.codeLens` | `false` | Show inline repair preview actions. |

### Scan scope and limits

| Setting | Default | Purpose |
| --- | --- | --- |
| `pathmend.exclude` | `["**/node_modules/**", "**/.git/**", "**/dist/**"]` | Exclude files and folders from scanning. |
| `pathmend.ignoreReferences` | `["**/build/**", "**/out/**", "**/coverage/**", "**/target/**", "**/.next/**"]` | Ignore references into matching paths. |
| `pathmend.disabledRules` | `[]` | Disable selected rule codes or aliases. |
| `pathmend.maxIndexedFiles` | `20000` | Limit files indexed for glob matching and suggestions. |
| `pathmend.maxConfigFileSizeKB` | `512` | Skip larger source files. |

### Markdown, MDX and YAML

| Setting | Default | Purpose |
| --- | --- | --- |
| `pathmend.mdx.pathAttributes` | `["src", "href"]` | JSX attributes to check. |
| `pathmend.markdown.directivePathAttributes` | `["component", "code", "files"]` | Directive attributes to check. |
| `pathmend.markdown.multiPathAttributes` | `["files"]` | Attributes containing multiple comma-separated paths. |
| `pathmend.yaml.pathAttributes` | `[]` | YAML property names containing explicit relative local paths. |

## Privacy and safety

- **Local only:** no script execution, network requests or telemetry.
- **Workspace boundaries:** reads supported source files within workspace folders and checks the existence and type of referenced paths. Paths resolving outside the workspace, including escaping symlinks, are not followed to their targets.
- **Explicit edits:** source files change only through a repair or rename action you choose.
- **Workspace Trust:** supports untrusted workspaces.

Review exported reports before sharing them; diagnostics can contain workspace paths.

## Limitations

| Area | What to know |
| --- | --- |
| Static analysis | Dynamic expressions, external URLs and ambiguous references are skipped. Supported formats are not fully parsed or compiled. |
| YAML | Complex flow collections and merged anchors are not followed. |
| Docker | Command-line build contexts are not read; `.dockerignore` is not applied. |
| Scripts | Only recognizable local paths in supported command positions are checked. Generated files may be reported missing. |
| Markdown / MDX | Fragments and framework-specific routes are not validated. Complex syntax and escaped or percent-encoded paths are not fully supported. |
| Workspace packages | Named package existence and duplicate names are checked, not semantic version compatibility. Workspace files outside opened roots are not scanned. |
| Source files | Static references only; SCSS extensionless partials, complex JS/TS syntax, and framework routes may be skipped. |
| Large workspaces | Index limits can affect glob matching and suggestions. |
| Moved source files | Outgoing reference updates in moved configuration files are limited. Markdown and MDX support document rebasing. |

## Support and contributing

[Report a bug or request a feature](https://github.com/moyarich/pathmend/issues) · [Development guide](readme-dev.md)

## Credits and license

Originally created by **Jay Tank** — [jay-tank/pathmend](https://github.com/jay-tank/pathmend).

This repository, [moyarich/pathmend](https://github.com/moyarich/pathmend), extends and refactors the original work. Credit for the original diagnostic engine and extension belongs to Jay Tank.

Licensed under the [MIT License](LICENSE), with the original copyright and license notice preserved. Third-party icon notices are included in [views/webview/icons/LICENSE](views/webview/icons/LICENSE).
