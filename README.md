# PathMend

**Find and fix broken file paths before they break your build, package or CI.**

PathMend checks local references in configuration files and Markdown/MDX documents, suggests repairs, and helps update references when files or folders move.

Everything runs locally in VS Code — no network requests, telemetry or external commands.

Based on the original [PathMend by Jay Tank](https://github.com/jay-tank/pathmend), with expanded file support, repair workflows and diagnostic views.

[Getting started](#getting-started) · [Supported files](#supported-files) · [Repair references](#repair-references) · [Commands](#commands) · [Rules](#diagnostic-rules) · [Settings](#settings) · [Limitations](#limitations)

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

## Supported files

| File type | References checked |
| --- | --- |
| `package.json` | `main`, `module`, `types`, `typings`, `browser`, `bin`, `exports`, `files`, `workspaces`, local script entry points |
| `tsconfig*.json`, `jsconfig*.json` | Relative `extends`, `files`, `include`, `references`, `baseUrl`, `typeRoots`, `paths` |
| Dockerfile / Containerfile | `COPY` and `ADD` sources, including JSON form and line continuations |
| Docker Compose | Build contexts and Dockerfile paths |
| GitHub Actions | Local actions, reusable workflows, working directories, recognizable script paths in `run` steps |
| GitLab CI | Local includes, including globs |
| CODEOWNERS | Literal paths and bare names |
| `.vscode/launch.json` | Workspace-relative `program` and `cwd` |
| Markdown | Local links, images, reference definitions and configured directive attributes |
| MDX | Markdown references, static relative imports/exports and configured JSX path attributes |

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
- Search and filter by broken, not checked or fixable status.
- Expand or collapse file groups.
- Edit suggested paths and reset them to their original suggestion.
- Export all current diagnostics as JSON, regardless of active filters.

Set the preferred location with `pathmend.referenceDetails.defaultLocation`. The explicit **Open Reference Details in Editor** and **Open Reference Details in Sidebar** commands override that preference.

### Choose a replacement path

Use **Browse…** to select a file or folder using the native VS Code picker. Typing in the replacement field offers matching indexed workspace paths. Only eligible paths within the workspace and reference context are offered; excluded paths are omitted. Suggestions are limited to indexed paths and may not include every file.

### Apply a suggested path

PathMend looks for the same filename elsewhere in the workspace first, then for similar names. Suggestions preserve the original path conventions where possible.

1. Review or edit the generated suggested path.
2. Select **Apply fix** (or use **Reset** to restore the suggestion).
3. If the edited target cannot be verified, choose whether to apply it anyway or cancel.

Unsafe syntax, stale source edits and edits outside the workspace are blocked. For safely editable literal references without a suggestion, enter a replacement path manually. Glob patterns, unanchored CODEOWNERS names and unsupported edit syntax may still require editing the source directly. The Fixable filter counts generated suggestions.

### Rename or move files

When a file or folder moves in VS Code, PathMend can offer updates based on the pre-move scan.

| Action | Result |
| --- | --- |
| **Update all** | Apply proposed edits and save files that did not already have unsaved changes. |
| **Preview** | Review proposed edits in VS Code's native refactoring interface. |
| **Ignore** | Leave references unchanged. |

Markdown and MDX also support rebasing resolved local references when the referring document moves. Moves outside VS Code are detected as broken references rather than automatically rewritten.

## Commands

Search for **PathMend** in the Command Palette.

| Command | Purpose |
| --- | --- |
| Open Reference Details | Open the preferred diagnostic view |
| Open Reference Details in Editor | Open an editor tab |
| Open Reference Details in Sidebar | Reveal the sidebar |
| Scan Workspace | Rebuild the file index and scan |
| Show Broken References | Search findings and reveal the selected reference |
| Export Results as JSON | Save the complete diagnostic report |
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

### Scan scope and limits

| Setting | Default | Purpose |
| --- | --- | --- |
| `pathmend.exclude` | `["**/node_modules/**", "**/.git/**", "**/dist/**"]` | Exclude files and folders from scanning. |
| `pathmend.ignoreReferences` | `["**/build/**", "**/out/**", "**/coverage/**", "**/target/**", "**/.next/**"]` | Ignore references into matching paths. |
| `pathmend.disabledRules` | `[]` | Disable selected rule codes or aliases. |
| `pathmend.maxIndexedFiles` | `20000` | Limit files indexed for glob matching and suggestions. |
| `pathmend.maxConfigFileSizeKB` | `512` | Skip larger source files. |

### Markdown and MDX

| Setting | Default | Purpose |
| --- | --- | --- |
| `pathmend.mdx.pathAttributes` | `["src", "href"]` | JSX attributes to check. |
| `pathmend.markdown.directivePathAttributes` | `["component", "code", "files"]` | Directive attributes to check. |
| `pathmend.markdown.multiPathAttributes` | `["files"]` | Attributes containing multiple comma-separated paths. |

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
| Large workspaces | Index limits can affect glob matching and suggestions. |
| Moved source files | Outgoing reference updates in moved configuration files are limited. Markdown and MDX support document rebasing. |

## Support and contributing

[Report a bug or request a feature](https://github.com/moyarich/pathmend/issues) · [Development guide](readme-dev.md)

## Credits and license

Originally created by **Jay Tank** — [jay-tank/pathmend](https://github.com/jay-tank/pathmend).

This repository, [moyarich/pathmend](https://github.com/moyarich/pathmend), extends and refactors the original work. Credit for the original diagnostic engine and extension belongs to Jay Tank.

Licensed under the [MIT License](LICENSE), with the original copyright and license notice preserved. Third-party icon notices are included in [views/webview/icons/LICENSE](views/webview/icons/LICENSE).
