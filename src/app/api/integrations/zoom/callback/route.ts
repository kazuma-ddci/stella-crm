import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff-action";
import { completeZoomConnectionForStaff } from "@/lib/zoom/oauth";
import { logAutomationError } from "@/lib/automation-error";

const OAUTH_STATE_COOKIE = "zoom_oauth_state";

/**
 * リダイレクト先の公開URLを返す。
 * Docker + reverse proxy 環境では req.nextUrl.origin が内部ホスト名
 * （例: http://da7bfde075c0:3000）を返してしまうため、
 * 必ず NEXT_PUBLIC_APP_URL を優先する。
 */
function getPublicBaseUrl(req: NextRequest): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || req.nextUrl.origin;
}

function redirectToIntegrations(
  baseUrl: string,
  params: Record<string, string>
): NextResponse {
  const url = new URL("/staff/me/integrations", baseUrl);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = NextResponse.redirect(url.toString());
  res.cookies.set({
    name: OAUTH_STATE_COOKIE,
    value: "",
    path: "/",
    maxAge: 0,
  });
  return res;
}

/**
 * GET /api/integrations/zoom/callback?code=...&state=...
 * Zoom認可画面からのコールバック。OAuthコード → トークン交換 → DB保存。
 */
export async function GET(req: NextRequest) {
  const baseUrl = getPublicBaseUrl(req);
  const user = await requireStaff();

  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  const expectedState = req.cookies.get(OAUTH_STATE_COOKIE)?.value;

  if (errorParam) {
    return redirectToIntegrations(baseUrl, {
      zoomResult: "error",
      reason: errorParam,
    });
  }
  if (!code || !state) {
    return redirectToIntegrations(baseUrl, {
      zoomResult: "error",
      reason: "missing_code_or_state",
    });
  }
  if (!expectedState || expectedState !== state) {
    return redirectToIntegrations(baseUrl, {
      zoomResult: "error",
      reason: "state_mismatch",
    });
  }

  const statePrefix = state.split(".")[0];
  if (String(user.id) !== statePrefix) {
    return redirectToIntegrations(baseUrl, {
      zoomResult: "error",
      reason: "staff_mismatch",
    });
  }

  try {
    await completeZoomConnectionForStaff({ staffId: user.id, code });
    return redirectToIntegrations(baseUrl, { zoomResult: "success" });
  } catch (e) {
    await logAutomationError({
      source: "zoom-oauth-callback",
      message: `Zoom OAuth callback失敗: ${e instanceof Error ? e.message : String(e)}`,
      detail: { staffId: user.id },
    });
    return redirectToIntegrations(baseUrl, {
      zoomResult: "error",
      reason: "token_exchange_failed",
    });
  }
}
