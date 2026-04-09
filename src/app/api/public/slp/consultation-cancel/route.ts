import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAutomationError } from "@/lib/automation-error";

function verifySecret(request: Request): boolean {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  const webhookSecret = process.env.LINE_FRIEND_WEBHOOK_SECRET;
  return !!(webhookSecret && secret === webhookSecret);
}

/**
 * プロラインフリーから導入希望商談予約キャンセル時に呼ばれるWebhook
 *
 * クエリパラメータ:
 *   uid: ユーザーID ([[uid]]) のみ
 *   secret: 認証用シークレット
 *
 * 動作:
 *   prolineUidが一致する直近のキャンセルされていない企業名簿レコードの
 *   導入希望商談ステータスを「キャンセル」に更新する。
 *
 * 紹介者通知は送らない。
 */
export async function GET(request: Request) {
  if (!verifySecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const uid = searchParams.get("uid");

  if (!uid) {
    return NextResponse.json({ error: "uid is required" }, { status: 400 });
  }

  try {
    const target = await prisma.slpCompanyRecord.findFirst({
      where: {
        prolineUid: uid,
        consultationCanceledAt: null,
        deletedAt: null,
      },
      orderBy: { id: "desc" },
      select: { id: true },
    });

    if (!target) {
      return NextResponse.json(
        { success: false, error: "対象の導入希望商談予約レコードが見つかりません" },
        { status: 404 }
      );
    }

    const updated = await prisma.slpCompanyRecord.update({
      where: { id: target.id },
      data: {
        consultationStatus: "キャンセル",
        consultationCanceledAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      companyRecordId: updated.id,
    });
  } catch (error) {
    await logAutomationError({
      source: "slp-consultation-cancel",
      message: `導入希望商談キャンセルWebhook処理失敗: uid=${uid}`,
      detail: { error: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
