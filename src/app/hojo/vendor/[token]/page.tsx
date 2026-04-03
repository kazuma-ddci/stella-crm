import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { VendorClientPage } from "./vendor-client-page";
import { canEdit as canEditProject } from "@/lib/auth/permissions";
import type { UserPermission } from "@/types/auth";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ベンダー様専用",
};

export default async function VendorPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const vendor = await prisma.hojoVendor.findUnique({
    where: { accessToken: token },
  });
  if (!vendor || !vendor.isActive) {
    notFound();
  }

  const session = await auth();
  const userType = session?.user?.userType;
  const isStaff = userType === "staff";
  const isVendor = userType === "vendor";
  const sessionVendorId = session?.user?.vendorId;
  const isAuthenticated = isStaff || (isVendor && sessionVendorId === vendor.id);
  const userPermissions = (session?.user?.permissions ?? []) as UserPermission[];
  const staffCanEdit = isStaff && canEditProject(userPermissions, "hojo");

  if (!isAuthenticated) {
    return (
      <VendorClientPage
        authenticated={false}
        isVendor={false}
        applicantData={[]}
        wholesaleData={[]}
        vendorName={vendor.name}
        vendorToken={token}
        allVendors={[]}
      />
    );
  }

  let allVendors: { id: number; name: string; token: string }[] = [];
  if (isStaff) {
    const vendors = await prisma.hojoVendor.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
      select: { id: true, name: true, accessToken: true },
    });
    allVendors = vendors.map((v) => ({ id: v.id, name: v.name, token: v.accessToken }));
  }

  // 助成金申請者管理データ（vendorIdで直接フィルタ。申請者管理ページがfree1→vendorIdを自動同期済み）
  const records = await prisma.hojoApplicationSupport.findMany({
    where: { vendorId: vendor.id, deletedAt: null },
    include: { lineFriend: true, status: true },
    orderBy: { lineFriendId: "asc" },
  });

  const applicantData = records.map((r) => ({
    id: r.id,
    lineName: r.lineFriend.snsname || "-",
    applicantName: r.applicantName || "-",
    statusName: r.status?.name || "-",
    formAnswerDate: r.formAnswerDate?.toISOString().slice(0, 10) ?? "-",
    subsidyDesiredDate: r.subsidyDesiredDate?.toISOString().slice(0, 10) ?? "",
    subsidyAmount: r.subsidyAmount,
    paymentReceivedAmount: r.paymentReceivedAmount,
    paymentReceivedDate: r.paymentReceivedDate?.toISOString().slice(0, 10) ?? "-",
    subsidyReceivedDate: r.subsidyReceivedDate?.toISOString().slice(0, 10) ?? "-",
    vendorMemo: r.vendorMemo || "",
  }));

  // 卸アカウント管理データ（ベンダー側削除されたものは非表示）
  const wholesaleRecords = await prisma.hojoWholesaleAccount.findMany({
    where: { vendorId: vendor.id, deletedAt: null, deletedByVendor: false },
    orderBy: { id: "asc" },
  });

  const wholesaleData = wholesaleRecords.map((r) => ({
    id: r.id,
    supportProviderName: r.supportProviderName || "",
    companyName: r.companyName || "",
    email: r.email || "",
    softwareSalesContractUrl: r.softwareSalesContractUrl || "",
    recruitmentRound: r.recruitmentRound,
    adoptionDate: r.adoptionDate?.toISOString().slice(0, 10) ?? "",
    issueRequestDate: r.issueRequestDate?.toISOString().slice(0, 10) ?? "",
    accountApprovalDate: r.accountApprovalDate?.toISOString().slice(0, 10) ?? "-",
    grantDate: r.grantDate?.toISOString().slice(0, 10) ?? "",
    toolCost: r.toolCost,
    invoiceStatus: r.invoiceStatus || "-",
  }));

  const userName = session?.user?.name || "";

  return (
    <VendorClientPage
      authenticated={true}
      isVendor={isVendor}
      canEdit={isVendor || staffCanEdit}
      applicantData={applicantData}
      wholesaleData={wholesaleData}
      vendorName={vendor.name}
      vendorToken={token}
      vendorId={vendor.id}
      allVendors={allVendors}
      userName={userName}
    />
  );
}
