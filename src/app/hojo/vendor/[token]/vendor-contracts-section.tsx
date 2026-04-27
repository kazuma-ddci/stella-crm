"use client";

import { FileText, Building2, Users, ClipboardCheck, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type VendorContactInfo = {
  id: number; name: string; role: string; email: string; phone: string; isPrimary: boolean;
};

type VendorInfo = {
  scLabel: string;
  assignedAs: string | null;
  consultingStaffNames: string[];
  companyName: string;
  contacts: VendorContactInfo[];
  kickoffMtg: string | null;
  consultingPlan: string | null;
  consultingPlanContractStatus: string | null;
  consultingPlanContractDate: string | null;
  consultingPlanEndDate: string | null;
  scWholesalePlan: string | null;
  scWholesaleContractStatus: string | null;
  scWholesaleContractDate: string | null;
  scWholesaleEndDate: string | null;
  grantApplicationBpoContractStatus: string | null;
  grantApplicationBpoContractDate: string | null;
  subsidyConsulting: boolean;
  grantApplicationBpo: boolean;
  loanUsage: boolean;
  loanUsageKickoffMtg: string | null;
  vendorSharedMemo: string | null;
};

type ContractRecord = {
  id: number;
  lineNumber: string;
  lineName: string;
  referralUrl: string;
  assignedAs: string;
  consultingStaff: string;
  companyName: string;
  representativeName: string;
  mainContactName: string;
  customerEmail: string;
  customerPhone: string;
  contractDate: string;
  contractPlan: string;
  contractAmount: number | string;
  serviceType: string;
  caseStatus: string;
  hasScSales: boolean;
  hasSubsidyConsulting: boolean;
  hasBpoSupport: boolean;
  consultingPlan: string;
  successFee: number | string;
  startDate: string;
  endDate: string;
  billingStatus: string;
  paymentStatus: string;
  revenueRecordingDate: string;
  grossProfit: number | string;
  notes: string;
};

type Props = {
  data: ContractRecord[];
  vendorInfo: VendorInfo;
};

const fmtCurrency = (v: number | string) => {
  if (v === "" || v === null || v === undefined) return "-";
  const n = typeof v === "string" ? Number(v) : v;
  if (isNaN(n)) return "-";
  return `\u00a5${n.toLocaleString()}`;
};

const fmtBool = (v: boolean) => v ? "あり" : "なし";

const roleLabel = (role: string): string => {
  switch (role) {
    case "representative": return "代表者";
    case "contact_person": return "主担当者";
    default: return "担当者";
  }
};

// ========== ベンダー契約概要 ==========
function VendorOverviewSection({ vendorInfo }: { vendorInfo: VendorInfo }) {
  const representative = vendorInfo.contacts.find((c) => c.role === "representative");
  const primaryContact = vendorInfo.contacts.find((c) => c.role === "contact_person" || c.isPrimary);

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
      <div className="bg-gradient-to-r from-[#10b981] to-[#86efac] px-8 py-5">
        <h3 className="font-bold text-white text-lg">契約情報</h3>
      </div>

      <div className="divide-y divide-gray-100">
        {/* 担当情報 */}
        <div className="px-8 py-6">
          <h4 className="text-xs font-bold text-[#10b981] uppercase tracking-widest mb-4 flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            担当情報
          </h4>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-4">
            <InfoField label="会社名" value={vendorInfo.companyName} />
            <InfoField label="担当AS" value={vendorInfo.assignedAs} />
            <InfoField
              label="コンサル担当者"
              value={vendorInfo.consultingStaffNames.length > 0 ? vendorInfo.consultingStaffNames.join(", ") : null}
            />
          </div>
        </div>

        {/* ベンダー担当者 */}
        {vendorInfo.contacts.length > 0 && (
          <div className="px-8 py-6">
            <h4 className="text-xs font-bold text-[#10b981] uppercase tracking-widest mb-4 flex items-center gap-2">
              <Users className="h-4 w-4" />
              ベンダー担当者
            </h4>
            <div className="space-y-3">
              {representative && (
                <ContactRow contact={representative} />
              )}
              {primaryContact && primaryContact.id !== representative?.id && (
                <ContactRow contact={primaryContact} />
              )}
              {vendorInfo.contacts
                .filter((c) => c.id !== representative?.id && c.id !== primaryContact?.id)
                .map((c) => (
                  <ContactRow key={c.id} contact={c} />
                ))}
            </div>
          </div>
        )}

        {/* 契約状況 */}
        <div className="px-8 py-6">
          <h4 className="text-xs font-bold text-[#10b981] uppercase tracking-widest mb-4 flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" />
            契約状況
          </h4>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-4">
            <InfoField label="初回MTG" value={vendorInfo.kickoffMtg ? new Date(vendorInfo.kickoffMtg).toLocaleString("ja-JP") : null} />
            <InfoField label={`${vendorInfo.scLabel}卸プラン`} value={vendorInfo.scWholesalePlan} />
            <InfoField label={`${vendorInfo.scLabel}卸 契約状況`} value={vendorInfo.scWholesaleContractStatus} />
            <InfoField label={`${vendorInfo.scLabel}卸 契約日`} value={vendorInfo.scWholesaleContractDate} />
            <InfoField label={`${vendorInfo.scLabel}卸 終了予定日`} value={vendorInfo.scWholesaleEndDate} />
            <InfoField label="コンサルティングプラン" value={vendorInfo.consultingPlan} />
            <InfoField label="コンサル契約状況" value={vendorInfo.consultingPlanContractStatus} />
            <InfoField label="コンサル契約日" value={vendorInfo.consultingPlanContractDate} />
            <InfoField label="コンサル終了予定日" value={vendorInfo.consultingPlanEndDate} />
            <InfoField label="BPO契約状況" value={vendorInfo.grantApplicationBpoContractStatus} />
            <InfoField label="BPO契約日" value={vendorInfo.grantApplicationBpoContractDate} />
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-400">助成金コンサル</span>
              <span>
                <BoolBadge value={vendorInfo.subsidyConsulting} />
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-400">BPO申請支援</span>
              <span>
                <BoolBadge value={vendorInfo.grantApplicationBpo} />
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-400">貸金業者</span>
              <span>
                <BoolBadge value={vendorInfo.loanUsage} />
              </span>
            </div>
          </div>
        </div>

        {/* 備考 */}
        {vendorInfo.vendorSharedMemo && (
          <div className="px-8 py-6">
            <h4 className="text-xs font-bold text-[#10b981] uppercase tracking-widest mb-3 flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              備考
            </h4>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{vendorInfo.vendorSharedMemo}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-sm text-gray-800 font-medium">{value || "\u2014"}</span>
    </div>
  );
}

function BoolBadge({ value }: { value: boolean }) {
  return (
    <Badge variant={value ? "default" : "secondary"} className={value ? "bg-[#d1fae5] text-[#10b981] hover:bg-[#d1fae5] border-[#a7f3d0]" : "bg-gray-100 text-gray-500 hover:bg-gray-100"}>
      {value ? "あり" : "なし"}
    </Badge>
  );
}

function ContactRow({ contact }: { contact: VendorContactInfo }) {
  const parts: string[] = [];
  if (contact.email) parts.push(contact.email);
  if (contact.phone) parts.push(contact.phone);

  return (
    <div className="flex items-center gap-3 py-1">
      <Badge variant="outline" className="text-xs shrink-0 border-[#10b981]/30 text-[#10b981]">{roleLabel(contact.role)}</Badge>
      <span className="text-sm text-gray-800 font-medium">{contact.name || "\u2014"}</span>
      {parts.length > 0 && (
        <span className="text-sm text-gray-400">{parts.join(" / ")}</span>
      )}
    </div>
  );
}

// ========== 個別契約カード（既存のフィールドグループ） ==========

type FieldGroup = {
  title: string;
  fields: { label: string; key: keyof ContractRecord; format?: "currency" | "bool" }[];
};

const fieldGroups: FieldGroup[] = [
  {
    title: "顧客情報",
    fields: [
      { label: "会社名", key: "companyName" },
      { label: "代表者名", key: "representativeName" },
      { label: "主担当者名", key: "mainContactName" },
      { label: "メール", key: "customerEmail" },
      { label: "電話番号", key: "customerPhone" },
      { label: "LINE名", key: "lineName" },
      { label: "番号", key: "lineNumber" },
      { label: "紹介URL", key: "referralUrl" },
      { label: "担当AS", key: "assignedAs" },
      { label: "コンサル担当者", key: "consultingStaff" },
    ],
  },
  {
    title: "契約内容",
    fields: [
      { label: "契約日", key: "contractDate" },
      { label: "契約プラン", key: "contractPlan" },
      { label: "契約金額", key: "contractAmount", format: "currency" },
      { label: "サービス種別", key: "serviceType" },
      { label: "案件ステータス", key: "caseStatus" },
      { label: "コンサルプラン", key: "consultingPlan" },
      { label: "成功報酬金額", key: "successFee", format: "currency" },
      { label: "開始日", key: "startDate" },
      { label: "終了予定日", key: "endDate" },
    ],
  },
  {
    title: "サービス内訳",
    fields: [
      { label: "セキュリティクラウド販売", key: "hasScSales", format: "bool" },
      { label: "助成金コンサル", key: "hasSubsidyConsulting", format: "bool" },
      { label: "BPO支援", key: "hasBpoSupport", format: "bool" },
    ],
  },
  {
    title: "請求・入金",
    fields: [
      { label: "請求状況", key: "billingStatus" },
      { label: "入金状況", key: "paymentStatus" },
      { label: "売上計上日", key: "revenueRecordingDate" },
      { label: "粗利", key: "grossProfit", format: "currency" },
    ],
  },
];

function formatValue(record: ContractRecord, def: { key: keyof ContractRecord; format?: "currency" | "bool" }): string {
  const v = record[def.key];
  if (def.format === "currency") return fmtCurrency(v as number | string);
  if (def.format === "bool") return fmtBool(v as boolean);
  return String(v || "-");
}

export function VendorContractsSection({ data, vendorInfo }: Props) {
  return (
    <div className="space-y-6">
      {/* ベンダー契約概要 */}
      <VendorOverviewSection vendorInfo={vendorInfo} />

      {/* 個別契約リスト */}
      {data.length > 0 && (
        <>
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-widest mt-8">個別契約</h3>
          {data.map((contract, idx) => (
            <div key={contract.id} className="rounded-xl border border-slate-200 overflow-hidden">
              {/* Contract Header */}
              <div className="bg-gradient-to-r from-slate-50 to-white px-6 py-4 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-800 text-base">
                      {contract.companyName || "(企業名なし)"}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">契約 #{idx + 1}</p>
                  </div>
                  {contract.caseStatus && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 ring-1 ring-blue-200">
                      {contract.caseStatus}
                    </span>
                  )}
                </div>
              </div>

              {/* Contract Body - grouped sections */}
              <div className="divide-y divide-slate-100">
                {fieldGroups.map((group) => (
                  <div key={group.title} className="px-6 py-4">
                    <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">
                      {group.title}
                    </h4>
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2.5">
                      {group.fields.map((def) => (
                        <div key={def.key} className="flex flex-col">
                          <span className="text-[11px] text-slate-400">{def.label}</span>
                          <span className="text-sm text-slate-800 font-medium">
                            {def.key === "referralUrl" && contract.referralUrl ? (
                              <a
                                href={contract.referralUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 underline decoration-blue-200 hover:decoration-blue-400 transition-colors"
                              >
                                リンク
                              </a>
                            ) : (
                              formatValue(contract, def)
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Notes */}
                {contract.notes && (
                  <div className="px-6 py-4">
                    <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">備考</h4>
                    <p className="text-sm text-slate-600 whitespace-pre-wrap">{contract.notes}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
