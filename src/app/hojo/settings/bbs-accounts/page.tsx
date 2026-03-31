import { prisma } from "@/lib/prisma";
import { BbsAccountsTable } from "./bbs-accounts-table";
import { getSession } from "@/lib/auth/session";

export default async function BbsAccountsPage() {
  const user = await getSession();

  const accounts = await prisma.hojoBbsAccount.findMany({
    include: { approver: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const data = accounts.map((a) => ({
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">BBS社アカウント管理</h1>
      <BbsAccountsTable data={data} staffId={user.id} />
    </div>
  );
}
