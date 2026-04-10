"use client";

import { useState, useMemo, useCallback, useRef, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, ChevronsUpDown, X, Check, ArrowUpDown, ChevronDown, Loader2, Filter } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { SortableListModal } from "@/components/sortable-list-modal";
import { TextPreviewCell } from "@/components/text-preview-cell";
import { EditableCell, EditableCellType, EditableCellOption, formatDisplayValue } from "@/components/editable-cell";
import { ChangeConfirmationDialog, ChangeItem, ChangeItemWithNote } from "@/components/change-confirmation-dialog";
import { cn, toLocalDateString, matchesWithWordBoundary } from "@/lib/utils";
import { formatValue, formatForInput } from "@/lib/format-utils";
import { toast } from "sonner";
import { isActionResult } from "@/lib/action-result";
import type { ColumnDef, CrudTableProps } from "@/types/crud-table";

/**
 * Server Action の戻り値を自動検知し、ActionResult 形式で ok:false なら
 * クライアント側 Error を throw する。本番モードでの Next.js エラーサニタイズを
 * 回避するための汎用ラッパー。
 *
 * レガシー（void を返す throw ベース）の action と、新形式（ActionResult を返す）
 * の両方に対応する。
 */
async function callAction<T>(fn: () => Promise<T>): Promise<T> {
  const result = await fn();
  if (isActionResult(result) && !result.ok) {
    throw new Error(result.error);
  }
  return result;
}
export type { ColumnDef, CustomAction, CustomRenderers, CustomFormField, CustomFormFields, DynamicOptionsMap, InlineEditConfig, CrudTableProps } from "@/types/crud-table";
import DatePicker, { registerLocale } from "react-datepicker";
import { ja } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";

// 日本語ロケールを登録
registerLocale("ja", ja);


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
  skipInlineConfirm = false,
  inlineEditConfig,
  onFieldChange,
  updateWarningMessage,
  changeTrackedFields = [],
  onDeletePrepare,
  isDeleteDisabled,
  isEditDisabled,
  stickyLeftCount = 0,
  rowClassName,
  customHeaderRenderers,
  groupByKey,
  groupedColumns = [],
}: CrudTableProps) {
  const router = useRouter();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<Record<string, unknown> | null>(null);
  const [editItemOriginal, setEditItemOriginal] = useState<Record<string, unknown>>({});
  const [deleteItem, setDeleteItem] = useState<Record<string, unknown> | null>(null);
  const [deleteInfo, setDeleteInfo] = useState<ReactNode | null>(null);
  const [deleteInfoLoading, setDeleteInfoLoading] = useState(false);
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

  // フィルタ適用時のカラム幅固定（フィルタによるレイアウトずれ防止）
  const allHeaderRefs = useRef<(HTMLTableCellElement | null)[]>([]);
  const [lockedColumnWidths, setLockedColumnWidths] = useState<number[] | null>(null);
  const prevActiveFilterCount = useRef(0);

  // 左側固定列のオフセット計算
  const stickyHeaderRefs = useRef<(HTMLTableCellElement | null)[]>([]);
  const [stickyLeftOffsets, setStickyLeftOffsets] = useState<number[]>([]);

  useEffect(() => {
    if (stickyLeftCount <= 0) return;
    const calcOffsets = () => {
      const offsets: number[] = [];
      let cumulative = 0;
      for (let i = 0; i < stickyLeftCount; i++) {
        offsets.push(cumulative);
        const el = stickyHeaderRefs.current[i];
        if (el) cumulative += el.offsetWidth;
      }
      setStickyLeftOffsets(offsets);
    };
    // 初回レンダリング後に計算
    const timer = setTimeout(calcOffsets, 50);
    window.addEventListener('resize', calcOffsets);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', calcOffsets);
    };
  }, [stickyLeftCount, data]);

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

  // フィールドキーが変更履歴管理対象かチェック（handleInlineSaveより先に宣言）
  const isTrackedFieldForInline = useCallback(
    (key: string) => changeTrackedFields.some((f) => f.key === key),
    [changeTrackedFields]
  );

  // インライン編集の保存処理
  const handleInlineSave = useCallback(
    async (row: Record<string, unknown>, columnKey: string, newValue: unknown, displayFieldName?: string) => {
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

      // skipInlineConfirm時は確認ダイアログなしで即保存（changeTrackedFieldsは引き続き確認）
      if (skipInlineConfirm && !isTrackedFieldForInline(columnKey)) {
        setInlineLoading(true);
        try {
          await callAction(() => onUpdate!(row.id as number, { [columnKey]: newValue }));
          toast.success("更新しました");
          setEditingCell(null);
        } catch (error) {
          const msg = error instanceof Error ? error.message : "更新に失敗しました";
          toast.error(msg);
        } finally {
          setInlineLoading(false);
        }
        return;
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
    [columns, skipInlineConfirm, isTrackedFieldForInline, onUpdate]
  );

  // 確認ダイアログでの保存実行
  const handleConfirmSave = async (changesWithNotes: ChangeItemWithNote[]) => {
    if (!pendingChange || !onUpdate) return;

    setInlineLoading(true);
    try {
      // 変更履歴管理対象フィールドのメモを抽出
      const note = changesWithNotes[0]?.note;
      const updateData: Record<string, unknown> = { [pendingChange.columnKey]: pendingChange.newValue };
      if (note && isTrackedField(pendingChange.columnKey)) {
        updateData.__changeNotes = { [pendingChange.columnKey]: note };
      }
      await callAction(() => onUpdate(pendingChange.rowId, updateData));
      toast.success("更新しました");
      setEditingCell(null);
      setConfirmDialogOpen(false);
      setPendingChange(null);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "更新に失敗しました";
      toast.error(msg);
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

  /**
   * クライアント側で必須項目の入力チェックを行う。
   *
   * 背景: Next.js 本番ビルドでは Server Action 内で throw された Error の
   * メッセージは自動的にサニタイズされ、日本語メッセージが
   * "An error occurred in the Server Components render..." という英語汎用文言に
   * 置き換わってしまう。そのため「UIDは必須です」等のバリデーションエラーは
   * サーバー到達前にクライアント側で弾いて、ユーザーに日本語で表示する必要がある。
   *
   * @returns 不足している必須項目の日本語ヘッダー名配列（空配列ならOK）
   */
  const collectMissingRequiredFields = (
    targetColumns: ColumnDef[]
  ): string[] => {
    const missing: string[] = [];
    for (const col of targetColumns) {
      if (!col.required) continue;
      // visibleWhen / hiddenWhen 条件で非表示のカラムはチェック対象外
      if (
        col.visibleWhen &&
        formData[col.visibleWhen.field] !== col.visibleWhen.value
      ) {
        continue;
      }
      if (
        col.hiddenWhen &&
        formData[col.hiddenWhen.field] === col.hiddenWhen.value
      ) {
        continue;
      }
      const v = formData[col.key];
      const isEmpty =
        v === undefined ||
        v === null ||
        (typeof v === "string" && v.trim() === "");
      if (isEmpty) missing.push(col.header);
    }
    return missing;
  };

  const handleAdd = async () => {
    if (!onAdd) return;

    // 必須項目のクライアント側チェック
    const missing = collectMissingRequiredFields(visibleColumnsForCreate);
    if (missing.length > 0) {
      toast.error(`入力必須項目です: ${missing.join("、")}`);
      return;
    }

    setLoading(true);
    try {
      await callAction(() => onAdd(formData));
      toast.success("追加しました");
      setIsAddOpen(false);
      setFormData({});
    } catch (error) {
      const message = error instanceof Error ? error.message : "追加に失敗しました";
      // isCancel: 類似名称ダイアログで「既存を選択」等のキャンセル操作
      if (error instanceof Error && "isCancel" in error) {
        toast.info(message);
        setIsAddOpen(false);
        setFormData({});
      } else {
        toast.error(message);
      }
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
        // multiselect（カンマ区切り文字列）の集合比較: 順序違いは差分にしない
        const col = columns.find((c) => c.key === key);
        if (col?.type === "multiselect") {
          const toSet = (v: unknown): Set<string> => {
            if (!v) return new Set();
            const s = String(v);
            if (!s) return new Set();
            return new Set(s.split(",").map((x) => x.trim()).filter(Boolean));
          };
          const oldSet = toSet(oldVal);
          const newSet = toSet(newVal);
          if (oldSet.size === newSet.size && [...oldSet].every((v) => newSet.has(v))) {
            continue;
          }
        }
        changedData[key] = newVal;
      }
    }
    if (Object.keys(changedData).length === 0) return null;
    return changedData;
  };

  // フィールドキーが変更履歴管理対象かチェック
  const isTrackedField = useCallback(
    (key: string) => changeTrackedFields.some((f) => f.key === key),
    [changeTrackedFields]
  );

  // 変更差分からChangeItem[]を生成
  const buildChangeItems = (changedData: Record<string, unknown>): ChangeItem[] => {
    return Object.keys(changedData).map((key) => {
      const col = columns.find((c) => c.key === key);
      const fieldName = col?.header || key;
      const oldVal = editItemOriginal[key];
      const newVal = changedData[key];
      const requireNote = isTrackedField(key);

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

      return { fieldName, oldValue: formatVal(oldVal), newValue: formatVal(newVal), requireNote };
    });
  };

  const handleUpdate = async () => {
    if (!onUpdate || !editItem) return;

    // 必須項目のクライアント側チェック（編集時も、必須項目を空にして更新しようとした場合に対策）
    const missing = collectMissingRequiredFields(visibleColumnsForUpdate);
    if (missing.length > 0) {
      toast.error(`入力必須項目です: ${missing.join("、")}`);
      return;
    }

    const changedData = computeChangedData();
    if (!changedData) {
      toast.info("変更はありません");
      setEditItem(null);
      setFormData({});
      setEditItemOriginal({});
      return;
    }

    // updateWarningMessageがある場合、または変更履歴管理対象フィールドが変更された場合は確認ダイアログを表示
    const hasTrackedChange = changeTrackedFields.length > 0 &&
      Object.keys(changedData).some((key) => isTrackedField(key));
    if (updateWarningMessage || hasTrackedChange) {
      setEditChangedData(changedData);
      setEditChangeItems(buildChangeItems(changedData));
      setEditConfirmOpen(true);
      return;
    }

    // 警告なし・履歴管理対象なしの場合はそのまま更新
    setLoading(true);
    try {
      await callAction(() => onUpdate(editItem.id as number, changedData));
      toast.success("更新しました");
      setEditItem(null);
      setFormData({});
      setEditItemOriginal({});
      router.refresh();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "更新に失敗しました";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // 編集確認ダイアログでの保存実行
  const handleEditConfirmSave = async (changesWithNotes: ChangeItemWithNote[]) => {
    if (!onUpdate || !editItem) return;
    setLoading(true);
    try {
      // 変更履歴管理対象フィールドのメモを抽出
      const changeNotes: Record<string, string> = {};
      for (const change of changesWithNotes) {
        if (change.note) {
          // fieldNameからキーを逆引き（headerからkeyを特定）
          const col = columns.find((c) => c.header === change.fieldName);
          if (col) changeNotes[col.key] = change.note;
        }
      }
      const dataWithNotes = Object.keys(changeNotes).length > 0
        ? { ...editChangedData, __changeNotes: changeNotes }
        : editChangedData;
      await callAction(() => onUpdate(editItem.id as number, dataWithNotes));
      toast.success("更新しました");
      setEditConfirmOpen(false);
      setEditItem(null);
      setFormData({});
      setEditItemOriginal({});
      setEditChangedData({});
      setEditChangeItems([]);
      router.refresh();
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
      await callAction(() => onDelete(deleteItem.id as number));
      toast.success("削除しました");
      setDeleteItem(null);
      setDeleteInfo(null);
      router.refresh();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "削除に失敗しました";
      toast.error(msg);
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
    // 編集可能なカラムの値を設定（password型は空にして新規入力を促す）
    editableColumnsForUpdate.forEach((col) => {
      initialData[col.key] = col.type === "password" ? "" : item[col.key];
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
      } else if (col.type === "boolean") {
        defaults[col.key] = true;
      }
    });
    setFormData(defaults);
    setIsAddOpen(true);
  };

  const [openPopovers, setOpenPopovers] = useState<Record<string, boolean>>({});

  // 検索用の状態（従来の全体検索）
  const [selectedFilterColumn, setSelectedFilterColumn] = useState<string>("");
  const [filterValue, setFilterValue] = useState<string>("");

  // 列ごとのフィルタ状態（スプレッドシート風）
  type ColumnFilter = {
    checkedValues: Set<string>;  // チェックされた値のSet（チェックボックス方式）
    allValues: Set<string>;      // その列の全ユニーク値（全チェック＝フィルタ無効と判定用）
    dateFrom: string;            // 日付範囲: 開始（日付列のみ）
    dateTo: string;              // 日付範囲: 終了（日付列のみ）
    textSearch: string;          // テキスト含む検索（textarea列のみ）
  };
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilter>>({});
  const [openFilterColumn, setOpenFilterColumn] = useState<string | null>(null);
  const [filterSearchTerms, setFilterSearchTerms] = useState<Record<string, string>>({});
  // Popover内の一時編集用state（OKボタンで確定）
  const [draftFilter, setDraftFilter] = useState<{
    checkedValues: Set<string>;
    dateFrom: string;
    dateTo: string;
    textSearch: string;
  } | null>(null);
  const activeFilterCount = Object.entries(columnFilters).filter(([, f]) => {
    // textarea列: textSearchがあればアクティブ
    if (f.textSearch) return true;
    // 日付期間が設定されていればアクティブ
    if (f.dateFrom || f.dateTo) return true;
    // チェックが全選択と異なればアクティブ
    if (f.checkedValues.size !== f.allValues.size) return true;
    return false;
  }).length;

  // フィルタ適用時のカラム幅固定effect
  useEffect(() => {
    if (activeFilterCount > 0 && prevActiveFilterCount.current === 0) {
      const widths = allHeaderRefs.current.map((el) => el?.offsetWidth ?? 0);
      setLockedColumnWidths(widths);
    }
    if (activeFilterCount === 0 && prevActiveFilterCount.current > 0) {
      setLockedColumnWidths(null);
    }
    prevActiveFilterCount.current = activeFilterCount;
  }, [activeFilterCount]);

  // テーブル表示用のカラム（hidden除外）
  const visibleColumns = columns.filter((col) => col.hidden !== true);

  // 列のユニーク値を実データから抽出
  const columnUniqueValues = useMemo(() => {
    const result: Record<string, { value: string; label: string }[]> = {};
    for (const col of visibleColumns) {
      if (col.filterable === false || col.key === "id") continue;
      const colType = col.type || "text";
      if (colType === "textarea") continue; // textareaはチェックボックス不要

      const valuesMap = new Map<string, string>(); // value -> label
      let hasEmpty = false;

      for (const item of data) {
        const raw = item[col.key];
        if (raw === null || raw === undefined || raw === "") {
          hasEmpty = true;
          continue;
        }
        const strVal = String(raw);
        if (!valuesMap.has(strVal)) {
          // labelを決定
          if (col.options) {
            const opt = col.options.find((o) => o.value === strVal);
            valuesMap.set(strVal, opt?.label || strVal);
          } else if (colType === "boolean") {
            valuesMap.set(strVal, raw === true ? "有効" : "無効");
          } else if (colType === "date" || colType === "datetime" || colType === "month") {
            // 日付はYYYY/MM/DD形式で表示
            const d = new Date(strVal);
            if (!isNaN(d.getTime())) {
              valuesMap.set(strVal, d.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }));
            } else {
              valuesMap.set(strVal, strVal);
            }
          } else {
            valuesMap.set(strVal, strVal);
          }
        }
      }

      const entries: { value: string; label: string }[] = [];
      if (hasEmpty) {
        entries.push({ value: "__empty__", label: "（空白）" });
      }
      // ソート: 日付はvalue(ISO)順、その他はlabel順
      const sorted = Array.from(valuesMap.entries());
      if (colType === "date" || colType === "datetime" || colType === "month") {
        sorted.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
      } else {
        sorted.sort((a, b) => a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0);
      }
      for (const [v, l] of sorted) {
        entries.push({ value: v, label: l });
      }
      result[col.key] = entries;
    }
    return result;
  }, [data, visibleColumns]);

  // フィルタリング可能なカラム
  const filterableColumns = visibleColumns.filter((col) => {
    if (col.filterable === false) return false;
    if (col.key === "id") return false;
    const filterableTypes = ["text", "number", "select", "boolean", "textarea", "multiselect", "date", "datetime", "month"];
    return !col.type || filterableTypes.includes(col.type);
  });

  // マッチング関数（全体検索用）
  const matchValue = useCallback((value: unknown, col: ColumnDef | undefined, searchTerm: string): boolean => {
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
  }, []);

  // 列フィルタのマッチング関数
  const matchColumnFilter = useCallback((value: unknown, col: ColumnDef, filter: ColumnFilter): boolean => {
    const colType = col.type || "text";

    // textarea列: テキスト含む検索
    if (colType === "textarea") {
      if (!filter.textSearch) return true;
      if (value === null || value === undefined) return false;
      return String(value).toLowerCase().includes(filter.textSearch.toLowerCase());
    }

    // チェックボックスフィルタが全選択と異なる場合に適用
    const isCheckboxFiltered = filter.checkedValues.size !== filter.allValues.size;

    // 日付タイプ: チェックボックス AND/OR 期間フィルタ
    if (colType === "date" || colType === "datetime" || colType === "month") {
      const hasDateRange = !!(filter.dateFrom || filter.dateTo);

      if (!isCheckboxFiltered && !hasDateRange) return true;

      const isEmpty = value === null || value === undefined || value === "";
      const strVal = isEmpty ? "__empty__" : String(value);

      // チェックだけの場合
      if (isCheckboxFiltered && !hasDateRange) {
        return filter.checkedValues.has(strVal);
      }

      // 期間だけの場合
      if (!isCheckboxFiltered && hasDateRange) {
        if (isEmpty) return false;
        const dateValue = strVal.slice(0, 10);
        if (filter.dateFrom && dateValue < filter.dateFrom) return false;
        if (filter.dateTo && dateValue > filter.dateTo) return false;
        return true;
      }

      // 両方ある場合: 期間フィルタをメインとし、チェックも考慮（AND条件）
      if (isEmpty) return filter.checkedValues.has("__empty__");
      const dateValue = strVal.slice(0, 10);
      const inRange = (!filter.dateFrom || dateValue >= filter.dateFrom) && (!filter.dateTo || dateValue <= filter.dateTo);
      return inRange && filter.checkedValues.has(strVal);
    }

    // チェックボックスフィルタ（select/text/number/boolean共通）
    if (!isCheckboxFiltered) return true;
    const isEmpty = value === null || value === undefined || value === "";
    const strVal = isEmpty ? "__empty__" : String(value);
    return filter.checkedValues.has(strVal);
  }, []);

  // フィルタリングされたデータ（全体検索 + 列フィルタの両方を適用）
  const filteredData = useMemo(() => {
    let result = data;

    // 列ごとのフィルタを適用
    const filterEntries = Object.entries(columnFilters);
    if (filterEntries.length > 0) {
      result = result.filter((item) => {
        return filterEntries.every(([colKey, filter]) => {
          const col = columns.find((c) => c.key === colKey);
          if (!col) return true;
          return matchColumnFilter(item[colKey], col, filter);
        });
      });
    }

    // 全体検索フィルタを適用
    if (filterValue) {
      const searchTerm = filterValue.toLowerCase();
      result = result.filter((item) => {
        if (selectedFilterColumn) {
          const col = columns.find((c) => c.key === selectedFilterColumn);
          return matchValue(item[selectedFilterColumn], col, searchTerm);
        }
        return filterableColumns.some((col) => {
          return matchValue(item[col.key], col, searchTerm);
        });
      });
    }

    return result;
  }, [data, filterValue, selectedFilterColumn, filterableColumns, columns, columnFilters, matchValue, matchColumnFilter]);

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
            {selectedCol.options.filter((opt) => opt.value !== "").map((opt) => (
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
            {options.filter((opt) => opt.value !== "").map((opt) => (
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
        type={col.type === "password" ? "password" : col.type === "number" ? "number" : "text"}
        value={formatForInput(value, col.type)}
        onChange={(e) => {
          let newValue: unknown = e.target.value || null;
          if (col.type === "number" && e.target.value) {
            newValue = Number(e.target.value);
          }
          handleFormFieldChange(col.key, newValue);
        }}
        required={col.required}
        autoComplete={col.type === "password" ? "off" : undefined}
        placeholder={col.type === "password" && editItem ? "変更する場合のみ入力" : undefined}
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

        {activeFilterCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1"
            onClick={() => setColumnFilters({})}
          >
            <Filter className="h-3.5 w-3.5" />
            列フィルタ解除（{activeFilterCount}件）
            <X className="h-3 w-3" />
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
              {visibleColumns.map((col, colIdx) => {
                const isSticky = colIdx < stickyLeftCount;
                const isLastSticky = colIdx === stickyLeftCount - 1;
                const colType = col.type || "text";
                const isFilterable = col.filterable !== false && col.key !== "id" &&
                  (["text", "number", "select", "boolean", "textarea", "multiselect", "date", "datetime", "month"].includes(colType));
                const isDateType = colType === "date" || colType === "datetime" || colType === "month";
                const isTextarea = colType === "textarea";
                const currentFilter = columnFilters[col.key];
                const hasActiveFilter = !!currentFilter && (
                  currentFilter.textSearch ||
                  currentFilter.dateFrom ||
                  currentFilter.dateTo ||
                  currentFilter.checkedValues.size !== currentFilter.allValues.size
                );

                // このPopoverで使うユニーク値リスト
                const uniqueValues = columnUniqueValues[col.key] || [];
                const allValueKeys = new Set(uniqueValues.map((u) => u.value));

                // フィルタ内の検索で絞り込まれたリスト
                const searchTerm = filterSearchTerms[col.key] || "";
                const filteredUniqueValues = searchTerm
                  ? uniqueValues.filter((u) => u.label.toLowerCase().includes(searchTerm.toLowerCase()))
                  : uniqueValues;

                return (
                  <TableHead
                    key={col.key}
                    ref={(el) => {
                      allHeaderRefs.current[colIdx] = el;
                      if (isSticky) stickyHeaderRefs.current[colIdx] = el;
                    }}
                    className={cn(
                      "whitespace-nowrap",
                      isSticky && "sticky z-30 bg-white",
                      isLastSticky && "shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]",
                      col.cellClassName
                    )}
                    style={{
                      ...(isSticky ? { left: stickyLeftOffsets[colIdx] ?? 0 } : {}),
                      ...(lockedColumnWidths?.[colIdx] ? { minWidth: lockedColumnWidths[colIdx] } : {}),
                      ...(col.width ? { width: col.width } : {}),
                    }}
                  >
                    <div className="flex items-center gap-1">
                      {customHeaderRenderers?.[col.key]?.() ?? col.header}
                      {isFilterable && (
                        <Popover
                          open={openFilterColumn === col.key}
                          onOpenChange={(open) => {
                            if (open) {
                              // Popover開: 現在のフィルタからdraft初期化
                              setDraftFilter({
                                checkedValues: new Set(currentFilter?.checkedValues || allValueKeys),
                                dateFrom: currentFilter?.dateFrom || "",
                                dateTo: currentFilter?.dateTo || "",
                                textSearch: currentFilter?.textSearch || "",
                              });
                            } else {
                              // Popover閉: draftクリア
                              setDraftFilter(null);
                              setFilterSearchTerms((prev) => {
                                const next = { ...prev };
                                delete next[col.key];
                                return next;
                              });
                            }
                            setOpenFilterColumn(open ? col.key : null);
                          }}
                        >
                          <PopoverTrigger asChild>
                            <button
                              className={cn(
                                "inline-flex items-center justify-center rounded p-0.5 hover:bg-muted transition-colors",
                                hasActiveFilter && "text-primary bg-primary/10"
                              )}
                            >
                              <Filter className={cn("h-3.5 w-3.5", hasActiveFilter && "fill-primary/20")} />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-72 p-3" align="start" onClick={(e) => e.stopPropagation()}>
                            {openFilterColumn === col.key && draftFilter && (() => {
                              // draft用のcheckedValues
                              const draftChecked = draftFilter.checkedValues;

                              // OKボタン: draftをcolumnFiltersに確定
                              const handleOk = () => {
                                const isAllChecked = draftChecked.size === allValueKeys.size;
                                const hasDateRange = !!(draftFilter.dateFrom || draftFilter.dateTo);
                                const hasTextSearch = !!draftFilter.textSearch;

                                if (isAllChecked && !hasDateRange && !hasTextSearch) {
                                  // フィルタなし状態 → 削除
                                  setColumnFilters((prev) => {
                                    const next = { ...prev };
                                    delete next[col.key];
                                    return next;
                                  });
                                } else {
                                  setColumnFilters((prev) => ({
                                    ...prev,
                                    [col.key]: {
                                      checkedValues: new Set(draftChecked),
                                      allValues: allValueKeys,
                                      dateFrom: draftFilter.dateFrom,
                                      dateTo: draftFilter.dateTo,
                                      textSearch: draftFilter.textSearch,
                                    },
                                  }));
                                }
                                setOpenFilterColumn(null);
                                setDraftFilter(null);
                              };

                              // キャンセル: draftを破棄
                              const handleCancel = () => {
                                setOpenFilterColumn(null);
                                setDraftFilter(null);
                              };

                              return (
                                <div className="space-y-2">
                                  <p className="text-sm font-medium">{col.header} でフィルタ</p>

                                  {/* textarea列: テキスト含む検索 */}
                                  {isTextarea && (
                                    <Input
                                      placeholder="テキストを含む..."
                                      className="h-8 text-sm"
                                      value={draftFilter.textSearch}
                                      onChange={(e) => setDraftFilter({ ...draftFilter, textSearch: e.target.value })}
                                    />
                                  )}

                                  {/* チェックボックス方式（textarea以外） */}
                                  {!isTextarea && (
                                    <>
                                      {/* 日付列: 期間指定 */}
                                      {isDateType && (
                                        <div className="space-y-1.5 pb-2 border-b">
                                          <p className="text-xs text-muted-foreground font-medium">期間指定</p>
                                          <div className="flex items-center gap-2">
                                            <Input
                                              type="date"
                                              className="h-7 text-xs flex-1"
                                              value={draftFilter.dateFrom}
                                              onChange={(e) => setDraftFilter({ ...draftFilter, dateFrom: e.target.value })}
                                            />
                                            <span className="text-xs text-muted-foreground">〜</span>
                                            <Input
                                              type="date"
                                              className="h-7 text-xs flex-1"
                                              value={draftFilter.dateTo}
                                              onChange={(e) => setDraftFilter({ ...draftFilter, dateTo: e.target.value })}
                                            />
                                          </div>
                                        </div>
                                      )}

                                      {/* すべて選択 / クリア */}
                                      <div className="flex items-center gap-2 text-xs">
                                        <button
                                          className="text-primary hover:underline"
                                          onClick={() => setDraftFilter({ ...draftFilter, checkedValues: new Set(allValueKeys) })}
                                        >
                                          すべて選択
                                        </button>
                                        <span className="text-muted-foreground">-</span>
                                        <button
                                          className="text-primary hover:underline"
                                          onClick={() => setDraftFilter({ ...draftFilter, checkedValues: new Set<string>() })}
                                        >
                                          クリア
                                        </button>
                                        <span className="ml-auto text-muted-foreground">
                                          {draftChecked.size} / {allValueKeys.size} 件
                                        </span>
                                      </div>

                                      {/* 検索ボックス（値が多い場合のみ） */}
                                      {uniqueValues.length > 8 && (
                                        <Input
                                          placeholder="検索..."
                                          className="h-7 text-xs"
                                          value={searchTerm}
                                          onChange={(e) => setFilterSearchTerms((prev) => ({ ...prev, [col.key]: e.target.value }))}
                                        />
                                      )}

                                      {/* チェックボックスリスト */}
                                      <div className="max-h-48 overflow-y-auto space-y-0.5">
                                        {filteredUniqueValues.map((item) => (
                                          <label
                                            key={item.value}
                                            className="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted cursor-pointer text-sm"
                                          >
                                            <Checkbox
                                              checked={draftChecked.has(item.value)}
                                              onCheckedChange={(checked) => {
                                                const newChecked = new Set(draftChecked);
                                                if (checked) {
                                                  newChecked.add(item.value);
                                                } else {
                                                  newChecked.delete(item.value);
                                                }
                                                setDraftFilter({ ...draftFilter, checkedValues: newChecked });
                                              }}
                                              className="h-3.5 w-3.5"
                                            />
                                            <span className="truncate">{item.label}</span>
                                          </label>
                                        ))}
                                        {filteredUniqueValues.length === 0 && (
                                          <p className="text-xs text-muted-foreground text-center py-2">該当なし</p>
                                        )}
                                      </div>
                                    </>
                                  )}

                                  {/* OK / キャンセル / フィルタ解除 */}
                                  <div className="flex items-center gap-2 pt-1 border-t">
                                    {hasActiveFilter && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-xs text-muted-foreground px-2"
                                        onClick={() => {
                                          setColumnFilters((prev) => {
                                            const next = { ...prev };
                                            delete next[col.key];
                                            return next;
                                          });
                                          setOpenFilterColumn(null);
                                          setDraftFilter(null);
                                        }}
                                      >
                                        解除
                                      </Button>
                                    )}
                                    <div className="flex-1" />
                                    <Button variant="outline" size="sm" className="text-xs px-3" onClick={handleCancel}>
                                      キャンセル
                                    </Button>
                                    <Button size="sm" className="text-xs px-4" onClick={handleOk}>
                                      OK
                                    </Button>
                                  </div>
                                </div>
                              );
                            })()}
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  </TableHead>
                );
              })}
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
              filteredData.map((item, index) => {
                // グループ化: rowSpan情報を計算
                const groupKey = groupByKey ? item[groupByKey] : undefined;
                let isGroupFirstRow = true;
                let groupSpan = 1;
                const groupedColSet = new Set(groupedColumns);

                if (groupByKey && groupKey !== undefined) {
                  // このアイテムのグループ内での位置を計算
                  let groupStartIdx = index;
                  while (groupStartIdx > 0 && filteredData[groupStartIdx - 1][groupByKey] === groupKey) {
                    groupStartIdx--;
                  }
                  isGroupFirstRow = groupStartIdx === index;
                  if (isGroupFirstRow) {
                    // グループサイズを計算
                    groupSpan = 1;
                    let nextIdx = index + 1;
                    while (nextIdx < filteredData.length && filteredData[nextIdx][groupByKey] === groupKey) {
                      groupSpan++;
                      nextIdx++;
                    }
                  }
                }

                const isGroupMiddleOrLastRow = groupByKey && groupKey !== undefined && !isGroupFirstRow;

                return (
                <TableRow
                  key={(item.id as number) || index}
                  className={cn(
                    rowClassName?.(item),
                    // グループ内の中間行は上ボーダーを消す
                    isGroupMiddleOrLastRow && "!border-t-0"
                  )}
                >
                  {visibleColumns.map((col, colIdx) => {
                    // グループ化対象カラム: 先頭行以外はスキップ（rowSpanで結合されるため）
                    const isGroupedCol = groupedColSet.has(col.key);
                    if (isGroupedCol && isGroupMiddleOrLastRow) {
                      return null;
                    }

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

                    const isStickyLeft = colIdx < stickyLeftCount;
                    const isLastStickyLeft = colIdx === stickyLeftCount - 1;

                    return (
                      <TableCell
                        key={col.key}
                        rowSpan={isGroupedCol && isGroupFirstRow && groupSpan > 1 ? groupSpan : undefined}
                        className={cn(
                          col.type === "textarea" ? "" : "whitespace-nowrap max-w-xs overflow-auto",
                          isInlineEditable && !isEditing && "cursor-pointer hover:bg-muted/50 transition-colors",
                          col.type === "password" && "select-none",
                          isStickyLeft && "sticky z-10 bg-white group-hover/row:bg-gray-50",
                          isLastStickyLeft && "shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]",
                          // rowSpanセルは縦中央揃え
                          isGroupedCol && isGroupFirstRow && groupSpan > 1 && "align-middle",
                          col.cellClassName
                        )}
                        style={{
                          ...(isStickyLeft ? { left: stickyLeftOffsets[colIdx] ?? 0 } : {}),
                          ...(col.width ? { width: col.width } : {}),
                        }}
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
                        {onUpdate && !(isEditDisabled?.(item)) && (
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
                              {customActions.length > 0 && onDelete && !(isDeleteDisabled?.(item)) && (
                                <DropdownMenuSeparator />
                              )}
                              {onDelete && !(isDeleteDisabled?.(item)) && (
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => {
                                    setDeleteItem(item);
                                    setDeleteInfo(null);
                                    if (onDeletePrepare) {
                                      setDeleteInfoLoading(true);
                                      onDeletePrepare(item.id as number)
                                        .then(setDeleteInfo)
                                        .catch(() => setDeleteInfo(null))
                                        .finally(() => setDeleteInfoLoading(false));
                                    }
                                  }}
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
                );
              })
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
              // hiddenWhen条件チェック
              if (col.hiddenWhen && formData[col.hiddenWhen.field] === col.hiddenWhen.value) {
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
              // hiddenWhen条件チェック
              if (col.hiddenWhen && formData[col.hiddenWhen.field] === col.hiddenWhen.value) {
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
      <Dialog open={!!deleteItem} onOpenChange={(open) => { if (!open) { setDeleteItem(null); setDeleteInfo(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>削除確認</DialogTitle>
          </DialogHeader>
          <p>このデータを削除しますか？</p>
          {deleteInfoLoading && (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">関連データを確認中...</span>
            </div>
          )}
          {!deleteInfoLoading && deleteInfo}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteItem(null); setDeleteInfo(null); }}>
              キャンセル
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading || deleteInfoLoading}>
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
      {editChangeItems.length > 0 && (
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
              requireNote: isTrackedField(pendingChange.columnKey),
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
