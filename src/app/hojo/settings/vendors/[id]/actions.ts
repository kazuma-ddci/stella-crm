"use server";

import { prisma } from "@/lib/prisma";
import { requireProjectMasterDataEditPermission } from "@/lib/auth/master-data-permission";
import { revalidatePath } from "next/cache";
import { ok, err, type ActionResult } from "@/lib/action-result";

type ContractDocumentInput = {
  id?: number;
  type: "url" | "file";
  url?: string | null;
  filePath?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
};

const SERVICE_TYPES = ["scWholesale", "consultingPlan", "grantApplicationBpo"] as const;
type ServiceType = (typeof SERVICE_TYPES)[number];

function parseDateTime(value: unknown): Date | null {
  if (!value) return null;
  const str = String(value).trim();
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

export async function updateVendorDetail(
  id: number,
  data: Record<string, unknown>
): Promise<ActionResult> {
  try {
  await requireProjectMasterDataEditPermission();

  const email = data.email ? String(data.email).trim() : null;
  const phone = data.phone ? String(data.phone).trim() : null;

  // 全体の初回MTG
  const kickoffMtg = parseDateTime(data.kickoffMtg);

  // 次の連絡日（全体用 + 卸用 + コンサル用）
  const nextContactDate = parseDateTime(data.nextContactDate);
  const nextContactDateWholesale = parseDateTime(data.nextContactDateWholesale);
  const nextContactDateConsulting = parseDateTime(data.nextContactDateConsulting);

  // ヘルパー: 文字列フィールドを取り出してtrim、空文字はnullに
  const trimOrNull = (v: unknown): string | null => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s === "" ? null : s;
  };

  // セキュリティクラウド卸
  const scWholesaleStatusId = data.scWholesaleStatusId ? Number(data.scWholesaleStatusId) : null;
  const scWholesaleContractStatusId = data.scWholesaleContractStatusId ? Number(data.scWholesaleContractStatusId) : null;
  const scWholesaleKickoffMtg = parseDateTime(data.scWholesaleKickoffMtg);
  const scWholesaleContractDate = parseDateTime(data.scWholesaleContractDate);
  const scWholesaleEndDate = parseDateTime(data.scWholesaleEndDate);
  const scWholesaleMemo = trimOrNull(data.scWholesaleMemo);

  // コンサルティングプラン
  const consultingPlanStatusId = data.consultingPlanStatusId ? Number(data.consultingPlanStatusId) : null;
  const consultingPlanContractStatusId = data.consultingPlanContractStatusId ? Number(data.consultingPlanContractStatusId) : null;
  const consultingPlanKickoffMtg = parseDateTime(data.consultingPlanKickoffMtg);
  const consultingPlanContractDate = parseDateTime(data.consultingPlanContractDate);
  const consultingPlanEndDate = parseDateTime(data.consultingPlanEndDate);
  const consultingPlanMemo = trimOrNull(data.consultingPlanMemo);

  // 交付申請BPO
  const grantApplicationBpo = data.grantApplicationBpo === true;
  const grantApplicationBpoContractStatusId = data.grantApplicationBpoContractStatusId
    ? Number(data.grantApplicationBpoContractStatusId)
    : null;
  const grantApplicationBpoKickoffMtg = parseDateTime(data.grantApplicationBpoKickoffMtg);
  const grantApplicationBpoContractDate = parseDateTime(data.grantApplicationBpoContractDate);
  const grantApplicationBpoMemo = trimOrNull(data.grantApplicationBpoMemo);

  // 助成金コンサルティング
  const subsidyConsulting = data.subsidyConsulting === true;
  const subsidyConsultingKickoffMtg = parseDateTime(data.subsidyConsultingKickoffMtg);
  const subsidyConsultingMemo = trimOrNull(data.subsidyConsultingMemo);

  // 貸金業者
  const loanUsage = data.loanUsage === true;
  const loanUsageKickoffMtg = parseDateTime(data.loanUsageKickoffMtg);
  const loanUsageMemo = trimOrNull(data.loanUsageMemo);

  const vendorRegistrationStatusId = data.vendorRegistrationStatusId
    ? Number(data.vendorRegistrationStatusId)
    : null;
  const vendorRegistrationMemo = trimOrNull(data.vendorRegistrationMemo);

  const memo = data.memo ? String(data.memo).trim() : null;
  const vendorSharedMemo = data.vendorSharedMemo
    ? String(data.vendorSharedMemo).trim()
    : null;

  await prisma.hojoVendor.update({
    where: { id },
    data: {
      email,
      phone,
      kickoffMtg,
      nextContactDate,
      nextContactDateWholesale,
      nextContactDateConsulting,
      scWholesaleStatus: scWholesaleStatusId
        ? { connect: { id: scWholesaleStatusId } }
        : { disconnect: true },
      scWholesaleContractStatus: scWholesaleContractStatusId
        ? { connect: { id: scWholesaleContractStatusId } }
        : { disconnect: true },
      scWholesaleKickoffMtg,
      scWholesaleContractDate,
      scWholesaleEndDate,
      scWholesaleMemo,
      consultingPlanStatus: consultingPlanStatusId
        ? { connect: { id: consultingPlanStatusId } }
        : { disconnect: true },
      consultingPlanContractStatus: consultingPlanContractStatusId
        ? { connect: { id: consultingPlanContractStatusId } }
        : { disconnect: true },
      consultingPlanKickoffMtg,
      consultingPlanContractDate,
      consultingPlanEndDate,
      consultingPlanMemo,
      grantApplicationBpo,
      grantApplicationBpoContractStatus: grantApplicationBpoContractStatusId
        ? { connect: { id: grantApplicationBpoContractStatusId } }
        : { disconnect: true },
      grantApplicationBpoKickoffMtg,
      grantApplicationBpoContractDate,
      grantApplicationBpoMemo,
      subsidyConsulting,
      subsidyConsultingKickoffMtg,
      subsidyConsultingMemo,
      loanUsage,
      loanUsageKickoffMtg,
      loanUsageMemo,
      vendorRegistrationStatus: vendorRegistrationStatusId
        ? { connect: { id: vendorRegistrationStatusId } }
        : { disconnect: true },
      vendorRegistrationMemo,
      memo,
      vendorSharedMemo,
    },
  });

  revalidatePath(`/hojo/settings/vendors/${id}`);
  revalidatePath("/hojo/settings/vendors");
  return ok();
  } catch (e) {
    console.error("[updateVendorDetail] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ============================
// ベンダー契約書（複数URL+ファイル）の管理
// ============================

export async function updateVendorContractDocuments(
  vendorId: number,
  serviceType: ServiceType,
  documents: ContractDocumentInput[]
): Promise<ActionResult> {
  try {
  await requireProjectMasterDataEditPermission();

  if (!SERVICE_TYPES.includes(serviceType)) {
    return err("無効なサービス種別です");
  }

  // 既存のドキュメントを削除して、入れ直す（シンプル）
  await prisma.hojoVendorContractDocument.deleteMany({
    where: { vendorId, serviceType },
  });

  if (documents.length > 0) {
    await prisma.hojoVendorContractDocument.createMany({
      data: documents.map((doc, index) => ({
        vendorId,
        serviceType,
        type: doc.type,
        url: doc.type === "url" ? doc.url?.trim() || null : null,
        filePath: doc.type === "file" ? doc.filePath || null : null,
        fileName: doc.type === "file" ? doc.fileName || null : null,
        fileSize: doc.type === "file" ? doc.fileSize ?? null : null,
        mimeType: doc.type === "file" ? doc.mimeType || null : null,
        displayOrder: index,
      })),
    });
  }

  revalidatePath(`/hojo/settings/vendors/${vendorId}`);
  revalidatePath("/hojo/settings/vendors");
  return ok();
  } catch (e) {
    console.error("[updateVendorContractDocuments] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function updateVendorConsultingStaff(vendorId: number, staffIds: number[]): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission();

    // Delete existing
    await prisma.hojoVendorConsultingStaff.deleteMany({ where: { vendorId } });
    // Create new
    if (staffIds.length > 0) {
      await prisma.hojoVendorConsultingStaff.createMany({
        data: staffIds.map((staffId) => ({ vendorId, staffId })),
      });
    }

    revalidatePath(`/hojo/settings/vendors/${vendorId}`);
    revalidatePath("/hojo/settings/vendors");
    return ok();
  } catch (e) {
    console.error("[updateVendorConsultingStaff] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function updateVendorAssignedAs(vendorId: number, lineFriendId: number | null): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission();

    await prisma.hojoVendor.update({
      where: { id: vendorId },
      data: {
        assignedAsLineFriend: lineFriendId
          ? { connect: { id: lineFriendId } }
          : { disconnect: true },
      },
    });

    revalidatePath(`/hojo/settings/vendors/${vendorId}`);
    revalidatePath("/hojo/settings/vendors");
    return ok();
  } catch (e) {
    console.error("[updateVendorAssignedAs] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// --- Wrapper actions for vendor detail tabs ---
// These call the original actions and also revalidate the vendor detail page.

import {
  addActivity,
  updateActivity,
  deleteActivity,
} from "@/app/hojo/consulting/activities/actions";
import {
  addPreApplication,
  updatePreApplication,
  deletePreApplication,
} from "@/app/hojo/grant-customers/pre-application/actions";
import {
  addPostApplication,
  updatePostApplication,
  deletePostApplication,
} from "@/app/hojo/grant-customers/post-application/actions";

export async function addActivityForVendor(data: Record<string, unknown>): Promise<ActionResult> {
  const result = await addActivity(data);
  if (!result.ok) return result;
  revalidatePath(`/hojo/settings/vendors/${data.vendorId}`);
  return ok();
}

export async function updateActivityForVendor(
  id: number,
  data: Record<string, unknown>
): Promise<ActionResult> {
  const result = await updateActivity(id, data);
  if (!result.ok) return result;
  revalidatePath(`/hojo/settings/vendors/${data.vendorId}`);
  return ok();
}

export async function deleteActivityForVendor(
  id: number,
  vendorId: string
): Promise<ActionResult> {
  const result = await deleteActivity(id);
  if (!result.ok) return result;
  revalidatePath(`/hojo/settings/vendors/${vendorId}`);
  return ok();
}

export async function addPreApplicationForVendor(
  data: Record<string, unknown>
): Promise<ActionResult> {
  const result = await addPreApplication(data);
  if (!result.ok) return result;
  revalidatePath(`/hojo/settings/vendors/${data.vendorId}`);
  return ok();
}

export async function updatePreApplicationForVendor(
  id: number,
  data: Record<string, unknown>
): Promise<ActionResult> {
  const result = await updatePreApplication(id, data);
  if (!result.ok) return result;
  revalidatePath(`/hojo/settings/vendors/${data.vendorId}`);
  return ok();
}

export async function deletePreApplicationForVendor(
  id: number,
  vendorId: string
): Promise<ActionResult> {
  const result = await deletePreApplication(id);
  if (!result.ok) return result;
  revalidatePath(`/hojo/settings/vendors/${vendorId}`);
  return ok();
}

export async function addPostApplicationForVendor(
  data: Record<string, unknown>
): Promise<ActionResult> {
  const result = await addPostApplication(data);
  if (!result.ok) return result;
  revalidatePath(`/hojo/settings/vendors/${data.vendorId}`);
  return ok();
}

export async function updatePostApplicationForVendor(
  id: number,
  data: Record<string, unknown>
): Promise<ActionResult> {
  const result = await updatePostApplication(id, data);
  if (!result.ok) return result;
  revalidatePath(`/hojo/settings/vendors/${data.vendorId}`);
  return ok();
}

export async function deletePostApplicationForVendor(
  id: number,
  vendorId: string
): Promise<ActionResult> {
  const result = await deletePostApplication(id);
  if (!result.ok) return result;
  revalidatePath(`/hojo/settings/vendors/${vendorId}`);
  return ok();
}
