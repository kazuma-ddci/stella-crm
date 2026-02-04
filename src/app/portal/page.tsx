"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Users, FileText, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export default function PortalPage() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session?.user as any;
  const displayViews = user?.displayViews ?? [];
  const companyName = user?.companyName ?? "";

  const hasStpClientView = displayViews.some(
    (v: { viewKey: string }) => v.viewKey === "stp_client"
  );
  const hasStpAgentView = displayViews.some(
    (v: { viewKey: string }) => v.viewKey === "stp_agent"
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">CRM ポータル</h1>
            <p className="text-sm text-gray-500">{companyName}</p>
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
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-2">ようこそ、{user?.name}様</h2>
          <p className="text-gray-600">
            以下のメニューからご利用のサービスをお選びください。
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* 採用ブースト（クライアント版） */}
          {hasStpClientView && (
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Building2 className="h-6 w-6 text-blue-600" />
                  <CardTitle>採用ブースト</CardTitle>
                </div>
                <CardDescription>
                  自社の採用プロジェクト状況を確認できます
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/portal/stp/client">
                  <Button className="w-full">詳細を見る</Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* 採用ブースト（紹介者版） */}
          {hasStpAgentView && (
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Users className="h-6 w-6 text-green-600" />
                  <CardTitle>紹介先管理</CardTitle>
                </div>
                <CardDescription>
                  紹介先企業の採用プロジェクト状況を確認できます
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/portal/stp/agent">
                  <Button className="w-full">詳細を見る</Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* 契約書 */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileText className="h-6 w-6 text-purple-600" />
                <CardTitle>契約書</CardTitle>
              </div>
              <CardDescription>契約書の確認ができます</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/portal/contracts">
                <Button variant="outline" className="w-full">
                  準備中
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* アクセス権限がない場合のメッセージ */}
        {displayViews.length === 0 && (
          <Card className="mt-8">
            <CardContent className="py-8 text-center">
              <p className="text-gray-500">
                現在ご利用可能なサービスがありません。
                <br />
                管理者にお問い合わせください。
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
