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
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, LogOut, Loader2, Copy, Check, Link2 } from "lucide-react";
import { toast } from "sonner";

interface ReferredCompanyData {
  id: number;
  companyName: string;
  currentStage: string | null;
  forecast: string | null;
  meetingDate: string | null;
  leadAcquiredDate: string | null;
  progressDetail: string | null;
}

interface LeadFormData {
  token: string | null;
  status: string;
  message?: string;
}

export default function PortalStpAgentPage() {
  const { data: session, status } = useSession();
  const [data, setData] = useState<ReferredCompanyData[]>([]);
  const [leadFormData, setLeadFormData] = useState<LeadFormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session?.user as any;
  const companyName = user?.companyName ?? "";

  useEffect(() => {
    async function fetchData() {
      try {
        const [companyResponse, leadFormResponse] = await Promise.all([
          fetch("/api/portal/stp/agent"),
          fetch("/api/portal/stp/agent/lead-form"),
        ]);

        const companyResult = await companyResponse.json();
        if (!companyResponse.ok) {
          throw new Error(companyResult.error || "データの取得に失敗しました");
        }
        setData(companyResult.data);

        // リードフォームはエラーでも続行
        if (leadFormResponse.ok) {
          const leadFormResult = await leadFormResponse.json();
          setLeadFormData(leadFormResult);
        }
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

  const getLeadFormUrl = () => {
    if (!leadFormData?.token) return "";
    return `${window.location.origin}/form/stp-lead/${leadFormData.token}`;
  };

  const copyLeadFormUrl = async () => {
    const url = getLeadFormUrl();
    if (!url) return;

    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("URLをコピーしました");
    setTimeout(() => setCopied(false), 2000);
  };

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
              <h1 className="text-xl font-bold">紹介先管理</h1>
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
        {/* リード獲得フォームURL */}
        {leadFormData && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                リード獲得フォームURL
              </CardTitle>
              <CardDescription>
                このURLを顧客企業にお渡しください。フォームから問い合わせがあると自動的に紹介先として登録されます。
              </CardDescription>
            </CardHeader>
            <CardContent>
              {leadFormData.token ? (
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={getLeadFormUrl()}
                    className="font-mono text-sm"
                  />
                  <Button onClick={copyLeadFormUrl} variant="outline">
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  {leadFormData.message || "リード獲得フォームが利用できません"}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>紹介先企業一覧</CardTitle>
            <CardDescription>
              {companyName}からご紹介いただいた企業の採用ブースト利用状況
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
                現在紹介先として登録されている企業はありません
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>企業名</TableHead>
                    <TableHead>パイプライン</TableHead>
                    <TableHead>ヨミ</TableHead>
                    <TableHead>リード獲得日</TableHead>
                    <TableHead>初回商談日</TableHead>
                    <TableHead>進捗詳細</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.companyName}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {item.currentStage || "-"}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.forecast || "-"}</TableCell>
                      <TableCell>
                        {item.leadAcquiredDate
                          ? new Date(item.leadAcquiredDate).toLocaleDateString(
                              "ja-JP"
                            )
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {item.meetingDate
                          ? new Date(item.meetingDate).toLocaleDateString(
                              "ja-JP"
                            )
                          : "-"}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {item.progressDetail || "-"}
                      </TableCell>
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
