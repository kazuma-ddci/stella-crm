"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireEdit } from "@/lib/auth";

// 定数: 顧客種別「代理店」のID
const CUSTOMER_TYPE_AGENT_ID = 2;

export async function addAgentContact(data: Record<string, unknown>) {
  await requireEdit("stp");
  // agentIdからcompanyIdを取得
  const agentId = data.agentId ? Number(data.agentId) : null;

  if (!agentId) {
    throw new Error("代理店IDが必要です");
  }

  const agent = await prisma.stpAgent.findUnique({
    where: { id: agentId },
    select: { companyId: true },
  });

  if (!agent) {
    throw new Error("代理店が見つかりません");
  }

  // 顧客種別ID（文字列配列を数値配列に変換、デフォルト: 代理店）
  let customerTypeIds: number[] = [CUSTOMER_TYPE_AGENT_ID];
  if (data.customerTypeIds) {
    const rawIds = data.customerTypeIds as (string | number)[];
    customerTypeIds = rawIds.map((id) => Number(id)).filter((id) => !isNaN(id));
  }

  if (customerTypeIds.length === 0) {
    throw new Error("プロジェクト（顧客種別）を少なくとも1つ選択してください");
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
  });

  revalidatePath("/stp/records/agent-contacts");
  revalidatePath("/stp/agents");
  revalidatePath(`/companies/${agent.companyId}`);
}

export async function updateAgentContact(
  id: number,
  data: Record<string, unknown>
) {
  await requireEdit("stp");
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

  revalidatePath("/stp/records/agent-contacts");
  revalidatePath("/stp/agents");
}

export async function deleteAgentContact(id: number) {
  await requireEdit("stp");
  // 論理削除
  const history = await prisma.contactHistory.update({
    where: { id },
    data: {
      deletedAt: new Date(),
    },
  });
  revalidatePath("/stp/records/agent-contacts");
  revalidatePath("/stp/agents");
  revalidatePath(`/companies/${history.companyId}`);
}
