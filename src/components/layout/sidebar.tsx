"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useState, useCallback, useEffect } from "react";
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

  UserSquare2,
  FileCheck,
  Shield,
  UserPlus,
  Key,
  ClipboardList,
  UserSearch,
  DollarSign,
  ListChecks,
  TrendingUp,
  TrendingDown,
  Receipt,
  Landmark,
  Clock,
  Lock,
  Tag,
  Calculator,
  ArrowLeftRight,
  CheckSquare,
  Upload,
  PanelLeftClose,
  PanelLeftOpen,
  BookOpen,
  Bell,
  Handshake,
  Repeat,
  Zap,
  Wallet,
  CheckCircle2,
  Target,
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
  requireAnyEdit?: boolean; // いずれかのプロジェクトでedit以上なら表示
  founderOrManager?: boolean; // founder or manager以上のみ
  editOrAbove?: boolean; // edit以上のみ
  key?: string; // サイドバーカスタマイズ用のキー
  sectionLabel?: boolean; // true: 開閉なしのセクションラベル（子はフラット表示）
  collapsible?: boolean; // true: 開閉式（chevron表示）。sectionLabelと排他
};

// 固定データ設定のパス一覧（stella001の固定データ設定 + 各PJ固有設定に表示）
// 通常ユーザーのナビゲーションからはこれらのパスを非表示にする
const ALL_MASTER_DATA_HREFS = new Set([
  // 共通（stella001固定データ設定のみ）
  "/settings/projects",
  "/settings/contact-methods",
  "/settings/contract-statuses",
  "/settings/operating-companies",
  "/staff/field-definitions",
  // プロジェクト横断（stella001固定データ設定 + 各PJ固有設定）
  "/settings/contract-types",
  "/settings/customer-types",
  "/settings/contact-categories",
  "/settings/display-views",
  "/settings/email-templates",
  "/staff/role-types",
  "/staff/field-restrictions",
  // 1PJ専用（各PJ固有設定のみ）
  "/settings/lead-sources",
  "/stp/settings/stages",
]);

// 固定データ設定ナビゲーション（stella001専用レイアウト用）
// 共通設定＋プロジェクト横断マスタ。1PJ専用の項目（流入経路・商談パイプライン等）は各PJの固有設定のみ
const masterDataNavigation: NavItem[] = [
  {
    name: "固定データ設定",
    icon: Settings,
    collapsible: true,
    children: [
      { name: "組織・プロジェクト管理", href: "/settings/projects", icon: Building2 },
      { name: "接触方法", href: "/settings/contact-methods", icon: Phone },
      { name: "契約種別", href: "/settings/contract-types", icon: FileText },
      { name: "契約ステータス", href: "/settings/contract-statuses", icon: FileCheck },
      { name: "顧客種別", href: "/settings/customer-types", icon: UserSquare2 },
      { name: "接触種別", href: "/settings/contact-categories", icon: Tag },
      { name: "外部ユーザー表示区分", href: "/settings/display-views", icon: Shield },
      { name: "スタッフ役割種別", href: "/staff/role-types", icon: Tags },
      { name: "担当者フィールド出現設定", href: "/staff/field-definitions", icon: CheckSquare },
      { name: "担当者フィールド制約", href: "/staff/field-restrictions", icon: Shield },
      { name: "メールテンプレート", href: "/settings/email-templates", icon: FileText },
    ],
  },
];

// 通常ユーザーから固定データ設定ページを除外
function removeMasterDataItems(items: NavItem[]): NavItem[] {
  return items
    .map((item) => {
      if (item.children) {
        return { ...item, children: removeMasterDataItems(item.children) };
      }
      return item;
    })
    .filter((item) => {
      if (item.href && ALL_MASTER_DATA_HREFS.has(item.href)) {
        return false;
      }
      if (item.children && item.children.length === 0) {
        return false;
      }
      return true;
    });
}

const navigation: NavItem[] = [
  { name: "通知", href: "/notifications", icon: Bell },
  { name: "セットアップ状況", href: "/admin/setup-status", icon: ListChecks, founderOrManager: true },
  {
    name: "Stella",
    icon: Building2,
    key: "stella",
    collapsible: true,
    children: [
      { name: "ダッシュボード", href: "/", icon: Home },
    ],
  },
  {
    name: "STP",
    icon: Briefcase,
    requiredProject: "stp",
    key: "stp",
    collapsible: true,
    children: [
      { name: "ダッシュボード", href: "/stp/dashboard", icon: Home },
      { name: "KPI目標管理", href: "/stp/kpi-targets", icon: Target },
      {
        name: "営業管理",
        icon: Briefcase,
        sectionLabel: true,
        children: [
          { name: "全顧客マスタ", href: "/companies", icon: BookOpen, requireAnyEdit: true },
          { name: "企業情報", href: "/stp/companies", icon: Building2 },
          { name: "代理店情報", href: "/stp/agents", icon: Handshake },
          { name: "求職者情報", href: "/stp/candidates", icon: UserSearch },
          { name: "リード回答", href: "/stp/lead-submissions", icon: ClipboardList },
        ],
      },
      {
        name: "活動記録",
        icon: Phone,
        sectionLabel: true,
        children: [
          { name: "契約書進捗", href: "/stp/contracts", icon: FileCheck },
          { name: "企業接触履歴", href: "/stp/records/company-contacts", icon: Phone },
          { name: "代理店接触履歴", href: "/stp/records/agent-contacts", icon: Phone },
          { name: "商談パイプライン履歴", href: "/stp/records/stage-histories", icon: History },
        ],
      },
      {
        name: "売上・経費",
        icon: DollarSign,
        sectionLabel: true,
        children: [
          { name: "ダッシュボード", href: "/stp/finance/overview", icon: DollarSign },
          { name: "取引管理", href: "/stp/finance/transactions", icon: Landmark },
          { name: "取引候補生成", href: "/stp/finance/generate", icon: Zap },
          { name: "請求管理（売上）", href: "/stp/finance/invoices", icon: Receipt },
          { name: "支払管理（経費）", href: "/stp/finance/payment-groups", icon: Wallet },
          { name: "売掛金年齢表", href: "/stp/finance/aging", icon: Clock },
          { name: "代理店別サマリー", href: "/stp/finance/agent-summary", icon: Users },
        ],
      },
      {
        name: "管理",
        icon: Settings,
        sectionLabel: true,
        founderOrManager: true,
        children: [
          { name: "スタッフ管理", href: "/staff", icon: Users },
          { name: "外部ユーザー管理", href: "/admin/users", icon: Shield, editOrAbove: true },
          {
            name: "固有設定",
            icon: Settings,
            collapsible: true,
            children: [
              { name: "プロジェクト設定", href: "/stp/settings/project", icon: Building2 },
              { name: "契約種別", href: "/settings/contract-types?project=stp", icon: FileText },
              { name: "顧客種別", href: "/settings/customer-types?project=stp", icon: UserSquare2 },
              { name: "接触種別", href: "/settings/contact-categories?project=stp", icon: Tag },
              { name: "流入経路", href: "/settings/lead-sources", icon: UserPlus },
              { name: "商談パイプライン", href: "/stp/settings/stages", icon: Layers },
              { name: "スタッフ役割種別", href: "/staff/role-types?project=stp", icon: Tags },
              { name: "担当者フィールド制約", href: "/staff/field-restrictions?project=stp", icon: Shield },
              { name: "メールテンプレート", href: "/settings/email-templates?project=stp", icon: FileText },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "経理",
    icon: Calculator,
    requiredProject: "accounting",
    key: "accounting",
    collapsible: true,
    children: [
      { name: "ダッシュボード", href: "/accounting/dashboard", icon: Home },
      { name: "全顧客マスタ", href: "/companies", icon: Building2, requireAnyEdit: true },
      { name: "スタッフ管理", href: "/staff", icon: Users, founderOrManager: true },
      { name: "外部ユーザー管理", href: "/admin/users", icon: Shield, editOrAbove: true },
      { name: "会計取引", href: "/accounting/transactions", icon: Landmark },
      { name: "入出金管理", href: "/accounting/bank-transactions", icon: Receipt },
      { name: "消込管理", href: "/accounting/reconciliation", icon: ArrowLeftRight },
      { name: "確認管理", href: "/accounting/verification", icon: CheckSquare },
      { name: "予実管理", href: "/accounting/budget", icon: TrendingUp },
      { name: "キャッシュフロー", href: "/accounting/cashflow", icon: TrendingDown },
      { name: "一括完了", href: "/accounting/batch-complete", icon: CheckCircle2 },
      { name: "月次締め", href: "/accounting/monthly-close", icon: Lock },
      { name: "取込管理", href: "/accounting/imports", icon: Upload },
      { name: "USDT日次レート", href: "/accounting/usdt-rates", icon: DollarSign },
      {
        name: "マスタ管理",
        icon: Settings,
        collapsible: true,
        children: [
          { name: "勘定科目", href: "/accounting/masters/accounts", icon: BookOpen },
          { name: "その他取引先", href: "/accounting/masters/counterparties", icon: Building2 },
          { name: "定期取引", href: "/accounting/masters/recurring-transactions", icon: Repeat },
          { name: "経理用プロジェクト管理", href: "/accounting/masters/cost-centers", icon: Tag },
        ],
      },
      {
        name: "固有設定",
        icon: Settings,
        collapsible: true,
        founderOrManager: true,
        children: [
          { name: "プロジェクト設定", href: "/accounting/settings/project", icon: Building2 },
          { name: "契約種別", href: "/settings/contract-types?project=accounting", icon: FileText },
          { name: "顧客種別", href: "/settings/customer-types?project=accounting", icon: UserSquare2 },
          { name: "接触種別", href: "/settings/contact-categories?project=accounting", icon: Tag },
          { name: "スタッフ役割種別", href: "/staff/role-types?project=accounting", icon: Tags },
          { name: "担当者フィールド制約", href: "/staff/field-restrictions?project=accounting", icon: Shield },
          { name: "メールテンプレート", href: "/settings/email-templates?project=accounting", icon: FileText },
        ],
      },
    ],
  },
];

function getSidebarStateKey(userId: string) {
  return `sidebar-open-state-${userId}`;
}

function getSidebarState(userId: string): Record<string, boolean> {
  try {
    const stored = localStorage.getItem(getSidebarStateKey(userId));
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveSidebarState(userId: string, state: Record<string, boolean>) {
  try {
    localStorage.setItem(getSidebarStateKey(userId), JSON.stringify(state));
  } catch {
    // localStorage unavailable
  }
}

/** セクションラベル: 開閉なし、区切り線+ラベルで表示 */
function SectionLabelComponent({
  item,
  depth,
  onNavigate,
  parentPath,
  userId,
}: {
  item: NavItem;
  depth: number;
  onNavigate?: () => void;
  parentPath: string;
  userId?: string;
}) {
  const paddingLeft = 12 + depth * 16;

  return (
    <div className="pt-3 first:pt-0">
      <div
        className="mb-1 flex items-center gap-2 px-3"
        style={{ paddingLeft }}
      >
        <span className="text-xs font-semibold text-gray-400">
          {item.name}
        </span>
        <div className="h-px flex-1 bg-gray-500/40" />
      </div>
      <div className="space-y-0.5">
        {item.children?.map((child) => (
          <NavItemComponent
            key={child.name}
            item={child}
            depth={depth}
            onNavigate={onNavigate}
            parentPath={parentPath}
            userId={userId}
          />
        ))}
      </div>
    </div>
  );
}

/** 開閉式ナビ: chevronアイコン付き */
function CollapsibleNavComponent({
  item,
  depth,
  onNavigate,
  parentPath,
  userId,
}: {
  item: NavItem;
  depth: number;
  onNavigate?: () => void;
  parentPath: string;
  userId?: string;
}) {
  const itemPath = parentPath ? `${parentPath}/${item.name}` : item.name;
  const paddingLeft = 12 + depth * 16;

  // 初期値はfalse（全て閉じた状態）。hydration後にlocalStorageから復元
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (!userId) { setHydrated(true); return; }
    const state = getSidebarState(userId);
    if (state[itemPath]) {
      setIsOpen(true);
    }
    setHydrated(true);
  }, [itemPath, userId]);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      if (userId) {
        const state = getSidebarState(userId);
        state[itemPath] = next;
        saveSidebarState(userId, state);
      }
      return next;
    });
  }, [itemPath, userId]);

  return (
    <div>
      <button
        onClick={handleToggle}
        className={cn(
          "group flex w-full items-center rounded-md px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white"
        )}
        style={{ paddingLeft }}
      >
        <item.icon className="mr-3 h-4 w-4 flex-shrink-0 text-gray-400 group-hover:text-white" />
        <span className="flex-1 text-left">{item.name}</span>
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-gray-500" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-500" />
        )}
      </button>
      {hydrated && isOpen && (
        <div className="mt-0.5 space-y-0.5">
          {item.children!.map((child) => (
            <NavItemComponent
              key={child.name}
              item={child}
              depth={depth + 1}
              onNavigate={onNavigate}
              parentPath={itemPath}
              userId={userId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NavItemComponent({
  item,
  depth = 0,
  onNavigate,
  parentPath = "",
  userId,
}: {
  item: NavItem;
  depth?: number;
  onNavigate?: () => void;
  parentPath?: string;
  userId?: string;
}) {
  const pathname = usePathname();
  const itemPath = parentPath ? `${parentPath}/${item.name}` : item.name;
  const hasChildren = item.children && item.children.length > 0;

  // セクションラベル（フラット表示）
  if (hasChildren && item.sectionLabel) {
    return (
      <SectionLabelComponent
        item={item}
        depth={depth}
        onNavigate={onNavigate}
        parentPath={itemPath}
        userId={userId}
      />
    );
  }

  // 開閉式
  if (hasChildren) {
    return (
      <CollapsibleNavComponent
        item={item}
        depth={depth}
        onNavigate={onNavigate}
        parentPath={itemPath}
        userId={userId}
      />
    );
  }

  // リーフ項目
  const isActive = item.href
    ? pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
    : false;

  const paddingLeft = 12 + depth * 16;

  return (
    <Link
      href={item.href!}
      onClick={onNavigate}
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

function hasManagerPermission(user: SessionUser): boolean {
  return user.permissions.some((p) => p.permissionLevel === "manager");
}

function hasAnyEditPermission(user: SessionUser): boolean {
  return user.permissions.some(
    (p) => p.permissionLevel === "edit" || p.permissionLevel === "manager"
  );
}

function isFounderUser(user: SessionUser): boolean {
  return (user.organizationRole ?? "member") === "founder";
}

function filterNavigationByPermissions(
  items: NavItem[],
  user: SessionUser,
  hiddenItems?: string[]
): NavItem[] {
  const isAdminUser = user.loginId === "admin";
  const isFounder = isFounderUser(user);

  return items
    .filter((item) => {
      // サイドバーカスタマイズ: hiddenItemsに含まれるキーは非表示（デフォルト: 全て表示）
      if (item.key && Array.isArray(hiddenItems) && hiddenItems.length > 0 && hiddenItems.includes(item.key)) {
        return false;
      }
      // adminユーザーは全メニュー表示
      if (isAdminUser) {
        return true;
      }
      // founderOrManager: founder or いずれかのPJでmanager以上
      if (item.founderOrManager) {
        return isFounder || hasManagerPermission(user);
      }
      // editOrAbove: edit以上
      if (item.editOrAbove) {
        return isFounder || hasAnyEditPermission(user);
      }
      // いずれかのプロジェクトでedit以上なら表示
      if (item.requireAnyEdit) {
        return isFounder || hasAnyEditPermission(user);
      }
      if (!item.requiredProject) {
        return true;
      }
      // founderは全PJアクセス可
      if (isFounder) {
        return true;
      }
      return canView(user.permissions, item.requiredProject);
    })
    .map((item) => {
      if (item.children) {
        return {
          ...item,
          children: filterNavigationByPermissions(item.children, user, hiddenItems),
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

/** ナビアイテムの子孫にアクティブなパスがあるかを再帰チェック */
function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.href) {
    return pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
  }
  if (item.children) {
    return item.children.some((child) => isNavItemActive(child, pathname));
  }
  return false;
}

/** 折りたたみ時のアイコンのみ表示 */
function CollapsedNavItem({
  item,
  onExpand,
}: {
  item: NavItem;
  onExpand?: () => void;
}) {
  const pathname = usePathname();
  const isActive = isNavItemActive(item, pathname);

  // リーフ項目: 直接ナビゲーション
  if (item.href) {
    return (
      <Link
        href={item.href}
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-md",
          isActive
            ? "bg-gray-800 text-white"
            : "text-gray-400 hover:bg-gray-700 hover:text-white"
        )}
        title={item.name}
      >
        <item.icon className="h-5 w-5" />
      </Link>
    );
  }

  // 親グループ: クリックでサイドバーを展開
  return (
    <button
      onClick={onExpand}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-md",
        isActive
          ? "bg-gray-800 text-white"
          : "text-gray-400 hover:bg-gray-700 hover:text-white"
      )}
      title={item.name}
    >
      <item.icon className="h-5 w-5" />
    </button>
  );
}

/** プロジェクトコードに対応する名前をナビに適用 */
function applyProjectNames(items: NavItem[], projectNames: Record<string, string>): NavItem[] {
  return items.map((item) => {
    let updated = item;
    if (item.requiredProject && projectNames[item.requiredProject]) {
      updated = { ...updated, name: projectNames[item.requiredProject] };
    }
    if (updated.children) {
      updated = { ...updated, children: applyProjectNames(updated.children, projectNames) };
    }
    return updated;
  });
}

/** ナビゲーション項目のフィルタリング共通ロジック */
function getFilteredNavigation(user?: SessionUser, hiddenItems?: string[], projectNames?: Record<string, string>): NavItem[] {
  if (user?.canEditMasterData && user.loginId !== "admin") {
    return masterDataNavigation;
  }

  const isAdminUser = user?.loginId === "admin";
  const isFounder = user ? isFounderUser(user) : false;
  const showCommonMasterData = isAdminUser;
  const showProjectMasterData =
    isAdminUser || isFounder || (user ? hasManagerPermission(user) : false);

  const baseNavigation = user
    ? filterNavigationByPermissions(navigation, user, hiddenItems)
    : navigation;

  // 固定データ設定ページは各PJフォルダ内に配置済みなので、showProjectMasterDataでない場合は除外
  let result = baseNavigation;
  if (!showProjectMasterData) {
    result = removeMasterDataItems(result);
  }

  // admin向け: 共通固定データナビも追加
  if (showCommonMasterData) {
    result = [
      ...result,
      ...masterDataNavigation,
    ];
  }

  // プロジェクト名をDBの値で上書き
  if (projectNames && Object.keys(projectNames).length > 0) {
    result = applyProjectNames(result, projectNames);
  }

  return result;
}

interface SidebarContentProps {
  user?: SessionUser;
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  hiddenItems?: string[];
  projectNames?: Record<string, string>;
}

export function SidebarContent({
  user,
  onNavigate,
  collapsed,
  onToggleCollapse,
  hiddenItems,
  projectNames,
}: SidebarContentProps) {
  const appTitle = process.env.NEXT_PUBLIC_APP_TITLE || "Stella 基幹OS";
  const navItems = getFilteredNavigation(user, hiddenItems, projectNames);
  const userId = user?.loginId ?? undefined;

  // 折りたたみモード: アイコンのみ表示
  if (collapsed) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex h-16 shrink-0 items-center justify-center">
          <span className="text-lg font-bold text-white">S</span>
        </div>
        <nav className="flex flex-1 flex-col items-center gap-1 overflow-y-auto py-4">
          {navItems.map((item) => (
            <CollapsedNavItem
              key={item.name}
              item={item}
              onExpand={onToggleCollapse}
            />
          ))}
        </nav>
        {onToggleCollapse && (
          <div className="shrink-0 border-t border-gray-700 p-2">
            <button
              onClick={onToggleCollapse}
              className="flex h-10 w-full items-center justify-center rounded-md text-gray-400 hover:bg-gray-700 hover:text-white"
              title="メニューを開く"
            >
              <PanelLeftOpen className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    );
  }

  // 展開モード: フルナビゲーション
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center px-6">
        <h1 className="text-xl font-bold text-white">{appTitle}</h1>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => (
          <NavItemComponent key={item.name} item={item} onNavigate={onNavigate} userId={userId} />
        ))}
      </nav>
      {onToggleCollapse && (
        <div className="shrink-0 border-t border-gray-700 p-2">
          <button
            onClick={onToggleCollapse}
            className="flex h-10 w-full items-center justify-center rounded-md text-gray-400 hover:bg-gray-700 hover:text-white"
            title="メニューを閉じる"
          >
            <PanelLeftClose className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}

interface SidebarProps {
  user?: SessionUser;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  hiddenItems?: string[];
  projectNames?: Record<string, string>;
}

export function Sidebar({ user, collapsed, onToggleCollapse, hiddenItems, projectNames }: SidebarProps) {
  return (
    <div
      className={cn(
        "hidden md:flex h-full flex-col bg-gray-900 transition-[width] duration-300",
        collapsed ? "w-16" : "w-52 lg:w-64"
      )}
    >
      <SidebarContent
        user={user}
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
        hiddenItems={hiddenItems}
        projectNames={projectNames}
      />
    </div>
  );
}
