import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  estimateTextTokens,
  packContext,
  packContextStats,
  scanSecrets,
} from "../src/mcp-tools.js";
import { createMcpServer } from "../src/mcp.js";

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "ctxpack-mcp-"));
  writeFileSync(join(root, "README.md"), "# fixture\n\nA small test project.\n");
  mkdirSync(join(root, "src"));
  writeFileSync(
    join(root, "src", "config.ts"),
    'export const AWS_KEY = "AKIAIOSFODNN7EXAMPLE";\nexport const value = 42;\n',
  );
  return root;
}

describe("mcp tools", () => {
  it("packs a repository and redacts secrets", () => {
    const root = fixture();
    const output = packContext({ root, maxTokens: 2_000 });
    const stats = packContextStats(output);

    expect(output.root).toBe(root);
    expect(stats.root).toBe(root);
    expect(stats.files).toBeGreaterThanOrEqual(2);
    expect(stats.format).toBe("markdown");
    expect(stats.secrets).toBeGreaterThan(0);
    expect(stats.redacted).toBeGreaterThan(0);
    expect(output.result.output).not.toContain("AKIAIOSFODNN7EXAMPLE");
    expect(output.result.output).toContain("[REDACTED]");
  });

  it("scans a repository and returns only redacted snippets", () => {
    const root = fixture();
    const result = scanSecrets({ root });

    expect(result.root).toBe(root);
    expect(result.scannedFiles).toBeGreaterThanOrEqual(2);
    expect(result.count).toBeGreaterThan(0);
    expect(result.hits.some((hit) => hit.path === "src/config.ts")).toBe(true);
    expect(result.hits.every((hit) => !hit.snippet.includes("AKIAIOSFODNN7EXAMPLE"))).toBe(true);
  });

  it("scans a text string without touching the filesystem", () => {
    const result = scanSecrets({ text: 'token = "sk-proj-abcdefghijklmnopqrstuvwxyz";' });
    expect(result.root).toBeNull();
    expect(result.scannedFiles).toBe(1);
    expect(result.hits[0]?.path).toBe("<text>");
    expect(result.hits[0]?.kind).toBe("openai-key");
  });

  it("estimates text tokens", () => {
    expect(estimateTextTokens("hello world")).toBeGreaterThan(0);
    expect(estimateTextTokens("")).toBe(0);
  });

  it("creates an MCP server with tools registered", () => {
    const server = createMcpServer();
    expect(typeof server.connect).toBe("function");
    expect(typeof server.close).toBe("function");
  });
});
