import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AccountingMonthlyClosePage() {
  // Generate past 12 months (current month + 11 previous), format as YYYY-MM
  const now = new Date();
  const months: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    months.push(`${y}-${m}`);
  }

  // Build date range for query (first day of oldest month to last day of current month)
  const oldestMonth = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const newestMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // Query active projects and monthly close records
  const [projects, closeRecords] = await Promise.all([
    prisma.masterProject.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    }),
    prisma.accountingMonthlyClose.findMany({
      where: {
        targetMonth: {
          gte: oldestMonth,
          lte: newestMonthEnd,
        },
      },
      include: {
        project: true,
        projectCloser: true,
        accountingCloser: true,
        reopener: true,
      },
    }),
  ]);

  // Build a lookup map: "YYYY-MM:projectId" -> close record
  const closeMap = new Map<
    string,
    {
      id: number;
      status: string;
      projectClosedAt: string | null;
      projectCloserName: string | null;
      accountingClosedAt: string | null;
      accountingCloserName: string | null;
      reopenedAt: string | null;
      reopenerName: string | null;
      reopenReason: string | null;
    }
  >();

  for (const rec of closeRecords) {
    const monthKey = rec.targetMonth.toISOString().split("T")[0].slice(0, 7);
    const key = `${monthKey}:${rec.projectId}`;
    closeMap.set(key, {
      id: rec.id,
      status: rec.status,
      projectClosedAt: rec.projectClosedAt?.toISOString() ?? null,
      projectCloserName: rec.projectCloser?.name ?? null,
      accountingClosedAt: rec.accountingClosedAt?.toISOString() ?? null,
      accountingCloserName: rec.accountingCloser?.name ?? null,
      reopenedAt: rec.reopenedAt?.toISOString() ?? null,
      reopenerName: rec.reopener?.name ?? null,
      reopenReason: rec.reopenReason ?? null,
    });
  }

  // Summary: count months where ALL projects are accounting_closed
  let fullyClosedCount = 0;
  let openCount = 0;

  for (const month of months) {
    const allClosed = projects.length > 0 && projects.every((proj) => {
      const rec = closeMap.get(`${month}:${proj.id}`);
      return rec?.status === "accounting_closed";
    });
    if (allClosed) {
      fullyClosedCount++;
    } else {
      openCount++;
    }
  }

  const formatDateTime = (isoString: string) => {
    return new Date(isoString).toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">月次締め管理</h1>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">全プロジェクト最終締め済</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{fullyClosedCount}ヶ月</div>
            <p className="text-xs text-muted-foreground">全プロジェクトの経理最終確認が完了</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">未完了</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{openCount}ヶ月</div>
            <p className="text-xs text-muted-foreground">締め処理が未完了の月</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">対象プロジェクト</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{projects.length}</div>
            <p className="text-xs text-muted-foreground">アクティブなプロジェクト数</p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly close table */}
      <Card>
        <CardHeader>
          <CardTitle>月次締めステータス一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-3 py-2 text-left font-medium">対象月</th>
                  {projects.map((proj) => (
                    <th key={proj.id} className="px-3 py-2 text-left font-medium">
                      {proj.name}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-left font-medium">経理最終確認</th>
                </tr>
              </thead>
              <tbody>
                {months.map((month) => {
                  const allAccountingClosed =
                    projects.length > 0 &&
                    projects.every((proj) => {
                      const rec = closeMap.get(`${month}:${proj.id}`);
                      return rec?.status === "accounting_closed";
                    });

                  return (
                    <tr key={month} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="px-3 py-3 font-medium whitespace-nowrap">{month}</td>
                      {projects.map((proj) => {
                        const rec = closeMap.get(`${month}:${proj.id}`);
                        return (
                          <td key={proj.id} className="px-3 py-3">
                            {renderStatusCell(rec, formatDateTime)}
                          </td>
                        );
                      })}
                      <td className="px-3 py-3">
                        {allAccountingClosed ? (
                          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                            完了
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                            未完了
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function renderStatusCell(
  rec:
    | {
        id: number;
        status: string;
        projectClosedAt: string | null;
        projectCloserName: string | null;
        accountingClosedAt: string | null;
        accountingCloserName: string | null;
        reopenedAt: string | null;
        reopenerName: string | null;
        reopenReason: string | null;
      }
    | undefined,
  formatDateTime: (isoString: string) => string
) {
  // No record or status is "open"
  if (!rec || rec.status === "open") {
    return (
      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
        未締め
      </span>
    );
  }

  // Project closed
  if (rec.status === "project_closed") {
    return (
      <div className="space-y-1">
        <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
          プロジェクト締め済
        </span>
        {rec.projectCloserName && (
          <p className="text-xs text-muted-foreground">
            {rec.projectCloserName}
            {rec.projectClosedAt && ` (${formatDateTime(rec.projectClosedAt)})`}
          </p>
        )}
      </div>
    );
  }

  // Accounting closed
  if (rec.status === "accounting_closed") {
    return (
      <div className="space-y-1">
        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
          最終締め済
        </span>
        {rec.accountingCloserName && (
          <p className="text-xs text-muted-foreground">
            {rec.accountingCloserName}
            {rec.accountingClosedAt && ` (${formatDateTime(rec.accountingClosedAt)})`}
          </p>
        )}
      </div>
    );
  }

  // Reopened (status might have been reset, but reopenedAt exists)
  if (rec.reopenedAt) {
    return (
      <div className="space-y-1">
        <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
          再開済
        </span>
        {rec.reopenerName && (
          <p className="text-xs text-muted-foreground">
            {rec.reopenerName}
            {rec.reopenedAt && ` (${formatDateTime(rec.reopenedAt)})`}
          </p>
        )}
        {rec.reopenReason && (
          <p className="text-xs text-muted-foreground">理由: {rec.reopenReason}</p>
        )}
      </div>
    );
  }

  // Fallback
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
      {rec.status}
    </span>
  );
}
