"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireEdit } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log/log";
import { ok, err, type ActionResult } from "@/lib/action-result";

// 定数: 顧客種別「企業」のID
const CUSTOMER_TYPE_COMPANY_ID = 1;

export async function addCompanyContact(data: Record<string, unknown>): Promise<ActionResult> {
 try {
  const user = await requireEdit("stp");
  // companyIdを取得（StpCompanyのIDからMasterStellaCompanyのIDを取得）
  const stpCompanyId = data.stpCompanyId ? Number(data.stpCompanyId) : null;

  if (!stpCompanyId) {
    return err("企業IDが必要です");
  }

  const stpCompany = await prisma.stpCompany.findUnique({
    where: { id: stpCompanyId },
    select: { companyId: true },
  });

  if (!stpCompany) {
    return err("STP企業が見つかりません");
  }

  // 顧客種別ID（文字列配列を数値配列に変換、デフォルト: 企業）
  let customerTypeIds: number[] = [CUSTOMER_TYPE_COMPANY_ID];
  if (data.customerTypeIds) {
    const rawIds = data.customerTypeIds as (string | number)[];
    customerTypeIds = rawIds.map((id) => Number(id)).filter((id) => !isNaN(id));
  }

  if (customerTypeIds.length === 0) {
    return err("プロジェクト（顧客種別）を少なくとも1つ選択してください");
  }

  const result = await prisma.$transaction(async (tx) => {
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

    return history;
  });

  await logActivity({ model: "ContactHistory", recordId: result.id, action: "create", summary: `企業接触履歴を作成（${data.contactDate as string}）`, userId: user.id });
  revalidatePath("/stp/records/company-contacts");
  revalidatePath("/stp/companies");
  revalidatePath(`/companies/${stpCompany.companyId}`);
  return ok();
 } catch (e) {
  console.error("[addCompanyContact] error:", e);
  return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
 }
}

export async function updateCompanyContact(
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

  await logActivity({ model: "ContactHistory", recordId: id, action: "update", summary: `企業接触履歴を更新（${data.contactDate as string}）`, userId: user.id });
  revalidatePath("/stp/records/company-contacts");
  revalidatePath("/stp/companies");
  return ok();
 } catch (e) {
  console.error("[updateCompanyContact] error:", e);
  return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
 }
}

export async function deleteCompanyContact(id: number): Promise<ActionResult> {
 try {
  const user = await requireEdit("stp");
  // 論理削除
  const history = await prisma.contactHistory.update({
    where: { id },
    data: {
      deletedAt: new Date(),
    },
  });
  await logActivity({ model: "ContactHistory", recordId: id, action: "delete", summary: "企業接触履歴を削除", userId: user.id });
  revalidatePath("/stp/records/company-contacts");
  revalidatePath("/stp/companies");
  revalidatePath(`/companies/${history.companyId}`);
  return ok();
 } catch (e) {
  console.error("[deleteCompanyContact] error:", e);
  return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
 }
}
