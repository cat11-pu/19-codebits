// app.js：把一段文本跑成前缀编码视图（频率、树、码表、位流、字节与不变量）
import { frequencies, buildTree, codeTable, encode, packBits, unpackBits, decode } from "./codec.js";

function guard(fn, fallback) {
  try {
    return fn();
  } catch (error) {
    return fallback;
  }
}

function isLeaf(node) {
  return !!node && (node.left === null || node.left === undefined) &&
         (node.right === null || node.right === undefined);
}

function serialized(node) {
  if (node === null || node === undefined) { return null; }
  if (isLeaf(node)) { return [node.weight, node.symbol, null, null]; }
  return [node.weight, null, serialized(node.left), serialized(node.right)];
}

function treeText(node) {
  if (node === null || node === undefined) { return ""; }
  if (isLeaf(node)) {
    if (node.symbol === null || node.symbol === undefined) { return "空"; }
    return node.symbol === " " ? "空格" : String(node.symbol);
  }
  return "(" + treeText(node.left) + treeText(node.right) + ")";
}

function nodesOf(node) {
  if (node === null || node === undefined) { return 0; }
  return 1 + nodesOf(node.left) + nodesOf(node.right);
}

function leavesOf(node) {
  if (node === null || node === undefined) { return 0; }
  if (isLeaf(node)) { return 1; }
  return leavesOf(node.left) + leavesOf(node.right);
}

function hexOf(list) {
  return (Array.isArray(list) ? list : []).map(function (value) {
    const text = Number(value).toString(16);
    return text.length < 2 ? "0" + text : text;
  }).join("");
}

export function render(spec) {
  const text = typeof spec.text === "string" ? spec.text : "";
  const counts = guard(function () { return frequencies(text); }, {});
  const tree = guard(function () { return buildTree(counts); }, null);
  const table = guard(function () { return codeTable(tree); }, {});
  const bits = guard(function () { return encode(text, table); }, "");
  const packed = guard(function () { return packBits(bits); }, [[], 0]);
  const bytes = Array.isArray(packed[0]) ? packed[0] : [];
  const pad = typeof packed[1] === "number" ? packed[1] : 0;
  const unpacked = guard(function () { return unpackBits(bytes, pad); }, "");
  const decoded = guard(function () { return decode(bits, tree); }, "");
  const symbols = Object.keys(counts).sort();
  const pairs = symbols.map(function (symbol) { return [symbol, counts[symbol]]; });
  const entries = Object.keys(table).sort().map(function (symbol) { return [symbol, table[symbol]]; });
  const ordered = entries.slice().sort(function (left, right) {
    const one = String(left[1]);
    const other = String(right[1]);
    if (one.length !== other.length) { return one.length - other.length; }
    return one < other ? -1 : (one > other ? 1 : 0);
  });
  let weighted = 0;
  let maxLen = 0;
  let minLen = entries.length > 0 ? 999 : 0;
  let prefixFree = entries.length > 0;
  let kraft = entries.length > 0;
  let countsSum = 0;
  for (const pair of pairs) {
    countsSum += typeof pair[1] === "number" ? pair[1] : 0;
  }
  for (const pair of entries) {
    const code = typeof pair[1] === "string" ? pair[1] : "";
    const count = typeof counts[pair[0]] === "number" ? counts[pair[0]] : 0;
    weighted += code.length * count;
    if (code.length > maxLen) { maxLen = code.length; }
    if (code.length < minLen) { minLen = code.length; }
    if (code.length === 0) { prefixFree = false; }
  }
  for (let left = 0; left < entries.length; left += 1) {
    for (let right = left + 1; right < entries.length; right += 1) {
      const one = String(entries[left][1]);
      const other = String(entries[right][1]);
      if (one.length > 0 && other.indexOf(one) === 0) { prefixFree = false; }
      if (other.length > 0 && one.indexOf(other) === 0) { prefixFree = false; }
    }
  }
  let kraftSum = 0;
  for (const pair of entries) {
    const code = String(pair[1]);
    if (code.length > maxLen) { kraft = false; }
    kraftSum += Math.pow(2, maxLen - code.length);
  }
  if (entries.length === 0 || kraftSum !== Math.pow(2, maxLen)) { kraft = false; }
  const half = Math.floor(text.length / 2);
  const midTable = guard(function () {
    return codeTable(buildTree(frequencies(text.slice(0, half))));
  }, null);
  const again = guard(function () {
    return codeTable(buildTree(frequencies(text)));
  }, null);
  const headBits = guard(function () { return encode(text.slice(0, half), table); }, "");
  const tailBits = guard(function () { return encode(text.slice(half), table); }, "");
  return {
    text: text,
    pairs: pairs,
    alphabet_size: symbols.length,
    counts_sum: countsSum,
    tree_json: serialized(tree),
    tree_text: treeText(tree),
    nodes: nodesOf(tree),
    leaves: leavesOf(tree),
    table: entries,
    ordered: ordered,
    bits: typeof bits === "string" ? bits : "",
    bit_length: typeof bits === "string" ? bits.length : 0,
    bytes: bytes,
    hex: hexOf(bytes),
    pad: pad,
    unpack_ok: unpacked === bits,
    decoded_ok: decoded === text,
    decoded_length: typeof decoded === "string" ? decoded.length : -1,
    weighted: weighted,
    avg_milli: text.length > 0 ? Math.floor(weighted * 1000 / text.length) : 0,
    max_len: maxLen,
    min_len: entries.length > 0 ? minLen : 0,
    kraft: kraft,
    prefix_free: prefixFree,
    replay_new: JSON.stringify(again) === JSON.stringify(table) ? 0 : 1,
    mid_differs: JSON.stringify(midTable) !== JSON.stringify(table),
    split_ok: headBits + tailBits === bits,
    sample_two: guard(function () { return codeTable(buildTree({ a: 1, b: 1 })); }, {}),
    sample_four: guard(function () { return codeTable(buildTree({ a: 5, b: 2, c: 1, d: 1 })); }, {}),
    sample_one: guard(function () { return codeTable(buildTree({ s: 4 })); }, {}),
    sample_pack: guard(function () { return packBits("01101"); }, [[], 0])
  };
}
