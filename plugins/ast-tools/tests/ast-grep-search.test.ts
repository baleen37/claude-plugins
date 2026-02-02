/**
 * Tests for ast_grep_search tool
 */

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { astGrepSearch } from "../src/tools/ast-grep-search";
import fs from "fs";
import path from "path";
import os from "os";

describe("ast_grep_search", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "ast-test-"));
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it("finds function declarations in JavaScript", async () => {
    const testFile = path.join(testDir, "test.js");
    fs.writeFileSync(
      testFile,
      "function hello() {}\nfunction world() {}\n",
    );

    const result = await astGrepSearch({
      pattern: "function $NAME() {}",
      language: "javascript",
      path: testFile,
    });

    expect(result.content).toHaveLength(1);
    expect(result.content[0].text).toContain("hello");
    expect(result.content[0].text).toContain("world");
  });

  it("supports meta-variables", async () => {
    const testFile = path.join(testDir, "test.js");
    fs.writeFileSync(
      testFile,
      "const foo = 1;\nconst bar = 2;\nlet baz = 3;\n",
    );

    const result = await astGrepSearch({
      pattern: "const $NAME = $VALUE",
      language: "javascript",
      path: testFile,
      context: 0, // No context to avoid "baz" appearing
    });

    expect(result.content).toHaveLength(1);
    expect(result.content[0].text).toContain("foo");
    expect(result.content[0].text).toContain("bar");
    // baz should not be matched (it's let, not const)
    const text = result.content[0].text;
    const fooMatches = (text.match(/const foo/g) || []).length;
    const barMatches = (text.match(/const bar/g) || []).length;
    const bazMatches = (text.match(/let baz/g) || []).length;
    expect(fooMatches).toBeGreaterThan(0);
    expect(barMatches).toBeGreaterThan(0);
    expect(bazMatches).toBe(0); // Should not match let
  });

  it("respects maxResults limit", async () => {
    const testFile = path.join(testDir, "test.js");
    const functions = Array.from(
      { length: 30 },
      (_, i) => `function func${i}() {}`,
    ).join("\n");
    fs.writeFileSync(testFile, functions);

    const result = await astGrepSearch({
      pattern: "function $NAME() {}",
      language: "javascript",
      path: testFile,
      maxResults: 5,
      context: 0, // No context to avoid showing non-matched lines
    });

    expect(result.content).toHaveLength(1);
    const text = result.content[0].text;
    // Should show exactly 5 matches
    expect(text).toContain("Found 5 match(es)");
    expect(text).toContain("func0");
    expect(text).toContain("func4");
  });

  it("handles module not available gracefully", async () => {
    // This test assumes @ast-grep/napi might not be installed
    // The tool should return a helpful message rather than crashing
    const testFile = path.join(testDir, "test.js");
    fs.writeFileSync(testFile, "function test() {}");

    const result = await astGrepSearch({
      pattern: "function $NAME() {}",
      language: "javascript",
      path: testFile,
    });

    // Either succeeds or returns helpful error
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
  });
});
