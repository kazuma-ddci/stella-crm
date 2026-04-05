import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VendorsTable } from "./vendors-table";
import { auth } from "@/auth";
import { canEditProjectMasterDataSync } from "@/lib/auth/master-data-permission";

export default async function VendorsPage() {
  const session = await auth();
  const canEdit = canEditProjectMasterDataSync(session?.user);

  // hojoプロジェクトのedit/manager権限を持つスタッフを取得
  const hojoProject = await prisma.masterProject.findFirst({ where: { code: "hojo" } });
  const staffWithHojoPermission = hojoProject
    ? await prisma.masterStaff.findMany({
        where: {
          isActive: true,
          isSystemUser: false,
          permissions: { some: { projectId: hojoProject.id, permissionLevel: { in: ["edit", "manager"] } } },
        },
        orderBy: { displayOrder: "asc" },
        select: { id: true, name: true },
      })
    : [];

  const staffOptions = staffWithHojoPermission.map((s) => ({
    value: String(s.id),
    label: s.name,
  }));

  const [vendors, scLineFriends] = await Promise.all([
    prisma.hojoVendor.findMany({
      orderBy: { displayOrder: "asc" },
      include: {
        consultingStaff: {
          include: { staff: { select: { id: true, name: true } } },
        },
        assignedAsLineFriend: {
          select: { id: true, sei: true, mei: true, snsname: true },
        },
        contacts: {
          include: {
            lineFriend: { select: { id: true, uid: true, free1: true, snsname: true } },
          },
          orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
        },
      },
    }),
    prisma.hojoLineFriendSecurityCloud.findMany({
      where: { deletedAt: null },
      orderBy: { id: "asc" },
      select: { id: true, uid: true, sei: true, mei: true, snsname: true, userType: true, free1: true },
    }),
  ]);

  // セキュリティクラウドLINEからASユーザーを検出するためのマップ
  const scByUid = new Map(scLineFriends.map((f) => [f.uid, f]));

  // 担当AS selectオプション（ASタイプのLINE友達）
  const asLineFriends = scLineFriends.filter((f) => f.userType === "AS");
  const scLineFriendOptions = asLineFriends.map((f) => ({
    value: String(f.id),
    label: `${f.id} ${f.snsname || ""}(${f.sei || ""} ${f.mei || ""})`.trim(),
  }));

  const data = vendors.map((v) => {
    // コンサル担当者
    const consultingStaffNames = v.consultingStaff.map((cs) => cs.staff.name);
    const consultingStaffIds = v.consultingStaff.map((cs) => String(cs.staff.id));

    // 担当AS: 手動設定 or 自動検出
    let assignedAsDisplay = "-";
    if (v.assignedAsLineFriendId && v.assignedAsLineFriend) {
      const as = v.assignedAsLineFriend;
      assignedAsDisplay = `${as.id} ${as.snsname || ""}(${as.sei || ""} ${as.mei || ""})`.trim();
    } else {
      // 自動検出: vendorのcontactのlineFriend.free1 → セキュリティクラウドLINEのuid → userType=AS
      for (const c of v.contacts) {
        if (c.lineFriend?.free1) {
          const asFriend = scByUid.get(c.lineFriend.free1);
          if (asFriend && asFriend.userType === "AS") {
            assignedAsDisplay = `${asFriend.id} ${asFriend.snsname || ""}(${asFriend.sei || ""} ${asFriend.mei || ""})`.trim();
            break;
          }
        }
      }
    }

    return {
      id: v.id,
      name: v.name,
      accessToken: v.accessToken,
      consultingStaffDisplay: consultingStaffNames.join(", ") || "-",
      consultingStaffIds: consultingStaffIds.join(","),
      assignedAsDisplay,
      assignedAsLineFriendId: v.assignedAsLineFriendId ? String(v.assignedAsLineFriendId) : "",
      memo: v.memo ?? "",
      displayOrder: v.displayOrder,
      isActive: v.isActive,
    };
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">ベンダー</h1>
      <Card>
        <CardHeader>
          <CardTitle>ベンダー一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <VendorsTable
            data={data}
            canEdit={canEdit}
            staffOptions={staffOptions}
            scLineFriendOptions={scLineFriendOptions}
          />
        </CardContent>
      </Card>
    </div>
  );
}
