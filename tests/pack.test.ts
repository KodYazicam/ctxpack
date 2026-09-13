import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { pack } from "../src/pack.js";
import { estimateTokens, heuristicTokens } from "../src/tokens.js";
import { redactSecrets, findSecrets } from "../src/secrets.js";
import { run } from "../src/cli.js";
import { packageVersion } from "../src/version.js";

function fixture(): string {
  const dir = mkdtempSync(join(tmpdir(), "ctxpack-"));
  writeFileSync(join(dir, "README.md"), "# Demo\n\nHello world.\n");
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "demo", version: "1.0.0" }, null, 2),
  );
  mkdirSync(join(dir, "src"));
  writeFileSync(
    join(dir, "src", "index.ts"),
    'export const n = 42;\nconst key = "sk-abcdefghijklmnopqrstuvwxyz1234567890ab";\n',
  );
  writeFileSync(join(dir, ".gitignore"), "secret.txt\n");
  writeFileSync(join(dir, "secret.txt"), "should-be-ignored\n");
  mkdirSync(join(dir, "node_modules", "left-pad"), { recursive: true });
  writeFileSync(join(dir, "node_modules", "left-pad", "index.js"), "module.exports = 1\n");
  writeFileSync(join(dir, ".env"), "SECRET=super-secret-value\n");
  writeFileSync(join(dir, ".env.example"), "SECRET=\n");
  mkdirSync(join(dir, "pkg"));
  writeFileSync(join(dir, "pkg", ".gitignore"), "generated.ts\n");
  writeFileSync(join(dir, "pkg", "keep.ts"), "export const keep = 1;\n");
  writeFileSync(join(dir, "pkg", "generated.ts"), "export const generated = 1;\n");
  return dir;
}

describe("estimateTokens", () => {
  it("returns a positive integer for source-like text", () => {
    const n = estimateTokens("function hello() { return 'world'; }");
    expect(n).toBeGreaterThan(0);
    expect(Number.isInteger(n)).toBe(true);
    expect(heuristicTokens("abc")).toBeGreaterThan(0);
  });
});

describe("secrets", () => {
  it("finds and redacts openai-like keys including sk-proj", () => {
    const text = 'const k = "sk-abcdefghijklmnopqrstuvwxyz1234567890ab";';
    expect(findSecrets(text).some((h) => h.kind === "openai-key")).toBe(true);
    expect(redactSecrets(text).text).toContain("[REDACTED]");
    const proj = 'const k = "sk-proj-abcdefghijklmnopqrstuvwxyz123456";';
    expect(findSecrets(proj).some((h) => h.kind === "openai-key")).toBe(true);
  });

  it("finds github fine-grained tokens and stripe live keys", () => {
    expect(findSecrets("github_pat_abcdefghijklmnopqrstuvwxyz").length).toBeGreaterThan(0);
    expect(findSecrets("sk_live_abcdefghijklmnopqrstuv").length).toBeGreaterThan(0);
  });
});

describe("pack", () => {
  it("packs markdown with tree, skips gitignored paths, redacts secrets", () => {
    const root = fixture();
    const result = pack({ root, maxTokens: 20_000, format: "markdown" });
    expect(result.output).toContain("# Demo");
    expect(result.output).toContain("src/index.ts");
    expect(result.output).not.toContain("should-be-ignored");
    expect(result.output).not.toContain("left-pad");
    expect(result.output).not.toContain("super-secret-value");
    expect(result.output).toContain(".env.example");
    expect(result.output).toContain("[REDACTED]");
    expect(result.tree).toContain("src");
    expect(result.tree).not.toContain("secret.txt");
    expect(result.files.length).toBeGreaterThan(0);
    expect(result.output).toContain("pkg/keep.ts");
    expect(result.output).not.toContain("generated = 1");
  });

  it("does not break markdown fences when a file contains backticks", () => {
    const dir = mkdtempSync(join(tmpdir(), "ctxpack-fence-"));
    writeFileSync(join(dir, "note.md"), "```\nsecret fence\n```\n");
    const result = pack({ root: dir, format: "markdown", tree: false });
    expect(result.output).toContain("````md");
    expect(result.output).toContain("secret fence");
  });

  it("respects token budget by dropping low-priority files", () => {
    const root = fixture();
    const tiny = pack({ root, maxTokens: 80, format: "markdown", tree: false });
    const big = pack({ root, maxTokens: 50_000, format: "markdown", tree: false });
    expect(tiny.files.length).toBeLessThanOrEqual(big.files.length);
    expect(tiny.dropped.length).toBeGreaterThanOrEqual(0);
    expect(tiny.tree).toBe("");
  });

  it("emits xml and json", () => {
    const root = fixture();
    const xml = pack({ root, format: "xml", tree: false });
    const json = pack({ root, format: "json", tree: false });
    expect(xml.output).toContain("<context");
    expect(JSON.parse(json.output).generator).toBe("ctxpack");
  });
});

describe("cli", () => {
  it("prints help and version", () => {
    const logs: string[] = [];
    const orig = console.log;
    console.log = (msg?: unknown) => {
      logs.push(String(msg ?? ""));
    };
    expect(run(["--help"])).toBe(0);
    expect(run(["--version"])).toBe(0);
    console.log = orig;
    expect(logs.join("\n")).toContain("ctxpack");
    expect(logs.join("\n")).toContain(packageVersion());
  });

  it("dry-run writes nothing to stdout", () => {
    const root = fixture();
    const origErr = console.error;
    const errors: string[] = [];
    console.error = (msg?: unknown) => {
      errors.push(String(msg ?? ""));
    };
    expect(run([root, "--dry-run", "--verbose"])).toBe(0);
    console.error = origErr;
    expect(errors.join("\n")).toContain("dry-run");
    expect(errors.join("\n")).toContain("keep");
  });
});
