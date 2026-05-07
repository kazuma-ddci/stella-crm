import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { getWorkflowGroups } from "./actions";
import { GroupsList } from "./groups-list";

export default async function AccountingWorkflowPage() {
  const [groups, projects] = await Promise.all([
    getWorkflowGroups(),
    prisma.masterProject.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: { displayOrder: "asc" },
    }),
  ]);

  const pendingApproval = groups.filter((g) => g.category === "pending_accounting_approval").length;
  const needsJournal = groups.filter((g) => g.category === "needs_journal").length;
  const inProgress = groups.filter((g) => g.category === "in_progress").length;
  const completed = groups.filter((g) => g.category === "completed").length;
  const returned = groups.filter((g) => g.category === "returned").length;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">経理ワークフロー</h1>

      {/* サマリー */}
      <div className="grid grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-purple-600">{pendingApproval}</div>
            <p className="text-sm text-muted-foreground">承認済み・支払対応待ち</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">{needsJournal}</div>
            <p className="text-sm text-muted-foreground">仕訳待ち</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-600">{inProgress}</div>
            <p className="text-sm text-muted-foreground">処理中</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{completed}</div>
            <p className="text-sm text-muted-foreground">完了</p>
          </CardContent>
        </Card>
        {returned > 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-gray-500">{returned}</div>
              <p className="text-sm text-muted-foreground">差し戻し中</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* グループ一覧（タブ切り替え） */}
      <Card>
        <CardHeader>
          <CardTitle>請求/支払グループ</CardTitle>
        </CardHeader>
        <CardContent>
          <GroupsList groups={groups} projects={projects} />
        </CardContent>
      </Card>
    </div>
  );
}
