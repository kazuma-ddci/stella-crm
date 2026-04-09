import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { AgencyDetail } from "./agency-detail";
import { resolveAgencyAs } from "../actions";

function toDateString(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

type Props = {
  params: Promise<{ id: string }>;
};

export default async function SlpAgencyDetailPage({ params }: Props) {
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) notFound();

  const [agency, lineFriends, contractStatuses] = await Promise.all([
    prisma.slpAgency.findFirst({
      where: { id, deletedAt: null },
      include: {
        contractStatus: { select: { id: true, name: true } },
        contacts: {
          include: {
            lineFriend: { select: { id: true, snsname: true, uid: true } },
          },
          orderBy: { id: "asc" },
        },
        parent: { select: { id: true, name: true } },
        children: {
          where: { deletedAt: null },
          include: {
            contacts: {
              include: {
                lineFriend: { select: { id: true, snsname: true } },
              },
              orderBy: { id: "asc" },
            },
          },
          orderBy: { id: "asc" },
        },
      },
    }),
    prisma.slpLineFriend.findMany({
      where: { deletedAt: null },
      select: { id: true, snsname: true, uid: true },
      orderBy: { id: "asc" },
    }),
    prisma.slpAgencyContractStatus.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    }),
  ]);

  if (!agency) notFound();

  // 担当ASの解決
  const asResolutions = await resolveAgencyAs(agency.id);

  // 子代理店それぞれの担当ASも解決
  const childAsMap = new Map<
    number,
    Awaited<ReturnType<typeof resolveAgencyAs>>
  >();
  for (const child of agency.children) {
    const result = await resolveAgencyAs(child.id);
    childAsMap.set(child.id, result);
  }

  const data = {
    id: agency.id,
    name: agency.name,
    corporateName: agency.corporateName ?? "",
    email: agency.email ?? "",
    phone: agency.phone ?? "",
    address: agency.address ?? "",
    contractStatusId: agency.contractStatusId,
    contractStatusName: agency.contractStatus?.name ?? null,
    contractStartDate: toDateString(agency.contractStartDate),
    contractEndDate: toDateString(agency.contractEndDate),
    notes: agency.notes ?? "",
    parentId: agency.parentId,
    parentName: agency.parent?.name ?? null,
    contacts: agency.contacts.map((c) => ({
      id: c.id,
      name: c.name,
      role: c.role ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
      lineFriendId: c.lineFriendId,
      lineFriendLabel: c.lineFriend
        ? `${c.lineFriend.id} ${c.lineFriend.snsname ?? ""}`.trim()
        : null,
    })),
    children: agency.children.map((child) => ({
      id: child.id,
      name: child.name,
      notes: child.notes ?? "",
      contacts: child.contacts.map((c) => ({
        id: c.id,
        name: c.name,
        role: c.role ?? "",
        email: c.email ?? "",
        phone: c.phone ?? "",
        lineFriendId: c.lineFriendId,
        lineFriendLabel: c.lineFriend
          ? `${c.lineFriend.id} ${c.lineFriend.snsname ?? ""}`.trim()
          : null,
      })),
      asResolutions: childAsMap.get(child.id) ?? [],
    })),
    asResolutions,
  };

  const lineFriendOptions = lineFriends.map((f) => ({
    id: f.id,
    label: `${f.id} ${f.snsname ?? ""}`.trim(),
  }));

  const contractStatusOptions = contractStatuses.map((s) => ({
    id: s.id,
    name: s.name,
  }));

  return (
    <AgencyDetail
      agency={data}
      lineFriendOptions={lineFriendOptions}
      contractStatusOptions={contractStatusOptions}
    />
  );
}
