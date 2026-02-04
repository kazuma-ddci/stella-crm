import { notFound } from "next/navigation";
import { getKpiSheetByToken } from "@/app/stp/companies/[id]/kpi/actions";
import { KpiTable } from "@/components/kpi-sheet";
import { KpiWeeklyData } from "@/components/kpi-sheet/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, AlertTriangle } from "lucide-react";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function SharedKpiPage({ params }: PageProps) {
  const { token } = await params;
  const result = await getKpiSheetByToken(token);

  if ("error" in result) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <AlertTriangle className="h-12 w-12 text-yellow-500" />
              </div>
              <h1 className="text-xl font-bold">アクセスできません</h1>
              <p className="text-muted-foreground">{result.error}</p>
              <p className="text-sm text-muted-foreground">
                共有リンクが無効か、有効期限が切れています。
                <br />
                新しいリンクを発行してもらってください。
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { sheet, expiresAt } = result;

  // 有効期限のフォーマット（日本時間）
  const formatExpiry = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">{sheet.name}</h1>
              <p className="text-sm text-muted-foreground">
                {sheet.companyName}
              </p>
            </div>
            <Badge variant="outline" className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatExpiry(expiresAt)}まで有効
            </Badge>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="container mx-auto px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle>運用KPIシート</CardTitle>
            <CardDescription>
              週次の目標・実績・差分を確認できます
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sheet.weeklyData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                データがありません
              </div>
            ) : (
              <KpiTable
                weeklyData={sheet.weeklyData as KpiWeeklyData[]}
                editable={false}
              />
            )}
          </CardContent>
        </Card>

        {/* フッター */}
        <div className="text-center text-sm text-muted-foreground mt-6">
          <p>このページは共有リンク経由で閲覧しています</p>
          <p>有効期限: {formatExpiry(expiresAt)}</p>
        </div>
      </main>
    </div>
  );
}
