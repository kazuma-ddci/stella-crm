import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { getWorkflowGroups } from "./actions";
import { getDueUnrealizedJournalEntries } from "../journal/actions";
import { GroupsList } from "./groups-list";

export default async function AccountingWorkflowPage() {
  const [groups, projects, dueUnrealizedEntries] = await Promise.all([
    getWorkflowGroups(),
    prisma.masterProject.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: { displayOrder: "asc" },
    }),
    getDueUnrealizedJournalEntries(),
  ]);

  const pendingApproval = groups.filter((g) => g.category === "pending_accounting_approval").length;
  const returnRequested = groups.filter((g) => g.category === "return_requested").length;
  const dueUnrealizedCount = dueUnrealizedEntries.length;
  const needsJournal = groups.filter((g) => g.category === "needs_journal").length;
  const needsRealization = groups.filter((g) => g.category === "needs_realization").length;
  const needsStatementCheck = groups.filter((g) => g.category === "needs_statement_check").length;
  const completed = groups.filter((g) => g.category === "completed").length;
  const returned = groups.filter((g) => g.category === "returned").length;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">経理ワークフロー</h1>

      {/* サマリー */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-8 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-purple-600">{pendingApproval}</div>
            <p className="text-sm text-muted-foreground">承認済み・支払対応待ち</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-amber-600">{returnRequested}</div>
            <p className="text-sm text-muted-foreground">差し戻し依頼</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">{dueUnrealizedCount}</div>
            <p className="text-sm text-muted-foreground">本日実現待ち</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">{needsJournal}</div>
            <p className="text-sm text-muted-foreground">仕訳作成待ち</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-600">{needsRealization}</div>
            <p className="text-sm text-muted-foreground">仕訳実現待ち</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-orange-600">{needsStatementCheck}</div>
            <p className="text-sm text-muted-foreground">入出金確認待ち</p>
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
          <GroupsList groups={groups} projects={projects} dueUnrealizedEntries={dueUnrealizedEntries} />
        </CardContent>
      </Card>
    </div>
  );
}
