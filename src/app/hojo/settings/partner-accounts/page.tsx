import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { PartnerAccountsTabs } from "./partner-accounts-tabs";

export default async function PartnerAccountsPage() {
  const user = await getSession();

  const [bbsAccounts, vendorAccounts, vendors] = await Promise.all([
    prisma.hojoBbsAccount.findMany({
      include: { approver: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.hojoVendorAccount.findMany({
      include: {
        vendor: { select: { id: true, name: true, accessToken: true } },
        approver: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.hojoVendor.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
      select: { id: true, name: true, accessToken: true },
    }),
  ]);

  const bbsData = bbsAccounts.map((a) => ({
    id: a.id,
    name: a.name,
    email: a.email,
    status: a.status,
    mustChangePassword: a.mustChangePassword,
    passwordResetRequestedAt: a.passwordResetRequestedAt?.toISOString() ?? null,
    approvedAt: a.approvedAt?.toISOString().slice(0, 10) ?? null,
    approverName: a.approver?.name ?? null,
    lastLoginAt: a.lastLoginAt?.toISOString().slice(0, 16).replace("T", " ") ?? null,
    createdAt: a.createdAt.toISOString().slice(0, 10),
  }));

  const vendorData = vendorAccounts.map((a) => ({
    id: a.id,
    vendorId: a.vendorId,
    vendorName: a.vendor.name,
    name: a.name,
    email: a.email,
    status: a.status,
    mustChangePassword: a.mustChangePassword,
    passwordResetRequestedAt: a.passwordResetRequestedAt?.toISOString() ?? null,
    approvedAt: a.approvedAt?.toISOString().slice(0, 10) ?? null,
    approverName: a.approver?.name ?? null,
    lastLoginAt: a.lastLoginAt?.toISOString().slice(0, 16).replace("T", " ") ?? null,
    createdAt: a.createdAt.toISOString().slice(0, 10),
  }));

  const vendorList = vendors.map((v) => ({
    id: v.id,
    name: v.name,
    accessToken: v.accessToken,
  }));

  const bbsPendingCount = bbsAccounts.filter((a) => a.status === "pending_approval").length;
  const vendorPendingCount = vendorAccounts.filter((a) => a.status === "pending_approval").length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">他社アカウント管理</h1>
      <PartnerAccountsTabs
        bbsData={bbsData}
        vendorData={vendorData}
        vendorList={vendorList}
        staffId={user.id}
        bbsPendingCount={bbsPendingCount}
        vendorPendingCount={vendorPendingCount}
      />
    </div>
  );
}
