"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

// 定数: 顧客種別「企業」のID
const CUSTOMER_TYPE_COMPANY_ID = 1;

export async function addCompanyContact(data: Record<string, unknown>) {
  // companyIdを取得（StpCompanyのIDからMasterStellaCompanyのIDを取得）
  const stpCompanyId = data.stpCompanyId ? Number(data.stpCompanyId) : null;

  if (!stpCompanyId) {
    throw new Error("企業IDが必要です");
  }

  const stpCompany = await prisma.stpCompany.findUnique({
    where: { id: stpCompanyId },
    select: { companyId: true },
  });

  if (!stpCompany) {
    throw new Error("STP企業が見つかりません");
  }

  // 顧客種別ID（文字列配列を数値配列に変換、デフォルト: 企業）
  let customerTypeIds: number[] = [CUSTOMER_TYPE_COMPANY_ID];
  if (data.customerTypeIds) {
    const rawIds = data.customerTypeIds as (string | number)[];
    customerTypeIds = rawIds.map((id) => Number(id)).filter((id) => !isNaN(id));
  }

  if (customerTypeIds.length === 0) {
    throw new Error("プロジェクト（顧客種別）を少なくとも1つ選択してください");
  }

  await prisma.$transaction(async (tx) => {
    // assignedToの処理（配列の場合はカンマ区切り文字列に変換）
    let assignedTo: string | null = null;
    if (data.assignedTo) {
      if (Array.isArray(data.assignedTo)) {
        assignedTo = (data.assignedTo as string[]).join(",") || null;
      } else {
        assignedTo = (data.assignedTo as string) || null;
      }
    }

    // 接触履歴を作成
    const history = await tx.contactHistory.create({
      data: {
        companyId: stpCompany.companyId,
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

  revalidatePath("/stp/records/company-contacts");
  revalidatePath("/stp/companies");
  revalidatePath(`/companies/${stpCompany.companyId}`);
}

export async function updateCompanyContact(
  id: number,
  data: Record<string, unknown>
) {
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

  revalidatePath("/stp/records/company-contacts");
  revalidatePath("/stp/companies");
}

export async function deleteCompanyContact(id: number) {
  // 論理削除
  const history = await prisma.contactHistory.update({
    where: { id },
    data: {
      deletedAt: new Date(),
    },
  });
  revalidatePath("/stp/records/company-contacts");
  revalidatePath("/stp/companies");
  revalidatePath(`/companies/${history.companyId}`);
}
