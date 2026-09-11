import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isCredentialTableHeader,
  isMmdName,
  mapCredentialCellToPlain,
  mapNameToMmdName,
  parseMmdSegments,
  splitTableRow,
} from "../dist/index.js";

const CREDENTIAL_TABLE = [
  "| 地址 | 账号 | 密码 | 备注 |",
  "| --- | --- | --- | --- |",
  "| https://a.com | admin | p@ss | 测试 |",
];

describe("mmd 名称", () => {
  it("识别并补齐后缀", () => {
    assert.equal(isMmdName("说明.mmd"), true);
    assert.equal(isMmdName("说明.MMD"), true);
    assert.equal(isMmdName("说明.md"), false);
    assert.equal(mapNameToMmdName("说明"), "说明.mmd");
    assert.equal(mapNameToMmdName("说明.mmd"), "说明.mmd");
  });
});

describe("splitTableRow", () => {
  it("剥掉外侧竖线并去空格", () => {
    assert.deepEqual(splitTableRow("| a | b |"), ["a", "b"]);
    assert.deepEqual(splitTableRow("a | b"), ["a", "b"]);
    assert.deepEqual(splitTableRow("没有竖线"), []);
  });
});

describe("isCredentialTableHeader", () => {
  it("表头依次匹配才算凭据表", () => {
    assert.equal(isCredentialTableHeader(["地址", "账号", "密码", "备注"]), true);
    assert.equal(isCredentialTableHeader(["**地址**", "`账号`", "密码", "备注"]), true);
    assert.equal(isCredentialTableHeader(["账号", "地址", "密码", "备注"]), false);
    assert.equal(isCredentialTableHeader(["地址", "账号", "码", "备注"]), false);
    assert.equal(isCredentialTableHeader(["地址", "账号", "密码"]), false);
  });
});

describe("mapCredentialCellToPlain", () => {
  it("链接只取可见文字", () => {
    assert.equal(mapCredentialCellToPlain("[后台](https://a.com)"), "后台");
    assert.equal(mapCredentialCellToPlain("[](https://a.com)"), "https://a.com");
  });

  it("去掉常见行内标记", () => {
    assert.equal(mapCredentialCellToPlain("**admin**"), "admin");
    assert.equal(mapCredentialCellToPlain("`p@ss`"), "p@ss");
    assert.equal(mapCredentialCellToPlain("  纯文本 "), "纯文本");
  });
});

describe("parseMmdSegments", () => {
  it("切出凭据表并保留前后 Markdown", () => {
    const segments = parseMmdSegments(["# 标题", "", ...CREDENTIAL_TABLE, "", "结尾"].join("\n"));
    assert.deepEqual(
      segments.map((segment) => segment.type),
      ["markdown", "credentialTable", "markdown"],
    );
    const table = segments[1];
    assert.deepEqual(table.header, ["地址", "账号", "密码", "备注"]);
    assert.deepEqual(table.body, [["https://a.com", "admin", "p@ss", "测试"]]);
  });

  it("非凭据表头的管道表留在 Markdown 段里", () => {
    const segments = parseMmdSegments(["| 列A | 列B |", "| --- | --- |", "| 1 | 2 |"].join("\n"));
    assert.deepEqual(
      segments.map((segment) => segment.type),
      ["markdown"],
    );
  });

  it("同一文档中的多个凭据表都被识别", () => {
    const source = [...CREDENTIAL_TABLE, "", "中间", "", ...CREDENTIAL_TABLE].join("\n");
    const types = parseMmdSegments(source).map((segment) => segment.type);
    assert.deepEqual(types, ["credentialTable", "markdown", "credentialTable"]);
  });

  it("兼容 CRLF 换行", () => {
    const segments = parseMmdSegments(CREDENTIAL_TABLE.join("\r\n"));
    assert.equal(segments[0].type, "credentialTable");
  });

  it("空文档得到空结果", () => {
    assert.deepEqual(parseMmdSegments(""), [{ type: "markdown", text: "" }]);
  });
});
