import {it,expect} from "vitest";
import formats from "../../../src/analyzer/reporting/formats.js";
const report={summary:{total:1,broken:1},files:[{path:"docs/a b.md",findings:[{code:"PM012",line:2,column:3,severity:"warning",path:"=cmd",message:'<script>alert("x")</script> | bad',fix:"./good"}]}]};
it("preserves JSON and emits SARIF locations",()=>{
 expect(JSON.parse(formats.serializeReport(report))).toEqual(report);
 const sarif=JSON.parse(formats.serializeReport(report,"sarif"));
 expect(sarif.version).toBe("2.1.0");
 expect(sarif.runs[0].results[0].locations[0].physicalLocation).toEqual({artifactLocation:{uri:"docs/a%20b.md"},region:{startLine:2,startColumn:3}});
});
it("escapes spreadsheet, markdown and HTML content",()=>{
 expect(formats.serializeReport(report,"csv")).toContain("'=cmd");
 expect(formats.serializeReport(report,"md")).toContain("&#124;");
 expect(formats.serializeReport(report,"html")).not.toContain("<script>");
 expect(()=>formats.serializeReport(report,"unknown")).toThrow();
});
