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
 * プロラインフリーから概要案内予約キャンセル時に呼ばれるWebhook（中継URL方式対応版）
 *
 * クエリパラメータ:
 *   uid: ユーザーID ([[uid]])
 *   bookingId: 予約ID ([[cl1-booking-id]])
 *   secret: 認証用シークレット
 *
 * 動作:
 *   1. bookingId で reservationId が一致する全レコードを検索
 *   2. 見つかった全レコードを updateMany で一括キャンセル（複製対応）
 *   3. 見つからない場合は uid ベースのフォールバック
 */
export async function GET(request: Request) {
  if (!verifySecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const uid = searchParams.get("uid");
  const bookingId = searchParams.get("bookingId");

  if (!uid) {
    return NextResponse.json({ error: "uid is required" }, { status: 400 });
  }

  try {
    let canceledCount = 0;
    let action: "canceled_by_id" | "canceled_by_uid" = "canceled_by_uid";

    // 1. bookingId で予約ID一致のレコードを優先的にキャンセル
    // メインの reservationId だけでなく、マージで取り込まれた配列も検索対象に
    if (bookingId) {
      const result = await prisma.slpCompanyRecord.updateMany({
        where: {
          OR: [
            { reservationId: bookingId },
            { mergedBriefingReservationIds: { has: bookingId } },
          ],
          deletedAt: null,
        },
        data: {
          briefingStatus: "キャンセル",
          briefingCanceledAt: new Date(),
        },
      });
      canceledCount = result.count;
      if (canceledCount > 0) {
        action = "canceled_by_id";
      }
    }

    // 2. フォールバック: uid + 直近のアクティブレコード
    if (canceledCount === 0) {
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

      await prisma.slpCompanyRecord.update({
        where: { id: target.id },
        data: {
          briefingStatus: "キャンセル",
          briefingCanceledAt: new Date(),
        },
      });
      canceledCount = 1;
      action = "canceled_by_uid";

      await logAutomationError({
        source: "slp-briefing-cancel",
        message: `予約IDで一致するレコードが見つからずuidベースでキャンセル: bookingId=${bookingId}, uid=${uid}`,
        detail: { bookingId, uid, targetId: target.id },
      });
    }

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
      action,
      canceledCount,
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
