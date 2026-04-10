import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAutomationError } from "@/lib/automation-error";
import { submitForm7BriefingChange } from "@/lib/proline-form";
import { parseReservationDate } from "@/lib/slp/parse-reservation-date";

function verifySecret(request: Request): boolean {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  const webhookSecret = process.env.LINE_FRIEND_WEBHOOK_SECRET;
  return !!(webhookSecret && secret === webhookSecret);
}

/**
 * プロラインフリーから概要案内予約変更時に呼ばれるWebhook（中継URL方式対応版）
 *
 * クエリパラメータ:
 *   uid: ユーザーID ([[uid]])
 *   bookingId: 予約ID ([[cl1-booking-id]])
 *   booked: 予約日 ([[cl1-booking-create]])
 *   briefingDate: 概要案内日 ([[cl1-booking-start]])
 *   briefingStaff: 概要案内担当者 ([[cl1-booking-staff]])
 *   secret: 認証用シークレット
 *
 * 動作:
 *   1. bookingId で reservationId が一致する全レコードを検索（複製対応）
 *   2. 見つかった全レコードを updateMany で一括更新
 *   3. 見つからない場合は uid ベースのフォールバック検索 → 更新 or 新規作成
 *
 * 重要:
 *   同じ予約IDが複数レコードに紐付いている場合（CRMで案件分割した時）、
 *   全レコードがまとめて変更される（ユーザー要件）。
 */
export async function GET(request: Request) {
  if (!verifySecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const uid = searchParams.get("uid");
  const bookingId = searchParams.get("bookingId");
  const booked = searchParams.get("booked");
  const briefingDate = searchParams.get("briefingDate");
  const briefingStaff = searchParams.get("briefingStaff");

  if (!uid) {
    return NextResponse.json({ error: "uid is required" }, { status: 400 });
  }

  try {
    // プロライン担当者マッピングを解決
    let resolvedStaffId: number | null = null;
    if (briefingStaff) {
      const mapping = await prisma.slpProlineStaffMapping.findUnique({
        where: { prolineStaffName: briefingStaff },
        select: { staffId: true },
      });
      resolvedStaffId = mapping?.staffId ?? null;

      if (!mapping) {
        await logAutomationError({
          source: "slp-briefing-change",
          message: `マッピング未登録のプロライン担当者名を受信: "${briefingStaff}"`,
          detail: {
            prolineStaffName: briefingStaff,
            uid,
            bookingId: bookingId ?? null,
            hint: "/slp/settings/proline-staff でマッピングを追加してください",
          },
        });
      }
    }

    // 日付パース（プロラインの複数フォーマットに対応）
    const briefingBookedAt = parseReservationDate(booked);
    const briefingDateParsed = parseReservationDate(briefingDate);

    if (booked && !briefingBookedAt) {
      await logAutomationError({
        source: "slp-briefing-change",
        message: `booked(予約作成日時)の日付形式がパースできません: "${booked}"`,
        detail: { uid, bookingId: bookingId ?? null, rawBooked: booked },
      });
    }
    if (briefingDate && !briefingDateParsed) {
      await logAutomationError({
        source: "slp-briefing-change",
        message: `briefingDate(概要案内日)の日付形式がパースできません: "${briefingDate}"`,
        detail: {
          uid,
          bookingId: bookingId ?? null,
          rawBriefingDate: briefingDate,
        },
      });
    }

    // LINE友達情報（紹介者通知用に共通取得）
    const lineFriend = await prisma.slpLineFriend.findUnique({
      where: { uid },
      select: { id: true, snsname: true, phone: true, free1: true },
    });

    // 共通の更新データ
    const updateData = {
      briefingStatus: "予約中" as const,
      briefingBookedAt:
        briefingBookedAt && !isNaN(briefingBookedAt.getTime())
          ? briefingBookedAt
          : undefined,
      briefingDate:
        briefingDateParsed && !isNaN(briefingDateParsed.getTime())
          ? briefingDateParsed
          : undefined,
      briefingStaff: briefingStaff || undefined,
      briefingStaffId: briefingStaff ? resolvedStaffId : undefined,
      briefingChangedAt: new Date(),
      // 再予約時のキャンセルクリア
      briefingCanceledAt: null,
    };

    let updatedCount = 0;
    let action: "updated_by_id" | "updated_by_uid" | "created" =
      "updated_by_uid";

    // 1. bookingId で予約ID一致のレコードを優先的に検索
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
        data: updateData,
      });
      updatedCount = result.count;
      if (updatedCount > 0) {
        action = "updated_by_id";
      }
    }

    // 2. 予約IDで見つからなかった場合のフォールバック: uid + 直近のアクティブレコード
    if (updatedCount === 0) {
      const target = await prisma.slpCompanyRecord.findFirst({
        where: {
          prolineUid: uid,
          briefingCanceledAt: null,
          deletedAt: null,
        },
        orderBy: { id: "desc" },
        select: { id: true },
      });

      if (target) {
        await prisma.slpCompanyRecord.update({
          where: { id: target.id },
          data: {
            ...updateData,
            // フォールバック時は予約IDも保存
            reservationId: bookingId ?? undefined,
          },
        });
        updatedCount = 1;
        action = "updated_by_uid";

        await logAutomationError({
          source: "slp-briefing-change",
          message: `予約IDで一致するレコードが見つからずuidベースで更新: bookingId=${bookingId}, uid=${uid}`,
          detail: { bookingId, uid, targetId: target.id },
        });
      } else {
        // 3. それでも見つからない場合は新規作成
        const member = await prisma.slpMember.findUnique({
          where: { uid },
          select: { email: true },
        });

        const created = await prisma.slpCompanyRecord.create({
          data: {
            prolineUid: uid,
            reservationId: bookingId ?? null,
            briefingStatus: "予約中",
            briefingBookedAt:
              briefingBookedAt && !isNaN(briefingBookedAt.getTime())
                ? briefingBookedAt
                : null,
            briefingDate:
              briefingDateParsed && !isNaN(briefingDateParsed.getTime())
                ? briefingDateParsed
                : null,
            briefingStaff: briefingStaff || null,
            briefingStaffId: resolvedStaffId,
            briefingChangedAt: new Date(),
            contacts: {
              create: {
                name: lineFriend?.snsname ?? null,
                role: "概要案内予約者",
                email: member?.email ?? null,
                phone: lineFriend?.phone ?? null,
                lineFriendId: lineFriend?.id ?? null,
                isPrimary: true,
              },
            },
          },
        });
        updatedCount = 1;
        action = "created";

        await logAutomationError({
          source: "slp-briefing-change",
          message: `変更webhookで対象レコードが見つからず新規作成: bookingId=${bookingId}, uid=${uid}`,
          detail: { bookingId, uid, createdId: created.id },
        });
      }
    }

    // 紹介者通知（form7）— 紹介者がいれば fire-and-forget で送信
    const referrerUid = lineFriend?.free1?.trim();
    const snsname = lineFriend?.snsname;
    if (referrerUid && snsname) {
      submitForm7BriefingChange(
        referrerUid,
        snsname,
        briefingDate ?? ""
      ).catch(async (err) => {
        await logAutomationError({
          source: "slp-briefing-change-form7",
          message: `概要案内変更通知（form7）送信失敗: referrerUid=${referrerUid}, snsname=${snsname}`,
          detail: {
            error: err instanceof Error ? err.message : String(err),
            referrerUid,
            snsname,
            briefingDate: briefingDate ?? "",
            retryAction: "form7-briefing-change",
          },
        });
      });
    }

    return NextResponse.json({
      success: true,
      action,
      updatedCount,
    });
  } catch (error) {
    await logAutomationError({
      source: "slp-briefing-change",
      message: `概要案内変更Webhook処理失敗: uid=${uid}`,
      detail: { error: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
