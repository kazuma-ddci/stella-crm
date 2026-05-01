import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TransactionsTable } from "./transactions-table";
import { listTransactions, listDeletedTransactions } from "./actions";
import { getSystemProjectContext } from "@/lib/project-context";

export default async function TransactionsPage() {
  const ctx = await getSystemProjectContext("stp");
  if (!ctx) throw new Error("STPプロジェクトのコンテキストが取得できません");
  const projectId = ctx.projectId;
  const [data, deletedData] = await Promise.all([
    listTransactions(undefined, undefined, projectId),
    listDeletedTransactions(projectId),
  ]);

  // 取引先オプション（重複除去）
  const counterpartyMap = new Map<string, string>();
  for (const r of data) {
    counterpartyMap.set(String(r.counterpartyId), r.counterpartyName);
  }
  const counterpartyOptions = Array.from(counterpartyMap.entries()).map(
    ([value, label]) => ({ value, label })
  );

  // サマリー計算
  const calcTaxIncluded = (r: { amount: number; taxAmount: number; taxType: string }) =>
    r.taxType === "tax_excluded" ? r.amount + r.taxAmount : r.amount;
  const totalRevenue = data
    .filter((r) => r.type === "revenue")
    .reduce((sum, r) => sum + calcTaxIncluded(r), 0);
  const totalExpense = data
    .filter((r) => r.type === "expense")
    .reduce((sum, r) => sum + calcTaxIncluded(r), 0);
  const unconfirmedCount = data.filter((r) => r.status === "unconfirmed").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">取引台帳</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          売上・支払トラッカーで作成した取引の検索、監査、例外修正、削除済み確認を行います。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">売上合計（税込）</div>
            <div className="text-2xl font-bold text-emerald-600">
              ¥{totalRevenue.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">経費合計（税込）</div>
            <div className="text-2xl font-bold text-rose-600">
              ¥{totalExpense.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">未確定</div>
            <div className="text-2xl font-bold text-orange-600">
              {unconfirmedCount}件
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>取引台帳</CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionsTable
            data={data}
            deletedData={deletedData}
            counterpartyOptions={counterpartyOptions}
          />
        </CardContent>
      </Card>
    </div>
  );
}
