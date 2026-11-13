# PathMend development guide

For features and settings, see [README.md](README.md).

## Setup

You need Node.js and npm.

```bash
npm install
npm test
```

`npm test`

## Test commands

| Command                                                     | Runs                                                                                                | Needs VS Code |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------- |
| `npm test`                                                  | Vitest,run All Vitest tests. To add a test, create a `*.test.js`, `*.test.mjs`, or `*.spec.*` file. | No            |
| `npm run test:watch`                                        | Vitest, re-running as files change                                                                  | No            |
| `npx vitest run test/package-json/package-scripts.test.mjs` | Package-script tests only                                                                           | No            |
| `node test/unit.js`                                         | Core diagnostics against the sample workspace                                                       | No            |
| `node test/run-vscode.js`                                   | Editor integration tests (trusted and untrusted workspaces)                                         | Yes           |

**Note:** `test/unit.js` and `test/run-vscode.js` are not Vitest tests, so `npm test` skips them. Run them when you change core diagnostics, rename handling, or editor behavior.

The VS Code runner launches an isolated editor and runs `test/vscode/index.js`. By default, `@vscode/test-electron` downloads a VS Code executable (cached across runs). Set `VSCODE_EXECUTABLE_PATH` to an existing **VS Code Electron executable** to avoid downloading it, or `VSCODE_TEST_VERSION` to select a specific download. The `code` command-line shell wrapper is not a substitute for the executable.

The trusted-workspace test saves one screenshot to `screenshots/pathmend-panel.png` at the repository root. The runner creates this directory automatically, preserves it after successful tests, and Git and VS Code extension packaging ignore it.

Screenshots use Playwright's Chromium DevTools Protocol (CDP) connection to the **actual VS Code workbench**, not OS-level screen capture. This works on macOS, Windows, and Linux with the same code and does not require ImageMagick, `xdotool`, `screencapture`, or PowerShell. VS Code still needs a graphical desktop or virtual display on headless Linux; screenshot failures count as failed assertions.

For example:

```bash
npm install
node test/run-vscode.js
# Or use a previously installed VS Code executable:
VSCODE_EXECUTABLE_PATH=/path/to/vscode/electron node test/run-vscode.js
```

## Test fixtures

Files in `test/fixtures/` are test inputs, not tests.

```text
test/
├── fixtures/
│   ├── ws/                       # Sample workspace
│   └── package-json/
│       └── package.json          # Manifest for script path tests
├── package-json/
│   └── package-scripts.test.mjs  # Vitest suite
├── prepare.js                    # Builds the temporary workspace
├── unit.js                       # Core diagnostics test
├── run-vscode.js                 # VS Code test launcher
└── vscode/
    └── index.js                  # Tests that run inside the editor
```

- **`unit.js` and `run-vscode.js`:** `prepare.js` copies `fixtures/ws/` to a temp folder, adds symlinks and other edge cases, and returns the workspace paths.
