"use server";

import { prisma } from "@/lib/prisma";
import { requireProjectMasterDataEditPermission } from "@/lib/auth/master-data-permission";
import { revalidatePath } from "next/cache";

export async function updateVendorDetail(
  id: number,
  data: Record<string, unknown>
) {
  await requireProjectMasterDataEditPermission();

  const representativeName = data.representativeName
    ? String(data.representativeName).trim()
    : null;
  const representativeLineFriendId = data.representativeLineFriendId
    ? Number(data.representativeLineFriendId)
    : null;
  const contactPersonName = data.contactPersonName
    ? String(data.contactPersonName).trim()
    : null;
  const contactPersonLineFriendId = data.contactPersonLineFriendId
    ? Number(data.contactPersonLineFriendId)
    : null;
  const email = data.email ? String(data.email).trim() : null;
  const phone = data.phone ? String(data.phone).trim() : null;

  const scWholesaleStatusId = data.scWholesaleStatusId
    ? Number(data.scWholesaleStatusId)
    : null;
  const scWholesaleKickoffMtg = data.scWholesaleKickoffMtg
    ? String(data.scWholesaleKickoffMtg).trim()
    : null;
  const scWholesaleContractUrl = data.scWholesaleContractUrl
    ? String(data.scWholesaleContractUrl).trim()
    : null;

  const consultingPlanStatusId = data.consultingPlanStatusId
    ? Number(data.consultingPlanStatusId)
    : null;
  const consultingPlanKickoffMtg = data.consultingPlanKickoffMtg
    ? String(data.consultingPlanKickoffMtg).trim()
    : null;
  const consultingPlanContractUrl = data.consultingPlanContractUrl
    ? String(data.consultingPlanContractUrl).trim()
    : null;

  const grantApplicationBpo = data.grantApplicationBpo === true;
  const grantApplicationBpoKickoffMtg = data.grantApplicationBpoKickoffMtg
    ? String(data.grantApplicationBpoKickoffMtg).trim()
    : null;
  const grantApplicationBpoContractUrl = data.grantApplicationBpoContractUrl
    ? String(data.grantApplicationBpoContractUrl).trim()
    : null;

  const subsidyConsulting = data.subsidyConsulting === true;
  const subsidyConsultingKickoffMtg = data.subsidyConsultingKickoffMtg
    ? String(data.subsidyConsultingKickoffMtg).trim()
    : null;

  const loanUsage = data.loanUsage === true;
  const loanUsageKickoffMtg = data.loanUsageKickoffMtg
    ? String(data.loanUsageKickoffMtg).trim()
    : null;
  const loanUsageContractUrl = data.loanUsageContractUrl
    ? String(data.loanUsageContractUrl).trim()
    : null;

  const vendorRegistrationStatusId = data.vendorRegistrationStatusId
    ? Number(data.vendorRegistrationStatusId)
    : null;

  const toolRegistrationStatusId = data.toolRegistrationStatusId
    ? Number(data.toolRegistrationStatusId)
    : null;

  const memo = data.memo ? String(data.memo).trim() : null;
  const vendorSharedMemo = data.vendorSharedMemo
    ? String(data.vendorSharedMemo).trim()
    : null;

  const contractDate = data.contractDate
    ? new Date(String(data.contractDate))
    : null;
  const caseStatusId = data.caseStatusId
    ? Number(data.caseStatusId)
    : null;

  const consultingStartDate = data.consultingStartDate
    ? new Date(String(data.consultingStartDate))
    : null;
  const consultingEndDate = data.consultingEndDate
    ? new Date(String(data.consultingEndDate))
    : null;

  await prisma.hojoVendor.update({
    where: { id },
    data: {
      representativeName,
      representativeLineFriend: representativeLineFriendId
        ? { connect: { id: representativeLineFriendId } }
        : { disconnect: true },
      contactPersonName,
      contactPersonLineFriend: contactPersonLineFriendId
        ? { connect: { id: contactPersonLineFriendId } }
        : { disconnect: true },
      email,
      phone,
      scWholesaleStatus: scWholesaleStatusId
        ? { connect: { id: scWholesaleStatusId } }
        : { disconnect: true },
      scWholesaleKickoffMtg,
      scWholesaleContractUrl,
      consultingPlanStatus: consultingPlanStatusId
        ? { connect: { id: consultingPlanStatusId } }
        : { disconnect: true },
      consultingPlanKickoffMtg,
      consultingPlanContractUrl,
      contractDate,
      caseStatus: caseStatusId
        ? { connect: { id: caseStatusId } }
        : { disconnect: true },
      consultingStartDate,
      consultingEndDate,
      grantApplicationBpo,
      grantApplicationBpoKickoffMtg,
      grantApplicationBpoContractUrl,
      subsidyConsulting,
      subsidyConsultingKickoffMtg,
      loanUsage,
      loanUsageKickoffMtg,
      loanUsageContractUrl,
      vendorRegistrationStatus: vendorRegistrationStatusId
        ? { connect: { id: vendorRegistrationStatusId } }
        : { disconnect: true },
      toolRegistrationStatus: toolRegistrationStatusId
        ? { connect: { id: toolRegistrationStatusId } }
        : { disconnect: true },
      memo,
      vendorSharedMemo,
    },
  });

  revalidatePath(`/hojo/settings/vendors/${id}`);
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
