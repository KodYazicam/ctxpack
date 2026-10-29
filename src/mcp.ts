import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { z } from "zod";
import { packageVersion } from "./version.js";
import {
  estimateTextTokens,
  packContext,
  packContextStats,
  scanSecrets,
} from "./mcp-tools.js";

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const rootSchema = z
  .string()
  .optional()
  .describe("Repository directory. Defaults to the server process's current working directory.");

const maxFileBytesSchema = z
  .number()
  .int()
  .positive()
  .max(5_000_000)
  .optional()
  .describe("Skip files larger than this many bytes. Default: 200000.");

function errorResult(error: unknown): CallToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return {
    isError: true,
    content: [{ type: "text", text: `ctxpack: ${message}` }],
  };
}

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "ctxpack",
    version: packageVersion(),
  });

  server.registerTool(
    "pack_context",
    {
      title: "Pack repository context",
      description:
        "Pack a local codebase into a single token-budgeted, secret-redacted context document for an LLM. " +
        "Use this when you need to hand a repository or a subset of it to another model without exceeding its context window. " +
        "Runs locally; no network access and no API key. The returned text is the rendered pack; structuredContent contains stats.",
      inputSchema: z.object({
        root: rootSchema,
        maxTokens: z
          .number()
          .int()
          .positive()
          .max(500_000)
          .optional()
          .describe("Token budget for the rendered output. Default: 80000."),
        format: z
          .enum(["markdown", "xml", "json"])
          .optional()
          .describe("Output format. Default: markdown."),
        redact: z
          .boolean()
          .optional()
          .describe("Redact secret-like strings. Default: true. Do not disable unless explicitly requested."),
        tree: z.boolean().optional().describe("Include a repository tree. Default: true."),
        include: z
          .array(z.string())
          .optional()
          .describe("Only include paths matching these globs (repeatable semantics)."),
        ignore: z
          .array(z.string())
          .optional()
          .describe("Extra gitignore-style globs to exclude."),
        maxFileBytes: maxFileBytesSchema,
      }),
      outputSchema: z.object({
        root: z.string(),
        files: z.number().int(),
        dropped: z.number().int(),
        tokens: z.number().int(),
        redacted: z.number().int(),
        secrets: z.number().int(),
        format: z.enum(["markdown", "xml", "json"]),
      }),
      annotations: READ_ONLY,
    },
    async (input) => {
      try {
        const output = packContext(input);
        return {
          content: [{ type: "text", text: output.result.output }],
          structuredContent: packContextStats(output),
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "estimate_tokens",
    {
      title: "Estimate tokens",
      description:
        "Estimate how many tokens a piece of text will consume. Uses tiktoken when installed, otherwise a deterministic heuristic. " +
        "Useful before packing a large context or deciding whether to truncate.",
      inputSchema: z.object({
        text: z.string().min(1).describe("Text to measure."),
      }),
      outputSchema: z.object({
        tokens: z.number().int(),
      }),
      annotations: READ_ONLY,
    },
    async ({ text }) => {
      try {
        const tokens = estimateTextTokens(text);
        return {
          content: [{ type: "text", text: String(tokens) }],
          structuredContent: { tokens },
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "scan_secrets",
    {
      title: "Scan for secrets",
      description:
        "Scan a local repository tree or a text string for secret-like values (API keys, tokens, private keys, passwords). " +
        "Returns locations and redacted snippets; it never returns the full secret. Runs locally; no network access.",
      inputSchema: z.object({
        text: z
          .string()
          .optional()
          .describe("Scan this text instead of a directory. Cannot be combined with root."),
        root: rootSchema,
        include: z
          .array(z.string())
          .optional()
          .describe("Only scan paths matching these globs."),
        ignore: z
          .array(z.string())
          .optional()
          .describe("Extra gitignore-style globs to exclude."),
        maxFileBytes: maxFileBytesSchema,
        limit: z
          .number()
          .int()
          .positive()
          .max(5_000)
          .optional()
          .describe("Maximum hits to return. Default: 500."),
      }),
      outputSchema: z.object({
        root: z.string().nullable(),
        scannedFiles: z.number().int(),
        count: z.number().int(),
        truncated: z.boolean(),
        hits: z.array(
          z.object({
            path: z.string(),
            line: z.number().int(),
            kind: z.string(),
            snippet: z.string(),
          }),
        ),
      }),
      annotations: READ_ONLY,
    },
    async (input) => {
      try {
        if (input.text !== undefined && input.root !== undefined) {
          return errorResult("scan_secrets accepts either text or root, not both");
        }
        const output = scanSecrets(input);
        return {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
          structuredContent: output,
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  return server;
}

/**
 * Start the stdio MCP server. stdout is reserved for protocol messages;
 * diagnostics go to stderr.
 */
export function runMcpServer(): void {
  serveStdio(createMcpServer, {
    onerror: (error) => {
      console.error(`ctxpack mcp: ${error.message}`);
    },
  });
}
