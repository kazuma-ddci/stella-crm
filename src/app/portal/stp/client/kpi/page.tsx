"use client";

import { useState, useEffect, useCallback } from "react";
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
import { KpiTable } from "@/components/kpi-sheet";
import { KpiWeeklyData } from "@/components/kpi-sheet/types";
import { ArrowLeft, LogOut, Loader2, LineChart } from "lucide-react";

interface KpiSheet {
  id: number;
  name: string;
  stpCompanyId: number;
  weeklyData: KpiWeeklyData[];
  createdAt: string;
  updatedAt: string;
}

export default function PortalKpiPage() {
  const { data: session, status } = useSession();
  const [sheets, setSheets] = useState<KpiSheet[]>([]);
  const [selectedSheetId, setSelectedSheetId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session?.user as any;
  const companyName = user?.companyName ?? "";

  // データ取得
  const fetchData = useCallback(async () => {
    try {
      const response = await fetch("/api/portal/stp/client/kpi");
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "データの取得に失敗しました");
      }

      setSheets(result.data);
      if (result.data.length > 0) {
        setSelectedSheetId(result.data[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      fetchData();
    }
  }, [status, fetchData]);

  const selectedSheet = sheets.find((s) => s.id === selectedSheetId);

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
            <Link href="/portal/stp/client">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                戻る
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold">運用KPIシート</h1>
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
      <main className="container mx-auto px-4 py-8">
        {error && (
          <div className="text-red-600 mb-4 p-4 bg-red-50 rounded-md">
            エラー: {error}
          </div>
        )}

        {sheets.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <LineChart className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p>KPIシートがありません</p>
              <p className="text-sm mt-2">
                担当者がKPIシートを作成すると、ここに表示されます
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* シート一覧（サイドバー） */}
            <div className="lg:col-span-1 space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground mb-2">
                シート一覧
              </h2>
              {sheets.map((sheet) => (
                <Card
                  key={sheet.id}
                  className={`cursor-pointer transition-colors ${
                    selectedSheetId === sheet.id
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  }`}
                  onClick={() => setSelectedSheetId(sheet.id)}
                >
                  <CardContent className="p-3">
                    <span className="font-medium text-sm">{sheet.name}</span>
                    <p className="text-xs text-muted-foreground mt-1">
                      {sheet.weeklyData.length}週のデータ
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* メインコンテンツ */}
            <div className="lg:col-span-3">
              {selectedSheet && (
                <Card>
                  <CardHeader>
                    <CardTitle>{selectedSheet.name}</CardTitle>
                    <CardDescription>
                      週次の目標・実績・差分を確認できます（閲覧のみ）
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {selectedSheet.weeklyData.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        データがありません
                      </div>
                    ) : (
                      <KpiTable
                        weeklyData={selectedSheet.weeklyData}
                        editable={false}
                      />
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
