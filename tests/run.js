import assert from "node:assert";
import { frequencies, buildTree, codeTable, encode, packBits, unpackBits, decode } from "../codec.js";

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok " + name); } catch (e) { failed += 1; console.log("FAIL " + name + " :: " + e.message); }
}

check("frequencies counts every character once per appearance", () => {
  const counts = frequencies("abca");
  assert.strictEqual(counts.a, 2);
  assert.strictEqual(counts.b, 1);
  assert.strictEqual(counts.c, 1);
});

check("frequencies counts spaces and punctuation too", () => {
  const counts = frequencies("a, a");
  assert.strictEqual(counts[" "], 1);
  assert.strictEqual(counts[","], 1);
});

check("buildTree gives a root whose weight is the total count", () => {
  const tree = buildTree({ a: 3, b: 2, c: 1 });
  assert.strictEqual(tree.weight, 6);
  assert.ok(tree.left && tree.right);
});

check("codeTable gives one code string per symbol", () => {
  const table = codeTable(buildTree({ a: 3, b: 2, c: 1 }));
  assert.deepStrictEqual(Object.keys(table).sort(), ["a", "b", "c"]);
  assert.strictEqual(typeof table.a, "string");
});

check("encode gives a bit string over the whole text", () => {
  const table = codeTable(buildTree(frequencies("banana")));
  const bits = encode("banana", table);
  assert.strictEqual(typeof bits, "string");
  assert.ok(/^[01]+$/.test(bits));
});

check("packBits gives whole bytes plus a pad count", () => {
  const packed = packBits("01101");
  assert.ok(Array.isArray(packed[0]));
  assert.strictEqual(packed[0].length, 1);
  assert.ok(packed[1] >= 0 && packed[1] < 8);
});

check("unpackBits gives back the same bit string", () => {
  const packed = packBits("01101");
  assert.strictEqual(unpackBits(packed[0], packed[1]), "01101");
});

check("decode gives back the text that was encoded", () => {
  const tree = buildTree(frequencies("mississippi"));
  const table = codeTable(tree);
  assert.strictEqual(decode(encode("mississippi", table), tree), "mississippi");
});

console.log("8 cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
