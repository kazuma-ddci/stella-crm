"use client";

import { useSession } from "next-auth/react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import type { SessionUser } from "@/types/auth";

interface AuthenticatedLayoutProps {
  serverUser: SessionUser;
  children: React.ReactNode;
}

/**
 * クライアント側のセッション状態に基づいてサイドバー/ヘッダーの表示を制御。
 * signOut()でセッションがクリアされた時（権限変更やログアウト）に
 * サイドバーを非表示にする。
 * 外部ユーザーの場合はサイドバー/ヘッダーを表示しない。
 */
export function AuthenticatedLayout({
  serverUser,
  children,
}: AuthenticatedLayoutProps) {
  const { status } = useSession();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userType = (serverUser as any)?.userType;

  // 外部ユーザーはサイドバー/ヘッダーなしのシンプルレイアウト
  if (userType === "external") {
    return <>{children}</>;
  }

  // status === "loading": 初回ロード中はサーバー側の判定を使う
  // status === "authenticated": セッション有効 → サイドバー表示
  // status === "unauthenticated": signOut後 → サイドバー非表示
  const showAuthLayout =
    status === "loading" ? true : status === "authenticated";

  if (showAuthLayout) {
    return (
      <div className="flex h-screen">
        <Sidebar user={serverUser} />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Header user={serverUser} />
          <main className="flex-1 overflow-auto bg-gray-50 p-6">
            {children}
          </main>
        </div>
      </div>
    );
  }

  return <main className="min-h-screen bg-gray-100">{children}</main>;
}
