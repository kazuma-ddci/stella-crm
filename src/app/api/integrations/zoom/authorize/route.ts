import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { requireStaff } from "@/lib/auth/staff-action";
import { buildAuthorizeUrl } from "@/lib/zoom/oauth";

const OAUTH_STATE_COOKIE = "zoom_oauth_state";
const OAUTH_STATE_MAX_AGE_SEC = 600;

/**
 * GET /api/integrations/zoom/authorize
 * ログイン中のスタッフを Zoom の認可画面へリダイレクトする。
 * stateは (staffId).{timestamp}.{nonce} の形式で Cookie に保存。
 */
export async function GET(req: NextRequest) {
  const user = await requireStaff();
  const nonce = crypto.randomBytes(24).toString("hex");
  const state = `${user.id}.${Date.now()}.${nonce}`;

  let authorizeUrl: string;
  try {
    authorizeUrl = buildAuthorizeUrl(state);
  } catch (e) {
    // Zoom関連環境変数が未設定の場合は連携ページに戻して案内表示
    // Docker + reverse proxy 環境では req.nextUrl.origin が内部ホスト名を返すため、
    // NEXT_PUBLIC_APP_URL を優先（無ければ origin にフォールバック）
    const publicBase =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || req.nextUrl.origin;
    const errUrl = new URL("/staff/me/integrations", publicBase);
    errUrl.searchParams.set("zoomResult", "error");
    errUrl.searchParams.set(
      "reason",
      e instanceof Error
        ? `Zoom設定が未完了です: ${e.message}`
        : "Zoom設定が未完了です（管理者にお問い合わせください）"
    );
    return NextResponse.redirect(errUrl.toString());
  }

  const res = NextResponse.redirect(authorizeUrl);
  res.cookies.set({
    name: OAUTH_STATE_COOKIE,
    value: state,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: OAUTH_STATE_MAX_AGE_SEC,
  });
  return res;
}
