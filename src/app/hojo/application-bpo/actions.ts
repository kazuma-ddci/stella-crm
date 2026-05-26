"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canEdit as canEditProject } from "@/lib/auth/permissions";
import type { UserPermission } from "@/types/auth";
import { err, ok, type ActionResult } from "@/lib/action-result";
import type { Prisma } from "@prisma/client";

const REVALIDATE_PATHS = ["/hojo/application-bpo", "/hojo/vendor"];

function revalidateApplicationBpo() {
  for (const path of REVALIDATE_PATHS) revalidatePath(path);
}

async function isStaffWithHojoEdit() {
  const session = await auth();
  const permissions = (session?.user?.permissions ?? []) as UserPermission[];
  return session?.user?.userType === "staff" && canEditProject(permissions, "hojo");
}

async function requireHojoEditStaff() {
  if (!(await isStaffWithHojoEdit())) {
    throw new Error("補助金の編集権限がありません");
  }
}

async function requireVendorOwner(vendorId: number) {
  const session = await auth();
  const staffEdit = await isStaffWithHojoEdit();
  if (staffEdit) return;
  if (session?.user?.userType !== "vendor" || session.user.vendorId !== vendorId) {
    throw new Error("権限がありません");
  }
}

function cleanObject(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (value === undefined) continue;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed !== "") result[key] = trimmed;
      continue;
    }
    if (value !== null && value !== "") result[key] = value;
  }
  return result;
}

function parseDate(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildDenormalizedData(
  vendorInput: Record<string, unknown>,
  staffInput: Record<string, unknown>,
) {
  return {
    requestDate: parseDate(vendorInput.requestDate),
    doubleCheckStatus: vendorInput.doubleCheckStatus ? String(vendorInput.doubleCheckStatus) : null,
    scheduledAt: vendorInput.scheduledAt ? String(vendorInput.scheduledAt) : null,
    companyName: vendorInput.companyName ? String(vendorInput.companyName) : null,
    applicantType: vendorInput.applicantType ? String(vendorInput.applicantType) : null,
    repeatType: vendorInput.repeatType ? String(vendorInput.repeatType) : null,
    wageIncreaseAvailability: vendorInput.wageIncreaseAvailability ? String(vendorInput.wageIncreaseAvailability) : null,
    completionDate: parseDate(staffInput.completionDate),
    nextAction: staffInput.nextAction ? String(staffInput.nextAction) : null,
  };
}

function json(value: Record<string, unknown>): Prisma.InputJsonObject {
  return value as Prisma.InputJsonObject;
}

export async function createApplicationBpoRequestByVendor(
  vendorId: number,
  data: {
    vendorInput?: Record<string, unknown>;
    attachments?: Record<string, unknown>;
  },
): Promise<ActionResult> {
  try {
    await requireVendorOwner(vendorId);
    const vendorInput = cleanObject(data.vendorInput);
    const attachments = cleanObject(data.attachments);
    const denormalized = buildDenormalizedData(vendorInput, {});

    await prisma.$transaction(async (tx) => {
      const latest = await tx.hojoApplicationBpoRequest.findFirst({
        where: { vendorId },
        orderBy: { vendorCustomerNo: "desc" },
        select: { vendorCustomerNo: true },
      });
      await tx.hojoApplicationBpoRequest.create({
        data: {
          vendorId,
          vendorCustomerNo: (latest?.vendorCustomerNo ?? 0) + 1,
          ...denormalized,
          vendorInput: json(vendorInput),
          staffInput: json({}),
          attachments: json(attachments),
        },
      });
    });

    revalidateApplicationBpo();
    return ok();
  } catch (e) {
    console.error("[createApplicationBpoRequestByVendor] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function updateApplicationBpoRequestByVendor(
  id: number,
  vendorId: number,
  data: {
    vendorInput?: Record<string, unknown>;
    attachments?: Record<string, unknown>;
  },
): Promise<ActionResult> {
  try {
    await requireVendorOwner(vendorId);
    const record = await prisma.hojoApplicationBpoRequest.findFirst({
      where: { id, vendorId, deletedAt: null },
    });
    if (!record) return err("レコードが見つかりません");

    const vendorInput = cleanObject(data.vendorInput);
    const attachments = cleanObject(data.attachments);
    const staffInput = cleanObject(record.staffInput);
    await prisma.hojoApplicationBpoRequest.update({
      where: { id },
      data: {
        ...buildDenormalizedData(vendorInput, staffInput),
        vendorInput: json(vendorInput),
        attachments: json(attachments),
      },
    });

    revalidateApplicationBpo();
    return ok();
  } catch (e) {
    console.error("[updateApplicationBpoRequestByVendor] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function deleteApplicationBpoRequestByVendor(
  id: number,
  vendorId: number,
): Promise<ActionResult> {
  try {
    await requireVendorOwner(vendorId);
    const record = await prisma.hojoApplicationBpoRequest.findFirst({
      where: { id, vendorId, deletedAt: null },
      select: { id: true },
    });
    if (!record) return err("レコードが見つかりません");
    await prisma.hojoApplicationBpoRequest.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    revalidateApplicationBpo();
    return ok();
  } catch (e) {
    console.error("[deleteApplicationBpoRequestByVendor] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function updateApplicationBpoRequestByStaff(
  id: number,
  data: {
    vendorInput?: Record<string, unknown>;
    staffInput?: Record<string, unknown>;
    attachments?: Record<string, unknown>;
    staffMemo?: string | null;
  },
): Promise<ActionResult> {
  try {
    await requireHojoEditStaff();
    const record = await prisma.hojoApplicationBpoRequest.findFirst({
      where: { id, deletedAt: null },
    });
    if (!record) return err("レコードが見つかりません");

    const vendorInput = data.vendorInput === undefined
      ? cleanObject(record.vendorInput)
      : cleanObject(data.vendorInput);
    const staffInput = data.staffInput === undefined
      ? cleanObject(record.staffInput)
      : cleanObject(data.staffInput);
    const attachments = data.attachments === undefined
      ? cleanObject(record.attachments)
      : cleanObject(data.attachments);

    await prisma.hojoApplicationBpoRequest.update({
      where: { id },
      data: {
        ...buildDenormalizedData(vendorInput, staffInput),
        vendorInput: json(vendorInput),
        staffInput: json(staffInput),
        attachments: json(attachments),
        staffMemo: data.staffMemo !== undefined ? data.staffMemo?.trim() || null : record.staffMemo,
      },
    });
    revalidateApplicationBpo();
    return ok();
  } catch (e) {
    console.error("[updateApplicationBpoRequestByStaff] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function deleteApplicationBpoRequestByStaff(id: number): Promise<ActionResult> {
  try {
    await requireHojoEditStaff();
    await prisma.hojoApplicationBpoRequest.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    revalidateApplicationBpo();
    return ok();
  } catch (e) {
    console.error("[deleteApplicationBpoRequestByStaff] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}
