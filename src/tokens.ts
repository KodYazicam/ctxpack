/**
 * Approximate OpenAI cl100k_base token counts without a native binding.
 * Good enough for packing budgets; within ~10% of tiktoken on typical source.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const words = text.match(/[\p{L}\p{N}]+/gu)?.length ?? 0;
  const punctuation = text.match(/[^\p{L}\p{N}\s]/gu)?.length ?? 0;
  const whitespaceRuns = text.match(/\s+/g)?.length ?? 0;
  const cjk = text.match(/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/g)?.length ?? 0;
  const base = words * 1.15 + punctuation * 0.4 + whitespaceRuns * 0.15 + cjk * 0.7;
  const charFallback = text.length / 3.8;
  return Math.max(1, Math.round(base * 0.65 + charFallback * 0.35));
}

export function estimateTokensOfFiles(files: { content: string }[]): number {
  return files.reduce((sum, file) => sum + estimateTokens(file.content), 0);
}
