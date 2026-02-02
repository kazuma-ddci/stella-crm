"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, ChevronsUpDown, X, Check, ArrowUpDown } from "lucide-react";
import { SortableListModal, SortableItem } from "@/components/sortable-list-modal";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import DatePicker, { registerLocale } from "react-datepicker";
import { ja } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";

// 日本語ロケールを登録
registerLocale("ja", ja);

export type ColumnDef = {
  key: string;
  header: string;
  type?: "text" | "number" | "date" | "datetime" | "boolean" | "textarea" | "select" | "multiselect";
  editable?: boolean;
  editableOnCreate?: boolean; // 新規作成時のみ編集可能（未指定の場合はeditable準拠）
  editableOnUpdate?: boolean; // 編集時のみ編集可能（未指定の場合はeditable準拠）
  options?: { value: string; label: string }[];
  dynamicOptionsKey?: string; // 動的選択肢を取得するためのキー（dependsOnフィールドの値をキーとして使用）
  dependsOn?: string; // このフィールドの値に依存して選択肢を変更する
  required?: boolean;
  searchable?: boolean; // selectタイプで検索可能にする
  filterable?: boolean; // フィルタリング対象にするか（デフォルトtrue）
  simpleMode?: boolean; // 簡易入力モードで表示するかどうか
  hidden?: boolean; // テーブル一覧で非表示にするか
};

// カスタムアクションの定義
export type CustomAction = {
  icon: React.ReactNode;
  label: string;
  onClick: (item: Record<string, unknown>) => void;
};

// カスタムレンダラーの定義
export type CustomRenderers = {
  [key: string]: (value: unknown, row: Record<string, unknown>) => React.ReactNode;
};

// カスタムフォームフィールドの定義
export type CustomFormField = {
  render: (
    value: unknown,
    onChange: (value: unknown) => void,
    formData: Record<string, unknown>
  ) => React.ReactNode;
};

export type CustomFormFields = {
  [key: string]: CustomFormField;
};

// 動的選択肢のコンテキスト
export type DynamicOptionsMap = {
  [optionsKey: string]: Record<string, { value: string; label: string }[]>;
};

type CrudTableProps = {
  data: Record<string, unknown>[];
  columns: ColumnDef[];
  emptyMessage?: string;
  onAdd?: (data: Record<string, unknown>) => Promise<void>;
  onUpdate?: (id: number, data: Record<string, unknown>) => Promise<void>;
  onDelete?: (id: number) => Promise<void>;
  title?: string;
  enableInputModeToggle?: boolean; // 簡易/詳細入力モード切り替えを有効にする
  customActions?: CustomAction[]; // カスタムアクションボタン
  customRenderers?: CustomRenderers; // カスタムセルレンダラー
  customFormFields?: CustomFormFields; // カスタムフォームフィールド
  dynamicOptions?: DynamicOptionsMap; // 動的選択肢（dependsOnフィールドの値に応じて選択肢を変更）
  // 並び替え機能
  sortableItems?: SortableItem[]; // 並び替え用のアイテムリスト
  onReorder?: (orderedIds: number[]) => Promise<void>; // 並び替え完了時のコールバック
  sortableGrouped?: boolean; // グループ内並び替えモード（顧客種別など）
};

function formatValue(value: unknown, type?: string): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "boolean") return value ? "有効" : "無効";
  if (Array.isArray(value)) {
    if (value.length === 0) return "-";
    return value.join(", ");
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      // サーバー/クライアント間のHydrationエラーを防ぐため、タイムゾーンを明示的に指定
      const options: Intl.DateTimeFormatOptions = { timeZone: "Asia/Tokyo" };
      if (value.includes("T") && type !== "date") {
        return date.toLocaleString("ja-JP", {
          ...options,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
      }
      return date.toLocaleDateString("ja-JP", {
        ...options,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    }
  }
  return String(value);
}

function formatForInput(value: unknown, type?: string): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      if (type === "datetime") {
        return date.toISOString().slice(0, 16);
      }
      if (type === "date") {
        return date.toISOString().slice(0, 10);
      }
    }
  }
  return String(value);
}

export function CrudTable({
  data,
  columns,
  emptyMessage = "データがありません",
  onAdd,
  onUpdate,
  onDelete,
  title,
  enableInputModeToggle = false,
  customActions = [],
  customRenderers = {},
  customFormFields = {},
  dynamicOptions = {},
  sortableItems,
  onReorder,
  sortableGrouped = false,
}: CrudTableProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<Record<string, unknown> | null>(null);
  const [deleteItem, setDeleteItem] = useState<Record<string, unknown> | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [isSimpleMode, setIsSimpleMode] = useState(true); // デフォルトは簡易入力モード
  const [isSortModalOpen, setIsSortModalOpen] = useState(false);

  // 新規作成時の編集可能カラム
  const editableColumnsForCreate = columns.filter((col) => {
    if (col.key === "id") return false;
    // editableOnCreateが明示的に設定されている場合はそれを使用
    if (col.editableOnCreate !== undefined) return col.editableOnCreate;
    // そうでなければeditableを参照
    return col.editable !== false;
  });

  // 編集時の編集可能カラム
  const editableColumnsForUpdate = columns.filter((col) => {
    if (col.key === "id") return false;
    // editableOnUpdateが明示的に設定されている場合はそれを使用
    if (col.editableOnUpdate !== undefined) return col.editableOnUpdate;
    // そうでなければeditableを参照
    return col.editable !== false;
  });

  // 入力モードに応じて表示するカラムをフィルタリング（新規作成用）
  const visibleColumnsForCreate = enableInputModeToggle && isSimpleMode
    ? editableColumnsForCreate.filter((col) => col.simpleMode === true)
    : editableColumnsForCreate;

  // 入力モードに応じて表示するカラムをフィルタリング（編集用）
  const visibleColumnsForUpdate = enableInputModeToggle && isSimpleMode
    ? editableColumnsForUpdate.filter((col) => col.simpleMode === true)
    : editableColumnsForUpdate;

  const handleAdd = async () => {
    if (!onAdd) return;
    setLoading(true);
    try {
      await onAdd(formData);
      toast.success("追加しました");
      setIsAddOpen(false);
      setFormData({});
    } catch {
      toast.error("追加に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!onUpdate || !editItem) return;
    setLoading(true);
    try {
      await onUpdate(editItem.id as number, formData);
      toast.success("更新しました");
      setEditItem(null);
      setFormData({});
    } catch {
      toast.error("更新に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || !deleteItem) return;
    setLoading(true);
    try {
      await onDelete(deleteItem.id as number);
      toast.success("削除しました");
      setDeleteItem(null);
    } catch {
      toast.error("削除に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (item: Record<string, unknown>) => {
    setEditItem(item);
    const initialData: Record<string, unknown> = {};
    // 編集可能なカラムの値を設定
    editableColumnsForUpdate.forEach((col) => {
      initialData[col.key] = item[col.key];
    });
    // dependsOnで参照されているフィールドも追加（動的選択肢のため）
    columns.forEach((col) => {
      if (col.dependsOn && !(col.dependsOn in initialData)) {
        initialData[col.dependsOn] = item[col.dependsOn];
      }
    });
    setFormData(initialData);
  };

  const openAddDialog = () => {
    setFormData({});
    setIsAddOpen(true);
  };

  const [openPopovers, setOpenPopovers] = useState<Record<string, boolean>>({});

  // 検索用の状態
  const [selectedFilterColumn, setSelectedFilterColumn] = useState<string>("");
  const [filterValue, setFilterValue] = useState<string>("");

  // テーブル表示用のカラム（hidden除外）
  const visibleColumns = columns.filter((col) => col.hidden !== true);

  // フィルタリング可能なカラム
  const filterableColumns = visibleColumns.filter((col) => {
    if (col.filterable === false) return false;
    if (col.key === "id") return false;
    const filterableTypes = ["text", "number", "select", "boolean", "textarea", "multiselect"];
    return !col.type || filterableTypes.includes(col.type);
  });

  // フィルタリングされたデータ
  const filteredData = useMemo(() => {
    if (!filterValue) return data;
    const searchTerm = filterValue.toLowerCase();

    // マッチング関数
    const matchValue = (value: unknown, col?: ColumnDef): boolean => {
      if (value === null || value === undefined) return false;

      // selectタイプ: optionsのlabelでも検索
      if (col?.type === "select" && col.options) {
        const stringValue = String(value);
        if (searchTerm === stringValue.toLowerCase()) return true;
        const option = col.options.find((opt) => opt.value === stringValue);
        return option?.label.toLowerCase().includes(searchTerm) ?? false;
      }

      // booleanタイプ
      if (col?.type === "boolean") {
        if (searchTerm === "true" || searchTerm === "有効") return value === true;
        if (searchTerm === "false" || searchTerm === "無効") return value === false;
        return false;
      }

      // 文字列として部分一致検索
      return String(value).toLowerCase().includes(searchTerm);
    };

    return data.filter((item) => {
      if (selectedFilterColumn) {
        const col = columns.find((c) => c.key === selectedFilterColumn);
        const value = item[selectedFilterColumn];
        return matchValue(value, col);
      }
      // カラム未選択時は全カラム検索
      return filterableColumns.some((col) => {
        return matchValue(item[col.key], col);
      });
    });
  }, [data, filterValue, selectedFilterColumn, filterableColumns, columns]);

  // 検索入力UIのレンダリング
  const renderFilterInput = () => {
    const selectedCol = columns.find((col) => col.key === selectedFilterColumn);

    // selectタイプ: ドロップダウンで選択
    if (selectedCol?.type === "select" && selectedCol.options) {
      return (
        <Select
          value={filterValue || "__all__"}
          onValueChange={(v) => setFilterValue(v === "__all__" ? "" : v)}
        >
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="選択してください" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">すべて</SelectItem>
            {selectedCol.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    // booleanタイプ: 有効/無効ドロップダウン
    if (selectedCol?.type === "boolean") {
      return (
        <Select
          value={filterValue || "__all__"}
          onValueChange={(v) => setFilterValue(v === "__all__" ? "" : v)}
        >
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="選択してください" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">すべて</SelectItem>
            <SelectItem value="true">有効</SelectItem>
            <SelectItem value="false">無効</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    // その他: テキスト入力
    return (
      <Input
        type={selectedCol?.type === "number" ? "number" : "text"}
        placeholder="検索..."
        value={filterValue}
        onChange={(e) => setFilterValue(e.target.value)}
        className="w-[250px]"
      />
    );
  };

  const renderFormField = (col: ColumnDef) => {
    const value = formData[col.key];

    // カスタムフォームフィールドが定義されている場合はそれを使用
    if (customFormFields[col.key]) {
      return customFormFields[col.key].render(
        value,
        (newValue) => setFormData({ ...formData, [col.key]: newValue }),
        formData
      );
    }

    // 動的選択肢を取得する関数（selectとmultiselect共通）
    const getOptionsForColumn = (column: ColumnDef): { value: string; label: string }[] => {
      // 動的選択肢が設定されている場合
      if (column.dynamicOptionsKey && column.dependsOn) {
        const dependsOnValue = formData[column.dependsOn];
        if (dependsOnValue != null) {
          const optionsMap = dynamicOptions[column.dynamicOptionsKey];
          if (optionsMap) {
            return optionsMap[String(dependsOnValue)] || [];
          }
        }
        return []; // 依存先が未選択の場合は空の選択肢
      }
      // 静的選択肢を返す
      return column.options || [];
    };

    // マルチセレクト（動的選択肢もサポート）
    if (col.type === "multiselect" && (col.options || col.dynamicOptionsKey)) {
      const options = getOptionsForColumn(col);
      // カンマ区切り文字列を配列に変換
      let selectedValues: string[] = [];
      if (Array.isArray(value)) {
        selectedValues = value as string[];
      } else if (typeof value === "string" && value) {
        selectedValues = value.split(",").map((v) => v.trim()).filter((v) => v);
      }

      return (
        <Popover
          open={openPopovers[col.key] || false}
          onOpenChange={(open: boolean) => setOpenPopovers({ ...openPopovers, [col.key]: open })}
        >
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              className="w-full justify-between min-h-10 h-auto"
            >
              <span className="flex flex-wrap gap-1">
                {selectedValues.length === 0 ? (
                  <span className="text-muted-foreground">
                    {col.dependsOn && !formData[col.dependsOn] ? "先に企業を選択してください" : "選択してください..."}
                  </span>
                ) : (
                  selectedValues.map((v) => {
                    const opt = options.find((o) => o.value === v);
                    return (
                      <span key={v} className="bg-secondary text-secondary-foreground px-2 py-0.5 rounded text-sm">
                        {opt?.label || v}
                      </span>
                    );
                  })
                )}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[400px] p-0">
            <Command>
              <CommandInput placeholder="検索..." />
              <CommandList>
                <CommandEmpty>
                  {col.dependsOn && !formData[col.dependsOn] ? "先に企業を選択してください" : "見つかりませんでした"}
                </CommandEmpty>
                <CommandGroup>
                  {options.map((opt) => {
                    const isSelected = selectedValues.includes(opt.value);
                    return (
                      <CommandItem
                        key={opt.value}
                        value={opt.label}
                        onSelect={() => {
                          const newValues = isSelected
                            ? selectedValues.filter((v) => v !== opt.value)
                            : [...selectedValues, opt.value];
                          setFormData({ ...formData, [col.key]: newValues });
                        }}
                      >
                        {isSelected && <Check className="mr-2 h-4 w-4" />}
                        {opt.label}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      );
    }

    if (col.type === "select" && (col.options || col.dynamicOptionsKey)) {
      const options = getOptionsForColumn(col);

      // 検索可能なセレクト（Combobox）
      if (col.searchable) {
        const selectedOption = options.find((opt) => opt.value === String(value));
        return (
          <Popover
            open={openPopovers[col.key] || false}
            onOpenChange={(open: boolean) => setOpenPopovers({ ...openPopovers, [col.key]: open })}
          >
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={openPopovers[col.key] || false}
                className="w-full justify-between"
              >
                {selectedOption ? selectedOption.label : (col.dependsOn && !formData[col.dependsOn] ? "先に企業を選択してください" : "選択してください...")}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0">
              <Command>
                <CommandInput placeholder="検索..." />
                <CommandList>
                  <CommandEmpty>{col.dependsOn && !formData[col.dependsOn] ? "先に企業を選択してください" : "見つかりませんでした"}</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="__empty__"
                      onSelect={() => {
                        setFormData({ ...formData, [col.key]: null });
                        setOpenPopovers({ ...openPopovers, [col.key]: false });
                      }}
                    >
                      -
                    </CommandItem>
                    {options.map((opt) => (
                      <CommandItem
                        key={opt.value}
                        value={opt.label}
                        onSelect={() => {
                          setFormData({ ...formData, [col.key]: opt.value });
                          setOpenPopovers({ ...openPopovers, [col.key]: false });
                        }}
                      >
                        {opt.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        );
      }

      // 通常のセレクト
      return (
        <Select
          value={value != null ? String(value) : "__empty__"}
          onValueChange={(v) => setFormData({ ...formData, [col.key]: v === "__empty__" ? null : v })}
        >
          <SelectTrigger>
            <SelectValue placeholder={col.dependsOn && !formData[col.dependsOn] ? "先に企業を選択" : "選択してください"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__empty__">-</SelectItem>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (col.type === "boolean") {
      return (
        <Select
          value={value === true ? "true" : value === false ? "false" : ""}
          onValueChange={(v) => setFormData({ ...formData, [col.key]: v === "true" })}
        >
          <SelectTrigger>
            <SelectValue placeholder="選択してください" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">有効</SelectItem>
            <SelectItem value="false">無効</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    if (col.type === "textarea") {
      return (
        <Textarea
          value={String(value ?? "")}
          onChange={(e) => setFormData({ ...formData, [col.key]: e.target.value || null })}
          rows={3}
        />
      );
    }

    // 日付フィールド
    if (col.type === "date" || col.type === "datetime") {
      const dateValue = value ? new Date(value as string) : null;
      return (
        <DatePicker
          selected={dateValue}
          onChange={(date: Date | null) => {
            setFormData({ ...formData, [col.key]: date ? date.toISOString() : null });
          }}
          showTimeSelect={col.type === "datetime"}
          timeFormat="HH:mm"
          timeIntervals={15}
          dateFormat={col.type === "datetime" ? "yyyy/MM/dd HH:mm" : "yyyy/MM/dd"}
          locale="ja"
          placeholderText={col.type === "date" ? "日付を選択" : "日時を選択"}
          isClearable
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          wrapperClassName="w-full"
          calendarClassName="shadow-lg"
        />
      );
    }

    return (
      <Input
        type={col.type === "number" ? "number" : "text"}
        value={formatForInput(value, col.type)}
        onChange={(e) => {
          let newValue: unknown = e.target.value || null;
          if (col.type === "number" && e.target.value) {
            newValue = Number(e.target.value);
          }
          setFormData({ ...formData, [col.key]: newValue });
        }}
        required={col.required}
      />
    );
  };

  return (
    <div className="space-y-4">
      {/* 検索バー */}
      <div className="flex gap-2 items-center">
        <Select
          value={selectedFilterColumn || "__all__"}
          onValueChange={(v) => {
            setSelectedFilterColumn(v === "__all__" ? "" : v);
            setFilterValue("");
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="検索カラム" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全カラム</SelectItem>
            {filterableColumns.map((col) => (
              <SelectItem key={col.key} value={col.key}>
                {col.header}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {renderFilterInput()}

        {filterValue && (
          <Button variant="ghost" size="icon" onClick={() => setFilterValue("")}>
            <X className="h-4 w-4" />
          </Button>
        )}

        <div className="ml-auto flex gap-2">
          {sortableItems && onReorder && (
            <Button variant="outline" onClick={() => setIsSortModalOpen(true)}>
              <ArrowUpDown className="mr-2 h-4 w-4" />
              並び替え
            </Button>
          )}
          {onAdd && (
            <Button onClick={openAddDialog}>
              <Plus className="mr-2 h-4 w-4" />
              新規追加
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {visibleColumns.map((col) => (
                <TableHead key={col.key} className="whitespace-nowrap">
                  {col.header}
                </TableHead>
              ))}
              {(onUpdate || onDelete || customActions.length > 0) && (
                <TableHead className="w-[100px]">操作</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={visibleColumns.length + (onUpdate || onDelete || customActions.length > 0 ? 1 : 0)}
                  className="text-center text-muted-foreground"
                >
                  {data.length === 0 ? emptyMessage : "検索条件に一致するデータがありません"}
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((item, index) => (
                <TableRow key={(item.id as number) || index}>
                  {visibleColumns.map((col) => (
                    <TableCell key={col.key} className="whitespace-nowrap max-w-xs overflow-auto">
                      {customRenderers[col.key]
                        ? customRenderers[col.key](item[col.key], item)
                        : formatValue(item[col.key], col.type)}
                    </TableCell>
                  ))}
                  {(onUpdate || onDelete || customActions.length > 0) && (
                    <TableCell>
                      <div className="flex gap-1">
                        {customActions.map((action, actionIndex) => (
                          <Button
                            key={actionIndex}
                            variant="ghost"
                            size="icon"
                            onClick={() => action.onClick(item)}
                            title={action.label}
                          >
                            {action.icon}
                          </Button>
                        ))}
                        {onUpdate && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(item)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {onDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteItem(item)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between pr-8">
              <DialogTitle>{title ? `${title}を追加` : "新規追加"}</DialogTitle>
              {enableInputModeToggle && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSimpleMode(!isSimpleMode)}
                >
                  {isSimpleMode ? "詳細入力" : "簡易入力"}
                </Button>
              )}
            </div>
          </DialogHeader>
          <div className="space-y-4">
            {visibleColumnsForCreate.map((col) => (
              <div key={col.key} className="space-y-2">
                <Label>
                  {col.header}
                  {col.required && <span className="text-destructive ml-1">*</span>}
                </Label>
                {renderFormField(col)}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleAdd} disabled={loading}>
              {loading ? "追加中..." : "追加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between pr-8">
              <DialogTitle>{title ? `${title}を編集` : "編集"}</DialogTitle>
              {enableInputModeToggle && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSimpleMode(!isSimpleMode)}
                >
                  {isSimpleMode ? "詳細入力" : "簡易入力"}
                </Button>
              )}
            </div>
          </DialogHeader>
          <div className="space-y-4">
            {visibleColumnsForUpdate.map((col) => (
              <div key={col.key} className="space-y-2">
                <Label>
                  {col.header}
                  {col.required && <span className="text-destructive ml-1">*</span>}
                </Label>
                {renderFormField(col)}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>
              キャンセル
            </Button>
            <Button onClick={handleUpdate} disabled={loading}>
              {loading ? "更新中..." : "更新"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>削除確認</DialogTitle>
          </DialogHeader>
          <p>このデータを削除しますか？この操作は取り消せません。</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteItem(null)}>
              キャンセル
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              {loading ? "削除中..." : "削除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sort Modal */}
      {sortableItems && onReorder && (
        <SortableListModal
          open={isSortModalOpen}
          onOpenChange={setIsSortModalOpen}
          title={title || "項目"}
          items={sortableItems}
          onReorder={onReorder}
          grouped={sortableGrouped}
        />
      )}
    </div>
  );
}
