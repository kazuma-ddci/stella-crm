import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAutomationError } from "@/lib/automation-error";
import { submitForm7BriefingChange } from "@/lib/proline-form";

function verifySecret(request: Request): boolean {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  const webhookSecret = process.env.LINE_FRIEND_WEBHOOK_SECRET;
  return !!(webhookSecret && secret === webhookSecret);
}

/**
 * プロラインフリーから概要案内予約変更時に呼ばれるWebhook
 *
 * クエリパラメータ:
 *   uid: ユーザーID ([[uid]])
 *   booked: 予約日 ([[cl1-booking-create]])
 *   briefingDate: 概要案内日 ([[cl1-booking-start]])
 *   briefingStaff: 概要案内担当者 ([[cl1-booking-staff]])
 *   secret: 認証用シークレット
 *
 * 動作:
 *   prolineUidが一致する直近のキャンセルされていない企業名簿レコードを更新する
 *   見つからない場合は新規作成（予約Webhookと同じフロー）
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
    // 概要案内担当者マッピングを解決
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

    // prolineUid一致の直近のアクティブなレコード（キャンセル/削除されていない）を検索
    const target = await prisma.slpCompanyRecord.findFirst({
      where: {
        prolineUid: uid,
        briefingCanceledAt: null,
        deletedAt: null,
      },
      orderBy: { id: "desc" },
      select: { id: true },
    });

    // LINE友達情報（紹介者通知用に共通取得）
    const lineFriend = await prisma.slpLineFriend.findUnique({
      where: { uid },
      select: { id: true, snsname: true, phone: true, free1: true },
    });

    let recordId: number;
    let action: "created" | "updated";

    if (!target) {
      // 該当レコードが見つからない場合は新規作成
      const member = await prisma.slpMember.findUnique({
        where: { uid },
        select: { email: true },
      });

      const created = await prisma.slpCompanyRecord.create({
        data: {
          prolineUid: uid,
          briefingStatus: "予約中",
          briefingBookedAt: briefingBookedAt && !isNaN(briefingBookedAt.getTime()) ? briefingBookedAt : null,
          briefingDate: briefingDateParsed && !isNaN(briefingDateParsed.getTime()) ? briefingDateParsed : null,
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
      recordId = created.id;
      action = "created";
    } else {
      // 既存レコードを更新
      const updated = await prisma.slpCompanyRecord.update({
        where: { id: target.id },
        data: {
          briefingStatus: "予約中",
          briefingBookedAt: briefingBookedAt && !isNaN(briefingBookedAt.getTime()) ? briefingBookedAt : undefined,
          briefingDate: briefingDateParsed && !isNaN(briefingDateParsed.getTime()) ? briefingDateParsed : undefined,
          briefingStaff: briefingStaff || undefined,
          briefingStaffId: briefingStaff ? resolvedStaffId : undefined,
          briefingChangedAt: new Date(),
        },
      });
      recordId = updated.id;
      action = "updated";
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
      companyRecordId: recordId,
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
