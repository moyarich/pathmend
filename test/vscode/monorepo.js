"use strict";

// MoyaForge-shaped monorepo regression cases. Runs inside the same isolated
// Extension Host as the original suite; no npm scripts or tools are executed.
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");

async function runMonorepoCases(check, cfg) {
  const root = fs.realpathSync(cfg.ws);
  const dir = path.join(root, "pathmend-monorepo-cases");
  const manifest = path.join(dir, "package.json");
  const api = await vscode.extensions.getExtension("jaytankdev.pathmend").activate();
  const ensure = (file) => {
    const full = path.join(dir, file);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, "// fixture\n");
  };
  const makePkg = (relative, name) => {
    const full = path.join(dir, relative, "package.json");
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, JSON.stringify({ name, version: "0.0.0" }));
  };
  try {
    makePkg("packages/moyaforge", "@moyarich/moyaforge");
    makePkg("apps/playground", "@moyarich/moyaforge-playground");
    for (const file of [
      "scripts/build-registry/build-registry-cli.ts",
      "bin/build-registry.ts",
      "scripts/verify-package-tarballs.ts",
      "scripts/audit-framework-pack.ts",
      "scripts/prepare-github-cli.ts",
      "scripts/verify-github-cli.ts",
      "tests/workspace.test.js",
      "tests/consumer.test.js",
      "tests/vite-consumer-build/vite.config.js",
    ]) ensure(file);
    const pkg = {
      name: "moyaforge-workspace",
      private: true,
      workspaces: ["packages/*", "apps/*"],
      bin: {
        "build-registry": "./scripts/build-registry/build-registry-cli.ts",
        moyaforge: "./github-cli/dist/bin/moyaforge.js",
      },
      scripts: {
        dev: "npm run dev --workspace @moyarich/moyaforge-playground",
        "build:package": "npm run build --workspace @moyarich/moyaforge",
        typecheck: "npm run typecheck --workspaces --if-present",
        checks: "npm run registry:check && npm run typecheck && npm test",
        "test:boundaries": "vitest run tests/workspace.test.js",
        "test:consumer": "vitest run tests/consumer.test.js",
        "test:consumer:browser": "npm exec --workspace @moyarich/moyaforge-playground -- vite build --config ../../tests/vite-consumer-build/vite.config.js",
        "test:e2e": "playwright test --project=vite-consumer",
        "registry:build": "node bin/build-registry.ts",
        "registry:check": "node bin/build-registry.ts --check",
        "pack:verify": "node scripts/verify-package-tarballs.ts",
        "pack:audit": "node scripts/audit-framework-pack.ts",
        "pack:audit:strict": "node scripts/audit-framework-pack.ts --strict",
        prepare: "npm run build --workspace @moyarich/moyaforge-cli && node scripts/prepare-github-cli.ts",
        "test:github-cli": "npm run prepare && node scripts/verify-github-cli.ts",
      },
      files: ["github-cli/"],
    };
    fs.mkdirSync(path.join(dir, "github-cli"), { recursive: true });
    fs.writeFileSync(manifest, JSON.stringify(pkg, null, 2) + "\n");
    await api.rebuildIndex();

    const diagnostics = () => vscode.languages.getDiagnostics(vscode.Uri.file(manifest))
      .filter((d) => d.source === "PathMend");
    const refs = api.getFindings().filter((f) => f.file === manifest);
    const raw = fs.readFileSync(manifest, "utf8").split("\n");
    const actual = diagnostics().map((d) => ({
      code: d.code,
      token: raw[d.range.start.line].slice(d.range.start.character, d.range.end.character),
      message: d.message,
    }));
    check("monorepo: existing workspace globs are accepted",
      !actual.some((d) => d.token === "packages/*" || d.token === "apps/*"), actual);
    check("monorepo: existing TypeScript bin and node script targets accepted",
      !actual.some((d) => /build-registry-cli\.ts|bin\/build-registry\.ts|verify-package-tarballs\.ts|audit-framework-pack\.ts|prepare-github-cli\.ts|verify-github-cli\.ts/.test(d.token)), actual);
    check("monorepo: generated dist bin is ignored",
      !actual.some((d) => d.token === "./github-cli/dist/bin/moyaforge.js"), actual);
    check("monorepo: npm and Playwright commands aren't treated as local files",
      !actual.some((d) => /@moyarich|vite-consumer|^npm$|^playwright$/.test(d.token)), actual);
    check("monorepo: existing files package entry accepted",
      !actual.some((d) => d.token === "github-cli/"), actual);
    check("monorepo: clean supported paths have no diagnostics", actual.length === 0, actual);

    // Temporarily change one known file reference; verify a meaningful PM001.
    pkg.scripts["registry:build"] = "node bin/missing-registry.ts";
    fs.writeFileSync(manifest, JSON.stringify(pkg, null, 2) + "\n");
    await api.rebuildIndex();
    const missing = diagnostics();
    check("monorepo: missing node script is flagged",
      missing.some((d) => d.code === "PM001" &&
        d.message.includes("bin/missing-registry.ts")),
      missing.map((d) => d.message));
    pkg.scripts["registry:build"] = "node bin/build-registry.ts";
    fs.writeFileSync(manifest, JSON.stringify(pkg, null, 2) + "\n");
    await api.rebuildIndex();

    // Existing parser limitation: Vitest operands, npm workspace names and
    // Vite --config targets aren't validated yet. Do not assert they are.
    try {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(manifest));
      await vscode.window.showTextDocument(doc, { preview: false });
      await vscode.commands.executeCommand("workbench.view.extension.pathmend");
    } catch (error) {
      console.warn("Could not show monorepo use cases:", error.message);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    await api.rebuildIndex();
  }
}

module.exports = { runMonorepoCases };
