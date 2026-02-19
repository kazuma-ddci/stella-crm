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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, LogOut, Loader2, Download } from "lucide-react";
import { isInvalidJobMedia } from "@/lib/stp/job-media";

interface ContractData {
  id: number;
  signedDate: string | null;
  startDate: string | null;
  endDate: string | null;
  filePath: string | null;
  fileName: string | null;
}

interface ContractHistoryData {
  id: number;
  industryType: string;
  contractPlan: string;
  jobMedia: string | null;
  contractStartDate: string;
  contractEndDate: string | null;
  initialFee: number;
  monthlyFee: number;
  performanceFee: number;
  salesStaffName: string | null;
  operationStaffName: string | null;
  status: string;
  operationStatus: string | null;
}

const industryTypeLabelMap: Record<string, string> = {
  general: "一般",
  dispatch: "派遣",
};

const contractPlanLabelMap: Record<string, string> = {
  monthly: "月額",
  performance: "成果報酬",
};

const statusLabelMap: Record<string, string> = {
  active: "契約中",
  cancelled: "解約",
  dormant: "休眠",
};

function formatCurrency(value: number): string {
  return value.toLocaleString("ja-JP", { style: "currency", currency: "JPY" });
}

export default function PortalContractsPage() {
  const { data: session, status } = useSession();
  const [contracts, setContracts] = useState<ContractData[]>([]);
  const [contractHistories, setContractHistories] = useState<ContractHistoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session?.user as any;
  const companyName = user?.companyName ?? "";

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch("/api/portal/stp/client/contracts");
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "データの取得に失敗しました");
      }

      setContracts(result.contracts);
      setContractHistories(result.contractHistories);
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
              <h1 className="text-xl font-bold">契約情報</h1>
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
        {error && (
          <div className="text-red-600 mb-4 p-4 bg-red-50 rounded-md">
            エラー: {error}
          </div>
        )}

        {/* 契約書情報 */}
        <Card>
          <CardHeader>
            <CardTitle>契約書情報</CardTitle>
            <CardDescription>契約書の一覧です</CardDescription>
          </CardHeader>
          <CardContent>
            {contracts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                契約書情報はありません
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>契約締結日</TableHead>
                    <TableHead>契約開始日</TableHead>
                    <TableHead>契約終了日</TableHead>
                    <TableHead>契約書ファイル</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.map((contract) => (
                    <TableRow key={contract.id}>
                      <TableCell>{contract.signedDate || "-"}</TableCell>
                      <TableCell>{contract.startDate || "-"}</TableCell>
                      <TableCell>{contract.endDate || "-"}</TableCell>
                      <TableCell>
                        {contract.filePath ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(contract.filePath!, "_blank")}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            {contract.fileName || "ダウンロード"}
                          </Button>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* 契約履歴 */}
        <Card>
          <CardHeader>
            <CardTitle>契約履歴</CardTitle>
            <CardDescription>契約プランの履歴です</CardDescription>
          </CardHeader>
          <CardContent>
            {contractHistories.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                契約履歴はありません
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>業種区分</TableHead>
                      <TableHead>契約プラン</TableHead>
                      <TableHead>求人媒体</TableHead>
                      <TableHead>契約開始日</TableHead>
                      <TableHead>契約終了日</TableHead>
                      <TableHead>初期費用</TableHead>
                      <TableHead>月額</TableHead>
                      <TableHead>成果報酬単価</TableHead>
                      <TableHead>担当営業</TableHead>
                      <TableHead>担当運用</TableHead>
                      <TableHead>ステータス</TableHead>
                      <TableHead>運用ステータス</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contractHistories.map((history) => (
                      <TableRow key={history.id}>
                        <TableCell>
                          {industryTypeLabelMap[history.industryType] || history.industryType}
                        </TableCell>
                        <TableCell>
                          {contractPlanLabelMap[history.contractPlan] || history.contractPlan}
                        </TableCell>
                        <TableCell>
                          {history.jobMedia
                            ? isInvalidJobMedia(history.jobMedia)
                              ? <span className="text-red-600 font-medium">{"\u26A0"} {history.jobMedia}</span>
                              : history.jobMedia
                            : "-"}
                        </TableCell>
                        <TableCell>{history.contractStartDate}</TableCell>
                        <TableCell>{history.contractEndDate || "-"}</TableCell>
                        <TableCell>{formatCurrency(history.initialFee)}</TableCell>
                        <TableCell>{formatCurrency(history.monthlyFee)}</TableCell>
                        <TableCell>{formatCurrency(history.performanceFee)}</TableCell>
                        <TableCell>{history.salesStaffName || "-"}</TableCell>
                        <TableCell>{history.operationStaffName || "-"}</TableCell>
                        <TableCell>
                          {statusLabelMap[history.status] || history.status}
                        </TableCell>
                        <TableCell>{history.operationStatus || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
