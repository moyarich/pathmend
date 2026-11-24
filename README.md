# PathMend

Find and repair broken file references in configuration files and Markdown/MDX documents before they cause build, publishing or CI failures.

PathMend is a VS Code extension that checks local paths, suggests replacements and helps keep references up to date when files or folders move. It works locally, with no telemetry, network requests or external commands.

This version builds on the original [PathMend by Jay Tank](https://github.com/jay-tank/pathmend), with expanded file support, repair workflows and diagnostic views.

## Getting started

1. Install PathMend in VS Code and open a workspace folder.
2. Open the PathMend container in the Activity Bar. Diagnostics are generated automatically.
3. Choose **Open Reference Details** in Quick Actions to inspect and repair broken paths.
4. Use **Scan Workspace** to refresh the results manually.

The extension also reports diagnostics in the native Problems panel and offers Quick Fix actions for references with suggestions.

## What PathMend checks

| File type | Supported references |
| --- | --- |
| `package.json` | Main, module, types, typings, browser, bin, exports, files, workspaces and recognizable local script entry points |
| `tsconfig*.json`, `jsconfig*.json` | Relative extends, files, include, references, baseUrl, typeRoots and paths targets |
| Dockerfile / Containerfile | COPY and ADD sources, including JSON form and line continuations |
| Docker Compose | Build contexts and Dockerfile paths |
| GitHub Actions | Local actions, reusable workflows, working directories and recognizable script paths in run steps |
| GitLab CI | Local includes, including globs |
| CODEOWNERS | Literal paths and bare names |
| `.vscode/launch.json` | Workspace-relative program and cwd paths |
| Markdown | Local links, images, reference definitions and configured directive attributes |
| MDX | Markdown references, static relative imports/exports and configured JSX path attributes |

Paths are resolved according to their format: for example, package paths relative to the package directory, TypeScript paths relative to the effective baseUrl, Docker sources relative to a known build context, and Markdown links relative to their document.

Globs must match at least one indexed file. Dynamic expressions, external URLs and unsupported syntax are generally skipped rather than guessed.

## Find and repair broken references

### Broken References

The native tree groups diagnostics by source file. Select a reference to open its source location, hover for the complete message, or choose **Show Reference Details** from its context menu. Available suggestions can also be applied through the inline action.

### Reference Details

Open the same diagnostic interface in the sidebar or in an editor tab.

- Read fully wrapped messages, source locations and rule descriptions.
- Search references and filter by broken, not checked or fixable status.
- Expand or collapse file groups.
- Edit a generated suggested path before applying it. Reset restores the generated suggestion.
- Export all current diagnostics as JSON, regardless of the active filters.

Choose the default location in Settings, or use **Open Reference Details in Editor** and **Open Reference Details in Sidebar** to override it.

### Suggested paths

PathMend first looks for the same filename elsewhere in the workspace, then for similar names. Suggestions preserve the reference's path conventions where possible.

Use **Apply fix** to accept a suggestion or edit the suggested path before applying. If the edited target cannot be verified, PathMend asks for confirmation before proceeding. Unsafe replacement syntax, stale source edits and edits outside the workspace remain blocked.

Manual replacements currently require a generated suggestion. A diagnostic without a suggestion can still be opened and edited directly in its source file.

### Rename and move

When a file or folder is moved using VS Code, PathMend can offer to update references based on the pre-move scan.

- **Update all** applies the proposed edits and saves files that did not already have unsaved changes.
- **Preview** lets you review the changes in VS Code's native refactoring interface.
- **Ignore** leaves the references unchanged.

Markdown and MDX also support rebasing resolved local references when the referring document moves. Moves made outside VS Code are detected as broken references rather than automatically rewritten.

## Commands

Open the Command Palette and search for PathMend.

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

Use a rule code or its descriptive alias in `pathmend.disabledRules`. PM010 identifies paths outside the workspace that were not checked; it is informational, not proof that the target is missing.

## Settings

| Setting | Default | Purpose |
| --- | --- | --- |
| `pathmend.enabled` | `true` | Enable diagnostics. |
| `pathmend.exclude` | `["**/node_modules/**","**/.git/**","**/dist/**"]` | Exclude files and folders from scanning. |
| `pathmend.ignoreReferences` | `["**/build/**","**/out/**","**/coverage/**","**/target/**","**/.next/**"]` | Ignore references into matching paths. |
| `pathmend.disabledRules` | `[]` | Disable selected rule codes or aliases. |
| `pathmend.severity` | `"warning"` | Severity for broken references; PM010 remains informational. |
| `pathmend.reportOutsideWorkspace` | `true` | Report paths outside the workspace. |
| `pathmend.renameUpdates` | `"prompt"` | Enable or disable rename update prompts. |
| `pathmend.maxIndexedFiles` | `20000` | Limit files indexed for glob matching and suggestions. |
| `pathmend.maxConfigFileSizeKB` | `512` | Skip larger source files. |
| `pathmend.mdx.pathAttributes` | `["src","href"]` | JSX attributes to check. |
| `pathmend.markdown.directivePathAttributes` | `["component","code","files"]` | Directive attributes to check. |
| `pathmend.markdown.multiPathAttributes` | `["files"]` | Attributes containing multiple comma-separated paths. |
| `pathmend.referenceDetails.defaultLocation` | `"sidebar"` | Choose sidebar or editor. |

## Privacy and safety

PathMend runs locally without executing scripts, making network requests or collecting telemetry. It reads supported source files within workspace folders and checks the existence and type of referenced paths. References that resolve outside the workspace, including escaping symlinks, are not followed to their targets. Changes to source files require an explicit repair or rename action.

The extension supports untrusted workspaces. Review exported reports before sharing them because diagnostics can include workspace paths.

## Limitations

- Static reference scanning is not a complete parser or compiler for every supported format. Dynamic expressions, external URLs and ambiguous references are skipped.
- YAML support is conservative; complex flow collections and merged anchors are not followed.
- Docker build contexts supplied on the command line are not read, and .dockerignore is not applied.
- Shell script checks only recognize local paths in supported command positions; generated files may be reported missing.
- Markdown and MDX checks do not validate fragments or framework-specific routes; complex syntax and escaped or percent-encoded paths are not fully supported.
- Index limits can affect glob matching and suggestions. Rename updates for outgoing references in moved configuration files are limited; Markdown and MDX support document rebasing.

## Support and contributing

Report bugs or request features in the [issue tracker](https://github.com/moyarich/pathmend/issues). For development and contribution instructions, see [the development guide](readme-dev.md).

## Credits and license

PathMend was originally created by **Jay Tank**: [jay-tank/pathmend](https://github.com/jay-tank/pathmend).

This repository, [moyarich/pathmend](https://github.com/moyarich/pathmend), extends and refactors that original work. Credit for the original diagnostic engine and extension belongs to Jay Tank. The original MIT copyright and license notice is retained in [LICENSE](LICENSE). Third-party icon notices are included in [views/webview/icons/LICENSE](views/webview/icons/LICENSE).
