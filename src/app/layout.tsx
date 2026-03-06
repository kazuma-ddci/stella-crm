import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { SessionProvider } from "@/components/providers/session-provider";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_TITLE || "Stella 基幹OS",
  description: "社内CRMシステム",
};

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = (user as any)?.id as number | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userType = (user as any)?.userType;
  if (userId && userType === "staff") {
    try {
      const [pref, projects] = await Promise.all([
        prisma.staffSidebarPreference.findUnique({
          where: { staffId: userId },
          select: { hiddenItems: true },
        }),
        prisma.masterProject.findMany({
          where: { isActive: true },
          select: { code: true, name: true },
        }),
      ]);
      hiddenItems = pref?.hiddenItems ?? [];
      projectNames = Object.fromEntries(projects.map((p) => [p.code, p.name]));
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
          <PermissionGuard />
          {user ? (
            <AuthenticatedLayout serverUser={user} hiddenItems={hiddenItems} projectNames={projectNames}>
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
