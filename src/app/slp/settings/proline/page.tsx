import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProlineTable } from "./proline-table";
import { auth } from "@/auth";
import { canEditProjectMasterDataSync } from "@/lib/auth/master-data-permission";

export default async function SlpProlinePage() {
  const session = await auth();
  const canEdit = canEditProjectMasterDataSync(session?.user);

  const accounts = await prisma.slpProlineAccount.findMany({
    orderBy: { id: "asc" },
  });

  const data = accounts.map((a) => ({
    id: a.id,
    label: a.label,
    email: a.email,
    password: a.password,
    loginUrl: a.loginUrl ?? "",
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">プロライン情報</h1>
      <Card>
        <CardHeader>
          <CardTitle>プロラインアカウント一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <ProlineTable data={data} canEdit={canEdit} />
        </CardContent>
      </Card>
    </div>
  );
}
