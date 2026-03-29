import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomersTable } from "./customers-table";

export default async function SecurityCloudCustomersPage() {
  // TODO: DB構造確定後にデータ取得を実装
  const data: Record<string, unknown>[] = [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">セキュリティクラウド卸管理 — 顧客リスト</h1>
      <Card>
        <CardHeader>
          <CardTitle>顧客リスト</CardTitle>
        </CardHeader>
        <CardContent>
          <CustomersTable data={data} />
        </CardContent>
      </Card>
    </div>
  );
}
