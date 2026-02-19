"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
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
import { Plus, Pencil, Trash2, ChevronsUpDown, X, Check, ArrowUpDown, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { SortableListModal, SortableItem } from "@/components/sortable-list-modal";
import { TextPreviewCell } from "@/components/text-preview-cell";
import { EditableCell, EditableCellType, EditableCellOption, formatDisplayValue } from "@/components/editable-cell";
import { ChangeConfirmationDialog, ChangeItem } from "@/components/change-confirmation-dialog";
import { cn, toLocalDateString, matchesWithWordBoundary } from "@/lib/utils";
import { toast } from "sonner";
import DatePicker, { registerLocale } from "react-datepicker";
import { ja } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";

// 日本語ロケールを登録
registerLocale("ja", ja);

export type ColumnDef = {
  key: string;
  header: string;
  type?: "text" | "number" | "date" | "datetime" | "month" | "boolean" | "textarea" | "select" | "multiselect";
  editable?: boolean;
  editableOnCreate?: boolean; // 新規作成時のみ編集可能（未指定の場合はeditable準拠）
  editableOnUpdate?: boolean; // 編集時のみ編集可能（未指定の場合はeditable準拠）
  options?: { value: string; label: string }[];
  dynamicOptionsKey?: string; // 動的選択肢を取得するためのキー（dependsOnフィールドの値をキーとして使用）
  dependsOn?: string; // このフィールドの値に依存して選択肢を変更する
  dependsOnPlaceholder?: string; // dependsOnフィールド未選択時のプレースホルダー
  required?: boolean;
  searchable?: boolean; // selectタイプで検索可能にする
  filterable?: boolean; // フィルタリング対象にするか（デフォルトtrue）
  simpleMode?: boolean; // 簡易入力モードで表示するかどうか
  hidden?: boolean; // テーブル一覧で非表示にするか
  inlineEditable?: boolean; // インライン編集可能にするか（enableInlineEdit時に使用）
  currency?: boolean; // 通貨フォーマット（¥#,##0）で表示・入力
  defaultValue?: unknown; // 新規追加時のデフォルト値
  visibleWhen?: { field: string; value: unknown }; // フォームでの条件付き表示（指定フィールドが指定値の時のみ表示）
};

// カスタムアクションの定義
export type CustomAction = {
  icon: React.ReactNode;
  label: string;
  onClick: (item: Record<string, unknown>) => void;
  variant?: "default" | "destructive";
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
    formData: Record<string, unknown>,
    setFormData: (data: Record<string, unknown>) => void
  ) => React.ReactNode;
};

export type CustomFormFields = {
  [key: string]: CustomFormField;
};

// 動的選択肢のコンテキスト
export type DynamicOptionsMap = {
  [optionsKey: string]: Record<string, { value: string; label: string }[]>;
};

// インライン編集用の設定
export type InlineEditConfig = {
  // インライン編集対象のカラムキーリスト（指定しない場合はinlineEditable=trueのカラムすべて）
  columns?: string[];
  // セルクリック時のカスタムハンドラ（ステージセルクリックでモーダルを開く等）
  onCellClick?: (row: Record<string, unknown>, columnKey: string) => boolean | void;
  // 動的に選択肢を取得する関数（row情報から選択肢を決定する場合）
  getOptions?: (row: Record<string, unknown>, columnKey: string) => EditableCellOption[];
  // 編集可能かどうかを動的に判定する関数
  isEditable?: (row: Record<string, unknown>, columnKey: string) => boolean;
  // 表示用カラムから編集用カラムへのマッピング（例: leadSourceName -> leadSourceId）
  displayToEditMapping?: Record<string, string>;
};

type CrudTableProps = {
  data: Record<string, unknown>[];
  columns: ColumnDef[];
  emptyMessage?: string;
  onAdd?: (data: Record<string, unknown>) => Promise<void>;
  onUpdate?: (id: number, data: Record<string, unknown>) => Promise<void>;
  onDelete?: (id: number) => Promise<void>;
  title?: string;
  addButtonLabel?: string; // 追加ボタンのラベル
  enableInputModeToggle?: boolean; // 簡易/詳細入力モード切り替えを有効にする
  customActions?: CustomAction[]; // カスタムアクションボタン
  customRenderers?: CustomRenderers; // カスタムセルレンダラー
  customFormFields?: CustomFormFields; // カスタムフォームフィールド
  dynamicOptions?: DynamicOptionsMap; // 動的選択肢（dependsOnフィールドの値に応じて選択肢を変更）
  // 並び替え機能
  sortableItems?: SortableItem[]; // 並び替え用のアイテムリスト
  onReorder?: (orderedIds: number[]) => Promise<void>; // 並び替え完了時のコールバック
  sortableGrouped?: boolean; // グループ内並び替えモード（顧客種別など）
  customAddButton?: React.ReactNode; // カスタム追加ボタン（onAddの代わりにカスタムの追加処理を行う場合）
  // インライン編集機能
  enableInlineEdit?: boolean; // インライン編集を有効にする
  inlineEditConfig?: InlineEditConfig; // インライン編集の設定
  // フォームフィールド変更時のコールバック（企業選択→日付自動計算など）
  onFieldChange?: (fieldKey: string, newValue: unknown, formData: Record<string, unknown>, setFormData: (data: Record<string, unknown>) => void) => void;
  // インライン編集時の警告メッセージ（確認ダイアログに表示）
  updateWarningMessage?: string;
};

function formatValue(value: unknown, type?: string, options?: { value: string; label: string }[]): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "boolean") return value ? "有効" : "無効";
  if (Array.isArray(value)) {
    if (value.length === 0) return "-";
    return value.join(", ");
  }
  // selectタイプ: valueをlabelに変換
  if (type === "select" && options) {
    const option = options.find((opt) => opt.value === String(value));
    if (option) return option.label;
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      // サーバー/クライアント間のHydrationエラーを防ぐため、タイムゾーンを明示的に指定
      const options: Intl.DateTimeFormatOptions = { timeZone: "Asia/Tokyo" };
      if (type === "month") {
        return date.toLocaleDateString("ja-JP", {
          ...options,
          year: "numeric",
          month: "2-digit",
        });
      }
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
      if (type === "date" || type === "month") {
        return toLocalDateString(date);
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
  addButtonLabel = "追加",
  enableInputModeToggle = false,
  customActions = [],
  customRenderers = {},
  customFormFields = {},
  dynamicOptions = {},
  sortableItems,
  onReorder,
  sortableGrouped = false,
  customAddButton,
  enableInlineEdit = false,
  inlineEditConfig,
  onFieldChange,
  updateWarningMessage,
}: CrudTableProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<Record<string, unknown> | null>(null);
  const [editItemOriginal, setEditItemOriginal] = useState<Record<string, unknown>>({});
  const [deleteItem, setDeleteItem] = useState<Record<string, unknown> | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [isSimpleMode, setIsSimpleMode] = useState(true); // デフォルトは簡易入力モード
  const [isSortModalOpen, setIsSortModalOpen] = useState(false);

  // テーブルスクロールコンテナの高さ動的計算
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [tableMaxHeight, setTableMaxHeight] = useState<string | undefined>();

  useEffect(() => {
    const calc = () => {
      if (tableContainerRef.current) {
        const top = tableContainerRef.current.getBoundingClientRect().top;
        const bottomMargin = 24;
        setTableMaxHeight(`${window.innerHeight - top - bottomMargin}px`);
      }
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);

  // インライン編集用の状態
  const [editingCell, setEditingCell] = useState<{ rowId: number; columnKey: string } | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingChange, setPendingChange] = useState<{
    rowId: number;
    columnKey: string;
    oldValue: unknown;
    newValue: unknown;
    fieldName: string;
  } | null>(null);
  const [inlineLoading, setInlineLoading] = useState(false);

  // 編集ダイアログの確認ダイアログ用
  const [editConfirmOpen, setEditConfirmOpen] = useState(false);
  const [editChangedData, setEditChangedData] = useState<Record<string, unknown>>({});
  const [editChangeItems, setEditChangeItems] = useState<ChangeItem[]>([]);

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

  // インライン編集可能なカラムを取得
  const getInlineEditableColumns = useCallback(() => {
    if (!enableInlineEdit) return [];
    if (inlineEditConfig?.columns) {
      return columns.filter((col) => inlineEditConfig.columns!.includes(col.key));
    }
    return columns.filter((col) => col.inlineEditable === true);
  }, [enableInlineEdit, inlineEditConfig?.columns, columns]);

  // カラムがインライン編集可能かチェック
  const isColumnInlineEditable = useCallback(
    (columnKey: string, row: Record<string, unknown>) => {
      if (!enableInlineEdit) {
        return false;
      }

      // カラム設定から判定
      const col = columns.find((c) => c.key === columnKey);
      if (!col) {
        return false;
      }

      // 表示用→編集用のマッピングがある場合
      const mappedEditKey = inlineEditConfig?.displayToEditMapping?.[columnKey];
      if (mappedEditKey) {
        if (inlineEditConfig?.columns) {
          if (!inlineEditConfig.columns.includes(mappedEditKey)) {
            return false;
          }
        }
        if (inlineEditConfig?.isEditable) {
          return inlineEditConfig.isEditable(row, mappedEditKey);
        }
        return true;
      }

      // inlineEditConfig.columnsが指定されている場合は、まずそのリストに含まれているかチェック
      if (inlineEditConfig?.columns) {
        if (!inlineEditConfig.columns.includes(columnKey)) {
          return false; // リストに含まれていなければ編集不可
        }
        // カスタム判定関数がある場合は追加のチェック
        if (inlineEditConfig.isEditable) {
          return inlineEditConfig.isEditable(row, columnKey);
        }
        return true;
      }

      // カスタム判定関数がある場合
      if (inlineEditConfig?.isEditable) {
        return inlineEditConfig.isEditable(row, columnKey);
      }

      // カラムのinlineEditable設定を参照
      return col.inlineEditable === true;
    },
    [enableInlineEdit, inlineEditConfig, columns]
  );

  // インライン編集用の選択肢を取得
  const getInlineEditOptions = useCallback(
    (row: Record<string, unknown>, columnKey: string): EditableCellOption[] => {
      // カスタム選択肢取得関数がある場合
      if (inlineEditConfig?.getOptions) {
        return inlineEditConfig.getOptions(row, columnKey);
      }

      const col = columns.find((c) => c.key === columnKey);
      if (!col) return [];

      // 動的選択肢
      if (col.dynamicOptionsKey && col.dependsOn) {
        const dependsOnValue = row[col.dependsOn];
        const optionsMap = dynamicOptions[col.dynamicOptionsKey];
        if (!optionsMap) return [];

        if (Array.isArray(dependsOnValue)) {
          if (dependsOnValue.length === 0) {
            const allOptions: EditableCellOption[] = [];
            const seen = new Set<string>();
            for (const opts of Object.values(optionsMap)) {
              for (const opt of opts) {
                if (!seen.has(opt.value)) {
                  seen.add(opt.value);
                  allOptions.push(opt);
                }
              }
            }
            return allOptions;
          }
          const merged: EditableCellOption[] = [];
          const seen = new Set<string>();
          const globalOpts = optionsMap["_global"] || [];
          for (const opt of globalOpts) {
            if (!seen.has(opt.value)) {
              seen.add(opt.value);
              merged.push(opt);
            }
          }
          for (const val of dependsOnValue) {
            const opts = optionsMap[String(val)] || [];
            for (const opt of opts) {
              if (!seen.has(opt.value)) {
                seen.add(opt.value);
                merged.push(opt);
              }
            }
          }
          return merged;
        }

        if (dependsOnValue != null) {
          return optionsMap[String(dependsOnValue)] || [];
        }
        return [];
      }

      return col.options || [];
    },
    [inlineEditConfig, columns, dynamicOptions]
  );

  // セルクリックハンドラ
  const handleCellClick = useCallback(
    (row: Record<string, unknown>, columnKey: string) => {
      // カスタムクリックハンドラがある場合
      if (inlineEditConfig?.onCellClick) {
        const handled = inlineEditConfig.onCellClick(row, columnKey);
        if (handled === true) return; // カスタムハンドラで処理済み
      }

      // インライン編集可能かチェック（元のカラムで判定）
      if (!isColumnInlineEditable(columnKey, row)) return;

      // 表示用→編集用のマッピングを適用
      const editColumnKey = inlineEditConfig?.displayToEditMapping?.[columnKey] || columnKey;

      // 同じセルをクリックした場合は何もしない（既に編集中）
      if (
        editingCell?.rowId === (row.id as number) &&
        editingCell?.columnKey === editColumnKey
      ) {
        return;
      }

      // 別のセルをクリック → 新しい編集セルを設定（前の編集は自動的にキャンセル）
      setEditingCell({ rowId: row.id as number, columnKey: editColumnKey });
    },
    [editingCell, inlineEditConfig, isColumnInlineEditable]
  );

  // インライン編集の保存処理
  const handleInlineSave = useCallback(
    (row: Record<string, unknown>, columnKey: string, newValue: unknown, displayFieldName?: string) => {
      const col = columns.find((c) => c.key === columnKey);
      if (!col) return;

      const oldValue = row[columnKey];

      // 値が変わっていない場合はキャンセル
      if (oldValue === newValue) {
        setEditingCell(null);
        return;
      }

      // 配列の比較（multiselect用）
      if (Array.isArray(oldValue) && Array.isArray(newValue)) {
        const oldArr = oldValue as string[];
        const newArr = newValue as string[];
        if (
          oldArr.length === newArr.length &&
          oldArr.every((v) => newArr.includes(v))
        ) {
          setEditingCell(null);
          return;
        }
      }

      // 確認ダイアログを表示（表示用カラムのヘッダー名を優先使用）
      setPendingChange({
        rowId: row.id as number,
        columnKey,
        oldValue,
        newValue,
        fieldName: displayFieldName || col.header,
      });
      setConfirmDialogOpen(true);
    },
    [columns]
  );

  // 確認ダイアログでの保存実行
  const handleConfirmSave = async () => {
    if (!pendingChange || !onUpdate) return;

    setInlineLoading(true);
    try {
      await onUpdate(pendingChange.rowId, { [pendingChange.columnKey]: pendingChange.newValue });
      toast.success("更新しました");
      setEditingCell(null);
      setConfirmDialogOpen(false);
      setPendingChange(null);
    } catch {
      toast.error("更新に失敗しました");
    } finally {
      setInlineLoading(false);
    }
  };

  // 確認ダイアログキャンセル
  const handleConfirmCancel = () => {
    setConfirmDialogOpen(false);
    setPendingChange(null);
    setEditingCell(null);
  };

  // 値を表示用にフォーマット（確認ダイアログ用）
  const formatValueForConfirmation = (value: unknown, columnKey: string, row: Record<string, unknown>): string => {
    const col = columns.find((c) => c.key === columnKey);
    if (!col) return String(value ?? "-");

    const type = (col.type || "text") as EditableCellType;
    const options = getInlineEditOptions(row, columnKey);

    return formatDisplayValue(value, type, options);
  };

  const handleAdd = async () => {
    if (!onAdd) return;
    setLoading(true);
    try {
      await onAdd(formData);
      toast.success("追加しました");
      setIsAddOpen(false);
      setFormData({});
    } catch (error) {
      const message = error instanceof Error ? error.message : "追加に失敗しました";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // 変更差分を計算する共通関数
  const computeChangedData = (): Record<string, unknown> | null => {
    const changedData: Record<string, unknown> = {};
    for (const key of Object.keys(formData)) {
      if (key === "id") continue;
      const oldVal = editItemOriginal[key];
      const newVal = formData[key];
      if (oldVal !== newVal) {
        if ((oldVal === null || oldVal === undefined || oldVal === "") &&
            (newVal === null || newVal === undefined || newVal === "")) {
          continue;
        }
        changedData[key] = newVal;
      }
    }
    if (Object.keys(changedData).length === 0) return null;
    return changedData;
  };

  // 変更差分からChangeItem[]を生成
  const buildChangeItems = (changedData: Record<string, unknown>): ChangeItem[] => {
    return Object.keys(changedData).map((key) => {
      const col = columns.find((c) => c.key === key);
      const fieldName = col?.header || key;
      const oldVal = editItemOriginal[key];
      const newVal = changedData[key];

      const formatVal = (v: unknown): string => {
        if (v === null || v === undefined || v === "") return "-";
        if (col?.type === "select" && col.options) {
          const opt = col.options.find((o) => o.value === String(v));
          if (opt) return opt.label;
        }
        if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) {
          const d = new Date(v);
          if (!isNaN(d.getTime())) {
            return d.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" });
          }
        }
        return String(v);
      };

      return { fieldName, oldValue: formatVal(oldVal), newValue: formatVal(newVal) };
    });
  };

  const handleUpdate = async () => {
    if (!onUpdate || !editItem) return;

    const changedData = computeChangedData();
    if (!changedData) {
      toast.info("変更はありません");
      setEditItem(null);
      setFormData({});
      setEditItemOriginal({});
      return;
    }

    // updateWarningMessageがある場合は確認ダイアログを表示
    if (updateWarningMessage) {
      setEditChangedData(changedData);
      setEditChangeItems(buildChangeItems(changedData));
      setEditConfirmOpen(true);
      return;
    }

    // 警告なしの場合はそのまま更新
    setLoading(true);
    try {
      await onUpdate(editItem.id as number, changedData);
      toast.success("更新しました");
      setEditItem(null);
      setFormData({});
      setEditItemOriginal({});
    } catch (error) {
      const msg = error instanceof Error ? error.message : "更新に失敗しました";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // 編集確認ダイアログでの保存実行
  const handleEditConfirmSave = async () => {
    if (!onUpdate || !editItem) return;
    setLoading(true);
    try {
      await onUpdate(editItem.id as number, editChangedData);
      toast.success("更新しました");
      setEditConfirmOpen(false);
      setEditItem(null);
      setFormData({});
      setEditItemOriginal({});
      setEditChangedData({});
      setEditChangeItems([]);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "更新に失敗しました";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleEditConfirmCancel = () => {
    setEditConfirmOpen(false);
    setEditChangedData({});
    setEditChangeItems([]);
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
    // IDを保持（customFormFieldsで編集対象を識別するため）
    if (item.id !== undefined) {
      initialData.id = item.id;
    }
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
    setEditItemOriginal({ ...initialData });
  };

  const openAddDialog = () => {
    // デフォルト値を設定
    const defaults: Record<string, unknown> = {};
    columns.forEach((col) => {
      if (col.defaultValue !== undefined) {
        defaults[col.key] = col.defaultValue;
      }
    });
    setFormData(defaults);
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

  // フォームフィールド変更時にonFieldChangeも呼び出すヘルパー
  const handleFormFieldChange = useCallback((fieldKey: string, newValue: unknown) => {
    const newFormData = { ...formData, [fieldKey]: newValue };
    setFormData(newFormData);
    if (onFieldChange) {
      onFieldChange(fieldKey, newValue, newFormData, setFormData);
    }
  }, [formData, onFieldChange]);

  const renderFormField = (col: ColumnDef) => {
    const value = formData[col.key];

    // カスタムフォームフィールドが定義されている場合はそれを使用
    if (customFormFields[col.key]) {
      return customFormFields[col.key].render(
        value,
        (newValue) => handleFormFieldChange(col.key, newValue),
        formData,
        setFormData
      );
    }

    // 動的選択肢を取得する関数（selectとmultiselect共通）
    const getOptionsForColumn = (column: ColumnDef): { value: string; label: string }[] => {
      // 動的選択肢が設定されている場合
      if (column.dynamicOptionsKey && column.dependsOn) {
        const dependsOnValue = formData[column.dependsOn];
        const optionsMap = dynamicOptions[column.dynamicOptionsKey];
        if (!optionsMap) return [];

        // dependsOnの値が配列の場合（multiselect対応）
        if (Array.isArray(dependsOnValue)) {
          if (dependsOnValue.length === 0) {
            // 未選択の場合は全オプションを返す
            const allOptions: { value: string; label: string }[] = [];
            const seen = new Set<string>();
            for (const opts of Object.values(optionsMap)) {
              for (const opt of opts) {
                if (!seen.has(opt.value)) {
                  seen.add(opt.value);
                  allOptions.push(opt);
                }
              }
            }
            return allOptions;
          }
          // 選択された各値のオプションをUNION（重複除去）
          const merged: { value: string; label: string }[] = [];
          const seen = new Set<string>();
          // _global キーのオプション（常に表示）
          const globalOpts = optionsMap["_global"] || [];
          for (const opt of globalOpts) {
            if (!seen.has(opt.value)) {
              seen.add(opt.value);
              merged.push(opt);
            }
          }
          for (const val of dependsOnValue) {
            const opts = optionsMap[String(val)] || [];
            for (const opt of opts) {
              if (!seen.has(opt.value)) {
                seen.add(opt.value);
                merged.push(opt);
              }
            }
          }
          return merged;
        }

        // 単一値の場合（既存互換）
        if (dependsOnValue != null) {
          return optionsMap[String(dependsOnValue)] || [];
        }
        return [];
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
                    {col.dependsOn && !formData[col.dependsOn] ? (col.dependsOnPlaceholder || "先に依存項目を選択してください") : "選択してください..."}
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
          <PopoverContent className="w-[400px] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput placeholder="検索..." />
              <CommandList maxHeight={300}>
                <CommandEmpty>
                  {col.dependsOn && !formData[col.dependsOn] ? (col.dependsOnPlaceholder || "先に依存項目を選択してください") : "見つかりませんでした"}
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
                          handleFormFieldChange(col.key, newValues);
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
                {selectedOption ? selectedOption.label : (col.dependsOn && !formData[col.dependsOn] ? (col.dependsOnPlaceholder || "先に依存項目を選択してください") : "選択してください...")}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="start">
              <Command filter={(value, search) => matchesWithWordBoundary(value, search) ? 1 : 0}>
                <CommandInput placeholder="検索..." />
                <CommandList maxHeight={300}>
                  <CommandEmpty>{col.dependsOn && !formData[col.dependsOn] ? (col.dependsOnPlaceholder || "先に依存項目を選択してください") : "見つかりませんでした"}</CommandEmpty>
                  <CommandGroup>
                    {!options.some((opt) => opt.value === "none") && (
                      <CommandItem
                        value="__empty__"
                        onSelect={() => {
                          handleFormFieldChange(col.key, null);
                          setOpenPopovers({ ...openPopovers, [col.key]: false });
                        }}
                      >
                        -
                      </CommandItem>
                    )}
                    {options.map((opt) => (
                      <CommandItem
                        key={opt.value}
                        value={opt.label}
                        onSelect={() => {
                          handleFormFieldChange(col.key, opt.value);
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
          onValueChange={(v) => handleFormFieldChange(col.key, v === "__empty__" ? null : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder={col.dependsOn && !formData[col.dependsOn] ? (col.dependsOnPlaceholder || "先に依存項目を選択") : "選択してください"} />
          </SelectTrigger>
          <SelectContent>
            {!options.some((opt) => opt.value === "none") && (
              <SelectItem value="__empty__">-</SelectItem>
            )}
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
          onValueChange={(v) => handleFormFieldChange(col.key, v === "true")}
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
          onChange={(e) => handleFormFieldChange(col.key, e.target.value || null)}
          rows={3}
        />
      );
    }

    // 日付フィールド
    if (col.type === "date" || col.type === "datetime" || col.type === "month") {
      const dateValue = value ? new Date(value as string) : null;
      return (
        <DatePicker
          selected={dateValue}
          onChange={(date: Date | null) => {
            const newValue = date
              ? col.type === "datetime"
                ? date.toISOString()
                : toLocalDateString(date)
              : null;
            handleFormFieldChange(col.key, newValue);
          }}
          showTimeSelect={col.type === "datetime"}
          showMonthYearPicker={col.type === "month"}
          timeFormat="HH:mm"
          timeIntervals={15}
          dateFormat={col.type === "datetime" ? "yyyy/MM/dd HH:mm" : col.type === "month" ? "yyyy/MM" : "yyyy/MM/dd"}
          locale="ja"
          placeholderText={col.type === "month" ? "年月を選択" : col.type === "date" ? "日付を選択" : "日時を選択"}
          isClearable
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          wrapperClassName="w-full"
          calendarClassName="shadow-lg"
        />
      );
    }

    // 通貨フォーマットの数値入力
    if (col.type === "number" && col.currency) {
      return (
        <Input
          type="text"
          inputMode="numeric"
          value={value != null ? `¥${Number(value).toLocaleString()}` : ""}
          onFocus={(e) => {
            // フォーカス時は数値のみ表示
            e.target.value = value != null ? String(value) : "";
          }}
          onChange={(e) => {
            const cleaned = e.target.value.replace(/[^0-9.-]/g, "");
            const newValue = cleaned ? Number(cleaned) : null;
            handleFormFieldChange(col.key, newValue);
          }}
          onBlur={(e) => {
            // フォーカスアウト時はフォーマット表示に戻す
            const val = formData[col.key];
            e.target.value = val != null ? `¥${Number(val).toLocaleString()}` : "";
          }}
          required={col.required}
          className="text-right"
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
          handleFormFieldChange(col.key, newValue);
        }}
        required={col.required}
      />
    );
  };

  return (
    <div className="space-y-4">
      {/* 検索バー */}
      <div className="flex flex-wrap gap-2 items-center">
        <Select
          value={selectedFilterColumn || "__all__"}
          onValueChange={(v) => {
            setSelectedFilterColumn(v === "__all__" ? "" : v);
            setFilterValue("");
          }}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
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

        <div className="w-full sm:w-auto sm:ml-auto flex gap-2">
          {sortableItems && onReorder && (
            <Button variant="outline" onClick={() => setIsSortModalOpen(true)}>
              <ArrowUpDown className="mr-2 h-4 w-4" />
              並び替え
            </Button>
          )}
          {customAddButton ? (
            customAddButton
          ) : onAdd ? (
            <Button onClick={openAddDialog}>
              <Plus className="mr-2 h-4 w-4" />
              {addButtonLabel}
            </Button>
          ) : null}
        </div>
      </div>

        <Table containerRef={tableContainerRef} containerClassName="overflow-auto" containerStyle={{ maxHeight: tableMaxHeight }}>
          <TableHeader>
            <TableRow>
              {visibleColumns.map((col) => (
                <TableHead key={col.key} className="whitespace-nowrap">
                  {col.header}
                </TableHead>
              ))}
              {(onUpdate || onDelete || customActions.length > 0) && (
                <TableHead className="w-[100px] sticky right-0 z-30 bg-white shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">操作</TableHead>
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
                  {visibleColumns.map((col) => {
                    // 表示用カラムから編集用カラムへのマッピングを取得
                    const editColumnKey = inlineEditConfig?.displayToEditMapping?.[col.key] || col.key;
                    // 編集中かどうか（マッピングを考慮）
                    const isEditing =
                      editingCell?.rowId === (item.id as number) &&
                      (editingCell?.columnKey === col.key || editingCell?.columnKey === editColumnKey);
                    const isInlineEditable = isColumnInlineEditable(col.key, item);
                    // 編集用カラムの定義を取得（マッピングがある場合）
                    const editCol = editColumnKey !== col.key
                      ? columns.find((c) => c.key === editColumnKey)
                      : col;

                    return (
                      <TableCell
                        key={col.key}
                        className={cn(
                          col.type === "textarea" ? "" : "whitespace-nowrap max-w-xs overflow-auto",
                          isInlineEditable && !isEditing && "cursor-pointer hover:bg-muted/50 transition-colors"
                        )}
                        onClick={
                          isInlineEditable && !isEditing
                            ? () => handleCellClick(item, col.key)
                            : undefined
                        }
                      >
                        {isEditing ? (
                          <EditableCell
                            value={item[editColumnKey]}
                            type={((editCol?.type || col.type) || "text") as EditableCellType}
                            options={getInlineEditOptions(item, editColumnKey)}
                            searchable={editCol?.searchable ?? col.searchable}
                            currency={editCol?.currency ?? col.currency}
                            onSave={(newValue) => handleInlineSave(item, editColumnKey, newValue, col.header)}
                            onCancel={() => setEditingCell(null)}
                          />
                        ) : customRenderers[col.key] ? (
                          customRenderers[col.key](item[col.key], item)
                        ) : col.type === "textarea" ? (
                          <TextPreviewCell text={item[col.key] as string | null | undefined} title={col.header} />
                        ) : (
                          formatValue(item[col.key], col.type, col.options)
                        )}
                      </TableCell>
                    );
                  })}
                  {(onUpdate || onDelete || customActions.length > 0) && (
                    <TableCell className="sticky right-0 z-10 bg-white group-hover/row:bg-gray-50 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                      <div className="flex items-center gap-1">
                        {onUpdate && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => openEditDialog(item)}
                              >
                                <Pencil className="h-4 w-4" />
                                <span className="sr-only">編集</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>編集</TooltipContent>
                          </Tooltip>
                        )}
                        {(onDelete || customActions.length > 0) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="xs">
                                操作
                                <ChevronDown className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {customActions.map((action, actionIndex) => (
                                <DropdownMenuItem
                                  key={actionIndex}
                                  variant={action.variant || "default"}
                                  onClick={() => action.onClick(item)}
                                >
                                  {action.icon}
                                  {action.label}
                                </DropdownMenuItem>
                              ))}
                              {customActions.length > 0 && onDelete && (
                                <DropdownMenuSeparator />
                              )}
                              {onDelete && (
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => setDeleteItem(item)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  削除
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

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
            {visibleColumnsForCreate.map((col) => {
              // visibleWhen条件チェック
              if (col.visibleWhen && formData[col.visibleWhen.field] !== col.visibleWhen.value) {
                return null;
              }
              return (
                <div key={col.key} className="space-y-2">
                  <Label>
                    {col.header}
                    {col.required && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  {renderFormField(col)}
                </div>
              );
            })}
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
            {visibleColumnsForUpdate.map((col) => {
              // visibleWhen条件チェック
              if (col.visibleWhen && formData[col.visibleWhen.field] !== col.visibleWhen.value) {
                return null;
              }
              return (
                <div key={col.key} className="space-y-2">
                  <Label>
                    {col.header}
                    {col.required && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  {renderFormField(col)}
                </div>
              );
            })}
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

      {/* Edit Dialog Confirmation Dialog */}
      {updateWarningMessage && editChangeItems.length > 0 && (
        <ChangeConfirmationDialog
          open={editConfirmOpen}
          onOpenChange={(open) => {
            if (!open) handleEditConfirmCancel();
          }}
          changes={editChangeItems}
          onConfirm={handleEditConfirmSave}
          loading={loading}
          warningMessage={updateWarningMessage}
        />
      )}

      {/* Inline Edit Confirmation Dialog */}
      {enableInlineEdit && pendingChange && (
        <ChangeConfirmationDialog
          open={confirmDialogOpen}
          onOpenChange={(open) => {
            if (!open) handleConfirmCancel();
          }}
          changes={[
            {
              fieldName: pendingChange.fieldName,
              oldValue: formatValueForConfirmation(
                pendingChange.oldValue,
                pendingChange.columnKey,
                data.find((d) => d.id === pendingChange.rowId) || {}
              ),
              newValue: formatValueForConfirmation(
                pendingChange.newValue,
                pendingChange.columnKey,
                data.find((d) => d.id === pendingChange.rowId) || {}
              ),
            },
          ]}
          onConfirm={handleConfirmSave}
          loading={inlineLoading}
          warningMessage={updateWarningMessage}
        />
      )}
    </div>
  );
}
