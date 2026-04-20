// Anthropic モデル別料金（USD per 1M tokens）。
// 未知モデルは Sonnet を fallback として warning ログを残す。

type Pricing = {
  input: number;
  output: number;
  cacheRead: number;
  cacheCreation: number;
};

const PRICING_BY_MODEL: Record<string, Pricing> = {
  "claude-opus-4-7": { input: 15, output: 75, cacheRead: 1.5, cacheCreation: 18.75 },
  "claude-sonnet-4-6": { input: 3, output: 15, cacheRead: 0.3, cacheCreation: 3.75 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5, cacheRead: 0.1, cacheCreation: 1.25 },
};

const FALLBACK_MODEL = "claude-sonnet-4-6";

export function computeCostUsd(
  model: string,
  usage: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  },
): number {
  const p = PRICING_BY_MODEL[model];
  if (!p) {
    console.warn(`[anthropic-pricing] 未知モデル "${model}"。${FALLBACK_MODEL} の料金で計算します。`);
  }
  const price = p ?? PRICING_BY_MODEL[FALLBACK_MODEL];
  return (
    ((usage.input_tokens ?? 0) * price.input) / 1_000_000 +
    ((usage.output_tokens ?? 0) * price.output) / 1_000_000 +
    ((usage.cache_read_input_tokens ?? 0) * price.cacheRead) / 1_000_000 +
    ((usage.cache_creation_input_tokens ?? 0) * price.cacheCreation) / 1_000_000
  );
}
