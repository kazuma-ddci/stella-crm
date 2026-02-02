"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

type ContactHistoryInput = {
  contactDate?: string;
  contactMethodId?: number | null;
  assignedTo?: string | null; // スタッフIDをカンマ区切りで保存
  customerParticipants?: string | null;
  meetingMinutes?: string | null;
  note?: string | null;
  customerTypeIds?: number[]; // 顧客種別ID配列
};

// 定数: 採用ブースト（STP）プロジェクトID
const STP_PROJECT_ID = 1;
// 定数: 顧客種別「代理店」のID
const CUSTOMER_TYPE_AGENT_ID = 2;

/**
 * STP代理店の接触履歴を追加
 * @param agentId - 代理店ID（StpAgent.id）
 * @param data - 接触履歴データ
 */
export async function addAgentContactHistory(
  agentId: number,
  data: ContactHistoryInput
) {
  // StpAgentからcompanyId（MasterStellaCompany.id）を取得
  const agent = await prisma.stpAgent.findUnique({
    where: { id: agentId },
    select: { companyId: true },
  });

  if (!agent) {
    throw new Error("代理店が見つかりません");
  }

  // 顧客種別IDのデフォルト値（代理店）
  const customerTypeIds = data.customerTypeIds?.length
    ? data.customerTypeIds
    : [CUSTOMER_TYPE_AGENT_ID];

  // トランザクションで接触履歴とロールを作成
  const result = await prisma.$transaction(async (tx) => {
    // 接触履歴を作成
    const history = await tx.contactHistory.create({
      data: {
        companyId: agent.companyId,
        contactDate: new Date(data.contactDate!),
        contactMethodId: data.contactMethodId || null,
        assignedTo: data.assignedTo || null,
        customerParticipants: data.customerParticipants || null,
        meetingMinutes: data.meetingMinutes || null,
        note: data.note || null,
      },
    });

    // 顧客種別との紐付けを作成
    await tx.contactHistoryRole.createMany({
      data: customerTypeIds.map((customerTypeId) => ({
        contactHistoryId: history.id,
        customerTypeId,
      })),
    });

    // 作成した履歴を取得（リレーション含む）
    return await tx.contactHistory.findUnique({
      where: { id: history.id },
      include: {
        contactMethod: true,
        roles: {
          include: {
            customerType: true,
          },
        },
      },
    });
  });

  revalidatePath("/stp/agents");
  revalidatePath("/stp/records/agent-contacts");
  revalidatePath(`/companies/${agent.companyId}`);

  return formatContactHistoryResponse(result!);
}

/**
 * STP代理店の接触履歴を更新
 * @param id - 接触履歴ID
 * @param data - 更新データ
 */
export async function updateAgentContactHistory(
  id: number,
  data: ContactHistoryInput
) {
  const result = await prisma.$transaction(async (tx) => {
    // 接触履歴を更新
    const history = await tx.contactHistory.update({
      where: { id },
      data: {
        contactDate: new Date(data.contactDate!),
        contactMethodId: data.contactMethodId || null,
        assignedTo: data.assignedTo || null,
        customerParticipants: data.customerParticipants || null,
        meetingMinutes: data.meetingMinutes || null,
        note: data.note || null,
      },
    });

    // 顧客種別IDが指定されている場合、ロールを更新
    if (data.customerTypeIds) {
      // 既存のロールを削除
      await tx.contactHistoryRole.deleteMany({
        where: { contactHistoryId: id },
      });

      // 新しいロールを作成
      if (data.customerTypeIds.length > 0) {
        await tx.contactHistoryRole.createMany({
          data: data.customerTypeIds.map((customerTypeId) => ({
            contactHistoryId: id,
            customerTypeId,
          })),
        });
      }
    }

    // 更新した履歴を取得（リレーション含む）
    return await tx.contactHistory.findUnique({
      where: { id: history.id },
      include: {
        contactMethod: true,
        roles: {
          include: {
            customerType: true,
          },
        },
      },
    });
  });

  revalidatePath("/stp/agents");
  revalidatePath("/stp/records/agent-contacts");
  if (result) {
    revalidatePath(`/companies/${result.companyId}`);
  }

  return formatContactHistoryResponse(result!);
}

/**
 * 特定の顧客種別ロールを削除
 * コンテキストが0件になった場合は本体も論理削除
 * @param contactHistoryId - 接触履歴ID
 * @param customerTypeId - 削除する顧客種別ID
 */
export async function deleteAgentContactHistoryRole(
  contactHistoryId: number,
  customerTypeId: number
) {
  await prisma.$transaction(async (tx) => {
    // 指定されたロールを削除
    await tx.contactHistoryRole.delete({
      where: {
        contactHistoryId_customerTypeId: {
          contactHistoryId,
          customerTypeId,
        },
      },
    });

    // 残りのロール数を確認
    const remainingRoles = await tx.contactHistoryRole.count({
      where: { contactHistoryId },
    });

    // コンテキストが0件になった場合は本体も論理削除
    if (remainingRoles === 0) {
      await tx.contactHistory.update({
        where: { id: contactHistoryId },
        data: { deletedAt: new Date() },
      });
    }
  });

  revalidatePath("/stp/agents");
  revalidatePath("/stp/records/agent-contacts");
}

/**
 * 接触履歴を完全に論理削除（全コンテキスト削除）
 * @param id - 接触履歴ID
 */
export async function deleteAgentContactHistory(id: number) {
  const history = await prisma.contactHistory.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/stp/agents");
  revalidatePath("/stp/records/agent-contacts");
  revalidatePath(`/companies/${history.companyId}`);
}

/**
 * STP代理店の接触履歴を取得（顧客種別「代理店」のコンテキストを持つもの）
 * @param companyId - MasterStellaCompanyのID（代理店の企業ID）
 */
export async function getAgentContactHistories(companyId: number) {
  const histories = await prisma.contactHistory.findMany({
    where: {
      companyId,
      deletedAt: null,
      roles: {
        some: {
          customerType: {
            projectId: STP_PROJECT_ID,
            name: "代理店",
          },
        },
      },
    },
    include: {
      contactMethod: true,
      roles: {
        include: {
          customerType: {
            include: {
              project: true,
            },
          },
        },
      },
    },
    orderBy: { contactDate: "desc" },
  });

  return histories.map(formatContactHistoryResponse);
}

/**
 * 顧客種別一覧を取得（STPプロジェクト）
 */
export async function getCustomerTypes() {
  return await prisma.customerType.findMany({
    where: {
      projectId: STP_PROJECT_ID,
      isActive: true,
    },
    orderBy: { displayOrder: "asc" },
  });
}

/**
 * レスポンス用にフォーマット
 */
function formatContactHistoryResponse(history: {
  id: number;
  companyId: number;
  contactDate: Date;
  contactMethodId: number | null;
  assignedTo: string | null;
  customerParticipants: string | null;
  meetingMinutes: string | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  contactMethod?: { id: number; name: string } | null;
  roles?: Array<{
    id: number;
    customerTypeId: number;
    customerType: {
      id: number;
      name: string;
      projectId: number;
      project?: { id: number; name: string };
    };
  }>;
}) {
  return {
    id: history.id,
    companyId: history.companyId,
    contactDate: history.contactDate.toISOString(),
    contactMethodId: history.contactMethodId,
    contactMethodName: history.contactMethod?.name || null,
    assignedTo: history.assignedTo,
    customerParticipants: history.customerParticipants,
    meetingMinutes: history.meetingMinutes,
    note: history.note,
    createdAt: history.createdAt.toISOString(),
    updatedAt: history.updatedAt.toISOString(),
    customerTypeIds: history.roles?.map((r) => r.customerTypeId) || [],
    customerTypes:
      history.roles?.map((r) => ({
        id: r.customerType.id,
        name: r.customerType.name,
        projectId: r.customerType.projectId,
        projectName: r.customerType.project?.name,
      })) || [],
  };
}
