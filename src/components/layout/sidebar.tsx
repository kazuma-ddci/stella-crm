"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  Building2,
  Home,
  Users,
  Settings,
  Briefcase,
  ChevronDown,
  ChevronRight,
  FileText,
  History,
  Phone,
  Layers,
  Tags,
  FolderKanban,
  UserSquare2,
  FileCheck,
  Shield,
  UserPlus,
  Key,
  ClipboardList,
} from "lucide-react";
import { canView } from "@/lib/auth/permissions";
import type { SessionUser } from "@/types/auth";
import type { ProjectCode } from "@/types/auth";

type NavItem = {
  name: string;
  href?: string;
  icon: React.ElementType;
  children?: NavItem[];
  requiredProject?: ProjectCode;
  adminOnly?: boolean;
};

const navigation: NavItem[] = [
  {
    name: "Stella",
    icon: Building2,
    requiredProject: "stella",
    children: [
      { name: "ダッシュボード", href: "/", icon: Home },
      { name: "Stella全顧客マスタ", href: "/companies", icon: Building2 },
      { name: "スタッフ管理", href: "/staff", icon: Users },
    ],
  },
  {
    name: "STP(採用ブースト)",
    icon: Briefcase,
    requiredProject: "stp",
    children: [
      { name: "企業情報", href: "/stp/companies", icon: Building2 },
      { name: "代理店情報", href: "/stp/agents", icon: Users },
      { name: "リード回答", href: "/stp/lead-submissions", icon: ClipboardList },
      { name: "契約書情報", href: "/stp/contracts", icon: FileCheck },
      {
        name: "記録",
        icon: FileText,
        children: [
          { name: "企業接触履歴", href: "/stp/records/company-contacts", icon: Phone },
          { name: "代理店接触履歴", href: "/stp/records/agent-contacts", icon: Phone },
          { name: "商談ステージ履歴", href: "/stp/records/stage-histories", icon: History },
        ],
      },
      {
        name: "設定",
        icon: Settings,
        children: [
          { name: "商談ステージ", href: "/stp/settings/stages", icon: Layers },
          { name: "接触方法", href: "/stp/settings/contact-methods", icon: Phone },
        ],
      },
    ],
  },
  {
    name: "設定",
    icon: Settings,
    requiredProject: "stella",
    children: [
      { name: "スタッフ役割種別", href: "/staff/role-types", icon: Tags },
      { name: "連絡手段", href: "/settings/contact-methods", icon: Phone },
      { name: "プロジェクト管理", href: "/settings/projects", icon: FolderKanban },
      { name: "顧客種別", href: "/settings/customer-types", icon: UserSquare2 },
      { name: "契約書ステータス", href: "/settings/contract-statuses", icon: FileCheck },
    ],
  },
  {
    name: "外部ユーザー",
    icon: Shield,
    adminOnly: true,
    children: [
      { name: "外部ユーザー管理", href: "/admin/users", icon: Users },
      { name: "承認待ちユーザー", href: "/admin/pending-users", icon: UserPlus },
      { name: "登録トークン管理", href: "/admin/registration-tokens", icon: Key },
    ],
  },
];

function NavItemComponent({
  item,
  depth = 0,
}: {
  item: NavItem;
  depth?: number;
}) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(true);
  const hasChildren = item.children && item.children.length > 0;
  const isActive = item.href
    ? pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
    : false;

  const paddingLeft = 12 + depth * 16;

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "group flex w-full items-center rounded-md px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white"
          )}
          style={{ paddingLeft }}
        >
          <item.icon className="mr-3 h-4 w-4 flex-shrink-0 text-gray-400 group-hover:text-white" />
          <span className="flex-1 text-left">{item.name}</span>
          {isOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
        {isOpen && (
          <div className="mt-1 space-y-1">
            {item.children!.map((child) => (
              <NavItemComponent key={child.name} item={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href!}
      className={cn(
        "group flex items-center rounded-md px-3 py-2 text-sm font-medium",
        isActive
          ? "bg-gray-800 text-white"
          : "text-gray-300 hover:bg-gray-700 hover:text-white"
      )}
      style={{ paddingLeft }}
    >
      <item.icon
        className={cn(
          "mr-3 h-4 w-4 flex-shrink-0",
          isActive ? "text-white" : "text-gray-400 group-hover:text-white"
        )}
      />
      {item.name}
    </Link>
  );
}

function hasAdminPermission(user: SessionUser): boolean {
  return user.permissions.some((p) => p.permissionLevel === "admin");
}

function filterNavigationByPermissions(
  items: NavItem[],
  user: SessionUser
): NavItem[] {
  const isAdmin = hasAdminPermission(user);

  return items
    .filter((item) => {
      // 管理者専用メニューのチェック
      if (item.adminOnly && !isAdmin) {
        return false;
      }
      if (!item.requiredProject) {
        return true;
      }
      return canView(user.permissions, item.requiredProject);
    })
    .map((item) => {
      if (item.children) {
        return {
          ...item,
          children: filterNavigationByPermissions(item.children, user),
        };
      }
      return item;
    })
    .filter((item) => {
      if (item.children && item.children.length === 0) {
        return false;
      }
      return true;
    });
}

interface SidebarProps {
  user?: SessionUser;
}

export function Sidebar({ user }: SidebarProps) {
  const filteredNavigation = user
    ? filterNavigationByPermissions(navigation, user)
    : navigation;

  return (
    <div className="flex h-full w-64 flex-col bg-gray-900">
      <div className="flex h-16 items-center px-6">
        <h1 className="text-xl font-bold text-white">Stella CRM</h1>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {filteredNavigation.map((item) => (
          <NavItemComponent key={item.name} item={item} />
        ))}
      </nav>
    </div>
  );
}
