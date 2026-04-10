/**
 * SLP 資料閲覧ページ (/form/slp-document, /form/slp-video) の
 * 一時アクセストークン発行・検証ユーティリティ
 *
 * 仕組み:
 *   1. ユーザーが `?uid=xxx&snsname=yyy` 付き URL でアクセス
 *   2. サーバーが uid/snsname を検証 → HMAC-SHA256 署名付きトークンを生成
 *   3. HttpOnly Cookie に保存（1時間有効）
 *   4. URL からパラメータを削除（ユーザーに見えないように）
 *   5. リロード時は Cookie からトークンを検証して同じユーザーとして閲覧継続
 *   6. 1時間経過で Cookie 失効 → リッチメニューから再アクセスすれば再発行
 *
 * セキュリティ:
 *   - HMAC-SHA256 署名: ユーザーがトークンを偽造できない
 *   - HttpOnly: JavaScript から Cookie を読めない（XSS 対策）
 *   - Secure + SameSite=Lax: HTTPS 通信でのみ送信
 *   - 有効期限 1時間: Cookie が漏洩しても被害を限定
 *   - 署名キー: 既存の LINE_FRIEND_WEBHOOK_SECRET を流用
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type { ResponseCookies } from "next/dist/compiled/@edge-runtime/cookies";
import type { RequestCookies } from "next/dist/server/web/spec-extension/cookies";

/** Cookie 名（PDF と動画で分ける） */
export const SLP_DOCUMENT_COOKIE_NAME = "slp-doc-access";
export const SLP_VIDEO_COOKIE_NAME = "slp-video-access";

/** 有効期限: 1時間 */
const VALIDITY_MS = 60 * 60 * 1000;

type TokenPayload = {
  uid: string;
  snsname: string;
  /** UNIX timestamp ミリ秒、このとき以降は無効 */
  exp: number;
};

function getSecret(): string {
  const secret = process.env.LINE_FRIEND_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(
      "LINE_FRIEND_WEBHOOK_SECRET 環境変数が設定されていません",
    );
  }
  return secret;
}

/** 文字列を HMAC-SHA256 で署名して base64url 文字列を返す */
function sign(data: string): string {
  return createHmac("sha256", getSecret()).update(data).digest("base64url");
}

/**
 * uid + snsname + 有効期限からトークンを生成
 * フォーマット: `<base64url(JSON payload)>.<base64url(HMAC signature)>`
 */
export function generateAccessToken(uid: string, snsname: string): string {
  const payload: TokenPayload = {
    uid,
    snsname,
    exp: Date.now() + VALIDITY_MS,
  };
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(payloadStr);
  return `${payloadStr}.${signature}`;
}

/**
 * トークンを検証し、有効ならペイロードを返す
 * 無効（署名不一致 or 期限切れ）なら null
 */
export function verifyAccessToken(token: string | null | undefined): TokenPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadStr, signature] = parts;

  // 署名検証（timing-safe で比較）
  const expected = sign(payloadStr);
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return null;
  try {
    if (!timingSafeEqual(sigBuf, expBuf)) return null;
  } catch {
    return null;
  }

  // ペイロードのデコード・妥当性検証
  try {
    const decoded = JSON.parse(
      Buffer.from(payloadStr, "base64url").toString("utf-8"),
    );
    if (
      typeof decoded !== "object" ||
      decoded === null ||
      typeof decoded.uid !== "string" ||
      typeof decoded.snsname !== "string" ||
      typeof decoded.exp !== "number"
    ) {
      return null;
    }
    if (decoded.exp < Date.now()) return null; // 期限切れ
    return decoded as TokenPayload;
  } catch {
    return null;
  }
}

/** Cookie にトークンをセットする共通オプション */
export function buildCookieOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: VALIDITY_MS / 1000, // 秒単位
  };
}

/**
 * NextResponse の cookies にアクセストークンをセットする
 * （API Route から使う）
 */
export function setAccessCookie(
  cookies: ResponseCookies,
  name: string,
  uid: string,
  snsname: string,
): void {
  const token = generateAccessToken(uid, snsname);
  cookies.set(name, token, buildCookieOptions());
}

/**
 * Set-Cookie ヘッダー文字列を生成する
 * 標準 Web API の Response で使う際、cookies API が使えないため
 * 手動で Set-Cookie ヘッダー文字列を組み立てる
 */
export function buildSetCookieHeader(
  name: string,
  uid: string,
  snsname: string,
): string {
  const token = generateAccessToken(uid, snsname);
  const maxAge = VALIDITY_MS / 1000;
  return `${name}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

/**
 * リクエストの Cookie からトークンを検証する
 * （API Route から使う）
 */
export function verifyAccessCookie(
  cookies: RequestCookies,
  name: string,
): TokenPayload | null {
  const cookie = cookies.get(name);
  return verifyAccessToken(cookie?.value);
}
