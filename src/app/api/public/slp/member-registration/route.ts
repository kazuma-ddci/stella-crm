import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendSlpContract, isRemindable, isRemindExpired } from "@/lib/slp-cloudsign";
import { logAutomationError } from "@/lib/automation-error";
import { submitProlineForm } from "@/lib/proline-form";
import { generateWatermarkCode } from "@/lib/watermark";

interface RegistrationData {
  memberCategory: string;
  lineName: string;
  name: string;
  position: string;
  email: string;
  phone: string;
  company: string | null;
  address: string;
  note: string | null;
  uid: string;
  // メールアドレス変更確認時
  confirmEmailChange?: boolean;
  fixBounce?: boolean; // メール不達修正時のフラグ
}

/**
 * レスポンスの type で画面の分岐を制御:
 *
 * - "success"           : 新規登録＋契約書送付完了
 * - "already_signed"    : 既に契約締結済み
 * - "already_sent"      : 契約書送付済み（リマインド可能期間内）
 * - "remind_expired"    : 契約書の期限切れ（再送付は公式LINEへ）
 * - "email_changed"     : メールアドレス変更＋契約書再送付完了
 * - "email_change_limit": メールアドレス変更上限到達
 * - "email_diff"        : 異なるメールアドレスで送信された（変更確認を促す）
 * - "error"             : エラー
 */

export async function POST(request: NextRequest) {
  try {
    const data: RegistrationData = await request.json();

    // 必須項目バリデーション
    if (
      !data.memberCategory ||
      !data.lineName ||
      !data.name ||
      !data.position ||
      !data.email ||
      !data.phone ||
      !data.address
    ) {
      return NextResponse.json(
        { success: false, type: "error", error: "必須項目が入力されていません" },
        { status: 400 }
      );
    }

    if (!data.uid) {
      return NextResponse.json(
        { success: false, type: "error", error: "ユーザー情報が不足しています" },
        { status: 400 }
      );
    }

    // 法人担当者・代理店の場合、法人情報は必須
    if (
      (data.memberCategory === "法人担当者" || data.memberCategory === "代理店") &&
      !data.company
    ) {
      return NextResponse.json(
        {
          success: false,
          type: "error",
          error: "法人担当者・代理店の方は法人情報を入力してください",
        },
        { status: 400 }
      );
    }

    // 既存メンバーチェック
    const existingMember = await prisma.slpMember.findUnique({
      where: { uid: data.uid },
    });

    // SlpLineFriendからfree1（紹介者UID）を取得し、組合員名簿に存在するか確認
    const lineFriend = await prisma.slpLineFriend.findUnique({
      where: { uid: data.uid },
      select: { free1: true },
    });
    const rawReferrerUid = lineFriend?.free1 || null;

    // 紹介者が組合員名簿に登録済みか事前チェック（FK制約違反を防ぐ）
    let referrerUid: string | null = null;
    if (rawReferrerUid) {
      const referrerMember = await prisma.slpMember.findUnique({
        where: { uid: rawReferrerUid },
        select: { uid: true, deletedAt: true },
      });
      if (referrerMember && !referrerMember.deletedAt) {
        referrerUid = rawReferrerUid;
      } else {
        // 紹介者が組合員未登録 → 紹介者なしで登録し、自動化エラーに記録
        await logAutomationError({
          source: "slp-member-registration",
          message: `紹介者が組合員名簿に未登録のため、紹介者なしで登録しました: 申込者「${data.name}」`,
          detail: {
            uid: data.uid,
            applicantName: data.name,
            referrerUid: rawReferrerUid,
            hint: "紹介者が組合員入会フォームを未提出の可能性があります。紹介者が登録完了後、組合員名簿の「紹介者」を手動で設定してください。",
          },
        });
      }
    }

    // =============================================
    // 既存メンバーの場合
    // =============================================
    if (existingMember && !existingMember.deletedAt) {
      const status = existingMember.status;

      // (A) 契約締結済み
      if (status === "組合員契約書締結") {
        return NextResponse.json({
          success: true,
          type: "already_signed",
          signedDate: existingMember.contractSignedDate?.toISOString() || null,
        });
      }

      // (B) 契約書送付済み
      if (status === "契約書送付済") {
        // (B-0) メール不達 → メアド修正して再送付
        if (existingMember.cloudsignBounced && data.fixBounce) {
          try {
            const result = await sendSlpContract({
              email: data.email,
              name: data.name,
              slpMemberId: existingMember.id,
            });

            // bounced フラグをリセットし、新しいメアドで更新
            // emailChangeCount はインクリメントしない（不達修正はカウント外）
            await prisma.slpMember.update({
              where: { id: existingMember.id },
              data: {
                email: data.email,
                documentId: result.documentId,
                cloudsignUrl: result.cloudsignUrl,
                contractSentDate: new Date(),
                status: "契約書送付済",
                cloudsignBounced: false,
                cloudsignBouncedAt: null,
                cloudsignBouncedEmail: null,
                reminderCount: 0,
                lastReminderSentAt: null,
                formSubmittedAt: new Date(),
                // その他フォーム情報も更新
                name: data.name,
                memberCategory: data.memberCategory,
                lineName: data.lineName,
                position: data.position,
                phone: data.phone,
                company: data.company,
                address: data.address,
                memo: data.note || null,
              },
            });

            return NextResponse.json({
              success: true,
              type: "success",
              email: data.email,
              sentDate: new Date().toISOString(),
            });
          } catch (error) {
            console.error("CloudSign send error (bounce fix):", error);
            await logAutomationError({
              source: "slp-member-registration",
              message: `契約書再送付失敗（メール不達修正）: ${data.name}`,
              detail: {
                uid: data.uid,
                name: data.name,
                email: data.email,
                error: String(error),
              },
            });
            return NextResponse.json({
              success: true,
              type: "send_error",
            });
          }
        }

        const emailDiffers =
          existingMember.email?.toLowerCase() !== data.email.toLowerCase();

        // メールアドレスが異なる場合
        if (emailDiffers && !data.confirmEmailChange) {
          // 変更上限チェック
          if (existingMember.emailChangeCount >= 2) {
            return NextResponse.json({
              success: true,
              type: "email_change_limit",
            });
          }
          return NextResponse.json({
            success: true,
            type: "email_diff",
            currentEmail: existingMember.email,
            newEmail: data.email,
            remainingChanges: 2 - existingMember.emailChangeCount,
          });
        }

        // メールアドレス変更確認済み
        if (emailDiffers && data.confirmEmailChange) {
          if (existingMember.emailChangeCount >= 2) {
            return NextResponse.json({
              success: true,
              type: "email_change_limit",
            });
          }

          // 新しいメールアドレスで契約書再送付
          try {
            const result = await sendSlpContract({
              email: data.email,
              name: data.name,
              slpMemberId: existingMember.id,
            });

            await prisma.slpMember.update({
              where: { id: existingMember.id },
              data: {
                email: data.email,
                emailChangeCount: existingMember.emailChangeCount + 1,
                documentId: result.documentId,
                cloudsignUrl: result.cloudsignUrl,
                contractSentDate: new Date(),
                status: "契約書送付済",
                reminderCount: 0,
                lastReminderSentAt: null,
                formSubmittedAt: new Date(),
              },
            });

            // ProLineフォーム送信（fire-and-forget）
            submitProlineForm(data.uid, {
              memberCategory: data.memberCategory,
              name: data.name,
              position: data.position,
              email: data.email,
              phone: data.phone,
              company: data.company,
              address: data.address,
              note: data.note,
            }).catch(async (err) => {
              console.error("ProLine form submit error:", err);
              await logAutomationError({
                source: "proline-form-submit",
                message: `プロラインフォーム送信失敗: ${data.name}`,
                detail: {
                  retryAction: "proline-form-submit",
                  uid: data.uid,
                  memberCategory: data.memberCategory,
                  name: data.name,
                  position: data.position,
                  email: data.email,
                  phone: data.phone,
                  company: data.company,
                  address: data.address,
                  note: data.note,
                },
              });
            });

            return NextResponse.json({
              success: true,
              type: "email_changed",
              email: data.email,
              sentDate: new Date().toISOString(),
            });
          } catch (error) {
            console.error("CloudSign send error (email change):", error);
            await logAutomationError({
              source: "public/slp/member-registration",
              message: `契約書再送付失敗（メール変更）: ${data.name}`,
              detail: {
                retryAction: "cloudsign-send",
                uid: data.uid,
                name: data.name,
                email: data.email,
                error: String(error),
              },
            });
            return NextResponse.json({
              success: false,
              type: "error",
              error: "契約書の送付に失敗しました。公式LINEにお問い合わせください。",
            });
          }
        }

        // メールアドレス同じ → リマインド可能か判定
        if (isRemindExpired(existingMember.contractSentDate)) {
          // リマインド期限切れ → resubmittedフラグを立てる
          await prisma.slpMember.update({
            where: { id: existingMember.id },
            data: { resubmitted: true, formSubmittedAt: new Date() },
          });

          return NextResponse.json({
            success: true,
            type: "remind_expired",
            sentDate: existingMember.contractSentDate?.toISOString() || null,
            email: existingMember.email,
          });
        }

        // リマインド可能期間内
        return NextResponse.json({
          success: true,
          type: "already_sent",
          sentDate: existingMember.contractSentDate?.toISOString() || null,
          email: existingMember.email,
          documentId: existingMember.documentId,
          canRemind: isRemindable(existingMember.contractSentDate),
        });
      }

      // (C) 契約書未送付 or 契約破棄 → 情報更新して新規送付
      // fall through to new registration logic below
    }

    // =============================================
    // 新規メンバー or 未送付/破棄 → 登録＋契約書送付
    // =============================================
    const now = new Date();

    // 自動送付設定を確認
    const slpProjectSettings = await prisma.masterProject.findFirst({
      where: { code: "slp" },
      select: { autoSendContract: true },
    });
    const autoSendEnabled = slpProjectSettings?.autoSendContract ?? true;

    // CloudSign で契約書を送付（slpMemberIdは既存メンバーの場合のみ）
    let documentId: string | null = null;
    let cloudsignUrl: string | null = null;
    let contractId: number | null = null;
    let newStatus = "契約書未送付";
    let contractSentDate: Date | null = null;

    const existingMemberId = existingMember && !existingMember.deletedAt ? existingMember.id : null;

    if (autoSendEnabled) {
      try {
        const result = await sendSlpContract({
          email: data.email,
          name: data.name,
          slpMemberId: existingMemberId ?? undefined,
        });
        documentId = result.documentId;
        cloudsignUrl = result.cloudsignUrl;
        contractId = result.contractId;
        newStatus = "契約書送付済";
        contractSentDate = now;
      } catch (error) {
        console.error("CloudSign send error:", error);
        await logAutomationError({
          source: "public/slp/member-registration",
          message: `契約書送付失敗: ${data.name}`,
          detail: {
            retryAction: "cloudsign-send",
            uid: data.uid,
            name: data.name,
            email: data.email,
            error: String(error),
          },
        });
        // 送付失敗しても登録は行う。ステータスを「送付エラー」にしてOS側で検知可能に
        newStatus = "送付エラー";
      }
    }
    // autoSend OFF: newStatus = "契約書未送付" のまま

    if (existingMemberId) {
      // 既存メンバー更新（未送付/破棄からの再登録）
      await prisma.slpMember.update({
        where: { id: existingMemberId },
        data: {
          name: data.name,
          email: data.email,
          memberCategory: data.memberCategory,
          lineName: data.lineName,
          position: data.position,
          phone: data.phone,
          company: data.company,
          address: data.address,
          memo: data.note || null,
          referrerUid,
          status: newStatus,
          contractSentDate,
          documentId,
          cloudsignUrl,
          formSubmittedAt: now,
          reminderCount: 0,
          lastReminderSentAt: null,
          resubmitted: false,
          cloudsignBounced: false,
          cloudsignBouncedAt: null,
          cloudsignBouncedEmail: null,
        },
      });
    } else {
      // 新規作成
      const watermarkCode = await generateWatermarkCode();
      const newMember = await prisma.slpMember.create({
        data: {
          name: data.name,
          email: data.email,
          status: newStatus,
          memberCategory: data.memberCategory,
          lineName: data.lineName,
          uid: data.uid,
          position: data.position,
          phone: data.phone,
          company: data.company,
          address: data.address,
          memo: data.note || null,
          referrerUid,
          documentId,
          cloudsignUrl,
          contractSentDate,
          formSubmittedAt: now,
          watermarkCode,
        },
      });

      // 新規作成時: MasterContractにslpMemberIdを紐付け
      if (contractId) {
        await prisma.masterContract.update({
          where: { id: contractId },
          data: { slpMemberId: newMember.id },
        });
      }
    }

    // ProLineフォーム送信（fire-and-forget、CloudSign成否に関わらず送信）
    submitProlineForm(data.uid, {
      memberCategory: data.memberCategory,
      name: data.name,
      position: data.position,
      email: data.email,
      phone: data.phone,
      company: data.company,
      address: data.address,
      note: data.note,
    }).catch(async (err) => {
      console.error("ProLine form submit error:", err);
      await logAutomationError({
        source: "proline-form-submit",
        message: `プロラインフォーム送信失敗: ${data.name}`,
        detail: {
          retryAction: "proline-form-submit",
          uid: data.uid,
          memberCategory: data.memberCategory,
          name: data.name,
          position: data.position,
          email: data.email,
          phone: data.phone,
          company: data.company,
          address: data.address,
          note: data.note,
        },
      });
    });

    if (newStatus === "契約書送付済") {
      return NextResponse.json({
        success: true,
        type: "success",
        email: data.email,
        sentDate: now.toISOString(),
      });
    } else {
      // 送付エラー: ユーザーには「お待ちください」表示、OS側では「送付エラー」ステータスで検知
      return NextResponse.json({
        success: true,
        type: "send_error",
      });
    }
  } catch (error) {
    console.error("Member registration error:", error);

    // Prismaエラーを日本語メッセージに変換
    let userMessage = "組合員登録処理でエラーが発生しました";
    const errorStr = String(error);
    if (errorStr.includes("Foreign key constraint") && errorStr.includes("referrerUid")) {
      userMessage = "紹介者の情報が見つからなかったため、組合員の登録に失敗しました";
    } else if (errorStr.includes("Unique constraint")) {
      userMessage = "同じ情報で既に登録されています";
    }

    await logAutomationError({
      source: "slp-member-registration",
      message: userMessage,
      detail: {
        originalError: errorStr,
        hint: "組合員名簿を確認し、必要に応じて手動で登録してください。",
      },
    });
    return NextResponse.json(
      { success: false, type: "error", error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
