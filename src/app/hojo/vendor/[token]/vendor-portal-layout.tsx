"use client";

import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type VendorSection =
  | "wholesale"
  | "grant"
  | "consulting-contract"
  | "consulting-activity"
  | "loan";

type NavItem = {
  key: VendorSection;
  label: string;
} | {
  label: string;
  children: { key: VendorSection; label: string }[];
};

const navItems: NavItem[] = [
  { key: "wholesale", label: "セキュリティクラウド卸" },
  { key: "grant", label: "助成金申請" },
  {
    label: "コンサル/BPO",
    children: [
      { key: "consulting-contract", label: "契約概要" },
      { key: "consulting-activity", label: "活動記録" },
    ],
  },
  { key: "loan", label: "貸金" },
];

function isParentOfSection(item: NavItem, section: VendorSection): boolean {
  return "children" in item && item.children.some((c) => c.key === section);
}

type Props = {
  authenticated: boolean;
  isVendor: boolean;
  canEdit: boolean;
  vendorName: string;
  vendorToken: string;
  allVendors: { id: number; name: string; token: string }[];
  userName?: string;
  activeSection: VendorSection;
  onSectionChange: (section: VendorSection) => void;
  children: React.ReactNode;
};

export function VendorPortalLayout({
  isVendor,
  vendorName,
  vendorToken,
  allVendors,
  userName,
  activeSection,
  onSectionChange,
  children,
}: Props) {
  const router = useRouter();

  const handleVendorChange = (token: string) => {
    router.push(`/hojo/vendor/${token}`);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{vendorName}様 専用ページ</h1>
        <div className="flex items-center gap-3">
          {isVendor && userName && (
            <>
              <span className="text-sm text-gray-600">{userName}さん</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  signOut({ callbackUrl: `/hojo/vendor/${vendorToken}` })
                }
              >
                ログアウト
              </Button>
            </>
          )}
          {allVendors.length > 0 && (
            <Select value={vendorToken} onValueChange={handleVendorChange}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allVendors.map((v) => (
                  <SelectItem key={v.token} value={v.token}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="border-b">
        <div className="flex gap-0">
          {navItems.map((item, idx) => {
            if ("key" in item) {
              const isActive = activeSection === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => onSectionChange(item.key)}
                  className={cn(
                    "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                    isActive
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  )}
                >
                  {item.label}
                </button>
              );
            }

            // Dropdown item
            const isActive = isParentOfSection(item, activeSection);
            const activeChild = item.children.find(
              (c) => c.key === activeSection
            );
            return (
              <DropdownMenu key={idx}>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-1",
                      isActive
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    )}
                  >
                    {item.label}
                    {activeChild && (
                      <span className="text-xs">({activeChild.label})</span>
                    )}
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {item.children.map((child) => (
                    <DropdownMenuItem
                      key={child.key}
                      onClick={() => onSectionChange(child.key)}
                      className={cn(
                        activeSection === child.key && "bg-blue-50 text-blue-600"
                      )}
                    >
                      {child.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })}
        </div>
      </nav>

      {/* Content */}
      <div>{children}</div>
    </div>
  );
}
