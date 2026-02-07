import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const importStatusLabel: Record<string, string> = {
  processing: "処理中",
  completed: "完了",
  error: "エラー",
};

const importStatusColor: Record<string, string> = {
  processing: "bg-yellow-100 text-yellow-800 border-yellow-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  error: "bg-red-100 text-red-600 border-red-200",
};

export default async function AccountingImportsPage() {
  const batches = await prisma.accountingImportBatch.findMany({
    orderBy: { importedAt: "desc" },
    include: { importer: true },
  });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">取込管理</h1>

      <Card>
        <CardHeader>
          <CardTitle>取込データ</CardTitle>
        </CardHeader>
        <CardContent>
          {batches.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              取込データがありません
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="px-3 py-2 font-medium">取込日時</th>
                    <th className="px-3 py-2 font-medium">ソース</th>
                    <th className="px-3 py-2 font-medium">サービス</th>
                    <th className="px-3 py-2 font-medium">ファイル名</th>
                    <th className="px-3 py-2 font-medium">対象期間</th>
                    <th className="px-3 py-2 font-medium text-right">
                      総件数
                    </th>
                    <th className="px-3 py-2 font-medium text-right">新規</th>
                    <th className="px-3 py-2 font-medium text-right">重複</th>
                    <th className="px-3 py-2 font-medium">ステータス</th>
                    <th className="px-3 py-2 font-medium">取込者</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((batch) => (
                    <tr key={batch.id} className="border-b hover:bg-muted/50">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {new Date(batch.importedAt).toLocaleString("ja-JP")}
                      </td>
                      <td className="px-3 py-2">{batch.source}</td>
                      <td className="px-3 py-2">
                        {batch.sourceService ?? "-"}
                      </td>
                      <td className="px-3 py-2 max-w-[200px] truncate">
                        {batch.fileName ?? "-"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {batch.periodFrom && batch.periodTo
                          ? `${new Date(batch.periodFrom).toLocaleDateString("ja-JP")} 〜 ${new Date(batch.periodTo).toLocaleDateString("ja-JP")}`
                          : "-"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {batch.totalCount.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {batch.newCount.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {batch.duplicateCount.toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        <Badge
                          variant="outline"
                          className={
                            importStatusColor[batch.status] ?? ""
                          }
                        >
                          {importStatusLabel[batch.status] ?? batch.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        {batch.importer?.name ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
