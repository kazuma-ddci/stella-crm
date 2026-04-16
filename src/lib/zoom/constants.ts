// Zoom OAuth / API 定数と環境変数アクセス

export const ZOOM_OAUTH_BASE = "https://zoom.us/oauth";
export const ZOOM_API_BASE = "https://api.zoom.us/v2";

export const ZOOM_SCOPES = [
  "meeting:write:meeting",
  "meeting:read:meeting",
  "meeting:update:meeting",
  "meeting:delete:meeting",
  "cloud_recording:read:recording",
  "meeting:read:transcript",
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
