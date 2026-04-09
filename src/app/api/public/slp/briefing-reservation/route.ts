import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAutomationError } from "@/lib/automation-error";
import { submitForm6BriefingReservation } from "@/lib/proline-form";

function verifySecret(request: Request): boolean {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  const webhookSecret = process.env.LINE_FRIEND_WEBHOOK_SECRET;
  return !!(webhookSecret && secret === webhookSecret);
}

/**
 * プロラインフリーから概要案内予約時に呼ばれるWebhook
 *
 * クエリパラメータ:
 *   uid: ユーザーID ([[uid]])
 *   booked: 予約日 ([[cl1-booking-create]])
 *   briefingDate: 概要案内日 ([[cl1-booking-start]])
 *   briefingStaff: 概要案内担当者 ([[cl1-booking-staff]])
 *   secret: 認証用シークレット
 */
export async function GET(request: Request) {
  if (!verifySecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const uid = searchParams.get("uid");
  const booked = searchParams.get("booked");
  const briefingDate = searchParams.get("briefingDate");
  const briefingStaff = searchParams.get("briefingStaff");

  if (!uid) {
    return NextResponse.json({ error: "uid is required" }, { status: 400 });
  }

  try {
    // LINE友達情報を取得（名前・電話番号・公式LINE紐付け用 + 紹介者UID）
    const lineFriend = await prisma.slpLineFriend.findUnique({
      where: { uid },
      select: { id: true, snsname: true, phone: true, free1: true },
    });

    // 組合員情報を取得（メールアドレス同期用）
    const member = await prisma.slpMember.findUnique({
      where: { uid },
      select: { email: true },
    });

    // 概要案内担当者マッピングを解決（テキスト名→スタッフID）
    let resolvedStaffId: number | null = null;
    if (briefingStaff) {
      const mapping = await prisma.slpBriefingStaffMapping.findUnique({
        where: { briefingStaffName: briefingStaff },
        select: { staffId: true },
      });
      resolvedStaffId = mapping?.staffId ?? null;
    }

    // 日付パース
    const briefingBookedAt = booked ? new Date(booked) : null;
    const briefingDateParsed = briefingDate ? new Date(briefingDate) : null;

    // 企業名簿レコード作成 + 担当者を同時作成
    const record = await prisma.slpCompanyRecord.create({
      data: {
        prolineUid: uid,
        briefingStatus: "予約中",
        briefingBookedAt: briefingBookedAt && !isNaN(briefingBookedAt.getTime()) ? briefingBookedAt : null,
        briefingDate: briefingDateParsed && !isNaN(briefingDateParsed.getTime()) ? briefingDateParsed : null,
        briefingStaff: briefingStaff || null,
        briefingStaffId: resolvedStaffId,
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

    // 紹介者通知（form6）— 紹介者がいれば fire-and-forget で送信
    const referrerUid = lineFriend?.free1?.trim();
    const snsname = lineFriend?.snsname;
    if (referrerUid && snsname) {
      submitForm6BriefingReservation(
        referrerUid,
        snsname,
        briefingDate ?? ""
      ).catch(async (err) => {
        await logAutomationError({
          source: "slp-briefing-reservation-form6",
          message: `概要案内予約通知（form6）送信失敗: referrerUid=${referrerUid}, snsname=${snsname}`,
          detail: {
            error: err instanceof Error ? err.message : String(err),
            referrerUid,
            snsname,
            briefingDate: briefingDate ?? "",
            retryAction: "form6-briefing-reservation",
          },
        });
      });
    }

    return NextResponse.json({
      success: true,
      companyRecordId: record.id,
    });
  } catch (error) {
    await logAutomationError({
      source: "slp-briefing-reservation",
      message: `概要案内予約Webhook処理失敗: uid=${uid}`,
      detail: { error: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
