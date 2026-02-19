"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CrudTable, ColumnDef, CustomAction, CustomRenderers, InlineEditConfig } from "@/components/crud-table";
import { addAgent, updateAgent, deleteAgent } from "./actions";
import { ContactHistoryModal } from "./contact-history-modal";
import { MasterContractModal } from "@/components/master-contract-modal";
import { ReferredCompaniesModal } from "./referred-companies-modal";
import { AgentContractHistoryModal } from "./agent-contract-history-modal";
import { FieldChangeLogModal } from "@/components/field-change-log-modal";
import { FileText, MessageSquare, ScrollText, Copy, Check, Loader2, DollarSign, AlertTriangle, History } from "lucide-react";
import { TextPreviewCell } from "@/components/text-preview-cell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CategoryEditCell } from "./category-edit-cell";
import { ChangeConfirmationDialog } from "@/components/change-confirmation-dialog";
import { formatAdvisorDisplay } from "@/lib/format/advisor-display";
import { CompanyCodeLabel } from "@/components/company-code-label";

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
  companyOptions: { value: string; label: string; disabled?: boolean }[];
  referrerOptions: { value: string; label: string }[];
  staffOptions: { value: string; label: string }[];
  adminStaffOptions: { value: string; label: string }[];
  contractStaffOptions: { value: string; label: string }[];
  contactMethodOptions: { value: string; label: string }[];
  masterContractStatusOptions: { value: string; label: string }[];
  customerTypes: CustomerType[];
  staffByProject: Record<number, { value: string; label: string }[]>;
};

// ステータス選択肢
const statusOptions = [
  { value: "アクティブ", label: "アクティブ" },
  { value: "非アクティブ", label: "非アクティブ" },
  { value: "解約", label: "解約" },
];

// 区分選択肢
const category1Options = [
  { value: "代理店", label: "代理店" },
  { value: "顧問", label: "顧問" },
];


export function AgentsTable({
  data,
  companyOptions,
  referrerOptions,
  staffOptions,
  adminStaffOptions,
  contractStaffOptions,
  contactMethodOptions,
  masterContractStatusOptions,
  customerTypes,
  staffByProject,
}: Props) {
  const router = useRouter();
  const [contactHistoryModalOpen, setContactHistoryModalOpen] = useState(false);
  const [masterContractModalOpen, setMasterContractModalOpen] = useState(false);
  const [agentContractHistoryModalOpen, setAgentContractHistoryModalOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Record<string, unknown> | null>(null);

  // 変更履歴モーダル用ステート
  const [changeLogModalOpen, setChangeLogModalOpen] = useState(false);

  // 紹介企業モーダル用ステート
  const [referredModalOpen, setReferredModalOpen] = useState(false);
  const [contractedModalOpen, setContractedModalOpen] = useState(false);
  const [selectedAgentForReferral, setSelectedAgentForReferral] = useState<Record<string, unknown> | null>(null);

  // 区分編集用ステート
  const [editingCategoryRow, setEditingCategoryRow] = useState<Record<string, unknown> | null>(null);
  const [pendingCategoryChange, setPendingCategoryChange] = useState<{
    rowId: number;
    category1: string;
    minimumCases: number | null;
    monthlyFee: number | null;
    oldCategory: string;
    oldMinimumCases: number | null;
    oldMonthlyFee: number | null;
  } | null>(null);
  const [categoryConfirmOpen, setCategoryConfirmOpen] = useState(false);
  const [categoryLoading, setCategoryLoading] = useState(false);

  // 表示順序:
  // 1. 代理店No. | 2. 代理店名 | 3. 最終接触日 | 4. ステータス | 5. 区分 | 6. 契約ステータス
  // 7. 担当者 | 8. 紹介者 | 9. 代理店メモ | 10. 紹介件数 | 11. 契約件数 | 12. フォームURL
  const columns: ColumnDef[] = [
    { key: "id", header: "代理店No.", editable: false },
    {
      key: "companyId",
      header: "代理店",
      type: "select",
      options: companyOptions,
      searchable: true,
      required: true,
      editableOnUpdate: false, // 編集時は変更不可
      hidden: true,
    },
    { key: "companyName", header: "代理店名", editable: false, filterable: true },
    { key: "latestContactDate", header: "最終接触日", type: "date", editable: false },
    {
      key: "status",
      header: "ステータス",
      type: "select",
      options: statusOptions,
      required: true,
      inlineEditable: true, // インライン編集可能
    },
    {
      key: "category1",
      header: "区分",
      type: "select",
      options: category1Options,
      required: true,
      // インライン編集は使用しない - customRendererで独自のCategoryEditCellを使用
      editable: false,
    },
    {
      key: "contractStatus",
      header: "契約ステータス",
      editable: false,
    },
    {
      key: "staffAssignments",
      header: "担当営業",
      type: "select",
      options: staffOptions,
      searchable: true,
      hidden: true,
      inlineEditable: true, // インライン編集可能
    },
    { key: "staffNames", header: "担当営業", editable: false },
    // 担当事務（IDは非表示）- インライン編集可能
    { key: "adminStaffId", header: "担当事務（選択）", type: "select", options: adminStaffOptions, searchable: true, hidden: true, inlineEditable: true },
    { key: "adminStaffName", header: "担当事務", editable: false },
    {
      key: "referrerCompanyId",
      header: "紹介者",
      type: "select",
      options: referrerOptions,
      searchable: true,
      hidden: true,
      inlineEditable: true, // インライン編集可能
    },
    { key: "referrerCompanyName", header: "紹介者", editable: false },
    { key: "note", header: "代理店メモ", type: "textarea" }, // TextPreviewCell形式で編集
    { key: "referralCount", header: "紹介件数", editable: false },
    { key: "contractedCount", header: "契約件数", editable: false },
    // 顧問専用フィールド - hidden（区分カラムの統合編集UIで変更）
    { key: "minimumCases", header: "最低件数", type: "number", editable: false, hidden: true },
    { key: "monthlyFee", header: "月額費用", type: "number", editable: false, hidden: true },
    {
      key: "isIndividualBusiness",
      header: "個人事業主",
      type: "select",
      options: [
        { value: "true", label: "個人" },
        { value: "false", label: "法人" },
      ],
      inlineEditable: true,
    },
    {
      key: "withholdingTaxRate",
      header: "源泉徴収税率",
      type: "number",
      inlineEditable: true,
    },
    { key: "leadFormToken", header: "フォームURL", editable: false },
    // 非表示項目
    { key: "companyEmail", header: "メールアドレス", editable: false, hidden: true },
    { key: "companyPhone", header: "電話番号", editable: false, hidden: true },
    { key: "contractCount", header: "契約書数", editable: false, hidden: true },
    { key: "createdAt", header: "作成日", type: "datetime", editable: false, hidden: true },
    { key: "updatedAt", header: "更新日", type: "datetime", editable: false, hidden: true },
  ];

  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [shorteningToken, setShorteningToken] = useState<string | null>(null);

  // クリップボードにコピーするヘルパー関数
  const copyToClipboard = async (text: string): Promise<boolean> => {
    // 方法1: Clipboard API（モダンブラウザ）
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // Clipboard APIが失敗した場合はフォールバックへ
      }
    }

    // 方法2: execCommand（レガシーフォールバック）
    return new Promise((resolve) => {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      // 画面外に配置しつつ、コピー可能にする
      textarea.style.position = "fixed";
      textarea.style.left = "0";
      textarea.style.top = "0";
      textarea.style.width = "2em";
      textarea.style.height = "2em";
      textarea.style.padding = "0";
      textarea.style.border = "none";
      textarea.style.outline = "none";
      textarea.style.boxShadow = "none";
      textarea.style.background = "transparent";
      textarea.style.opacity = "0";
      textarea.style.zIndex = "-1";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();

      // 少し待ってからexecCommandを実行
      requestAnimationFrame(() => {
        try {
          const result = document.execCommand("copy");
          document.body.removeChild(textarea);
          resolve(result);
        } catch {
          document.body.removeChild(textarea);
          resolve(false);
        }
      });
    });
  };

  const copyFormUrl = async (token: string) => {
    const originalUrl = `${window.location.origin}/form/stp-lead/${token}`;

    try {
      setShorteningToken(token);

      // 短縮URLを生成
      const response = await fetch("/api/internal/shorten-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originalUrl }),
      });

      const data = await response.json();

      if (data.success && data.shortCode) {
        const shortUrl = `${window.location.origin}/s/${data.shortCode}`;
        const success = await copyToClipboard(shortUrl);
        if (success) {
          toast.success("短縮URLをコピーしました");
        } else {
          toast.error("コピーに失敗しました");
        }
      } else {
        const success = await copyToClipboard(originalUrl);
        if (success) {
          toast.success("URLをコピーしました");
        } else {
          toast.error("コピーに失敗しました");
        }
      }

      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch (error) {
      console.error("URL短縮エラー:", error);
      const success = await copyToClipboard(originalUrl);
      if (success) {
        toast.success("URLをコピーしました");
      } else {
        toast.error("コピーに失敗しました");
      }
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    } finally {
      setShorteningToken(null);
    }
  };

  // 金額フォーマット
  const formatCurrency = (value: number) => {
    return `¥${value.toLocaleString()}`;
  };

  // カスタムレンダラー：担当者を縦並びで表示、代理店名・紹介者にリンク
  const customRenderers: CustomRenderers = {
    // 代理店名をクリックで全顧客マスタの詳細ページへ（重複警告付き）
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
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800" title="同じ全顧客マスタ企業が複数の代理店に紐付いています。企業統合が必要な可能性があります。">
              <AlertTriangle className="h-3 w-3" />
              要統合
            </span>
          )}
        </div>
      );
    },
    // 紹介者をクリックで全顧客マスタの詳細ページへ（インライン編集はreferrerCompanyIdで行う）
    referrerCompanyName: (value, row) => {
      if (!value) {
        return (
          <span className="cursor-pointer hover:bg-muted/50 px-1 -mx-1 rounded transition-colors text-muted-foreground">
            -
          </span>
        );
      }
      const referrerCompanyId = row.referrerCompanyId as number | null;
      const referrerCompanyCode = row.referrerCompanyCode as string | null;
      if (!referrerCompanyId) return String(value);
      return (
        <Link
          href={`/companies/${referrerCompanyId}`}
          className="hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {referrerCompanyCode
            ? <CompanyCodeLabel code={referrerCompanyCode} name={String(value)} />
            : String(value)
          }
        </Link>
      );
    },
    // 契約ステータス：自動計算値をバッジ風に表示
    contractStatus: (value) => {
      if (!value) return "-";
      const status = String(value);
      const colorClass =
        status === "契約済み"
          ? "bg-green-100 text-green-800"
          : status === "契約終了"
          ? "bg-gray-100 text-gray-600"
          : "bg-yellow-100 text-yellow-800";
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
          {status}
        </span>
      );
    },
    // 区分：顧問の場合は「顧問（X件）¥XX,XXX」統合表示 + インライン編集対応
    category1: (value, row) => {
      const isEditing = editingCategoryRow?.id === row.id;

      if (isEditing) {
        return (
          <CategoryEditCell
            currentCategory={String(row.category1 || "代理店")}
            currentMinimumCases={row.minimumCases as number | null}
            currentMonthlyFee={row.monthlyFee as number | null}
            onSave={(data) => {
              // 確認ダイアログを表示
              setPendingCategoryChange({
                rowId: row.id as number,
                category1: data.category1,
                minimumCases: data.minimumCases,
                monthlyFee: data.monthlyFee,
                oldCategory: String(row.category1 || "代理店"),
                oldMinimumCases: row.minimumCases as number | null,
                oldMonthlyFee: row.monthlyFee as number | null,
              });
              setCategoryConfirmOpen(true);
              setEditingCategoryRow(null);
            }}
            onCancel={() => setEditingCategoryRow(null)}
          />
        );
      }

      const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingCategoryRow(row);
      };

      if (value === "顧問") {
        // 顧問表示フォーマット: SPEC-STP-001 に準拠
        // @see docs/specs/SPEC-STP-001.md
        const display = formatAdvisorDisplay(
          row.minimumCases as number | null,
          row.monthlyFee as number | null
        );

        return (
          <span
            className="cursor-pointer hover:bg-muted/50 px-1 -mx-1 rounded transition-colors"
            onClick={handleClick}
          >
            {display}
          </span>
        );
      }

      return (
        <span
          className="cursor-pointer hover:bg-muted/50 px-1 -mx-1 rounded transition-colors"
          onClick={handleClick}
        >
          {String(value || "-")}
        </span>
      );
    },
    // 最低件数：顧問以外は「-」表示、顧問の場合は値または編集可能な「-」
    minimumCases: (value, row) => {
      if (row.category1 !== "顧問") {
        return <span className="text-muted-foreground">-</span>;
      }
      if (value === null || value === undefined) {
        return (
          <span className="cursor-pointer hover:bg-muted/50 px-1 -mx-1 rounded transition-colors text-muted-foreground">
            -
          </span>
        );
      }
      return (
        <span className="cursor-pointer hover:bg-muted/50 px-1 -mx-1 rounded transition-colors">
          {Number(value)}件
        </span>
      );
    },
    // 月額費用：顧問以外は「-」表示、顧問の場合は値または編集可能な「-」
    monthlyFee: (value, row) => {
      if (row.category1 !== "顧問") {
        return <span className="text-muted-foreground">-</span>;
      }
      if (value === null || value === undefined) {
        return (
          <span className="cursor-pointer hover:bg-muted/50 px-1 -mx-1 rounded transition-colors text-muted-foreground">
            -
          </span>
        );
      }
      return (
        <span className="cursor-pointer hover:bg-muted/50 px-1 -mx-1 rounded transition-colors">
          {formatCurrency(Number(value))}
        </span>
      );
    },
    staffNames: (value) => {
      if (!value || typeof value !== "string") {
        return (
          <span className="cursor-pointer hover:bg-muted/50 px-1 -mx-1 rounded transition-colors text-muted-foreground">
            -
          </span>
        );
      }
      const names = value.split(",").map((name) => name.trim()).filter((name) => name);
      if (names.length === 0) {
        return (
          <span className="cursor-pointer hover:bg-muted/50 px-1 -mx-1 rounded transition-colors text-muted-foreground">
            -
          </span>
        );
      }

      return (
        <div className="flex flex-col gap-1 cursor-pointer hover:bg-muted/50 px-1 -mx-1 rounded transition-colors">
          {names.map((name, index) => (
            <div key={index} className="text-sm">{name}</div>
          ))}
        </div>
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
    // メモ：TextPreviewCellで表示（編集機能付き）
    note: (value, row) => {
      return (
        <TextPreviewCell
          text={value as string | null}
          title="代理店メモ"
          onEdit={async (newValue) => {
            await updateAgent(row.id as number, { note: newValue });
            router.refresh();
          }}
        />
      );
    },
    // 紹介件数：クリックで紹介企業一覧モーダル
    referralCount: (value, row) => {
      const count = Number(value) || 0;
      if (count === 0) return "-";
      return (
        <span
          className="text-blue-600 hover:underline cursor-pointer font-medium"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedAgentForReferral(row);
            setReferredModalOpen(true);
          }}
        >
          {count}件
        </span>
      );
    },
    // 契約件数：クリックで契約済み企業一覧モーダル
    contractedCount: (value, row) => {
      const count = Number(value) || 0;
      if (count === 0) return "-";
      return (
        <span
          className="text-green-600 hover:underline cursor-pointer font-medium"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedAgentForReferral(row);
            setContractedModalOpen(true);
          }}
        >
          {count}件
        </span>
      );
    },
    // 個人事業主
    isIndividualBusiness: (value) => {
      if (value === true || value === "true") {
        return (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700">
            個人
          </span>
        );
      }
      return <span className="text-muted-foreground">-</span>;
    },
    // 源泉徴収税率
    withholdingTaxRate: (value, row) => {
      const isIndividual = row.isIndividualBusiness === true || row.isIndividualBusiness === "true";
      if (!isIndividual) {
        return <span className="text-muted-foreground">-</span>;
      }
      return value != null ? `${Number(value)}%` : "-";
    },
    // リード獲得フォームURL
    leadFormToken: (value, row) => {
      if (!value) return "-";
      const token = value as string;
      const status = row.leadFormTokenStatus as string;

      if (status !== "active") {
        return <span className="text-gray-400">無効</span>;
      }

      const isShortening = shorteningToken === token;
      const isCopied = copiedToken === token;

      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            copyFormUrl(token);
          }}
          className="h-8 px-2"
          disabled={isShortening}
        >
          {isShortening ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isCopied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          <span className="ml-1 text-xs">{isShortening ? "生成中" : "コピー"}</span>
        </Button>
      );
    },
  };

  const customActions: CustomAction[] = [
    {
      icon: <FileText className="h-4 w-4" />,
      label: "契約条件",
      onClick: (item) => {
        setSelectedAgent(item);
        setAgentContractHistoryModalOpen(true);
      },
    },
    {
      icon: <MessageSquare className="h-4 w-4" />,
      label: "接触履歴",
      onClick: (item) => {
        setSelectedAgent(item);
        setContactHistoryModalOpen(true);
      },
    },
    {
      icon: <ScrollText className="h-4 w-4" />,
      label: "契約書",
      onClick: (item) => {
        setSelectedAgent(item);
        setMasterContractModalOpen(true);
      },
    },
    {
      icon: <DollarSign className="h-4 w-4" />,
      label: "経費サマリー",
      onClick: (item) => router.push(`/stp/finance/agent-summary/${item.id}`),
    },
    {
      icon: <History className="h-4 w-4" />,
      label: "変更履歴",
      onClick: (item) => {
        setSelectedAgent(item);
        setChangeLogModalOpen(true);
      },
    },
  ];

  // 区分確認ダイアログの保存処理
  const handleCategoryConfirmSave = async () => {
    if (!pendingCategoryChange) return;

    setCategoryLoading(true);
    try {
      await updateAgent(pendingCategoryChange.rowId, {
        category1: pendingCategoryChange.category1,
        minimumCases: pendingCategoryChange.minimumCases,
        monthlyFee: pendingCategoryChange.monthlyFee,
      });
      toast.success("更新しました");
      setCategoryConfirmOpen(false);
      setPendingCategoryChange(null);
      router.refresh();
    } catch {
      toast.error("更新に失敗しました");
    } finally {
      setCategoryLoading(false);
    }
  };

  // インライン編集の設定
  const inlineEditConfig: InlineEditConfig = {
    // インライン編集対象のカラム（noteはTextPreviewCell形式で編集）
    // category1はcustomRendererでカスタム編集UIを使用するためここには含めない
    columns: [
      "status",               // ステータス
      "staffAssignments",     // 担当営業
      "adminStaffId",         // 担当事務
      "referrerCompanyId",    // 紹介者
      "isIndividualBusiness", // 個人事業主
      "withholdingTaxRate",   // 源泉徴収税率
    ],
    // 表示用カラム → 編集用カラムのマッピング
    displayToEditMapping: {
      "staffNames": "staffAssignments",
      "adminStaffName": "adminStaffId",
      "referrerCompanyName": "referrerCompanyId",
    },
    // 動的に選択肢を取得
    getOptions: (_row, columnKey) => {
      if (columnKey === "status") {
        return statusOptions;
      }
      if (columnKey === "staffAssignments") {
        return staffOptions;
      }
      if (columnKey === "adminStaffId") {
        return adminStaffOptions;
      }
      if (columnKey === "referrerCompanyId") {
        return referrerOptions;
      }
      if (columnKey === "isIndividualBusiness") {
        return [
          { value: "true", label: "個人" },
          { value: "false", label: "法人" },
        ];
      }
      return [];
    },
  };

  return (
    <>
      <CrudTable
        data={data}
        columns={columns}
        title="代理店"
        onAdd={addAgent}
        onUpdate={updateAgent}
        onDelete={deleteAgent}
        emptyMessage="代理店が登録されていません"
        customActions={customActions}
        customRenderers={customRenderers}
        enableInlineEdit={true}
        inlineEditConfig={inlineEditConfig}
        changeTrackedFields={[
          { key: "staffAssignments", displayName: "担当営業" },
          { key: "adminStaffId", displayName: "担当事務" },
        ]}
      />

      {selectedAgent && (
        <>
          <AgentContractHistoryModal
            open={agentContractHistoryModalOpen}
            onOpenChange={setAgentContractHistoryModalOpen}
            agentId={selectedAgent.id as number}
            agentName={selectedAgent.companyName as string}
          />
          <ContactHistoryModal
            open={contactHistoryModalOpen}
            onOpenChange={setContactHistoryModalOpen}
            agentId={selectedAgent.id as number}
            agentName={selectedAgent.companyName as string}
            contactHistories={(selectedAgent.contactHistories as Record<string, unknown>[]) || []}
            contactMethodOptions={contactMethodOptions}
            staffOptions={staffOptions}
            customerTypes={customerTypes}
            staffByProject={staffByProject}
          />
          <MasterContractModal
            open={masterContractModalOpen}
            onOpenChange={setMasterContractModalOpen}
            companyId={selectedAgent.companyId as number}
            companyName={selectedAgent.companyName as string}
            contractStatusOptions={masterContractStatusOptions}
            staffOptions={contractStaffOptions}
          />
        </>
      )}

      {/* 区分編集の確認ダイアログ */}
      {pendingCategoryChange && (
        <ChangeConfirmationDialog
          open={categoryConfirmOpen}
          onOpenChange={(open) => {
            if (!open) {
              setCategoryConfirmOpen(false);
              setPendingCategoryChange(null);
            }
          }}
          changes={(() => {
            const changes: { fieldName: string; oldValue: string; newValue: string }[] = [];

            // 区分の変更
            if (pendingCategoryChange.category1 !== pendingCategoryChange.oldCategory) {
              changes.push({
                fieldName: "区分",
                oldValue: pendingCategoryChange.oldCategory,
                newValue: pendingCategoryChange.category1,
              });
            }

            // 顧問の場合のみ最低件数・月額費用の変更を表示
            if (pendingCategoryChange.category1 === "顧問") {
              if (pendingCategoryChange.minimumCases !== pendingCategoryChange.oldMinimumCases) {
                changes.push({
                  fieldName: "最低件数",
                  oldValue: pendingCategoryChange.oldMinimumCases !== null
                    ? `${pendingCategoryChange.oldMinimumCases}件`
                    : "-",
                  newValue: pendingCategoryChange.minimumCases !== null
                    ? `${pendingCategoryChange.minimumCases}件`
                    : "-",
                });
              }
              if (pendingCategoryChange.monthlyFee !== pendingCategoryChange.oldMonthlyFee) {
                changes.push({
                  fieldName: "月額費用",
                  oldValue: pendingCategoryChange.oldMonthlyFee !== null
                    ? formatCurrency(pendingCategoryChange.oldMonthlyFee)
                    : "-",
                  newValue: pendingCategoryChange.monthlyFee !== null
                    ? formatCurrency(pendingCategoryChange.monthlyFee)
                    : "-",
                });
              }
            } else if (pendingCategoryChange.oldCategory === "顧問") {
              // 顧問から代理店に変更した場合、最低件数・月額費用がクリアされることを表示
              if (pendingCategoryChange.oldMinimumCases !== null) {
                changes.push({
                  fieldName: "最低件数",
                  oldValue: `${pendingCategoryChange.oldMinimumCases}件`,
                  newValue: "-",
                });
              }
              if (pendingCategoryChange.oldMonthlyFee !== null) {
                changes.push({
                  fieldName: "月額費用",
                  oldValue: formatCurrency(pendingCategoryChange.oldMonthlyFee),
                  newValue: "-",
                });
              }
            }

            // 変更がない場合は区分のみ表示（UIの一貫性のため）
            if (changes.length === 0) {
              changes.push({
                fieldName: "区分",
                oldValue: pendingCategoryChange.oldCategory,
                newValue: pendingCategoryChange.category1,
              });
            }

            return changes;
          })()}
          onConfirm={handleCategoryConfirmSave}
          loading={categoryLoading}
        />
      )}

      {/* 変更履歴モーダル */}
      {selectedAgent && (
        <FieldChangeLogModal
          open={changeLogModalOpen}
          onOpenChange={setChangeLogModalOpen}
          entityType="stp_agent"
          entityId={selectedAgent.id as number}
          title={selectedAgent.companyName as string}
        />
      )}

      {/* 紹介企業モーダル */}
      {selectedAgentForReferral && (
        <>
          <ReferredCompaniesModal
            open={referredModalOpen}
            onOpenChange={setReferredModalOpen}
            agentName={selectedAgentForReferral.companyName as string}
            companies={(selectedAgentForReferral.stpCompanies as Array<{
              id: number;
              companyId: number;
              companyName: string;
              companyCode: string;
              currentStageName: string;
              hasSignedContract: boolean;
            }>) || []}
            filterContracted={false}
          />
          <ReferredCompaniesModal
            open={contractedModalOpen}
            onOpenChange={setContractedModalOpen}
            agentName={selectedAgentForReferral.companyName as string}
            companies={(selectedAgentForReferral.stpCompanies as Array<{
              id: number;
              companyId: number;
              companyName: string;
              companyCode: string;
              currentStageName: string;
              hasSignedContract: boolean;
            }>) || []}
            filterContracted={true}
          />
        </>
      )}
    </>
  );
}
