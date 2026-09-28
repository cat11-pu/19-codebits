import fs from "node:fs";
import { frequencies, buildTree, codeTable, encode, packBits, unpackBits, decode } from "./codec.js";

const __lines = [];
function emit(label, value) {
  __lines.push([String(label), value]);
}

const spec = JSON.parse(fs.readFileSync(process.argv[2] || "sample/scene.json", "utf8"));
const TEXT = spec.text;

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

function ser(node) {
  if (node === null || node === undefined) { return null; }
  if (isLeaf(node)) { return [node.weight, node.symbol, null, null]; }
  return [node.weight, null, ser(node.left), ser(node.right)];
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

const counts = guard(function () { return frequencies(TEXT); }, {});
const tree = guard(function () { return buildTree(counts); }, null);
const table = guard(function () { return codeTable(tree); }, {});
const bits = guard(function () { return encode(TEXT, table); }, "");
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

let countsSum = 0;
for (const pair of pairs) {
  countsSum += typeof pair[1] === "number" ? pair[1] : 0;
}
let weighted = 0;
let maxLen = 0;
let minLen = entries.length > 0 ? 999 : 0;
let prefixFree = entries.length > 0;
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
let kraft = entries.length > 0;
for (const pair of entries) {
  const code = String(pair[1]);
  if (code.length > maxLen || code.length === 0) { kraft = false; }
  kraftSum += Math.pow(2, maxLen - code.length);
}
if (entries.length === 0 || kraftSum !== Math.pow(2, maxLen)) { kraft = false; }

let replayBad = 0;
let replayTable = null;
try {
  replayTable = codeTable(buildTree(frequencies(TEXT)));
} catch (error) {
  replayBad += 1;
}
const half = Math.floor(TEXT.length / 2);
const midTable = guard(function () {
  return codeTable(buildTree(frequencies(TEXT.slice(0, half))));
}, null);
const headBits = guard(function () { return encode(TEXT.slice(0, half), table); }, "");
const tailBits = guard(function () { return encode(TEXT.slice(half), table); }, "");

emit("频率表", JSON.stringify(pairs));
emit("字母表大小", symbols.length);
emit("计数和", countsSum);
emit("树形", JSON.stringify(ser(tree)));
emit("树节点数", nodesOf(tree));
emit("叶子数", leavesOf(tree));
emit("内部节点数", nodesOf(tree) - leavesOf(tree));
emit("码表", JSON.stringify(entries));
emit("码表按码字升序", JSON.stringify(ordered));
emit("位串", typeof bits === "string" ? bits : "");
emit("位串长度", typeof bits === "string" ? bits.length : -1);
emit("打包字节", JSON.stringify(bytes));
emit("补位个数", pad);
emit("字节十六进制", hexOf(bytes));
emit("十六进制前缀", hexOf(bytes).slice(0, 24));
emit("解包回原位串", unpacked === bits ? 1 : 0);
emit("解码回文一致", decoded === TEXT ? 1 : 0);
emit("解码长度", typeof decoded === "string" ? decoded.length : -1);
emit("加权路径长度", weighted);
emit("平均码长千分", TEXT.length > 0 ? Math.floor(weighted * 1000 / TEXT.length) : 0);
emit("最长码长", maxLen);
emit("最短码长", minLen);
emit("克拉夫特和成立", kraft ? 1 : 0);
emit("前缀无关", prefixFree ? 1 : 0);
emit("重放不新增", JSON.stringify(replayTable) === JSON.stringify(table) ? 0 : 1);
emit("重放报错条数", replayBad);
emit("拆两轮中间态不同", JSON.stringify(midTable) !== JSON.stringify(table) ? 1 : 0);
emit("拆两轮收尾态一致", headBits + tailBits === bits ? 1 : 0);
emit("样例两符号码表", JSON.stringify(guard(function () { return codeTable(buildTree({ a: 1, b: 1 })); }, {})));
emit("样例四符号码表", JSON.stringify(guard(function () { return codeTable(buildTree({ a: 5, b: 2, c: 1, d: 1 })); }, {})));
emit("样例单符号码表", JSON.stringify(guard(function () { return codeTable(buildTree({ s: 4 })); }, {})));
emit("样例包位", JSON.stringify(guard(function () { return packBits("01101"); }, [[], 0])));

// ---- 错误路径探针：真调用实现，看它报出什么码 ----
try {
  encode("Z", table);
  emit("缺码字报码", "没有报错");
} catch (error) {
  emit("缺码字报码", error && error.code ? error.code : String(error.message));
}
try {
  buildTree({});
  emit("空表报码", "没有报错");
} catch (error) {
  emit("空表报码", error && error.code ? error.code : String(error.message));
}
try {
  buildTree({ a: 0 });
  emit("坏计数报码", "没有报错");
} catch (error) {
  emit("坏计数报码", error && error.code ? error.code : String(error.message));
}
try {
  packBits("012");
  emit("坏位串报码", "没有报错");
} catch (error) {
  emit("坏位串报码", error && error.code ? error.code : String(error.message));
}
try {
  unpackBits([-1], 0);
  emit("坏字节报码", "没有报错");
} catch (error) {
  emit("坏字节报码", error && error.code ? error.code : String(error.message));
}
try {
  unpackBits([255], 3);
  emit("补位非零报码", "没有报错");
} catch (error) {
  emit("补位非零报码", error && error.code ? error.code : String(error.message));
}
try {
  decode("1", { weight: 2, symbol: null, left: { weight: 1, symbol: "a", left: null, right: null }, right: null });
  emit("空子报码", "没有报错");
} catch (error) {
  emit("空子报码", error && error.code ? error.code : String(error.message));
}
try {
  decode("01", buildTree({ a: 5, b: 2, c: 1, d: 1 }));
  emit("半截报码", "没有报错");
} catch (error) {
  emit("半截报码", error && error.code ? error.code : String(error.message));
}

// ---- 期望值（参考模型算出）----
const EXPECTED = {
  "频率表": [
    [
      " ",
      26
    ],
    [
      ";",
      1
    ],
    [
      "a",
      10
    ],
    [
      "b",
      3
    ],
    [
      "c",
      2
    ],
    [
      "d",
      4
    ],
    [
      "e",
      11
    ],
    [
      "f",
      3
    ],
    [
      "g",
      4
    ],
    [
      "h",
      5
    ],
    [
      "i",
      6
    ],
    [
      "j",
      2
    ],
    [
      "k",
      2
    ],
    [
      "l",
      6
    ],
    [
      "m",
      3
    ],
    [
      "n",
      7
    ],
    [
      "o",
      8
    ],
    [
      "p",
      4
    ],
    [
      "q",
      2
    ],
    [
      "r",
      3
    ],
    [
      "s",
      7
    ],
    [
      "t",
      5
    ],
    [
      "u",
      4
    ],
    [
      "v",
      3
    ],
    [
      "w",
      2
    ],
    [
      "x",
      2
    ],
    [
      "y",
      2
    ],
    [
      "z",
      2
    ]
  ],
  "字母表大小": 28,
  "计数和": 139,
  "树形": [
    139,
    null,
    [
      56,
      null,
      [
        26,
        " ",
        null,
        null
      ],
      [
        30,
        null,
        [
          14,
          null,
          [
            7,
            "s",
            null,
            null
          ],
          [
            7,
            null,
            [
              3,
              null,
              [
                1,
                ";",
                null,
                null
              ],
              [
                2,
                "c",
                null,
                null
              ]
            ],
            [
              4,
              "d",
              null,
              null
            ]
          ]
        ],
        [
          16,
          null,
          [
            8,
            "o",
            null,
            null
          ],
          [
            8,
            null,
            [
              4,
              "g",
              null,
              null
            ],
            [
              4,
              "p",
              null,
              null
            ]
          ]
        ]
      ]
    ],
    [
      83,
      null,
      [
        36,
        null,
        [
          16,
          null,
          [
            8,
            null,
            [
              4,
              "u",
              null,
              null
            ],
            [
              4,
              null,
              [
                2,
                "j",
                null,
                null
              ],
              [
                2,
                "k",
                null,
                null
              ]
            ]
          ],
          [
            8,
            null,
            [
              4,
              null,
              [
                2,
                "q",
                null,
                null
              ],
              [
                2,
                "w",
                null,
                null
              ]
            ],
            [
              4,
              null,
              [
                2,
                "x",
                null,
                null
              ],
              [
                2,
                "y",
                null,
                null
              ]
            ]
          ]
        ],
        [
          20,
          null,
          [
            10,
            "a",
            null,
            null
          ],
          [
            10,
            null,
            [
              5,
              "h",
              null,
              null
            ],
            [
              5,
              "t",
              null,
              null
            ]
          ]
        ]
      ],
      [
        47,
        null,
        [
          22,
          null,
          [
            11,
            "e",
            null,
            null
          ],
          [
            11,
            null,
            [
              5,
              null,
              [
                2,
                "z",
                null,
                null
              ],
              [
                3,
                "b",
                null,
                null
              ]
            ],
            [
              6,
              "i",
              null,
              null
            ]
          ]
        ],
        [
          25,
          null,
          [
            12,
            null,
            [
              6,
              "l",
              null,
              null
            ],
            [
              6,
              null,
              [
                3,
                "f",
                null,
                null
              ],
              [
                3,
                "m",
                null,
                null
              ]
            ]
          ],
          [
            13,
            null,
            [
              6,
              null,
              [
                3,
                "r",
                null,
                null
              ],
              [
                3,
                "v",
                null,
                null
              ]
            ],
            [
              7,
              "n",
              null,
              null
            ]
          ]
        ]
      ]
    ]
  ],
  "树节点数": 55,
  "叶子数": 28,
  "内部节点数": 27,
  "码表": [
    [
      " ",
      "00"
    ],
    [
      ";",
      "010100"
    ],
    [
      "a",
      "1010"
    ],
    [
      "b",
      "110101"
    ],
    [
      "c",
      "010101"
    ],
    [
      "d",
      "01011"
    ],
    [
      "e",
      "1100"
    ],
    [
      "f",
      "111010"
    ],
    [
      "g",
      "01110"
    ],
    [
      "h",
      "10110"
    ],
    [
      "i",
      "11011"
    ],
    [
      "j",
      "100010"
    ],
    [
      "k",
      "100011"
    ],
    [
      "l",
      "11100"
    ],
    [
      "m",
      "111011"
    ],
    [
      "n",
      "11111"
    ],
    [
      "o",
      "0110"
    ],
    [
      "p",
      "01111"
    ],
    [
      "q",
      "100100"
    ],
    [
      "r",
      "111100"
    ],
    [
      "s",
      "0100"
    ],
    [
      "t",
      "10111"
    ],
    [
      "u",
      "10000"
    ],
    [
      "v",
      "111101"
    ],
    [
      "w",
      "100101"
    ],
    [
      "x",
      "100110"
    ],
    [
      "y",
      "100111"
    ],
    [
      "z",
      "110100"
    ]
  ],
  "码表按码字升序": [
    [
      " ",
      "00"
    ],
    [
      "s",
      "0100"
    ],
    [
      "o",
      "0110"
    ],
    [
      "a",
      "1010"
    ],
    [
      "e",
      "1100"
    ],
    [
      "d",
      "01011"
    ],
    [
      "g",
      "01110"
    ],
    [
      "p",
      "01111"
    ],
    [
      "u",
      "10000"
    ],
    [
      "h",
      "10110"
    ],
    [
      "t",
      "10111"
    ],
    [
      "i",
      "11011"
    ],
    [
      "l",
      "11100"
    ],
    [
      "n",
      "11111"
    ],
    [
      ";",
      "010100"
    ],
    [
      "c",
      "010101"
    ],
    [
      "j",
      "100010"
    ],
    [
      "k",
      "100011"
    ],
    [
      "q",
      "100100"
    ],
    [
      "w",
      "100101"
    ],
    [
      "x",
      "100110"
    ],
    [
      "y",
      "100111"
    ],
    [
      "z",
      "110100"
    ],
    [
      "b",
      "110101"
    ],
    [
      "f",
      "111010"
    ],
    [
      "m",
      "111011"
    ],
    [
      "r",
      "111100"
    ],
    [
      "v",
      "111101"
    ]
  ],
  "位串": "1011110110110000100100100001101101010110001100110101111100011010010111111001110100110100110001000101000011101101111010000011011110111001111000010111101101100001110010101101001001110001011011001110010100001011110110110000111001010110100100111000101101100111000111111010011110100001001011011011011111001100001011110110110000100100100001101101010110001100111010011010011000100010100001110110111101000010100111010101101111111001010111110101100101001110101011011111110001101111011100111100001110101101111110111000001001110111010111001110000010010111011011111110001000010101111101011000111111001101011101011110011000100",
  "位串长度": 613,
  "打包字节": [
    189,
    176,
    146,
    27,
    86,
    51,
    95,
    26,
    95,
    157,
    52,
    196,
    80,
    237,
    232,
    55,
    185,
    225,
    123,
    97,
    202,
    210,
    113,
    108,
    229,
    11,
    219,
    14,
    86,
    147,
    139,
    103,
    31,
    167,
    161,
    45,
    183,
    204,
    47,
    108,
    36,
    134,
    213,
    140,
    233,
    166,
    34,
    135,
    111,
    66,
    157,
    91,
    249,
    95,
    89,
    78,
    173,
    252,
    111,
    115,
    195,
    173,
    251,
    130,
    119,
    92,
    224,
    151,
    111,
    226,
    21,
    245,
    143,
    205,
    117,
    230,
    32
  ],
  "补位个数": 3,
  "字节十六进制": "bdb0921b56335f1a5f9d34c450ede837b9e17b61cad2716ce50bdb0e56938b671fa7a12db7cc2f6c2486d58ce9a622876f429d5bf95f594eadfc6f73c3adfb82775ce0976fe215f58fcd75e620",
  "十六进制前缀": "bdb0921b56335f1a5f9d34c4",
  "解包回原位串": 1,
  "解码回文一致": 1,
  "解码长度": 139,
  "加权路径长度": 613,
  "平均码长千分": 4410,
  "最长码长": 6,
  "最短码长": 2,
  "克拉夫特和成立": 1,
  "前缀无关": 1,
  "重放不新增": 0,
  "重放报错条数": 0,
  "拆两轮中间态不同": 1,
  "拆两轮收尾态一致": 1,
  "样例两符号码表": {
    "a": "0",
    "b": "1"
  },
  "样例四符号码表": {
    "b": "00",
    "c": "010",
    "d": "011",
    "a": "1"
  },
  "样例单符号码表": {
    "s": "0"
  },
  "样例包位": [
    [
      104
    ],
    3
  ],
  "缺码字报码": "E_NO_CODE",
  "空表报码": "E_EMPTY",
  "坏计数报码": "E_BAD_COUNT",
  "坏位串报码": "E_BAD_BITS",
  "坏字节报码": "E_BAD_BYTE",
  "补位非零报码": "E_PAD",
  "空子报码": "E_BAD_CODE",
  "半截报码": "E_TRUNCATED"
};
function __same(got, want) {
  if (typeof got === "string") {
    try {
      const parsed = JSON.parse(got);
      if (JSON.stringify(parsed) === JSON.stringify(want)) { return true; }
    } catch (error) { }
  }
  return JSON.stringify(got) === JSON.stringify(want);
}
let __bad = 0;
for (const [label, want] of Object.entries(EXPECTED)) {
  const found = __lines.find((pair) => pair[0] === label);
  if (!found) {
    __bad += 1;
    console.log("缺失验收项 " + label);
    continue;
  }
  if (__same(found[1], want)) {
    console.log("一致 " + label + " = " + JSON.stringify(found[1]));
  } else {
    __bad += 1;
    console.log("不一致 " + label + " 期望 " + JSON.stringify(want) + " 实际 " + JSON.stringify(found[1]));
  }
}
console.log("验收项 " + (Object.keys(EXPECTED).length - __bad) + "/" + Object.keys(EXPECTED).length + " 通过");
process.exit(__bad === 0 ? 0 : 1);
