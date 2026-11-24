#!/usr/bin/env node
"use strict";
const fs=require("node:fs");
const path=require("node:path");
const {scanWorkspace,defaults}=require("./scan");
const {formats,serializeReport}=require("../analyzer/reporting/formats");
const help="Usage: pathmend [--workspace DIR] [--config FILE] [--format json|sarif|md|csv|html]\nExit codes: 0 no broken references, 1 broken references, 2 invalid arguments or scan failure.\n";
function main(args,io=process){
 try{
   const options={workspace:".",format:"json"};
   for(let i=0;i<args.length;i++){
     const arg=args[i];
     if(arg==="--help"||arg==="-h"){io.stdout.write(help);return 0;}
     if(!["--workspace","--config","--format"].includes(arg)||!args[i+1]||args[i+1].startsWith("--"))throw new Error("Invalid argument: "+arg);
     options[arg.slice(2)]=args[++i];
   }
   if(!Object.hasOwn(formats,options.format))throw new Error("Unknown format: "+options.format);
   const root=path.resolve(options.workspace);
   let settings={};
   if(options.config){
     const raw=JSON.parse(fs.readFileSync(path.resolve(options.config),"utf8"));
     if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new Error("Configuration must be an object");
     settings=raw;
   }
   for(const key of ["exclude","ignoreReferences","disabledRules","mdxPathAttributes","directivePathAttributes","multiPathAttributes","yamlPathAttributes"]){
     if(settings[key]!==undefined&&(!Array.isArray(settings[key])||settings[key].some(x=>typeof x!=="string")))throw new Error(key+" must be an array of strings");
   }
   for(const key of ["maxIndexedFiles","maxFileSizeKB"])if(settings[key]!==undefined&&(!Number.isSafeInteger(settings[key])||settings[key]<1))throw new Error(key+" must be a positive integer");
   if(settings.severity!==undefined&&!["warning","error","information","hint"].includes(settings.severity))throw new Error("Invalid severity");
   if(settings.reportOutside!==undefined&&typeof settings.reportOutside!=="boolean")throw new Error("reportOutside must be boolean");
   const report=scanWorkspace(root,settings);
   io.stdout.write(serializeReport(report,options.format));
   return report.summary.broken?1:0;
 }catch(error){io.stderr.write("PathMend: "+error.message+"\n");return 2;}
}
if(require.main===module)process.exitCode=main(process.argv.slice(2));
module.exports={main};
