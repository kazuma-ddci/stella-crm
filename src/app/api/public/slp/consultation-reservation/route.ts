import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAutomationError } from "@/lib/automation-error";
import { recomputeDuplicateCandidatesForRecord } from "@/lib/slp/duplicate-detector";
import { parseReservationDate } from "@/lib/slp/parse-reservation-date";
import { applyProlineReservationToSession } from "@/lib/slp/session-helper";
import { handleSessionReservationSideEffects } from "@/lib/slp/session-lifecycle";

function verifySecret(request: Request): boolean {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  const webhookSecret = process.env.LINE_FRIEND_WEBHOOK_SECRET;
  return !!(webhookSecret && secret === webhookSecret);
}

/**
 * プロラインフリーから導入希望商談予約時に呼ばれるWebhook（中継URL方式対応版）
 *
 * クエリパラメータ:
 *   uid: ユーザーID ([[uid]])
 *   bookingId: 予約ID ([[cl2-booking-id]])
 *   booked: 予約日 ([[cl2-booking-create]])
 *   consultationDate: 導入希望商談日 ([[cl2-booking-start]])
 *   consultationStaff: 導入希望商談担当者 ([[cl2-booking-staff]])
 *   form14-1: 企業名（CRM中継URL経由で事前送信されたもの）
 *   form14-2: CRMトークン（中継URL経由で事前送信されたもの）
 *   secret: 認証用シークレット
 *
 * 動作:
 *   1. form14-2(token) で SlpReservationPending を検索
 *   2. ペンディング情報があれば、対象企業レコードに consultationReservationId と日時等を保存
 *   3. ペンディング情報がなければ uid ベースのフォールバック
 *
 * 導入希望商談は「概要案内が完了した既存企業」のみが対象（中継ページでの制約）
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
  // フォーム回答（form14-1, form14-2）
  const formCompanyName = searchParams.get("form14-1");
  const formCrmToken = searchParams.get("form14-2");

  if (!uid) {
    return NextResponse.json({ error: "uid is required" }, { status: 400 });
  }

  try {
    // 冪等性チェック: この bookingId が既にセッションとして処理済みなら何もしない
    if (bookingId) {
      const existingSession = await prisma.slpMeetingSession.findFirst({
        where: {
          prolineReservationId: bookingId,
          category: "consultation",
          deletedAt: null,
        },
        select: { companyRecordId: true },
      });
      if (existingSession) {
        return NextResponse.json({
          success: true,
          alreadyProcessed: true,
          companyRecordId: existingSession.companyRecordId,
        });
      }
    }

    // プロライン担当者マッピングを解決（概要案内/導入希望商談で共用）
    let resolvedStaffId: number | null = null;
    if (consultationStaff) {
      const mapping = await prisma.slpProlineStaffMapping.findUnique({
        where: { prolineStaffName: consultationStaff },
        select: { staffId: true },
      });
      resolvedStaffId = mapping?.staffId ?? null;

      // マッピング未登録の場合は automation_errors に記録
      if (!mapping) {
        await logAutomationError({
          source: "slp-consultation-reservation",
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

    // パース失敗時はautomation_errorsに記録して後日デバッグできるようにする
    if (booked && !consultationBookedAt) {
      await logAutomationError({
        source: "slp-consultation-reservation",
        message: `booked(予約作成日時)の日付形式がパースできません: "${booked}"`,
        detail: { uid, bookingId: bookingId ?? null, rawBooked: booked },
      });
    }
    if (consultationDate && !consultationDateParsed) {
      await logAutomationError({
        source: "slp-consultation-reservation",
        message: `consultationDate(商談日)の日付形式がパースできません: "${consultationDate}"`,
        detail: {
          uid,
          bookingId: bookingId ?? null,
          rawConsultationDate: consultationDate,
        },
      });
    }

    // ペンディング情報を検索
    let pending: Awaited<
      ReturnType<typeof prisma.slpReservationPending.findUnique>
    > = null;
    if (formCrmToken) {
      pending = await prisma.slpReservationPending.findUnique({
        where: { token: formCrmToken },
      });
      if (pending) {
        if (pending.uid !== uid) {
          await logAutomationError({
            source: "slp-consultation-reservation",
            message: `CRMトークンとwebhookのuidが一致しません`,
            detail: {
              token: formCrmToken,
              pendingUid: pending.uid,
              webhookUid: uid,
              bookingId: bookingId ?? null,
            },
          });
          pending = null;
        } else if (pending.consumedAt) {
          await logAutomationError({
            source: "slp-consultation-reservation",
            message: `既に使用済みのCRMトークンで予約webhookが来ました: token=${formCrmToken}`,
            detail: {
              uid,
              bookingId: bookingId ?? null,
              consumedAt: pending.consumedAt.toISOString(),
            },
          });
          pending = null;
        } else if (pending.expiresAt < new Date()) {
          await logAutomationError({
            source: "slp-consultation-reservation",
            message: `期限切れのCRMトークンで予約webhookが来ました: token=${formCrmToken}`,
            detail: {
              uid,
              bookingId: bookingId ?? null,
              expiresAt: pending.expiresAt.toISOString(),
            },
          });
          pending = null;
        }
      }
    }

    // フォーム企業名 vs ペンディング期待企業名 の整合性チェック
    if (
      pending &&
      formCompanyName &&
      formCompanyName !== pending.expectedCompanyName
    ) {
      await logAutomationError({
        source: "slp-consultation-reservation",
        message:
          "フォームの企業名がCRMペンディング情報と一致しません（フォームが編集された可能性）",
        detail: {
          uid,
          bookingId: bookingId ?? null,
          formCompanyName,
          expectedCompanyName: pending.expectedCompanyName,
          token: formCrmToken,
        },
      });
    }

    let updatedRecordIds: number[] = [];

    if (pending && pending.companyRecordIds.length > 0) {
      // 既存企業: 基本情報は既にあるので企業レコードは更新しない（商談はセッションで管理）
      updatedRecordIds = pending.companyRecordIds;
    } else {
      // フォールバック: prolineUid 一致の直近のアクティブなレコードを使用
      const target = await prisma.slpCompanyRecord.findFirst({
        where: {
          prolineUid: uid,
          deletedAt: null,
        },
        orderBy: { id: "desc" },
        select: { id: true },
      });

      if (target) {
        updatedRecordIds = [target.id];
      } else {
        // それでも見つからない場合は新規作成（最終フォールバック、企業基本情報のみ）
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
            companyName: pending?.expectedCompanyName ?? formCompanyName ?? null,
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
        updatedRecordIds = [created.id];
      }

      // フォールバック発生時の警告ログ
      if (!pending && formCrmToken) {
        await logAutomationError({
          source: "slp-consultation-reservation",
          message: `予約フォームに無効なCRMトークンが含まれていました: token=${formCrmToken}`,
          detail: { uid, bookingId: bookingId ?? null },
        });
      } else if (!pending && !formCrmToken) {
        await logAutomationError({
          source: "slp-consultation-reservation",
          message: "中継URLを通らない導入希望商談予約を検出（フォールバック処理）",
          detail: { uid, bookingId: bookingId ?? null },
        });
      }
    }

    // 履歴記録（新規予約）
    if (updatedRecordIds.length > 0) {
      await prisma.slpReservationHistory.createMany({
        data: updatedRecordIds.map((recordId) => ({
          companyRecordId: recordId,
          reservationType: "consultation",
          actionType: "予約",
          reservationId: bookingId ?? null,
          reservedAt: consultationDateParsed,
          bookedAt: consultationBookedAt,
          staffName: consultationStaff || null,
          staffId: resolvedStaffId,
        })),
      });
    }

    // ペンディング情報を消費済みに
    if (pending) {
      await prisma.slpReservationPending.update({
        where: { id: pending.id },
        data: {
          consumedAt: new Date(),
          consumedReservationId: bookingId ?? null,
        },
      });
    }

    // セッションテーブルに記録 → 副作用処理（Zoom発行 + LINE通知）
    // 導入希望商談では紹介者通知は送らない
    for (const recordId of updatedRecordIds) {
      try {
        const createdSession = await prisma.$transaction(async (tx) => {
          return applyProlineReservationToSession(
            recordId,
            "consultation",
            {
              scheduledAt: consultationDateParsed,
              assignedStaffId: resolvedStaffId,
              prolineReservationId: bookingId ?? null,
              prolineStaffName: consultationStaff || null,
              bookedAt: consultationBookedAt,
            },
            tx
          );
        });

        handleSessionReservationSideEffects({
          sessionId: createdSession.id,
          companyRecordId: recordId,
          category: "consultation",
          triggerReason: "confirm",
          roundNumber: createdSession.roundNumber,
          notifyReferrer: false,
        }).catch(async (err) => {
          await logAutomationError({
            source: "slp-consultation-reservation-side-effects",
            message: `予約副作用処理失敗: sessionId=${createdSession.id}`,
            detail: { error: err instanceof Error ? err.message : String(err) },
          });
        });
      } catch (err) {
        await logAutomationError({
          source: "slp-consultation-reservation-session",
          message: `セッション並列書き込み失敗: companyRecordId=${recordId}`,
          detail: { error: err instanceof Error ? err.message : String(err) },
        });
      }
    }

    // 新規作成・更新されたレコードについて重複候補を再計算（fire-and-forget）
    for (const recId of updatedRecordIds) {
      recomputeDuplicateCandidatesForRecord(recId).catch(async (err) => {
        await logAutomationError({
          source: "slp-recompute-duplicates",
          message: `重複候補の再計算に失敗: recordId=${recId}`,
          detail: { error: err instanceof Error ? err.message : String(err) },
        });
      });
    }

    return NextResponse.json({
      success: true,
      companyRecordIds: updatedRecordIds,
      usedToken: !!pending,
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
