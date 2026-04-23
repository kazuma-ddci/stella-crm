"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";
import { ok, err, type ActionResult } from "@/lib/action-result";
import type { Prisma } from "@prisma/client";

/**
 * SLP 新接触履歴 (V2) の CRUD サーバーアクション。
 * プロジェクトスコープ: slp (edit権限以上)。
 */

export type ContactHistoryV2Input = {
  title?: string | null;
  status: string; // "scheduled" | "completed" | "cancelled" | "rescheduled"
  scheduledStartAt: string; // ISO 文字列
  scheduledEndAt?: string | null;
  contactMethodId?: number | null;
  contactCategoryId?: number | null;
  meetingMinutes?: string | null;
  note?: string | null;
  // 顧客側（単一エンティティ構成、複数はPhase2以降）
  targetType: string; // targetType 値
  targetId?: number | null;
  // 弊社スタッフ（ホスト1名含む）
  staffIds: number[];
  hostStaffId?: number | null;
};

async function resolveSlpProjectId(): Promise<number> {
  const slp = await prisma.masterProject.findFirst({
    where: { code: "slp" },
    select: { id: true },
  });
  if (!slp) throw new Error("SLPプロジェクトが見つかりません");
  return slp.id;
}

function validateInput(input: ContactHistoryV2Input): string | null {
  if (!input.scheduledStartAt) return "予定開始日時は必須です";
  if (!input.status) return "ステータスは必須です";
  if (!["scheduled", "completed", "cancelled", "rescheduled"].includes(input.status)) {
    return "不正なステータス値です";
  }
  if (!input.targetType) return "顧客種別は必須です";
  return null;
}

export async function createContactHistoryV2(
  input: ContactHistoryV2Input,
): Promise<ActionResult<{ id: number }>> {
  const session = await requireStaffWithProjectPermission([
    { project: "slp", level: "edit" },
  ]);

  const validationError = validateInput(input);
  if (validationError) return err(validationError);

  try {
    const projectId = await resolveSlpProjectId();
    const scheduledStartAt = new Date(input.scheduledStartAt);
    const status = input.status;

    // スタッフ重複排除 + ホスト決定
    const uniqueStaffIds = Array.from(new Set(input.staffIds));
    const hostId =
      input.hostStaffId !== null &&
      input.hostStaffId !== undefined &&
      uniqueStaffIds.includes(input.hostStaffId)
        ? input.hostStaffId
        : null;

    const created = await prisma.contactHistoryV2.create({
      data: {
        projectId,
        status,
        title: input.title ?? null,
        scheduledStartAt,
        scheduledEndAt: input.scheduledEndAt ? new Date(input.scheduledEndAt) : null,
        actualStartAt: status === "completed" ? scheduledStartAt : null,
        displayTimezone: "Asia/Tokyo",
        contactMethodId: input.contactMethodId ?? null,
        contactCategoryId: input.contactCategoryId ?? null,
        meetingMinutes: input.meetingMinutes ?? null,
        note: input.note ?? null,
        sourceType: "manual",
        createdByStaffId: session.id,
        customerParticipants: {
          create: [
            {
              targetType: input.targetType,
              targetId: input.targetId ?? null,
              isPrimary: true,
              displayOrder: 0,
            },
          ],
        },
        staffParticipants:
          uniqueStaffIds.length > 0
            ? {
                create: uniqueStaffIds.map((staffId) => ({
                  staffId,
                  isHost: staffId === hostId,
                })),
              }
            : undefined,
      },
      select: { id: true },
    });

    revalidatePath("/slp/records/contact-histories-v2");
    return ok({ id: created.id });
  } catch (e) {
    console.error("createContactHistoryV2 failed:", e);
    return err(e instanceof Error ? e.message : "作成に失敗しました");
  }
}

export async function updateContactHistoryV2(
  id: number,
  input: ContactHistoryV2Input,
): Promise<ActionResult<{ id: number }>> {
  const session = await requireStaffWithProjectPermission([
    { project: "slp", level: "edit" },
  ]);

  const validationError = validateInput(input);
  if (validationError) return err(validationError);

  const projectId = await resolveSlpProjectId();

  // 存在確認 + プロジェクトチェック
  const existing = await prisma.contactHistoryV2.findFirst({
    where: { id, projectId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) return err("対象の接触履歴が見つかりません");

  try {
    const scheduledStartAt = new Date(input.scheduledStartAt);
    const status = input.status;
    const uniqueStaffIds = Array.from(new Set(input.staffIds));
    const hostId =
      input.hostStaffId !== null &&
      input.hostStaffId !== undefined &&
      uniqueStaffIds.includes(input.hostStaffId)
        ? input.hostStaffId
        : null;

    await prisma.$transaction(async (tx) => {
      // 本体更新
      await tx.contactHistoryV2.update({
        where: { id },
        data: {
          status,
          title: input.title ?? null,
          scheduledStartAt,
          scheduledEndAt: input.scheduledEndAt ? new Date(input.scheduledEndAt) : null,
          actualStartAt: status === "completed" ? scheduledStartAt : null,
          contactMethodId: input.contactMethodId ?? null,
          contactCategoryId: input.contactCategoryId ?? null,
          meetingMinutes: input.meetingMinutes ?? null,
          note: input.note ?? null,
          updatedByStaffId: session.id,
        },
      });

      // 顧客エンティティ: 単一構成の前提で全削除→再作成
      await tx.contactCustomerParticipant.deleteMany({
        where: { contactHistoryId: id },
      });
      await tx.contactCustomerParticipant.create({
        data: {
          contactHistoryId: id,
          targetType: input.targetType,
          targetId: input.targetId ?? null,
          isPrimary: true,
          displayOrder: 0,
        },
      });

      // スタッフ: 全削除→再作成
      await tx.contactStaffParticipant.deleteMany({
        where: { contactHistoryId: id },
      });
      if (uniqueStaffIds.length > 0) {
        await tx.contactStaffParticipant.createMany({
          data: uniqueStaffIds.map((staffId) => ({
            contactHistoryId: id,
            staffId,
            isHost: staffId === hostId,
          })),
        });
      }
    });

    revalidatePath("/slp/records/contact-histories-v2");
    revalidatePath(`/slp/records/contact-histories-v2/${id}`);
    return ok({ id });
  } catch (e) {
    console.error("updateContactHistoryV2 failed:", e);
    return err(e instanceof Error ? e.message : "更新に失敗しました");
  }
}

export async function deleteContactHistoryV2(
  id: number,
): Promise<ActionResult<{ id: number }>> {
  await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);

  const projectId = await resolveSlpProjectId();
  const existing = await prisma.contactHistoryV2.findFirst({
    where: { id, projectId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) return err("対象の接触履歴が見つかりません");

  try {
    await prisma.contactHistoryV2.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    revalidatePath("/slp/records/contact-histories-v2");
    return ok({ id });
  } catch (e) {
    console.error("deleteContactHistoryV2 failed:", e);
    return err(e instanceof Error ? e.message : "削除に失敗しました");
  }
}

// 型エクスポート（他ファイルで参照）
export type { Prisma };
