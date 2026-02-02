/**
 * Tests for ast_grep_replace tool
 */

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { astGrepReplace } from "../src/tools/ast-grep-replace";
import fs from "fs";
import path from "path";
import os from "os";

describe("ast_grep_replace", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "ast-test-"));
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it("dry-run does not modify files", async () => {
    const testFile = path.join(testDir, "test.js");
    const original = "var foo = 1;\nvar bar = 2;\n";
    fs.writeFileSync(testFile, original);

    const result = await astGrepReplace({
      pattern: "var $NAME = $VALUE",
      replacement: "const $NAME = $VALUE",
      language: "javascript",
      path: testFile,
      dryRun: true,
    });

    // File should not be modified
    const content = fs.readFileSync(testFile, "utf-8");
    expect(content).toBe(original);

    // Result should indicate dry run
    expect(result.content[0].text).toContain("DRY RUN");
  });

  it("replaces code when dryRun=false", async () => {
    const testFile = path.join(testDir, "test.js");
    fs.writeFileSync(testFile, "var foo = 1;\nvar bar = 2;\n");

    const result = await astGrepReplace({
      pattern: "var $NAME = $VALUE",
      replacement: "const $NAME = $VALUE",
      language: "javascript",
      path: testFile,
      dryRun: false,
    });

    // File should be modified
    const content = fs.readFileSync(testFile, "utf-8");
    expect(content).toContain("const foo = 1");
    expect(content).toContain("const bar = 2");
    expect(content).not.toContain("var");

    // Result should indicate changes applied
    expect(result.content[0].text).toContain("CHANGES APPLIED");
  });

  it("supports meta-variables in replacement", async () => {
    const testFile = path.join(testDir, "test.js");
    fs.writeFileSync(testFile, "function oldName(x, y) { return x + y; }");

    await astGrepReplace({
      pattern: "function oldName($$$ARGS) { $$$BODY }",
      replacement: "function newName($$$ARGS) { $$$BODY }",
      language: "javascript",
      path: testFile,
      dryRun: false,
    });

    const content = fs.readFileSync(testFile, "utf-8");
    expect(content).toContain("newName");
    expect(content).not.toContain("oldName");
  });

  it("shows before and after in output", async () => {
    const testFile = path.join(testDir, "test.js");
    fs.writeFileSync(testFile, "var x = 1;");

    const result = await astGrepReplace({
      pattern: "var $NAME = $VALUE",
      replacement: "const $NAME = $VALUE",
      language: "javascript",
      path: testFile,
      dryRun: true,
    });

    const output = result.content[0].text;
    expect(output).toContain("- var");
    expect(output).toContain("+ const");
  });

  it("handles module not available gracefully", async () => {
    const testFile = path.join(testDir, "test.js");
    fs.writeFileSync(testFile, "var x = 1;");

    await astGrepReplace({
      pattern: "var $NAME = $VALUE",
      replacement: "const $NAME = $VALUE",
      language: "javascript",
      path: testFile,
    });

    // Test passes if no error is thrown
    expect(true).toBe(true);
  });
});
