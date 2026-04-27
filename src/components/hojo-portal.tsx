"use client";

import { cn } from "@/lib/utils";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

// 薄めで鮮やかなグリーン基調のカラートークン
const GRADIENT_LINE = "bg-gradient-to-r from-[#86efac] via-[#4ade80] to-[#34d399]";
const LOGIN_BG = "bg-gradient-to-br from-gray-50 via-white to-[#ecfdf5]";
const ACTIVE_BG = "bg-[#ecfdf5]";
const ACTIVE_TEXT = "text-[#059669]";
const ACTIVE_BORDER = "border-[#a7f3d0]";
const EMPTY_ICON_BG = "bg-gradient-to-br from-[#86efac]/30 to-[#34d399]/30";
const EMPTY_ICON_TEXT = "text-[#10b981]";

export function PortalHeader({
  title,
  rightContent,
}: {
  title: string;
  rightContent?: React.ReactNode;
}) {
  return (
    <header className="relative bg-white border-b">
      <div className={cn("h-1", GRADIENT_LINE)} />
      <div className="px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        </div>
        {rightContent && (
          <div className="flex items-center gap-4">
            {rightContent}
          </div>
        )}
      </div>
    </header>
  );
}

export function PortalUserMenu({
  userName,
  onLogout,
  extra,
}: {
  userName?: string;
  onLogout: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <>
      {extra}
      {userName && (
        <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
          <span className="text-sm text-gray-500">{userName}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-2 text-gray-400 hover:text-gray-600"
            onClick={onLogout}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      )}
    </>
  );
}

export function PortalLoginWrapper({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-h-screen flex items-center justify-center px-4", LOGIN_BG)}>
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className={cn("h-1", GRADIENT_LINE)} />
          <div className="px-8 pt-10 pb-2 text-center">
            <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
            {subtitle && <p className="text-sm text-gray-400 mt-2">{subtitle}</p>}
          </div>
          <div className="px-8 py-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

type NavSection = {
  label: string;
  items: { key: string; label: string }[];
};

export function PortalSidebar({
  vendorName,
  sections,
  activeKey,
  onSelect,
}: {
  vendorName?: string;
  sections: NavSection[];
  activeKey: string;
  onSelect: (key: string) => void;
}) {
  return (
    <nav className="w-60 shrink-0 border-r bg-white pt-5 pb-6 px-5">
      {vendorName && (
        <div className="px-2 pb-4 mb-4 border-b border-gray-200">
          <p className="text-xs text-gray-400 mb-0.5">ベンダー</p>
          <p className="text-base font-bold text-gray-800 truncate">{vendorName}</p>
        </div>
      )}
      <div className="space-y-5">
        {sections.map((section) => (
          <div key={section.label}>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-2">
              {section.label}
            </div>
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive = activeKey === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => onSelect(item.key)}
                    className={cn(
                      "block w-full text-left px-3 py-2.5 text-sm rounded-lg transition-all duration-150",
                      isActive
                        ? cn(ACTIVE_BG, ACTIVE_TEXT, "font-semibold border", ACTIVE_BORDER)
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    )}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}

export function PortalLayout({
  header,
  sidebar,
  pageTitle,
  children,
}: {
  header: React.ReactNode;
  sidebar: React.ReactNode;
  pageTitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {header}
      <div className="flex flex-1">
        {sidebar}
        <main className="flex-1 min-w-0">
          <div className="px-8 py-6">
            {pageTitle && (
              <h2 className="text-xl font-bold text-gray-900 mb-6">{pageTitle}</h2>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export function PortalSimpleLayout({
  header,
  children,
}: {
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {header}
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}

export function PortalCard({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("bg-white rounded-xl border border-gray-200 overflow-hidden", className)}>
      {title && (
        <div className="px-8 py-5 border-b border-gray-100 bg-gray-50/50">
          <h3 className="font-bold text-gray-900 text-lg">{title}</h3>
        </div>
      )}
      <div className="px-8 py-6">
        {children}
      </div>
    </div>
  );
}

export function PortalEmpty({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
      <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center mb-4", EMPTY_ICON_BG)}>
        <Icon className={cn("h-8 w-8", EMPTY_ICON_TEXT)} />
      </div>
      <p className="text-base font-medium text-gray-500 mb-1">{title}</p>
      {description && <p className="text-sm text-gray-400">{description}</p>}
    </div>
  );
}
