import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  NodeNameError,
  checkNodeName,
  formatBytes,
  isValidNodeName,
  mapNameToDedupedName,
  mapNodeNameToKey,
} from "../dist/index.js";

describe("checkNodeName", () => {
  it("接受常规名称", () => {
    assert.equal(checkNodeName("报告.pdf"), null);
    assert.equal(isValidNodeName(" 工作 "), true);
  });

  it("拒绝空名", () => {
    assert.equal(checkNodeName("   "), NodeNameError.EMPTY);
  });

  it("拒绝超长名称", () => {
    assert.equal(checkNodeName("a".repeat(256)), NodeNameError.TOO_LONG);
    assert.equal(checkNodeName("a".repeat(255)), null);
  });

  it("拒绝非法字符与控制字符", () => {
    for (const name of ["a/b", "a\\b", "a:b", "a*b", "a?b", 'a"b', "a<b", "a>b", "a|b", "a\u0001b"]) {
      assert.equal(checkNodeName(name), NodeNameError.ILLEGAL_CHAR, name);
    }
  });

  it("拒绝 . 与 ..", () => {
    assert.equal(checkNodeName("."), NodeNameError.RESERVED);
    assert.equal(checkNodeName(".."), NodeNameError.RESERVED);
    assert.equal(checkNodeName(".gitignore"), null);
  });
});

describe("mapNodeNameToKey", () => {
  it("去首尾空格并忽略大小写", () => {
    assert.equal(mapNodeNameToKey(" Report.TXT "), "report.txt");
    assert.equal(mapNodeNameToKey("报告"), "报告");
  });
});

describe("mapNameToDedupedName", () => {
  it("未占用时原样返回（去首尾空格）", () => {
    assert.equal(mapNameToDedupedName(" 报告.pdf ", new Set()), "报告.pdf");
  });

  it("已占用时在扩展名前追加序号", () => {
    const taken = new Set(["报告.pdf"]);
    assert.equal(mapNameToDedupedName("报告.pdf", taken), "报告(1).pdf");
  });

  it("连续占用时递增序号", () => {
    const taken = new Set(["报告.pdf", "报告(1).pdf", "报告(2).pdf"]);
    assert.equal(mapNameToDedupedName("报告.pdf", taken), "报告(3).pdf");
  });

  it("无扩展名时直接追加", () => {
    assert.equal(mapNameToDedupedName("工作", new Set(["工作"])), "工作(1)");
  });

  it("比较时忽略大小写", () => {
    assert.equal(mapNameToDedupedName("Report.txt", new Set(["report.txt"])), "Report(1).txt");
  });

  it("以点开头的名称不当作扩展名", () => {
    assert.equal(mapNameToDedupedName(".env", new Set([".env"])), ".env(1)");
  });
});

describe("formatBytes", () => {
  it("按单位换算", () => {
    assert.equal(formatBytes(0), "0 B");
    assert.equal(formatBytes(512), "512 B");
    assert.equal(formatBytes(1536), "1.5 KB");
    assert.equal(formatBytes(1024 * 1024), "1.0 MB");
    assert.equal(formatBytes(5 * 1024 ** 3), "5.0 GB");
  });

  it("非法输入回落到 0 B", () => {
    assert.equal(formatBytes(Number.NaN), "0 B");
    assert.equal(formatBytes(-1), "0 B");
  });
});
