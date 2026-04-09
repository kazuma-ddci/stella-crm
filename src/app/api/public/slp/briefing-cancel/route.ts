import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAutomationError } from "@/lib/automation-error";
import { submitForm9BriefingCancel } from "@/lib/proline-form";

function verifySecret(request: Request): boolean {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  const webhookSecret = process.env.LINE_FRIEND_WEBHOOK_SECRET;
  return !!(webhookSecret && secret === webhookSecret);
}

/**
 * プロラインフリーから概要案内予約キャンセル時に呼ばれるWebhook
 *
 * クエリパラメータ:
 *   uid: ユーザーID ([[uid]]) のみ
 *   secret: 認証用シークレット
 *
 * 動作:
 *   prolineUidが一致する直近のキャンセルされていない企業名簿レコードを
 *   ステータス=キャンセル、briefingCanceledAt=現在時刻 に更新する
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
        briefingCanceledAt: null,
        deletedAt: null,
      },
      orderBy: { id: "desc" },
      select: { id: true },
    });

    if (!target) {
      return NextResponse.json(
        { success: false, error: "対象の予約レコードが見つかりません" },
        { status: 404 }
      );
    }

    const updated = await prisma.slpCompanyRecord.update({
      where: { id: target.id },
      data: {
        briefingStatus: "キャンセル",
        briefingCanceledAt: new Date(),
      },
    });

    // 紹介者通知（form9）— 紹介者がいれば fire-and-forget で送信
    const lineFriend = await prisma.slpLineFriend.findUnique({
      where: { uid },
      select: { snsname: true, free1: true },
    });
    const referrerUid = lineFriend?.free1?.trim();
    const snsname = lineFriend?.snsname;
    if (referrerUid && snsname) {
      submitForm9BriefingCancel(referrerUid, snsname).catch(async (err) => {
        await logAutomationError({
          source: "slp-briefing-cancel-form9",
          message: `概要案内キャンセル通知（form9）送信失敗: referrerUid=${referrerUid}, snsname=${snsname}`,
          detail: {
            error: err instanceof Error ? err.message : String(err),
            referrerUid,
            snsname,
            retryAction: "form9-briefing-cancel",
          },
        });
      });
    }

    return NextResponse.json({
      success: true,
      companyRecordId: updated.id,
    });
  } catch (error) {
    await logAutomationError({
      source: "slp-briefing-cancel",
      message: `概要案内キャンセルWebhook処理失敗: uid=${uid}`,
      detail: { error: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
