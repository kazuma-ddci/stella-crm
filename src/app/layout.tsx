import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { SessionProvider } from "@/components/providers/session-provider";
import { auth } from "@/auth";
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
  title: process.env.NEXT_PUBLIC_APP_TITLE || "Stella CRM",
  description: "社内CRMシステム",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const user = session?.user;

  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SessionProvider refetchInterval={30}>
          <PermissionGuard />
          {user ? (
            <AuthenticatedLayout serverUser={user}>
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
