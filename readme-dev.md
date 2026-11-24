# PathMend development guide

This guide covers local development, testing, test fixtures, and optional VS Code screenshots.

For extension features and configuration, see [README.md](README.md).

## Getting started

**Requirements:** Node.js and npm.

Install dependencies and run the default tests:

```bash
npm install
npm test
```

## Interactive development

```bash
npm run dev
```

Launches an isolated VS Code Extension Development Host with the current PathMend source and a disposable copy of the sample test workspace. It uses the existing `@vscode/test-electron` download/cache and respects `VSCODE_EXECUTABLE_PATH` and `VSCODE_TEST_VERSION`. No integration assertions, screenshots, or automated fixes are run. In the default fixture workspace, VS Code npm task detection and the built-in npm and extension manifest editing extensions are disabled to avoid unrelated parser errors on deliberately hostile manifests. Custom workspace launches keep those built-in extensions available. Close the development window to remove the temporary profile and fixture.

The sample workspace includes `docs/markdown-example.md` and `docs/mdx-example.mdx`, with valid and broken Markdown links, images, reference definitions, MDX imports, JSX attributes and code-preview directives. Open either file to exercise diagnostics and suggested fixes (PM012–PM015).

The PathMend Activity Bar container and Reference Details webview open automatically after the initial scan. You can reopen them from the Activity Bar or use **PathMend: Open Reference Details** from the Command Palette. Automatic opening is restricted to the interactive development launcher and does not affect installed extensions or automated integration tests. After source edits, run **Developer: Reload Window** in the development host to load the changes.

To use an existing folder instead of the fixture:

```bash
npm run dev -- --workspace /path/to/workspace
```

The supplied folder is opened directly (not copied); edits and fixes affect that folder. The launcher never deletes it. Workspace Trust remains available in the isolated profile.

## Running tests

All three CI workflows upload their JSON test reports as separate artifacts (retained for 14 days), including on test failure when a report exists. All three CI workflows publish GitHub Actions job summaries and native error annotations for failures. Vitest reports test counts and source locations when available; the analyzer fixture reports diagnostic and filesystem checks; VS Code reports trusted and untrusted results separately. Reports are published even after a failed test step. Test exit codes still determine CI success.

Concurrency is scoped by workflow and event. New automatic runs cancel obsolete runs of the same workflow and ref; manual dispatches use a unique run ID so they do not cancel each other or automatic CI, including screenshot captures.

GitHub Actions runs Vitest and the analyzer diagnostics fixture on Node.js 24, plus the trusted and untrusted VS Code integration suites on Ubuntu with a virtual display and screenshots enabled on pull requests and disabled on automatic main pushes. Each suite has an independent workflow: [Vitest](.github/workflows/ci-test-vitest.yml), [analyzer diagnostics](.github/workflows/ci-test-diagnostics.yml), and [VS Code integration](.github/workflows/ci-test-vscode.yml).

PathMend uses Vitest for automated tests and separate scripts for analyzer diagnostics and VS Code integration testing.

| Command                                                     | Description                                    |
| ----------------------------------------------------------- | ---------------------------------------------- |
| `npm test`                                                  | Run all Vitest tests                           |
| `npm run test:watch`                                        | Re-run Vitest tests when files change          |
| `npx vitest run test/unit/package-json/package-scripts.test.mjs` | Run package-script tests only                  |
| `npm run test:diagnostics`                                         | Test analyzer diagnostics using a sample workspace |
| `npm run test:vscode`                                   | Run VS Code integration tests                  |

**Note:** `npm test` does not include `scripts/test/run-diagnostics-tests.js` or `scripts/test/run-vscode-tests.js`. Run these separately when changing analyzer diagnostics, file renaming, or editor behavior.

To add a Vitest test, create a `*.test.js`, `*.test.mjs`, or `*.spec.*` file.

### VS Code integration tests

Run the integration tests with:

```bash
node scripts/test/run-vscode-tests.js
```

The runner launches an isolated VS Code instance and executes `test/vscode/index.js`. It disables npm task detection (`npm.autoDetect: off`) and the unrelated built-in `vscode.npm` and `vscode.extension-editing` extensions in the test host to avoid manifest parser errors on hostile fixtures. This does not change a user's normal VS Code installation or PathMend's filesystem checks.

Tests cover both **trusted and untrusted workspaces**. The trusted workspace also runs these additional suites:

| Test file                 | Coverage                                                           |
| ------------------------- | ------------------------------------------------------------------ |
| `test/vscode/usecases.js` | Package scripts, GitHub Actions references, and false positives    |
| `test/vscode/monorepo.js` | File renaming and updates to package scripts and binary references |

These tests verify:

- **Package scripts:** Missing and existing files, chained commands, package binaries, variables, and URLs.
- **GitHub Actions:** References to shell scripts.
- **False positives:** Docker, Compose, and build-output paths.
- **File renaming:** Updates to references and removal of resolved diagnostics.

#### File rename regression test

`test/vscode/monorepo.js` checks that PathMend updates multiple references to a renamed file.

The test:

1. Creates one `bin` reference and two `node` script references to the same file.
2. Renames the file through VS Code.
3. Accepts PathMend's **Update all** prompt.
4. Verifies that all three paths are updated and their diagnostics are cleared.

The test uses a small, dedicated fixture rather than copying the entire MoyaForge manifest.

#### Isolated test workspaces

Both suites use:

```text
test/fixtures/ws/packages/script-cases/
```

`test/fixtures/prepare.js` copies the fixtures into a temporary workspace before testing.

Tests only modify the temporary copy. They do not execute package script commands or modify tracked source files.

## Using a local VS Code installation

By default, `@vscode/test-electron` downloads a VS Code executable and caches it for future runs.

You can instead use an existing installation:

```bash
VSCODE_EXECUTABLE_PATH=/path/to/vscode/electron node scripts/test/run-vscode-tests.js
```

To test a specific VS Code version, set `VSCODE_TEST_VERSION`.

**Important:** `VSCODE_EXECUTABLE_PATH` must point to the actual VS Code Electron executable, not the `code` command-line wrapper.

### macOS

To automatically find VS Code in `/Applications` and run the integration tests:

```bash
VSCODE_EXECUTABLE_PATH="$(
  find "/Applications/Visual Studio Code.app/Contents/MacOS" \
    -maxdepth 1 -type f \( -name "Code" -o -name "Electron" \) \
    -print -quit
)"

if [ -z "$VSCODE_EXECUTABLE_PATH" ]; then
  echo "VS Code executable not found in /Applications" >&2
  exit 1
fi

export VSCODE_EXECUTABLE_PATH
echo "Using VS Code: $VSCODE_EXECUTABLE_PATH"

PM_SCREENSHOTS=0 node scripts/test/run-vscode-tests.js
```

Remove `PM_SCREENSHOTS=0` to enable screenshots.

If VS Code is installed elsewhere, update the application path.

## Diagnostic report artifacts

VS Code integration tests export the initial scan from both trusted and untrusted fixture workspaces using the same report serializer as PathMend: Export Results. CI uploads `trusted.json` and `untrusted.json` as `pathmend-diagnostic-reports` for 14 days, even if later assertions fail. These are diagnostic exports, not the separate `pathmend-vscode-results` test assertion report. Local reports are written to `test-results/diagnostics/`; override with `PM_DIAGNOSTIC_REPORTS`. Screenshot capture is not required.

## Screenshots (optional)

The VS Code integration runner can capture screenshots of important editor states for visual debugging.

Screenshots are **enabled by default locally**. In GitHub Actions, screenshots are enabled on pull requests and disabled on automatic main pushes.

To capture screenshots in CI, open **Actions → CI - VS Code → Run workflow**, select a branch, and enable **Capture VS Code screenshots**. When the run finishes, download the `pathmend-vscode-screenshots` artifact from the run summary. Captured PNGs are uploaded even if functional tests fail and are retained for 14 days. If no PNGs were captured, the upload step emits a warning.

```bash
# Integration tests with screenshots
node scripts/test/run-vscode-tests.js

# Functional tests only (no Playwright)
PM_SCREENSHOTS=0 node scripts/test/run-vscode-tests.js
```

Disabling screenshots does not disable functional testing. The editor and sidebar still navigate through the same test states.

### Reference Details webview

Set `pathmend.referenceDetails.defaultLocation` to `sidebar` (default) or `editor` in VS Code Settings. Open Reference Details, Show Reference Details on a tree item, and the interactive development startup respect this preference. Explicit Open Reference Details in Editor and Open Reference Details in Sidebar actions override it without changing the setting.

The native Quick Actions view uses compact clickable tree rows for Open Reference Details (using the configured default location), Scan Workspace and Settings, even when no broken references exist. `views/quick-actions-provider.js` supplies the rows, icons and tooltips. Explicit location overrides and JSON export remain available in the PathMend Actions menu and Command Palette. Both webview locations offer a button to open the other location and export results.

Use **Open Reference Details in Editor** in the Reference Details toolbar or **PathMend: Open Reference Details in Editor** in the Command Palette to open the same interface in an editor tab. The tab supports native editor-group splitting and dragging; the sidebar remains available. Both surfaces receive live diagnostics and share the renderer, but keep independent presentation preferences.

The native tree and webview share the model in `views/model.js`. `views/reference-details-sidebar-provider.js` owns the sidebar view lifecycle, focus and badge. `views/reference-details-panel.js` owns the editor panel lifecycle. Both compose `views/reference-details-webview.js`, which renders the shared UI, publishes snapshots and validates commands. The browser entry point `views/webview/main.js` wires together the bridge, state and native custom elements. The API bridge lives in `api/`, view preferences and filtering in `state/`, and DOM helpers in `utils/`; `pm-reference-list`, `pm-file-group` and `pm-reference-card` live under `views/webview/components/`. The components use light DOM and shared VS Code theme styles, and emit bubbling custom events rather than calling the extension host directly. The Broken References title provides Open Reference Details, and both view overflow menus contain a PathMend Actions submenu. The native view title provides Scan workspace; the details view also exposes VS Code Problems and Settings. Tree selection highlights the corresponding diagnostic, and Show Reference Details reveals the webview. A local SVG registry (including the PathMend activity icon as `icon("pathmend")` and Lucide icons) in `views/webview/icons/` uses inline SVG nodes and `currentColor`, without an icon package or CDN. See its third-party license notices. Webview CSS is split into shared tokens, base, controls and toolbar styles under `views/webview/styles/`, plus a dedicated folder for each component containing its JavaScript and CSS. `styles.css` imports them in cascade order. Native browser ES modules load directly from extension-owned assets without a bundler.

### Captured screenshots

The Reference Details webview is captured after its custom elements render, including populated, fixed, empty and disabled states. The native tree remains available.

Screenshots are saved to `screenshots/` at the repository root.

| File                      | Captured state                                       |
| ------------------------- | ---------------------------------------------------- |
| `diagnostics-panel.png`   | Initial broken-path diagnostics and Problems panel   |
| `reference-details.png` | Initial multiline diagnostic messages |
| `reference-details-after-fix.png` | Webview after applying an inline fix |
| `reference-details-empty.png` | Webview with no findings |
| `reference-details-disabled.png` | Webview with diagnostics disabled |
| `after-inline-fix.png`    | Diagnostics after applying an inline fix             |
| `after-folder-rename.png` | Updated references after renaming a folder           |
| `ignored-rename.png`      | Unresolved references after ignoring a rename update |
| `empty-state.png`         | No diagnostics to display                            |
| `disabled-state.png`      | PathMend diagnostics disabled                        |
| `untrusted-panel.png`     | Extension panel in an untrusted workspace            |

The `screenshots/` directory is ignored by Git and excluded from extension packaging. Captured images are preserved after successful tests.

### How screenshots work

PathMend uses Playwright's Chrome DevTools Protocol (CDP) connection to capture the **actual VS Code workbench**.

This approach:

- Works on macOS, Windows, and Linux.
- Does not require ImageMagick, `xdotool`, `screencapture`, or PowerShell.
- Requires a graphical desktop or virtual display on headless Linux.
- Automatically skips screenshots if Playwright is unavailable.

Screenshot-related failures produce warnings but **do not fail functional tests**.

### Visual checkpoints

Visual checkpoints are organized separately from functional assertions:

| File                          | Responsibility                                   |
| ----------------------------- | ------------------------------------------------ |
| `test/vscode/index.js`        | Defines checkpoints and functional assertions    |
| `test/vscode/utils/visual.js` | Prepares editor layouts and captures screenshots |

Each checkpoint displays the relevant editor, configuration lines, or workbench panel.

For example:

- Initial diagnostics show the Problems panel.
- Fix and rename checkpoints display the affected configuration lines.
- Empty and disabled states close editors to reveal welcome content.

PathMend file groups expand by default through their TreeItem configuration.

Screenshots are debugging artifacts, **not test assertions**. Functional checks determine whether the integration suite passes.

## Test fixtures and structure

Development launchers, test runners and CI reporting scripts live in `scripts/`. Test cases, test-only helpers and fixture data live in `test/`.

Shared workspace inputs live in `test/fixtures/ws/`, isolated unit fixtures in `test/fixtures/unit/`, and executable unit tests under `test/unit/`.

```text
scripts/
├── dev/launch.js
├── test/
│   ├── run-diagnostics-tests.js
│   └── run-vscode-tests.js
├── reporting/write-summary.js
└── utils/resolve-vscode.js

test/
├── fixtures/
│   ├── expected.js
│   ├── prepare.js
│   ├── unit/package-json/package.json
│   └── ws/
├── unit/
│   ├── markdown/
│   ├── package-json/
│   ├── rules/
│   └── views/
└── vscode/
    ├── index.js
    ├── monorepo.js
    ├── usecases.js
    └── utils/visual.js
```

### Fixture preparation

For `scripts/test/run-diagnostics-tests.js` and `scripts/test/run-vscode-tests.js`, `test/fixtures/prepare.js`:

1. Copies `test/fixtures/ws/` into a temporary workspace.
2. Adds symlinks and other edge cases needed by the tests.
3. Returns the prepared workspace paths.

The Vitest package-script suite uses its dedicated manifest:

```text
test/fixtures/unit/package-json/package.json
```

This keeps tests reproducible and prevents changes to tracked fixtures.

Suggested paths in Reference Details are editable before applying a fix. Reset restores the generated suggestion; custom replacements are validated using the original reference's resolution rules. If the target cannot be verified, a modal warning shows the original and replacement paths and offers Apply Anyway or Cancel. Invalid syntax, stale source edits and edits outside the workspace remain blocked. Drafts survive live diagnostic refreshes while the corresponding finding remains unchanged.

Native notifications use short summaries. Replacement confirmations and error dialogs put paths in modal detail, and rename updates use the native Preview action for full file diffs. The Broken References picker is a navigation aid: selecting a result opens Reference Details for the complete message and suggestion. Native dialog dimensions and wrapping are controlled by VS Code and the operating system.

## Source architecture

The original PathMend by [Jay Tank](https://github.com/jay-tank/pathmend) is the foundation of this derivative. The original MIT notice is preserved.

```text
src/
├── analyzer/
│   ├── index.js
│   ├── analyze.js
│   ├── formats/       # format modules and registry
│   ├── parsers/       # shared syntax readers
│   ├── references/    # construction, evaluation, encoding and validation
│   ├── workspace/     # filesystem guard and file index
│   ├── rename/        # rename planning
│   ├── rules/         # aggregated diagnostic metadata
│   └── utils/
└── extension/
    ├── index.js
    ├── configuration.js
    ├── workspace/
    ├── scanning/
    ├── commands/
    ├── providers/
    └── events/
views/                 # native view hosts and browser-side webview
```

The analyzer does not import VS Code. Extension modules consume the analyzer API; the browser webview communicates through validated host messages. All filesystem access in the analyzer is routed through its workspace guard. There are no runtime dependencies.

## Adding file types and rules

1. Create a module in `src/analyzer/formats/` with `patterns`, `match`, `rules`, `extract` and optional `prepare` and `order`.
2. Register the module in `src/analyzer/formats/registry.js`. Discovery and classification use that registry.
3. Return normalized references using the shared reference helpers. Reuse shared parsers when appropriate.
4. Declare unique diagnostic codes and aliases in the format. Preserve existing IDs; shared rules are registered separately.
5. Run `npm run sync:manifest` to synchronize the rule choices in VS Code settings. Update the user-facing rule and file-type tables where applicable.
6. Add fixture cases and behavior-focused tests for valid, missing, ignored and outside-workspace targets. Run `npm test`, `npm run test:diagnostics` and `npm run test:vscode`.

Optional preparation hooks support cross-document context such as npm workspace names and TypeScript inheritance. Extraction ordering ensures Compose context is available to Dockerfile extraction. Keep format-specific logic out of extension activation and analyzer orchestration.
