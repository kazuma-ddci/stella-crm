import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAutomationError } from "@/lib/automation-error";
import { parseReservationDate } from "@/lib/slp/parse-reservation-date";

function verifySecret(request: Request): boolean {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  const webhookSecret = process.env.LINE_FRIEND_WEBHOOK_SECRET;
  return !!(webhookSecret && secret === webhookSecret);
}

/**
 * プロラインフリーから導入希望商談予約変更時に呼ばれるWebhook（中継URL方式対応版）
 *
 * クエリパラメータ:
 *   uid: ユーザーID ([[uid]])
 *   bookingId: 予約ID ([[cl2-booking-id]])
 *   booked: 予約日 ([[cl2-booking-create]])
 *   consultationDate: 導入希望商談日 ([[cl2-booking-start]])
 *   consultationStaff: 導入希望商談担当者 ([[cl2-booking-staff]])
 *   secret: 認証用シークレット
 *
 * 動作:
 *   1. bookingId で consultationReservationId 一致のレコードを検索
 *   2. 該当する全レコードを updateMany で一括更新（複製対応）
 *   3. 見つからない場合は uid ベースでフォールバック
 */
export async function GET(request: Request) {
  if (!verifySecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const uid = searchParams.get("uid");
  const bookingId = searchParams.get("bookingId");
  const booked = searchParams.get("booked");
  const consultationDate = searchParams.get("consultationDate");
  const consultationStaff = searchParams.get("consultationStaff");

  if (!uid) {
    return NextResponse.json({ error: "uid is required" }, { status: 400 });
  }

  try {
    // プロライン担当者マッピング解決
    let resolvedStaffId: number | null = null;
    if (consultationStaff) {
      const mapping = await prisma.slpProlineStaffMapping.findUnique({
        where: { prolineStaffName: consultationStaff },
        select: { staffId: true },
      });
      resolvedStaffId = mapping?.staffId ?? null;

      if (!mapping) {
        await logAutomationError({
          source: "slp-consultation-change",
          message: `マッピング未登録のプロライン担当者名を受信: "${consultationStaff}"`,
          detail: {
            prolineStaffName: consultationStaff,
            uid,
            bookingId: bookingId ?? null,
            hint: "/slp/settings/proline-staff でマッピングを追加してください",
          },
        });
      }
    }

    // 日付パース（プロラインの複数フォーマットに対応）
    const consultationBookedAt = parseReservationDate(booked);
    const consultationDateParsed = parseReservationDate(consultationDate);

    if (booked && !consultationBookedAt) {
      await logAutomationError({
        source: "slp-consultation-change",
        message: `booked(予約作成日時)の日付形式がパースできません: "${booked}"`,
        detail: { uid, bookingId: bookingId ?? null, rawBooked: booked },
      });
    }
    if (consultationDate && !consultationDateParsed) {
      await logAutomationError({
        source: "slp-consultation-change",
        message: `consultationDate(商談日)の日付形式がパースできません: "${consultationDate}"`,
        detail: {
          uid,
          bookingId: bookingId ?? null,
          rawConsultationDate: consultationDate,
        },
      });
    }

    const updateData = {
      consultationStatus: "予約中" as const,
      consultationBookedAt: consultationBookedAt ?? undefined,
      consultationDate: consultationDateParsed ?? undefined,
      consultationStaff: consultationStaff || undefined,
      consultationStaffId: consultationStaff ? resolvedStaffId : undefined,
      consultationChangedAt: new Date(),
      consultationCanceledAt: null,
    };

    let updatedCount = 0;
    let action: "updated_by_id" | "updated_by_uid" | "created" =
      "updated_by_uid";

    // 1. bookingId で予約ID一致のレコードを優先的に検索
    // メインの consultationReservationId だけでなく、マージで取り込まれた配列も検索対象に
    if (bookingId) {
      const result = await prisma.slpCompanyRecord.updateMany({
        where: {
          OR: [
            { consultationReservationId: bookingId },
            { mergedConsultationReservationIds: { has: bookingId } },
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

    // 2. フォールバック: uid + 直近のアクティブレコード
    if (updatedCount === 0) {
      const target = await prisma.slpCompanyRecord.findFirst({
        where: {
          prolineUid: uid,
          consultationCanceledAt: null,
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
            consultationReservationId: bookingId ?? undefined,
          },
        });
        updatedCount = 1;
        action = "updated_by_uid";

        await logAutomationError({
          source: "slp-consultation-change",
          message: `予約IDで一致するレコードが見つからずuidベースで更新: bookingId=${bookingId}, uid=${uid}`,
          detail: { bookingId, uid, targetId: target.id },
        });
      } else {
        // 3. それでも見つからない場合は新規作成
        const lineFriend = await prisma.slpLineFriend.findUnique({
          where: { uid },
          select: { id: true, snsname: true, phone: true },
        });
        const member = await prisma.slpMember.findUnique({
          where: { uid },
          select: { email: true },
        });

        const created = await prisma.slpCompanyRecord.create({
          data: {
            prolineUid: uid,
            consultationReservationId: bookingId ?? null,
            consultationStatus: "予約中",
            consultationBookedAt:
              consultationBookedAt && !isNaN(consultationBookedAt.getTime())
                ? consultationBookedAt
                : null,
            consultationDate:
              consultationDateParsed && !isNaN(consultationDateParsed.getTime())
                ? consultationDateParsed
                : null,
            consultationStaff: consultationStaff || null,
            consultationStaffId: resolvedStaffId,
            consultationChangedAt: new Date(),
            contacts: {
              create: {
                name: lineFriend?.snsname ?? null,
                role: "導入希望商談予約者",
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
          source: "slp-consultation-change",
          message: `変更webhookで対象レコードが見つからず新規作成: bookingId=${bookingId}, uid=${uid}`,
          detail: { bookingId, uid, createdId: created.id },
        });
      }
    }

    return NextResponse.json({
      success: true,
      action,
      updatedCount,
    });
  } catch (error) {
    await logAutomationError({
      source: "slp-consultation-change",
      message: `導入希望商談変更Webhook処理失敗: uid=${uid}`,
      detail: { error: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
