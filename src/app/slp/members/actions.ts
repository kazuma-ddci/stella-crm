"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { sendSlpContract, sendSlpRemind } from "@/lib/slp-cloudsign";
import { sendReferralNotification } from "@/lib/slp/slp-referral-notification";
import { cloudsignClient } from "@/lib/cloudsign";
import { syncContractStatus as doSyncContractStatus } from "@/lib/cloudsign-sync";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";
import { triggerLinkBeaconForStaff } from "@/lib/slp-link-recovery";

export async function addMember(data: Record<string, unknown>): Promise<ActionResult> {
  // 認証: SLPプロジェクトの編集権限以上
  // 注: getSession() の redirect を伝播させるため try/catch の外で呼ぶ
  await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);
  try {
    const uid = String(data.uid ?? "").trim();
    if (!uid) return err("UIDは必須です");

    const existing = await prisma.slpMember.findUnique({ where: { uid } });
    if (existing) return err(`UID「${uid}」は既に使用されています`);

    await prisma.slpMember.create({
      data: {
        name: String(data.name ?? "").trim(),
        email: data.email ? String(data.email).trim() : null,
        status: data.status ? String(data.status) : null,
        contractSentDate: data.contractSentDate ? new Date(String(data.contractSentDate)) : null,
        contractSignedDate: data.contractSignedDate ? new Date(String(data.contractSignedDate)) : null,
        position: data.position ? String(data.position).trim() : null,
        company: data.company ? String(data.company).trim() : null,
        memberCategory: data.memberCategory ? String(data.memberCategory) : null,
        lineName: data.lineName ? String(data.lineName).trim() : null,
        uid,
        phone: data.phone ? String(data.phone).trim() : null,
        address: data.address ? String(data.address).trim() : null,
        referrerUid: data.referrerUid ? String(data.referrerUid) : null,
        note: data.note ? String(data.note).trim() : null,
        memo: data.memo ? String(data.memo).trim() : null,
        documentId: data.documentId ? String(data.documentId).trim() : null,
        cloudsignUrl: data.cloudsignUrl ? String(data.cloudsignUrl).trim() : null,
        reminderCount: data.reminderCount ? Number(data.reminderCount) : 0,
      },
    });

    revalidatePath("/slp/members");
    return ok();
  } catch (e) {
    console.error("[addMember] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function updateMember(id: number, data: Record<string, unknown>): Promise<ActionResult> {
  await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);
  try {
    const current = await prisma.slpMember.findUnique({
      where: { id },
      select: { uid: true, status: true },
    });
    if (!current) return err("組合員が見つかりません");

    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = String(data.name).trim();
    if (data.email !== undefined) updateData.email = data.email ? String(data.email).trim() : null;
    if (data.status !== undefined) updateData.status = data.status ? String(data.status) : null;
    if (data.contractSentDate !== undefined) updateData.contractSentDate = data.contractSentDate ? new Date(String(data.contractSentDate)) : null;
    if (data.contractSignedDate !== undefined) updateData.contractSignedDate = data.contractSignedDate ? new Date(String(data.contractSignedDate)) : null;
    if (data.position !== undefined) updateData.position = data.position ? String(data.position).trim() : null;
    if (data.company !== undefined) updateData.company = data.company ? String(data.company).trim() : null;
    if (data.memberCategory !== undefined) updateData.memberCategory = data.memberCategory ? String(data.memberCategory) : null;
    if (data.lineName !== undefined) updateData.lineName = data.lineName ? String(data.lineName).trim() : null;
    if (data.phone !== undefined) updateData.phone = data.phone ? String(data.phone).trim() : null;
    if (data.address !== undefined) updateData.address = data.address ? String(data.address).trim() : null;
    if (data.referrerUid !== undefined) updateData.referrerUid = data.referrerUid ? String(data.referrerUid) : null;
    if (data.note !== undefined) updateData.note = data.note ? String(data.note).trim() : null;
    if (data.memo !== undefined) updateData.memo = data.memo ? String(data.memo).trim() : null;
    if (data.documentId !== undefined) updateData.documentId = data.documentId ? String(data.documentId).trim() : null;
    if (data.cloudsignUrl !== undefined) updateData.cloudsignUrl = data.cloudsignUrl ? String(data.cloudsignUrl).trim() : null;
    if (data.reminderCount !== undefined) updateData.reminderCount = Number(data.reminderCount);

    // uid変更時は重複チェック
    if (data.uid !== undefined) {
      const newUid = String(data.uid).trim();
      if (current.uid !== newUid) {
        const existing = await prisma.slpMember.findUnique({ where: { uid: newUid } });
        if (existing) return err(`UID「${newUid}」は既に使用されています`);
        updateData.uid = newUid;
      }
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.slpMember.update({ where: { id }, data: updateData });
    }

    const uidChanged = updateData.uid !== undefined && updateData.uid !== current.uid;
    const statusChanged =
      updateData.status !== undefined && updateData.status !== current.status;
    if (uidChanged || statusChanged) {
      await triggerLinkBeaconForStaff({ memberId: id, uidChanged });
    }

    revalidatePath("/slp/members");
    return ok();
  } catch (e) {
    console.error("[updateMember] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function deleteMember(id: number): Promise<ActionResult> {
  await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);
  try {
    await prisma.slpMember.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    revalidatePath("/slp/members");
    return ok();
  } catch (e) {
    console.error("[deleteMember] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

/**
 * CloudSignで新規契約書を送付（組合員名簿から手動送付）
 * MasterContractを作成し、SlpMemberの旧カラムも後方互換で更新
 */
export async function sendContractToMember(id: number): Promise<ActionResult> {
  await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);
  try {
    const member = await prisma.slpMember.findUnique({ where: { id } });
    if (!member) return err("メンバーが見つかりません");
    if (!member.email) return err("メールアドレスが登録されていません");
    if (member.status === "組合員契約書締結") return err("この組合員は契約締結済みです");

    const result = await sendSlpContract({
      email: member.email,
      name: member.name,
      slpMemberId: id,
    });

    // 後方互換: SlpMemberの旧カラムも更新
    await prisma.slpMember.update({
      where: { id },
      data: {
        documentId: result.documentId,
        cloudsignUrl: result.cloudsignUrl,
        contractSentDate: new Date(),
        status: "契約書送付済",
        reminderCount: 0,
        lastReminderSentAt: null,
      },
    });

    revalidatePath("/slp/members");
    revalidatePath("/slp/contracts");
    return ok();
  } catch (e) {
    console.error("[sendContractToMember] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

/**
 * CloudSignリマインドを送付（組合員名簿の再送付ボタンから）
 * MasterContract経由でリマインドし、旧カラムも更新
 * 同時に Form15 (組合員向け契約書通知統合フォーム) 経由で
 * テンプレベースの公式LINEリマインドメッセージも送信する（fire-and-forget）
 */
export async function remindMember(id: number): Promise<ActionResult> {
  await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);
  try {
    const member = await prisma.slpMember.findUnique({ where: { id } });
    if (!member) return err("メンバーが見つかりません");
    if (member.status !== "契約書送付済") return err("リマインド対象のステータスではありません");

    // MasterContractから最新の送付済み契約を取得
    const contract = await prisma.masterContract.findFirst({
      where: {
        slpMemberId: id,
        cloudsignStatus: "sent",
        cloudsignDocumentId: { not: null },
      },
      orderBy: { createdAt: "desc" },
    });

    if (contract) {
      await sendSlpRemind(contract.id);
    } else if (member.documentId) {
      // フォールバック: 旧カラムのdocumentIdを使用（移行前データ対応）
      const { sendSlpRemindLegacy } = await import("@/lib/slp-cloudsign-legacy");
      await sendSlpRemindLegacy(member.documentId);
    } else {
      return err("契約書のドキュメントIDがありません");
    }

    // 後方互換: SlpMemberの旧カラムも更新
    await prisma.slpMember.update({
      where: { id },
      data: {
        reminderCount: member.reminderCount + 1,
        lastReminderSentAt: new Date(),
      },
    });

    // 契約書リマインド通知を公式LINEで送信（Form15統合・テンプレベース）fire-and-forget
    if (member.uid && member.email) {
      const sentDateSrc = member.contractSentDate ?? contract?.cloudsignSentAt ?? null;
      const sentDate = sentDateSrc
        ? (() => {
            const jst = new Date(sentDateSrc.getTime() + 9 * 60 * 60 * 1000);
            return `${jst.getUTCFullYear()}年${jst.getUTCMonth() + 1}月${jst.getUTCDate()}日`;
          })()
        : "";
      const { sendMemberNotification } = await import(
        "@/lib/slp/slp-member-notification"
      );
      const { logAutomationError } = await import("@/lib/automation-error");
      sendMemberNotification({
        trigger: "contract_reminder",
        memberUid: member.uid,
        context: {
          memberName: member.name,
          contractSentDate: sentDate,
          contractSentEmail: member.email,
        },
      })
        .then(async (r) => {
          if (!r.ok) {
            await logAutomationError({
              source: "members/remind/contract_reminder",
              message: `契約書リマインドLINE送信失敗: ${member.name} (uid=${member.uid})`,
              detail: {
                memberId: member.id,
                uid: member.uid,
                sentDate,
                email: member.email,
                errorMessage: r.errorMessage,
                retryAction: "contract-reminder",
              },
            });
          }
        })
        .catch(async (e2) => {
          await logAutomationError({
            source: "members/remind/contract_reminder",
            message: `契約書リマインドLINE呼び出し失敗: ${member.name} (uid=${member.uid})`,
            detail: {
              memberId: member.id,
              uid: member.uid,
              sentDate,
              email: member.email,
              error: e2 instanceof Error ? e2.message : String(e2),
              retryAction: "contract-reminder",
            },
          });
        });
    }

    revalidatePath("/slp/members");
    revalidatePath("/slp/contracts");
    return ok();
  } catch (e) {
    console.error("[remindMember] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

/**
 * 契約締結通知を紹介者に手動送信（Form18経由・テンプレベース）
 * 送信成功時に form5NotifiedReferrerUid に現在のfree1を保存し、
 * 「現在の紹介者に通知済み」状態にする
 */
export async function sendForm5Notification(id: number): Promise<ActionResult> {
  await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);
  try {
    const member = await prisma.slpMember.findUnique({ where: { id } });
    if (!member) return err("メンバーが見つかりません");

    const lineFriend = await prisma.slpLineFriend.findUnique({
      where: { uid: member.uid },
      select: { free1: true },
    });
    const referrerUid = lineFriend?.free1;
    if (!referrerUid) return err("紹介者UIDが見つかりません");

    const r = await sendReferralNotification({
      trigger: "contract_signed",
      referrerUid,
      context: {
        memberName: member.name,
        memberLineName: member.lineName ?? undefined,
      },
      relatedCompanyRecordId: null,
    });
    if (!r.ok) {
      return err(r.errorMessage ?? "契約締結通知の送信に失敗しました");
    }
    if (r.skipped) {
      return err("テンプレートが無効化されているため送信されませんでした");
    }

    await prisma.slpMember.update({
      where: { id },
      data: {
        form5NotifyCount: { increment: 1 },
        form5NotifiedReferrerUid: referrerUid,
      },
    });

    revalidatePath("/slp/members");
    return ok();
  } catch (e) {
    console.error("[sendForm5Notification] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

/**
 * 紹介者通知を「送信不要」と判断して黄色表示を消す
 * 現在の紹介者UID（free1）を form5NotifySkippedReferrerUid に保存する。
 * 紹介者が変わったら自動的に再度未通知判定になる。
 */
export async function skipForm5Notification(id: number): Promise<ActionResult> {
  await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);
  try {
    const member = await prisma.slpMember.findUnique({ where: { id } });
    if (!member) return err("メンバーが見つかりません");

    const lineFriend = await prisma.slpLineFriend.findUnique({
      where: { uid: member.uid },
      select: { free1: true },
    });
    const referrerUid = lineFriend?.free1;
    if (!referrerUid) return err("紹介者UIDが見つかりません");

    await prisma.slpMember.update({
      where: { id },
      data: { form5NotifySkippedReferrerUid: referrerUid },
    });

    revalidatePath("/slp/members");
    return ok();
  } catch (e) {
    console.error("[skipForm5Notification] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

/**
 * 紐付けモーダル用: LINE友だち候補一覧を取得（id降順、検索付き、上限50件）
 */
export async function searchLineFriendsForLink(
  query: string
): Promise<ActionResult<{ id: number; uid: string; snsname: string | null }[]>> {
  await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);
  try {
    const trimmed = query.trim();
    const friends = await prisma.slpLineFriend.findMany({
      where: {
        deletedAt: null,
        ...(trimmed
          ? {
              OR: [
                { snsname: { contains: trimmed, mode: "insensitive" } },
                { uid: { contains: trimmed, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: { id: true, uid: true, snsname: true },
      orderBy: { id: "desc" },
      take: 50,
    });
    return ok(friends);
  } catch (e) {
    console.error("[searchLineFriendsForLink] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

/**
 * 組合員のLINE紐付けを修正
 * 選択した友だちの uid と snsname で SlpMember を上書き
 */
export async function relinkMemberLineFriend(
  memberId: number,
  newUid: string
): Promise<ActionResult> {
  await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);
  try {
    const current = await prisma.slpMember.findUnique({
      where: { id: memberId },
      select: { uid: true },
    });
    if (!current) return err("組合員が見つかりません");

    const friend = await prisma.slpLineFriend.findUnique({
      where: { uid: newUid },
      select: { uid: true, snsname: true },
    });
    if (!friend) return err("選択されたLINE友達が見つかりません");

    // 同じUIDを別の組合員が既に使っている場合は重複エラー
    const conflicting = await prisma.slpMember.findUnique({
      where: { uid: newUid },
      select: { id: true },
    });
    if (conflicting && conflicting.id !== memberId) {
      return err(`UID「${newUid}」は既に別の組合員に紐付けられています`);
    }

    const uidChanged = current.uid !== newUid;

    await prisma.slpMember.update({
      where: { id: memberId },
      data: {
        uid: friend.uid,
        lineName: friend.snsname,
      },
    });

    if (uidChanged) {
      await triggerLinkBeaconForStaff({ memberId, uidChanged: true });
    }

    revalidatePath("/slp/members");
    return ok();
  } catch (e) {
    console.error("[relinkMemberLineFriend] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

/**
 * resubmittedフラグをクリア（通知を確認済みにする）
 */
export async function clearResubmitted(id: number): Promise<ActionResult> {
  await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);
  try {
    await prisma.slpMember.update({
      where: { id },
      data: { resubmitted: false },
    });

    revalidatePath("/slp/members");
    return ok();
  } catch (e) {
    console.error("[clearResubmitted] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

/**
 * 選択されたメンバーに一括で契約書を送付
 */
export async function bulkSendContracts(memberIds: number[]): Promise<{
  total: number;
  succeeded: number;
  failed: number;
  results: { id: number; name: string; success: boolean; error?: string }[];
}> {
  // 認証: SLPプロジェクトの編集権限以上
  await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);

  const members = await prisma.slpMember.findMany({
    where: {
      id: { in: memberIds },
      deletedAt: null,
    },
  });

  const results: { id: number; name: string; success: boolean; error?: string }[] = [];

  for (const member of members) {
    if (!member.email) {
      results.push({ id: member.id, name: member.name, success: false, error: "メールアドレスなし" });
      continue;
    }
    if (member.status === "組合員契約書締結") {
      results.push({ id: member.id, name: member.name, success: false, error: "契約締結済み" });
      continue;
    }

    try {
      const result = await sendSlpContract({
        email: member.email,
        name: member.name,
        slpMemberId: member.id,
      });

      await prisma.slpMember.update({
        where: { id: member.id },
        data: {
          documentId: result.documentId,
          cloudsignUrl: result.cloudsignUrl,
          contractSentDate: new Date(),
          status: "契約書送付済",
          reminderCount: 0,
          lastReminderSentAt: null,
        },
      });

      results.push({ id: member.id, name: member.name, success: true });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "不明なエラー";
      results.push({ id: member.id, name: member.name, success: false, error: errorMsg });
    }
  }

  revalidatePath("/slp/members");
  revalidatePath("/slp/contracts");

  const succeeded = results.filter((r) => r.success).length;
  return { total: results.length, succeeded, failed: results.length - succeeded, results };
}

/**
 * CloudSignステータス一斉同期（SLPプロジェクトの全契約書対象）
 * 条件: cloudsignDocumentId IS NOT NULL AND cloudsignAutoSync = true
 * 既に完了/取消済みは再確認不要のためスキップ
 */
export async function batchSyncCloudsignStatus(): Promise<{
  total: number;
  synced: number;
  unchanged: number;
  errors: number;
  details: Array<{
    contractId: number;
    memberName: string | null;
    previousStatus: string | null;
    newStatus: string | null;
    error?: string;
  }>;
}> {
  await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);

  // SLPプロジェクトID取得
  const slpProject = await prisma.masterProject.findFirst({
    where: { code: "slp" },
    select: { id: true, operatingCompany: { select: { cloudsignClientId: true } } },
  });
  if (!slpProject?.operatingCompany?.cloudsignClientId) {
    throw new Error("SLPプロジェクトの運営法人にCloudSign APIキーが設定されていません");
  }

  // 対象契約書を取得
  const contracts = await prisma.masterContract.findMany({
    where: {
      projectId: slpProject.id,
      cloudsignDocumentId: { not: null },
      cloudsignAutoSync: true,
      // 完了/取消済みはスキップ
      cloudsignStatus: { notIn: ["completed", "canceled_by_sender", "canceled_by_recipient"] },
    },
    select: {
      id: true,
      currentStatusId: true,
      cloudsignStatus: true,
      cloudsignDocumentId: true,
      slpMember: { select: { name: true } },
    },
  });

  if (contracts.length === 0) {
    return { total: 0, synced: 0, unchanged: 0, errors: 0, details: [] };
  }

  // トークン取得（SLP用は1つで良い）
  const token = await cloudsignClient.getToken(slpProject.operatingCompany.cloudsignClientId);

  const details: Array<{
    contractId: number;
    memberName: string | null;
    previousStatus: string | null;
    newStatus: string | null;
    error?: string;
  }> = [];
  let synced = 0;
  let unchanged = 0;
  let errors = 0;

  // CloudSign APIステータスマッピング
  function mapStatus(apiStatus: number, doc?: { participants?: { status?: number; order?: number }[] }): string | null {
    switch (apiStatus) {
      case 0: return "draft";
      case 1: return "sent";
      case 2: return "completed";
      case 3: {
        if (doc?.participants?.some((p) => p.order !== undefined && p.order >= 1 && p.status === 9)) {
          return "canceled_by_recipient";
        }
        return "canceled_by_sender";
      }
      default: return null;
    }
  }

  for (const contract of contracts) {
    const docId = contract.cloudsignDocumentId!;
    try {
      const doc = await cloudsignClient.getDocument(token, docId);
      const mappedStatus = mapStatus(doc.status, doc);

      if (!mappedStatus || mappedStatus === contract.cloudsignStatus) {
        unchanged++;
        details.push({
          contractId: contract.id,
          memberName: contract.slpMember?.name ?? null,
          previousStatus: contract.cloudsignStatus,
          newStatus: contract.cloudsignStatus,
        });
        continue;
      }

      // ステータス更新
      await doSyncContractStatus(
        {
          id: contract.id,
          currentStatusId: contract.currentStatusId,
          cloudsignStatus: contract.cloudsignStatus,
          cloudsignTitle: null,
          cloudsignDocumentId: contract.cloudsignDocumentId,
        },
        slpProject.operatingCompany.cloudsignClientId,
        mappedStatus,
        "batch-sync"
      );

      synced++;
      details.push({
        contractId: contract.id,
        memberName: contract.slpMember?.name ?? null,
        previousStatus: contract.cloudsignStatus,
        newStatus: mappedStatus,
      });
    } catch (e) {
      errors++;
      details.push({
        contractId: contract.id,
        memberName: contract.slpMember?.name ?? null,
        previousStatus: contract.cloudsignStatus,
        newStatus: null,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  revalidatePath("/slp/members");
  revalidatePath("/slp/contracts");

  return { total: contracts.length, synced, unchanged, errors, details };
}
