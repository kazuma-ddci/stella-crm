"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProjectMasterDataEditPermission } from "@/lib/auth/master-data-permission";

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

export async function addActivity(data: Record<string, unknown>) {
  await requireProjectMasterDataEditPermission();

  const vendorId = data.vendorId ? Number(data.vendorId) : null;
  if (!vendorId) throw new Error("ベンダーを選択してください");

  const activityDate = toDateOrNull(data.activityDate);
  if (!activityDate) throw new Error("活動日を入力してください");

  const contractId = data.contractId ? Number(data.contractId) : null;
  const tasks = Array.isArray(data.tasks) ? (data.tasks as TaskFormData[]) : [];

  const created = await prisma.hojoConsultingActivity.create({
    data: {
      vendor: { connect: { id: vendorId } },
      ...(contractId ? { contract: { connect: { id: contractId } } } : {}),
      activityDate,
      contactMethod: data.contactMethod ? String(data.contactMethod).trim() : null,
      vendorIssue: data.vendorIssue ? String(data.vendorIssue).trim() : null,
      hearingContent: data.hearingContent ? String(data.hearingContent).trim() : null,
      responseContent: data.responseContent ? String(data.responseContent).trim() : null,
      proposalContent: data.proposalContent ? String(data.proposalContent).trim() : null,
      vendorNextAction: data.vendorNextAction ? String(data.vendorNextAction).trim() : null,
      nextDeadline: toDateOrNull(data.nextDeadline),
      attachmentUrls: toStringArray(data.attachmentUrls),
      recordingUrls: toStringArray(data.recordingUrls),
      screenshotUrls: toStringArray(data.screenshotUrls),
      notes: data.notes ? String(data.notes).trim() : null,
    },
  });

  if (tasks.length > 0) {
    await syncTasks(created.id, tasks);
  }

  revalidatePath("/hojo/consulting/activities");
  revalidatePath("/hojo/vendor");
  revalidatePath("/hojo/settings/vendors");
}

export async function updateActivity(id: number, data: Record<string, unknown>) {
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
  if ("vendorIssue" in data) updateData.vendorIssue = data.vendorIssue ? String(data.vendorIssue).trim() : null;
  if ("hearingContent" in data) updateData.hearingContent = data.hearingContent ? String(data.hearingContent).trim() : null;
  if ("responseContent" in data) updateData.responseContent = data.responseContent ? String(data.responseContent).trim() : null;
  if ("proposalContent" in data) updateData.proposalContent = data.proposalContent ? String(data.proposalContent).trim() : null;
  if ("vendorNextAction" in data) updateData.vendorNextAction = data.vendorNextAction ? String(data.vendorNextAction).trim() : null;
  if ("nextDeadline" in data) updateData.nextDeadline = toDateOrNull(data.nextDeadline);
  if ("attachmentUrls" in data) updateData.attachmentUrls = toStringArray(data.attachmentUrls);
  if ("recordingUrls" in data) updateData.recordingUrls = toStringArray(data.recordingUrls);
  if ("screenshotUrls" in data) updateData.screenshotUrls = toStringArray(data.screenshotUrls);
  if ("notes" in data) updateData.notes = data.notes ? String(data.notes).trim() : null;

  if (Object.keys(updateData).length > 0) {
    await prisma.hojoConsultingActivity.update({
      where: { id },
      data: updateData,
    });
  }

  // タスク同期
  if ("tasks" in data && Array.isArray(data.tasks)) {
    await syncTasks(id, data.tasks as TaskFormData[]);
  }

  revalidatePath("/hojo/consulting/activities");
  revalidatePath("/hojo/vendor");
  revalidatePath("/hojo/settings/vendors");
}

export async function deleteActivity(id: number) {
  await requireProjectMasterDataEditPermission();

  await prisma.hojoConsultingActivity.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/hojo/consulting/activities");
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
) {
  const { isStaff } = await checkPermissionForActivity(activityId, vendorIdForPermCheck);
  // ベンダーユーザーはvendorタイプのみ追加可
  if (!isStaff && taskType !== "vendor") {
    throw new Error("このタスクタイプは編集できません");
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
}

export async function updateActivityTask(
  taskId: number,
  input: TaskInput,
  vendorIdForPermCheck?: number
) {
  const task = await prisma.hojoConsultingActivityTask.findUnique({
    where: { id: taskId },
    select: { activityId: true, taskType: true },
  });
  if (!task) throw new Error("タスクが見つかりません");

  const { isStaff } = await checkPermissionForActivity(task.activityId, vendorIdForPermCheck);
  if (!isStaff && task.taskType !== "vendor") {
    throw new Error("このタスクは編集できません");
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
}

export async function deleteActivityTask(
  taskId: number,
  vendorIdForPermCheck?: number
) {
  const task = await prisma.hojoConsultingActivityTask.findUnique({
    where: { id: taskId },
    select: { activityId: true, taskType: true },
  });
  if (!task) throw new Error("タスクが見つかりません");

  const { isStaff } = await checkPermissionForActivity(task.activityId, vendorIdForPermCheck);
  if (!isStaff && task.taskType !== "vendor") {
    throw new Error("このタスクは編集できません");
  }

  await prisma.hojoConsultingActivityTask.delete({ where: { id: taskId } });

  revalidatePath("/hojo/consulting/activities");
  revalidatePath("/hojo/vendor");
  revalidatePath("/hojo/settings/vendors");
}
