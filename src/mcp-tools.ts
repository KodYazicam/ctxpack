import { resolve } from "node:path";
import { findSecrets, type SecretHit } from "./secrets.js";
import { pack, type OutputFormat, type PackResult } from "./pack.js";
import { estimateTokens } from "./tokens.js";
import { walkFiles } from "./walk.js";

export interface PackContextInput {
  root?: string;
  maxTokens?: number;
  format?: OutputFormat;
  redact?: boolean;
  tree?: boolean;
  include?: string[];
  ignore?: string[];
  maxFileBytes?: number;
}

export interface PackContextOutput {
  root: string;
  format: OutputFormat;
  result: PackResult;
}

export interface PackContextStats {
  root: string;
  files: number;
  dropped: number;
  tokens: number;
  redacted: number;
  secrets: number;
  format: OutputFormat;
}

export interface ScanSecretsInput {
  text?: string;
  root?: string;
  include?: string[];
  ignore?: string[];
  maxFileBytes?: number;
  limit?: number;
}

export interface ScannedSecret extends SecretHit {
  path: string;
}

export interface ScanSecretsOutput {
  root: string | null;
  scannedFiles: number;
  count: number;
  truncated: boolean;
  hits: ScannedSecret[];
}

const DEFAULT_MAX_TOKENS = 80_000;
const DEFAULT_MAX_SECRETS = 500;

export function packContext(input: PackContextInput = {}): PackContextOutput {
  const root = resolve(input.root ?? process.cwd());
  const format = input.format ?? "markdown";
  const result = pack({
    root,
    maxTokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
    format,
    redact: input.redact ?? true,
    tree: input.tree ?? true,
    extraIgnore: input.ignore?.filter(Boolean),
    include: input.include?.filter(Boolean),
    maxFileBytes: input.maxFileBytes,
  });
  return { root, format, result };
}

export function packContextStats(output: PackContextOutput): PackContextStats {
  return {
    root: output.root,
    files: output.result.files.length,
    dropped: output.result.dropped.length,
    tokens: output.result.tokens,
    redacted: output.result.redactedCount,
    secrets: output.result.secrets.length,
    format: output.format,
  };
}

export function scanSecrets(input: ScanSecretsInput = {}): ScanSecretsOutput {
  const limit = Math.max(1, Math.min(input.limit ?? DEFAULT_MAX_SECRETS, 5_000));
  if (input.text !== undefined) {
    const hits = findSecrets(input.text).map((hit) => ({ ...hit, path: "<text>" }));
    return {
      root: null,
      scannedFiles: 1,
      count: hits.length,
      truncated: hits.length > limit,
      hits: hits.slice(0, limit),
    };
  }

  const root = resolve(input.root ?? process.cwd());
  const entries = walkFiles({
    root,
    extraIgnore: input.ignore?.filter(Boolean),
    include: input.include?.filter(Boolean),
    maxFileBytes: input.maxFileBytes,
  });
  const hits: ScannedSecret[] = [];
  for (const entry of entries) {
    for (const hit of findSecrets(entry.content)) {
      hits.push({ ...hit, path: entry.path });
    }
  }
  return {
    root,
    scannedFiles: entries.length,
    count: hits.length,
    truncated: hits.length > limit,
    hits: hits.slice(0, limit),
  };
}

export function estimateTextTokens(text: string): number {
  return estimateTokens(text);
}
