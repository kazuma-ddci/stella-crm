import crypto from "crypto";
import { getZoomWebhookSecret } from "./constants";

/**
 * Zoom Webhookの署名検証。
 * Zoom は `x-zm-signature` ヘッダに `v0=<hex>` を、`x-zm-request-timestamp` にタイムスタンプを入れる。
 * `v0:<timestamp>:<rawBody>` を Secret Token でHMAC-SHA256したhexと比較する。
 */
export function verifyZoomWebhookSignature(params: {
  rawBody: string;
  timestamp: string | null;
  signature: string | null;
}): boolean {
  if (!params.timestamp || !params.signature) return false;
  const message = `v0:${params.timestamp}:${params.rawBody}`;
  const hmac = crypto
    .createHmac("sha256", getZoomWebhookSecret())
    .update(message)
    .digest("hex");
  const expected = `v0=${hmac}`;
  // 長さ違いでtimingSafeEqualが投げないよう先にチェック
  if (expected.length !== params.signature.length) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(params.signature)
    );
  } catch {
    return false;
  }
}

/**
 * Zoom Webhookの Endpoint URL validation challenge への応答を作る。
 * `endpoint.url_validation` イベントでは plainToken が来るので、Secret Token でHMAC-SHA256してencryptedTokenを返す。
 */
export function generateUrlValidationResponse(plainToken: string): {
  plainToken: string;
  encryptedToken: string;
} {
  const encryptedToken = crypto
    .createHmac("sha256", getZoomWebhookSecret())
    .update(plainToken)
    .digest("hex");
  return { plainToken, encryptedToken };
}
