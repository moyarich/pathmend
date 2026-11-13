# PathMend development guide

This guide is for contributors working on PathMend. For features, settings, and everyday use, see [README.md](README.md).

## Get started

You need Node.js and npm. To run the VS Code integration tests, you also need VS Code with the `code` CLI available in your terminal.

```bash
npm install
npm test
```

`npm test` runs **all tests discovered by Vitest**, not just one named test. Add more `*.test.js`, `*.test.mjs`, or `*.spec.*` files and Vitest will discover them according to its normal naming rules.

## Test commands

| Command | What it runs | VS Code required? |
| --- | --- | --- |
| `npm test` | All Vitest-discovered tests (currently including `test/package-json/package-scripts.test.mjs`) | No |
| `npm run test:watch` | Vitest in watch mode, rerunning affected tests as files change | No |
| `npx vitest run test/package-json/package-scripts.test.mjs` | Only the package-script regression test file | No |
| `node test/unit.js` | Existing standalone core diagnostics test against the workspace fixture | No |
| `node test/run-vscode.js` | VS Code Extension Host integration suite in trusted and untrusted workspaces | Yes |

**Important:** The standalone Node.js unit suite and VS Code Extension Host suite are **not** Vitest tests. `npm test` does not run them. Run those commands separately when changes affect core diagnostics, rename handling, or editor behavior.

The VS Code runner starts an isolated editor instance with PathMend loaded and uses `test/vscode/index.js`. It requires the `code` CLI on your `PATH`; screenshot capture may require additional desktop utilities on Linux.

## How the fixtures work

The `test/fixtures/` directory contains **inputs**, not executable tests:

```text
test/
├── fixtures/
│   ├── ws/                         # Full sample workspace for existing tests
│   └── package-json/
│       └── package.json           # Dedicated manifest for script path tests
├── package-json/
│   └── package-scripts.test.mjs    # Vitest suite
├── prepare.js
├── unit.js
├── run-vscode.js
└── vscode/
    └── index.js                   # Editor-host test suite
```

- **Workspace tests:** `test/prepare.js` copies `test/fixtures/ws/` into a temporary workspace, adds symlinks and other special cases, and returns the workspace paths. Both `test/unit.js` and `test/run-vscode.js` use it.
- **Package-script Vitest tests:** `test/package-json/package-scripts.test.mjs` copies `test/fixtures/package-json/package.json` into a newly created OS temporary folder for **each test**. It creates mock script files, moves files or directories, checks the resulting paths and diagnostics, then deletes that temporary folder in `afterEach`.

Neither suite should edit tracked fixture files during execution. **The repository's root `package.json` is the VS Code extension manifest, not a fixture.**

## Where to make changes

- `core.js`: file-path extraction, diagnostics, and rename planning (CommonJS).
- `extension.js`: VS Code integration, prompts, edits, and diagnostics (CommonJS).
- `package.json`: extension metadata, settings, commands, and npm development scripts.
- `test/fixtures/`: test inputs; add focused fixtures here when appropriate.

Vitest test files may use ES module `import` syntax with a `.mjs` extension, without changing the package to `"type": "module"`. Keep `core.js` and `extension.js` compatible with the extension's current CommonJS setup.

## Before opening a pull request

Run the suites affected by your changes, update user documentation when behavior changes, and add a note under `Unreleased` in `CHANGELOG.md`. Leave the extension version unchanged unless preparing a release.
