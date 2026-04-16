import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { SessionProvider } from "@/components/providers/session-provider";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { BuildVersionChecker } from "@/components/build-version-checker";

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
  const session = await auth();
  const user = session?.user;

  // サイドバー設定をDBから取得
  let hiddenItems: string[] = [];
  let projectNames: Record<string, string> = {};
  let bbsPendingCount = 0;
  let expenseApprovalCounts: Record<string, number> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = (user as any)?.id as number | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userType = (user as any)?.userType;
  if (userId && userType === "staff") {
    try {
      const [pref, projects, bbsPending, vendorPending, lenderPending, expenseApprovals] = await Promise.all([
        prisma.staffSidebarPreference.findUnique({
          where: { staffId: userId },
          select: { hiddenItems: true },
        }),
        prisma.masterProject.findMany({
          where: { isActive: true },
          select: { code: true, name: true },
        }),
        prisma.hojoBbsAccount.count({
          where: { status: "pending_approval" },
        }),
        prisma.hojoVendorAccount.count({
          where: { status: "pending_approval" },
        }),
        prisma.hojoLenderAccount.count({
          where: { status: "pending_approval" },
        }),
        // 経費申請の承認待ち（自分が承認者のもの）をプロジェクト別にカウント
        prisma.paymentGroup.groupBy({
          by: ["projectId"],
          where: {
            deletedAt: null,
            status: "pending_project_approval",
            approverStaffId: userId,
          },
          _count: true,
        }),
      ]);
      hiddenItems = pref?.hiddenItems ?? [];
      bbsPendingCount = bbsPending + vendorPending + lenderPending;
      projectNames = Object.fromEntries(projects.map((p) => [p.code, p.name]));

      // プロジェクトID→コードのマッピング
      const idToCode = Object.fromEntries(
        projects.map((p) => {
          const proj = projects.find((pp) => pp.code === p.code);
          return [proj?.code, p.code];
        })
      );
      // projectId → code 変換用にDB再取得
      const projectIdMap = await prisma.masterProject.findMany({
        where: { isActive: true },
        select: { id: true, code: true },
      });
      const pidToCode = Object.fromEntries(projectIdMap.map((p) => [p.id, p.code]));
      for (const g of expenseApprovals) {
        if (g.projectId) {
          const code = pidToCode[g.projectId];
          if (code) expenseApprovalCounts[code] = g._count;
        }
      }
    } catch {
      // DBエラー時は空のまま
    }
  }

  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SessionProvider refetchInterval={30}>
          <BuildVersionChecker />
          <PermissionGuard />
          {user ? (
            <AuthenticatedLayout serverUser={user} hiddenItems={hiddenItems} projectNames={projectNames} bbsPendingCount={bbsPendingCount} expenseApprovalCounts={expenseApprovalCounts}>
              {children}
            </AuthenticatedLayout>
          ) : (
            <main className="min-h-screen bg-gray-100">{children}</main>
          )}
          <Toaster />
        </SessionProvider>
      </body>
    </html>
  );
}
