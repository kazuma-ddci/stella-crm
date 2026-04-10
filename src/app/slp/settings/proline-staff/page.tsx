import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canViewProjectMasterDataSync } from "@/lib/auth/master-data-permission";
import { redirect } from "next/navigation";
import { ProlineStaffTable } from "./proline-staff-table";

export default async function SlpProlineStaffPage() {
  const session = await auth();
  const user = session?.user;

  if (!canViewProjectMasterDataSync(user, "slp")) {
    redirect("/slp/dashboard");
  }

  const slpProject = await prisma.masterProject.findFirst({
    where: { code: "slp" },
    select: { id: true },
  });

  const [mappings, lineFriends, slpStaffPermissions] = await Promise.all([
    prisma.slpProlineStaffMapping.findMany({
      include: {
        lineFriend: { select: { id: true, snsname: true } },
        staff: { select: { id: true, name: true } },
      },
      orderBy: { id: "asc" },
    }),
    prisma.slpLineFriend.findMany({
      where: { deletedAt: null },
      select: { id: true, snsname: true },
      orderBy: { id: "asc" },
    }),
    slpProject
      ? prisma.staffPermission.findMany({
          where: {
            projectId: slpProject.id,
            permissionLevel: { in: ["view", "edit", "manager"] },
          },
          select: {
            staff: {
              select: { id: true, name: true, isActive: true, isSystemUser: true },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const data = mappings.map((m) => ({
    id: m.id,
    prolineStaffName: m.prolineStaffName,
    lineFriendId: m.lineFriendId,
    lineFriendLabel: m.lineFriend
      ? `${m.lineFriend.id} ${m.lineFriend.snsname ?? ""}`.trim()
      : null,
    staffId: m.staffId,
    staffName: m.staff?.name ?? null,
  }));

  const lineFriendOptions = lineFriends.map((f) => ({
    id: f.id,
    label: `${f.id} ${f.snsname ?? ""}`.trim(),
  }));

  const staffOptions = slpStaffPermissions
    .filter((p) => p.staff.isActive && !p.staff.isSystemUser)
    .map((p) => ({ id: p.staff.id, name: p.staff.name }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">プロライン担当者マッピング</h1>
        <p className="text-sm text-muted-foreground mt-1">
          プロラインから送られてくる「概要案内担当者」「導入希望商談担当者」の名前を、公式LINE友達およびスタッフに紐付けます。
          このマッピングは概要案内・導入希望商談 両方の予約Webhookで共用されます。
        </p>
      </div>
      <ProlineStaffTable
        data={data}
        lineFriendOptions={lineFriendOptions}
        staffOptions={staffOptions}
      />
    </div>
  );
}
