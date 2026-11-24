import {it,expect} from "vitest";
import {createBulkSelection} from "../../../views/webview/state/bulk-selection.js";
const files=[{path:"a",findings:[{id:"1",fix:"./a",repairable:true},{id:"2",fix:"./b",repairable:true},{id:"3",repairable:true},{id:"4",fix:"./x",repairable:true,notChecked:true}]},{path:"b",findings:[{id:"5",fix:"./c",repairable:true}]}];
it("selects eligible suggestions and reports partial group selection",()=>{
 const s=createBulkSelection();
 s.reset({revision:1,enabled:true,hasWorkspace:true,files});
 expect(s.eligibleIds(files)).toEqual(["1","2","5"]);
 s.set(["1","3","4","unknown"],true);
 expect(s.ids).toEqual(["1"]);
 expect(s.status(["1","2"])).toEqual({disabled:false,checked:false,indeterminate:true});
 s.set(s.eligibleIds([files[1]]),true);
 expect(s.ids).toEqual(["1","5"]);
 s.set(["1","2"],false);
 expect(s.ids).toEqual(["5"]);
 s.clear();expect(s.count).toBe(0);
});
it("never reuses selections after a new diagnostic revision",()=>{
 const s=createBulkSelection();
 s.reset({revision:1,enabled:true,hasWorkspace:true,files});
 s.set(["1"],true);
 s.reset({revision:2,enabled:true,hasWorkspace:true,files});
 expect(s.count).toBe(0);
 s.reset({revision:3,enabled:false,hasWorkspace:true,files});
 expect(s.status(["1"])).toEqual({disabled:true,checked:false,indeterminate:false});
});
