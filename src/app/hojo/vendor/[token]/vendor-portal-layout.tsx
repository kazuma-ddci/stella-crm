"use client";

import { useState, useEffect } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  PortalHeader,
  PortalUserMenu,
  PortalLayout,
  PortalSidebar,
} from "@/components/hojo-portal";

export type VendorSection =
  | "wholesale"
  | "grant"
  | "consulting-contract"
  | "consulting-activity"
  | "consulting-customer"
  | "loan"
  | "loan-progress";

const menuSections = [
  {
    label: "コンサル/BPO",
    items: [
      { key: "consulting-contract", label: "契約情報" },
      { key: "consulting-activity", label: "コンサル履歴" },
      { key: "consulting-customer", label: "顧客管理" },
    ],
  },
  {
    label: "セキュリティクラウド卸",
    items: [{ key: "wholesale", label: "卸アカウント管理" }],
  },
  {
    label: "助成金申請",
    items: [{ key: "grant", label: "助成金申請管理" }],
  },
  {
    label: "貸金業社",
    items: [
      { key: "loan", label: "借入申込管理" },
      { key: "loan-progress", label: "顧客進捗管理" },
    ],
  },
];

function getSectionTitle(section: VendorSection): string {
  const map: Record<VendorSection, string> = {
    wholesale: "卸アカウント管理",
    grant: "助成金申請管理",
    "consulting-contract": "契約情報",
    "consulting-activity": "コンサル履歴",
    "consulting-customer": "顧客管理",
    loan: "借入申込管理",
    "loan-progress": "顧客進捗管理",
  };
  return map[section];
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
  // SSR/クライアント間のRadix useId()不一致を防ぐため、Selectはマウント後にのみ描画
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const handleVendorChange = (token: string) => {
    router.push(`/hojo/vendor/${token}`);
  };

  const header = (
    <PortalHeader
      title={`${vendorName}様 専用ページ`}
      rightContent={
        <PortalUserMenu
          userName={isVendor ? userName : undefined}
          onLogout={() => signOut({ callbackUrl: `/hojo/vendor/${vendorToken}` })}
          extra={
            mounted && allVendors.length > 0 ? (
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
            ) : undefined
          }
        />
      }
    />
  );

  const sidebar = (
    <PortalSidebar
      vendorName={vendorName}
      sections={menuSections}
      activeKey={activeSection}
      onSelect={(key) => onSectionChange(key as VendorSection)}
    />
  );

  return (
    <PortalLayout
      header={header}
      sidebar={sidebar}
      pageTitle={getSectionTitle(activeSection)}
    >
      {children}
    </PortalLayout>
  );
}
