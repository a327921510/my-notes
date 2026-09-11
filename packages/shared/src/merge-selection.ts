/**
 * `.mmd` 并发编辑的行级选择性采纳。
 *
 * 采纳单元是 diff 行：上下文行恒进入结果且不可取消；删行（服务端独有）与增行
 * （本机独有）由用户勾选。选择态只记「被采纳的 diff 行下标」，拼接顺序沿用
 * diff 输出顺序，因此同一处服务端行天然排在本机行之前。
 */

import { type DiffLine, DiffLineType } from "./text-diff.js";

/** 被采纳的 diff 行下标集合（上下文行无需记录）。 */
export type MergeSelection = ReadonlySet<number>;

export const MergeStrategy = {
  /** 只留服务端行 */
  SERVER: "server",
  /** 只留本机行 */
  LOCAL: "local",
  /** 两者都留，服务端在前 */
  BOTH: "both",
  /** 两者都不留，等于删掉这段 */
  NEITHER: "neither",
} as const;
export type MergeStrategy = (typeof MergeStrategy)[keyof typeof MergeStrategy];

export const MERGE_STRATEGY_LABELS: Record<MergeStrategy, string> = {
  [MergeStrategy.SERVER]: "采用服务端",
  [MergeStrategy.LOCAL]: "采用本机",
  [MergeStrategy.BOTH]: "两者都留",
  [MergeStrategy.NEITHER]: "两者都不留",
};

export function isSelectableLine(line: DiffLine): boolean {
  return line.type !== DiffLineType.CONTEXT;
}

function isAcceptedByStrategy(line: DiffLine, strategy: MergeStrategy): boolean {
  switch (strategy) {
    case MergeStrategy.SERVER:
      return line.type === DiffLineType.REMOVE;
    case MergeStrategy.LOCAL:
      return line.type === DiffLineType.ADD;
    case MergeStrategy.BOTH:
      return true;
    case MergeStrategy.NEITHER:
      return false;
  }
}

/**
 * 把某个策略展开成该范围内被采纳的行下标。
 * 传入单个变更块的行即为块级操作，传入全量行即为全局批量。
 */
export function mapStrategyToAcceptedIndexes(
  lines: readonly DiffLine[],
  strategy: MergeStrategy,
): number[] {
  return lines
    .filter((line) => isSelectableLine(line) && isAcceptedByStrategy(line, strategy))
    .map((line) => line.index);
}

/** 合并态的初始选择：等同「两者都留」，但块仍需用户确认（待处理态由调用方维护）。 */
export function createDefaultMergeSelection(lines: readonly DiffLine[]): Set<number> {
  return new Set(mapStrategyToAcceptedIndexes(lines, MergeStrategy.BOTH));
}

/** 在给定范围内套用策略，返回更新后的完整选择集（不修改入参）。 */
export function mapSelectionWithStrategy(
  selection: MergeSelection,
  lines: readonly DiffLine[],
  strategy: MergeStrategy,
): Set<number> {
  const next = new Set(selection);
  const accepted = new Set(mapStrategyToAcceptedIndexes(lines, strategy));
  for (const line of lines) {
    if (!isSelectableLine(line)) continue;
    if (accepted.has(line.index)) next.add(line.index);
    else next.delete(line.index);
  }
  return next;
}

/** 判断某范围当前的勾选组合恰好等于某个策略，用于块头按钮的选中态。 */
export function matchStrategy(
  lines: readonly DiffLine[],
  selection: MergeSelection,
): MergeStrategy | null {
  const strategies: MergeStrategy[] = [
    MergeStrategy.BOTH,
    MergeStrategy.SERVER,
    MergeStrategy.LOCAL,
    MergeStrategy.NEITHER,
  ];
  for (const strategy of strategies) {
    const expected = new Set(mapStrategyToAcceptedIndexes(lines, strategy));
    const actual = lines.filter((l) => isSelectableLine(l) && selection.has(l.index));
    if (actual.length === expected.size && actual.every((l) => expected.has(l.index))) {
      return strategy;
    }
  }
  return null;
}

/**
 * 按选择拼回完整正文。
 * 例：上下文行 `a`、删行 `b`、增行 `c`，只勾选 `c` → `a\nc`
 */
export function mapMergeSelectionToText(
  lines: readonly DiffLine[],
  selection: MergeSelection,
): string {
  return lines
    .filter((line) => (isSelectableLine(line) ? selection.has(line.index) : true))
    .map((line) => line.text)
    .join("\n");
}
