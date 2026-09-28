// codec.js：前缀编码与位流打包（基线：只留空骨架，七个函数都没有实现）
export function frequencies(text) {
  return {};
}

export function buildTree(counts) {
  return { weight: 0, symbol: null, left: null, right: null };
}

export function codeTable(tree) {
  return {};
}

export function encode(text, table) {
  return "";
}

export function packBits(bits) {
  return [[], 0];
}

export function unpackBits(bytes, pad) {
  return "";
}

export function decode(bits, tree) {
  return "";
}
