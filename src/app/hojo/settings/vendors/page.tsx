import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VendorsTable } from "./vendors-table";
import { auth } from "@/auth";
import { canEditProjectMasterDataSync } from "@/lib/auth/master-data-permission";

export default async function VendorsPage() {
  const session = await auth();
  const canEdit = canEditProjectMasterDataSync(session?.user);

  const [vendors, lineFriends, joseiLineFriends, prolineAccounts] = await Promise.all([
    prisma.hojoVendor.findMany({
      orderBy: { displayOrder: "asc" },
      include: {
        lineFriend: true,
        joseiLineFriend: true,
        contacts: {
          include: {
            lineFriend: { select: { id: true, snsname: true } },
            joseiLineFriend: { select: { id: true, snsname: true } },
          },
          orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
        },
      },
    }),
    prisma.hojoLineFriendSecurityCloud.findMany({
      where: { deletedAt: null },
      orderBy: { id: "asc" },
    }),
    prisma.hojoLineFriendJoseiSupport.findMany({
      where: { deletedAt: null },
      orderBy: { id: "asc" },
    }),
    prisma.hojoProlineAccount.findMany({
      select: { lineType: true, label: true },
    }),
  ]);

  // プロラインアカウントのラベル
  const labelMap: Record<string, string> = {};
  for (const a of prolineAccounts) {
    labelMap[a.lineType] = a.label;
  }
  const scLabel = labelMap["security-cloud"] || "セキュリティクラウド";
  const joseiLabel = labelMap["josei-support"] || "助成金申請サポート";

  const lineFriendOptions = lineFriends.map((f) => ({
    value: String(f.id),
    label: `${f.id} ${f.snsname || "（名前なし）"}`,
  }));

  const joseiLineFriendOptions = joseiLineFriends.map((f) => ({
    value: String(f.id),
    label: `${f.id} ${f.snsname || "（名前なし）"}`,
  }));

  const data = vendors.map((v) => {
    // メイン担当者（isPrimary=trueの最初のcontact）
    const primaryContact = v.contacts.find((c) => c.isPrimary);

    return {
      id: v.id,
      name: v.name,
      accessToken: v.accessToken,
      memo: v.memo ?? "",
      displayOrder: v.displayOrder,
      isActive: v.isActive,
      // メイン担当者表示用
      primaryContactDisplay: primaryContact
        ? [
            primaryContact.lineFriendId ? String(primaryContact.lineFriendId) : null,
            primaryContact.lineFriend?.snsname || null,
            primaryContact.joseiLineFriendId ? String(primaryContact.joseiLineFriendId) : null,
          ].filter(Boolean).join(" ")
        : "-",
      // 担当者一覧
      contacts: v.contacts.map((c) => ({
        id: c.id,
        lineFriendId: c.lineFriendId,
        lineFriendName: c.lineFriend?.snsname || null,
        joseiLineFriendId: c.joseiLineFriendId,
        joseiLineFriendName: c.joseiLineFriend?.snsname || null,
        isPrimary: c.isPrimary,
      })),
      // 旧フィールド（編集ダイアログ用に残す）
      lineFriendId: v.lineFriendId ? String(v.lineFriendId) : "",
      joseiLineFriendId: v.joseiLineFriendId ? String(v.joseiLineFriendId) : "",
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
            lineFriendOptions={lineFriendOptions}
            joseiLineFriendOptions={joseiLineFriendOptions}
            scLabel={scLabel}
            joseiLabel={joseiLabel}
          />
        </CardContent>
      </Card>
    </div>
  );
}
