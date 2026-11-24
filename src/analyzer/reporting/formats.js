"use strict";
const { RULES } = require("../rules/registry");
const formats = Object.freeze({json:"JSON",sarif:"SARIF",md:"Markdown",csv:"CSV",html:"HTML"});
const rows = report => report.files.flatMap(file => file.findings.map(finding => ({...finding,file:file.path})));
const html = value => String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const markdown = value => html(value).replace(/[\\|\x60*_~]/g,c=>"&#"+c.charCodeAt(0)+";").replace(/\r?\n/g,"<br>");
function csv(value) {
  let text=String(value??"");
  if (/^[\s]*[=+\-@]|^[\t\r\n]/.test(text)) text="'"+text;
  return '"'+text.replace(/"/g,'""')+'"';
}
function sarif(report) {
  const findings=rows(report);
  const ids=[...new Set(findings.map(f=>f.code))].sort();
  return {
    $schema:"https://json.schemastore.org/sarif-2.1.0.json",version:"2.1.0",
    runs:[{tool:{driver:{name:"PathMend",informationUri:"https://github.com/moyarich/pathmend",rules:ids.map(id=>({id,name:RULES[id]?.name||id,shortDescription:{text:RULES[id]?.description||id}}))}},
      results:findings.map(f=>({ruleId:f.code,ruleIndex:ids.indexOf(f.code),level:f.notChecked?"note":f.severity==="error"?"error":f.severity==="warning"?"warning":"note",message:{text:f.message},locations:[{physicalLocation:{artifactLocation:{uri:f.file.split("/").map(encodeURIComponent).join("/")},region:{startLine:f.line,startColumn:f.column}}}]}))}]
  };
}
function serializeReport(report,format="json") {
  if (!Object.hasOwn(formats,format)) throw new Error("Unsupported report format: "+format);
  if(format==="json"||format==="sarif")return JSON.stringify(format==="json"?report:sarif(report),null,2)+"\n";
  const headers=["File","Line","Column","Rule","Severity","Reference","Message","Suggested replacement"];
  const data=rows(report).map(f=>[f.file,f.line,f.column,f.code,f.severity,f.path,f.message,f.fix]);
  if(format==="csv")return [headers,...data].map(row=>row.map(csv).join(",")).join("\r\n")+"\r\n";
  if(format==="md")return "# PathMend diagnostic report\n\n"+report.summary.total+" references; "+report.summary.broken+" broken.\n\n| "+headers.join(" | ")+" |\n| "+headers.map(()=>"---").join(" | ")+" |\n"+data.map(row=>"| "+row.map(markdown).join(" | ")+" |").join("\n")+"\n";
  return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>PathMend report</title><style>body{font:16px system-ui;margin:2rem}table{border-collapse:collapse;width:100%;overflow-wrap:anywhere}td,th{padding:.5rem;border:1px solid #888;text-align:left}th{background:#eee;color:#222}</style><h1>PathMend diagnostic report</h1><p>'+report.summary.total+' references; '+report.summary.broken+' broken.</p><table><thead><tr>'+headers.map(h=>"<th>"+html(h)+"</th>").join("")+'</tr></thead><tbody>'+data.map(row=>"<tr>"+row.map(v=>"<td>"+html(v)+"</td>").join("")+"</tr>").join("")+'</tbody></table></html>\n';
}
module.exports={formats,serializeReport};
