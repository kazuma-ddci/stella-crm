import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAutomationError } from "@/lib/automation-error";
import { submitForm6BriefingReservation } from "@/lib/proline-form";
import { recomputeDuplicateCandidatesForRecord } from "@/lib/slp/duplicate-detector";
import { parseReservationDate } from "@/lib/slp/parse-reservation-date";

function verifySecret(request: Request): boolean {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  const webhookSecret = process.env.LINE_FRIEND_WEBHOOK_SECRET;
  return !!(webhookSecret && secret === webhookSecret);
}

/**
 * プロラインフリーから概要案内予約時に呼ばれるWebhook（中継URL方式対応版）
 *
 * クエリパラメータ:
 *   uid: ユーザーID ([[uid]])
 *   bookingId: 予約ID ([[cl1-booking-id]])
 *   booked: 予約日 ([[cl1-booking-create]])
 *   briefingDate: 概要案内日 ([[cl1-booking-start]])
 *   briefingStaff: 概要案内担当者 ([[cl1-booking-staff]])
 *   form3-1: 企業名（CRM中継URL経由で事前送信されたもの）
 *   form3-2: 年間人件費（役員様分）（ユーザー入力）
 *   form3-3: 年間人件費（従業員様分）（ユーザー入力）
 *   form3-4: 従業員数（ユーザー入力）
 *   form3-5: CRMトークン（中継URL経由で事前送信されたもの）
 *   secret: 認証用シークレット
 *
 * 動作:
 *   1. form3-5(token) で SlpReservationPending を検索
 *   2. ペンディング情報があれば:
 *      - 既存企業の予約 → 該当レコード(複数の場合あり)に予約ID/日時/人件費等を更新
 *      - 新規企業の予約 → 新規 SlpCompanyRecord を作成
 *   3. ペンディング情報がなければフォールバック:
 *      - 従来通り uid ベースで新規レコード作成（automation_errors にログ）
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
  // フォーム回答（form3-1〜5）
  const formCompanyName = searchParams.get("form3-1");
  const formAnnualLaborCostExecutive = searchParams.get("form3-2");
  const formAnnualLaborCostEmployee = searchParams.get("form3-3");
  const formEmployeeCount = searchParams.get("form3-4");
  const formCrmToken = searchParams.get("form3-5");

  if (!uid) {
    return NextResponse.json({ error: "uid is required" }, { status: 400 });
  }

  try {
    // 冪等性チェック: この bookingId が既に処理済みなら何もしない
    // （プロライン側のリトライや重複呼び出しによる重複レコード作成を防ぐ）
    if (bookingId) {
      const existing = await prisma.slpCompanyRecord.findFirst({
        where: {
          OR: [
            { reservationId: bookingId },
            { mergedBriefingReservationIds: { has: bookingId } },
          ],
          deletedAt: null,
        },
        select: { id: true },
      });
      if (existing) {
        return NextResponse.json({
          success: true,
          alreadyProcessed: true,
          companyRecordId: existing.id,
        });
      }
    }

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

    // プロライン担当者マッピングを解決（テキスト名→スタッフID）
    let resolvedStaffId: number | null = null;
    if (briefingStaff) {
      const mapping = await prisma.slpProlineStaffMapping.findUnique({
        where: { prolineStaffName: briefingStaff },
        select: { staffId: true },
      });
      resolvedStaffId = mapping?.staffId ?? null;

      // マッピング未登録の場合は automation_errors に記録
      // （CRM上でスタッフIDと紐付けできず、自動通知や統計が動かないため）
      if (!mapping) {
        await logAutomationError({
          source: "slp-briefing-reservation",
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

    // パース失敗時はautomation_errorsに記録して後日デバッグできるようにする
    if (booked && !briefingBookedAt) {
      await logAutomationError({
        source: "slp-briefing-reservation",
        message: `booked(予約作成日時)の日付形式がパースできません: "${booked}"`,
        detail: { uid, bookingId: bookingId ?? null, rawBooked: booked },
      });
    }
    if (briefingDate && !briefingDateParsed) {
      await logAutomationError({
        source: "slp-briefing-reservation",
        message: `briefingDate(概要案内日)の日付形式がパースできません: "${briefingDate}"`,
        detail: {
          uid,
          bookingId: bookingId ?? null,
          rawBriefingDate: briefingDate,
        },
      });
    }

    // 数値パース（form3-2, 3, 4）
    // 方針: 生テキストは常に *FormAnswer カラムに保存する。
    // 数値カラム（annualLaborCostExecutive 等）は「曖昧さゼロ」（カンマ・空白・¥・円・人・名
    // だけを除去すれば純粋な数字になる場合）のみ自動保存し、「5000万」「約50人」などは
    // 数値カラムを null のままにしてスタッフが企業詳細画面で手入力する運用。
    const strictDecimal = (s: string | null): string | null => {
      if (!s) return null;
      const trimmed = s.trim();
      if (!trimmed) return null;
      // 半角¥(U+00A5)と全角￥(U+FFE5)の両方に対応
      const cleaned = trimmed.replace(/[,\s¥￥円]/g, "");
      // 除去後に [0-9] と任意で小数点だけで構成されていること
      if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
      return cleaned;
    };
    const strictInteger = (s: string | null): number | null => {
      if (!s) return null;
      const trimmed = s.trim();
      if (!trimmed) return null;
      const cleaned = trimmed.replace(/[,\s人名]/g, "");
      if (!/^\d+$/.test(cleaned)) return null;
      const n = parseInt(cleaned, 10);
      return isNaN(n) ? null : n;
    };
    const annualLaborCostExecutive = strictDecimal(formAnnualLaborCostExecutive);
    const annualLaborCostEmployee = strictDecimal(formAnnualLaborCostEmployee);
    const employeeCount = strictInteger(formEmployeeCount);
    // 生テキスト（空文字はnullに正規化）
    const annualLaborCostExecutiveFormAnswer =
      formAnnualLaborCostExecutive?.trim() || null;
    const annualLaborCostEmployeeFormAnswer =
      formAnnualLaborCostEmployee?.trim() || null;
    const employeeCountFormAnswer = formEmployeeCount?.trim() || null;

    // ペンディング情報を検索（form3-5 のCRMトークンで一意特定）
    let pending: Awaited<
      ReturnType<typeof prisma.slpReservationPending.findUnique>
    > = null;
    if (formCrmToken) {
      pending = await prisma.slpReservationPending.findUnique({
        where: { token: formCrmToken },
      });
      // 期限切れ・使用済み・uid不一致チェック
      if (pending) {
        if (pending.uid !== uid) {
          // uid が異なる → 別ユーザーのトークン使用、データ整合性の問題
          await logAutomationError({
            source: "slp-briefing-reservation",
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
            source: "slp-briefing-reservation",
            message: `既に使用済みのCRMトークンで予約webhookが来ました: token=${formCrmToken}`,
            detail: {
              uid,
              bookingId: bookingId ?? null,
              consumedAt: pending.consumedAt.toISOString(),
            },
          });
          // 使用済みの場合はペンディングを無視（フォールバックで処理）
          pending = null;
        } else if (pending.expiresAt < new Date()) {
          await logAutomationError({
            source: "slp-briefing-reservation",
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
        source: "slp-briefing-reservation",
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
      // トークンを優先するので処理は続行
    }

    // 共通の更新データ
    const baseData = {
      reservationId: bookingId ?? null,
      briefingStatus: "予約中" as const,
      briefingBookedAt,
      briefingDate: briefingDateParsed,
      briefingStaff: briefingStaff || null,
      briefingStaffId: resolvedStaffId,
    };

    let createdOrUpdatedRecordIds: number[] = [];

    if (pending && pending.companyRecordIds.length > 0) {
      // 既存企業の予約: ペンディング情報の companyRecordIds に該当するレコードを更新
      const ids = pending.companyRecordIds;
      await prisma.slpCompanyRecord.updateMany({
        where: { id: { in: ids }, deletedAt: null },
        data: {
          ...baseData,
          // 生テキスト（フォーム回答）はユーザーが入力した時のみ上書き（監査用）
          ...(annualLaborCostExecutiveFormAnswer !== null && {
            annualLaborCostExecutiveFormAnswer,
          }),
          ...(annualLaborCostEmployeeFormAnswer !== null && {
            annualLaborCostEmployeeFormAnswer,
          }),
          ...(employeeCountFormAnswer !== null && { employeeCountFormAnswer }),
          // 数値カラムは「純粋な数字で書かれた時だけ」自動保存
          // （「5000万」等はスタッフが画面上のサジェストを見て手動で入れる）
          ...(annualLaborCostExecutive !== null && {
            annualLaborCostExecutive,
          }),
          ...(annualLaborCostEmployee !== null && {
            annualLaborCostEmployee,
          }),
          ...(employeeCount !== null && { employeeCount }),
        },
      });
      createdOrUpdatedRecordIds = ids;
    } else {
      // 新規企業の予約 or フォールバック
      // ペンディングがあれば newCompanyName、なければ form3-1 を使用、それもなければ null
      const companyName =
        pending?.newCompanyName ?? formCompanyName ?? null;

      const created = await prisma.slpCompanyRecord.create({
        data: {
          ...baseData,
          prolineUid: uid,
          companyName,
          annualLaborCostExecutive,
          annualLaborCostEmployee,
          employeeCount,
          annualLaborCostExecutiveFormAnswer,
          annualLaborCostEmployeeFormAnswer,
          employeeCountFormAnswer,
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
      createdOrUpdatedRecordIds = [created.id];

      // フォールバック発生時は警告ログ
      if (!pending && formCrmToken) {
        // tokenが渡されているのにペンディングが見つからなかった
        await logAutomationError({
          source: "slp-briefing-reservation",
          message: `予約フォームに無効なCRMトークンが含まれていました（フォールバック処理）: token=${formCrmToken}`,
          detail: {
            uid,
            bookingId: bookingId ?? null,
            companyName,
          },
        });
      } else if (!pending && !formCrmToken) {
        // tokenがない（中継URLバイパス）
        await logAutomationError({
          source: "slp-briefing-reservation",
          message: "中継URLを通らない概要案内予約を検出（フォールバック処理）",
          detail: {
            uid,
            bookingId: bookingId ?? null,
            companyName,
          },
        });
      }
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

    // 新規作成された場合は重複候補を再計算（fire-and-forget）
    for (const newId of createdOrUpdatedRecordIds) {
      recomputeDuplicateCandidatesForRecord(newId).catch(async (err) => {
        await logAutomationError({
          source: "slp-recompute-duplicates",
          message: `重複候補の再計算に失敗: recordId=${newId}`,
          detail: { error: err instanceof Error ? err.message : String(err) },
        });
      });
    }

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
      companyRecordIds: createdOrUpdatedRecordIds,
      usedToken: !!pending,
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
