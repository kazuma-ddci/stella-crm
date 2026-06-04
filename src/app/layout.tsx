import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { unstable_cache } from "next/cache";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { SessionProvider } from "@/components/providers/session-provider";
import { TableSettingsProvider, type TableSettingsMap } from "@/components/providers/table-settings-provider";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { BuildVersionChecker } from "@/components/build-version-checker";
import { elapsedPerfMs, logPerf, measurePerf, startPerfTimer } from "@/lib/perf-log";

type CountRow = { count: number | bigint };

const getActiveProjectsForLayout = unstable_cache(
  async () =>
    prisma.masterProject.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
    }),
  ["layout-active-projects"],
  { revalidate: 300 }
);

const getHojoPendingAccountCountForLayout = unstable_cache(
  async () => {
    const [bbsPending, vendorPending, lenderPending] = await Promise.all([
      prisma.hojoBbsAccount.count({
        where: { status: "pending_approval" },
      }),
      prisma.hojoVendorAccount.count({
        where: { status: "pending_approval" },
      }),
      prisma.hojoLenderAccount.count({
        where: { status: "pending_approval" },
      }),
    ]);
    return bbsPending + vendorPending + lenderPending;
  },
  ["layout-hojo-pending-account-count"],
  { revalidate: 60 }
);

const getExpenseApprovalCountsForLayout = unstable_cache(
  async (userId: number) =>
    prisma.paymentGroup.groupBy({
      by: ["projectId"],
      where: {
        deletedAt: null,
        status: "pending_project_approval",
        approverStaffId: userId,
      },
      _count: true,
    }),
  ["layout-expense-approval-counts"],
  { revalidate: 30 }
);

const getUnlinkedStatementCountForLayout = unstable_cache(
  async () => {
    const [row] = await prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::int AS count
      FROM (
        SELECT
          e.id,
          CASE
            WHEN COALESCE(e."incomingAmount", 0) > 0 THEN e."incomingAmount"
            WHEN COALESCE(e."outgoingAmount", 0) > 0 THEN e."outgoingAmount"
            ELSE 0
          END AS total_amount,
          COALESCE(SUM(l.amount), 0) AS linked_amount
        FROM bank_statement_entries e
        LEFT JOIN bank_statement_entry_group_links l ON l."bankStatementEntryId" = e.id
        WHERE e.excluded = false
        GROUP BY e.id
      ) s
      WHERE s.total_amount > 0 AND s.linked_amount < s.total_amount
    `;
    return Number(row?.count ?? 0);
  },
  ["layout-unlinked-statement-count"],
  { revalidate: 60 }
);

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const host = (await headers()).get("host") ?? "";
  if (host.endsWith("koutekiseido-japan.com")) {
    return {
      title: "公的制度教育推進協会",
      description: "公的制度教育推進協会の公式フォーム",
    };
  }
  return {
    title: process.env.NEXT_PUBLIC_APP_TITLE || "Stella 基幹OS",
    description: "社内CRMシステム",
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const layoutStartedAt = startPerfTimer();
  const session = await measurePerf("layout", "auth", () => auth(), 100);
  const user = session?.user;

  // サイドバー設定をDBから取得
  let hiddenItems: string[] = [];
  let projectNames: Record<string, string> = {};
  let bbsPendingCount = 0;
  const expenseApprovalCounts: Record<string, number> = {};
  let unlinkedStatementCount = 0;
  let tableSettings: TableSettingsMap = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = (user as any)?.id as number | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userType = (user as any)?.userType;
  if (userId && userType === "lender") {
    try {
      const lenderMeta = await measurePerf(
        "layout",
        "lender-table-settings",
        () =>
          prisma.hojoLenderAccount.findUnique({
            where: { id: userId },
            select: { tableSettings: true },
          }),
        100
      );
      tableSettings = (lenderMeta?.tableSettings as TableSettingsMap | null) ?? {};
    } catch {
      // DBエラー時は空のまま
    }
  }
  if (userId && userType === "staff") {
    try {
      const [pref, projects, hojoPendingCount, expenseApprovals, staffMeta, statementCount] = await Promise.all([
        measurePerf(
          "layout",
          "sidebar-preference",
          () =>
            prisma.staffSidebarPreference.findUnique({
              where: { staffId: userId },
              select: { hiddenItems: true },
            }),
          100
        ),
        measurePerf("layout", "active-projects", getActiveProjectsForLayout, 100),
        measurePerf(
          "layout",
          "hojo-pending-account-count",
          getHojoPendingAccountCountForLayout,
          100
        ),
        measurePerf(
          "layout",
          "expense-approval-counts",
          () => getExpenseApprovalCountsForLayout(userId),
          100
        ),
        // スタッフのテーブルUI設定
        measurePerf(
          "layout",
          "staff-table-settings",
          () =>
            prisma.masterStaff.findUnique({
              where: { id: userId },
              select: { tableSettings: true },
            }),
          100
        ),
        measurePerf(
          "layout",
          "unlinked-statement-count",
          getUnlinkedStatementCountForLayout,
          100
        ),
      ]);
      tableSettings = (staffMeta?.tableSettings as TableSettingsMap | null) ?? {};
      hiddenItems = pref?.hiddenItems ?? [];
      bbsPendingCount = hojoPendingCount;
      projectNames = Object.fromEntries(projects.map((p) => [p.code, p.name]));
      const pidToCode = Object.fromEntries(projects.map((p) => [p.id, p.code]));
      for (const g of expenseApprovals) {
        if (g.projectId) {
          const code = pidToCode[g.projectId];
          if (code) expenseApprovalCounts[code] = g._count;
        }
      }
      unlinkedStatementCount = statementCount;
    } catch {
      // DBエラー時は空のまま
    }
  }

  logPerf("layout", "total", elapsedPerfMs(layoutStartedAt), { userType }, 300);

  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SessionProvider refetchInterval={30}>
          <BuildVersionChecker />
          <PermissionGuard />
          <TableSettingsProvider initial={tableSettings} canManagePinning={userType === "staff" || userType === "lender"}>
            {user ? (
              <AuthenticatedLayout serverUser={user} hiddenItems={hiddenItems} projectNames={projectNames} bbsPendingCount={bbsPendingCount} expenseApprovalCounts={expenseApprovalCounts} unlinkedStatementCount={unlinkedStatementCount}>
                {children}
              </AuthenticatedLayout>
            ) : (
              <main className="min-h-screen bg-gray-100">{children}</main>
            )}
          </TableSettingsProvider>
          <Toaster />
        </SessionProvider>
      </body>
    </html>
  );
}
