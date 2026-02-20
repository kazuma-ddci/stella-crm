"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { Sidebar, SidebarContent } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // localStorage から復元（hydration安全）
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") {
      setSidebarCollapsed(true);
    }
  }, []);

  // コンテンツエリア幅・サイドバー幅を CSS 変数として公開（モーダル配置に使用）
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const cw = entry.contentRect.width;
      document.documentElement.style.setProperty("--content-w", `${cw}px`);
      const sw = Math.max(
        0,
        Math.round(window.innerWidth - el.getBoundingClientRect().width)
      );
      document.documentElement.style.setProperty("--sidebar-w", `${sw}px`);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty("--content-w");
      document.documentElement.style.removeProperty("--sidebar-w");
    };
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  };

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
        {/* デスクトップ: 固定サイドバー */}
        <Sidebar
          user={serverUser}
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebar}
        />

        {/* モバイル: ドロワーサイドバー */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent
            side="left"
            className="w-64 bg-gray-900 p-0 sm:max-w-64"
            showCloseButton={false}
            aria-describedby={undefined}
          >
            <SheetTitle className="sr-only">ナビゲーションメニュー</SheetTitle>
            <SidebarContent
              user={serverUser}
              onNavigate={() => setMobileMenuOpen(false)}
            />
          </SheetContent>
        </Sheet>

        <div ref={contentRef} className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Header
            user={serverUser}
            onMobileMenuToggle={() => setMobileMenuOpen(true)}
            sidebarCollapsed={sidebarCollapsed}
            onSidebarToggle={toggleSidebar}
          />
          <main className="flex-1 overflow-auto bg-gray-50 p-3 sm:p-4 md:p-6">
            <div className="mx-auto max-w-[1600px]">
              {children}
            </div>
          </main>
        </div>
      </div>
    );
  }

  return <main className="min-h-screen bg-gray-100">{children}</main>;
}
