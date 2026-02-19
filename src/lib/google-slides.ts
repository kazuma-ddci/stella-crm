/**
 * Google Slides/Drive API クライアント
 * サービスアカウント認証でスライドのコピー・編集・PDF出力を行う
 */

import { google } from "googleapis";
import fs from "fs";
import path from "path";

// 環境変数からキーパスを取得、なければデフォルト
const KEY_PATH = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH
  || path.join(process.cwd(), "credentials/google-service-account.json");

let cachedAuth: Awaited<ReturnType<typeof google.auth.GoogleAuth.prototype.getClient>> | null = null;

/**
 * 認証済みクライアントを取得（キャッシュあり）
 */
async function getAuthClient() {
  if (cachedAuth) return cachedAuth;

  const keyPath = path.isAbsolute(KEY_PATH) ? KEY_PATH : path.join(process.cwd(), KEY_PATH);

  if (!fs.existsSync(keyPath)) {
    throw new Error(`Google service account key not found: ${keyPath}`);
  }

  const keyFile = JSON.parse(fs.readFileSync(keyPath, "utf-8"));

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: keyFile.client_email,
      private_key: keyFile.private_key,
    },
    scopes: [
      "https://www.googleapis.com/auth/presentations",
      "https://www.googleapis.com/auth/drive",
    ],
  });

  cachedAuth = await auth.getClient();
  return cachedAuth;
}

/**
 * Google Slides API クライアントを取得
 */
export async function getSlidesClient() {
  const auth = await getAuthClient();
  return google.slides({ version: "v1", auth });
}

/**
 * Google Drive API クライアントを取得
 */
export async function getDriveClient() {
  const auth = await getAuthClient();
  return google.drive({ version: "v3", auth });
}
