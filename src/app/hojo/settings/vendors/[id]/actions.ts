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

  const memo = data.memo ? String(data.memo).trim() : null;

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
      memo,
    },
  });

  revalidatePath(`/hojo/settings/vendors/${id}`);
  revalidatePath("/hojo/settings/vendors");
}
