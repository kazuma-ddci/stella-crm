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
 * プロラインフリーから導入希望商談予約時に呼ばれるWebhook
 *
 * クエリパラメータ:
 *   uid: ユーザーID ([[uid]])
 *   booked: 予約日 ([[cl2-booking-create]])
 *   consultationDate: 導入希望商談日 ([[cl2-booking-start]])
 *   consultationStaff: 導入希望商談担当者 ([[cl2-booking-staff]])
 *   secret: 認証用シークレット
 *
 * 動作:
 *   prolineUidが一致する直近のキャンセルされていない企業名簿レコードに
 *   導入希望商談情報を追加する。見つからない場合は新規作成（briefing-changeパターン）。
 *   これにより同じ企業に概要案内と導入希望商談を1レコードに集約する。
 *
 * 紹介者通知は送らない（概要案内のForm6相当は不要）。
 */
export async function GET(request: Request) {
  if (!verifySecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const uid = searchParams.get("uid");
  const booked = searchParams.get("booked");
  const consultationDate = searchParams.get("consultationDate");
  const consultationStaff = searchParams.get("consultationStaff");

  if (!uid) {
    return NextResponse.json({ error: "uid is required" }, { status: 400 });
  }

  try {
    // 担当者マッピングを解決（SlpBriefingStaffMapping を概要案内/導入希望商談で共用）
    let resolvedStaffId: number | null = null;
    if (consultationStaff) {
      const mapping = await prisma.slpBriefingStaffMapping.findUnique({
        where: { briefingStaffName: consultationStaff },
        select: { staffId: true },
      });
      resolvedStaffId = mapping?.staffId ?? null;
    }

    // 日付パース
    const consultationBookedAt = booked ? new Date(booked) : null;
    const consultationDateParsed = consultationDate ? new Date(consultationDate) : null;

    // prolineUid一致の直近のアクティブなレコードを検索
    const target = await prisma.slpCompanyRecord.findFirst({
      where: {
        prolineUid: uid,
        deletedAt: null,
      },
      orderBy: { id: "desc" },
      select: { id: true },
    });

    let recordId: number;
    let action: "created" | "updated";

    if (!target) {
      // 該当レコードが見つからない場合は新規作成（contacts も同時作成）
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
      recordId = created.id;
      action = "created";
    } else {
      // 既存レコードに導入希望商談情報を追記
      const updated = await prisma.slpCompanyRecord.update({
        where: { id: target.id },
        data: {
          consultationStatus: "予約中",
          consultationBookedAt:
            consultationBookedAt && !isNaN(consultationBookedAt.getTime())
              ? consultationBookedAt
              : undefined,
          consultationDate:
            consultationDateParsed && !isNaN(consultationDateParsed.getTime())
              ? consultationDateParsed
              : undefined,
          consultationStaff: consultationStaff || undefined,
          consultationStaffId: consultationStaff ? resolvedStaffId : undefined,
          // 既存にキャンセル日が入っている場合（再予約）はクリア
          consultationCanceledAt: null,
        },
      });
      recordId = updated.id;
      action = "updated";
    }

    return NextResponse.json({
      success: true,
      action,
      companyRecordId: recordId,
    });
  } catch (error) {
    await logAutomationError({
      source: "slp-consultation-reservation",
      message: `導入希望商談予約Webhook処理失敗: uid=${uid}`,
      detail: { error: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
