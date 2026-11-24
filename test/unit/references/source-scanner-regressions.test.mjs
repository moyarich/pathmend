import {it,expect} from "vitest";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const {declarations}=require("../../../src/analyzer/formats/javascript/scanner");
const {format:html}=require("../../../src/analyzer/formats/html");
const {format:css}=require("../../../src/analyzer/formats/css");
it("skips template examples and scans multiline static imports",()=>{
 const source=["const sample = "+String.fromCharCode(96),'import "./ignored";',String.fromCharCode(96)+";",'import {',' thing','} from "./actual";','import("./dynamic");'].join("\n");
 expect(declarations(source).map(r=>r.value)).toEqual(["./actual"]);
});
it("reads HTML script src but not raw script content or quoted attribute examples",()=>{
 const text='<script src="./main.js">const example = "<img src=ignored.png>";</script><img title=\'src="./fake.png"\' src="./real.png">';
 expect(html.extract({file:"/workspace/index.html",text,starts:[0]}).map(r=>r.value)).toEqual(["./main.js","./real.png"]);
});
it("skips quoted CSS content examples",()=>{
 const text='.a { content: "url(fake.png)"; background: url("./real.png"); }';
 expect(css.extract({file:"/workspace/a.css",text,starts:[0]}).map(r=>r.value)).toEqual(["./real.png"]);
});
