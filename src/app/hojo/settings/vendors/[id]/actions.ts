"use server";

import { prisma } from "@/lib/prisma";
import { requireProjectMasterDataEditPermission } from "@/lib/auth/master-data-permission";
import { revalidatePath } from "next/cache";

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
) {
  await requireProjectMasterDataEditPermission();

  const email = data.email ? String(data.email).trim() : null;
  const phone = data.phone ? String(data.phone).trim() : null;

  // 全体の初回MTG
  const kickoffMtg = parseDateTime(data.kickoffMtg);

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

  const toolRegistrationStatusId = data.toolRegistrationStatusId
    ? Number(data.toolRegistrationStatusId)
    : null;
  const toolRegistrationMemo = trimOrNull(data.toolRegistrationMemo);

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
      toolRegistrationStatus: toolRegistrationStatusId
        ? { connect: { id: toolRegistrationStatusId } }
        : { disconnect: true },
      toolRegistrationMemo,
      memo,
      vendorSharedMemo,
    },
  });

  revalidatePath(`/hojo/settings/vendors/${id}`);
  revalidatePath("/hojo/settings/vendors");
}

// ============================
// ベンダー契約書（複数URL+ファイル）の管理
// ============================

export async function updateVendorContractDocuments(
  vendorId: number,
  serviceType: ServiceType,
  documents: ContractDocumentInput[]
) {
  await requireProjectMasterDataEditPermission();

  if (!SERVICE_TYPES.includes(serviceType)) {
    throw new Error("無効なサービス種別です");
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
}

export async function updateVendorConsultingStaff(vendorId: number, staffIds: number[]) {
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
}

export async function updateVendorAssignedAs(vendorId: number, lineFriendId: number | null) {
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

export async function addActivityForVendor(data: Record<string, unknown>) {
  await addActivity(data);
  revalidatePath(`/hojo/settings/vendors/${data.vendorId}`);
}

export async function updateActivityForVendor(
  id: number,
  data: Record<string, unknown>
) {
  await updateActivity(id, data);
  revalidatePath(`/hojo/settings/vendors/${data.vendorId}`);
}

export async function deleteActivityForVendor(
  id: number,
  vendorId: string
) {
  await deleteActivity(id);
  revalidatePath(`/hojo/settings/vendors/${vendorId}`);
}

export async function addPreApplicationForVendor(
  data: Record<string, unknown>
) {
  await addPreApplication(data);
  revalidatePath(`/hojo/settings/vendors/${data.vendorId}`);
}

export async function updatePreApplicationForVendor(
  id: number,
  data: Record<string, unknown>
) {
  await updatePreApplication(id, data);
  revalidatePath(`/hojo/settings/vendors/${data.vendorId}`);
}

export async function deletePreApplicationForVendor(
  id: number,
  vendorId: string
) {
  await deletePreApplication(id);
  revalidatePath(`/hojo/settings/vendors/${vendorId}`);
}

export async function addPostApplicationForVendor(
  data: Record<string, unknown>
) {
  await addPostApplication(data);
  revalidatePath(`/hojo/settings/vendors/${data.vendorId}`);
}

export async function updatePostApplicationForVendor(
  id: number,
  data: Record<string, unknown>
) {
  await updatePostApplication(id, data);
  revalidatePath(`/hojo/settings/vendors/${data.vendorId}`);
}

export async function deletePostApplicationForVendor(
  id: number,
  vendorId: string
) {
  await deletePostApplication(id);
  revalidatePath(`/hojo/settings/vendors/${vendorId}`);
}
