"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, LogOut, Loader2, LineChart } from "lucide-react";

interface StpCompanyData {
  id: number;
  currentStage: string | null;
  forecast: string | null;
  meetingDate: string | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  progressDetail: string | null;
  salesStaff: string | null;
}

export default function PortalStpClientPage() {
  const { data: session, status } = useSession();
  const [data, setData] = useState<StpCompanyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session?.user as any;
  const companyName = user?.companyName ?? "";

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/portal/stp/client");
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "データの取得に失敗しました");
        }

        setData(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "エラーが発生しました");
      } finally {
        setLoading(false);
      }
    }

    if (status === "authenticated") {
      fetchData();
    }
  }, [status]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/portal">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                戻る
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold">採用ブースト</h1>
              <p className="text-sm text-gray-500">{companyName}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.name}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="h-4 w-4 mr-2" />
              ログアウト
            </Button>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* ナビゲーション */}
        <div className="flex gap-2">
          <Link href="/portal/stp/client/kpi">
            <Button variant="outline">
              <LineChart className="h-4 w-4 mr-2" />
              運用KPIシート
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>プロジェクト状況</CardTitle>
            <CardDescription>
              {companyName}の採用ブースト利用状況
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="text-red-600 mb-4">
                エラー: {error}
              </div>
            )}

            {data.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                現在登録されているプロジェクトはありません
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ステージ</TableHead>
                    <TableHead>ヨミ</TableHead>
                    <TableHead>初回商談日</TableHead>
                    <TableHead>契約期間</TableHead>
                    <TableHead>進捗詳細</TableHead>
                    <TableHead>担当営業</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Badge variant="outline">
                          {item.currentStage || "-"}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.forecast || "-"}</TableCell>
                      <TableCell>
                        {item.meetingDate
                          ? new Date(item.meetingDate).toLocaleDateString(
                              "ja-JP"
                            )
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {item.contractStartDate && item.contractEndDate
                          ? `${new Date(item.contractStartDate).toLocaleDateString("ja-JP")} 〜 ${new Date(item.contractEndDate).toLocaleDateString("ja-JP")}`
                          : "-"}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {item.progressDetail || "-"}
                      </TableCell>
                      <TableCell>{item.salesStaff || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
