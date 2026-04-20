import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendSlpRemind } from "@/lib/slp-cloudsign";
import { logAutomationError } from "@/lib/automation-error";
import { sendMemberNotification } from "@/lib/slp/slp-member-notification";
import { verifyCronAuth } from "@/lib/cron-auth";

/** 日付を「2026年4月1日」形式でフォーマット */
function formatJpDate(date: Date | null | undefined): string {
  if (!date) return "";
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = jst.getUTCMonth() + 1;
  const d = jst.getUTCDate();
  return `${y}年${m}月${d}日`;
}

/**
 * GET /api/cron/remind-slp-members
 *
 * 自動リマインド: 契約書送付からN日経過した未締結メンバーにリマインドを送る
 * - MasterContract経由で対象を抽出
 * - 対象: cloudsignStatus="sent" & 送付日からN日経過 & 未リマインド & 除外されていない
 * - 1回のみ自動リマインド
 *
 * VPSのcrontabで毎日10時に実行:
 * 0 10 * * * curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:4001/api/cron/remind-slp-members
 */

export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  try {
    // リマインド日数をプロジェクト設定から取得
    const slpProject = await prisma.masterProject.findFirst({
      where: { code: "slp" },
      select: { id: true, reminderDays: true },
    });
    if (!slpProject) {
      return NextResponse.json({ error: "SLPプロジェクトが見つかりません" }, { status: 500 });
    }
    const reminderDays = slpProject.reminderDays;

    const now = new Date();
    const nDaysAgo = new Date(now.getTime() - reminderDays * 24 * 60 * 60 * 1000);
    const nPlusOneDaysAgo = new Date(now.getTime() - (reminderDays + 1) * 24 * 60 * 60 * 1000);

    // MasterContract経由で対象を抽出
    const targets = await prisma.masterContract.findMany({
      where: {
        projectId: slpProject.id,
        cloudsignStatus: "sent",
        cloudsignDocumentId: { not: null },
        cloudsignLastRemindedAt: null, // 未リマインド
        cloudsignSentAt: {
          gte: nPlusOneDaysAgo,
          lte: nDaysAgo,
        },
        // 紐づくSlpMemberが除外されていない、かつ不達・ロック状態でないこと
        // （不達/ロック中のメンバーにリマインドを送っても届かない → 220円の無駄）
        slpMember: {
          reminderExcluded: false,
          deletedAt: null,
          cloudsignBounced: false,
          formLocked: false,
          autoSendLocked: false,
        },
      },
      include: {
        slpMember: {
          select: {
            id: true,
            name: true,
            uid: true,
            email: true,
            contractSentDate: true,
            reminderCount: true,
          },
        },
      },
    });

    const results: { id: number; name: string; success: boolean; error?: string }[] = [];

    for (const contract of targets) {
      const memberName = contract.slpMember?.name ?? `Contract#${contract.id}`;
      try {
        await sendSlpRemind(contract.id);

        // 後方互換: SlpMemberの旧カラムも更新
        if (contract.slpMember) {
          await prisma.slpMember.update({
            where: { id: contract.slpMember.id },
            data: {
              reminderCount: (contract.slpMember.reminderCount ?? 0) + 1,
              lastReminderSentAt: now,
            },
          });
        }

        // 契約書リマインド通知を公式LINEで送信（Form15統合・テンプレベース）fire-and-forget
        const memberInfo = contract.slpMember;
        if (memberInfo?.uid && memberInfo?.email) {
          const sentDate = formatJpDate(
            memberInfo.contractSentDate ?? contract.cloudsignSentAt
          );
          sendMemberNotification({
            trigger: "contract_reminder",
            memberUid: memberInfo.uid,
            context: {
              memberName: memberInfo.name,
              contractSentDate: sentDate,
              contractSentEmail: memberInfo.email,
            },
          })
            .then(async (r) => {
              if (!r.ok) {
                await logAutomationError({
                  source: "cron/remind-slp-members/contract_reminder",
                  message: `契約書リマインドLINE送信失敗: ${memberName} (uid=${memberInfo.uid})`,
                  detail: {
                    memberId: memberInfo.id,
                    uid: memberInfo.uid,
                    sentDate,
                    email: memberInfo.email,
                    errorMessage: r.errorMessage,
                    retryAction: "contract-reminder",
                  },
                });
              }
            })
            .catch(async (err) => {
              await logAutomationError({
                source: "cron/remind-slp-members/contract_reminder",
                message: `契約書リマインドLINE呼び出し失敗: ${memberName} (uid=${memberInfo.uid})`,
                detail: {
                  memberId: memberInfo.id,
                  uid: memberInfo.uid,
                  sentDate,
                  email: memberInfo.email,
                  error: err instanceof Error ? err.message : String(err),
                  retryAction: "contract-reminder",
                },
              });
            });
        }

        results.push({ id: contract.id, name: memberName, success: true });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "不明なエラー";
        results.push({ id: contract.id, name: memberName, success: false, error: errorMsg });
        await logAutomationError({
          source: "cron/remind-slp-members",
          message: `リマインド送付失敗: ${memberName} (ContractID=${contract.id})`,
          detail: { contractId: contract.id, name: memberName, error: errorMsg },
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    console.log(
      `[SLP Auto Remind] 対象: ${targets.length}件, 成功: ${successCount}件, 失敗: ${failCount}件`
    );

    return NextResponse.json({
      success: true,
      total: targets.length,
      succeeded: successCount,
      failed: failCount,
      results,
    });
  } catch (error) {
    console.error("[SLP Auto Remind] Error:", error);
    await logAutomationError({
      source: "cron/remind-slp-members",
      message: error instanceof Error ? error.message : "不明なエラー",
      detail: { error: String(error) },
    });
    return NextResponse.json(
      { success: false, error: "内部エラーが発生しました" },
      { status: 500 }
    );
  }
}
