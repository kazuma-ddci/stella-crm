"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, LogOut, Loader2, LineChart, Users, FileText } from "lucide-react";

export default function PortalStpClientPage() {
  const { data: session, status } = useSession();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session?.user as any;
  const companyName = user?.companyName ?? "";

  if (status === "loading") {
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
      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>メニュー</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Link href="/portal/stp/client/candidates">
                <Button variant="outline" className="w-full h-24 flex flex-col gap-2">
                  <Users className="h-6 w-6" />
                  <span>求職者情報</span>
                </Button>
              </Link>
              <Link href="/portal/stp/client/kpi">
                <Button variant="outline" className="w-full h-24 flex flex-col gap-2">
                  <LineChart className="h-6 w-6" />
                  <span>運用数値確認</span>
                </Button>
              </Link>
              <Link href="/portal/stp/client/contracts">
                <Button variant="outline" className="w-full h-24 flex flex-col gap-2">
                  <FileText className="h-6 w-6" />
                  <span>契約情報</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
