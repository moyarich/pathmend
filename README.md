# PathMend: Find Broken Paths in Config and Documentation Files

**Find broken paths in your config and documentation files after a move or rename** - before CI, `docker build` or `npm publish` does.

You move `scripts/start.sh` to `tools/start.sh`. The editor updates the imports in your code,
the tests pass, and you push. Then CI fails, because a string in a config file still says
`scripts/start.sh`:

- the Dockerfile has `COPY scripts/start.sh /usr/local/bin/`, so the image build fails with
  `COPY failed: file not found in build context`
- `package.json` has `"bin": "scripts/start.sh"`, so the published package is broken
- a workflow has `run: bash scripts/start.sh`, or `working-directory: services/old-name`
- `CODEOWNERS` still lists `/scripts/`, so reviews stop being requested

Tools that check import paths only look at code. PathMend looks at the **config files**, where
these paths are plain strings that nothing else checks.

Real examples:

- [software-mansion/react-native-reanimated#3026](https://github.com/software-mansion/react-native-reanimated/issues/3026) - "Package json main points to non existing file", shipped in a release.
- [docker/build-push-action#97](https://github.com/docker/build-push-action/issues/97) - "What's the Context for COPY?" - a Dockerfile COPY path that does not match the build context.

## What it checks

| File                                                          | Paths checked                                                                                                                                                                                                                                                                                | Relative to                                                                                                                                    |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`                                                | `main` (with Node's `.js` / `index.js` fallbacks), `module`, `types`, `typings`, `browser`, `bin`, `exports` (including `*` patterns), `files`, `workspaces`, `scripts` : local script entry points (for example `tsx scripts/build.ts`, `node ./scripts/start.js`, `bash scripts/setup.sh`) | the package folder                                                                                                                             |
| `tsconfig*.json`, `jsconfig*.json`                            | `extends` (relative paths only), `files`, `include`, `references` (folder must contain `tsconfig.json`), `compilerOptions.baseUrl` and `compilerOptions.typeRoots`                                                                                                                           | the tsconfig folder                                                                                                                            |
|                                                               | `compilerOptions.paths` targets: a `*` target must match at least one file, any other target must resolve like a module (`.ts`, `.tsx`, `.d.ts`, `.js`, `.json`, ... or an `index` file)                                                                                                     | the `baseUrl` of that tsconfig, or the one it inherits through relative `extends`, otherwise the tsconfig folder                               |
| `Dockerfile`, `Dockerfile.*`, `*.Dockerfile`, `Containerfile` | `COPY` / `ADD` sources, shell and JSON form, line continuations, heredocs skipped                                                                                                                                                                                                            | the build context from a Compose file that uses this Dockerfile, otherwise the Dockerfile folder (or a parent folder up to the workspace root) |
| `docker-compose*.yml`, `compose*.yaml`                        | `build:` / `build.context`, `build.dockerfile`                                                                                                                                                                                                                                               | the compose file folder / the context                                                                                                          |
| `.github/workflows/*.yml`, `.github/**/action.yml`            | `working-directory` (workflow, job and step), local `uses: ./...` (must contain `action.yml`, `action.yaml` or `Dockerfile`), reusable `uses: ./.github/workflows/x.yml`, scripts started from `run:` (`./x.sh`, `bash scripts/x.sh`, `python tools/x.py`, `node x.js`, `source ./env.sh`)   | the repository root, or the effective `working-directory`                                                                                      |
| `.gitlab-ci.yml`                                              | `include:` local files (string or `local:`), including `*` / `**` globs                                                                                                                                                                                                                      | the repository root                                                                                                                            |
| `CODEOWNERS` (root, `.github/`, `docs/`, `.gitlab/`)          | patterns without wildcards; `/path` and `dir/file` are anchored, a bare name matches anywhere                                                                                                                                                                                                | the repository root                                                                                                                            |
| `.vscode/launch.json`                                         | `program`, `cwd` that start with `${workspaceFolder}` or `${workspaceFolder:Name}`                                                                                                                                                                                                           | that workspace folder                                                                                                                          |
| `.md`, `.mdx` | Local Markdown links, images, reference definitions and configured directive attributes | the document folder |
| `.mdx` | Static relative imports/exports and configured JSX path attributes | the document folder |

A glob is fine when it matches at least one file. Skipped on purpose: `COPY --from=<stage>`,
URLs and git contexts, anything with `$VAR`, `${VAR}` or `${{ }}`, bare package specifiers
in `extends`, `paths` in a tsconfig that may inherit its `baseUrl` from a package in
`extends` (or whose `baseUrl` is itself missing), jobs whose `actions/checkout` uses a custom
`path:`, and references into build
output folders (see `pathmend.ignoreReferences`; the `outDir` of your tsconfigs is added
automatically, so `"main": "build/index.js"` is not reported before a build).

## Rules

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

### Rule examples

| Code | Example |
| --- | --- |
| **PM001** | `"bin": { "tool": "bin/tool.js" }` after moving it to `lib/` |
| **PM002** | `"extends": "./tsconfig.bse.json"` |
| **PM003** | `COPY scripts/start.sh /usr/local/bin/` |
| **PM004** | `context: ./services/wrker` |
| **PM005** | `uses: ./.github/actions/setpu`, `run: bash scripts/build.sh` |
| **PM006** | `/docs/guid.md @docs-team` |
| **PM007** | `"program": "${workspaceFolder}/src/server.js"` |
| **PM008** | `- local: ci/templates/tset.yml` |
| **PM009** | `"files": ["docs/*.pdf"]`, `COPY config/*.yaml /app/` |
| **PM010** | `"main": "/etc/passwd"`, `../../elsewhere` |
| **PM011** | `COPY ../../src /src` with context `services/api` |
| **PM012** | `[Guide](./guide.md)` |
| **PM013** | `import Demo from "./Demo.tsx"` |
| **PM014** | `<img src="./image.png" />` |
| **PM015** | `:::code-preview{component="./Example.tsx"}` |

Rule IDs are stable; descriptive aliases can also be used in `pathmend.disabledRules` (for example, `["PM006", "outside-workspace"]`). Categories and tags describe rules; they are not disable selectors. Most rules use the configured severity; PM010 remains informational. A rule may support suggestions, but actual Quick Fix availability depends on the finding.

### Markdown and MDX

The dependency-free scanner checks static local references, including link fragments
(the fragment is preserved and is not validated). It skips external URLs, root-relative
site routes, bare module imports, dynamic expressions, frontmatter, fenced code and
inline code. It is not a full CommonMark or MDX parser: complex syntax, escaped or
percent-encoded paths and framework-specific resolution are not supported. Only safe
single-line path replacements are offered; moving the referring Markdown or MDX document rebases its static local paths. Folder moves and simultaneous document/target moves are supported for references resolved before the move.

Configure JSX and directive attributes in VS Code settings:

```json
{
  "pathmend.mdx.pathAttributes": [
    "src",
    "href",
    "component"
  ],
  "pathmend.markdown.directivePathAttributes": [
    "component",
    "code",
    "files"
  ],
  "pathmend.markdown.multiPathAttributes": [
    "files"
  ]
}
```

Each diagnostic sits on the exact path string, with source `PathMend`.

## Quick Fix: "Did you mean ...?"

For a missing path, PathMend looks for the closest existing file or folder in the workspace:
the same file name in another folder first (the usual "moved it" case), otherwise a close
spelling of the name. The fix keeps your style - a leading `./`, a leading `/` in CODEOWNERS
and GitLab includes, `${workspaceFolder}` in launch.json, a trailing `/` - and for Dockerfiles
only suggests files inside the build context.

## Rename and move: update all references

When you rename or move a file or folder in VS Code (Explorer, drag and drop, or a refactoring),
PathMend compares with the references it saw before the move and shows:

> 3 config references still point to src/utils - update all?

- **Update all** rewrites those strings in the config files and saves them.
- **Preview** opens the standard refactor preview, so you can review and untick edits.
- **Ignore** leaves them - they then show up as normal diagnostics.

Only supported config and documentation files inside the workspace are edited. Renames done outside VS Code (for example
`git mv` in a terminal) are not seen as renames; the references simply show up as broken.

## Settings

| Setting                           | Default                                                                     | Description                                                                                       |
| --------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `pathmend.enabled`                | `true`                                                                      | Turn diagnostics on or off.                                                                       |
| `pathmend.exclude`                | `**/node_modules/**`, `**/.git/**`, `**/dist/**`                            | Globs that are not scanned. Config files here are not read; references into them are not checked. |
| `pathmend.ignoreReferences`       | `**/build/**`, `**/out/**`, `**/coverage/**`, `**/target/**`, `**/.next/**` | Build output folders; references into them are not checked.                                       |
| `pathmend.disabledRules`          | `[]`                                                                        | Rule IDs or aliases to turn off, e.g. `["PM006", "PM010"]`.                                                |
| `pathmend.severity`               | `warning`                                                                   | `error`, `warning`, `information` or `hint` for broken references. PM010 is always Information.   |
| `pathmend.reportOutsideWorkspace` | `true`                                                                      | Show PM010 for paths outside the workspace.                                                       |
| `pathmend.renameUpdates`          | `prompt`                                                                    | `off` to never offer rename updates.                                                              |
| `pathmend.maxIndexedFiles`        | `20000`                                                                     | Files indexed for glob matching and suggestions.                                                  |
| `pathmend.maxConfigFileSizeKB`    | `512`                                                                       | Larger config files are skipped.                                                                  |

## Activity bar and commands

PathMend has two views in the same activity bar container: **Broken References** (native tree navigation) and **Reference Details** (expand the collapsed webview for fully wrapped messages, suggested paths, text and reference-type filtering, expand/collapse controls, clickable paths and Apply fix actions). Both use the same live diagnostics and guarded commands. The webview uses VS Code theme colors and local assets only.

- **Activity bar** - the PathMend view lists every broken reference, grouped by config file.
  Each row is labelled with the rule and the exact path string (for example
  `PM003  scripts/start.sh`), shows a compact line and column next to it (for example `L6:6`), and opens the file on that
  path when clicked. Hover to read the full diagnostic, rule description, location and suggested fix,
  or right-click and choose **Show reference details** to reveal the corresponding message in Reference Details.
  VS Code's native tree rows are single-line; long paths may still be shortened visually. Rows with a suggestion have an inline **Apply suggested path** action (the
  same edit as the "Did you mean ...?" Quick Fix). The badge shows the number of broken
  references; the title bar has **Show broken references** and **Scan workspace**.
- **PathMend: Open Reference Details** - open the multiline webview from the Command Palette, the Broken References toolbar, or the **PathMend** submenu in either view’s `…` menu.
- **PathMend: Export Results** - save all current diagnostics as a JSON report using VS Code's native Save dialog. Export includes rule codes, messages, source positions and suggested fixes, regardless of webview filters. Review the report before sharing because diagnostic messages may contain workspace paths.
- **PathMend: Scan workspace** - rebuild the file index and check every config file.
- **PathMend: Show broken references** - pick a broken reference and jump to it.

The status bar shows the number of broken references; click it for the same list. Files
created, deleted or moved outside VS Code (for example by `git checkout`) are picked up when
the window regains focus and once a minute, even where the editor's file watcher misses them.

## Privacy and safety

- **No network, no telemetry, no child processes.** PathMend never runs git, docker, node or
  any other program.
- **Only supported config and documentation files are read.** They are found with the editor's own file search inside your
  workspace folders. Referenced files are only checked for **existence** - their contents are
  never opened.
- **Nothing outside the workspace is touched.** A path from a config file is resolved first,
  and is only checked when it lies inside a workspace folder. Symlinks are followed one step at
  a time; a link that leads outside the workspace stops the check before anything behind it is
  touched. Absolute paths, `../` escapes and escaping symlinks are reported as PM010
  ("outside the workspace - not checked"). A config file that is itself a symlink to outside
  the workspace is not read.
- **Works in untrusted workspaces**, because it only reads config files and checks whether
  paths exist.
- Edits happen only when you choose a Quick Fix or a rename update, and only in config files
  inside the workspace.

## Limitations

- The YAML reader is line-oriented: block maps and sequences, block scalars, one-line flow
  lists, quotes, comments. Multi-line flow collections and anchors merged with `<<:` are not
  followed.
- The Docker build context is only known when a Compose file points at the Dockerfile.
  Contexts passed on the command line (`docker build -f docker/Dockerfile .`) or in
  `docker/build-push-action` are not read, so a source is accepted if it exists relative to the
  Dockerfile folder or any parent folder up to the workspace root. `.dockerignore` is not
  applied.
- `run:` scripts are only recognised in command position (`./x.sh`, or after `bash`, `sh`,
  `python`, `node` and similar). Files created earlier in the same step are reported as missing.
- Glob matching and "did you mean" use an index of up to `pathmend.maxIndexedFiles` files;
  in a larger workspace unmatched globs are not reported.
- A rename update is skipped for references inside a config file that was itself moved; Markdown and MDX documents support rebasing their outgoing references.
- Out of scope by design: `env_file` and `${VAR}` in Compose files, and script line endings,
  shebangs and executable bits.

## Contributing

For development setup, test commands, and fixture layout, see [readme-dev.md](readme-dev.md).

## License

MIT - included with the extension.
