import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VendorsTable } from "./vendors-table";
import { auth } from "@/auth";
import { canEditProjectMasterDataSync } from "@/lib/auth/master-data-permission";

export default async function VendorsPage() {
  const session = await auth();
  const canEdit = canEditProjectMasterDataSync(session?.user);

  const vendors = await prisma.hojoVendor.findMany({
    orderBy: { displayOrder: "asc" },
    include: { lineFriend: true, joseiLineFriend: true },
  });

  // セキュリティクラウドLINE友達の選択肢
  const lineFriends = await prisma.hojoLineFriendSecurityCloud.findMany({
    where: { deletedAt: null },
    orderBy: { id: "asc" },
  });

  const lineFriendOptions = lineFriends.map((f) => ({
    value: String(f.id),
    label: `${f.id} ${f.snsname || "（名前なし）"}`,
  }));

  // 助成金申請サポートLINE友達の選択肢
  const joseiLineFriends = await prisma.hojoLineFriendJoseiSupport.findMany({
    where: { deletedAt: null },
    orderBy: { id: "asc" },
  });

  const joseiLineFriendOptions = joseiLineFriends.map((f) => ({
    value: String(f.id),
    label: `${f.id} ${f.snsname || "（名前なし）"}`,
  }));

  // uid→LINE友達マップ（紹介者の解決用）
  const uidToFriend = new Map(
    lineFriends.map((f) => [f.uid, { id: f.id, snsname: f.snsname }])
  );

  // lineFriendId→紹介者表示名マップ
  const referrerMap: Record<string, string> = {};
  for (const f of lineFriends) {
    if (f.free1) {
      const referrer = uidToFriend.get(f.free1);
      if (referrer) {
        referrerMap[String(f.id)] = `${referrer.id} ${referrer.snsname || "（名前なし）"}`;
      }
    }
  }

  const data = vendors.map((v) => ({
    id: v.id,
    lineFriendId: v.lineFriendId ? String(v.lineFriendId) : "",
    lineNo: v.lineFriendId ?? null,
    lineName: v.lineFriend?.snsname || "",
    referrer: v.lineFriendId ? (referrerMap[String(v.lineFriendId)] || "-") : "-",
    name: v.name,
    accessToken: v.accessToken,
    joseiLineFriendId: v.joseiLineFriendId ? String(v.joseiLineFriendId) : "",
    memo: v.memo ?? "",
    displayOrder: v.displayOrder,
    isActive: v.isActive,
  }));

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
            lineFriendOptions={lineFriendOptions}
            joseiLineFriendOptions={joseiLineFriendOptions}
            referrerMap={referrerMap}
          />
        </CardContent>
      </Card>
    </div>
  );
}
