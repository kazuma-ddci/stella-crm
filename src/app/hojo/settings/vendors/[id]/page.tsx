import { prisma } from "@/lib/prisma";
import { requireProjectMasterDataEditPermission } from "@/lib/auth/master-data-permission";
import { VendorDetailForm } from "./vendor-detail-form";
import { notFound } from "next/navigation";

export default async function VendorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireProjectMasterDataEditPermission();

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (isNaN(id)) notFound();

  const [vendor, lineFriends, scWholesaleStatuses, consultingPlanStatuses, vendorRegistrationStatuses] =
    await Promise.all([
      prisma.hojoVendor.findUnique({
        where: { id },
        include: {
          representativeLineFriend: { select: { id: true, snsname: true } },
          contactPersonLineFriend: { select: { id: true, snsname: true } },
          scWholesaleStatus: true,
          consultingPlanStatus: true,
          vendorRegistrationStatus: true,
        },
      }),
      prisma.hojoLineFriendSecurityCloud.findMany({
        where: { deletedAt: null },
        orderBy: { id: "asc" },
        select: { id: true, snsname: true },
      }),
      prisma.hojoVendorScWholesaleStatus.findMany({
        where: { isActive: true },
        orderBy: { displayOrder: "asc" },
      }),
      prisma.hojoVendorConsultingPlanStatus.findMany({
        where: { isActive: true },
        orderBy: { displayOrder: "asc" },
      }),
      prisma.hojoVendorRegistrationStatus.findMany({
        where: { isActive: true },
        orderBy: { displayOrder: "asc" },
      }),
    ]);

  if (!vendor) notFound();

  const lineFriendOptions = lineFriends.map((f) => ({
    id: f.id,
    label: `${f.id} ${f.snsname || "（名前なし）"}`,
  }));

  const scWholesaleOptions = scWholesaleStatuses.map((s) => ({
    value: String(s.id),
    label: s.name,
  }));

  const consultingPlanOptions = consultingPlanStatuses.map((s) => ({
    value: String(s.id),
    label: s.name,
  }));

  const vendorRegistrationOptions = vendorRegistrationStatuses.map((s) => ({
    value: String(s.id),
    label: s.name,
  }));

  return (
    <VendorDetailForm
      vendor={{
        id: vendor.id,
        name: vendor.name,
        representativeName: vendor.representativeName ?? "",
        representativeLineFriendId: vendor.representativeLineFriendId,
        contactPersonName: vendor.contactPersonName ?? "",
        contactPersonLineFriendId: vendor.contactPersonLineFriendId,
        email: vendor.email ?? "",
        phone: vendor.phone ?? "",
        scWholesaleStatusId: vendor.scWholesaleStatusId,
        scWholesaleKickoffMtg: vendor.scWholesaleKickoffMtg ?? "",
        scWholesaleContractUrl: vendor.scWholesaleContractUrl ?? "",
        consultingPlanStatusId: vendor.consultingPlanStatusId,
        consultingPlanKickoffMtg: vendor.consultingPlanKickoffMtg ?? "",
        consultingPlanContractUrl: vendor.consultingPlanContractUrl ?? "",
        grantApplicationBpo: vendor.grantApplicationBpo,
        grantApplicationBpoKickoffMtg: vendor.grantApplicationBpoKickoffMtg ?? "",
        grantApplicationBpoContractUrl: vendor.grantApplicationBpoContractUrl ?? "",
        subsidyConsulting: vendor.subsidyConsulting,
        subsidyConsultingKickoffMtg: vendor.subsidyConsultingKickoffMtg ?? "",
        loanUsage: vendor.loanUsage,
        loanUsageKickoffMtg: vendor.loanUsageKickoffMtg ?? "",
        loanUsageContractUrl: vendor.loanUsageContractUrl ?? "",
        vendorRegistrationStatusId: vendor.vendorRegistrationStatusId,
        memo: vendor.memo ?? "",
      }}
      lineFriendOptions={lineFriendOptions}
      scWholesaleOptions={scWholesaleOptions}
      consultingPlanOptions={consultingPlanOptions}
      vendorRegistrationOptions={vendorRegistrationOptions}
    />
  );
}
