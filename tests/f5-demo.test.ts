import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { categories, equipmentSchema } from "../src/domain.js";

test("F5 catalog is a fixed thirty-record synthetic fixture, five per category, with validated business fields", () => {
  const rows = JSON.parse(fs.readFileSync(new URL("../scripts/f5-demo-catalog.json", import.meta.url), "utf8"));
  assert.equal(rows.length, 30);
  assert.equal(new Set(rows.map((r: {demoId: string}) => r.demoId)).size, 30);
  for (const category of categories) assert.equal(rows.filter((r: {category: string}) => r.category === category).length, 5);
  for (const {demoId, demoOnly, sourceCurrency, ...row} of rows) {
    assert.match(demoId, /^EQD-\d{3}$/);
    assert.equal(demoOnly, true);
    assert.equal(sourceCurrency, "BDT");
    assert.doesNotThrow(() => equipmentSchema.parse(row));
    assert.match(row.terms, /USD demo rates, not a currency conversion/);
    assert.equal(new URL(row.image).protocol, "https:");
  }
  const runner = fs.readFileSync(new URL("../scripts/dev-isolated.ts", import.meta.url), "utf8");
  assert.ok(runner.includes('process.argv.includes("--catalog=f5")'));
  assert.ok(runner.includes('MongoMemoryReplSet.create'));
});
