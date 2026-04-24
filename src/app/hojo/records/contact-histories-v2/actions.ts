"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";
import { ok, err, type ActionResult } from "@/lib/action-result";

/**
 * HOJO 新接触履歴 (V2) の CRUD サーバーアクション。
 * プロジェクトスコープ: hojo (edit権限以上)。
 * SLP版 src/app/slp/records/contact-histories-v2/actions.ts のHOJO派生。
 */

// 入力型は 3 プロジェクト共通 (@/lib/contact-history-v2/input-types で一元管理)
import type {
  ContactHistoryV2Input,
  CustomerParticipantInput,
} from "@/lib/contact-history-v2/input-types";

async function resolveHojoProjectId(): Promise<number> {
  const hojo = await prisma.masterProject.findFirst({
    where: { code: "hojo" },
    select: { id: true },
  });
  if (!hojo) throw new Error("HOJOプロジェクトが見つかりません");
  return hojo.id;
}

function validateInput(input: ContactHistoryV2Input): string | null {
  if (!input.scheduledStartAt) return "予定開始日時は必須です";
  if (!input.status) return "ステータスは必須です";
  if (!["scheduled", "completed", "cancelled", "rescheduled"].includes(input.status)) {
    return "不正なステータス値です";
  }
  if (!input.customers || input.customers.length === 0) {
    return "顧客を1件以上設定してください";
  }
  for (const c of input.customers) {
    if (!c.targetType) return "顧客種別は必須です";
  }
  return null;
}


/**
 * 接触履歴の status から会議の state を導出する。
 * status を変更したときに会議 state を連動させるためのマッピング。
 *
 *   scheduled / rescheduled → "予定"
 *   completed               → "完了"
 *   cancelled               → "完了" (API呼ばず、マークのみ)
 *
 * 注: 会議 state のうち "取得中" / "失敗" は API/webhook が制御する値なので
 *     この関数では扱わない。呼び出し側で「既存 state が取得中/失敗なら上書き
 *     しない」判定を別途行う。
 */
function deriveMeetingState(contactStatus: string): string {
  switch (contactStatus) {
    case "completed":
      return "完了";
    case "cancelled":
      return "完了";
    case "rescheduled":
    case "scheduled":
    default:
      return "予定";
  }
}

/** API駆動で上書き禁止の会議 state */
const API_DRIVEN_MEETING_STATES = ["取得中", "失敗"];

/**
 * 会議のURL / ホスト状態から apiIntegrationStatus を計算する。
 * Phase 4 で staff_zoom_auth / staff_google_auth が導入されたら、そこで
 * ホストの連携状態もチェックする。現状は URL の有無のみで判定。
 */
function computeApiIntegrationStatus(
  provider: string,
  joinUrl: string | null | undefined,
): string {
  if (provider === "other") return "not_applicable";
  if (!joinUrl) return "no_url_yet";
  // staff_zoom_auth / staff_google_auth 未実装のため暫定で available
  return "available";
}

/**
 * customers 配列から CustomerParticipant の create ペイロード配列を構築。
 * 1件目を isPrimary=true、以降は false。各顧客にぶら下げる attendees も組み立てる。
 */
function buildCustomerParticipantsCreateData(
  customers: CustomerParticipantInput[],
) {
  return customers.map((c, idx) => ({
    targetType: c.targetType,
    targetId: c.targetId ?? null,
    isPrimary: idx === 0,
    displayOrder: idx,
    attendees:
      c.attendees && c.attendees.length > 0
        ? {
            create: c.attendees.map((a, aIdx) => ({
              name: a.name.slice(0, 100),
              title: a.title?.slice(0, 100) ?? null,
              sourceType: "manual",
              savedToMaster: false,
              displayOrder: aIdx,
            })),
          }
        : undefined,
  }));
}

export async function createContactHistoryV2(
  input: ContactHistoryV2Input,
): Promise<ActionResult<{ id: number }>> {
  const session = await requireStaffWithProjectPermission([
    { project: "hojo", level: "edit" },
  ]);

  const validationError = validateInput(input);
  if (validationError) return err(validationError);

  try {
    const projectId = await resolveHojoProjectId();
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
          create: buildCustomerParticipantsCreateData(input.customers),
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
        meetings:
          input.meetings && input.meetings.length > 0
            ? {
                create: input.meetings.map((m, idx) => ({
                  provider: m.provider,
                  isPrimary: idx === 0,
                  label: m.label ?? null,
                  displayOrder: idx,
                  joinUrl: m.joinUrl ?? null,
                  startUrl: m.startUrl ?? null,
                  passcode: m.passcode ?? null,
                  hostStaffId: m.hostStaffId ?? null,
                  urlSource: m.joinUrl ? "manual_entry" : "empty",
                  urlSetAt: m.joinUrl ? new Date() : null,
                  apiIntegrationStatus: computeApiIntegrationStatus(
                    m.provider,
                    m.joinUrl,
                  ),
                  scheduledStartAt: m.scheduledStartAt
                    ? new Date(m.scheduledStartAt)
                    : null,
                  scheduledEndAt: m.scheduledEndAt
                    ? new Date(m.scheduledEndAt)
                    : null,
                  state: deriveMeetingState(status),
                })),
              }
            : undefined,
        files:
          input.files && input.files.length > 0
            ? {
                create: input.files.map((f) => ({
                  filePath: f.filePath ?? null,
                  fileName: f.fileName,
                  fileSize: f.fileSize ?? null,
                  mimeType: f.mimeType ?? null,
                  url: f.url ?? null,
                  uploadedByStaffId: session.id,
                })),
              }
            : undefined,
      },
      select: { id: true },
    });

    revalidatePath("/hojo/records/contact-histories-v2");
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
    { project: "hojo", level: "edit" },
  ]);

  const validationError = validateInput(input);
  if (validationError) return err(validationError);

  const projectId = await resolveHojoProjectId();

  // 存在確認 + プロジェクトチェック
  const existing = await prisma.contactHistoryV2.findFirst({
    where: { id, projectId, deletedAt: null },
    select: { id: true, status: true },
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

      // 接触履歴の status が変わったら、既存の会議 state を連動させる
      // (API駆動の "取得中" / "失敗" は上書きしない)
      if (existing.status !== status) {
        const newMeetingState = deriveMeetingState(status);
        await tx.contactHistoryMeeting.updateMany({
          where: {
            contactHistoryId: id,
            deletedAt: null,
            state: { notIn: API_DRIVEN_MEETING_STATES },
          },
          data: { state: newMeetingState },
        });
      }

      // 顧客エンティティ + 先方参加者: 全削除→再作成
      // (参加者はカスケード削除される)
      await tx.contactCustomerParticipant.deleteMany({
        where: { contactHistoryId: id },
      });
      for (const [idx, c] of input.customers.entries()) {
        await tx.contactCustomerParticipant.create({
          data: {
            contactHistoryId: id,
            targetType: c.targetType,
            targetId: c.targetId ?? null,
            isPrimary: idx === 0,
            displayOrder: idx,
            attendees:
              c.attendees && c.attendees.length > 0
                ? {
                    create: c.attendees.map((a, aIdx) => ({
                      name: a.name.slice(0, 100),
                      title: a.title?.slice(0, 100) ?? null,
                      sourceType: "manual",
                      savedToMaster: false,
                      displayOrder: aIdx,
                    })),
                  }
                : undefined,
          },
        });
      }

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

      // ファイル: id を持つ既存は保持、id がない新規は追加、既存で input に無いものは削除
      const inputFiles = input.files ?? [];
      const keepFileIds = new Set(
        inputFiles.filter((f) => f.id !== undefined).map((f) => f.id!),
      );
      // 削除: 既存にあるが input に無い
      await tx.contactHistoryFileV2.deleteMany({
        where: {
          contactHistoryId: id,
          id: keepFileIds.size > 0 ? { notIn: Array.from(keepFileIds) } : undefined,
        },
      });
      // 新規追加: id がない
      const newFiles = inputFiles.filter((f) => !f.id);
      if (newFiles.length > 0) {
        await tx.contactHistoryFileV2.createMany({
          data: newFiles.map((f) => ({
            contactHistoryId: id,
            filePath: f.filePath ?? null,
            fileName: f.fileName,
            fileSize: f.fileSize ?? null,
            mimeType: f.mimeType ?? null,
            url: f.url ?? null,
            uploadedByStaffId: session.id,
          })),
        });
      }

      // 会議: 新規追加のみ対応 (id 未指定のもの)
      // 既存会議の編集・削除は別UIで扱う (録画/議事録データが cascade 削除されるリスク回避)
      const newMeetings = (input.meetings ?? []).filter((m) => !m.id);
      if (newMeetings.length > 0) {
        const existing = await tx.contactHistoryMeeting.findMany({
          where: { contactHistoryId: id, deletedAt: null },
          select: { displayOrder: true, isPrimary: true },
        });
        const maxOrder = existing.length > 0
          ? Math.max(...existing.map((e) => e.displayOrder))
          : -1;
        const hasPrimary = existing.some((e) => e.isPrimary);

        for (const [idx, m] of newMeetings.entries()) {
          await tx.contactHistoryMeeting.create({
            data: {
              contactHistoryId: id,
              provider: m.provider,
              isPrimary: !hasPrimary && idx === 0,
              label: m.label ?? null,
              displayOrder: maxOrder + 1 + idx,
              joinUrl: m.joinUrl ?? null,
              startUrl: m.startUrl ?? null,
              passcode: m.passcode ?? null,
              hostStaffId: m.hostStaffId ?? null,
              urlSource: m.joinUrl ? "manual_entry" : "empty",
              urlSetAt: m.joinUrl ? new Date() : null,
              apiIntegrationStatus: computeApiIntegrationStatus(
                m.provider,
                m.joinUrl,
              ),
              scheduledStartAt: m.scheduledStartAt
                ? new Date(m.scheduledStartAt)
                : null,
              scheduledEndAt: m.scheduledEndAt
                ? new Date(m.scheduledEndAt)
                : null,
              state: deriveMeetingState(status),
            },
          });
        }
      }
    });

    revalidatePath("/hojo/records/contact-histories-v2");
    revalidatePath(`/hojo/records/contact-histories-v2/${id}`);
    return ok({ id });
  } catch (e) {
    console.error("updateContactHistoryV2 failed:", e);
    return err(e instanceof Error ? e.message : "更新に失敗しました");
  }
}

export async function deleteContactHistoryV2(
  id: number,
): Promise<ActionResult<{ id: number }>> {
  await requireStaffWithProjectPermission([{ project: "hojo", level: "edit" }]);

  const projectId = await resolveHojoProjectId();
  const existing = await prisma.contactHistoryV2.findFirst({
    where: { id, projectId, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!existing) return err("対象の接触履歴が見つかりません");

  try {
    await prisma.contactHistoryV2.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    revalidatePath("/hojo/records/contact-histories-v2");
    return ok({ id });
  } catch (e) {
    console.error("deleteContactHistoryV2 failed:", e);
    return err(e instanceof Error ? e.message : "削除に失敗しました");
  }
}

