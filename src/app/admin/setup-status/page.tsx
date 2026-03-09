import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
} from "lucide-react";
import { auth } from "@/auth";
import { isSystemAdmin } from "@/lib/auth/permissions";
import { getSetupStatus, type SetupCheckItem, type SetupCheckStatus } from "./actions";

function StatusIcon({ status }: { status: SetupCheckStatus }) {
  switch (status) {
    case "ok":
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case "warning":
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    case "error":
      return <XCircle className="h-5 w-5 text-red-500" />;
  }
}

function StatusBadge({ status, current }: { status: SetupCheckStatus; current: number }) {
  switch (status) {
    case "ok":
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
          {current}件
        </Badge>
      );
    case "warning":
      return (
        <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
          {current === 0 ? "未設定" : `${current}件`}
        </Badge>
      );
    case "error":
      return (
        <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
          未設定
        </Badge>
      );
  }
}

function groupByCategory(items: SetupCheckItem[]): Record<string, SetupCheckItem[]> {
  const groups: Record<string, SetupCheckItem[]> = {};
  for (const item of items) {
    if (!groups[item.category]) {
      groups[item.category] = [];
    }
    groups[item.category].push(item);
  }
  return groups;
}

export default async function SetupStatusPage() {
  const session = await auth();
  if (!session?.user || !isSystemAdmin(session.user)) {
    redirect("/");
  }

  const items = await getSetupStatus();
  const groups = groupByCategory(items);

  const totalOk = items.filter((i) => i.status === "ok").length;
  const totalWarning = items.filter((i) => i.status === "warning").length;
  const totalError = items.filter((i) => i.status === "error").length;

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">セットアップ状況</h1>
        <p className="text-muted-foreground mt-1">
          システムが正常に動作するために必要なマスターデータの設定状況を確認できます。
          新機能追加時に必要なデータが不足している場合はここに表示されます。
        </p>
      </div>

      {/* サマリー */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <div>
                <div className="text-2xl font-bold">{totalOk}</div>
                <div className="text-sm text-muted-foreground">設定済み</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-yellow-500" />
              <div>
                <div className="text-2xl font-bold">{totalWarning}</div>
                <div className="text-sm text-muted-foreground">推奨</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <XCircle className="h-8 w-8 text-red-500" />
              <div>
                <div className="text-2xl font-bold">{totalError}</div>
                <div className="text-sm text-muted-foreground">要対応</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* カテゴリ別チェック項目 */}
      {Object.entries(groups).map(([category, categoryItems]) => {
        const categoryOk = categoryItems.every((i) => i.status === "ok");
        const categoryError = categoryItems.some((i) => i.status === "error");
        return (
          <Card key={category}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                {categoryOk ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : categoryError ? (
                  <XCircle className="h-5 w-5 text-red-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                )}
                <CardTitle className="text-lg">{category}</CardTitle>
              </div>
              <CardDescription>
                {categoryOk
                  ? "全て設定済みです"
                  : `${categoryItems.filter((i) => i.status !== "ok").length}件の対応が必要です`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {categoryItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <StatusIcon status={item.status} />
                      <div className="min-w-0">
                        <div className="font-medium text-sm">{item.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {item.description}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-4 shrink-0">
                      <StatusBadge status={item.status} current={item.current} />
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={item.href}>
                          設定
                          <ArrowRight className="h-4 w-4 ml-1" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
