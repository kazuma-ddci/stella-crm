"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CrudTable, ColumnDef, CustomAction, CustomRenderers, DynamicOptionsMap, CustomFormFields, InlineEditConfig } from "@/components/crud-table";
import { StageManagementModal } from "@/components/stage-management";
import { CompanyContactHistoryModal } from "./contact-history-modal";
import { ContractHistoryModal } from "./contract-history-modal";
import { MasterContractModal } from "@/components/master-contract-modal";
import { ProposalModal } from "@/components/proposal-modal";
import { FieldChangeLogModal } from "@/components/field-change-log-modal";
import { TextPreviewCell } from "@/components/text-preview-cell";
import { addStpCompany, updateStpCompany, deleteStpCompany, checkDuplicateCompanyId } from "./actions";
import { CompanyCodeLabel } from "@/components/company-code-label";
import { isInvalidJobMedia } from "@/lib/stp/job-media";
import { BarChart3, MessageSquare, FileText, ScrollText, ChevronsUpDown, AlertTriangle, FileEdit, LineChart, DollarSign, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type CustomerType = {
  id: number;
  name: string;
  projectId: number;
  displayOrder: number;
  project: {
    id: number;
    name: string;
    displayOrder: number;
  };
};

type Props = {
  data: Record<string, unknown>[];
  companyOptions: { value: string; label: string }[];
  stageOptions: { value: string; label: string }[];
  agentOptions: { value: string; label: string }[];
  staffOptions: { value: string; label: string }[];
  adminStaffOptions: { value: string; label: string }[];
  contractStaffOptions: { value: string; label: string }[];
  leadSourceOptions: { value: string; label: string }[];
  billingAddressByCompany: Record<string, { value: string; label: string }[]>;
  billingContactByCompany: Record<string, { value: string; label: string }[]>;
  contactMethodOptions: { value: string; label: string }[];
  pendingStageId?: number;
  lostStageId?: number;
  masterContractStatusOptions: { value: string; label: string }[];
  customerTypes: CustomerType[];
  staffByProject: Record<number, { value: string; label: string }[]>;
  contactCategories: { id: number; name: string; projectId: number; project: { id: number; name: string; displayOrder: number } }[];
};

export function StpCompaniesTable({
  data,
  companyOptions,
  stageOptions,
  agentOptions,
  staffOptions,
  adminStaffOptions,
  contractStaffOptions,
  leadSourceOptions,
  billingAddressByCompany,
  billingContactByCompany,
  contactMethodOptions,
  pendingStageId,
  lostStageId,
  masterContractStatusOptions,
  customerTypes,
  staffByProject,
  contactCategories,
}: Props) {
  const router = useRouter();
  const [stageModalOpen, setStageModalOpen] = useState(false);
  const [contactHistoryModalOpen, setContactHistoryModalOpen] = useState(false);
  const [contractHistoryModalOpen, setContractHistoryModalOpen] = useState(false);
  const [masterContractModalOpen, setMasterContractModalOpen] = useState(false);
  const [proposalModalOpen, setProposalModalOpen] = useState(false);
  const [changeLogModalOpen, setChangeLogModalOpen] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Record<string, unknown> | null>(null);

  // 企業ID重複チェック用の状態
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [companyPopoverOpen, setCompanyPopoverOpen] = useState(false);

  // 動的選択肢のマッピング
  const dynamicOptions: DynamicOptionsMap = {
    billingAddress: billingAddressByCompany,
    billingContactIds: billingContactByCompany,
  };

  // 企業ID選択のカスタムフォームフィールド（重複チェック付き）
  const customFormFields: CustomFormFields = {
    companyId: {
      render: (value, onChange) => {
        const selectedOption = companyOptions.find((opt) => opt.value === String(value));

        // 値がリセットされた場合（ダイアログが再オープンされた場合など）は警告もクリア
        if (!value && duplicateWarning) {
          // 次のレンダリングでクリアする（無限ループ防止）
          setTimeout(() => setDuplicateWarning(null), 0);
        }

        const handleSelect = async (optValue: string) => {
          const companyId = Number(optValue);
          onChange(optValue);
          setCompanyPopoverOpen(false);

          // 重複チェックを実行
          const result = await checkDuplicateCompanyId(companyId);
          if (result.isDuplicate) {
            setDuplicateWarning(`この企業はすでにSTPプロジェクトに登録されています（プロジェクトNo. ${result.stpCompanyId}）`);
          } else {
            setDuplicateWarning(null);
          }
        };

        return (
          <div className="space-y-2">
            <Popover open={companyPopoverOpen} onOpenChange={setCompanyPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={companyPopoverOpen}
                  className="w-full justify-between"
                >
                  {selectedOption ? selectedOption.label : "選択してください..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[400px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="検索..." />
                  <CommandList maxHeight={300}>
                    <CommandEmpty>見つかりませんでした</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="__empty__"
                        onSelect={() => {
                          onChange(null);
                          setCompanyPopoverOpen(false);
                          setDuplicateWarning(null);
                        }}
                      >
                        -
                      </CommandItem>
                      {companyOptions.map((opt) => (
                        <CommandItem
                          key={opt.value}
                          value={opt.label}
                          onSelect={() => handleSelect(opt.value)}
                        >
                          {opt.label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {duplicateWarning && (
              <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span>{duplicateWarning}</span>
              </div>
            )}
          </div>
        );
      },
    },
  };

  // ヨミの選択肢
  const forecastOptions = [
    { value: "MIN", label: "MIN" },
    { value: "落とし", label: "落とし" },
    { value: "MAX", label: "MAX" },
    { value: "来月", label: "来月" },
    { value: "辞退", label: "辞退" },
  ];

  const columns: ColumnDef[] = [
    // プロジェクトNo.（STP企業ID）
    { key: "id", header: "プロジェクトNo.", editable: false },
    // 企業ID（全顧客マスタから選択）- フォーム用、テーブル非表示
    { key: "companyId", header: "企業ID", type: "select", options: companyOptions, required: true, searchable: true, simpleMode: true, editableOnCreate: true, editableOnUpdate: false, hidden: true },
    // 企業名
    { key: "companyName", header: "企業名", editable: false },
    // 企業メモ - TextPreviewCell形式で編集
    { key: "note", header: "企業メモ", type: "textarea", simpleMode: true },
    // 代理店ID（非表示）
    { key: "agentId", header: "代理店（選択）", type: "select", options: agentOptions, searchable: true, hidden: true },
    // 代理店名
    { key: "agentName", header: "代理店", editable: false },
    // 流入経路（IDは非表示）- インライン編集可能（leadSourceIdを使用）
    { key: "leadSourceId", header: "流入経路（選択）", type: "select", options: leadSourceOptions, hidden: true, inlineEditable: true },
    { key: "leadSourceName", header: "流入経路", editable: false },
    // リード獲得日
    { key: "leadAcquiredDate", header: "リード獲得日", type: "date", simpleMode: true },
    // 最終接触日
    { key: "latestContactDate", header: "最終接触日", type: "date", editable: false },
    // 現在ステージ（IDは非表示、名前のみ表示）- セルクリックでステージモーダル
    { key: "currentStageId", header: "現在パイプライン（選択）", type: "select", options: stageOptions, simpleMode: true, editableOnCreate: true, editableOnUpdate: false, hidden: true },
    { key: "currentStageName", header: "現在パイプライン", editable: false },
    // ネクストステージ（IDは非表示、名前のみ表示）- セルクリックでステージモーダル
    { key: "nextTargetStageId", header: "ネクストパイプライン（選択）", type: "select", options: stageOptions, simpleMode: true, editableOnCreate: true, editableOnUpdate: false, hidden: true },
    { key: "nextTargetStageName", header: "ネクストパイプライン", editable: false },
    // ステージコミット（次回商談日コミットから名前変更）- セルクリックでステージモーダル
    { key: "nextTargetDate", header: "パイプラインコミット", type: "date", simpleMode: true, editableOnCreate: true, editableOnUpdate: false },
    // ヨミ - インライン編集可能
    { key: "forecast", header: "ヨミ", type: "select", options: forecastOptions, inlineEditable: true },
    // 担当営業（IDは非表示）- インライン編集可能
    { key: "salesStaffId", header: "担当営業（選択）", type: "select", options: staffOptions, searchable: true, hidden: true, inlineEditable: true },
    { key: "salesStaffName", header: "担当営業", editable: false },
    // 担当事務（IDは非表示）- インライン編集可能
    { key: "adminStaffId", header: "担当事務（選択）", type: "select", options: adminStaffOptions, searchable: true, hidden: true, inlineEditable: true },
    { key: "adminStaffName", header: "担当事務", editable: false },
    // 提案書（操作ボタン）
    { key: "proposal", header: "提案書", editable: false },
    // 採用予定人数 - インライン編集可能
    { key: "plannedHires", header: "採用予定人数", type: "number", inlineEditable: true },
    // 契約履歴から取得する項目（表示のみ）
    { key: "contractIndustryType", header: "業種区分", editable: false },
    { key: "contractJobMedia", header: "求人媒体", editable: false },
    { key: "contractPlan", header: "契約プラン", editable: false },
    { key: "contractAmount", header: "金額", editable: false },
    { key: "contractInitialFee", header: "初期費用", editable: false },
    { key: "contractStartDate", header: "契約開始日", editable: false },
    { key: "contractNote", header: "契約メモ", editable: false },
    { key: "contractOperationStaff", header: "担当運用", editable: false },
    { key: "contractOperationStatus", header: "運用ステータス", editable: false },
    { key: "contractAccountId", header: "アカウントID", editable: false },
    { key: "contractAccountPass", header: "アカウントPASS", editable: false },
    // 運用KPI（操作ボタン）
    { key: "operationKpi", header: "運用KPI", editable: false },
    // 請求先住所（選択した企業の拠点住所から複数選択）- インライン編集可能
    { key: "billingAddress", header: "請求先住所", type: "multiselect", dynamicOptionsKey: "billingAddress", dependsOn: "companyId", inlineEditable: true },
    // 請求先担当者（選択用、非表示）- インライン編集可能
    { key: "billingContactIds", header: "請求先担当者（選択）", type: "multiselect", dynamicOptionsKey: "billingContactIds", dependsOn: "companyId", hidden: true, inlineEditable: true },
    // 請求先担当者（名前とメールを統合表示）
    { key: "billingContacts", header: "請求先担当者", editable: false },
    // 検討理由（検討中ステージ以外はグレーアウト）- TextPreviewCell形式で編集
    { key: "pendingReason", header: "検討理由", type: "textarea" },
    // 失注理由（失注ステージ以外はグレーアウト）- TextPreviewCell形式で編集
    { key: "lostReason", header: "失注理由", type: "textarea" },
  ];

  // 業種区分のラベル変換
  const industryTypeLabels: Record<string, string> = {
    general: "一般",
    dispatch: "派遣",
  };

  // 契約プランのラベル変換
  const contractPlanLabels: Record<string, string> = {
    monthly: "月額",
    performance: "成果報酬",
  };

  // カスタムレンダラー：企業HPをリンクとして表示、検討理由・失注理由をグレーアウト、契約履歴を縦並び表示、ステージセルクリック対応
  const customRenderers: CustomRenderers = {
    // 現在ステージ：クリックでステージ管理モーダルを開く
    currentStageName: (value, row) => {
      return (
        <span
          className="cursor-pointer text-blue-600 hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedCompanyId(row.id as number);
            setStageModalOpen(true);
          }}
        >
          {value ? String(value) : "-"}
        </span>
      );
    },
    // ネクストステージ：クリックでステージ管理モーダルを開く
    nextTargetStageName: (value, row) => {
      return (
        <span
          className="cursor-pointer text-blue-600 hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedCompanyId(row.id as number);
            setStageModalOpen(true);
          }}
        >
          {value ? String(value) : "-"}
        </span>
      );
    },
    // ステージコミット：クリックでステージ管理モーダルを開く
    nextTargetDate: (value, row) => {
      const displayValue = value
        ? new Date(value as string).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })
        : "-";
      return (
        <span
          className="cursor-pointer text-blue-600 hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedCompanyId(row.id as number);
            setStageModalOpen(true);
          }}
        >
          {displayValue}
        </span>
      );
    },
    // 流入経路名：インライン編集対象のIDを使って表示、クリックで編集
    leadSourceName: (value, row) => {
      const leadSourceId = row.leadSourceId as number | null;
      const option = leadSourceOptions.find((opt) => opt.value === String(leadSourceId));
      const displayValue = option?.label || (value ? String(value) : "-");
      return (
        <span className="cursor-pointer hover:bg-muted/50 px-1 -mx-1 rounded transition-colors">
          {displayValue}
        </span>
      );
    },
    // 担当営業名：インライン編集対象のIDを使って表示
    salesStaffName: (value, row) => {
      const salesStaffId = row.salesStaffId as number | null;
      const option = staffOptions.find((opt) => opt.value === String(salesStaffId));
      const displayValue = option?.label || (value ? String(value) : "-");
      return (
        <span className="cursor-pointer hover:bg-muted/50 px-1 -mx-1 rounded transition-colors">
          {displayValue}
        </span>
      );
    },
    // 担当事務名：インライン編集対象のIDを使って表示
    adminStaffName: (value, row) => {
      const adminStaffId = row.adminStaffId as number | null;
      const option = adminStaffOptions.find((opt) => opt.value === String(adminStaffId));
      const displayValue = option?.label || (value ? String(value) : "-");
      return (
        <span className="cursor-pointer hover:bg-muted/50 px-1 -mx-1 rounded transition-colors">
          {displayValue}
        </span>
      );
    },
    // 企業名をクリックで全顧客マスタの詳細ページへ（重複警告付き）
    companyName: (value, row) => {
      if (!value) return "-";
      const companyId = row.companyId as number;
      const companyCode = row.companyCode as string;
      const hasDuplicateWarning = row.hasDuplicateCompanyWarning as boolean;
      return (
        <div className="flex items-center gap-1">
          <Link
            href={`/companies/${companyId}`}
            className="hover:underline font-medium"
            onClick={(e) => e.stopPropagation()}
          >
            <CompanyCodeLabel code={companyCode} name={String(value)} />
          </Link>
          {hasDuplicateWarning && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800" title="同じ全顧客マスタ企業が複数のSTPプロジェクトに紐付いています。企業統合が必要な可能性があります。">
              <AlertTriangle className="h-3 w-3" />
              要統合
            </span>
          )}
        </div>
      );
    },
    // 代理店名をクリックで全顧客マスタの詳細ページへ
    agentName: (value, row) => {
      if (!value) return "-";
      const agentCompanyId = row.agentCompanyId as number | null;
      const agentCompanyCode = row.agentCompanyCode as string | null;
      if (!agentCompanyId) return String(value);
      return (
        <Link
          href={`/companies/${agentCompanyId}`}
          className="hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {agentCompanyCode
            ? <CompanyCodeLabel code={agentCompanyCode} name={String(value)} />
            : String(value)
          }
        </Link>
      );
    },
    // 企業メモ：TextPreviewCellで表示（編集機能付き）
    note: (value, row) => {
      return (
        <TextPreviewCell
          text={value as string | null}
          title="企業メモ"
          onEdit={async (newValue) => {
            await updateStpCompany(row.id as number, { note: newValue });
            router.refresh();
          }}
        />
      );
    },
    // 検討理由：検討中ステージ以外はグレーアウト（編集機能付き）
    pendingReason: (value, row) => {
      const currentStageId = row.currentStageId as number | null;
      const isDisabled = currentStageId !== pendingStageId;

      if (!value) {
        if (isDisabled) {
          return <span className="text-gray-300">(該当なし)</span>;
        }
        return (
          <TextPreviewCell
            text={null}
            title="検討理由"
            onEdit={async (newValue) => {
              await updateStpCompany(row.id as number, { pendingReason: newValue });
              router.refresh();
            }}
          />
        );
      }

      if (isDisabled) {
        return (
          <span className="text-gray-300 max-w-xs truncate block">
            {String(value)}
          </span>
        );
      }

      return (
        <TextPreviewCell
          text={value as string | null}
          title="検討理由"
          onEdit={async (newValue) => {
            await updateStpCompany(row.id as number, { pendingReason: newValue });
            router.refresh();
          }}
        />
      );
    },
    // 失注理由：失注ステージ以外はグレーアウト（編集機能付き）
    lostReason: (value, row) => {
      const currentStageId = row.currentStageId as number | null;
      const isDisabled = currentStageId !== lostStageId;

      if (!value) {
        if (isDisabled) {
          return <span className="text-gray-300">(該当なし)</span>;
        }
        return (
          <TextPreviewCell
            text={null}
            title="失注理由"
            onEdit={async (newValue) => {
              await updateStpCompany(row.id as number, { lostReason: newValue });
              router.refresh();
            }}
          />
        );
      }

      if (isDisabled) {
        return (
          <span className="text-gray-300 max-w-xs truncate block">
            {String(value)}
          </span>
        );
      }

      return (
        <TextPreviewCell
          text={value as string | null}
          title="失注理由"
          onEdit={async (newValue) => {
            await updateStpCompany(row.id as number, { lostReason: newValue });
            router.refresh();
          }}
        />
      );
    },
    // 請求先担当者：名前（メール）形式で縦並び表示
    billingContacts: (value) => {
      if (!value || !Array.isArray(value) || value.length === 0) return "-";

      return (
        <div className="flex flex-col gap-1">
          {value.map((contact, index) => (
            <div key={index} className="text-sm">{contact}</div>
          ))}
        </div>
      );
    },
    // 契約履歴 - 業種区分：縦並びで表示
    contractIndustryType: (_value, row) => {
      const histories = row.activeContractHistories as { industryType: string }[] | undefined;
      if (!histories || histories.length === 0) return "-";

      return (
        <div className="flex flex-col gap-1">
          {histories.map((h, index) => (
            <div key={index} className="text-sm">
              {industryTypeLabels[h.industryType] || h.industryType}
            </div>
          ))}
        </div>
      );
    },
    // 契約履歴 - 求人媒体：縦並びで表示（旧値は赤字警告）
    contractJobMedia: (_value, row) => {
      const histories = row.activeContractHistories as { jobMedia: string | null }[] | undefined;
      if (!histories || histories.length === 0) return "-";

      return (
        <div className="flex flex-col gap-1">
          {histories.map((h, index) => (
            <div key={index} className="text-sm">
              {h.jobMedia
                ? isInvalidJobMedia(h.jobMedia)
                  ? <span className="text-red-600 font-medium">{"\u26A0"} {h.jobMedia}</span>
                  : h.jobMedia
                : "-"}
            </div>
          ))}
        </div>
      );
    },
    // 契約履歴 - 契約プラン：縦並びで表示
    contractPlan: (_value, row) => {
      const histories = row.activeContractHistories as { contractPlan: string }[] | undefined;
      if (!histories || histories.length === 0) return "-";

      return (
        <div className="flex flex-col gap-1">
          {histories.map((h, index) => (
            <div key={index} className="text-sm">
              {contractPlanLabels[h.contractPlan] || h.contractPlan}
            </div>
          ))}
        </div>
      );
    },
    // 契約履歴 - 金額（契約プランに応じて月額または成果報酬）：縦並びで表示
    contractAmount: (_value, row) => {
      const histories = row.activeContractHistories as { contractPlan: string; monthlyFee: number; performanceFee: number }[] | undefined;
      if (!histories || histories.length === 0) return "-";

      return (
        <div className="flex flex-col gap-1">
          {histories.map((h, index) => {
            const amount = h.contractPlan === "monthly" ? h.monthlyFee : h.performanceFee;
            const label = h.contractPlan === "monthly" ? "月額" : "成果報酬";
            return (
              <div key={index} className="text-sm">
                {label}: ¥{amount.toLocaleString()}
              </div>
            );
          })}
        </div>
      );
    },
    // 契約履歴 - 初期費用：縦並びで表示
    contractInitialFee: (_value, row) => {
      const histories = row.activeContractHistories as { initialFee: number }[] | undefined;
      if (!histories || histories.length === 0) return "-";

      return (
        <div className="flex flex-col gap-1">
          {histories.map((h, index) => (
            <div key={index} className="text-sm">¥{h.initialFee.toLocaleString()}</div>
          ))}
        </div>
      );
    },
    // 契約履歴 - 契約開始日：縦並びで表示
    contractStartDate: (_value, row) => {
      const histories = row.activeContractHistories as { contractStartDate: string }[] | undefined;
      if (!histories || histories.length === 0) return "-";

      return (
        <div className="flex flex-col gap-1">
          {histories.map((h, index) => (
            <div key={index} className="text-sm">
              {new Date(h.contractStartDate).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })}
            </div>
          ))}
        </div>
      );
    },
    // 契約履歴 - 契約メモ（備考）：縦並びで表示
    contractNote: (_value, row) => {
      const histories = row.activeContractHistories as { note: string | null }[] | undefined;
      if (!histories || histories.length === 0) return "-";

      return (
        <div className="flex flex-col gap-2">
          {histories.map((h, index) => (
            <TextPreviewCell key={index} text={h.note} title="契約メモ" />
          ))}
        </div>
      );
    },
    // 契約履歴 - 担当運用：縦並びで表示
    contractOperationStaff: (_value, row) => {
      const histories = row.activeContractHistories as { operationStaffName: string | null }[] | undefined;
      if (!histories || histories.length === 0) return "-";

      return (
        <div className="flex flex-col gap-1">
          {histories.map((h, index) => (
            <div key={index} className="text-sm">{h.operationStaffName || "-"}</div>
          ))}
        </div>
      );
    },
    // 契約履歴 - 運用ステータス：縦並びで表示
    contractOperationStatus: (_value, row) => {
      const histories = row.activeContractHistories as { operationStatus: string | null }[] | undefined;
      if (!histories || histories.length === 0) return "-";

      return (
        <div className="flex flex-col gap-1">
          {histories.map((h, index) => (
            <div key={index} className="text-sm">{h.operationStatus || "-"}</div>
          ))}
        </div>
      );
    },
    // 契約履歴 - アカウントID：縦並びで表示
    contractAccountId: (_value, row) => {
      const histories = row.activeContractHistories as { accountId: string | null }[] | undefined;
      if (!histories || histories.length === 0) return "-";

      return (
        <div className="flex flex-col gap-1">
          {histories.map((h, index) => (
            <div key={index} className="text-sm">{h.accountId || "-"}</div>
          ))}
        </div>
      );
    },
    // 契約履歴 - アカウントPASS：縦並びで表示
    contractAccountPass: (_value, row) => {
      const histories = row.activeContractHistories as { accountPass: string | null }[] | undefined;
      if (!histories || histories.length === 0) return "-";

      return (
        <div className="flex flex-col gap-1">
          {histories.map((h, index) => (
            <div key={index} className="text-sm">{h.accountPass || "-"}</div>
          ))}
        </div>
      );
    },
    // 運用KPI：KPIシート画面への遷移ボタン
    operationKpi: (_value, row) => {
      return (
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={(e) => {
            e.stopPropagation();
            const stpCompanyId = row.id as number;
            router.push(`/stp/companies/${stpCompanyId}/kpi`);
          }}
        >
          <LineChart className="h-4 w-4" />
        </Button>
      );
    },
    // 提案書：提案書モーダルを開くボタン
    proposal: (_value, row) => {
      const unlocked = row.hasUnlockedSlides as boolean;
      return (
        <Button
          variant="outline"
          size="icon"
          className={`h-7 w-7 ${unlocked ? "border-red-400 bg-red-50 hover:bg-red-100" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedCompany(row);
            setProposalModalOpen(true);
          }}
          title={unlocked ? "権限未戻しのスライドあり" : "提案書管理"}
        >
          <FileEdit className={`h-4 w-4 ${unlocked ? "text-red-500" : ""}`} />
        </Button>
      );
    },
  };

  const handleOpenStageModal = (item: Record<string, unknown>) => {
    setSelectedCompanyId(item.id as number);
    setStageModalOpen(true);
  };

  const handleOpenContactHistoryModal = (item: Record<string, unknown>) => {
    setSelectedCompany(item);
    setContactHistoryModalOpen(true);
  };

  const handleOpenContractHistoryModal = (item: Record<string, unknown>) => {
    setSelectedCompany(item);
    setContractHistoryModalOpen(true);
  };

  const handleOpenMasterContractModal = (item: Record<string, unknown>) => {
    setSelectedCompany(item);
    setMasterContractModalOpen(true);
  };

  const handleUpdateSuccess = () => {
    router.refresh();
  };

  const customActions: CustomAction[] = [
    {
      icon: <MessageSquare className="h-4 w-4" />,
      label: "接触履歴",
      onClick: handleOpenContactHistoryModal,
    },
    {
      icon: <ScrollText className="h-4 w-4" />,
      label: "契約書",
      onClick: handleOpenMasterContractModal,
    },
    {
      icon: <FileText className="h-4 w-4" />,
      label: "契約履歴",
      onClick: handleOpenContractHistoryModal,
    },
    {
      icon: <BarChart3 className="h-4 w-4" />,
      label: "パイプライン管理",
      onClick: handleOpenStageModal,
    },
    {
      icon: <DollarSign className="h-4 w-4" />,
      label: "収支サマリー",
      onClick: (item) => router.push(`/stp/finance/company-summary/${item.id}`),
    },
    {
      icon: <History className="h-4 w-4" />,
      label: "変更履歴",
      onClick: (item) => {
        setSelectedCompanyId(item.id as number);
        setChangeLogModalOpen(true);
      },
    },
  ];

  // インライン編集の設定
  const inlineEditConfig: InlineEditConfig = {
    // インライン編集対象のカラム（note, pendingReason, lostReasonはTextPreviewCell形式で編集）
    columns: [
      "leadSourceId",      // 流入経路
      "forecast",          // ヨミ
      "salesStaffId",      // 担当営業
      "adminStaffId",      // 担当事務
      "plannedHires",      // 採用予定人数
      "billingAddress",      // 請求先住所
      "billingContactIds",   // 請求先担当者
    ],
    // 表示用カラムから編集用カラムへのマッピング
    displayToEditMapping: {
      "leadSourceName": "leadSourceId",
      "salesStaffName": "salesStaffId",
      "adminStaffName": "adminStaffId",
      "billingContacts": "billingContactIds",
    },
    // セルクリック時のカスタムハンドラ
    onCellClick: (row, columnKey) => {
      // ステージ関連のセルをクリックしたらモーダルを開く
      if (["currentStageName", "nextTargetStageName", "nextTargetDate"].includes(columnKey)) {
        setSelectedCompanyId(row.id as number);
        setStageModalOpen(true);
        return true; // カスタムハンドラで処理済み
      }
      return false;
    },
    // 動的に選択肢を取得
    getOptions: (row, columnKey) => {
      if (columnKey === "leadSourceId") {
        return leadSourceOptions;
      }
      if (columnKey === "salesStaffId") {
        return staffOptions;
      }
      if (columnKey === "adminStaffId") {
        return adminStaffOptions;
      }
      if (columnKey === "forecast") {
        return forecastOptions;
      }
      if (columnKey === "billingAddress") {
        const companyId = row.companyId as number;
        return billingAddressByCompany[String(companyId)] || [];
      }
      if (columnKey === "billingContactIds") {
        const companyId = row.companyId as number;
        return billingContactByCompany[String(companyId)] || [];
      }
      return [];
    },
    // 編集可能かどうかを動的に判定（現在はすべてデフォルトで編集可能）
    isEditable: () => {
      return true;
    },
  };

  return (
    <>
      <CrudTable
        data={data}
        columns={columns}
        title="STP企業"
        onAdd={addStpCompany}
        onUpdate={updateStpCompany}
        onDelete={deleteStpCompany}
        emptyMessage="企業が登録されていません"
        enableInputModeToggle={false}
        customActions={customActions}
        customRenderers={customRenderers}
        customFormFields={customFormFields}
        dynamicOptions={dynamicOptions}
        enableInlineEdit={true}
        inlineEditConfig={inlineEditConfig}
        changeTrackedFields={[
          { key: "salesStaffId", displayName: "担当営業" },
          { key: "adminStaffId", displayName: "担当事務" },
          { key: "plannedHires", displayName: "採用予定人数" },
          { key: "billingContactIds", displayName: "請求先担当者" },
        ]}
      />

      <StageManagementModal
        open={stageModalOpen}
        onOpenChange={setStageModalOpen}
        stpCompanyId={selectedCompanyId}
        onUpdateSuccess={handleUpdateSuccess}
      />

      {selectedCompany && (
        <CompanyContactHistoryModal
          open={contactHistoryModalOpen}
          onOpenChange={setContactHistoryModalOpen}
          stpCompanyId={selectedCompany.id as number}
          companyName={selectedCompany.companyName as string}
          contactHistories={(selectedCompany.contactHistories as Record<string, unknown>[]) || []}
          contactMethodOptions={contactMethodOptions}
          staffOptions={staffOptions}
          customerTypes={customerTypes}
          staffByProject={staffByProject}
          contactCategories={contactCategories}
        />
      )}

      {selectedCompany && (
        <ContractHistoryModal
          open={contractHistoryModalOpen}
          onOpenChange={setContractHistoryModalOpen}
          companyId={selectedCompany.companyId as number}
          companyName={selectedCompany.companyName as string}
        />
      )}

      {selectedCompany && (
        <MasterContractModal
          open={masterContractModalOpen}
          onOpenChange={setMasterContractModalOpen}
          companyId={selectedCompany.companyId as number}
          companyName={selectedCompany.companyName as string}
          contractStatusOptions={masterContractStatusOptions}
          staffOptions={contractStaffOptions}
        />
      )}

      {selectedCompany && (
        <ProposalModal
          open={proposalModalOpen}
          onOpenChange={setProposalModalOpen}
          stpCompanyId={selectedCompany.id as number}
          companyName={selectedCompany.companyName as string}
          staffOptions={contractStaffOptions}
        />
      )}

      {selectedCompanyId && (
        <FieldChangeLogModal
          open={changeLogModalOpen}
          onOpenChange={setChangeLogModalOpen}
          entityType="stp_company"
          entityId={selectedCompanyId}
          title="企業情報"
        />
      )}
    </>
  );
}
