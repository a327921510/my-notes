import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DiffLineType,
  MergeStrategy,
  createDefaultMergeSelection,
  diffLines,
  mapMergeSelectionToText,
  mapSelectionWithStrategy,
  mapStrategyToAcceptedIndexes,
  matchStrategy,
} from "../dist/index.js";

/** 服务端版本在前、本机版本在后，与 useMmdDiff 的调用一致。 */
const SERVER = ["共同第一行", "服务端独有", "共同最后一行"].join("\n");
const LOCAL = ["共同第一行", "本机独有", "共同最后一行"].join("\n");

function diffFixture() {
  return diffLines(SERVER, LOCAL);
}

describe("diffLines", () => {
  it("两侧一致时标记 identical", () => {
    const diff = diffLines("a\nb", "a\nb");
    assert.equal(diff.identical, true);
    assert.deepEqual(diff.hunks, []);
    assert.deepEqual(diff.lines, []);
  });

  it("纯新增只产生增行", () => {
    const diff = diffLines("a", "a\nb");
    assert.deepEqual(diff.stat, { additions: 1, deletions: 0 });
    assert.equal(diff.lines.filter((line) => line.type === DiffLineType.ADD).length, 1);
  });

  it("纯删除只产生删行", () => {
    const diff = diffLines("a\nb", "a");
    assert.deepEqual(diff.stat, { additions: 0, deletions: 1 });
    assert.equal(diff.lines.filter((line) => line.type === DiffLineType.REMOVE).length, 1);
  });

  it("超大文档跳过逐行对比", () => {
    const huge = Array.from({ length: 4000 }, (_value, i) => `line ${i}`).join("\n");
    const diff = diffLines(huge, `${huge}\n尾巴`);
    assert.equal(diff.truncated, true);
    assert.equal(diff.identical, false);
    assert.deepEqual(diff.lines, []);
  });

  it("行下标连续且与全量行序列一一对应", () => {
    const diff = diffFixture();
    diff.lines.forEach((line, index) => assert.equal(line.index, index));
  });

  it("同一处服务端行排在本机行之前", () => {
    const diff = diffFixture();
    const removeIndex = diff.lines.findIndex((line) => line.type === DiffLineType.REMOVE);
    const addIndex = diff.lines.findIndex((line) => line.type === DiffLineType.ADD);
    assert.ok(removeIndex < addIndex);
  });
});

describe("mapMergeSelectionToText", () => {
  it("采用服务端：只留删行", () => {
    const diff = diffFixture();
    const selection = new Set(mapStrategyToAcceptedIndexes(diff.lines, MergeStrategy.SERVER));
    assert.equal(mapMergeSelectionToText(diff.lines, selection), SERVER);
  });

  it("采用本机：只留增行", () => {
    const diff = diffFixture();
    const selection = new Set(mapStrategyToAcceptedIndexes(diff.lines, MergeStrategy.LOCAL));
    assert.equal(mapMergeSelectionToText(diff.lines, selection), LOCAL);
  });

  it("两者都留：服务端行在前", () => {
    const diff = diffFixture();
    const selection = createDefaultMergeSelection(diff.lines);
    assert.equal(
      mapMergeSelectionToText(diff.lines, selection),
      ["共同第一行", "服务端独有", "本机独有", "共同最后一行"].join("\n"),
    );
  });

  it("两者都不留：只剩上下文行", () => {
    const diff = diffFixture();
    const selection = new Set(mapStrategyToAcceptedIndexes(diff.lines, MergeStrategy.NEITHER));
    assert.equal(
      mapMergeSelectionToText(diff.lines, selection),
      ["共同第一行", "共同最后一行"].join("\n"),
    );
  });

  it("混合勾选：逐行任意组合", () => {
    const diff = diffLines(
      ["头", "服务端A", "服务端B", "尾"].join("\n"),
      ["头", "本机A", "本机B", "尾"].join("\n"),
    );
    const keep = diff.lines.filter(
      (line) => line.text === "服务端A" || line.text === "本机B",
    );
    const selection = new Set(keep.map((line) => line.index));
    assert.equal(
      mapMergeSelectionToText(diff.lines, selection),
      ["头", "服务端A", "本机B", "尾"].join("\n"),
    );
  });

  it("上下文行恒进入结果，即使未被勾选", () => {
    const diff = diffFixture();
    assert.equal(
      mapMergeSelectionToText(diff.lines, new Set()),
      ["共同第一行", "共同最后一行"].join("\n"),
    );
  });
});

describe("mapSelectionWithStrategy", () => {
  it("只影响给定范围，范围外的勾选保持不变", () => {
    const diff = diffLines(
      ["头", "服务端A", "中间", "服务端B", "尾"].join("\n"),
      ["头", "本机A", "中间", "本机B", "尾"].join("\n"),
    );
    const all = createDefaultMergeSelection(diff.lines);
    const firstHunkLines = diff.hunks[0].lines;
    const next = mapSelectionWithStrategy(all, firstHunkLines, MergeStrategy.SERVER);

    const localAOutside = diff.lines.find((line) => line.text === "本机A");
    assert.equal(next.has(localAOutside.index), false);
    for (const line of diff.lines) {
      if (firstHunkLines.some((item) => item.index === line.index)) continue;
      assert.equal(next.has(line.index), all.has(line.index));
    }
  });
});

describe("matchStrategy", () => {
  it("能识别当前勾选组合对应的策略", () => {
    const diff = diffFixture();
    const both = createDefaultMergeSelection(diff.lines);
    assert.equal(matchStrategy(diff.lines, both), MergeStrategy.BOTH);

    const server = new Set(mapStrategyToAcceptedIndexes(diff.lines, MergeStrategy.SERVER));
    assert.equal(matchStrategy(diff.lines, server), MergeStrategy.SERVER);

    const local = new Set(mapStrategyToAcceptedIndexes(diff.lines, MergeStrategy.LOCAL));
    assert.equal(matchStrategy(diff.lines, local), MergeStrategy.LOCAL);

    assert.equal(matchStrategy(diff.lines, new Set()), MergeStrategy.NEITHER);
  });

  it("混合组合不对应任何单一策略", () => {
    const diff = diffLines(
      ["头", "服务端A", "服务端B", "尾"].join("\n"),
      ["头", "本机A", "本机B", "尾"].join("\n"),
    );
    const mixed = new Set([
      diff.lines.find((line) => line.text === "服务端A").index,
      diff.lines.find((line) => line.text === "本机B").index,
    ]);
    assert.equal(matchStrategy(diff.lines, mixed), null);
  });
});
