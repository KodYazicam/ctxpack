import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isIgnored, loadIgnoreRules, loadNestedIgnore, toRelative } from "../src/gitignore.js";

function rulesFrom(gitignore: string): ReturnType<typeof loadIgnoreRules> {
  const dir = mkdtempSync(join(tmpdir(), "ctxpack-gitignore-"));
  writeFileSync(join(dir, ".gitignore"), gitignore);
  return loadIgnoreRules(dir);
}

describe("gitignore glob compilation", () => {
  it("treats regex metacharacters as literal filename characters", () => {
    const rules = rulesFrom("a+b.txt\n");
    expect(isIgnored("a+b.txt", rules, false)).toBe(true);
    expect(isIgnored("aab.txt", rules, false)).toBe(false);
  });

  it("keeps *, **, and ? as glob operators", () => {
    const rules = rulesFrom("*.log\nbuild/**\nfile?.txt\n");
    expect(isIgnored("app.log", rules, false)).toBe(true);
    expect(isIgnored("nested/app.log", rules, false)).toBe(true);
    expect(isIgnored("build/a/b.js", rules, true)).toBe(true);
    expect(isIgnored("file1.txt", rules, false)).toBe(true);
    expect(isIgnored("file10.txt", rules, false)).toBe(false);
  });

  it("supports anchored rules", () => {
    const rules = rulesFrom("/root-only.txt\n");
    expect(isIgnored("root-only.txt", rules, false)).toBe(true);
    expect(isIgnored("pkg/root-only.txt", rules, false)).toBe(false);
  });

  it("loads nested rules and computes relative paths", () => {
    const dir = mkdtempSync(join(tmpdir(), "ctxpack-gitignore-"));
    writeFileSync(join(dir, ".gitignore"), "generated.ts\n");
    const nested = loadNestedIgnore(dir, ".");
    expect(isIgnored("generated.ts", nested, false)).toBe(true);
    expect(toRelative(dir, join(dir, "src", "index.ts"))).toBe("src/index.ts");
    expect(toRelative(dir, dir)).toBe(".");
  });

  it("ignores oversized patterns", () => {
    const rules = rulesFrom(`${"a".repeat(1025)}\n`);
    expect(isIgnored("anything.txt", rules, false)).toBe(false);
  });
});
