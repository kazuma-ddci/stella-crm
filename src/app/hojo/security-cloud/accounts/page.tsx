import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AccountsTable } from "./accounts-table";

export default async function SecurityCloudAccountsPage() {
  // TODO: DB構造確定後にデータ取得を実装
  const data: Record<string, unknown>[] = [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">セキュリティクラウド卸管理 — アカウント管理</h1>
      <Card>
        <CardHeader>
          <CardTitle>アカウント管理</CardTitle>
        </CardHeader>
        <CardContent>
          <AccountsTable data={data} />
        </CardContent>
      </Card>
    </div>
  );
}
