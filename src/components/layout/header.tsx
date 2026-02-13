import { UserMenu } from "./user-menu";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SessionUser } from "@/types/auth";

interface HeaderProps {
  user: SessionUser;
  onMobileMenuToggle?: () => void;
  sidebarCollapsed?: boolean;
  onSidebarToggle?: () => void;
}

export function Header({
  user,
  onMobileMenuToggle,
  sidebarCollapsed,
  onSidebarToggle,
}: HeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b bg-white px-3 sm:px-4 md:px-6">
      <div className="flex items-center gap-1">
        {/* モバイル: ハンバーガーメニュー */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onMobileMenuToggle}
        >
          <Menu className="h-5 w-5" />
        </Button>
        {/* デスクトップ: サイドバートグル */}
        <Button
          variant="ghost"
          size="icon"
          className="hidden md:flex"
          onClick={onSidebarToggle}
          title={sidebarCollapsed ? "メニューを開く" : "メニューを閉じる"}
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen className="h-5 w-5" />
          ) : (
            <PanelLeftClose className="h-5 w-5" />
          )}
        </Button>
      </div>
      <div className="ml-auto">
        <UserMenu user={user} />
      </div>
    </header>
  );
}
