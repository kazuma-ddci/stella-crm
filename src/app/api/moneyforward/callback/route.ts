import { NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "@/lib/moneyforward/client";
import { prisma } from "@/lib/prisma";

const SETTINGS_URL = "/accounting/settings/moneyforward";

/**
 * リダイレクト先の公開URLを返す。
 * Docker + reverse proxy 環境では request.url が内部ホスト名
 * （例: http://da7bfde075c0:3000）を返してしまうため、必ず NEXT_PUBLIC_APP_URL を優先する。
 */
function getPublicBaseUrl(request: NextRequest): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    new URL(request.url).origin
  );
}

export async function GET(request: NextRequest) {
  const publicBase = getPublicBaseUrl(request);
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const stateRaw = searchParams.get("state");

    if (!code || !stateRaw) {
      return NextResponse.redirect(
        new URL(`${SETTINGS_URL}?error=認可コードまたはstateが不足しています`, publicBase)
      );
    }

    // state をパース
    let state: { operatingCompanyId: number };
    try {
      state = JSON.parse(stateRaw);
    } catch {
      return NextResponse.redirect(
        new URL(`${SETTINGS_URL}?error=不正なstateパラメータです`, publicBase)
      );
    }

    if (!state.operatingCompanyId) {
      return NextResponse.redirect(
        new URL(`${SETTINGS_URL}?error=法人IDが指定されていません`, publicBase)
      );
    }

    // トークン交換
    const tokens = await exchangeCode(code);
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // 既存の接続があればアップデート、なければ作成
    // operatingCompanyId + isActive=true でupsert相当
    const existing = await prisma.moneyForwardConnection.findFirst({
      where: {
        operatingCompanyId: state.operatingCompanyId,
        isActive: true,
      },
    });

    if (existing) {
      await prisma.moneyForwardConnection.update({
        where: { id: existing.id },
        data: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiresAt,
        },
      });
    } else {
      await prisma.moneyForwardConnection.create({
        data: {
          operatingCompanyId: state.operatingCompanyId,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiresAt,
          isActive: true,
          createdBy: 0, // OAuth callbackではセッションが取れないため仮値
        },
      });
    }

    return NextResponse.redirect(
      new URL(`${SETTINGS_URL}?connected=true`, publicBase)
    );
  } catch (error) {
    console.error("MoneyForward OAuth callback error:", error);
    const message =
      error instanceof Error ? error.message : "不明なエラーが発生しました";
    return NextResponse.redirect(
      new URL(
        `${SETTINGS_URL}?error=${encodeURIComponent(message)}`,
        publicBase
      )
    );
  }
}
