// codec.js：前缀编码与位流打包

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function isLeafNode(node) {
  return node !== null && node !== undefined &&
         (node.left === null || node.left === undefined) &&
         (node.right === null || node.right === undefined);
}

export function frequencies(text) {
  const counts = {};
  const source = typeof text === "string" ? text : String(text);
  for (const ch of source) {
    counts[ch] = (counts[ch] || 0) + 1;
  }
  return counts;
}

export function buildTree(counts) {
  const entries = Object.entries(counts || {});
  if (entries.length === 0) { fail("E_EMPTY"); }

  const nodes = [];
  let seq = 0;
  const symbols = entries.map((entry) => entry[0]).sort();
  for (const symbol of symbols) {
    const weight = counts[symbol];
    if (typeof weight !== "number" || !Number.isInteger(weight) || weight <= 0) {
      fail("E_BAD_COUNT");
    }
    nodes.push({ weight, symbol, left: null, right: null, seq });
    seq += 1;
  }

  const takeMin = () => {
    let index = 0;
    for (let i = 1; i < nodes.length; i += 1) {
      if (nodes[i].weight < nodes[index].weight ||
          (nodes[i].weight === nodes[index].weight && nodes[i].seq < nodes[index].seq)) {
        index = i;
      }
    }
    return nodes.splice(index, 1)[0];
  };

  while (nodes.length > 1) {
    const left = takeMin();
    const right = takeMin();
    nodes.push({
      weight: left.weight + right.weight,
      symbol: null,
      left,
      right,
      seq
    });
    seq += 1;
  }
  return nodes[0];
}

export function codeTable(tree) {
  const table = {};
  if (tree === null || tree === undefined) { return table; }
  if (isLeafNode(tree)) {
    if (tree.symbol !== null && tree.symbol !== undefined) {
      table[tree.symbol] = "0";
    }
    return table;
  }
  const walk = (node, prefix) => {
    if (node === null || node === undefined) { return; }
    if (isLeafNode(node)) {
      if (node.symbol !== null && node.symbol !== undefined) {
        table[node.symbol] = prefix;
      }
      return;
    }
    walk(node.left, prefix + "0");
    walk(node.right, prefix + "1");
  };
  walk(tree, "");
  return table;
}

export function encode(text, table) {
  let bits = "";
  const source = typeof text === "string" ? text : String(text);
  for (const ch of source) {
    if (!Object.prototype.hasOwnProperty.call(table || {}, ch)) {
      fail("E_NO_CODE");
    }
    bits += table[ch];
  }
  return bits;
}

export function packBits(bits) {
  const source = typeof bits === "string" ? bits : String(bits);
  const bytes = [];
  for (const ch of source) {
    if (ch !== "0" && ch !== "1") { fail("E_BAD_BITS"); }
  }
  for (let i = 0; i < source.length; i += 8) {
    let byte = 0;
    for (let bit = 0; bit < 8; bit += 1) {
      const ch = source.charAt(i + bit) || "0";
      byte = (byte << 1) | (ch === "1" ? 1 : 0);
    }
    bytes.push(byte);
  }
  const pad = source.length === 0 ? 0 : (8 - (source.length % 8)) % 8;
  return [bytes, pad];
}

export function unpackBits(bytes, pad) {
  const list = Array.isArray(bytes) ? bytes : [];
  for (const value of list) {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 255) {
      fail("E_BAD_BYTE");
    }
  }
  let bits = "";
  for (const value of list) {
    for (let bit = 7; bit >= 0; bit -= 1) {
      bits += (value >> bit) & 1 ? "1" : "0";
    }
  }
  const padding = typeof pad === "number" && Number.isInteger(pad) && pad > 0 ? pad : 0;
  if (padding > 0) {
    if (padding > bits.length) { fail("E_PAD"); }
    const tail = bits.slice(bits.length - padding);
    if (tail.indexOf("1") !== -1) { fail("E_PAD"); }
    bits = bits.slice(0, bits.length - padding);
  }
  return bits;
}

export function decode(bits, tree) {
  if (tree === null || tree === undefined) { fail("E_BAD_CODE"); }
  const source = typeof bits === "string" ? bits : String(bits);
  let output = "";

  if (isLeafNode(tree)) {
    for (const ch of source) {
      if (ch !== "0") { fail("E_BAD_CODE"); }
      output += tree.symbol;
    }
    return output;
  }

  let node = tree;
  for (const ch of source) {
    let next;
    if (ch === "0") { next = node.left; }
    else if (ch === "1") { next = node.right; }
    else { next = null; }
    if (next === null || next === undefined) { fail("E_BAD_CODE"); }
    node = next;
    if (isLeafNode(node)) {
      output += node.symbol;
      node = tree;
    }
  }
  if (node !== tree) { fail("E_TRUNCATED"); }
  return output;
}
