"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProjectMasterDataEditPermission } from "@/lib/auth/master-data-permission";
import { ok, err, type ActionResult } from "@/lib/action-result";

function toDateOrNull(val: unknown): Date | null {
  if (!val) return null;
  const d = new Date(String(val));
  return isNaN(d.getTime()) ? null : d;
}

function toStringArray(val: unknown): string[] {
  if (Array.isArray(val)) {
    return val.map((v) => String(v).trim()).filter((v) => v.length > 0);
  }
  if (typeof val === "string" && val.trim()) {
    return [val.trim()];
  }
  return [];
}

function parseStaffIds(val: unknown): number[] {
  const raw = Array.isArray(val)
    ? val
    : typeof val === "string"
      ? val.split(",")
      : [];
  const ids = raw
    .map((v) => Number(String(v).trim()))
    .filter((v) => Number.isInteger(v) && v > 0);
  return [...new Set(ids)];
}

async function validateHojoActivityStaffIds(staffIds: number[]): Promise<number[]> {
  if (staffIds.length === 0) return [];
  const hojoProject = await prisma.masterProject.findFirst({
    where: { code: "hojo" },
    select: { id: true },
  });
  if (!hojoProject) {
    throw new Error("補助金プロジェクトが見つかりません");
  }
  const validStaff = await prisma.masterStaff.findMany({
    where: {
      id: { in: staffIds },
      isActive: true,
      isSystemUser: false,
      permissions: {
        some: {
          projectId: hojoProject.id,
          permissionLevel: { in: ["edit", "manager"] },
        },
      },
    },
    select: { id: true },
  });
  const validIds = validStaff.map((s) => s.id);
  if (validIds.length !== staffIds.length) {
    throw new Error("担当者に選択できないスタッフが含まれています");
  }
  return validIds;
}

type TaskFormData = {
  id?: number; // tempID for new (negative) or actual id
  taskType: "vendor" | "consulting_team";
  content: string;
  deadline: string;
  priority: string;
  completed: boolean;
};

async function syncTasks(activityId: number, tasks: TaskFormData[]) {
  // 既存タスクを取得
  const existing = await prisma.hojoConsultingActivityTask.findMany({
    where: { activityId },
  });
  const existingIds = new Set(existing.map((t) => t.id));
  const keepIds = new Set(tasks.filter((t) => t.id && t.id > 0).map((t) => t.id!));

  // 削除対象: existingにあるがtasksに無いもの
  const toDelete = [...existingIds].filter((id) => !keepIds.has(id));
  if (toDelete.length > 0) {
    await prisma.hojoConsultingActivityTask.deleteMany({ where: { id: { in: toDelete } } });
  }

  // 追加/更新
  for (const [idx, task] of tasks.entries()) {
    if (task.id && task.id > 0 && existingIds.has(task.id)) {
      // 更新
      await prisma.hojoConsultingActivityTask.update({
        where: { id: task.id },
        data: {
          content: task.content?.trim() || null,
          deadline: toDateOrNull(task.deadline),
          priority: task.priority?.trim() || null,
          completed: task.completed,
          displayOrder: idx,
        },
      });
    } else {
      // 追加
      await prisma.hojoConsultingActivityTask.create({
        data: {
          activityId,
          taskType: task.taskType,
          content: task.content?.trim() || null,
          deadline: toDateOrNull(task.deadline),
          priority: task.priority?.trim() || null,
          completed: task.completed,
          displayOrder: idx,
        },
      });
    }
  }
}

async function syncActivityStaff(activityId: number, staffIds: number[]) {
  const existing = await prisma.hojoConsultingActivityStaff.findMany({
    where: { activityId },
    select: { staffId: true },
  });
  const existingIds = new Set(existing.map((s) => s.staffId));
  const nextIds = new Set(staffIds);
  const toDelete = [...existingIds].filter((id) => !nextIds.has(id));
  const toCreate = staffIds.filter((id) => !existingIds.has(id));

  if (toDelete.length > 0) {
    await prisma.hojoConsultingActivityStaff.deleteMany({
      where: { activityId, staffId: { in: toDelete } },
    });
  }
  if (toCreate.length > 0) {
    await prisma.hojoConsultingActivityStaff.createMany({
      data: toCreate.map((staffId) => ({ activityId, staffId })),
      skipDuplicates: true,
    });
  }
}

export async function addActivity(data: Record<string, unknown>): Promise<ActionResult> {
  try {
  await requireProjectMasterDataEditPermission();

  const vendorId = data.vendorId ? Number(data.vendorId) : null;
  if (!vendorId) return err("ベンダーを選択してください");

  const activityDate = toDateOrNull(data.activityDate);
  if (!activityDate) return err("活動日を入力してください");

  const contractId = data.contractId ? Number(data.contractId) : null;
  const tasks = Array.isArray(data.tasks) ? (data.tasks as TaskFormData[]) : [];
  const staffIds = await validateHojoActivityStaffIds(parseStaffIds(data.staffIds));

  const created = await prisma.hojoConsultingActivity.create({
    data: {
      vendor: { connect: { id: vendorId } },
      ...(contractId ? { contract: { connect: { id: contractId } } } : {}),
      activityDate,
      contactMethod: data.contactMethod ? String(data.contactMethod).trim() : null,
      title: data.title ? String(data.title).trim() : null,
      meetingMinutes: data.meetingMinutes ? String(data.meetingMinutes).trim() : null,
      vendorNextAction: data.vendorNextAction ? String(data.vendorNextAction).trim() : null,
      nextDeadline: toDateOrNull(data.nextDeadline),
      attachmentUrls: toStringArray(data.attachmentUrls),
      recordingUrls: toStringArray(data.recordingUrls),
      notes: data.notes ? String(data.notes).trim() : null,
    },
  });

  if (staffIds.length > 0) {
    await syncActivityStaff(created.id, staffIds);
  }

  if (tasks.length > 0) {
    await syncTasks(created.id, tasks);
  }

  revalidatePath("/hojo/consulting/activities");
  revalidatePath("/hojo/vendor");
  revalidatePath("/hojo/settings/vendors");
  return ok();
  } catch (e) {
    console.error("[addActivity] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function updateActivity(id: number, data: Record<string, unknown>): Promise<ActionResult> {
  try {
  await requireProjectMasterDataEditPermission();

  const updateData: Record<string, unknown> = {};

  if ("vendorId" in data) {
    const vendorId = data.vendorId ? Number(data.vendorId) : null;
    if (vendorId) {
      updateData.vendor = { connect: { id: vendorId } };
    }
  }
  if ("contractId" in data) {
    const contractId = data.contractId ? Number(data.contractId) : null;
    if (contractId) {
      updateData.contract = { connect: { id: contractId } };
    } else {
      updateData.contract = { disconnect: true };
    }
  }
  if ("activityDate" in data) {
    const d = toDateOrNull(data.activityDate);
    if (d) updateData.activityDate = d;
  }
  if ("contactMethod" in data) updateData.contactMethod = data.contactMethod ? String(data.contactMethod).trim() : null;
  if ("title" in data) updateData.title = data.title ? String(data.title).trim() : null;
  if ("meetingMinutes" in data) updateData.meetingMinutes = data.meetingMinutes ? String(data.meetingMinutes).trim() : null;
  if ("vendorNextAction" in data) updateData.vendorNextAction = data.vendorNextAction ? String(data.vendorNextAction).trim() : null;
  if ("nextDeadline" in data) updateData.nextDeadline = toDateOrNull(data.nextDeadline);
  if ("attachmentUrls" in data) updateData.attachmentUrls = toStringArray(data.attachmentUrls);
  if ("recordingUrls" in data) updateData.recordingUrls = toStringArray(data.recordingUrls);
  if ("notes" in data) updateData.notes = data.notes ? String(data.notes).trim() : null;

  if (Object.keys(updateData).length > 0) {
    await prisma.hojoConsultingActivity.update({
      where: { id },
      data: updateData,
    });
  }

  if ("staffIds" in data) {
    const staffIds = await validateHojoActivityStaffIds(parseStaffIds(data.staffIds));
    await syncActivityStaff(id, staffIds);
  }

  // タスク同期
  if ("tasks" in data && Array.isArray(data.tasks)) {
    await syncTasks(id, data.tasks as TaskFormData[]);
  }

  revalidatePath("/hojo/consulting/activities");
  revalidatePath("/hojo/vendor");
  revalidatePath("/hojo/settings/vendors");
  return ok();
  } catch (e) {
    console.error("[updateActivity] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function deleteActivity(id: number): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission();

    await prisma.hojoConsultingActivity.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    revalidatePath("/hojo/consulting/activities");
    return ok();
  } catch (e) {
    console.error("[deleteActivity] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ========== タスク管理 ==========

type TaskInput = {
  content?: string | null;
  deadline?: string | null;
  priority?: string | null;
  completed?: boolean;
};

async function checkPermissionForActivity(activityId: number, vendorId?: number): Promise<{ isStaff: boolean; isVendor: boolean }> {
  const { auth } = await import("@/auth");
  const { canEdit: canEditProject } = await import("@/lib/auth/permissions");
  const session = await auth();
  const userType = session?.user?.userType;

  const isStaff = userType === "staff" && canEditProject(
    (session?.user?.permissions ?? []) as import("@/types/auth").UserPermission[],
    "hojo"
  );
  const isVendor = userType === "vendor" && typeof vendorId === "number" && session?.user?.vendorId === vendorId;

  if (!isStaff && !isVendor) {
    throw new Error("権限がありません");
  }

  // activityが該当ベンダーのものかチェック
  if (!isStaff && vendorId != null) {
    const activity = await prisma.hojoConsultingActivity.findUnique({
      where: { id: activityId },
      select: { vendorId: true, deletedAt: true },
    });
    if (!activity || activity.deletedAt || activity.vendorId !== vendorId) {
      throw new Error("権限がありません");
    }
  }

  return { isStaff, isVendor };
}

export async function addActivityTask(
  activityId: number,
  taskType: "vendor" | "consulting_team",
  input: TaskInput,
  vendorIdForPermCheck?: number
): Promise<ActionResult> {
  try {
    const { isStaff } = await checkPermissionForActivity(activityId, vendorIdForPermCheck);
    // ベンダーユーザーはvendorタイプのみ追加可
    if (!isStaff && taskType !== "vendor") {
      return err("このタスクタイプは編集できません");
    }

    const maxOrder = await prisma.hojoConsultingActivityTask.aggregate({
      where: { activityId, taskType },
      _max: { displayOrder: true },
    });

    await prisma.hojoConsultingActivityTask.create({
      data: {
        activityId,
        taskType,
        content: input.content?.trim() || null,
        deadline: toDateOrNull(input.deadline),
        priority: input.priority?.trim() || null,
        completed: input.completed ?? false,
        displayOrder: (maxOrder._max.displayOrder ?? 0) + 1,
      },
    });

    revalidatePath("/hojo/consulting/activities");
    revalidatePath("/hojo/vendor");
    revalidatePath("/hojo/settings/vendors");
    return ok();
  } catch (e) {
    console.error("[addActivityTask] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function updateActivityTask(
  taskId: number,
  input: TaskInput,
  vendorIdForPermCheck?: number
): Promise<ActionResult> {
  try {
    const task = await prisma.hojoConsultingActivityTask.findUnique({
      where: { id: taskId },
      select: { activityId: true, taskType: true },
    });
    if (!task) return err("タスクが見つかりません");

    const { isStaff } = await checkPermissionForActivity(task.activityId, vendorIdForPermCheck);
    if (!isStaff && task.taskType !== "vendor") {
      return err("このタスクは編集できません");
    }

    const updateData: Record<string, unknown> = {};
    if ("content" in input) updateData.content = input.content?.trim() || null;
    if ("deadline" in input) updateData.deadline = toDateOrNull(input.deadline);
    if ("priority" in input) updateData.priority = input.priority?.trim() || null;
    if ("completed" in input) updateData.completed = input.completed ?? false;

    await prisma.hojoConsultingActivityTask.update({
      where: { id: taskId },
      data: updateData,
    });

    revalidatePath("/hojo/consulting/activities");
    revalidatePath("/hojo/vendor");
    revalidatePath("/hojo/settings/vendors");
    return ok();
  } catch (e) {
    console.error("[updateActivityTask] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function deleteActivityTask(
  taskId: number,
  vendorIdForPermCheck?: number
): Promise<ActionResult> {
  try {
    const task = await prisma.hojoConsultingActivityTask.findUnique({
      where: { id: taskId },
      select: { activityId: true, taskType: true },
    });
    if (!task) return err("タスクが見つかりません");

    const { isStaff } = await checkPermissionForActivity(task.activityId, vendorIdForPermCheck);
    if (!isStaff && task.taskType !== "vendor") {
      return err("このタスクは編集できません");
    }

    await prisma.hojoConsultingActivityTask.delete({ where: { id: taskId } });

    revalidatePath("/hojo/consulting/activities");
    revalidatePath("/hojo/vendor");
    revalidatePath("/hojo/settings/vendors");
    return ok();
  } catch (e) {
    console.error("[deleteActivityTask] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}
