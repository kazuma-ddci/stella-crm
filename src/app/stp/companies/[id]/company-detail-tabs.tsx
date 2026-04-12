"use client";

import { Suspense, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Building2,
  FileText,
  History,
  Phone,
  GitBranch,
  BarChart3,
  LineChart,
  ClipboardList,
  Loader2,
} from "lucide-react";

// タブコンポーネント
import { OverviewTab } from "./tabs/overview-tab";
import { ContractsTab } from "./tabs/contracts-tab";
import { OperationsTab } from "./tabs/operations-tab";
import { KpiTab } from "./tabs/kpi-tab";
import { ChangeLogTab } from "./tabs/change-log-tab";

// 既存モーダルをインラインで使用
import { CompanyContactHistoryModal } from "../contact-history-modal";
import { StageManagementModal } from "@/components/stage-management/stage-management-modal";
import { ProposalModal } from "@/components/proposal-modal";

// ============================================
// 型定義
// ============================================

import type {
  CustomerType,
  ContactCategoryOption,
} from "@/components/contact-history-modal";

type CompanyData = {
  id: number;
  companyId: number;
  companyName: string;
  industryType: string | null;
  industry: string | null;
  plannedHires: number | null;
  note: string | null;
  contractNote: string | null;
  leadAcquiredDate: string | null;
  leadValidity: string | null;
  hasDeal: string | null;
  operationStatus: string | null;
  currentStageName: string | null;
  currentStageId: number | null;
  nextTargetStageName: string | null;
  nextTargetDate: string | null;
  salesStaffName: string | null;
  adminStaffName: string | null;
  agentName: string | null;
  leadSourceName: string | null;
  forecast: string | null;
  pendingReason: string | null;
  lostReason: string | null;
  billingCompanyName: string | null;
  billingAddress: string | null;
  jobPostingStartDate: string | null;
};

type LatestContract = {
  jobMedia: string | null;
  contractPlan: string;
  monthlyFee: number;
  performanceFee: number;
  initialFee: number;
  contractStartDate: string;
  contractEndDate: string | null;
  status: string;
  operationStaffName: string | null;
  accountId: string | null;
} | null;

type MasterCompanyData = {
  id: number;
  companyCode: string;
  name: string;
  nameKana: string | null;
  corporateNumber: string | null;
  companyType: string | null;
  websiteUrl: string | null;
  industry: string | null;
  revenueScale: string | null;
  employeeCount: number | null;
  note: string | null;
  closingDay: number | null;
  paymentMonthOffset: number | null;
  paymentDay: number | null;
  isInvoiceRegistered: boolean;
  invoiceRegistrationNumber: string | null;
  contacts: Array<{
    id: number;
    name: string;
    email: string | null;
    phone: string | null;
    department: string | null;
    isPrimary: boolean;
    note: string | null;
  }>;
  locations: Array<{
    id: number;
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    isPrimary: boolean;
    note: string | null;
  }>;
  bankAccounts: Array<{
    id: number;
    bankName: string;
    bankCode: string;
    branchName: string;
    branchCode: string;
    accountNumber: string;
    accountHolderName: string;
    note: string | null;
  }>;
};

type Props = {
  stpCompanyId: number;
  companyData: CompanyData;
  masterCompany: MasterCompanyData;
  latestContract: LatestContract;
  initialTab: string;
  contactHistories: Record<string, unknown>[];
  contactMethodOptions: { value: string; label: string }[];
  staffOptions: { value: string; label: string }[];
  contractStatusOptions: { value: string; label: string }[];
  contractTypeOptions: { value: string; label: string }[];
  customerTypes: CustomerType[];
  staffByProject: Record<number, { value: string; label: string }[]>;
  contactCategories: ContactCategoryOption[];
};

// ============================================
// タブ定義
// ============================================

const TAB_DEFS = [
  { value: "overview", label: "概要", icon: Building2 },
  { value: "contracts", label: "契約管理", icon: FileText },
  { value: "contacts", label: "接触履歴", icon: Phone },
  { value: "pipeline", label: "パイプライン", icon: GitBranch },
  { value: "proposals", label: "提案書", icon: ClipboardList },
  { value: "operations", label: "運用管理", icon: BarChart3 },
  { value: "kpi", label: "運用KPI", icon: LineChart },
  { value: "changelog", label: "変更履歴", icon: History },
] as const;

// ============================================
// メインコンポーネント
// ============================================

function CompanyDetailTabsInner(props: Props) {
  const {
    stpCompanyId,
    companyData,
    masterCompany,
    latestContract,
    initialTab,
    contactHistories,
    contactMethodOptions,
    staffOptions,
    contractStatusOptions,
    contractTypeOptions,
    customerTypes,
    staffByProject,
    contactCategories,
  } = props;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") || initialTab;

  const handleTabChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", value);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  return (
    <div className="p-6 space-y-4">
      {/* ヘッダ */}
      <div>
        <Link href="/stp/companies">
          <Button variant="ghost" size="sm" className="mb-1">
            <ArrowLeft className="mr-1 h-4 w-4" />
            企業一覧に戻る
          </Button>
        </Link>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold">{companyData.companyName}</h1>
          {companyData.currentStageName && (
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              {companyData.currentStageName}
            </Badge>
          )}
          {companyData.salesStaffName && (
            <span className="text-sm text-gray-500">
              営業: {companyData.salesStaffName}
            </span>
          )}
          {companyData.adminStaffName && (
            <span className="text-sm text-gray-500">
              事務: {companyData.adminStaffName}
            </span>
          )}
        </div>
      </div>

      {/* タブ */}
      <Tabs value={currentTab} onValueChange={handleTabChange}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          {TAB_DEFS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="gap-1.5">
              <Icon className="h-3.5 w-3.5" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* 概要 */}
        <TabsContent value="overview" className="mt-4">
          <OverviewTab
            stpCompanyId={stpCompanyId}
            company={companyData}
            masterCompany={masterCompany}
            latestContract={latestContract}
            onTabChange={handleTabChange}
          />
        </TabsContent>

        {/* 契約管理 */}
        <TabsContent value="contracts" className="mt-4">
          <ContractsTab
            companyId={companyData.companyId}
            companyName={companyData.companyName}
            staffOptions={staffOptions}
            contractStatusOptions={contractStatusOptions}
            contractTypeOptions={contractTypeOptions}
          />
        </TabsContent>

        {/* 接触履歴 */}
        <TabsContent value="contacts" className="mt-4">
          <CompanyContactHistoryModal
            open={true}
            onOpenChange={() => {}}
            renderInline={true}
            stpCompanyId={stpCompanyId}
            companyName={companyData.companyName}
            contactHistories={contactHistories}
            contactMethodOptions={contactMethodOptions}
            staffOptions={staffOptions}
            customerTypes={customerTypes}
            staffByProject={staffByProject}
            contactCategories={contactCategories}
          />
        </TabsContent>

        {/* パイプライン */}
        <TabsContent value="pipeline" className="mt-4">
          <StageManagementModal
            open={true}
            onOpenChange={() => {}}
            renderInline={true}
            stpCompanyId={stpCompanyId}
            onUpdateSuccess={() => router.refresh()}
          />
        </TabsContent>

        {/* 提案書 */}
        <TabsContent value="proposals" className="mt-4">
          <ProposalModal
            open={true}
            onOpenChange={() => {}}
            renderInline={true}
            stpCompanyId={stpCompanyId}
            companyName={companyData.companyName}
            staffOptions={staffOptions}
          />
        </TabsContent>

        {/* 運用管理 */}
        <TabsContent value="operations" className="mt-4">
          <OperationsTab
            stpCompanyId={stpCompanyId}
            companyName={companyData.companyName}
          />
        </TabsContent>

        {/* 運用KPI */}
        <TabsContent value="kpi" className="mt-4">
          <KpiTab />
        </TabsContent>

        {/* 変更履歴 */}
        <TabsContent value="changelog" className="mt-4">
          <ChangeLogTab stpCompanyId={stpCompanyId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Suspenseラッパー（useSearchParams用）
export function CompanyDetailTabs(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      }
    >
      <CompanyDetailTabsInner {...props} />
    </Suspense>
  );
}
