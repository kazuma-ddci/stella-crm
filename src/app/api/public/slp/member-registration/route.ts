import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  sendSlpContract,
  sendSlpRemind,
  isRemindable,
  recordContractAttempt,
} from "@/lib/slp-cloudsign";
import { sendSlpRemindLegacy } from "@/lib/slp-cloudsign-legacy";
import { logAutomationError } from "@/lib/automation-error";
import { submitProlineForm } from "@/lib/proline-form";
import { generateWatermarkCode } from "@/lib/watermark";
import { sendMemberNotification } from "@/lib/slp/slp-member-notification";
import { formatJpDate } from "@/lib/date-format-jp";

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
 * - "already_sent"      : 契約書送付済み（自動リマインド試行後の状態を autoRemindSent / autoRemindError で返す）
 * - "email_changed"     : メールアドレス変更＋契約書再送付完了（並行方式）
 * - "email_diff"        : 異なるメールアドレスで送信された（変更確認を促す）
 * - "form_locked"       : フォームから完全に操作不可（公式LINE案内）
 * - "auto_send_locked"  : 自動送付ロック（希望メアド保存のみ可能）
 * - "bounce_confirmed"  : 「間違いない」確認済み（スタッフ確認中）
 * - "send_error"        : 送付エラー（お待ちください画面）
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

    // =============================================
    // 紹介者チェック（fixBounce時はスキップ：初回登録時に実行済み）
    // =============================================
    let referrerUid: string | null = null;
    if (!data.fixBounce && !data.confirmEmailChange) {
      const lineFriend = await prisma.slpLineFriend.findUnique({
        where: { uid: data.uid },
        select: { free1: true },
      });
      const rawReferrerUid = lineFriend?.free1 || null;

      if (rawReferrerUid) {
        const referrerMember = await prisma.slpMember.findUnique({
          where: { uid: rawReferrerUid },
          select: { uid: true, deletedAt: true },
        });
        if (referrerMember && !referrerMember.deletedAt) {
          referrerUid = rawReferrerUid;
        } else {
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

      // (B) フォーム完全ロック
      if (existingMember.formLocked) {
        return NextResponse.json({
          success: true,
          type: "form_locked",
        });
      }

      // (C) 自動送付ロック（希望メアド保存は別API）
      if (existingMember.autoSendLocked) {
        return NextResponse.json({
          success: true,
          type: "auto_send_locked",
          email: existingMember.email,
        });
      }

      // (D) 契約書送付済み
      if (status === "契約書送付済") {
        // ─── (D-0) メール不達修正 (fixBounce) ───
        if (existingMember.cloudsignBounced && data.fixBounce) {
          // bounceFixUsedチェック: 既に1回リトライ済みなら自動送付ロック
          if (existingMember.bounceFixUsed) {
            // ユーザーが入力した新しいメアドを希望メアドとして保存
            await prisma.slpMember.update({
              where: { id: existingMember.id },
              data: { autoSendLocked: true, email: data.email },
            });
            return NextResponse.json({
              success: true,
              type: "auto_send_locked",
              email: data.email,
            });
          }

          try {
            const result = await sendSlpContract({
              email: data.email,
              name: data.name,
              slpMemberId: existingMember.id,
            });

            // 送付履歴に記録
            await recordContractAttempt({
              slpMemberId: existingMember.id,
              email: data.email,
              documentId: result.documentId,
              cloudsignUrl: result.cloudsignUrl,
              sendResult: "delivered",
              cloudsignStatus: "pending",
              triggerType: "bounce_fix",
            });

            // メンバー情報を更新（bounceFixUsed = true, bounceConfirmedAtリセット）
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
                bounceConfirmedAt: null,
                bounceFixUsed: true,
                reminderCount: 0,
                lastReminderSentAt: null,
                formSubmittedAt: new Date(),
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

            // 送付履歴にエラー記録
            await recordContractAttempt({
              slpMemberId: existingMember.id,
              email: data.email,
              sendResult: "api_error",
              cloudsignStatus: "unknown",
              triggerType: "bounce_fix",
            });

            // bounceFixUsed = true, autoSendLocked = true
            await prisma.slpMember.update({
              where: { id: existingMember.id },
              data: {
                email: data.email, // メアドは更新（スタッフが希望メアドを確認できるように）
                bounceFixUsed: true,
                autoSendLocked: true,
                bounceConfirmedAt: null,
                status: "送付エラー",
                formSubmittedAt: new Date(),
              },
            });

            await logAutomationError({
              source: "slp-member-registration",
              message: `契約書再送付失敗（メール不達修正）: ${data.name}`,
              detail: {
                uid: data.uid,
                name: data.name,
                email: data.email,
                error: String(error),
                retryAction: "cloudsign-send",
              },
            });

            return NextResponse.json({
              success: true,
              type: "send_error",
            });
          }
        }

        // ─── (D-1) メールアドレス変更（並行方式） ───
        const emailDiffers =
          existingMember.email?.toLowerCase() !== data.email.toLowerCase();

        if (emailDiffers && !data.confirmEmailChange) {
          // emailChangeUsedチェック
          if (existingMember.emailChangeUsed) {
            return NextResponse.json({
              success: true,
              type: "form_locked",
            });
          }
          return NextResponse.json({
            success: true,
            type: "email_diff",
            currentEmail: existingMember.email,
            newEmail: data.email,
          });
        }

        if (emailDiffers && data.confirmEmailChange) {
          if (existingMember.emailChangeUsed) {
            return NextResponse.json({
              success: true,
              type: "form_locked",
            });
          }

          // 並行方式: 旧契約書は破棄せず、新メアドに新規送付
          try {
            const result = await sendSlpContract({
              email: data.email,
              name: data.name,
              slpMemberId: existingMember.id,
            });

            // 送付履歴に記録
            await recordContractAttempt({
              slpMemberId: existingMember.id,
              email: data.email,
              documentId: result.documentId,
              cloudsignUrl: result.cloudsignUrl,
              sendResult: "delivered",
              cloudsignStatus: "pending",
              triggerType: "email_change",
            });

            // メンバー更新（emailChangeUsed = true, 新しいドキュメント情報）
            await prisma.slpMember.update({
              where: { id: existingMember.id },
              data: {
                email: data.email,
                emailChangeUsed: true,
                documentId: result.documentId,
                cloudsignUrl: result.cloudsignUrl,
                contractSentDate: new Date(),
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

            // 送付履歴にエラー記録
            await recordContractAttempt({
              slpMemberId: existingMember.id,
              email: data.email,
              sendResult: "api_error",
              cloudsignStatus: "unknown",
              triggerType: "email_change",
            });

            // メアド変更失敗 → 完全ロック
            await prisma.slpMember.update({
              where: { id: existingMember.id },
              data: {
                emailChangeUsed: true,
                formLocked: true,
                formSubmittedAt: new Date(),
              },
            });

            await logAutomationError({
              source: "slp-member-registration",
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
              success: true,
              type: "form_locked",
            });
          }
        }

        // ─── (D-2) メールアドレス同じ → 自動リマインド試行 ───
        // フォーム送信時点で CloudSign リマインド + LINE 通知を発火させる。
        // 期限の有無に関わらず一律試行し、失敗時のみ手動リマインドボタンへフォールバック。
        let autoRemindSent = false;
        let autoRemindError = false;
        try {
          const remindContract = await prisma.masterContract.findFirst({
            where: {
              slpMemberId: existingMember.id,
              cloudsignStatus: "sent",
              cloudsignDocumentId: { not: null },
            },
            orderBy: { createdAt: "desc" },
          });

          if (remindContract) {
            await sendSlpRemind(remindContract.id);
          } else if (existingMember.documentId) {
            await sendSlpRemindLegacy(existingMember.documentId);
          } else {
            throw new Error("リマインド対象の CloudSign 書類が見つかりません");
          }

          await prisma.slpMember.update({
            where: { id: existingMember.id },
            data: {
              reminderCount: existingMember.reminderCount + 1,
              lastReminderSentAt: new Date(),
              formSubmittedAt: new Date(),
              resubmitted: true,
            },
          });

          // LINE 通知（fire-and-forget）— フォーム送信経由用テンプレ
          if (existingMember.uid && existingMember.email) {
            const sentDateJp = formatJpDate(existingMember.contractSentDate);
            sendMemberNotification({
              trigger: "contract_reminder_form_submitted",
              memberUid: existingMember.uid,
              context: {
                memberName: existingMember.name,
                contractSentDate: sentDateJp,
                contractSentEmail: existingMember.email,
              },
            })
              .then(async (r) => {
                if (!r.ok) {
                  await logAutomationError({
                    source: "slp-member-registration/contract_reminder_form_submitted",
                    message: `フォーム経由リマインドLINE送信失敗: ${existingMember.name}`,
                    detail: {
                      memberId: existingMember.id,
                      uid: existingMember.uid,
                      email: existingMember.email,
                      errorMessage: r.errorMessage,
                      retryAction: "contract-reminder",
                    },
                  });
                }
              })
              .catch(async (err) => {
                await logAutomationError({
                  source: "slp-member-registration/contract_reminder_form_submitted",
                  message: `フォーム経由リマインドLINE呼び出し失敗: ${existingMember.name}`,
                  detail: {
                    memberId: existingMember.id,
                    uid: existingMember.uid,
                    email: existingMember.email,
                    error: err instanceof Error ? err.message : String(err),
                    retryAction: "contract-reminder",
                  },
                });
              });
          }

          autoRemindSent = true;
        } catch (err) {
          autoRemindError = true;
          await logAutomationError({
            source: "slp-member-registration",
            message: `自動リマインド送信失敗: ${existingMember.name}`,
            detail: {
              uid: data.uid,
              memberId: existingMember.id,
              error: err instanceof Error ? err.message : String(err),
              retryAction: "cloudsign-remind",
            },
          });
          // 失敗時も formSubmittedAt は更新しておく（再送信痕跡として）
          await prisma.slpMember.update({
            where: { id: existingMember.id },
            data: { resubmitted: true, formSubmittedAt: new Date() },
          });
        }

        return NextResponse.json({
          success: true,
          type: "already_sent",
          sentDate: existingMember.contractSentDate?.toISOString() || null,
          email: existingMember.email,
          documentId: existingMember.documentId,
          // 自動リマインドが成功したら手動ボタンは出さない
          canRemind:
            !autoRemindSent &&
            isRemindable(existingMember.contractSentDate),
          emailChangeAvailable: !existingMember.emailChangeUsed,
          autoRemindSent,
          autoRemindError,
        });
      }

      // (E) 契約書未送付 or 契約破棄 or 送付エラー → 情報更新して新規送付
      // fall through to new registration logic below
    }

    // =============================================
    // 新規メンバー or 未送付/破棄/送付エラー → 登録＋契約書送付
    // =============================================
    const now = new Date();

    // 自動送付設定を確認
    const slpProjectSettings = await prisma.masterProject.findFirst({
      where: { code: "slp" },
      select: { autoSendContract: true },
    });
    const autoSendEnabled = slpProjectSettings?.autoSendContract ?? true;

    let documentId: string | null = null;
    let cloudsignUrl: string | null = null;
    let contractId: number | null = null;
    let newStatus = "契約書未送付";
    let contractSentDate: Date | null = null;
    let sendResult: "delivered" | "api_error" | null = null;

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
        sendResult = "delivered";
      } catch (error) {
        console.error("CloudSign send error:", error);
        await logAutomationError({
          source: "slp-member-registration",
          message: `契約書送付失敗: ${data.name}`,
          detail: {
            retryAction: "cloudsign-send",
            uid: data.uid,
            name: data.name,
            email: data.email,
            error: String(error),
          },
        });
        newStatus = "送付エラー";
        sendResult = "api_error";
      }
    }

    let memberId: number;

    if (existingMemberId) {
      // 既存メンバー更新（未送付/破棄/送付エラーからの再登録）
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
          // フロー制御リセット
          bounceConfirmedAt: null,
          bounceFixUsed: false,
          emailChangeUsed: false,
          formLocked: false,
          autoSendLocked: false,
        },
      });
      memberId = existingMemberId;
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
      memberId = newMember.id;

      // 新規作成時: MasterContractにslpMemberIdを紐付け
      if (contractId) {
        await prisma.masterContract.update({
          where: { id: contractId },
          data: { slpMemberId: newMember.id },
        });
      }
    }

    // 送付履歴に記録（送付を試みた場合のみ）
    if (sendResult) {
      await recordContractAttempt({
        slpMemberId: memberId,
        email: data.email,
        documentId,
        cloudsignUrl,
        sendResult,
        cloudsignStatus: sendResult === "delivered" ? "pending" : "unknown",
        triggerType: "initial",
      });
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
      return NextResponse.json({
        success: true,
        type: "send_error",
      });
    }
  } catch (error) {
    console.error("Member registration error:", error);

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
