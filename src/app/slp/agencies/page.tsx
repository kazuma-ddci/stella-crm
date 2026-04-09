import { prisma } from "@/lib/prisma";
import { AgenciesTable } from "./agencies-table";
import { resolveAgencyAs } from "./actions";

function toDateString(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

export default async function SlpAgenciesPage() {
  const [agencies, contractStatuses] = await Promise.all([
    prisma.slpAgency.findMany({
      where: { deletedAt: null },
      include: {
        contractStatus: { select: { id: true, name: true } },
        contacts: {
          include: {
            lineFriend: { select: { id: true, snsname: true, uid: true } },
          },
          orderBy: { id: "asc" },
        },
        parent: { select: { id: true, name: true } },
      },
      orderBy: { id: "asc" },
    }),
    prisma.slpAgencyContractStatus.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    }),
  ]);

  // 全代理店の担当AS情報を一括解決
  const asResolutionMap = new Map<
    number,
    Array<{
      contactId: number;
      contactName: string;
      asName: string | null;
    }>
  >();

  for (const agency of agencies) {
    if (agency.contacts.some((c) => c.lineFriendId)) {
      const asResults = await resolveAgencyAs(agency.id);
      asResolutionMap.set(agency.id, asResults);
    }
  }

  const data = agencies.map((a) => ({
    id: a.id,
    name: a.name,
    corporateName: a.corporateName,
    email: a.email,
    phone: a.phone,
    address: a.address,
    contractStatusName: a.contractStatus?.name ?? null,
    contractStartDate: toDateString(a.contractStartDate),
    contractEndDate: toDateString(a.contractEndDate),
    notes: a.notes,
    parentId: a.parentId,
    parentName: a.parent?.name ?? null,
    contacts: a.contacts.map((c) => ({
      id: c.id,
      name: c.name,
      role: c.role,
      lineFriendLabel: c.lineFriend
        ? `${c.lineFriend.id} ${c.lineFriend.snsname ?? ""}`.trim()
        : null,
    })),
    asResolutions: asResolutionMap.get(a.id) ?? [],
  }));

  const contractStatusOptions = contractStatuses.map((s) => ({
    id: s.id,
    name: s.name,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">代理店管理</h1>
      <AgenciesTable
        data={data}
        contractStatusOptions={contractStatusOptions}
      />
    </div>
  );
}
