/**
 * Approximate OpenAI cl100k_base token counts without a native binding.
 * If the optional `tiktoken` package is installed, that encoder is used.
 */
import { createRequire } from "node:module";

let encoder: { encode: (text: string) => { length: number } } | null | undefined;

function tiktokenEncoder(): { encode: (text: string) => { length: number } } | null {
  if (encoder !== undefined) return encoder;
  try {
    const req = createRequire(import.meta.url);
    const tiktoken = req("tiktoken") as {
      encoding_for_model?: (model: string) => { encode: (text: string) => { length: number } };
      get_encoding?: (name: string) => { encode: (text: string) => { length: number } };
    };
    encoder = tiktoken.encoding_for_model?.("gpt-4o") ?? tiktoken.get_encoding?.("cl100k_base") ?? null;
  } catch {
    encoder = null;
  }
  return encoder;
}

export function heuristicTokens(text: string): number {
  if (!text) return 0;
  const words = text.match(/[\p{L}\p{N}]+/gu)?.length ?? 0;
  const punctuation = text.match(/[^\p{L}\p{N}\s]/gu)?.length ?? 0;
  const whitespaceRuns = text.match(/\s+/g)?.length ?? 0;
  const cjk = text.match(/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/g)?.length ?? 0;
  const base = words * 1.15 + punctuation * 0.4 + whitespaceRuns * 0.15 + cjk * 0.7;
  const charFallback = text.length / 3.8;
  return Math.max(1, Math.round(base * 0.65 + charFallback * 0.35));
}

export function estimateTokens(text: string): number {
  if (!text) return 0;
  const enc = tiktokenEncoder();
  if (enc) {
    try {
      return enc.encode(text).length;
    } catch {
      return heuristicTokens(text);
    }
  }
  return heuristicTokens(text);
}

export function estimateTokensOfFiles(files: { content: string }[]): number {
  return files.reduce((sum, file) => sum + estimateTokens(file.content), 0);
}
