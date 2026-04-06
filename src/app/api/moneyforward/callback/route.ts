import { NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "@/lib/moneyforward/client";
import { prisma } from "@/lib/prisma";

const SETTINGS_URL = "/accounting/settings/moneyforward";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const stateRaw = searchParams.get("state");

    if (!code || !stateRaw) {
      return NextResponse.redirect(
        new URL(`${SETTINGS_URL}?error=認可コードまたはstateが不足しています`, request.url)
      );
    }

    // state をパース
    let state: { operatingCompanyId: number };
    try {
      state = JSON.parse(stateRaw);
    } catch {
      return NextResponse.redirect(
        new URL(`${SETTINGS_URL}?error=不正なstateパラメータです`, request.url)
      );
    }

    if (!state.operatingCompanyId) {
      return NextResponse.redirect(
        new URL(`${SETTINGS_URL}?error=法人IDが指定されていません`, request.url)
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
      new URL(`${SETTINGS_URL}?connected=true`, request.url)
    );
  } catch (error) {
    console.error("MoneyForward OAuth callback error:", error);
    const message =
      error instanceof Error ? error.message : "不明なエラーが発生しました";
    return NextResponse.redirect(
      new URL(
        `${SETTINGS_URL}?error=${encodeURIComponent(message)}`,
        request.url
      )
    );
  }
}
