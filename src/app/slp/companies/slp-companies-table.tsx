"use client";

import { useState } from "react";
import { CrudTable, ColumnDef, CustomFormFields } from "@/components/crud-table";
import { addSlpCompany, updateSlpCompany, deleteSlpCompany, checkDuplicateSlpCompanyId } from "./actions";
import { ChevronsUpDown, AlertTriangle } from "lucide-react";
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

type CompanyData = {
  corporateNumber: string | null;
  industry: string | null;
  employeeCount: number | null;
  revenueScale: string | null;
};

type Props = {
  data: Record<string, unknown>[];
  companyOptions: { value: string; label: string }[];
  consultantStaffOptions: { value: string; label: string }[];
  csStaffOptions: { value: string; label: string }[];
  agentCompanyOptions: { value: string; label: string }[];
  companyDataMap: Record<string, CompanyData>;
};

export function SlpCompaniesTable({
  data,
  companyOptions,
  consultantStaffOptions,
  csStaffOptions,
  agentCompanyOptions,
  companyDataMap,
}: Props) {
  // 企業ID重複チェック用の状態
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [companyPopoverOpen, setCompanyPopoverOpen] = useState(false);

  // 企業ID選択のカスタムフォームフィールド（重複チェック + データプリフィル）
  const customFormFields: CustomFormFields = {
    companyId: {
      render: (value, onChange, formData, setFormData) => {
        const selectedOption = companyOptions.find((opt) => opt.value === String(value));

        if (!value && duplicateWarning) {
          setTimeout(() => setDuplicateWarning(null), 0);
        }

        const handleSelect = async (optValue: string) => {
          const companyId = Number(optValue);
          onChange(optValue);
          setCompanyPopoverOpen(false);

          // 全顧客マスタのデータをプリフィル
          const companyData = companyDataMap[optValue];
          if (companyData && setFormData) {
            setFormData({
              ...formData,
              companyId: optValue,
              corporateNumber: companyData.corporateNumber || "",
              industry: companyData.industry || "",
              employeeCount: companyData.employeeCount ?? "",
              revenueScale: companyData.revenueScale || "",
            });
          }

          const result = await checkDuplicateSlpCompanyId(companyId);
          if (result.isDuplicate) {
            setDuplicateWarning(`この企業はすでにSLP案件に登録されています（No. ${result.slpCompanyId}）`);
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
                          if (setFormData) {
                            setFormData({
                              ...formData,
                              companyId: null,
                              corporateNumber: "",
                              industry: "",
                              employeeCount: "",
                              revenueScale: "",
                            });
                          }
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

  const columns: ColumnDef[] = [
    // 企業ID（全顧客マスタから選択）- フォーム用、テーブル非表示
    { key: "companyId", header: "企業ID", type: "select", options: companyOptions, required: true, searchable: true, simpleMode: true, editableOnCreate: true, editableOnUpdate: false, hidden: true },
    // 企業コード
    { key: "companyCode", header: "企業コード", editable: false },
    // 企業名
    { key: "companyName", header: "企業名", editable: false },
    // 法人番号（同期→全顧客マスタ）
    { key: "corporateNumber", header: "法人番号", type: "text", inlineEditable: true },
    // 業種（同期→全顧客マスタ）
    { key: "industry", header: "業種", type: "text", inlineEditable: true },
    // 従業員数（同期→全顧客マスタ）
    { key: "employeeCount", header: "従業員数", type: "number", inlineEditable: true },
    // 年商（同期→全顧客マスタ）
    { key: "revenueScale", header: "年商", type: "text", inlineEditable: true },
    // 年間人件費
    { key: "annualLaborCost", header: "年間人件費", type: "number", inlineEditable: true },
    // 対象従業員数
    { key: "targetEmployeeCount", header: "対象従業員数", type: "number", inlineEditable: true },
    // 対象推定割合
    { key: "targetEstimateRate", header: "対象推定割合(%)", type: "number", inlineEditable: true },
    // 担当コンサル（ID非表示）- インライン編集可能
    { key: "consultantStaffId", header: "担当コンサル（選択）", type: "select", options: consultantStaffOptions, searchable: true, hidden: true, inlineEditable: true },
    { key: "consultantStaffName", header: "担当コンサル", editable: false },
    // 担当CS（ID非表示）- インライン編集可能
    { key: "csStaffId", header: "担当CS（選択）", type: "select", options: csStaffOptions, searchable: true, hidden: true, inlineEditable: true },
    { key: "csStaffName", header: "担当CS", editable: false },
    // 代理店（全顧客マスタから選択）- インライン編集可能
    { key: "agentCompanyId", header: "代理店（選択）", type: "select", options: agentCompanyOptions, searchable: true, hidden: true, inlineEditable: true },
    { key: "agentCompanyName", header: "代理店", editable: false },
    // メモ
    { key: "note", header: "メモ", type: "textarea", simpleMode: true },
  ];

  return (
    <CrudTable
      columns={columns}
      data={data}
      onAdd={addSlpCompany}
      onUpdate={updateSlpCompany}
      onDelete={deleteSlpCompany}
      customFormFields={customFormFields}
    />
  );
}
