import { it, expect } from "vitest";
import planner from "../../../src/analyzer/references/propose-repairs.js";
const { proposeRepairs } = planner;
it("applies disjoint edits to the original snapshot regardless of input order", () => {
  const a = {start: 0, end: 3, raw: "one", encoded: "first"};
  const b = {start: 4, end: 7, raw: "two", encoded: "second"};
  expect(proposeRepairs("one two", [b,a])).toBe("first second");
  expect(proposeRepairs("one two", [a,a])).toBeNull();
  expect(proposeRepairs("old two", [a,b])).toBeNull();
  expect(proposeRepairs("one two", [{...a,end:99}])).toBeNull();
});
