// Zoom OAuth / API 定数と環境変数アクセス

export const ZOOM_OAUTH_BASE = "https://zoom.us/oauth";
export const ZOOM_API_BASE = "https://api.zoom.us/v2";

// Zoom granular OAuth scopes（2024年以降の新形式）
// transcript (.vtt) ファイルは cloud_recording:read:recording に含まれるため transcript 専用scopeは不要。
// 削除は「ファイル単位」のscopeを使用（ミーティング単位一括より安全）。
export const ZOOM_SCOPES = [
  "meeting:write:meeting",
  "meeting:read:meeting",
  "meeting:update:meeting",
  "meeting:delete:meeting",
  "cloud_recording:read:recording",
  "cloud_recording:delete:recording_file",
  "meeting:read:summary",
  "meeting:read:list_past_participants",
  "user:read:user",
].join(" ");

export function getZoomClientId(): string {
  const v = process.env.ZOOM_CLIENT_ID;
  if (!v) throw new Error("ZOOM_CLIENT_ID 未設定");
  return v;
}

export function getZoomClientSecret(): string {
  const v = process.env.ZOOM_CLIENT_SECRET;
  if (!v) throw new Error("ZOOM_CLIENT_SECRET 未設定");
  return v;
}

export function getZoomWebhookSecret(): string {
  const v = process.env.ZOOM_WEBHOOK_SECRET;
  if (!v) throw new Error("ZOOM_WEBHOOK_SECRET 未設定");
  return v;
}

export function getZoomRedirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/integrations/zoom/callback`;
}

// access_token の期限切れ判定マージン（秒）。残り60秒以下ならリフレッシュ。
export const ACCESS_TOKEN_REFRESH_MARGIN_SEC = 60;
