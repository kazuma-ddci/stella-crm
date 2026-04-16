import crypto from "crypto";

// AES-256-GCM による対称暗号化。OAuth refresh_token 等の機密トークン保存用。
// ENCRYPTION_KEY は32バイト（256bit）のbase64エンコード文字列を想定。
// `openssl rand -base64 32` で生成可能。

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCMの推奨IV長
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const rawKey = process.env.ENCRYPTION_KEY;
  if (!rawKey) {
    throw new Error(
      "ENCRYPTION_KEY 環境変数が未設定です。`openssl rand -base64 32` で生成して .env に設定してください。"
    );
  }
  const key = Buffer.from(rawKey, "base64");
  if (key.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY は base64 decode後32バイトである必要があります。現在: ${key.length}バイト`
    );
  }
  return key;
}

/**
 * 文字列を AES-256-GCM で暗号化する。
 * 出力形式: base64(IV) + ":" + base64(authTag) + ":" + base64(ciphertext)
 */
export function encryptString(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

/**
 * encryptString の出力文字列を復号する。形式が不正な場合や鍵が違う場合は例外を投げる。
 */
export function decryptString(payload: string): string {
  const key = getKey();
  const parts = payload.split(":");
  if (parts.length !== 3) {
    throw new Error("暗号文フォーマットが不正です（:で3分割できません）");
  }
  const [ivB64, authTagB64, ciphertextB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");
  if (iv.length !== IV_LENGTH) {
    throw new Error(`IV長が不正です: expected ${IV_LENGTH}, got ${iv.length}`);
  }
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(
      `AuthTag長が不正です: expected ${AUTH_TAG_LENGTH}, got ${authTag.length}`
    );
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

/**
 * 起動時にキー設定の正当性を確認するためのヘルパー（テスト/健康確認用）。
 */
export function verifyEncryptionKeyConfigured(): void {
  getKey();
}
