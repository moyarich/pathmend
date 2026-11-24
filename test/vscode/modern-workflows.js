"use strict";
const vscode=require("vscode");
const fs=require("node:fs");
const path=require("node:path");
const {captureState,waitFor}=require("./utils/visual");
const {serializeReport}=require("../../src/analyzer/reporting/formats");

async function runModernWorkflows(check,cfg){
  const api=await vscode.extensions.getExtension("jaytankdev.pathmend").activate();
  const ws=cfg.ws, folder=path.join(ws,"modern-coverage");
  const files={
    "styles.css":'.a { background: url("./missing.svg"); }',
    "index.html":'<script src="./missing.js"></script><img src="./present.svg">',
    "entry.ts":'import "./missing-module";\nimport "./present";\n',
    "present.ts":"export {};\n",
    "present.svg":'<svg xmlns="http://www.w3.org/2000/svg"/>',
    ".vscode/tasks.json":JSON.stringify({tasks:[{command:"./missing.sh"}]}),
    ".devcontainer/devcontainer.json":JSON.stringify({build:{dockerfile:"missing.Dockerfile"}}),
    ".gitmodules":'[submodule "example"]\n path = missing-module\n',
    "pyproject.toml":'[tool.uv.sources]\nlib = { path = "./missing-lib" }\n',
    "demo.code-workspace":JSON.stringify({folders:[{path:"./missing-folder"}]}),
    "pnpm-workspace.yaml":'packages: ["packages/*"]\n',
    "package.json":JSON.stringify({name:"modern-root",workspaces:["packages/*"],dependencies:{local:"file:./missing-package",named:"workspace:*"}}),
    "packages/present/package.json":JSON.stringify({name:"present"}),
  };
  const uri=name=>vscode.Uri.file(path.join(folder,name));
  const config=vscode.workspace.getConfiguration("pathmend");
  const previous=config.inspect("editor.codeLens")?.workspaceValue;
  try{
    for(const [name,content] of Object.entries(files)){
      const file=uri(name).fsPath;fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,content);
    }
    await api.rebuildIndex();
    const expected={"styles.css":"PM016","index.html":"PM017","entry.ts":"PM018",".vscode/tasks.json":"PM019",".devcontainer/devcontainer.json":"PM020",".gitmodules":"PM021","pyproject.toml":"PM022","demo.code-workspace":"PM024","package.json":"PM026"};
    for(const [name,code] of Object.entries(expected)){
      const diagnostics=vscode.languages.getDiagnostics(uri(name)).filter(d=>d.source==="PathMend");
      check("modern format: "+name+" reports "+code,diagnostics.some(d=>d.code===code),diagnostics.map(d=>d.code));
    }
    const packageDiagnostics=vscode.languages.getDiagnostics(uri("package.json")).filter(d=>d.source==="PathMend");
    check("workspace: missing named dependency",packageDiagnostics.some(d=>d.code==="PM027"));
    const doc=await vscode.workspace.openTextDocument(uri("entry.ts"));
    await vscode.window.showTextDocument(doc);
    await api.rebuildIndex();
    const links=await vscode.commands.executeCommand("vscode.executeLinkProvider",doc.uri);
    check("navigation: valid relative module links to the resolved source",links?.some(l=>l.target?.fsPath===uri("present.ts").fsPath),links?.map(l=>l.target?.toString()));
    const hovers=await vscode.commands.executeCommand("vscode.executeHoverProvider",doc.uri,new vscode.Position(0,10));
    check("navigation: broken module hover reports PathMend rule",hovers?.some(h=>h.contents.some(c=>String(c.value??c).includes("PM018"))));
    await config.update("editor.codeLens",true,vscode.ConfigurationTarget.Workspace);
    await api.rebuildIndex();
    const repair=api.getFindings().find(f=>f.fix&&f.file.startsWith(folder+path.sep))||api.getFindings().find(f=>f.fix);
    if(repair){
      const lenses=await vscode.commands.executeCommand("vscode.executeCodeLensProvider",vscode.Uri.file(repair.file),10);
      check("navigation: opt-in repair CodeLens",lenses?.some(l=>l.command?.command==="pathmend.previewFix"));
    }else check("navigation: a repair candidate exists",false);
    const report=api.getReport();
    check("reports: JSON round-trips the live report",JSON.stringify(JSON.parse(serializeReport(report)))===JSON.stringify(report));
    const sarif=JSON.parse(serializeReport(report,"sarif"));
    check("reports: SARIF includes live diagnostics",sarif.runs[0].results.length===report.summary.total);
    for(const format of ["md","csv","html"])check("reports: "+format+" contains the new module diagnostic",serializeReport(report,format).includes("PM018"));
    await captureState(cfg,"source-diagnostics",ws);
    await vscode.commands.executeCommand("pathmend.openReferenceDetailsInEditor");
    await vscode.commands.executeCommand("pathmend.openReferenceDetailsInEditor");
    const tabs=()=>vscode.window.tabGroups.all.flatMap(g=>g.tabs).filter(t=>t.input instanceof vscode.TabInputWebview&&t.input.viewType.includes("pathmend.referenceDetailsEditor"));
    check("details: opening twice reuses a single editor tab",!!await waitFor(()=>tabs().length===1,5000),tabs().length);
    await captureState(cfg,"reference-details-editor",ws);
    await captureState(cfg,"reference-details-filtered",ws);
    await captureState(cfg,"reference-details-collapsed",ws);
    await vscode.window.tabGroups.close(tabs());
    await vscode.commands.executeCommand("pathmend.openReferenceDetailsInSidebar");
    check("details: sidebar can be reopened",!!await waitFor(()=>api.isReferenceDetailsVisible(),5000));
  }finally{
    await config.update("editor.codeLens",previous,vscode.ConfigurationTarget.Workspace);
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    fs.rmSync(folder,{recursive:true,force:true});
    await api.rebuildIndex();
  }
}
module.exports={runModernWorkflows};
