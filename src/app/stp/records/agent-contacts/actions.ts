"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireEdit } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log/log";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { getCustomerTypeIdByCode } from "@/lib/customer-type";

// 顧客種別「代理店」のシステムコード
const CUSTOMER_TYPE_AGENT_CODE = "stp_agency";

export async function addAgentContact(data: Record<string, unknown>): Promise<ActionResult> {
 try {
  const user = await requireEdit("stp");
  // agentIdからcompanyIdを取得
  const agentId = data.agentId ? Number(data.agentId) : null;

  if (!agentId) {
    return err("代理店IDが必要です");
  }

  const agent = await prisma.stpAgent.findUnique({
    where: { id: agentId },
    select: { companyId: true },
  });

  if (!agent) {
    return err("代理店が見つかりません");
  }

  // 顧客種別ID（文字列配列を数値配列に変換、デフォルト: 代理店）
  const agentCustomerTypeId = await getCustomerTypeIdByCode(CUSTOMER_TYPE_AGENT_CODE);
  let customerTypeIds: number[] = [agentCustomerTypeId];
  if (data.customerTypeIds) {
    const rawIds = data.customerTypeIds as (string | number)[];
    customerTypeIds = rawIds.map((id) => Number(id)).filter((id) => !isNaN(id));
  }

  if (customerTypeIds.length === 0) {
    return err("プロジェクト（顧客種別）を少なくとも1つ選択してください");
  }

  // assignedToの処理（配列の場合はカンマ区切り文字列に変換）
  let assignedTo: string | null = null;
  if (data.assignedTo) {
    if (Array.isArray(data.assignedTo)) {
      assignedTo = (data.assignedTo as string[]).join(",") || null;
    } else {
      assignedTo = (data.assignedTo as string) || null;
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    // 接触履歴を作成
    const history = await tx.contactHistory.create({
      data: {
        companyId: agent.companyId,
        contactDate: new Date(data.contactDate as string),
        contactMethodId: data.contactMethodId
          ? Number(data.contactMethodId)
          : null,
        assignedTo,
        customerParticipants: (data.customerParticipants as string) || null,
        meetingMinutes: (data.meetingMinutes as string) || null,
        note: (data.note as string) || null,
      },
    });

    // 顧客種別との紐付けを作成
    await tx.contactHistoryRole.createMany({
      data: customerTypeIds.map((customerTypeId) => ({
        contactHistoryId: history.id,
        customerTypeId,
      })),
    });

    return history;
  });

  await logActivity({ model: "ContactHistory", recordId: result.id, action: "create", summary: `代理店接触履歴を作成（${data.contactDate as string}）`, userId: user.id });
  revalidatePath("/stp/records/agent-contacts");
  revalidatePath("/stp/agents");
  revalidatePath(`/companies/${agent.companyId}`);
  return ok();
 } catch (e) {
  console.error("[addAgentContact] error:", e);
  return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
 }
}

export async function updateAgentContact(
  id: number,
  data: Record<string, unknown>
): Promise<ActionResult> {
 try {
  const user = await requireEdit("stp");
  // 顧客種別IDが指定されている場合（文字列配列を数値配列に変換）
  let customerTypeIds: number[] | undefined;
  if (data.customerTypeIds) {
    const rawIds = data.customerTypeIds as (string | number)[];
    customerTypeIds = rawIds.map((id) => Number(id)).filter((id) => !isNaN(id));
  }

  // assignedToの処理（配列の場合はカンマ区切り文字列に変換）
  let assignedTo: string | null = null;
  if (data.assignedTo) {
    if (Array.isArray(data.assignedTo)) {
      assignedTo = (data.assignedTo as string[]).join(",") || null;
    } else {
      assignedTo = (data.assignedTo as string) || null;
    }
  }

  await prisma.$transaction(async (tx) => {
    // 接触履歴を更新
    const history = await tx.contactHistory.update({
      where: { id },
      data: {
        contactDate: new Date(data.contactDate as string),
        contactMethodId: data.contactMethodId
          ? Number(data.contactMethodId)
          : null,
        assignedTo,
        customerParticipants: (data.customerParticipants as string) || null,
        meetingMinutes: (data.meetingMinutes as string) || null,
        note: (data.note as string) || null,
      },
    });

    // 顧客種別IDが指定されている場合、ロールを更新
    if (customerTypeIds) {
      // 既存のロールを削除
      await tx.contactHistoryRole.deleteMany({
        where: { contactHistoryId: id },
      });

      // 新しいロールを作成
      if (customerTypeIds.length > 0) {
        await tx.contactHistoryRole.createMany({
          data: customerTypeIds.map((customerTypeId) => ({
            contactHistoryId: id,
            customerTypeId,
          })),
        });
      }
    }

    revalidatePath(`/companies/${history.companyId}`);
  });

  await logActivity({ model: "ContactHistory", recordId: id, action: "update", summary: `代理店接触履歴を更新（${data.contactDate as string}）`, userId: user.id });
  revalidatePath("/stp/records/agent-contacts");
  revalidatePath("/stp/agents");
  return ok();
 } catch (e) {
  console.error("[updateAgentContact] error:", e);
  return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
 }
}

export async function deleteAgentContact(id: number): Promise<ActionResult> {
 try {
  const user = await requireEdit("stp");
  // 論理削除
  const history = await prisma.contactHistory.update({
    where: { id },
    data: {
      deletedAt: new Date(),
    },
  });
  await logActivity({ model: "ContactHistory", recordId: id, action: "delete", summary: "代理店接触履歴を削除", userId: user.id });
  revalidatePath("/stp/records/agent-contacts");
  revalidatePath("/stp/agents");
  revalidatePath(`/companies/${history.companyId}`);
  return ok();
 } catch (e) {
  console.error("[deleteAgentContact] error:", e);
  return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
 }
}
