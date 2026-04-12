"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";
import {
  sendSlpContract,
  declineSlpContract,
  resolveRelatedAutomationErrors,
  recordContractAttempt,
} from "@/lib/slp-cloudsign";

// ============================================
// 1. getContractAttempts — 送付履歴一覧取得
// ============================================

export async function getContractAttempts(memberId: number) {
  await requireStaffWithProjectPermission([{ project: "slp", level: "view" }]);

  const attempts = await prisma.slpContractAttempt.findMany({
    where: { slpMemberId: memberId },
    orderBy: { sequence: "desc" },
  });

  return attempts.map((a) => ({
    id: a.id,
    email: a.email,
    documentId: a.documentId,
    cloudsignUrl: a.cloudsignUrl,
    sendResult: a.sendResult,
    cloudsignStatus: a.cloudsignStatus,
    triggerType: a.triggerType,
    sequence: a.sequence,
    manualCheckResult: a.manualCheckResult,
    declinedAt: a.declinedAt?.toISOString() ?? null,
    declinedBy: a.declinedBy,
    declineError: a.declineError,
    createdAt: a.createdAt.toISOString(),
  }));
}

// ============================================
// 2. declineContractAttempt — 契約書を破棄
// ============================================

export async function declineContractAttempt(
  attemptId: number
): Promise<ActionResult> {
  const staff = await requireStaffWithProjectPermission([
    { project: "slp", level: "edit" },
  ]);

  try {
    // 1. 送付履歴を取得
    const attempt = await prisma.slpContractAttempt.findUnique({
      where: { id: attemptId },
    });
    if (!attempt) return err("送付履歴が見つかりません");

    // 2. documentIdがあればCloudSign上で破棄
    if (attempt.documentId) {
      try {
        await declineSlpContract(attempt.documentId);
      } catch (e) {
        const declineError =
          e instanceof Error ? e.message : "CloudSign破棄APIエラー";
        console.error(
          `[declineContractAttempt] CloudSign decline failed for documentId=${attempt.documentId}:`,
          e
        );
        // API破棄失敗 → エラーだけ記録し、cloudsignStatusは変更しない
        await prisma.slpContractAttempt.update({
          where: { id: attemptId },
          data: {
            declineError,
          },
        });
        revalidatePath("/slp/members");
        return err(`破棄APIがエラーになりました。クラウドサインにログインして手動で破棄してください。\n${declineError}`);
      }
    }

    // 3. 破棄成功 → SlpContractAttemptを更新
    await prisma.slpContractAttempt.update({
      where: { id: attemptId },
      data: {
        declinedAt: new Date(),
        declinedBy: staff.name,
        cloudsignStatus: "canceled",
      },
    });

    // 4. 対応するMasterContractも更新
    if (attempt.documentId) {
      await prisma.masterContract.updateMany({
        where: { cloudsignDocumentId: attempt.documentId },
        data: { cloudsignStatus: "canceled_by_sender" },
      });
    }

    revalidatePath("/slp/members");
    return ok();
  } catch (e) {
    console.error("[declineContractAttempt] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ============================================
// 3. manualSendContract — スタッフ手動契約書送付
// ============================================

export async function manualSendContract(
  memberId: number,
  email: string
): Promise<ActionResult<{ documentId: string; cloudsignUrl: string }>> {
  await requireStaffWithProjectPermission([
    { project: "slp", level: "edit" },
  ]);

  try {
    // 組合員情報を取得
    const member = await prisma.slpMember.findUnique({
      where: { id: memberId },
      select: { id: true, name: true, uid: true },
    });
    if (!member) return err("組合員が見つかりません");

    // 1. CloudSign契約書を送付
    let sendResult: Awaited<ReturnType<typeof sendSlpContract>>;
    try {
      sendResult = await sendSlpContract({
        email,
        name: member.name,
        slpMemberId: member.id,
      });
    } catch (e) {
      // API エラー時も送付履歴に記録
      await recordContractAttempt({
        slpMemberId: member.id,
        email,
        sendResult: "api_error",
        triggerType: "staff_manual",
      });

      console.error("[manualSendContract] sendSlpContract failed:", e);
      return err(
        e instanceof Error ? e.message : "契約書の送付に失敗しました"
      );
    }

    // 2. 送付履歴に記録
    await recordContractAttempt({
      slpMemberId: member.id,
      email,
      documentId: sendResult.documentId,
      cloudsignUrl: sendResult.cloudsignUrl,
      sendResult: "delivered",
      cloudsignStatus: "pending",
      triggerType: "staff_manual",
    });

    // 3. SlpMemberを更新（フロー制御フラグもリセット）
    // スタッフ手動送付は「仕切り直し」として全フラグをリセット
    await prisma.slpMember.update({
      where: { id: member.id },
      data: {
        email,
        documentId: sendResult.documentId,
        cloudsignUrl: sendResult.cloudsignUrl,
        status: "契約書送付済",
        contractSentDate: new Date(),
        cloudsignBounced: false,
        cloudsignBouncedAt: null,
        cloudsignBouncedEmail: null,
        bounceConfirmedAt: null,
        bounceFixUsed: false,
        emailChangeUsed: false,
        formLocked: false,
        autoSendLocked: false,
        reminderCount: 0,
        lastReminderSentAt: null,
      },
    });

    // 4. 関連するエラーを解決済みにする
    await resolveRelatedAutomationErrors(member.uid, member.name);

    revalidatePath("/slp/members");
    return ok({
      documentId: sendResult.documentId,
      cloudsignUrl: sendResult.cloudsignUrl,
    });
  } catch (e) {
    console.error("[manualSendContract] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ============================================
// 4. saveManualCheckResult — APIエラー時の手動確認結果保存
// ============================================

export async function saveManualCheckResult(
  attemptId: number,
  result: { checkResult: string; documentId?: string }
): Promise<ActionResult> {
  const staff = await requireStaffWithProjectPermission([
    { project: "slp", level: "edit" },
  ]);

  try {
    const attempt = await prisma.slpContractAttempt.findUnique({
      where: { id: attemptId },
    });
    if (!attempt) return err("送付履歴が見つかりません");

    // 1. SlpContractAttemptを更新
    const updateData: Record<string, unknown> = {
      manualCheckResult: result.checkResult,
      manualCheckAt: new Date(),
      manualCheckBy: staff.name,
    };
    if (result.documentId) {
      updateData.documentId = result.documentId;
    }

    await prisma.slpContractAttempt.update({
      where: { id: attemptId },
      data: updateData,
    });

    // 2. "found_pending" の場合: SlpUnmatchedBounceにそのdocumentIdがないかチェック
    const docId = result.documentId ?? attempt.documentId;
    if (result.checkResult === "found_pending" && docId) {
      const unmatchedBounce = await prisma.slpUnmatchedBounce.findFirst({
        where: { documentId: docId, matched: false },
      });
      if (unmatchedBounce) {
        // バウンスが見つかった → sendResultを"bounced"に更新
        await prisma.slpContractAttempt.update({
          where: { id: attemptId },
          data: { sendResult: "bounced" },
        });
        // SlpUnmatchedBounceも照合済みにする
        await prisma.slpUnmatchedBounce.update({
          where: { id: unmatchedBounce.id },
          data: { matched: true, matchedAt: new Date() },
        });
      }
    }

    // 3. "found_completed" の場合: cloudsignStatusを"completed"に更新
    if (result.checkResult === "found_completed") {
      await prisma.slpContractAttempt.update({
        where: { id: attemptId },
        data: { cloudsignStatus: "completed" },
      });
    }

    revalidatePath("/slp/members");
    return ok();
  } catch (e) {
    console.error("[saveManualCheckResult] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ============================================
// 5. getMemberGuidanceStatus — スタッフ向けガイダンス情報
// ============================================

export async function getMemberGuidanceStatus(memberId: number) {
  await requireStaffWithProjectPermission([{ project: "slp", level: "view" }]);

  const member = await prisma.slpMember.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      name: true,
      email: true,
      uid: true,
      status: true,
      documentId: true,
      cloudsignBounced: true,
      bounceConfirmedAt: true,
      emailChangeUsed: true,
      formLocked: true,
      autoSendLocked: true,
    },
  });
  if (!member) {
    return null;
  }

  const attempts = await prisma.slpContractAttempt.findMany({
    where: { slpMemberId: memberId },
    orderBy: { sequence: "desc" },
  });

  // 過去に1回でも正常送信されたことがあるか
  // 既存データ（SlpContractAttempt履歴なし）の場合は、memberのstatusで判定
  const hasEverDelivered =
    attempts.some((a) => a.sendResult === "delivered") ||
    (attempts.length === 0 &&
      (member.status === "契約書送付済" || member.status === "組合員契約書締結"));

  // 有効な契約書（delivered + pending）があるか（破棄されていないもの）
  const pendingAttempts = attempts.filter(
    (a) =>
      a.sendResult === "delivered" &&
      a.cloudsignStatus === "pending" &&
      !a.declinedAt
  );
  const hasPendingContract =
    pendingAttempts.length > 0 ||
    // 既存データフォールバック: 履歴なし かつ member.status === 契約書送付済 かつ documentIdあり
    (attempts.length === 0 &&
      member.status === "契約書送付済" &&
      !!member.documentId);
  const hasParallelContracts = pendingAttempts.length >= 2;

  // 未破棄の送信失敗契約書があるか
  const hasUndeclinedFailure = attempts.some(
    (a) =>
      (a.sendResult === "bounced" || a.sendResult === "api_error") &&
      !a.declinedAt &&
      a.documentId
  );

  // 未対応のAPIエラーがあるか
  const hasPendingApiError = attempts.some(
    (a) =>
      a.sendResult === "api_error" &&
      !a.manualCheckResult &&
      !a.declinedAt
  );

  // 過去に送信失敗したメアドリスト（重複除外）
  const failedEmails = [
    ...new Set(
      attempts
        .filter(
          (a) => a.sendResult === "bounced" || a.sendResult === "api_error"
        )
        .map((a) => a.email)
    ),
  ];

  // overallStatus を決定（モーダル側のGUIDANCE_CONFIGのキーと一致させる）
  let overallStatus: string;
  if (member.status === "組合員契約書締結") {
    overallStatus = "completed";
  } else if (member.formLocked && member.emailChangeUsed) {
    // メアド変更後の失敗で完全ロック
    overallStatus = "email_change_failed";
  } else if (member.autoSendLocked) {
    overallStatus = "auto_send_locked";
  } else if (member.cloudsignBounced && member.bounceConfirmedAt) {
    overallStatus = "bounce_confirmed";
  } else if (member.cloudsignBounced) {
    overallStatus = "bounced";
  } else if (hasPendingApiError) {
    overallStatus = "api_error";
  } else if (hasParallelContracts) {
    overallStatus = "parallel_contracts";
  } else if (hasPendingContract) {
    overallStatus = "delivered_pending";
  } else {
    // 有効な契約書なし
    overallStatus = "no_valid_contract";
  }

  return {
    memberId: member.id,
    memberName: member.name,
    memberEmail: member.email,
    memberUid: member.uid,
    overallStatus,
    hasEverDelivered,
    hasPendingContract,
    hasUndeclinedFailure,
    failedEmails,
  };
}
