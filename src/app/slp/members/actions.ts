"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { sendSlpContract, sendSlpRemind } from "@/lib/slp-cloudsign";
import { submitForm5ContractNotification } from "@/lib/proline-form";

export async function addMember(data: Record<string, unknown>) {
  const uid = String(data.uid ?? "").trim();
  if (!uid) throw new Error("UIDは必須です");

  const existing = await prisma.slpMember.findUnique({ where: { uid } });
  if (existing) throw new Error(`UID「${uid}」は既に使用されています`);

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
}

export async function updateMember(id: number, data: Record<string, unknown>) {
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
    const current = await prisma.slpMember.findUnique({ where: { id } });
    if (current && current.uid !== newUid) {
      const existing = await prisma.slpMember.findUnique({ where: { uid: newUid } });
      if (existing) throw new Error(`UID「${newUid}」は既に使用されています`);
      updateData.uid = newUid;
    }
  }

  if (Object.keys(updateData).length > 0) {
    await prisma.slpMember.update({ where: { id }, data: updateData });
  }

  revalidatePath("/slp/members");
}

export async function deleteMember(id: number) {
  await prisma.slpMember.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/slp/members");
}

/**
 * CloudSignで新規契約書を送付（組合員名簿から手動送付）
 * MasterContractを作成し、SlpMemberの旧カラムも後方互換で更新
 */
export async function sendContractToMember(id: number) {
  const member = await prisma.slpMember.findUnique({ where: { id } });
  if (!member) throw new Error("メンバーが見つかりません");
  if (!member.email) throw new Error("メールアドレスが登録されていません");
  if (member.status === "組合員契約書締結") throw new Error("この組合員は契約締結済みです");

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
}

/**
 * CloudSignリマインドを送付（組合員名簿の再送付ボタンから）
 * MasterContract経由でリマインドし、旧カラムも更新
 */
export async function remindMember(id: number) {
  const member = await prisma.slpMember.findUnique({ where: { id } });
  if (!member) throw new Error("メンバーが見つかりません");
  if (member.status !== "契約書送付済") throw new Error("リマインド対象のステータスではありません");

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
    throw new Error("契約書のドキュメントIDがありません");
  }

  // 後方互換: SlpMemberの旧カラムも更新
  await prisma.slpMember.update({
    where: { id },
    data: {
      reminderCount: member.reminderCount + 1,
      lastReminderSentAt: new Date(),
    },
  });

  revalidatePath("/slp/members");
  revalidatePath("/slp/contracts");
}

/**
 * Form5: 紹介者に契約締結通知を手動送信
 */
export async function sendForm5Notification(id: number) {
  const member = await prisma.slpMember.findUnique({ where: { id } });
  if (!member) throw new Error("メンバーが見つかりません");

  const lineFriend = await prisma.slpLineFriend.findUnique({
    where: { uid: member.uid },
    select: { free1: true },
  });
  const referrerUid = lineFriend?.free1;
  if (!referrerUid) throw new Error("紹介者UIDが見つかりません");

  await submitForm5ContractNotification(
    referrerUid,
    member.lineName || "",
    member.name
  );

  await prisma.slpMember.update({
    where: { id },
    data: { form5NotifyCount: { increment: 1 } },
  });

  revalidatePath("/slp/members");
}

/**
 * resubmittedフラグをクリア（通知を確認済みにする）
 */
export async function clearResubmitted(id: number) {
  await prisma.slpMember.update({
    where: { id },
    data: { resubmitted: false },
  });

  revalidatePath("/slp/members");
}
