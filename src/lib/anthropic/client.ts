// Anthropic Claude API クライアント。プロンプトキャッシュ対応。
// SDKを使わず fetch で直接 API を叩く（追加依存を避ける）。
// モデル:
//   - claude-sonnet-4-6      （議事録要約）
//   - claude-haiku-4-5-20251001 （お礼メッセージ生成・参加者抽出）

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export class AnthropicApiError extends Error {
  readonly status: number;
  readonly body: string;
  constructor(status: number, body: string) {
    super(`Anthropic API error ${status}: ${body.slice(0, 500)}`);
    this.status = status;
    this.body = body;
  }
}

function getApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY 環境変数が未設定です");
  }
  return key;
}

type ContentBlock =
  | { type: "text"; text: string; cache_control?: { type: "ephemeral" } };

export type ClaudeMessageResponse = {
  id: string;
  model: string;
  content: Array<{ type: string; text?: string }>;
  stop_reason: string | null;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
};

/**
 * Claudeに問い合わせて応答テキストを返す。
 * system プロンプトは長くて安定している部分（= テンプレ）を cache_control で ephemeral キャッシュ対象にする。
 */
export async function callClaude(params: {
  model: string;
  systemPrompt: string; // キャッシュ対象
  userMessage: string; // キャッシュ非対象
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}): Promise<{ text: string; raw: ClaudeMessageResponse }> {
  const system: ContentBlock[] = [
    {
      type: "text",
      text: params.systemPrompt,
      cache_control: { type: "ephemeral" },
    },
  ];
  const body = {
    model: params.model,
    max_tokens: params.maxTokens ?? 4096,
    temperature: params.temperature ?? 0.3,
    system,
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: params.userMessage }],
      },
    ],
  };
  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": getApiKey(),
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(params.timeoutMs ?? 120_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new AnthropicApiError(res.status, text);
  }
  const json = (await res.json()) as ClaudeMessageResponse;
  const text = (json.content ?? [])
    .filter((c) => c.type === "text" && typeof c.text === "string")
    .map((c) => c.text as string)
    .join("\n")
    .trim();
  return { text, raw: json };
}
